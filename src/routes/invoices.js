const express = require('express');
const router = express.Router();
const { authenticate, requireRole, requireUserType } = require('../middleware/auth');
const InvoiceController = require('../controllers/invoiceController');

// Apply authentication to all routes
router.use(authenticate);
router.use(requireUserType('school_user'));

// =============================================================================
// INVOICE TEMPLATE ROUTES
// =============================================================================

/**
 * @route   POST /api/invoices/templates
 * @desc    Create a new invoice template
 * @access  Private (Principal, School Director, Finance)
 */
router.post('/templates',
  requireRole(['principal', 'school_director', 'finance']),
  InvoiceController.createTemplate
);

/**
 * @route   GET /api/invoices/templates
 * @desc    Get all invoice templates
 * @access  Private (All school staff)
 */
router.get('/templates',
  InvoiceController.getTemplates
);

/**
 * @route   PUT /api/invoices/templates/:id
 * @desc    Update an invoice template
 * @access  Private (Principal, School Director, Finance)
 */
router.put('/templates/:id',
  requireRole(['principal', 'school_director', 'finance']),
  InvoiceController.updateTemplate
);

// =============================================================================
// INVOICE SERIES ROUTES
// =============================================================================

/**
 * @route   POST /api/invoices/series
 * @desc    Create a new invoice numbering series
 * @access  Private (Principal, School Director, Finance)
 */
router.post('/series',
  requireRole(['principal', 'school_director', 'finance']),
  InvoiceController.createSeries
);

/**
 * @route   GET /api/invoices/series
 * @desc    Get all invoice numbering series
 * @access  Private (Finance staff)
 */
router.get('/series',
  requireRole(['principal', 'school_director', 'finance']),
  InvoiceController.getSeries
);

// =============================================================================
// INVOICE GENERATION ROUTES
// =============================================================================

/**
 * @route   POST /api/invoices/generate
 * @desc    Generate a new invoice
 * @access  Private (Principal, School Director, Finance)
 */
router.post('/generate',
  requireRole(['principal', 'school_director', 'finance']),
  InvoiceController.generateInvoice
);

/**
 * @route   GET /api/invoices
 * @desc    Get all invoices with filtering
 * @access  Private (All school staff)
 */
router.get('/',
  InvoiceController.getInvoices
);

/**
 * @route   GET /api/invoices/:id
 * @desc    Get a specific invoice
 * @access  Private (All school users)
 */
router.get('/:id',
  InvoiceController.getInvoice
);

/**
 * @route   PUT /api/invoices/:id
 * @desc    Update an invoice
 * @access  Private (Principal, School Director, Finance)
 */
router.put('/:id',
  requireRole(['principal', 'school_director', 'finance']),
  InvoiceController.updateInvoice
);

// =============================================================================
// INVOICE OPERATIONS ROUTES
// =============================================================================

/**
 * @route   POST /api/invoices/:id/send
 * @desc    Send invoice to customer
 * @access  Private (Principal, School Director, Finance)
 */
router.post('/:id/send',
  requireRole(['principal', 'school_director', 'finance']),
  InvoiceController.sendInvoice
);

/**
 * @route   POST /api/invoices/:id/payment
 * @desc    Record payment for an invoice
 * @access  Private (Principal, School Director, Finance)
 */
router.post('/:id/payment',
  requireRole(['principal', 'school_director', 'finance']),
  InvoiceController.recordPayment
);

/**
 * @route   GET /api/invoices/:id/payments
 * @desc    Get payment history for an invoice
 * @access  Private (All school staff)
 */
