const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');

// Import controllers
const FeeController = require('../controllers/feeController');
const PaymentController = require('../controllers/paymentController');
const MpesaController = require('../controllers/mpesaController');
const InvoiceController = require('../controllers/invoiceController');

// Fee Structure Routes
router.post('/fee-structures', 
  authenticate, 
  requireRole(['finance', 'principal', 'school_director']), 
  FeeController.createFeeStructure
);

router.get('/fee-structures', 
  authenticate, 
  FeeController.getFeeStructures
);

router.get('/fee-structures/:id', 
  authenticate, 
  FeeController.getFeeStructure
);

router.put('/fee-structures/:id', 
  authenticate, 
  requireRole(['finance', 'principal', 'school_director']), 
  FeeController.updateFeeStructure
);

router.delete('/fee-structures/:id', 
  authenticate, 
  requireRole(['finance', 'principal', 'school_director']), 
  FeeController.deleteFeeStructure
);

// Fee Assignment Routes
router.post('/fee-assignments', 
  authenticate, 
  requireRole(['finance', 'principal', 'school_director']), 
  FeeController.assignFees
);

router.get('/fee-assignments/pending', 
  authenticate, 
  requireRole(['finance', 'principal', 'school_director']), 
  FeeController.getPendingAssignments
);

router.post('/fee-assignments/approve', 
  authenticate, 
  requireRole(['finance', 'principal', 'school_director']), 
  FeeController.approveAssignment
);

router.post('/fee-assignments/reject', 
  authenticate, 
  requireRole(['finance', 'principal', 'school_director']), 
  FeeController.rejectAssignment
);

router.get('/fee-assignments/student/:id', 
  authenticate, 
  FeeController.getStudentFees
);

// Payment Routes
router.post('/payments/record', 
  authenticate, 
  requireRole(['finance', 'principal', 'school_director']), 
  PaymentController.recordPayment
);

router.get('/payments/student/:id', 
  authenticate, 
  PaymentController.getPaymentHistory
);

router.post('/payments/reconcile', 
  authenticate, 
  requireRole(['finance', 'principal', 'school_director']), 
  PaymentController.reconcilePayment
);

router.get('/payments/pending', 
  authenticate, 
  requireRole(['finance', 'principal', 'school_director']), 
  PaymentController.getPendingReconciliation
);

router.get('/payments/:id', 
  authenticate, 
  PaymentController.getPayment
);

router.put('/payments/:id', 
  authenticate, 
  requireRole(['finance', 'principal', 'school_director']), 
  PaymentController.updatePayment
);

// M-Pesa Routes
router.post('/payments/mpesa/stk-push', 
  authenticate, 
  MpesaController.initiateSTKPush
);

router.post('/payments/mpesa/callback', 
  MpesaController.processCallback
);

router.get('/payments/mpesa/status/:id', 
  authenticate, 
  MpesaController.checkStatus
);

router.post('/payments/mpesa/verify', 
  authenticate, 
  MpesaController.verifyPayment
);

router.get('/payments/mpesa/transactions', 
  authenticate, 
  MpesaController.getTransactions
);

router.get('/payments/mpesa/statistics', 
  authenticate, 
  MpesaController.getStatistics
);

// Additional M-Pesa Routes
router.get('/payments/mpesa/configuration', 
  authenticate, 
  MpesaController.getConfigurationStatus
);

router.get('/payments/mpesa/test-connection', 
  authenticate, 
  MpesaController.testConnection
);

router.get('/payments/mpesa/transaction/:id', 
  authenticate, 
  MpesaController.getTransactionById
);

router.get('/payments/mpesa/callbacks', 
  authenticate, 
  MpesaController.getCallbacks
);

router.post('/payments/mpesa/retry', 
  authenticate, 
  MpesaController.retryTransaction
);

// Missing Critical M-Pesa Endpoints
router.post('/payments/mpesa/paybill', 
  authenticate, 
  requireRole(['finance', 'principal', 'school_director']), 
  MpesaController.initiatePaybill
);

router.post('/payments/mpesa/callback/c2b', 
  MpesaController.processC2BCallback
);

router.post('/payments/mpesa/reconcile', 
  authenticate, 
  requireRole(['finance', 'principal', 'school_director']), 
  MpesaController.reconcilePayment
);

router.get('/payments/mpesa/history', 
  authenticate, 
  MpesaController.getPaymentHistory
);

router.get('/payments/mpesa/receipt/:transactionId', 
  authenticate, 
  MpesaController.getPaymentReceipt
);

router.get('/payments/mpesa/analytics', 
  authenticate, 
  requireRole(['finance', 'principal', 'school_director']), 
  MpesaController.getPaymentAnalytics
);

router.post('/payments/mpesa/retry-failed', 
  authenticate, 
  requireRole(['finance', 'principal', 'school_director']), 
  MpesaController.retryFailedPayments
);

