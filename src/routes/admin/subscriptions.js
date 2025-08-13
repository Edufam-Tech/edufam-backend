const express = require('express');
const router = express.Router();
const { authenticate, requireRole, requireUserType } = require('../../middleware/auth');
const SubscriptionController = require('../../controllers/admin/subscriptionController');

// Apply admin authentication to all routes
router.use(authenticate);
router.use(requireUserType('platform_admin'));

// =============================================================================
// SUBSCRIPTION PLAN MANAGEMENT ROUTES
// =============================================================================

/**
 * @route   GET /api/admin/subscriptions/plans
 * @desc    Get all subscription plans
 * @access  Private (Platform Admin)
 */
router.get('/plans',
  requireRole(['super_admin', 'admin_finance']),
  SubscriptionController.getSubscriptionPlans
);

/**
 * @route   POST /api/admin/subscriptions/plans
 * @desc    Create new subscription plan
 * @access  Private (Super Admin, Finance Admin)
 */
router.post('/plans',
  requireRole(['super_admin', 'admin_finance']),
  SubscriptionController.createSubscriptionPlan
);

/**
 * @route   GET /api/admin/subscriptions/plans/:id
 * @desc    Get subscription plan details
 * @access  Private (Platform Admin)
 */
router.get('/plans/:id',
  requireRole(['super_admin', 'admin_finance', 'regional_admin']),
  SubscriptionController.getSubscriptionPlan
);

/**
 * @route   PUT /api/admin/subscriptions/plans/:id
 * @desc    Update subscription plan
 * @access  Private (Super Admin, Finance Admin)
 */
router.put('/plans/:id',
  requireRole(['super_admin', 'admin_finance']),
  SubscriptionController.updateSubscriptionPlan
);

/**
 * @route   DELETE /api/admin/subscriptions/plans/:id
 * @desc    Deactivate subscription plan
 * @access  Private (Super Admin)
 */
router.delete('/plans/:id',
  requireRole(['super_admin']),
  SubscriptionController.deactivateSubscriptionPlan
);

// =============================================================================
// SCHOOL SUBSCRIPTION MANAGEMENT ROUTES
// =============================================================================

/**
 * @route   GET /api/admin/subscriptions/schools
 * @desc    Get all school subscriptions
 * @access  Private (Platform Admin)
 */
router.get('/schools',
  requireRole(['super_admin', 'admin_finance', 'regional_admin']),
  SubscriptionController.getSchoolSubscriptions
);

/**
 * @route   POST /api/admin/subscriptions/schools
 * @desc    Create school subscription
 * @access  Private (Super Admin, Finance Admin)
 */
router.post('/schools',
  requireRole(['super_admin', 'admin_finance']),
  SubscriptionController.createSchoolSubscription
);

/**
 * @route   GET /api/admin/subscriptions/schools/:subscriptionId
 * @desc    Get school subscription details
 * @access  Private (Platform Admin)
 */
router.get('/schools/:subscriptionId',
  requireRole(['super_admin', 'admin_finance', 'regional_admin']),
  SubscriptionController.getSchoolSubscription
);

/**
 * @route   PUT /api/admin/subscriptions/schools/:subscriptionId
 * @desc    Update school subscription
 * @access  Private (Super Admin, Finance Admin)
 */
router.put('/schools/:subscriptionId',
  requireRole(['super_admin', 'admin_finance']),
  SubscriptionController.updateSchoolSubscription
);

/**
 * @route   POST /api/admin/subscriptions/schools/:subscriptionId/suspend
 * @desc    Suspend school subscription
 * @access  Private (Super Admin, Finance Admin)
 */
router.post('/schools/:subscriptionId/suspend',
  requireRole(['super_admin', 'admin_finance']),
  SubscriptionController.suspendSubscription
);

/**
 * @route   POST /api/admin/subscriptions/schools/:subscriptionId/reactivate
 * @desc    Reactivate school subscription
 * @access  Private (Super Admin, Finance Admin)
 */
router.post('/schools/:subscriptionId/reactivate',
  requireRole(['super_admin', 'admin_finance']),
  SubscriptionController.reactivateSubscription
);

/**
 * @route   POST /api/admin/subscriptions/schools/:subscriptionId/cancel
 * @desc    Cancel school subscription
 * @access  Private (Super Admin)
 */
router.post('/schools/:subscriptionId/cancel',
  requireRole(['super_admin']),
  SubscriptionController.cancelSubscription
);

/**
 * @route   POST /api/admin/subscriptions/schools/:subscriptionId/upgrade
 * @desc    Upgrade school subscription
 * @access  Private (Super Admin, Finance Admin)
 */
router.post('/schools/:subscriptionId/upgrade',
  requireRole(['super_admin', 'admin_finance']),
  SubscriptionController.upgradeSubscription
);

/**
 * @route   POST /api/admin/subscriptions/schools/:subscriptionId/downgrade
 * @desc    Downgrade school subscription
 * @access  Private (Super Admin, Finance Admin)
 */
router.post('/schools/:subscriptionId/downgrade',
  requireRole(['super_admin', 'admin_finance']),
  SubscriptionController.downgradeSubscription
);

// =============================================================================
// BILLING AND INVOICING ROUTES
// =============================================================================

/**
 * @route   GET /api/admin/subscriptions/invoices
 * @desc    Get subscription invoices
 * @access  Private (Platform Admin)
 */
