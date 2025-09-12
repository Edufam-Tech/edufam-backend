const express = require('express');
const router = express.Router();
const { adminAuth, requireSuperAdmin } = require('../middleware/auth');
const AdminAnalyticsController = require('../controllers/adminAnalyticsController');
const AdminUserManagementController = require('../controllers/adminUserManagementController');
const MultiSchoolAdminController = require('../controllers/multiSchoolAdminController');

// Protect all admin routes
router.use(adminAuth);

// Super admin analytics endpoints
router.get('/analytics/overview', requireSuperAdmin, AdminAnalyticsController.overview);
router.get('/analytics/growth', requireSuperAdmin, AdminAnalyticsController.growth);
router.get('/analytics/alerts', requireSuperAdmin, AdminAnalyticsController.alerts);

// Admin user management (super admin only for create/update)
router.get('/users', requireSuperAdmin, AdminUserManagementController.listAdminUsers);
router.get('/users/statistics', requireSuperAdmin, AdminUserManagementController.getAdminStatistics);
router.post('/users', requireSuperAdmin, AdminUserManagementController.createAdminUser);
router.put('/users/:userId', requireSuperAdmin, AdminUserManagementController.updateAdminUser);
router.post('/users/:userId/suspend', requireSuperAdmin, AdminUserManagementController.suspendUser);
router.post('/users/:userId/reactivate', requireSuperAdmin, AdminUserManagementController.reactivateUser);

// Multi-school admin endpoints for school users and schools (super admin and support_hr)
router.get('/multi-school/schools', requireSuperAdmin, MultiSchoolAdminController.listSchools);
router.get('/multi-school/users', requireSuperAdmin, MultiSchoolAdminController.listUsers);
router.get('/multi-school/schools/:schoolId/users', requireSuperAdmin, MultiSchoolAdminController.listUsersBySchool);

module.exports = router;