router.get('/payments/mpesa/summary', 
  authenticate, 
  MpesaController.getTransactionSummary
);

router.get('/payments/mpesa/export', 
  authenticate, 
  MpesaController.exportTransactions
);

router.get('/payments/mpesa/dashboard', 
  authenticate, 
  MpesaController.getDashboard
);

router.post('/payments/mpesa/validate-phone', 
  authenticate, 
  MpesaController.validatePhoneNumber
);

router.get('/payments/mpesa/error-codes', 
  authenticate, 
  MpesaController.getErrorCodes
);

// Invoice Routes
router.post('/invoices/generate', 
  authenticate, 
  requireRole(['finance', 'principal', 'school_director']), 
  InvoiceController.generateInvoice
);

router.get('/invoices/:id', 
  authenticate, 
  InvoiceController.getInvoice
);

router.post('/invoices/bulk-generate', 
  authenticate, 
  requireRole(['finance', 'principal', 'school_director']), 
  InvoiceController.bulkGenerateInvoices
);

router.post('/invoices/send', 
  authenticate, 
  requireRole(['finance', 'principal', 'school_director']), 
  InvoiceController.sendInvoice
);

router.get('/invoices/student/:id', 
  authenticate, 
  InvoiceController.getStudentInvoices
);

router.get('/invoices', 
  authenticate, 
  InvoiceController.getInvoices
);

router.put('/invoices/:id', 
  authenticate, 
  requireRole(['finance', 'principal', 'school_director']), 
  InvoiceController.updateInvoice
);

// Receipt Routes
router.post('/receipts/generate', 
  authenticate, 
  requireRole(['finance', 'principal', 'school_director']), 
  PaymentController.generateReceipt
);

router.get('/receipts/:id', 
  authenticate, 
  PaymentController.getReceipt
);

router.post('/receipts/email', 
  authenticate, 
  requireRole(['finance', 'principal', 'school_director']), 
  PaymentController.emailReceipt
);

router.get('/receipts/payment/:id', 
  authenticate, 
  PaymentController.getPaymentReceipt
);

// Payment Plans Routes
router.post('/payment-plans', 
  authenticate, 
  requireRole(['finance', 'principal', 'school_director']), 
  PaymentController.createPaymentPlan
);

router.get('/payment-plans', 
  authenticate, 
  PaymentController.getPaymentPlans
);

router.get('/payment-plans/:id', 
  authenticate, 
  PaymentController.getPaymentPlan
);

router.put('/payment-plans/:id', 
  authenticate, 
  requireRole(['finance', 'principal', 'school_director']), 
  PaymentController.updatePaymentPlan
);

router.delete('/payment-plans/:id', 
  authenticate, 
  requireRole(['finance', 'principal', 'school_director']), 
  PaymentController.deletePaymentPlan
);

// Fee Discounts Routes
router.post('/fee-discounts', 
  authenticate, 
  requireRole(['finance', 'principal', 'school_director']), 
  FeeController.createDiscount
);

router.get('/fee-discounts', 
  authenticate, 
  FeeController.getDiscounts
);

router.get('/fee-discounts/:id', 
  authenticate, 
  FeeController.getDiscount
);

router.put('/fee-discounts/:id', 
  authenticate, 
  requireRole(['finance', 'principal', 'school_director']), 
  FeeController.updateDiscount
);

router.delete('/fee-discounts/:id', 
  authenticate, 
  requireRole(['finance', 'principal', 'school_director']), 
  FeeController.deleteDiscount
);

// Fee Waivers Routes
router.post('/fee-waivers', 
  authenticate, 
  requireRole(['finance', 'principal', 'school_director']), 
  FeeController.createWaiver
);

router.get('/fee-waivers', 
  authenticate, 
  FeeController.getWaivers
);

router.get('/fee-waivers/:id', 
  authenticate, 
  FeeController.getWaiver
);

router.put('/fee-waivers/:id', 
  authenticate, 
  requireRole(['finance', 'principal', 'school_director']), 
  FeeController.updateWaiver
);

router.delete('/fee-waivers/:id', 
  authenticate, 
  requireRole(['finance', 'principal', 'school_director']), 
  FeeController.deleteWaiver
);

// Payment Methods Routes
router.post('/payment-methods', 
  authenticate, 
  requireRole(['finance', 'principal', 'school_director']), 
  PaymentController.createPaymentMethod
);

router.get('/payment-methods', 
  authenticate, 
  PaymentController.getPaymentMethods
);

router.get('/payment-methods/:id', 
  authenticate, 
  PaymentController.getPaymentMethod
);

router.put('/payment-methods/:id', 
  authenticate, 
  requireRole(['finance', 'principal', 'school_director']), 
  PaymentController.updatePaymentMethod
);

router.delete('/payment-methods/:id', 
  authenticate, 
  requireRole(['finance', 'principal', 'school_director']), 
  PaymentController.deletePaymentMethod
);