router.get('/invoices',
  requireRole(['super_admin', 'admin_finance', 'regional_admin']),
  SubscriptionController.getSubscriptionInvoices
);

/**
 * @route   POST /api/admin/subscriptions/invoices/generate
 * @desc    Generate subscription invoices
 * @access  Private (Super Admin, Finance Admin)
 */
router.post('/invoices/generate',
  requireRole(['super_admin', 'admin_finance']),
  SubscriptionController.generateInvoices
);

/**
 * @route   GET /api/admin/subscriptions/invoices/:invoiceId
 * @desc    Get invoice details
 * @access  Private (Platform Admin)
 */
router.get('/invoices/:invoiceId',
  requireRole(['super_admin', 'admin_finance', 'regional_admin']),
  SubscriptionController.getSubscriptionInvoice
);

/**
 * @route   POST /api/admin/subscriptions/invoices/:invoiceId/send
 * @desc    Send invoice to school
 * @access  Private (Super Admin, Finance Admin)
 */
router.post('/invoices/:invoiceId/send',
  requireRole(['super_admin', 'admin_finance']),
  SubscriptionController.sendInvoice
);

/**
 * @route   POST /api/admin/subscriptions/invoices/:invoiceId/payment
 * @desc    Record invoice payment
 * @access  Private (Super Admin, Finance Admin)
 */
router.post('/invoices/:invoiceId/payment',
  requireRole(['super_admin', 'admin_finance']),
  SubscriptionController.recordPayment
);

/**
 * @route   POST /api/admin/subscriptions/invoices/:invoiceId/void
 * @desc    Void invoice
 * @access  Private (Super Admin)
 */
router.post('/invoices/:invoiceId/void',
  requireRole(['super_admin']),
  SubscriptionController.voidInvoice
);

// =============================================================================
// PAYMENT PROCESSING ROUTES
// =============================================================================

/**
 * @route   GET /api/admin/subscriptions/payments
 * @desc    Get payment history
 * @access  Private (Platform Admin)
 */
router.get('/payments',
  requireRole(['super_admin', 'admin_finance']),
  SubscriptionController.getPaymentHistory
);

/**
 * @route   POST /api/admin/subscriptions/payments/process
 * @desc    Process bulk payments
 * @access  Private (Super Admin, Finance Admin)
 */
router.post('/payments/process',
  requireRole(['super_admin', 'admin_finance']),
  SubscriptionController.processBulkPayments
);

/**
 * @route   POST /api/admin/subscriptions/payments/:paymentId/refund
 * @desc    Process payment refund
 * @access  Private (Super Admin)
 */
router.post('/payments/:paymentId/refund',
  requireRole(['super_admin']),
  SubscriptionController.processRefund
);

// =============================================================================
// ANALYTICS AND REPORTING ROUTES
// =============================================================================

/**
 * @route   GET /api/admin/subscriptions/analytics/revenue
 * @desc    Get subscription revenue analytics
 * @access  Private (Super Admin, Finance Admin)
 */
router.get('/analytics/revenue',
  requireRole(['super_admin', 'admin_finance']),
  SubscriptionController.getRevenueAnalytics
);

/**
 * @route   GET /api/admin/subscriptions/analytics/churn
 * @desc    Get churn analytics
 * @access  Private (Super Admin, Finance Admin)
 */
router.get('/analytics/churn',
  requireRole(['super_admin', 'admin_finance']),
  SubscriptionController.getChurnAnalytics
);

/**
 * @route   GET /api/admin/subscriptions/analytics/growth
 * @desc    Get growth analytics
 * @access  Private (Super Admin, Finance Admin)
 */
router.get('/analytics/growth',
  requireRole(['super_admin', 'admin_finance']),
  SubscriptionController.getGrowthAnalytics
);

/**
 * @route   GET /api/admin/subscriptions/reports/summary
 * @desc    Get subscription summary report
 * @access  Private (Platform Admin)
 */
router.get('/reports/summary',
  requireRole(['super_admin', 'admin_finance', 'regional_admin']),
  SubscriptionController.getSubscriptionSummary
);

/**
 * @route   POST /api/admin/subscriptions/reports/export
 * @desc    Export subscription data
 * @access  Private (Super Admin, Finance Admin)
 */
router.post('/reports/export',
  requireRole(['super_admin', 'admin_finance']),
  SubscriptionController.exportSubscriptionData
);

// =============================================================================
// BULK OPERATIONS ROUTES
// =============================================================================

/**
 * @route   POST /api/admin/subscriptions/bulk/create
 * @desc    Bulk create subscriptions
 * @access  Private (Super Admin)
 */
router.post('/bulk/create',
  requireRole(['super_admin']),
  SubscriptionController.bulkCreateSubscriptions
);

/**
 * @route   POST /api/admin/subscriptions/bulk/update
 * @desc    Bulk update subscriptions
 * @access  Private (Super Admin)
 */
router.post('/bulk/update',
  requireRole(['super_admin']),
  SubscriptionController.bulkUpdateSubscriptions
);

/**
 * @route   POST /api/admin/subscriptions/bulk/suspend
 * @desc    Bulk suspend subscriptions
 * @access  Private (Super Admin)
 */
router.post('/bulk/suspend',
  requireRole(['super_admin']),
  SubscriptionController.bulkSuspendSubscriptions
);

module.exports = router;