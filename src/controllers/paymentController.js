const Payment = require('../models/payment');
const { ValidationError, NotFoundError, ConflictError, DatabaseError } = require('../middleware/errorHandler');

class PaymentController {
  // Record a payment
  static async recordPayment(req, res, next) {
    try {
      const paymentData = {
        ...req.body,
        schoolId: req.user.school_id,
        createdBy: req.user.id
      };

      // Validate payment data
      const validationErrors = Payment.validatePaymentData(paymentData);
      if (validationErrors.length > 0) {
        throw new ValidationError(validationErrors.join(', '));
      }

      const payment = await Payment.create(paymentData, req.user.id);

      res.status(201).json({
        success: true,
        message: 'Payment recorded successfully',
        data: payment
      });
    } catch (error) {
      next(error);
    }
  }

  // Get payment history for a student
  static async getPaymentHistory(req, res, next) {
    try {
      const { id } = req.params;
      const filters = {
        status: req.query.status,
        paymentMethodId: req.query.paymentMethodId,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        isReconciled: req.query.isReconciled === 'true',
        limit: parseInt(req.query.limit) || 50,
        offset: parseInt(req.query.offset) || 0
      };

      const payments = await Payment.findByStudent(id, filters);

      res.json({
        success: true,
        data: payments,
        pagination: {
          limit: filters.limit,
          offset: filters.offset,
          total: payments.length
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Reconcile a payment
  static async reconcilePayment(req, res, next) {
    try {
      const { paymentId, reconciliationNotes } = req.body;

      if (!paymentId) {
        throw new ValidationError('Payment ID is required');
      }

      const payment = await Payment.reconcile(paymentId, req.user.id, reconciliationNotes);

      res.json({
        success: true,
        message: 'Payment reconciled successfully',
        data: payment
      });
    } catch (error) {
      next(error);
    }
  }

  // Get pending reconciliation payments
  static async getPendingReconciliation(req, res, next) {
    try {
      const filters = {
        paymentMethodId: req.query.paymentMethodId,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        limit: parseInt(req.query.limit) || 20,
        offset: parseInt(req.query.offset) || 0
      };

      const pendingPayments = await Payment.getPendingReconciliation(req.user.school_id, filters);

      res.json({
        success: true,
        data: pendingPayments,
        pagination: {
          limit: filters.limit,
          offset: filters.offset,
          total: pendingPayments.length
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Get payment by ID
  static async getPayment(req, res, next) {
    try {
      const { id } = req.params;
      const payment = await Payment.findById(id);

      res.json({
        success: true,
        data: payment
      });
    } catch (error) {
      next(error);
    }
  }

  // Update payment
  static async updatePayment(req, res, next) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const payment = await Payment.update(id, updateData, req.user.id);

      res.json({
        success: true,
        message: 'Payment updated successfully',
        data: payment
      });
    } catch (error) {
      next(error);
    }
  }

  // Generate receipt
  static async generateReceipt(req, res, next) {
    try {
      const { paymentId, receiptData } = req.body;

      if (!paymentId) {
        throw new ValidationError('Payment ID is required');
      }

      const receipt = await Payment.generateReceipt(paymentId, receiptData, req.user.id);

      res.status(201).json({
        success: true,
        message: 'Receipt generated successfully',
        data: receipt
      });
    } catch (error) {
      next(error);
    }
  }

  // Get receipt by ID
  static async getReceipt(req, res, next) {
    try {
      const { id } = req.params;
      const receipt = await Payment.getReceipt(id);

      res.json({
        success: true,
        data: receipt
      });
    } catch (error) {
      next(error);
    }
  }

  // Email receipt
  static async emailReceipt(req, res, next) {
    try {
      const { receiptId, emailData } = req.body;

      if (!receiptId || !emailData) {
        throw new ValidationError('Receipt ID and email data are required');
      }

      const result = await Payment.emailReceipt(receiptId, emailData, req.user.id);

      res.json({
        success: true,
        message: 'Receipt emailed successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  // Get payment receipt
  static async getPaymentReceipt(req, res, next) {
    try {
      const { id } = req.params;
      const receipt = await Payment.getPaymentReceipt(id);

      res.json({
        success: true,
        data: receipt
      });
    } catch (error) {
      next(error);
    }
  }

  // Create payment plan
  static async createPaymentPlan(req, res, next) {
    try {
      const planData = {
        ...req.body,
        schoolId: req.user.school_id,
        createdBy: req.user.id
      };

      const plan = await Payment.createPaymentPlan(planData, req.user.id);

      res.status(201).json({
        success: true,
        message: 'Payment plan created successfully',
        data: plan
      });
    } catch (error) {
      next(error);
    }
  }

  // Get payment plans
  static async getPaymentPlans(req, res, next) {
    try {
      const filters = {
        studentId: req.query.studentId,
        status: req.query.status,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        limit: parseInt(req.query.limit) || 20,
        offset: parseInt(req.query.offset) || 0
      };

      const plans = await Payment.getPaymentPlans(req.user.school_id, filters);

      res.json({
        success: true,
        data: plans,
        pagination: {
          limit: filters.limit,
          offset: filters.offset,
          total: plans.length
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Get payment plan by ID
  static async getPaymentPlan(req, res, next) {
    try {
      const { id } = req.params;
      const plan = await Payment.getPaymentPlan(id);

      res.json({
        success: true,
        data: plan
      });
    } catch (error) {
      next(error);
    }
  }

  // Update payment plan
  static async updatePaymentPlan(req, res, next) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const plan = await Payment.updatePaymentPlan(id, updateData, req.user.id);

      res.json({
        success: true,
        message: 'Payment plan updated successfully',
        data: plan
      });
    } catch (error) {
      next(error);
    }
  }

  // Delete payment plan
  static async deletePaymentPlan(req, res, next) {
    try {
      const { id } = req.params;
      const plan = await Payment.deletePaymentPlan(id, req.user.id);

      res.json({
        success: true,
        message: 'Payment plan deleted successfully',
        data: plan
      });
    } catch (error) {
      next(error);
    }
  }

  // Create payment method
  static async createPaymentMethod(req, res, next) {
    try {
      const methodData = {
        ...req.body,
        schoolId: req.user.school_id
      };

      const method = await Payment.createPaymentMethod(methodData, req.user.id);

      res.status(201).json({
        success: true,
        message: 'Payment method created successfully',
        data: method
      });
    } catch (error) {
      next(error);
    }
  }

  // Get payment methods
  static async getPaymentMethods(req, res, next) {
    try {
      const methods = await Payment.getPaymentMethods(req.user.school_id);

      res.json({
        success: true,
        data: methods
      });
    } catch (error) {
      next(error);
    }
  }

  // Get payment method by ID
  static async getPaymentMethod(req, res, next) {
    try {
      const { id } = req.params;
      const method = await Payment.getPaymentMethod(id);

      res.json({
        success: true,
        data: method
      });
    } catch (error) {
      next(error);
    }
  }

  // Update payment method
  static async updatePaymentMethod(req, res, next) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const method = await Payment.updatePaymentMethod(id, updateData);

      res.json({
        success: true,
        message: 'Payment method updated successfully',
        data: method
      });
    } catch (error) {
      next(error);
    }
  }

  // Delete payment method
  static async deletePaymentMethod(req, res, next) {
    try {
      const { id } = req.params;
      const method = await Payment.deletePaymentMethod(id, req.user.id);

      res.json({
        success: true,
        message: 'Payment method deleted successfully',
        data: method
      });
    } catch (error) {
      next(error);
    }
  }

  // Get financial dashboard
  static async getFinancialDashboard(req, res, next) {
    try {
      const filters = {
        academicYearId: req.query.academicYearId,
        startDate: req.query.startDate,
        endDate: req.query.endDate
      };

      const dashboard = await Payment.getFinancialDashboard(req.user.school_id, filters);

      res.json({
        success: true,
        data: dashboard
      });
    } catch (error) {
      next(error);
    }
  }

  // Get financial reports
  static async getFinancialReports(req, res, next) {
    try {
      const filters = {
        reportType: req.query.reportType,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        classId: req.query.classId,
        paymentMethodId: req.query.paymentMethodId
      };

      const reports = await Payment.getFinancialReports(req.user.school_id, filters);

      res.json({
        success: true,
        data: reports
      });
    } catch (error) {
      next(error);
    }
  }

  // Get fee defaulters
  static async getFeeDefaulters(req, res, next) {
    try {
      const filters = {
        classId: req.query.classId,
        daysOverdue: parseInt(req.query.daysOverdue) || 30,
        limit: parseInt(req.query.limit) || 50,
        offset: parseInt(req.query.offset) || 0
      };

      const defaulters = await Payment.getFeeDefaulters(req.user.school_id, filters);

      res.json({
        success: true,
        data: defaulters,
        pagination: {
          limit: filters.limit,
          offset: filters.offset,
          total: defaulters.length
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Send reminders
  static async sendReminders(req, res, next) {
    try {
      const { studentIds, reminderType, message } = req.body;

      if (!Array.isArray(studentIds) || studentIds.length === 0) {
        throw new ValidationError('Student IDs array is required');
      }

      const result = await Payment.sendReminders(studentIds, reminderType, message, req.user.id);

      res.json({
        success: true,
        message: 'Reminders sent successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  // Get financial analytics
  static async getFinancialAnalytics(req, res, next) {
    try {
      const filters = {
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        period: req.query.period || 'monthly',
        includeComparisons: req.query.includeComparisons === 'true'
      };

      const analytics = await Payment.getFinancialAnalytics(req.user.school_id, filters);

      res.json({
        success: true,
        data: analytics
      });
    } catch (error) {
      next(error);
    }
  }

  // Get payment trends
  static async getPaymentTrends(req, res, next) {
    try {
      const filters = {
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        period: req.query.period || 'monthly',
        paymentMethodId: req.query.paymentMethodId
      };

      const trends = await Payment.getPaymentTrends(req.user.school_id, filters);

      res.json({
        success: true,
        data: trends
      });
    } catch (error) {
      next(error);
    }
  }

  // Get revenue analysis
  static async getRevenueAnalysis(req, res, next) {
    try {
      const filters = {
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        breakdownBy: req.query.breakdownBy || 'category'
      };

      const analysis = await Payment.getRevenueAnalysis(req.user.school_id, filters);

      res.json({
        success: true,
        data: analysis
      });
    } catch (error) {
      next(error);
    }
  }

  // Get outstanding fees
  static async getOutstandingFees(req, res, next) {
    try {
      const filters = {
        classId: req.query.classId,
        studentId: req.query.studentId,
        includeOverdue: req.query.includeOverdue === 'true',
        limit: parseInt(req.query.limit) || 50,
        offset: parseInt(req.query.offset) || 0
      };

      const outstandingFees = await Payment.getOutstandingFees(req.user.school_id, filters);

      res.json({
        success: true,
        data: outstandingFees,
        pagination: {
          limit: filters.limit,
          offset: filters.offset,
          total: outstandingFees.length
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Generate payment report
  static async generatePaymentReport(req, res, next) {
    try {
      const filters = {
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        paymentMethodId: req.query.paymentMethodId,
        includeReconciliation: req.query.includeReconciliation === 'true',
        format: req.query.format || 'pdf'
      };

      const report = await Payment.generatePaymentReport(req.user.school_id, filters);

      res.json({
        success: true,
        data: report
      });
    } catch (error) {
      next(error);
    }
  }

  // Generate financial summary
  static async generateFinancialSummary(req, res, next) {
    try {
      const filters = {
        academicYearId: req.query.academicYearId,
        includeComparisons: req.query.includeComparisons === 'true',
        includeProjections: req.query.includeProjections === 'true'
      };

      const summary = await Payment.generateFinancialSummary(req.user.school_id, filters);

      res.json({
        success: true,
        data: summary
      });
    } catch (error) {
      next(error);
    }
  }

  // Bulk record payments
  static async bulkRecordPayments(req, res, next) {
    try {
      const { payments } = req.body;

      if (!Array.isArray(payments) || payments.length === 0) {
        throw new ValidationError('Payments array is required');
      }

      const results = [];
      const errors = [];

      for (let i = 0; i < payments.length; i++) {
        try {
          const paymentData = {
            ...payments[i],
            schoolId: req.user.school_id,
            createdBy: req.user.id
          };

          // Validate payment data
          const validationErrors = Payment.validatePaymentData(paymentData);
          if (validationErrors.length > 0) {
            errors.push({
              index: i,
              data: payments[i],
              error: validationErrors.join(', ')
            });
            continue;
          }

          const payment = await Payment.create(paymentData, req.user.id);
          results.push(payment);
        } catch (error) {
          errors.push({
            index: i,
            data: payments[i],
            error: error.message
          });
        }
      }

      res.status(201).json({
        success: true,
        message: 'Bulk payment recording completed',
        data: {
          success: results,
          errors: errors,
          totalProcessed: payments.length,
          successCount: results.length,
          errorCount: errors.length
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Notify payment received
  static async notifyPaymentReceived(req, res, next) {
    try {
      const { paymentId, notificationType } = req.body;

      if (!paymentId || !notificationType) {
        throw new ValidationError('Payment ID and notification type are required');
      }

      const result = await Payment.notifyPaymentReceived(paymentId, notificationType, req.user.id);

      res.json({
        success: true,
        message: 'Payment notification sent successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  // Notify fee due
  static async notifyFeeDue(req, res, next) {
    try {
      const { studentIds, feeType, dueDate, message } = req.body;

      if (!Array.isArray(studentIds) || studentIds.length === 0) {
        throw new ValidationError('Student IDs array is required');
      }

      const result = await Payment.notifyFeeDue(studentIds, feeType, dueDate, message, req.user.id);

      res.json({
        success: true,
        message: 'Fee due notifications sent successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  // Notify overdue fees
  static async notifyOverdueFees(req, res, next) {
    try {
      const { studentIds, daysOverdue, message } = req.body;

      if (!Array.isArray(studentIds) || studentIds.length === 0) {
        throw new ValidationError('Student IDs array is required');
      }

      const result = await Payment.notifyOverdueFees(studentIds, daysOverdue, message, req.user.id);

      res.json({
        success: true,
        message: 'Overdue fee notifications sent successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  // Validate payment data
  static async validatePayment(req, res, next) {
    try {
      const paymentData = req.body;
      const errors = Payment.validatePaymentData(paymentData);

      res.json({
        success: true,
        data: {
          isValid: errors.length === 0,
          errors: errors
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = PaymentController; 