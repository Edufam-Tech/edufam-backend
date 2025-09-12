const { query } = require('../config/database');
const { sendEmail } = require('../services/emailService');

class InvoiceController {
  // Generate a single invoice
  static async generateInvoice(req, res, next) {
    try {
      const { studentId, feeAssignmentId, dueDate, notes } = req.body;
      const schoolId = req.user.schoolId;

      // Validate required fields
      if (!studentId || !feeAssignmentId) {
        return res.status(400).json({
          success: false,
          message: 'Student ID and Fee Assignment ID are required'
        });
      }

      // Get fee assignment details
      const feeAssignment = await query(`
        SELECT 
          fa.*,
          fs.name as fee_name,
          fs.amount as fee_amount,
          s.first_name,
          s.last_name,
          s.email,
          s.phone
        FROM fee_assignments fa
        JOIN fee_structures fs ON fa.fee_structure_id = fs.id
        JOIN students s ON fa.student_id = s.id
        WHERE fa.id = $1 AND fs.school_id = $2
      `, [feeAssignmentId, schoolId]);

      if (feeAssignment.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Fee assignment not found'
        });
      }

      const assignment = feeAssignment.rows[0];
      const invoiceNumber = `INV-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Create invoice
      const result = await query(`
        INSERT INTO invoices (
          invoice_number,
          student_id,
          fee_assignment_id,
          amount,
          due_date,
          status,
          notes,
          school_id,
          created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `, [
        invoiceNumber,
        studentId,
        feeAssignmentId,
        assignment.amount,
        dueDate || assignment.due_date,
        'pending',
        notes || '',
        schoolId,
        req.user.id
      ]);

      const invoice = result.rows[0];

      res.status(201).json({
        success: true,
        message: 'Invoice generated successfully',
        data: invoice
      });
    } catch (error) {
      next(error);
    }
  }

  // Get a specific invoice
  static async getInvoice(req, res, next) {
    try {
      const { id } = req.params;
      const schoolId = req.user.schoolId;

      const result = await query(`
        SELECT 
          i.*,
          s.first_name,
          s.last_name,
          s.email,
          s.phone,
          fs.name as fee_name,
          fs.term,
          fs.academic_year_id
        FROM invoices i
        JOIN students s ON i.student_id = s.id
        JOIN fee_assignments fa ON i.fee_assignment_id = fa.id
        JOIN fee_structures fs ON fa.fee_structure_id = fs.id
        WHERE i.id = $1 AND i.school_id = $2
      `, [id, schoolId]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Invoice not found'
        });
      }

      res.json({
        success: true,
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }

  // Bulk generate invoices
  static async bulkGenerateInvoices(req, res, next) {
    try {
      const { feeAssignmentIds, dueDate, notes } = req.body;
      const schoolId = req.user.schoolId;

      if (!Array.isArray(feeAssignmentIds) || feeAssignmentIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Fee assignment IDs array is required'
        });
      }

      const invoices = [];
      const errors = [];

      for (const feeAssignmentId of feeAssignmentIds) {
        try {
          // Get fee assignment details
          const feeAssignment = await query(`
            SELECT 
              fa.*,
              fs.name as fee_name,
              s.first_name,
              s.last_name
            FROM fee_assignments fa
            JOIN fee_structures fs ON fa.fee_structure_id = fs.id
            JOIN students s ON fa.student_id = s.id
            WHERE fa.id = $1 AND fs.school_id = $2
          `, [feeAssignmentId, schoolId]);

          if (feeAssignment.rows.length === 0) {
            errors.push(`Fee assignment ${feeAssignmentId} not found`);
            continue;
          }

          const assignment = feeAssignment.rows[0];
          const invoiceNumber = `INV-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

          // Create invoice
          const result = await query(`
            INSERT INTO invoices (
              invoice_number,
              student_id,
              fee_assignment_id,
              amount,
              due_date,
              status,
              notes,
              school_id,
              created_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *
          `, [
            invoiceNumber,
            assignment.student_id,
            feeAssignmentId,
            assignment.amount,
            dueDate || assignment.due_date,
            'pending',
            notes || '',
            schoolId,
            req.user.id
          ]);

          invoices.push(result.rows[0]);
        } catch (error) {
          errors.push(`Error creating invoice for assignment ${feeAssignmentId}: ${error.message}`);
        }
      }

      res.status(201).json({
        success: true,
        message: `Generated ${invoices.length} invoices successfully`,
        data: {
          invoices,
          errors: errors.length > 0 ? errors : undefined
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Send invoice via email
  static async sendInvoice(req, res, next) {
    try {
      const { invoiceId, email, subject, message } = req.body;
      const schoolId = req.user.schoolId;

      // Get invoice details
      const result = await query(`
        SELECT 
          i.*,
          s.first_name,
          s.last_name,
          s.email as student_email,
          s.phone,
          fs.name as fee_name,
          fs.term,
          fs.academic_year_id
        FROM invoices i
        JOIN students s ON i.student_id = s.id
        JOIN fee_assignments fa ON i.fee_assignment_id = fa.id
        JOIN fee_structures fs ON fa.fee_structure_id = fs.id
        WHERE i.id = $1 AND i.school_id = $2
      `, [invoiceId, schoolId]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Invoice not found'
        });
      }

      const invoice = result.rows[0];
      const recipientEmail = email || invoice.student_email;

      if (!recipientEmail) {
        return res.status(400).json({
          success: false,
          message: 'No email address available for student'
        });
      }

      // Send email
      const emailSubject = subject || `Invoice ${invoice.invoice_number} - ${invoice.fee_name}`;
      const emailMessage = message || `
        Dear ${invoice.first_name} ${invoice.last_name},
        
        Please find attached your invoice for ${invoice.fee_name}.
        
        Invoice Number: ${invoice.invoice_number}
        Amount: ${invoice.amount}
        Due Date: ${new Date(invoice.due_date).toLocaleDateString()}
        
        Thank you for your prompt payment.
      `;

      await sendEmail({
        to: recipientEmail,
        subject: emailSubject,
        text: emailMessage,
        html: emailMessage.replace(/\n/g, '<br>')
      });

      // Update invoice status
      await query(`
        UPDATE invoices 
        SET status = 'sent', sent_at = NOW()
        WHERE id = $1
      `, [invoiceId]);

      res.json({
        success: true,
        message: 'Invoice sent successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  // Get invoices for a specific student
  static async getStudentInvoices(req, res, next) {
    try {
      const { id } = req.params;
      const schoolId = req.user.schoolId;

      const result = await query(`
        SELECT 
          i.*,
          fs.name as fee_name,
          fs.term,
          fs.academic_year_id
        FROM invoices i
        JOIN fee_assignments fa ON i.fee_assignment_id = fa.id
        JOIN fee_structures fs ON fa.fee_structure_id = fs.id
        WHERE i.student_id = $1 AND i.school_id = $2
        ORDER BY i.created_at DESC
      `, [id, schoolId]);

      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      next(error);
    }
  }

  // Get all invoices with filters
  static async getInvoices(req, res, next) {
    try {
      const { status, studentId, page = 1, limit = 50 } = req.query;
      const schoolId = req.user.schoolId;
      const offset = (page - 1) * limit;

      let whereClause = 'WHERE i.school_id = $1';
      let queryParams = [schoolId];
      let paramCount = 1;

      if (status) {
        paramCount++;
        whereClause += ` AND i.status = $${paramCount}`;
        queryParams.push(status);
      }

      if (studentId) {
        paramCount++;
        whereClause += ` AND i.student_id = $${paramCount}`;
        queryParams.push(studentId);
      }

      const result = await query(`
        SELECT 
          i.*,
          s.first_name,
          s.last_name,
          s.email,
          s.phone,
          fs.name as fee_name,
          fs.term,
          fs.academic_year_id
        FROM invoices i
        JOIN students s ON i.student_id = s.id
        JOIN fee_assignments fa ON i.fee_assignment_id = fa.id
        JOIN fee_structures fs ON fa.fee_structure_id = fs.id
        ${whereClause}
        ORDER BY i.created_at DESC
        LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
      `, [...queryParams, limit, offset]);

      // Get total count
      const countResult = await query(`
        SELECT COUNT(*) as total
        FROM invoices i
        JOIN students s ON i.student_id = s.id
        JOIN fee_assignments fa ON i.fee_assignment_id = fa.id
        JOIN fee_structures fs ON fa.fee_structure_id = fs.id
        ${whereClause}
      `, queryParams);

      res.json({
        success: true,
        data: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: parseInt(countResult.rows[0].total),
          pages: Math.ceil(countResult.rows[0].total / limit)
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Update invoice
  static async updateInvoice(req, res, next) {
    try {
      const { id } = req.params;
      const { status, notes, dueDate } = req.body;
      const schoolId = req.user.schoolId;

      const updateFields = [];
      const updateValues = [];
      let paramCount = 0;

      if (status !== undefined) {
        paramCount++;
        updateFields.push(`status = $${paramCount}`);
        updateValues.push(status);
      }

      if (notes !== undefined) {
        paramCount++;
        updateFields.push(`notes = $${paramCount}`);
        updateValues.push(notes);
      }

      if (dueDate !== undefined) {
        paramCount++;
        updateFields.push(`due_date = $${paramCount}`);
        updateValues.push(dueDate);
      }

      if (updateFields.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No fields to update'
        });
      }

      paramCount++;
      updateFields.push(`updated_at = NOW()`);
      updateValues.push(id, schoolId);

      const result = await query(`
        UPDATE invoices 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramCount} AND school_id = $${paramCount + 1}
        RETURNING *
      `, updateValues);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Invoice not found'
        });
      }

      res.json({
        success: true,
        message: 'Invoice updated successfully',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }

  // Bulk send invoices
  static async bulkSendInvoices(req, res, next) {
    try {
      const { invoiceIds, subject, message } = req.body;
      const schoolId = req.user.schoolId;

      if (!Array.isArray(invoiceIds) || invoiceIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Invoice IDs array is required'
        });
      }

      const sentInvoices = [];
      const errors = [];

      for (const invoiceId of invoiceIds) {
        try {
          // Get invoice details
          const result = await query(`
            SELECT 
              i.*,
              s.first_name,
              s.last_name,
              s.email as student_email,
              fs.name as fee_name
            FROM invoices i
            JOIN students s ON i.student_id = s.id
            JOIN fee_assignments fa ON i.fee_assignment_id = fa.id
            JOIN fee_structures fs ON fa.fee_structure_id = fs.id
            WHERE i.id = $1 AND i.school_id = $2
          `, [invoiceId, schoolId]);

          if (result.rows.length === 0) {
            errors.push(`Invoice ${invoiceId} not found`);
            continue;
          }

          const invoice = result.rows[0];

          if (!invoice.student_email) {
            errors.push(`No email address for invoice ${invoiceId}`);
            continue;
          }

          // Send email
          const emailSubject = subject || `Invoice ${invoice.invoice_number} - ${invoice.fee_name}`;
          const emailMessage = message || `
            Dear ${invoice.first_name} ${invoice.last_name},
            
            Please find attached your invoice for ${invoice.fee_name}.
            
            Invoice Number: ${invoice.invoice_number}
            Amount: ${invoice.amount}
            Due Date: ${new Date(invoice.due_date).toLocaleDateString()}
            
            Thank you for your prompt payment.
          `;

          await sendEmail({
            to: invoice.student_email,
            subject: emailSubject,
            text: emailMessage,
            html: emailMessage.replace(/\n/g, '<br>')
          });

          // Update invoice status
          await query(`
            UPDATE invoices 
            SET status = 'sent', sent_at = NOW()
            WHERE id = $1
          `, [invoiceId]);

          sentInvoices.push(invoice);
        } catch (error) {
          errors.push(`Error sending invoice ${invoiceId}: ${error.message}`);
        }
      }

      res.json({
        success: true,
        message: `Sent ${sentInvoices.length} invoices successfully`,
        data: {
          sentInvoices,
          errors: errors.length > 0 ? errors : undefined
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Generate invoice report
  static async generateInvoiceReport(req, res, next) {
    try {
      const { startDate, endDate, status, studentId } = req.query;
      const schoolId = req.user.schoolId;

      let whereClause = 'WHERE i.school_id = $1';
      let queryParams = [schoolId];
      let paramCount = 1;

      if (startDate) {
        paramCount++;
        whereClause += ` AND i.created_at >= $${paramCount}`;
        queryParams.push(startDate);
      }

      if (endDate) {
        paramCount++;
        whereClause += ` AND i.created_at <= $${paramCount}`;
        queryParams.push(endDate);
      }

      if (status) {
        paramCount++;
        whereClause += ` AND i.status = $${paramCount}`;
        queryParams.push(status);
      }

      if (studentId) {
        paramCount++;
        whereClause += ` AND i.student_id = $${paramCount}`;
        queryParams.push(studentId);
      }

      const result = await query(`
        SELECT 
          i.*,
          s.first_name,
          s.last_name,
          s.email,
          s.phone,
          fs.name as fee_name,
          fs.term,
          fs.academic_year_id
        FROM invoices i
        JOIN students s ON i.student_id = s.id
        JOIN fee_assignments fa ON i.fee_assignment_id = fa.id
        JOIN fee_structures fs ON fa.fee_structure_id = fs.id
        ${whereClause}
        ORDER BY i.created_at DESC
      `, queryParams);

      // Generate summary statistics
      const summary = {
        totalInvoices: result.rows.length,
        totalAmount: result.rows.reduce((sum, invoice) => sum + parseFloat(invoice.amount), 0),
        pendingInvoices: result.rows.filter(invoice => invoice.status === 'pending').length,
        sentInvoices: result.rows.filter(invoice => invoice.status === 'sent').length,
        paidInvoices: result.rows.filter(invoice => invoice.status === 'paid').length,
        overdueInvoices: result.rows.filter(invoice => 
          invoice.status !== 'paid' && new Date(invoice.due_date) < new Date()
        ).length
      };

      res.json({
        success: true,
        data: {
          invoices: result.rows,
          summary
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = InvoiceController;
