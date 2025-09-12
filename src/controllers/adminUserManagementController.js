const { query } = require('../config/database');
const userService = require('../services/userService');

/**
 * Admin User Management Controller
 * Manages admin users (super_admin, support_hr, engineer, admin_finance, sales_marketing)
 */
class AdminUserManagementController {
  static async listAdminUsers(req, res, next) {
    try {
      const limit = Math.max(1, Math.min(parseInt(req.query.limit || '50', 10), 1000));
      const offset = Math.max(0, parseInt(req.query.offset || '0', 10));

      const list = await query(
        `SELECT id, email, first_name, last_name, phone, role, activation_status as status,
                two_factor_enabled, last_login as last_login_at, created_at
         FROM users
         WHERE user_type = 'admin_user'
         ORDER BY created_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      );

      res.json({ success: true, data: list.rows });
    } catch (error) {
      next(error);
    }
  }

  static async getAdminStatistics(req, res, next) {
    try {
      const stats = await query(`
        SELECT 
          COUNT(*)::int AS total_admins,
          COUNT(*) FILTER (WHERE activation_status = 'active')::int AS active_admins
        FROM users
        WHERE user_type = 'admin_user'`);

      res.json({ success: true, data: { securityStats: stats.rows[0] } });
    } catch (error) {
      next(error);
    }
  }

  static async createAdminUser(req, res, next) {
    try {
      // Only super admin can create admin users (middleware sets canManageAllUsers)
      if (!req.canManageAllUsers) {
        return res.status(403).json({ success: false, error: { message: 'Only super admin can create admin users' } });
      }

      const {
        email,
        firstName,
        lastName,
        phone,
        role = 'support_hr',
        temporaryPassword,
        twoFactorEnabled = false,
      } = req.body || {};

      const password = temporaryPassword || AdminUserManagementController.#generateTempPassword();

      const created = await userService.createUser({
        email,
        password,
        firstName,
        lastName,
        phone,
        userType: 'admin_user',
        role,
        schoolId: null,
        activationStatus: 'active',
        emailVerified: true,
        profilePictureUrl: null,
      }, req.user.userId);

      // Optionally store 2FA flag if such column exists
      try {
        if (twoFactorEnabled === true) {
          await query(`UPDATE users SET two_factor_enabled = true WHERE id = $1`, [created.id]);
        }
      } catch (_) { /* ignore if column not present */ }

      res.status(201).json({
        success: true,
        data: { user: created, temporaryPassword: temporaryPassword ? undefined : password },
        message: 'Admin user created successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateAdminUser(req, res, next) {
    try {
      if (!req.canManageAllUsers) {
        return res.status(403).json({ success: false, error: { message: 'Only super admin can update admin users' } });
      }

      const { userId } = req.params;
      const { firstName, lastName, phone, role } = req.body || {};

      if (firstName || lastName || phone) {
        await userService.updateUserProfile(userId, { firstName, lastName, phone });
      }

      if (role) {
        await query(`UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2 AND user_type = 'admin_user'`, [role, userId]);
      }

      const updated = await userService.findUserById(userId);
      res.json({ success: true, data: { user: userService.sanitizeUser(updated) } });
    } catch (error) {
      next(error);
    }
  }

  static async suspendUser(req, res, next) {
    try {
      const { userId } = req.params;
      await userService.setUserActivationStatus(userId, 'suspended', req.user.userId);
      res.json({ success: true, message: 'User suspended' });
    } catch (error) {
      next(error);
    }
  }

  static async reactivateUser(req, res, next) {
    try {
      const { userId } = req.params;
      await userService.setUserActivationStatus(userId, 'active', req.user.userId);
      res.json({ success: true, message: 'User reactivated' });
    } catch (error) {
      next(error);
    }
  }

  static #generateTempPassword() {
    // Simple strong password generator (12 chars)
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@$!%*?&';
    let pwd = '';
    for (let i = 0; i < 12; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
    return pwd;
  }
}

module.exports = AdminUserManagementController;


