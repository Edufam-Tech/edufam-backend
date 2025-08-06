const { query } = require('../config/database');
const { ValidationError, NotFoundError, ConflictError } = require('../middleware/errorHandler');

class InvoiceController {
  // =============================================================================
  // INVOICE TEMPLATE MANAGEMENT
  // =============================================================================

  // Create invoice template
  static async createTemplate(req, res, next) {
    try {
      const {
        templateName,
        description,
        templateHtml,
        templateCss = '',
        headerHtml = '',
        footerHtml = '',
        pageSize = 'A4',
        margins = { top: 20, bottom: 20, left: 15, right: 15 },
        companyInfo = {}
      } = req.body;

      if (!templateName || !templateHtml) {
        throw new ValidationError('Template name and HTML are required');
      }

      const result = await query(`
        INSERT INTO invoice_templates (
          school_id, template_name, description, template_html, template_css,
          header_html, footer_html, page_size, margin_top, margin_bottom,
          margin_left, margin_right, logo_url, company_address, company_phone,
          company_email, company_website, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        RETURNING *
      `, [
        req.user.schoolId, templateName, description, templateHtml, templateCss,
        headerHtml, footerHtml, pageSize, margins.top, margins.bottom,
        margins.left, margins.right, companyInfo.logoUrl, companyInfo.address,
        companyInfo.phone, companyInfo.email, companyInfo.website, req.user.userId
      ]);

      res.status(201).json({
        success: true,
        message: 'Invoice template created successfully',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }

  // Get invoice templates
  static async getTemplates(req, res, next) {
    try {
      const { isActive, isDefault } = req.query;

      let whereClause = 'WHERE school_id = $1';
      const params = [req.user.schoolId];

      if (isActive !== undefined) {
        whereClause += ` AND is_active = $${params.length + 1}`;
        params.push(isActive === 'true');
      }

      if (isDefault !== undefined) {
        whereClause += ` AND is_default = $${params.length + 1}`;
        params.push(isDefault === 'true');
      }

      const result = await query(`
        SELECT *
        FROM invoice_templates 
        ${whereClause}
        ORDER BY is_default DESC, template_name
      `, params);

      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      next(error);
    }
  }

  // Update invoice template
  static async updateTemplate(req, res, next) {
    try {
      const { id } = req.params;
      const updates = req.body;

      const allowedFields = [
        'template_name', 'description', 'template_html', 'template_css',
        'header_html', 'footer_html', 'page_size', 'margin_top', 'margin_bottom',
        'margin_left', 'margin_right', 'logo_url', 'company_address',
        'company_phone', 'company_email', 'company_website', 'is_default', 'is_active'
      ];

      const setClause = [];
      const values = [];
      let paramIndex = 1;

      Object.keys(updates).forEach(key => {
        if (allowedFields.includes(key)) {
          setClause.push(`${key} = $${paramIndex}`);
          values.push(updates[key]);
          paramIndex++;
        }
      });

      if (setClause.length === 0) {
        throw new ValidationError('No valid fields provided for update');
      }

      setClause.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(id, req.user.schoolId);

      // If setting as default, unset other defaults first
      if (updates.is_default === true) {
        await query(`
          UPDATE invoice_templates 
          SET is_default = false 
          WHERE school_id = $1 AND id != $2
        `, [req.user.schoolId, id]);
      }

      const result = await query(`
        UPDATE invoice_templates 
        SET ${setClause.join(', ')}
        WHERE id = $${paramIndex} AND school_id = $${paramIndex + 1}
        RETURNING *
      `, values);

      if (result.rows.length === 0) {
        throw new NotFoundError('Invoice template not found');
      }

      res.json({
        success: true,
        message: 'Invoice template updated successfully',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }

  // =============================================================================
  // INVOICE SERIES MANAGEMENT
  // =============================================================================

  // Create invoice series
  static async createSeries(req, res, next) {
    try {
      const {
        seriesName,
        prefix = '',
        suffix = '',
        currentNumber = 1,
        incrementBy = 1,
        numberFormat = '{prefix}{number:04d}{suffix}',
        resetAnnually = true,
        resetMonthly = false,
        academicYearId
      } = req.body;

      if (!seriesName) {
        throw new ValidationError('Series name is required');
      }

      const result = await query(`
        INSERT INTO invoice_series (
          school_id, series_name, prefix, suffix, current_number,
          increment_by, number_format, reset_annually, reset_monthly,
          academic_year_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `, [
        req.user.schoolId, seriesName, prefix, suffix, currentNumber,
        incrementBy, numberFormat, resetAnnually, resetMonthly, academicYearId
      ]);

      res.status(201).json({
        success: true,
        message: 'Invoice series created successfully',
        data: result.rows[0]
      });
    } catch (error) {
      if (error.code === '23505') {
        next(new ConflictError('Invoice series name already exists for this academic year'));
      } else {
        next(error);
      }
    }
  }

  // Get invoice series
  static async getSeries(req, res, next) {
    try {
      const { academicYearId, isActive } = req.query;

      let whereClause = 'WHERE school_id = $1';
      const params = [req.user.schoolId];

      if (academicYearId) {
        whereClause += ` AND academic_year_id = $${params.length + 1}`;
        params.push(academicYearId);
      }

      if (isActive !== undefined) {
        whereClause += ` AND is_active = $${params.length + 1}`;
        params.push(isActive === 'true');
      }

      const result = await query(`
        SELECT *
        FROM invoice_series 
        ${whereClause}
        ORDER BY series_name
      `, params);

      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      next(error);
    }
  }

  // =============================================================================
  // INVOICE GENERATION
  // =============================================================================

  // Generate invoice
  static async generateInvoice(req, res, next) {
    try {
      const {
        studentId,
        seriesId,
        templateId,
        academicYearId,
        academicTermId,
        dueDate,
        items = [],
        taxes = [],
        discounts = [],
        notes = '',
        termsAndConditions = ''
      } = req.body;

      if (!studentId || !items.length) {
        throw new ValidationError('Student ID and invoice items are required');
      }

      // Get student and parent information
      const studentResult = await query(`
        SELECT s.*, 
               CONCAT(s.first_name, ' ', s.last_name) as student_name,
               p.email as parent_email,
               p.phone as parent_phone,
               CONCAT(p.first_name, ' ', p.last_name) as parent_name
        FROM students s
        LEFT JOIN users p ON s.parent_id = p.id
        WHERE s.id = $1 AND s.school_id = $2
      `, [studentId, req.user.schoolId]);

      if (studentResult.rows.length === 0) {
        throw new NotFoundError('Student not found');
      }

      const student = studentResult.rows[0];

      // Get next invoice number
      const invoiceNumber = await InvoiceController.generateInvoiceNumber(seriesId, req.user.schoolId);

      // Calculate totals
      const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
      const totalTax = taxes.reduce((sum, tax) => sum + tax.taxAmount, 0);
      const totalDiscount = discounts.reduce((sum, discount) => sum + discount.discountAmount, 0);
      const totalAmount = subtotal + totalTax - totalDiscount;

      // Create invoice
      const invoiceResult = await query(`
        INSERT INTO invoices (
          school_id, invoice_number, series_id, template_id, student_id,
          parent_id, customer_name, customer_email, customer_phone,
          academic_year_id, academic_term_id, invoice_date, due_date,
          subtotal, total_tax, total_discount, total_amount, balance_due,
          notes, terms_and_conditions, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
        RETURNING *
      `, [
        req.user.schoolId, invoiceNumber, seriesId, templateId, studentId,
        student.parent_id, student.parent_name || student.student_name,
        student.parent_email || student.email, student.parent_phone || student.phone,
        academicYearId, academicTermId, new Date().toISOString().split('T')[0],
        dueDate, subtotal, totalTax, totalDiscount, totalAmount, totalAmount,
        notes, termsAndConditions, req.user.userId
      ]);

      const invoice = invoiceResult.rows[0];

      // Add invoice items
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        await query(`
          INSERT INTO invoice_items (
            invoice_id, item_order, description, item_code, fee_category_id,
            quantity, unit_price, line_total, tax_rate, tax_amount,
            discount_type, discount_value, discount_amount
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        `, [
          invoice.id, i + 1, item.description, item.itemCode, item.feeCategoryId,
          item.quantity, item.unitPrice, item.quantity * item.unitPrice,
          item.taxRate || 0, item.taxAmount || 0, item.discountType,
          item.discountValue || 0, item.discountAmount || 0
        ]);
      }

      // Add taxes
      for (const tax of taxes) {
        await query(`
          INSERT INTO invoice_taxes (
            invoice_id, tax_name, tax_type, tax_rate, tax_amount, taxable_amount
          ) VALUES ($1, $2, $3, $4, $5, $6)
        `, [
          invoice.id, tax.taxName, tax.taxType, tax.taxRate,
          tax.taxAmount, tax.taxableAmount
        ]);
      }

      // Add discounts
      for (const discount of discounts) {
        await query(`
          INSERT INTO invoice_discounts (
            invoice_id, discount_name, discount_type, discount_value,
            discount_amount, applied_to
          ) VALUES ($1, $2, $3, $4, $5, $6)
        `, [
          invoice.id, discount.discountName, discount.discountType,
          discount.discountValue, discount.discountAmount, discount.appliedTo
        ]);
      }

      // Generate PDF (simplified)
      const pdfUrl = await InvoiceController.generateInvoicePDF(invoice.id);

      // Update invoice with PDF URL
      await query(`
        UPDATE invoices 
        SET pdf_url = $1, pdf_generated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [pdfUrl, invoice.id]);

      res.status(201).json({
        success: true,
        message: 'Invoice generated successfully',
        data: {
          ...invoice,
          pdf_url: pdfUrl
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Get invoices
  static async getInvoices(req, res, next) {
    try {
      const { 
        studentId, 
        status, 
        startDate, 
        endDate, 
        academicYearId, 
        limit = 20, 
        offset = 0 
      } = req.query;

      let whereClause = 'WHERE i.school_id = $1';
      const params = [req.user.schoolId];

      if (studentId) {
        whereClause += ` AND i.student_id = $${params.length + 1}`;
        params.push(studentId);
      }

      if (status) {
        whereClause += ` AND i.status = $${params.length + 1}`;
        params.push(status);
      }

      if (startDate) {
        whereClause += ` AND i.invoice_date >= $${params.length + 1}`;
        params.push(startDate);
      }

      if (endDate) {
        whereClause += ` AND i.invoice_date <= $${params.length + 1}`;
        params.push(endDate);
      }

      if (academicYearId) {
        whereClause += ` AND i.academic_year_id = $${params.length + 1}`;
        params.push(academicYearId);
      }

      const result = await query(`
        SELECT 
          i.*,
          s.first_name as student_first_name,
          s.last_name as student_last_name,
          s.admission_number,
          c.class_name,
          ay.year_name,
          at.term_name
        FROM invoices i
        JOIN students s ON i.student_id = s.id
        LEFT JOIN classes c ON s.class_id = c.id
        LEFT JOIN academic_years ay ON i.academic_year_id = ay.id
        LEFT JOIN academic_terms at ON i.academic_term_id = at.id
        ${whereClause}
        ORDER BY i.invoice_date DESC, i.invoice_number DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `, [...params, limit, offset]);

      res.json({
        success: true,
        data: result.rows,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: result.rows.length
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Get invoice by ID
  static async getInvoice(req, res, next) {
    try {
      const { id } = req.params;

      const [invoiceResult, itemsResult, taxesResult, discountsResult] = await Promise.all([
        query(`
          SELECT 
            i.*,
            s.first_name as student_first_name,
            s.last_name as student_last_name,
            s.admission_number,
            c.class_name,
            it.template_name,
            iser.series_name
          FROM invoices i
          JOIN students s ON i.student_id = s.id
          LEFT JOIN classes c ON s.class_id = c.id
          LEFT JOIN invoice_templates it ON i.template_id = it.id
          LEFT JOIN invoice_series iser ON i.series_id = iser.id
          WHERE i.id = $1 AND i.school_id = $2
        `, [id, req.user.schoolId]),

        query(`
          SELECT * FROM invoice_items 
          WHERE invoice_id = $1 
          ORDER BY item_order
        `, [id]),

        query(`
          SELECT * FROM invoice_taxes 
          WHERE invoice_id = $1
        `, [id]),

        query(`
          SELECT * FROM invoice_discounts 
          WHERE invoice_id = $1
        `, [id])
      ]);

      if (invoiceResult.rows.length === 0) {
        throw new NotFoundError('Invoice not found');
      }

      const invoice = {
        ...invoiceResult.rows[0],
        items: itemsResult.rows,
        taxes: taxesResult.rows,
        discounts: discountsResult.rows
      };

      res.json({
        success: true,
        data: invoice
      });
    } catch (error) {
      next(error);
    }
  }

  // Update invoice
  static async updateInvoice(req, res, next) {
    try {
      const { id } = req.params;
      const updates = req.body;

      // Check if invoice can be updated
      const invoiceCheck = await query(`
        SELECT status FROM invoices 
        WHERE id = $1 AND school_id = $2
      `, [id, req.user.schoolId]);

      if (invoiceCheck.rows.length === 0) {
        throw new NotFoundError('Invoice not found');
      }

      if (invoiceCheck.rows[0].status === 'paid') {
        throw new ConflictError('Cannot update a paid invoice');
      }

      const allowedFields = [
        'due_date', 'notes', 'terms_and_conditions', 'status'
      ];

      const setClause = [];
      const values = [];
      let paramIndex = 1;

      Object.keys(updates).forEach(key => {
        if (allowedFields.includes(key)) {
          setClause.push(`${key} = $${paramIndex}`);
          values.push(updates[key]);
          paramIndex++;
        }
      });

      if (setClause.length === 0) {
        throw new ValidationError('No valid fields provided for update');
      }

      setClause.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(id, req.user.schoolId);

      const result = await query(`
        UPDATE invoices 
        SET ${setClause.join(', ')}
        WHERE id = $${paramIndex} AND school_id = $${paramIndex + 1}
        RETURNING *
      `, values);

      res.json({
        success: true,
        message: 'Invoice updated successfully',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }

  // =============================================================================
  // INVOICE OPERATIONS
  // =============================================================================

  // Send invoice
  static async sendInvoice(req, res, next) {
    try {
      const { id } = req.params;
      const { recipientEmail, message = '' } = req.body;

      const invoiceResult = await query(`
        SELECT i.*, s.first_name, s.last_name
        FROM invoices i
        JOIN students s ON i.student_id = s.id
        WHERE i.id = $1 AND i.school_id = $2
      `, [id, req.user.schoolId]);

      if (invoiceResult.rows.length === 0) {
        throw new NotFoundError('Invoice not found');
      }

      const invoice = invoiceResult.rows[0];

      // In real implementation, send actual email
      console.log(`Sending invoice ${invoice.invoice_number} to ${recipientEmail}`);

      // Update invoice status
      await query(`
        UPDATE invoices 
        SET status = 'sent', sent_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `, [id]);

      res.json({
        success: true,
        message: 'Invoice sent successfully',
        data: {
          invoiceNumber: invoice.invoice_number,
          recipientEmail,
          sentAt: new Date().toISOString()
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Record payment
  static async recordPayment(req, res, next) {
    try {
      const { id } = req.params;
      const {
        paymentDate,
        amountPaid,
        paymentMethod,
        transactionReference,
        notes = ''
      } = req.body;

      if (!paymentDate || !amountPaid || !paymentMethod) {
        throw new ValidationError('Payment date, amount paid, and payment method are required');
      }

      // Get current invoice details
      const invoiceResult = await query(`
        SELECT * FROM invoices 
        WHERE id = $1 AND school_id = $2
      `, [id, req.user.schoolId]);

      if (invoiceResult.rows.length === 0) {
        throw new NotFoundError('Invoice not found');
      }

      const invoice = invoiceResult.rows[0];

      // Record payment
      await query(`
        INSERT INTO invoice_payments (
          invoice_id, payment_date, amount_paid, payment_method,
          transaction_reference, notes, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        id, paymentDate, amountPaid, paymentMethod,
        transactionReference, notes, req.user.userId
      ]);

      // Update invoice totals
      const newAmountPaid = parseFloat(invoice.amount_paid || 0) + parseFloat(amountPaid);
      const newBalanceDue = parseFloat(invoice.total_amount) - newAmountPaid;
      const newStatus = newBalanceDue <= 0 ? 'paid' : newAmountPaid > 0 ? 'partial' : invoice.status;

      const updatedInvoice = await query(`
        UPDATE invoices 
        SET amount_paid = $1, balance_due = $2, status = $3,
            paid_at = CASE WHEN $4 = 'paid' THEN CURRENT_TIMESTAMP ELSE paid_at END,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $5
        RETURNING *
      `, [newAmountPaid, newBalanceDue, newStatus, newStatus, id]);

      res.json({
        success: true,
        message: 'Payment recorded successfully',
        data: updatedInvoice.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }

  // =============================================================================
  // RECURRING INVOICES
  // =============================================================================

  // Create recurring invoice
  static async createRecurringInvoice(req, res, next) {
    try {
      const {
        templateInvoiceId,
        seriesId,
        studentId,
        customerName,
        frequency,
        intervalCount = 1,
        startDate,
        endDate,
        totalAmount,
        autoSend = false,
        autoGenerate = true
      } = req.body;

      if (!studentId || !frequency || !startDate || !totalAmount) {
        throw new ValidationError('Student ID, frequency, start date, and total amount are required');
      }

      // Calculate next generation date
      const nextGenerationDate = InvoiceController.calculateNextDate(startDate, frequency, intervalCount);

      const result = await query(`
        INSERT INTO recurring_invoices (
          school_id, template_invoice_id, series_id, student_id, customer_name,
          frequency, interval_count, start_date, end_date, next_generation_date,
          total_amount, auto_send, auto_generate, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING *
      `, [
        req.user.schoolId, templateInvoiceId, seriesId, studentId, customerName,
        frequency, intervalCount, startDate, endDate, nextGenerationDate,
        totalAmount, autoSend, autoGenerate, req.user.userId
      ]);

      res.status(201).json({
        success: true,
        message: 'Recurring invoice created successfully',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }

  // Get recurring invoices
  static async getRecurringInvoices(req, res, next) {
    try {
      const { status, studentId } = req.query;

      let whereClause = 'WHERE ri.school_id = $1';
      const params = [req.user.schoolId];

      if (status) {
        whereClause += ` AND ri.status = $${params.length + 1}`;
        params.push(status);
      }

      if (studentId) {
        whereClause += ` AND ri.student_id = $${params.length + 1}`;
        params.push(studentId);
      }

      const result = await query(`
        SELECT 
          ri.*,
          s.first_name as student_first_name,
          s.last_name as student_last_name,
          iser.series_name
        FROM recurring_invoices ri
        JOIN students s ON ri.student_id = s.id
        LEFT JOIN invoice_series iser ON ri.series_id = iser.id
        ${whereClause}
        ORDER BY ri.next_generation_date
      `, params);

      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      next(error);
    }
  }

  // =============================================================================
  // INVOICE ANALYTICS
  // =============================================================================

  // Get invoice analytics
  static async getAnalytics(req, res, next) {
    try {
      const { startDate, endDate, academicYearId } = req.query;

      let whereClause = 'WHERE school_id = $1';
      const params = [req.user.schoolId];

      if (startDate) {
        whereClause += ` AND invoice_date >= $${params.length + 1}`;
        params.push(startDate);
      }

      if (endDate) {
        whereClause += ` AND invoice_date <= $${params.length + 1}`;
        params.push(endDate);
      }

      if (academicYearId) {
        whereClause += ` AND academic_year_id = $${params.length + 1}`;
        params.push(academicYearId);
      }

      const [overviewResult, statusBreakdownResult, monthlyTrendsResult] = await Promise.all([
        query(`
          SELECT 
            COUNT(*) as total_invoices,
            SUM(total_amount) as total_billed,
            SUM(amount_paid) as total_collected,
            SUM(balance_due) as total_outstanding,
            COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_invoices,
            COUNT(CASE WHEN status = 'overdue' THEN 1 END) as overdue_invoices
          FROM invoices 
          ${whereClause}
        `, params),

        query(`
          SELECT status, COUNT(*) as count, SUM(total_amount) as amount
          FROM invoices 
          ${whereClause}
          GROUP BY status
        `, params),

        query(`
          SELECT 
            DATE_TRUNC('month', invoice_date) as month,
            COUNT(*) as invoices_generated,
            SUM(total_amount) as amount_billed,
            SUM(amount_paid) as amount_collected
          FROM invoices 
          ${whereClause}
          GROUP BY DATE_TRUNC('month', invoice_date)
          ORDER BY month DESC
          LIMIT 12
        `, params)
      ]);

      const analytics = {
        overview: overviewResult.rows[0],
        statusBreakdown: statusBreakdownResult.rows,
        monthlyTrends: monthlyTrendsResult.rows
      };

      res.json({
        success: true,
        data: analytics
      });
    } catch (error) {
      next(error);
    }
  }

  // =============================================================================
  // HELPER METHODS
  // =============================================================================

  // Generate invoice number
  static async generateInvoiceNumber(seriesId, schoolId) {
    if (!seriesId) {
      // Generate simple sequential number if no series specified
      const result = await query(`
        SELECT COUNT(*) as count FROM invoices WHERE school_id = $1
      `, [schoolId]);
      
      const sequence = parseInt(result.rows[0].count) + 1;
      return `INV-${sequence.toString().padStart(6, '0')}`;
    }

    // Get series details and increment
    const seriesResult = await query(`
      SELECT * FROM invoice_series 
      WHERE id = $1 AND school_id = $2
    `, [seriesId, schoolId]);

    if (seriesResult.rows.length === 0) {
      throw new NotFoundError('Invoice series not found');
    }

    const series = seriesResult.rows[0];
    const currentNumber = series.current_number;

    // Update series number
    await query(`
      UPDATE invoice_series 
      SET current_number = current_number + $1 
      WHERE id = $2
    `, [series.increment_by, seriesId]);

    // Format invoice number
    return series.number_format
      .replace('{prefix}', series.prefix || '')
      .replace('{suffix}', series.suffix || '')
      .replace(/\{number:(\d+)d\}/, (match, digits) => {
        return currentNumber.toString().padStart(parseInt(digits), '0');
      });
  }

  // Generate invoice PDF (simplified)
  static async generateInvoicePDF(invoiceId) {
    // In real implementation, use libraries like Puppeteer, PDFKit, etc.
    const pdfUrl = `https://invoices.edufam.com/pdf/${invoiceId}.pdf`;
    console.log(`Generated PDF for invoice ID: ${invoiceId}`);
    return pdfUrl;
  }

  // Calculate next recurring date
  static calculateNextDate(startDate, frequency, intervalCount) {
    const date = new Date(startDate);
    
    switch (frequency) {
      case 'monthly':
        date.setMonth(date.getMonth() + intervalCount);
        break;
      case 'quarterly':
        date.setMonth(date.getMonth() + (3 * intervalCount));
        break;
      case 'termly':
        date.setMonth(date.getMonth() + (4 * intervalCount)); // Assuming 4 months per term
        break;
      case 'annually':
        date.setFullYear(date.getFullYear() + intervalCount);
        break;
      default:
        throw new Error(`Unsupported frequency: ${frequency}`);
    }
    
    return date.toISOString().split('T')[0];
  }

  // Bulk Operations
  static async bulkGenerateInvoices(req, res, next) {
    try {
      const { invoices } = req.body;

      if (!Array.isArray(invoices) || invoices.length === 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invoices array is required and must not be empty'
          }
        });
      }

      const results = [];
      for (const invoiceData of invoices) {
        try {
          // Add school_id and user_id from request
          const data = {
            ...invoiceData,
            school_id: req.user.school_id,
            created_by: req.user.id
          };

          const result = await this.generateInvoiceInternal(data);
          results.push({ success: true, data: result });
        } catch (error) {
          results.push({ success: false, error: error.message, data: invoiceData });
        }
      }

      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;

      res.status(201).json({
        success: true,
        message: `Bulk generation completed: ${successCount} successful, ${failureCount} failed`,
        data: {
          successCount,
          failureCount,
          results
        }
      });
    } catch (error) {
      next(error);
    }
  }

  static async getStudentInvoices(req, res, next) {
    try {
      const { studentId } = req.params;
      const { status, academic_year_id, page = 1, limit = 10 } = req.query;
      const offset = (parseInt(page) - 1) * parseInt(limit);

      let whereClause = 'WHERE i.student_id = $1 AND i.school_id = $2';
      let queryParams = [studentId, req.user.school_id];

      if (status) {
        whereClause += ` AND i.status = $${queryParams.length + 1}`;
        queryParams.push(status);
      }

      if (academic_year_id) {
        whereClause += ` AND i.academic_year_id = $${queryParams.length + 1}`;
        queryParams.push(academic_year_id);
      }

      const selectQuery = `
        SELECT 
          i.*,
          s.first_name,
          s.last_name,
          s.admission_number,
          fs.name as fee_structure_name
        FROM invoices i
        JOIN students s ON i.student_id = s.id
        LEFT JOIN fee_structures fs ON i.fee_structure_id = fs.id
        ${whereClause}
        ORDER BY i.created_at DESC
        LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
      `;

      queryParams.push(parseInt(limit), offset);
      const result = await query(selectQuery, queryParams);

      res.json({
        success: true,
        data: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: result.rowCount
        }
      });
    } catch (error) {
      next(error);
    }
  }

  static async generateInvoiceReport(req, res, next) {
    try {
      const { reportType = 'summary', dateRange } = req.query;
      let whereClause = 'WHERE i.school_id = $1';
      let queryParams = [req.user.school_id];

      if (dateRange) {
        const { start_date, end_date } = JSON.parse(dateRange);
        whereClause += ` AND i.created_at >= $${queryParams.length + 1} AND i.created_at <= $${queryParams.length + 2}`;
        queryParams.push(start_date, end_date);
      }

      let reportQuery;
      if (reportType === 'summary') {
        reportQuery = `
          SELECT 
            COUNT(*) as total_invoices,
            SUM(CASE WHEN i.status = 'draft' THEN 1 ELSE 0 END) as draft_count,
            SUM(CASE WHEN i.status = 'sent' THEN 1 ELSE 0 END) as sent_count,
            SUM(CASE WHEN i.status = 'paid' THEN 1 ELSE 0 END) as paid_count,
            SUM(CASE WHEN i.status = 'overdue' THEN 1 ELSE 0 END) as overdue_count,
            SUM(i.total_amount) as total_amount,
            SUM(i.paid_amount) as total_paid,
            SUM(i.total_amount - i.paid_amount) as total_outstanding
          FROM invoices i
          ${whereClause}
        `;
      } else {
        reportQuery = `
          SELECT 
            i.*,
            s.first_name,
            s.last_name,
            s.admission_number
          FROM invoices i
          JOIN students s ON i.student_id = s.id
          ${whereClause}
          ORDER BY i.created_at DESC
        `;
      }

      const result = await query(reportQuery, queryParams);

      res.json({
        success: true,
        data: {
          reportType,
          dateRange: dateRange ? JSON.parse(dateRange) : null,
          summary: reportType === 'summary' ? result.rows[0] : null,
          details: reportType === 'detailed' ? result.rows : null
        }
      });
    } catch (error) {
      next(error);
    }
  }

  static async bulkSendInvoices(req, res, next) {
    try {
      const { invoiceIds } = req.body;

      if (!Array.isArray(invoiceIds) || invoiceIds.length === 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invoice IDs array is required and must not be empty'
          }
        });
      }

      const results = [];
      for (const invoiceId of invoiceIds) {
        try {
          // Check if invoice exists and belongs to the school
          const checkQuery = `
            SELECT id, status FROM invoices 
            WHERE id = $1 AND school_id = $2
          `;
          const checkResult = await query(checkQuery, [invoiceId, req.user.school_id]);

          if (checkResult.rows.length === 0) {
            results.push({ 
              success: false, 
              invoiceId, 
              error: 'Invoice not found' 
            });
            continue;
          }

          // Update invoice status to sent
          const updateQuery = `
            UPDATE invoices 
            SET status = 'sent', sent_at = NOW(), sent_by = $1
            WHERE id = $2 AND school_id = $3
            RETURNING *
          `;
          const updateResult = await query(updateQuery, [req.user.id, invoiceId, req.user.school_id]);

          results.push({ 
            success: true, 
            invoiceId, 
            data: updateResult.rows[0] 
          });
        } catch (error) {
          results.push({ 
            success: false, 
            invoiceId, 
            error: error.message 
          });
        }
      }

      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;

      res.json({
        success: true,
        message: `Bulk send completed: ${successCount} successful, ${failureCount} failed`,
        data: {
          successCount,
          failureCount,
          results
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Helper method for bulk generation
  static async generateInvoiceInternal(data) {
    const { 
      student_id, 
      fee_structure_id, 
      academic_year_id, 
      amount, 
      due_date, 
      school_id, 
      created_by 
    } = data;

    // Generate invoice number
    const invoiceNumber = await this.generateInvoiceNumber(null, school_id);

    const insertQuery = `
      INSERT INTO invoices (
        invoice_number, student_id, fee_structure_id, academic_year_id,
        total_amount, paid_amount, status, due_date, school_id, created_by, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
      RETURNING *
    `;

    const result = await query(insertQuery, [
      invoiceNumber,
      student_id,
      fee_structure_id,
      academic_year_id,
      amount,
      0, // paid_amount
      'draft',
      due_date,
      school_id,
      created_by
    ]);

    return result.rows[0];
  }
}

module.exports = InvoiceController;