router.get('/:id/payments',
  async (req, res, next) => {
    try {
      const { query } = require('../config/database');
      const { id } = req.params;

      const result = await query(`
        SELECT ip.*, u.first_name, u.last_name
        FROM invoice_payments ip
        LEFT JOIN users u ON ip.created_by = u.id
        JOIN invoices i ON ip.invoice_id = i.id
        WHERE ip.invoice_id = $1 AND i.school_id = $2
        ORDER BY ip.payment_date DESC
      `, [id, req.user.schoolId]);

      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/invoices/:id/download
 * @desc    Download invoice PDF
 * @access  Private (All school users)
 */
router.get('/:id/download',
  async (req, res, next) => {
    try {
      const { query } = require('../config/database');
      const { NotFoundError, ValidationError } = require('../middleware/errorHandler');
      const { id } = req.params;

      const result = await query(`
        SELECT pdf_url, invoice_number, customer_name
        FROM invoices 
        WHERE id = $1 AND school_id = $2
      `, [id, req.user.schoolId]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Invoice not found');
      }

      const invoice = result.rows[0];

      if (!invoice.pdf_url) {
        throw new ValidationError('Invoice PDF not available');
      }

      res.json({
        success: true,
        data: {
          downloadUrl: invoice.pdf_url,
          filename: `${invoice.invoice_number}_${invoice.customer_name}.pdf`
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// =============================================================================
// RECURRING INVOICE ROUTES
// =============================================================================

/**
 * @route   POST /api/invoices/recurring
 * @desc    Create a recurring invoice
 * @access  Private (Principal, School Director, Finance)
 */
router.post('/recurring',
  requireRole(['principal', 'school_director', 'finance']),
  InvoiceController.createRecurringInvoice
);

/**
 * @route   GET /api/invoices/recurring
 * @desc    Get recurring invoices
 * @access  Private (Finance staff)
 */
router.get('/recurring',
  requireRole(['principal', 'school_director', 'finance']),
  InvoiceController.getRecurringInvoices
);

/**
 * @route   PUT /api/invoices/recurring/:id
 * @desc    Update a recurring invoice
 * @access  Private (Principal, School Director, Finance)
 */
router.put('/recurring/:id',
  requireRole(['principal', 'school_director', 'finance']),
  async (req, res, next) => {
    try {
      const { query } = require('../config/database');
      const { ValidationError, NotFoundError } = require('../middleware/errorHandler');
      const { id } = req.params;
      const updates = req.body;

      const allowedFields = [
        'frequency', 'interval_count', 'end_date', 'total_amount',
        'auto_send', 'auto_generate', 'status'
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
        UPDATE recurring_invoices 
        SET ${setClause.join(', ')}
        WHERE id = $${paramIndex} AND school_id = $${paramIndex + 1}
        RETURNING *
      `, values);

      if (result.rows.length === 0) {
        throw new NotFoundError('Recurring invoice not found');
      }

      res.json({
        success: true,
        message: 'Recurring invoice updated successfully',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   DELETE /api/invoices/recurring/:id
 * @desc    Cancel a recurring invoice
 * @access  Private (Principal, School Director, Finance)
 */
router.delete('/recurring/:id',
  requireRole(['principal', 'school_director', 'finance']),
  async (req, res, next) => {
    try {
      const { query } = require('../config/database');
      const { NotFoundError } = require('../middleware/errorHandler');
      const { id } = req.params;

      const result = await query(`
        UPDATE recurring_invoices 
        SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND school_id = $2
        RETURNING *
      `, [id, req.user.schoolId]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Recurring invoice not found');
      }

      res.json({
        success: true,
        message: 'Recurring invoice cancelled successfully'
      });
    } catch (error) {
      next(error);
    }
  }
);

// =============================================================================
// CREDIT NOTES ROUTES
// =============================================================================

/**
 * @route   POST /api/invoices/credit-notes
 * @desc    Create a credit note
 * @access  Private (Principal, School Director, Finance)
 */
router.post('/credit-notes',
  requireRole(['principal', 'school_director', 'finance']),
  async (req, res, next) => {
    try {
      const { query } = require('../config/database');
      const { ValidationError } = require('../middleware/errorHandler');

      const {
        invoiceId,
        studentId,
        reason,
        description,
        creditAmount
      } = req.body;

      if (!studentId || !reason || !creditAmount) {
        throw new ValidationError('Student ID, reason, and credit amount are required');
      }

      // Generate credit note number
      const countResult = await query(`
        SELECT COUNT(*) as count FROM credit_notes WHERE school_id = $1
      `, [req.user.schoolId]);
      
      const sequence = parseInt(countResult.rows[0].count) + 1;
      const creditNoteNumber = `CN-${sequence.toString().padStart(6, '0')}`;

      const result = await query(`
        INSERT INTO credit_notes (
          school_id, credit_note_number, invoice_id, student_id,
          reason, description, credit_amount, remaining_balance, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `, [
        req.user.schoolId, creditNoteNumber, invoiceId, studentId,
        reason, description, creditAmount, creditAmount, req.user.userId
      ]);

      res.status(201).json({
        success: true,
        message: 'Credit note created successfully',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/invoices/credit-notes
 * @desc    Get credit notes
 * @access  Private (Finance staff)
 */
router.get('/credit-notes',
  requireRole(['principal', 'school_director', 'finance']),
  async (req, res, next) => {
    try {
      const { query } = require('../config/database');
      const { studentId, status, limit = 20, offset = 0 } = req.query;

      let whereClause = 'WHERE cn.school_id = $1';
      const params = [req.user.schoolId];

      if (studentId) {
        whereClause += ` AND cn.student_id = $${params.length + 1}`;
        params.push(studentId);
      }

      if (status) {
        whereClause += ` AND cn.status = $${params.length + 1}`;
        params.push(status);
      }

      const result = await query(`
        SELECT 
          cn.*,
          s.first_name as student_first_name,
          s.last_name as student_last_name,
          i.invoice_number
        FROM credit_notes cn
        JOIN students s ON cn.student_id = s.id
        LEFT JOIN invoices i ON cn.invoice_id = i.id
        ${whereClause}
        ORDER BY cn.issue_date DESC
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
);

// =============================================================================
// INVOICE REMINDERS ROUTES
// =============================================================================

/**
 * @route   POST /api/invoices/:id/reminders
 * @desc    Schedule invoice reminders
 * @access  Private (Principal, School Director, Finance)
 */
router.post('/:id/reminders',
  requireRole(['principal', 'school_director', 'finance']),
  async (req, res, next) => {
    try {
      const { query } = require('../config/database');
      const { ValidationError } = require('../middleware/errorHandler');
      const { id } = req.params;

      const {
        reminderType,
        daysOffset,
        reminderMethod,
        subject,
        message
      } = req.body;

      if (!reminderType || daysOffset === undefined || !reminderMethod) {
        throw new ValidationError('Reminder type, days offset, and reminder method are required');
      }

      // Calculate scheduled date based on invoice due date and offset
      const invoiceResult = await query(`
        SELECT due_date FROM invoices WHERE id = $1 AND school_id = $2
      `, [id, req.user.schoolId]);

      if (invoiceResult.rows.length === 0) {
        throw new NotFoundError('Invoice not found');
      }

      const dueDate = new Date(invoiceResult.rows[0].due_date);
      const scheduledDate = new Date(dueDate);
      scheduledDate.setDate(scheduledDate.getDate() + parseInt(daysOffset));

      const result = await query(`
        INSERT INTO invoice_reminders (
          school_id, invoice_id, reminder_type, days_offset,
          reminder_method, subject, message, scheduled_date
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `, [
        req.user.schoolId, id, reminderType, daysOffset,
        reminderMethod, subject, message, scheduledDate.toISOString().split('T')[0]
      ]);

      res.status(201).json({
        success: true,
        message: 'Invoice reminder scheduled successfully',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/invoices/reminders/pending
 * @desc    Get pending reminders
 * @access  Private (Finance staff)
 */
router.get('/reminders/pending',
  requireRole(['principal', 'school_director', 'finance']),
  async (req, res, next) => {
    try {
      const { query } = require('../config/database');

      const result = await query(`
        SELECT 
          ir.*,
          i.invoice_number,
          i.customer_name,
          i.total_amount,
          i.balance_due
        FROM invoice_reminders ir
        JOIN invoices i ON ir.invoice_id = i.id
        WHERE ir.school_id = $1 
          AND ir.delivery_status = 'pending'
          AND ir.scheduled_date <= CURRENT_DATE
        ORDER BY ir.scheduled_date
      `, [req.user.schoolId]);

      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      next(error);
    }
  }
);

// =============================================================================
// ANALYTICS ROUTES
// =============================================================================

/**
 * @route   GET /api/invoices/analytics
 * @desc    Get invoice analytics
 * @access  Private (Principal, School Director, Finance)
 */
router.get('/analytics',
  requireRole(['principal', 'school_director', 'finance']),
  InvoiceController.getAnalytics
);

/**
 * @route   GET /api/invoices/outstanding
 * @desc    Get outstanding invoices summary
 * @access  Private (Finance staff)
 */
router.get('/outstanding',
  requireRole(['principal', 'school_director', 'finance']),
  async (req, res, next) => {
    try {
      const { query } = require('../config/database');
      const { daysOverdue } = req.query;

      let whereClause = 'WHERE i.school_id = $1 AND i.balance_due > 0';
      const params = [req.user.schoolId];

      if (daysOverdue) {
        whereClause += ` AND i.due_date < CURRENT_DATE - INTERVAL '${parseInt(daysOverdue)} days'`;
      }

      const result = await query(`
        SELECT 
          i.id,
          i.invoice_number,
          i.customer_name,
          i.due_date,
          i.total_amount,
          i.balance_due,
          s.first_name as student_first_name,
          s.last_name as student_last_name,
          c.class_name,
          CASE 
            WHEN i.due_date < CURRENT_DATE THEN 'overdue'
            WHEN i.due_date <= CURRENT_DATE + INTERVAL '7 days' THEN 'due_soon'
            ELSE 'not_due'
          END as urgency_status,
          CURRENT_DATE - i.due_date as days_overdue
        FROM invoices i
        JOIN students s ON i.student_id = s.id
        LEFT JOIN classes c ON s.class_id = c.id
        ${whereClause}
        ORDER BY i.due_date ASC
      `, params);

      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;