// Fee Categories Routes
router.post('/fee-categories', 
  authenticate, 
  requireRole(['finance', 'principal', 'school_director']), 
  FeeController.createFeeCategory
);

router.get('/fee-categories', 
  authenticate, 
  FeeController.getFeeCategories
);

router.get('/fee-categories/:id', 
  authenticate, 
  FeeController.getFeeCategory
);

router.put('/fee-categories/:id', 
  authenticate, 
  requireRole(['finance', 'principal', 'school_director']), 
  FeeController.updateFeeCategory
);

router.delete('/fee-categories/:id', 
  authenticate, 
  requireRole(['finance', 'principal', 'school_director']), 
  FeeController.deleteFeeCategory
);

// Financial Dashboard Routes
router.get('/financial/dashboard', 
  authenticate, 
  PaymentController.getFinancialDashboard
);

router.get('/financial/reports', 
  authenticate, 
  PaymentController.getFinancialReports
);

router.get('/financial/defaulters', 
  authenticate, 
  PaymentController.getFeeDefaulters
);

router.post('/financial/reminders', 
  authenticate, 
  requireRole(['finance', 'principal', 'school_director']), 
  PaymentController.sendReminders
);

// Financial Analytics Routes
router.get('/financial/analytics', 
  authenticate, 
  PaymentController.getFinancialAnalytics
);

router.get('/financial/payment-trends', 
  authenticate, 
  PaymentController.getPaymentTrends
);

router.get('/financial/revenue-analysis', 
  authenticate, 
  PaymentController.getRevenueAnalysis
);

router.get('/financial/outstanding-fees', 
  authenticate, 
  PaymentController.getOutstandingFees
);

// Export and Report Routes
router.get('/reports/fee-statement/:studentId', 
  authenticate, 
  FeeController.generateFeeStatement
);

router.get('/reports/payment-report', 
  authenticate, 
  PaymentController.generatePaymentReport
);

router.get('/reports/invoice-report', 
  authenticate, 
  InvoiceController.generateInvoiceReport
);

router.get('/reports/financial-summary', 
  authenticate, 
  PaymentController.generateFinancialSummary
);

// Bulk Operations Routes
router.post('/payments/bulk-record', 
  authenticate, 
  requireRole(['finance', 'principal', 'school_director']), 
  PaymentController.bulkRecordPayments
);

router.post('/fee-assignments/bulk', 
  authenticate, 
  requireRole(['finance', 'principal', 'school_director']), 
  FeeController.bulkAssignFees
);

// Missing Critical Fee Assignment Endpoints
router.post('/fee-assignments/submit-for-approval', 
  authenticate, 
  requireRole(['finance']), 
  FeeController.submitAssignmentForApproval
);

router.get('/fee-assignments/history', 
  authenticate, 
  FeeController.getAssignmentHistory
);

router.get('/fee-assignments/analytics', 
  authenticate, 
  requireRole(['finance', 'principal', 'school_director']), 
  FeeController.getFeeAssignmentAnalytics
);

// Fee Templates
router.get('/fees/templates', 
  authenticate, 
  FeeController.getFeeTemplates
);

router.post('/fees/templates', 
  authenticate, 
  requireRole(['finance', 'principal', 'school_director']), 
  FeeController.createFeeTemplate
);

router.get('/fees/templates/by-curriculum/:curriculumType', 
  authenticate, 
  FeeController.getTemplatesByCurriculum
);

router.post('/fees/templates/duplicate', 
  authenticate, 
  requireRole(['finance', 'principal', 'school_director']), 
  FeeController.duplicateTemplate
);

// Class-Level Fee Assignment
router.post('/fee-assignments/class-bulk', 
  authenticate, 
  requireRole(['finance', 'principal', 'school_director']), 
  FeeController.bulkAssignFeesByClass
);

router.post('/fee-assignments/individual-adjustments', 
  authenticate, 
  requireRole(['finance', 'principal', 'school_director']), 
  FeeController.applyIndividualAdjustments
);

router.get('/fee-assignments/discounts-scholarships', 
  authenticate, 
  FeeController.getDiscountsAndScholarships
);

router.post('/fee-assignments/late-fees/calculate', 
  authenticate, 
  requireRole(['finance', 'principal', 'school_director']), 
  FeeController.calculateLateFees
);

router.post('/invoices/bulk-send', 
  authenticate, 
  requireRole(['finance', 'principal', 'school_director']), 
  InvoiceController.bulkSendInvoices
);

// Notification Routes
router.post('/notifications/payment-received', 
  authenticate, 
  PaymentController.notifyPaymentReceived
);

router.post('/notifications/fee-due', 
  authenticate, 
  requireRole(['finance', 'principal', 'school_director']), 
  PaymentController.notifyFeeDue
);

router.post('/notifications/overdue-fees', 
  authenticate, 
  requireRole(['finance', 'principal', 'school_director']), 
  PaymentController.notifyOverdueFees
);

module.exports = router; 