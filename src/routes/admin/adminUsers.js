const express = require('express');
const router = express.Router();
const { authenticate, requireRole, requireUserType } = require('../../middleware/auth');
const AdminUserController = require('../../controllers/admin/adminUserController');
const userController = require('../../controllers/userController');
const { ValidationError } = require('../../middleware/errorHandler');

// Apply admin authentication to all routes
router.use(authenticate);
router.use(requireUserType('admin_user'));

// =============================================================================
// ADMIN USER MANAGEMENT ROUTES
// =============================================================================

/**
 * @route   GET /api/admin/users
 * @desc    Get all admin users
 * @access  Private (Super Admin)
 */
router.get('/',
  requireRole(['super_admin']),
  AdminUserController.getAdminUsers
);

/**
 * @route   POST /api/admin/users
 * @desc    Create new admin user
 * @access  Private (Super Admin)
 */
router.post('/',
  requireRole(['super_admin']),
  AdminUserController.createAdminUser
);

/**
 * @route   POST /api/admin/users/school
 * @desc    Create a school user (admin-assisted)
 * @access  Private (Super Admin, Support HR, Regional Admin)
 */
router.post('/school',
  requireRole(['super_admin', 'support_hr']),
  async (req, res, next) => {
    try {
      // Force school user type
      req.body = {
        ...req.body,
        userType: 'school_user',
      };
      // Require schoolId for school users
      if (!req.body.schoolId) {
        throw new ValidationError('schoolId is required for school users');
      }
      // Grant user management capability for delegated controller
      req.canManageAllUsers = true;
      return userController.createUser(req, res, next);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/admin/users/statistics
 * @desc    Get admin user statistics
 * @access  Private (Super Admin)
 */
router.get('/statistics',
  requireRole(['super_admin']),
  AdminUserController.getAdminUserStatistics
);

/**
 * @route   GET /api/admin/users/roles-permissions
 * @desc    Get available roles and permissions
 * @access  Private (Platform Admin)
 */
router.get('/roles-permissions',
  requireRole(['super_admin']),
  AdminUserController.getRolesAndPermissions
);

/**
 * @route   GET /api/admin/users/:id
 * @desc    Get admin user details
 * @access  Private (Super Admin)
 */
router.get('/:id',
  requireRole(['super_admin']),
  AdminUserController.getAdminUser
);

/**
 * @route   PUT /api/admin/users/:id
 * @desc    Update admin user
 * @access  Private (Super Admin)
 */
router.put('/:id',
  requireRole(['super_admin']),
  AdminUserController.updateAdminUser
);

/**
 * @route   POST /api/admin/users/:id/suspend
 * @desc    Suspend admin user
 * @access  Private (Super Admin)
 */
router.post('/:id/suspend',
  requireRole(['super_admin']),
  AdminUserController.suspendAdminUser
);

/**
 * @route   POST /api/admin/users/:id/reactivate
 * @desc    Reactivate admin user
 * @access  Private (Super Admin)
 */
router.post('/:id/reactivate',
  requireRole(['super_admin']),
  AdminUserController.reactivateAdminUser
);

// =============================================================================
// PASSWORD MANAGEMENT ROUTES
// =============================================================================

/**
 * @route   POST /api/admin/users/:id/reset-password
 * @desc    Reset admin user password
 * @access  Private (Super Admin)
 */
router.post('/:id/reset-password',
  requireRole(['super_admin']),
  AdminUserController.resetAdminPassword
);

/**
 * @route   POST /api/admin/users/:id/force-password-change
 * @desc    Force password change on next login
 * @access  Private (Super Admin)
 */
router.post('/:id/force-password-change',
  requireRole(['super_admin']),
  AdminUserController.forcePasswordChange
);

// =============================================================================
// TWO-FACTOR AUTHENTICATION ROUTES
// =============================================================================

/**
 * @route   POST /api/admin/users/:id/enable-2fa
 * @desc    Enable two-factor authentication
 * @access  Private (Super Admin)
 */
router.post('/:id/enable-2fa',
  requireRole(['super_admin']),
  AdminUserController.enableTwoFactor
);

/**
 * @route   POST /api/admin/users/:id/disable-2fa
 * @desc    Disable two-factor authentication
 * @access  Private (Super Admin)
 */
router.post('/:id/disable-2fa',
  requireRole(['super_admin']),
  AdminUserController.disableTwoFactor
);

// =============================================================================
// PERMISSION MANAGEMENT ROUTES
// =============================================================================

/**
 * @route   PUT /api/admin/users/:id/permissions
 * @desc    Update admin user permissions
 * @access  Private (Super Admin)
 */
router.put('/:id/permissions',
  requireRole(['super_admin']),
  AdminUserController.updateAdminPermissions
);

// =============================================================================
// ACTIVITY LOGS ROUTES
// =============================================================================

/**
 * @route   GET /api/admin/users/activity-logs
 * @desc    Get admin activity logs
 * @access  Private (Super Admin)
 */
router.get('/activity-logs',
  requireRole(['super_admin']),
  AdminUserController.getAdminActivityLogs
);

/**
 * @route   GET /api/admin/users/:id/activity
 * @desc    Get specific admin user activity
 * @access  Private (Super Admin)
 */
router.get('/:id/activity',
  requireRole(['super_admin']),
  async (req, res, next) => {
    try {
      // Set adminId in query for filtering
      req.query.adminId = req.params.id;
      return AdminUserController.getAdminActivityLogs(req, res, next);
    } catch (error) {
      next(error);
    }
  }
);

// =============================================================================
// BULK OPERATIONS ROUTES
// =============================================================================

/**
 * @route   POST /api/admin/users/bulk/create
 * @desc    Bulk create admin users
 * @access  Private (Super Admin)
 */
router.post('/bulk/create',
  requireRole(['super_admin']),
  async (req, res, next) => {
    try {
      const { users } = req.body;

      if (!users || !Array.isArray(users) || users.length === 0) {
        throw new ValidationError('Users array is required');
      }

      const results = [];
      const errors = [];

      for (let i = 0; i < users.length; i++) {
        try {
          req.body = users[i];
          const mockRes = {
            status: () => mockRes,
            json: (data) => {
              results.push({ index: i, success: true, data: data.data });
            }
          };

          await AdminUserController.createAdminUser(req, mockRes, (error) => {
            if (error) throw error;
          });
        } catch (error) {
          errors.push({ index: i, user: users[i], error: error.message });
        }
      }

      res.json({
        success: true,
        message: `Bulk operation completed. ${results.length} users created, ${errors.length} errors`,
        data: {
          created: results,
          errors: errors,
          summary: {
            total: users.length,
            successful: results.length,
            failed: errors.length
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   POST /api/admin/users/bulk/update
 * @desc    Bulk update admin users
 * @access  Private (Super Admin)
 */
router.post('/bulk/update',
  requireRole(['super_admin']),
  async (req, res, next) => {
    try {
      const { updates } = req.body;

      if (!updates || !Array.isArray(updates) || updates.length === 0) {
        throw new ValidationError('Updates array is required');
      }

      const results = [];
      const errors = [];

      for (let i = 0; i < updates.length; i++) {
        try {
          const { id, ...updateData } = updates[i];
          req.params.id = id;
          req.body = updateData;

          const mockRes = {
            json: (data) => {
              results.push({ index: i, id, success: true, data: data.data });
            }
          };

          await AdminUserController.updateAdminUser(req, mockRes, (error) => {
            if (error) throw error;
          });
        } catch (error) {
          errors.push({ index: i, update: updates[i], error: error.message });
        }
      }

      res.json({
        success: true,
        message: `Bulk update completed. ${results.length} users updated, ${errors.length} errors`,
        data: {
          updated: results,
          errors: errors,
          summary: {
            total: updates.length,
            successful: results.length,
            failed: errors.length
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   POST /api/admin/users/bulk/suspend
 * @desc    Bulk suspend admin users
 * @access  Private (Super Admin)
 */
router.post('/bulk/suspend',
  requireRole(['super_admin']),
  async (req, res, next) => {
    try {
      const { userIds, reason } = req.body;

      if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        throw new ValidationError('User IDs array is required');
      }

      if (!reason) {
        throw new ValidationError('Suspension reason is required');
      }

      const results = [];
      const errors = [];

      for (let i = 0; i < userIds.length; i++) {
        try {
          req.params.id = userIds[i];
          req.body = { reason };

          const mockRes = {
            json: (data) => {
              results.push({ index: i, id: userIds[i], success: true, data: data.data });
            }
          };

          await AdminUserController.suspendAdminUser(req, mockRes, (error) => {
            if (error) throw error;
          });
        } catch (error) {
          errors.push({ index: i, id: userIds[i], error: error.message });
        }
      }

      res.json({
        success: true,
        message: `Bulk suspension completed. ${results.length} users suspended, ${errors.length} errors`,
        data: {
          suspended: results,
          errors: errors,
          summary: {
            total: userIds.length,
            successful: results.length,
            failed: errors.length
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;