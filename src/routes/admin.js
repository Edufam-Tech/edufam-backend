const express = require('express');
const router = express.Router();
const { adminAuth, requireSuperAdmin, requireSupportHR, hasAnyRole } = require('../middleware/auth');
const AdminAnalyticsController = require('../controllers/adminAnalyticsController');
const AdminUserManagementController = require('../controllers/adminUserManagementController');
const MultiSchoolAdminController = require('../controllers/multiSchoolAdminController');
const AdminMonitoringController = require('../controllers/adminMonitoringController');
const AdminCommunicationController = require('../controllers/adminCommunicationController');
const AdminAuditController = require('../controllers/adminAuditController');
const AdminConfigController = require('../controllers/adminConfigController');
const SupportHRController = require('../controllers/supportHRController');

// Protect all admin routes
router.use(adminAuth);

// Super admin analytics endpoints
router.get('/analytics/overview', requireSuperAdmin, AdminAnalyticsController.overview);
router.get('/analytics/growth', requireSuperAdmin, AdminAnalyticsController.growth);
router.get('/analytics/alerts', requireSuperAdmin, AdminAnalyticsController.alerts);
router.get('/analytics/revenue', requireSuperAdmin, AdminAnalyticsController.revenue);
router.get('/analytics/benchmarks', requireSuperAdmin, AdminAnalyticsController.benchmarks);
router.get('/analytics/compare', requireSuperAdmin, AdminAnalyticsController.compare);
router.get('/analytics/usage', requireSuperAdmin, AdminAnalyticsController.usage);
router.get('/analytics/geographic', requireSuperAdmin, AdminAnalyticsController.geographic);
router.get('/analytics/finance/schools', requireSuperAdmin, AdminAnalyticsController.financeBySchools);
router.get('/analytics/finance/mpesa/overview', requireSuperAdmin, AdminAnalyticsController.mpesaOverview);
router.get('/analytics/finance/mpesa/performance', requireSuperAdmin, AdminAnalyticsController.mpesaPerformance);
router.get('/analytics/finance/mpesa/reconciliation', requireSuperAdmin, AdminAnalyticsController.mpesaReconciliation);
router.get('/analytics/finance/segments', requireSuperAdmin, AdminAnalyticsController.financeSegments);
router.get('/analytics/finance/collections', requireSuperAdmin, AdminAnalyticsController.financeCollections);

// Platform infrastructure monitoring
router.get('/monitoring/infrastructure', requireSuperAdmin, AdminMonitoringController.getInfrastructure);
// Audit trail and logs
router.get('/monitoring/logs', requireSuperAdmin, AdminAuditController.listSystemLogs);
router.get('/monitoring/logs/analysis', requireSuperAdmin, AdminAuditController.analyzeSystemLogs);

// Admin user management (super admin only for create/update)
router.get('/users', hasAnyRole(['super_admin','support_hr']), AdminUserManagementController.listAdminUsers);
router.get('/users/statistics', hasAnyRole(['super_admin','support_hr']), AdminUserManagementController.getAdminStatistics);
router.get('/users/activity-logs', requireSuperAdmin, AdminAuditController.listAdminActivityLogs);
router.post('/users', requireSuperAdmin, AdminUserManagementController.createAdminUser);
router.put('/users/:userId', requireSuperAdmin, AdminUserManagementController.updateAdminUser);
router.post('/users/:userId/suspend', hasAnyRole(['super_admin','support_hr']), AdminUserManagementController.suspendUser);
router.post('/users/:userId/reactivate', hasAnyRole(['super_admin','support_hr']), AdminUserManagementController.reactivateUser);

// Multi-school admin endpoints for school users and schools (super admin and support_hr)
router.get('/multi-school/schools', hasAnyRole(['super_admin','support_hr']), MultiSchoolAdminController.listSchools);
router.get('/multi-school/schools/:id', hasAnyRole(['super_admin','support_hr']), MultiSchoolAdminController.getSchoolById);
router.get('/multi-school/users', hasAnyRole(['super_admin','support_hr']), MultiSchoolAdminController.listUsers);
router.get('/multi-school/schools/:schoolId/users', hasAnyRole(['super_admin','support_hr']), MultiSchoolAdminController.listUsersBySchool);
router.get('/multi-school/oversight/dashboard', requireSuperAdmin, MultiSchoolAdminController.oversightDashboard);

