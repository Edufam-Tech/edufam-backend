const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../../middleware/auth');
const SupportController = require('../../controllers/admin/supportController');

// Admin Support Tickets Routes
router.use(authenticate);

// List tickets
router.get('/tickets', requireRole(['super_admin', 'support_hr', 'edufam_admin']), SupportController.listTickets);

// Ticket detail
router.get(
  '/tickets/:id',
  requireRole(['super_admin', 'support_hr', 'edufam_admin']),
  SupportController.getTicket
);

// Update ticket status
router.post(
  '/tickets/:id/status',
  requireRole(['super_admin', 'support_hr', 'edufam_admin']),
  SupportController.updateStatus
);

// Assign ticket to admin
router.post(
  '/tickets/:id/assign',
  requireRole(['super_admin', 'support_hr', 'edufam_admin']),
  SupportController.assignTicket
);

// Add message to ticket
router.post(
  '/tickets/:id/messages',
  requireRole(['super_admin', 'support_hr', 'edufam_admin']),
  SupportController.addMessage
);

// Support analytics (summary)
router.get(
  '/analytics',
  requireRole(['super_admin', 'support_hr', 'edufam_admin']),
  SupportController.getSupportAnalytics
);

// Support analytics (time series for last 30 days)
router.get(
  '/analytics/timeseries',
  requireRole(['super_admin', 'support_hr', 'edufam_admin']),
  SupportController.getSupportAnalyticsTimeseries
);

// Knowledge Base search
router.get(
  '/kb',
  requireRole(['super_admin', 'support_hr', 'edufam_admin']),
  SupportController.getKnowledgeBase
);

// Knowledge Base categories
router.get(
  '/kb/categories',
  requireRole(['super_admin', 'support_hr', 'edufam_admin']),
  SupportController.getKnowledgeBaseCategories
);

// Knowledge Base CRUD operations
router.post(
  '/kb',
  requireRole(['super_admin', 'support_hr', 'edufam_admin']),
  SupportController.createKnowledgeBaseArticle
);

router.get(
  '/kb/:id',
  requireRole(['super_admin', 'support_hr', 'edufam_admin']),
  SupportController.getKnowledgeBaseArticle
);

router.put(
  '/kb/:id',
  requireRole(['super_admin', 'support_hr', 'edufam_admin']),
  SupportController.updateKnowledgeBaseArticle
);

router.delete(
  '/kb/:id',
  requireRole(['super_admin', 'support_hr', 'edufam_admin']),
  SupportController.deleteKnowledgeBaseArticle
);

// Quick actions: create user for a school
router.post(
  '/schools/:schoolId/quick-actions/create-user',
  requireRole(['super_admin', 'support_hr', 'edufam_admin']),
  SupportController.qaCreateUser
);

// Quick actions: adjust term dates
router.post(
  '/schools/:schoolId/quick-actions/adjust-term',
  requireRole(['super_admin', 'support_hr', 'edufam_admin']),
  SupportController.qaAdjustTermDates
);

// Quick actions: M-Pesa diagnostics/reset
router.post(
  '/schools/:schoolId/quick-actions/mpesa-reset',
  requireRole(['super_admin', 'support_hr', 'edufam_admin']),
  SupportController.qaMpesaReset
);

// Quick actions: trigger training session
router.post(
  '/schools/:schoolId/quick-actions/trigger-training',
  requireRole(['super_admin', 'support_hr', 'edufam_admin']),
  SupportController.qaTriggerTraining
);

// School context overview for support
router.get(
  '/schools/:schoolId/context',
  requireRole(['super_admin', 'support_hr', 'edufam_admin']),
  SupportController.getSchoolContext
);

// Training coordination endpoints
router.get(
  '/training/history',
  requireRole(['super_admin', 'support_hr', 'edufam_admin']),
  SupportController.getTrainingHistory
);

router.post(
  '/training',
  requireRole(['super_admin', 'support_hr', 'edufam_admin']),
  SupportController.createTrainingSession
);

router.patch(
  '/training/:id/status',
  requireRole(['super_admin', 'support_hr', 'edufam_admin']),
  SupportController.updateTrainingStatus
);

// NOTE: Keep endpoints minimal for Support HR scope.

module.exports = router;