// School user creation (company console)
router.post('/users/school', hasAnyRole(['super_admin','support_hr']), AdminUserManagementController.createSchoolUser);

// Company announcements (super admin only)
router.get('/communication/announcements', requireSuperAdmin, AdminCommunicationController.listAnnouncements);
router.post('/communication/announcements', requireSuperAdmin, AdminCommunicationController.broadcastAnnouncement);
router.put('/communication/announcements/:id', requireSuperAdmin, AdminCommunicationController.updateAnnouncement);
router.delete('/communication/announcements/:id', requireSuperAdmin, AdminCommunicationController.deleteAnnouncement);

// Integration logs
router.get('/integrations/logs', requireSuperAdmin, AdminAuditController.listIntegrationLogs);

// System configuration - maintenance mode (super admin only)
router.get('/config/maintenance', requireSuperAdmin, AdminConfigController.getMaintenanceStatus);
router.get('/config/health', requireSuperAdmin, AdminConfigController.getHealth);
router.get('/config/health/detailed', requireSuperAdmin, AdminConfigController.getDetailedHealth);
router.post('/config/maintenance/enable', requireSuperAdmin, AdminConfigController.enableMaintenance);
router.post('/config/maintenance/disable', requireSuperAdmin, AdminConfigController.disableMaintenance);

// Data backups - list and create
router.get('/migration/backups', requireSuperAdmin, AdminConfigController.listBackups);
router.post('/migration/backups', requireSuperAdmin, AdminConfigController.createBackup);

// ================= Support HR routes =================
// Dashboard analytics
router.get('/support/analytics', hasAnyRole(['super_admin','support_hr']), SupportHRController.analyticsSummary);
router.get('/support/analytics/timeseries', hasAnyRole(['super_admin','support_hr']), SupportHRController.analyticsTimeseries);

// Tickets
router.get('/support/tickets', hasAnyRole(['super_admin','support_hr']), SupportHRController.listTickets);
router.get('/support/tickets/:id', hasAnyRole(['super_admin','support_hr']), SupportHRController.getTicket);
router.patch('/support/tickets/:id', hasAnyRole(['super_admin','support_hr']), SupportHRController.updateTicket);
router.post('/support/tickets/:id/status', hasAnyRole(['super_admin','support_hr']), SupportHRController.updateTicketStatus);
router.post('/support/tickets/:id/messages', hasAnyRole(['super_admin','support_hr']), SupportHRController.addTicketMessage);

// Knowledge Base
router.get('/support/kb', hasAnyRole(['super_admin','support_hr']), SupportHRController.listKB);
router.get('/support/kb/categories', hasAnyRole(['super_admin','support_hr']), SupportHRController.listKBCategories);
router.post('/support/kb', hasAnyRole(['super_admin','support_hr']), SupportHRController.createKBArticle);
router.put('/support/kb/:id', hasAnyRole(['super_admin','support_hr']), SupportHRController.updateKBArticle);
router.delete('/support/kb/:id', hasAnyRole(['super_admin','support_hr']), SupportHRController.deleteKBArticle);

// Training
router.get('/support/training/history', hasAnyRole(['super_admin','support_hr']), SupportHRController.trainingHistory);
router.post('/support/schools/:schoolId/quick-actions/trigger-training', hasAnyRole(['super_admin','support_hr']), SupportHRController.triggerTraining);
router.patch('/support/training/:id/status', hasAnyRole(['super_admin','support_hr']), SupportHRController.updateTrainingStatus);

// Onboarding (registration pipeline)
router.get('/multi-school/onboarding', hasAnyRole(['super_admin','support_hr']), SupportHRController.listOnboarding);
router.patch('/multi-school/onboarding/:id/status', hasAnyRole(['super_admin','support_hr']), SupportHRController.updateOnboardingStatus);
router.post('/multi-school/onboarding/:id/notes', hasAnyRole(['super_admin','support_hr']), SupportHRController.addOnboardingNote);
router.patch('/multi-school/onboarding/bulk-status', hasAnyRole(['super_admin','support_hr']), SupportHRController.bulkUpdateOnboardingStatus);

module.exports = router;


