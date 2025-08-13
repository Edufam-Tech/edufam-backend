const { query } = require('../../config/database');
const { ValidationError, NotFoundError, ConflictError } = require('../../middleware/errorHandler');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

class AdminUserController {
  // =============================================================================
  // ADMIN USER MANAGEMENT
  // =============================================================================

  // Create admin user
  static async createAdminUser(req, res, next) {
    try {
      const {
        email,
        firstName,
        lastName,
        phone,
        role,
        permissions = [],
        regionsAccess = [],
        temporaryPassword,
        requirePasswordChange = true,
        twoFactorEnabled = false
      } = req.body;

      if (!email || !firstName || !lastName || !role) {
        throw new ValidationError('Email, first name, last name, and role are required');
      }

      // Validate role
      const validRoles = ['super_admin', 'regional_admin', 'support_admin', 'admin_finance', 'compliance_admin'];
      if (!validRoles.includes(role)) {
        throw new ValidationError(`Role must be one of: ${validRoles.join(', ')}`);
      }

      // Check if email already exists
      const existingAdmin = await query(`
        SELECT id FROM platform_admins WHERE email = $1
      `, [email]);

      if (existingAdmin.rows.length > 0) {
        throw new ConflictError('Admin user with this email already exists');
      }

      // Generate password if not provided
      const password = temporaryPassword || AdminUserController.generateTemporaryPassword();
      const hashedPassword = await bcrypt.hash(password, 12);

      // Create admin user
      const result = await query(`
        INSERT INTO platform_admins (
          email, first_name, last_name, phone, role, permissions, regions_access,
          password_hash, two_factor_enabled, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id, email, first_name, last_name, phone, role, permissions, regions_access, 
                  status, two_factor_enabled, created_at
      `, [
        email, firstName, lastName, phone, role, JSON.stringify(permissions),
        JSON.stringify(regionsAccess), hashedPassword, twoFactorEnabled, req.user.userId
      ]);

      // Log admin creation activity
      await query(`
        INSERT INTO admin_activity_logs (
          admin_id, activity_type, target_type, target_id, action_description, ip_address
        ) VALUES ($1, 'admin_creation', 'admin_user', $2, $3, $4)
      `, [
        req.user.userId,
        result.rows[0].id,
        `Created admin user: ${firstName} ${lastName} (${role})`,
        req.ip
      ]);

      res.status(201).json({
        success: true,
        message: 'Admin user created successfully',
        data: {
          ...result.rows[0],
          temporaryPassword: requirePasswordChange ? password : undefined
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Get admin users
  static async getAdminUsers(req, res, next) {
    try {
      const { 
        role, 
        status, 
        regionId,
        search,
        limit = 20, 
        offset = 0 
      } = req.query;

      let whereClause = 'WHERE 1=1';
      const params = [];

      if (role) {
        whereClause += ` AND pa.role = $${params.length + 1}`;
        params.push(role);
      }

      if (status) {
        whereClause += ` AND pa.status = $${params.length + 1}`;
        params.push(status);
      }

      if (regionId) {
        whereClause += ` AND (pa.regions_access IS NOT NULL AND $${params.length + 1} = ANY(pa.regions_access))`;
        params.push(regionId);
      }

      if (search) {
        whereClause += ` AND (pa.first_name ILIKE $${params.length + 1} OR pa.last_name ILIKE $${params.length + 1} OR pa.email ILIKE $${params.length + 1})`;
        params.push(`%${search}%`);
      }

      const result = await query(`
        SELECT 
          pa.id, pa.email, pa.first_name, pa.last_name, pa.phone, pa.role,
          pa.permissions, pa.regions_access, pa.status, pa.last_login_at,
          pa.two_factor_enabled, pa.created_at, pa.updated_at,
          creator.first_name as created_by_first_name,
          creator.last_name as created_by_last_name,
          ARRAY[]::text[] as accessible_regions
        FROM platform_admins pa
        LEFT JOIN platform_admins creator ON pa.created_by = creator.id
        ${whereClause}
        ORDER BY pa.created_at DESC
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

  // Get admin user details
  static async getAdminUser(req, res, next) {
    try {
      const { id } = req.params;

      const [userResult, activityResult, sessionsResult] = await Promise.all([
        // User details
        query(`
          SELECT 
            pa.id, pa.email, pa.first_name, pa.last_name, pa.phone, pa.role,
            pa.permissions, pa.regions_access, pa.status, pa.last_login_at,
            pa.two_factor_enabled, pa.failed_login_attempts, pa.locked_until,
            pa.password_changed_at, pa.created_at, pa.updated_at,
            creator.first_name as created_by_first_name,
            creator.last_name as created_by_last_name,
            ARRAY[]::text[] as accessible_regions
          FROM platform_admins pa
          LEFT JOIN platform_admins creator ON pa.created_by = creator.id
          WHERE pa.id = $1
        `, [id]),

        // Recent activity
        query(`
          SELECT *
          FROM admin_activity_logs
          WHERE admin_id = $1
          ORDER BY created_at DESC
          LIMIT 20
        `, [id]),

        // Active sessions (simulated - in real implementation would check session store)
        query(`
          SELECT 
            COUNT(*) as session_count,
            MAX(logged_at) as last_activity
          FROM platform_usage_logs
          WHERE user_id = $1 AND logged_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
          GROUP BY user_id
        `, [id])
      ]);

      if (userResult.rows.length === 0) {
        throw new NotFoundError('Admin user not found');
      }

      const adminUser = {
        ...userResult.rows[0],
        recentActivity: activityResult.rows,
        sessionInfo: sessionsResult.rows[0] || { session_count: 0, last_activity: null }
      };

      res.json({
        success: true,
        data: adminUser
      });
    } catch (error) {
      next(error);
    }
  }

  // Update admin user
  static async updateAdminUser(req, res, next) {
    try {
      const { id } = req.params;
      const updates = req.body;

      const allowedFields = [
        'first_name', 'last_name', 'phone', 'role', 'permissions', 
        'regions_access', 'status', 'two_factor_enabled'
      ];

      const setClause = [];
      const values = [];
      let paramIndex = 1;

      Object.keys(updates).forEach(key => {
        if (allowedFields.includes(key)) {
          if (['permissions', 'regions_access'].includes(key)) {
            setClause.push(`${key} = $${paramIndex}`);
            values.push(JSON.stringify(updates[key]));
          } else {
            setClause.push(`${key} = $${paramIndex}`);
            values.push(updates[key]);
          }
          paramIndex++;
        }
      });

      if (setClause.length === 0) {
        throw new ValidationError('No valid fields provided for update');
      }

      setClause.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(id);

      const result = await query(`
        UPDATE platform_admins 
        SET ${setClause.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING id, email, first_name, last_name, phone, role, permissions, 
                  regions_access, status, two_factor_enabled, updated_at
      `, values);

      if (result.rows.length === 0) {
        throw new NotFoundError('Admin user not found');
      }

      // Log update activity
      await query(`
        INSERT INTO admin_activity_logs (
          admin_id, activity_type, target_type, target_id, action_description, 
          before_state, after_state, ip_address
        ) VALUES ($1, 'admin_update', 'admin_user', $2, $3, $4, $5, $6)
      `, [
        req.user.userId,
        id,
        `Updated admin user: ${result.rows[0].first_name} ${result.rows[0].last_name}`,
        JSON.stringify({}), // Would contain old values in real implementation
        JSON.stringify(updates),
        req.ip
      ]);

      res.json({
        success: true,
        message: 'Admin user updated successfully',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }

  // Suspend admin user
  static async suspendAdminUser(req, res, next) {
    try {
      const { id } = req.params;
      const { reason, suspensionDuration } = req.body;

      if (!reason) {
        throw new ValidationError('Suspension reason is required');
      }

      const result = await query(`
        UPDATE platform_admins 
        SET status = 'suspended', 
            locked_until = CASE 
              WHEN $1::text IS NOT NULL THEN CURRENT_TIMESTAMP + $1::interval
              ELSE NULL 
            END,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING id, email, first_name, last_name, status, locked_until
      `, [suspensionDuration, id]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Admin user not found');
      }

      // Log suspension activity
      await query(`
        INSERT INTO admin_activity_logs (
          admin_id, activity_type, target_type, target_id, action_description, ip_address
        ) VALUES ($1, 'admin_suspension', 'admin_user', $2, $3, $4)
      `, [
        req.user.userId,
        id,
        `Suspended admin user: ${reason}`,
        req.ip
      ]);

      res.json({
        success: true,
        message: 'Admin user suspended successfully',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }

  // Reactivate admin user
  static async reactivateAdminUser(req, res, next) {
    try {
      const { id } = req.params;
      const { reactivationNotes } = req.body;

      const result = await query(`
        UPDATE platform_admins 
        SET status = 'active', 
            locked_until = NULL,
            failed_login_attempts = 0,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING id, email, first_name, last_name, status
      `, [id]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Admin user not found');
      }

      // Log reactivation activity
      await query(`
        INSERT INTO admin_activity_logs (
          admin_id, activity_type, target_type, target_id, action_description, ip_address
        ) VALUES ($1, 'admin_reactivation', 'admin_user', $2, $3, $4)
      `, [
        req.user.userId,
        id,
        `Reactivated admin user: ${reactivationNotes || 'No notes provided'}`,
        req.ip
      ]);

      res.json({
        success: true,
        message: 'Admin user reactivated successfully',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }

  // =============================================================================
  // PASSWORD MANAGEMENT
  // =============================================================================

  // Reset admin password
  static async resetAdminPassword(req, res, next) {
    try {
      const { id } = req.params;
      const { newPassword, requirePasswordChange = true } = req.body;

      // Generate password if not provided
      const password = newPassword || AdminUserController.generateTemporaryPassword();
      const hashedPassword = await bcrypt.hash(password, 12);

      const result = await query(`
        UPDATE platform_admins 
        SET password_hash = $1,
            password_changed_at = CURRENT_TIMESTAMP,
            failed_login_attempts = 0,
            locked_until = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING id, email, first_name, last_name
      `, [hashedPassword, id]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Admin user not found');
      }

      // Log password reset activity
      await query(`
        INSERT INTO admin_activity_logs (
          admin_id, activity_type, target_type, target_id, action_description, ip_address
        ) VALUES ($1, 'password_reset', 'admin_user', $2, $3, $4)
      `, [
        req.user.userId,
        id,
        `Reset password for admin user: ${result.rows[0].first_name} ${result.rows[0].last_name}`,
        req.ip
      ]);

      res.json({
        success: true,
        message: 'Admin password reset successfully',
        data: {
          ...result.rows[0],
          temporaryPassword: requirePasswordChange ? password : undefined
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Force password change
  static async forcePasswordChange(req, res, next) {
    try {
      const { id } = req.params;

      const result = await query(`
        UPDATE platform_admins 
        SET password_changed_at = '1970-01-01'::timestamp,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING id, email, first_name, last_name
      `, [id]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Admin user not found');
      }

      res.json({
        success: true,
        message: 'Password change forced successfully',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }

  // =============================================================================
  // TWO-FACTOR AUTHENTICATION
  // =============================================================================

  // Enable two-factor authentication
  static async enableTwoFactor(req, res, next) {
    try {
      const { id } = req.params;

      // Generate 2FA secret
      const secret = crypto.randomBytes(32).toString('base64');

      const result = await query(`
        UPDATE platform_admins 
        SET two_factor_enabled = true,
            two_factor_secret = $1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING id, email, first_name, last_name, two_factor_enabled
      `, [secret, id]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Admin user not found');
      }

      // Log 2FA enablement
      await query(`
        INSERT INTO admin_activity_logs (
          admin_id, activity_type, target_type, target_id, action_description, ip_address
        ) VALUES ($1, 'two_factor_enabled', 'admin_user', $2, $3, $4)
      `, [
        req.user.userId,
        id,
        `Enabled 2FA for admin user: ${result.rows[0].first_name} ${result.rows[0].last_name}`,
        req.ip
      ]);

      res.json({
        success: true,
        message: 'Two-factor authentication enabled successfully',
        data: {
          ...result.rows[0],
          qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(secret)}`
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Disable two-factor authentication
  static async disableTwoFactor(req, res, next) {
    try {
      const { id } = req.params;

      const result = await query(`
        UPDATE platform_admins 
        SET two_factor_enabled = false,
            two_factor_secret = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING id, email, first_name, last_name, two_factor_enabled
      `, [id]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Admin user not found');
      }

      res.json({
        success: true,
        message: 'Two-factor authentication disabled successfully',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }

  // =============================================================================
  // ROLE AND PERMISSION MANAGEMENT
  // =============================================================================

  // Get available roles and permissions
  static async getRolesAndPermissions(req, res, next) {
    try {
      const roles = {
        super_admin: {
          name: 'Super Administrator',
          description: 'Full platform access with all permissions',
          permissions: ['*'] // All permissions
        },
        regional_admin: {
          name: 'Regional Administrator',
          description: 'Manage schools and users within assigned regions',
          permissions: [
            'schools.view', 'schools.create', 'schools.update', 'schools.suspend',
            'users.view', 'users.create', 'users.update',
            'subscriptions.view', 'subscriptions.update',
            'analytics.regional', 'onboarding.manage'
          ]
        },
        support_admin: {
          name: 'Support Administrator',
          description: 'Provide technical support and handle user issues',
          permissions: [
            'schools.view', 'users.view', 'tickets.manage',
            'analytics.basic', 'system.monitoring'
          ]
        },
        admin_finance: {
          name: 'Finance Administrator',
          description: 'Manage billing, subscriptions, and financial operations',
          permissions: [
            'subscriptions.view', 'subscriptions.create', 'subscriptions.update',
            'invoicing.manage', 'analytics.financial', 'payments.manage'
          ]
        },
        compliance_admin: {
          name: 'Compliance Administrator',
          description: 'Monitor compliance and audit activities',
          permissions: [
            'compliance.view', 'compliance.audit', 'schools.oversight',
            'analytics.compliance', 'reports.compliance'
          ]
        }
      };

      const permissions = {
        'schools.view': 'View school information',
        'schools.create': 'Create new schools',
        'schools.update': 'Update school information',
        'schools.suspend': 'Suspend/reactivate schools',
        'users.view': 'View user information',
        'users.create': 'Create new users',
        'users.update': 'Update user information',
        'subscriptions.view': 'View subscription information',
        'subscriptions.create': 'Create new subscriptions',
        'subscriptions.update': 'Update subscription information',
        'analytics.basic': 'View basic analytics',
        'analytics.regional': 'View regional analytics',
        'analytics.financial': 'View financial analytics',
        'analytics.compliance': 'View compliance analytics',
        'system.monitoring': 'Access system monitoring',
        'onboarding.manage': 'Manage school onboarding',
        'tickets.manage': 'Manage support tickets',
        'compliance.view': 'View compliance information',
        'compliance.audit': 'Perform compliance audits',
        'invoicing.manage': 'Manage invoicing',
        'payments.manage': 'Manage payments'
      };

      res.json({
        success: true,
        data: {
          roles,
          permissions
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Update admin permissions
  static async updateAdminPermissions(req, res, next) {
    try {
      const { id } = req.params;
      const { permissions, regionsAccess } = req.body;

      if (!permissions) {
        throw new ValidationError('Permissions array is required');
      }

      const result = await query(`
        UPDATE platform_admins 
        SET permissions = $1,
            regions_access = $2,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
        RETURNING id, email, first_name, last_name, role, permissions, regions_access
      `, [JSON.stringify(permissions), JSON.stringify(regionsAccess || []), id]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Admin user not found');
      }

      // Log permission update
      await query(`
        INSERT INTO admin_activity_logs (
          admin_id, activity_type, target_type, target_id, action_description, ip_address
        ) VALUES ($1, 'permissions_updated', 'admin_user', $2, $3, $4)
      `, [
        req.user.userId,
        id,
        `Updated permissions for admin user: ${result.rows[0].first_name} ${result.rows[0].last_name}`,
        req.ip
      ]);

      res.json({
        success: true,
        message: 'Admin permissions updated successfully',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }

  // =============================================================================
  // ADMIN ACTIVITY LOGS
  // =============================================================================

  // Get admin activity logs
  static async getAdminActivityLogs(req, res, next) {
    try {
      const { 
        adminId, 
        activityType, 
        startDate, 
        endDate,
        limit = 50, 
        offset = 0 
      } = req.query;

      let whereClause = 'WHERE 1=1';
      const params = [];

      if (adminId) {
        whereClause += ` AND aal.admin_id = $${params.length + 1}`;
        params.push(adminId);
      }

      if (activityType) {
        whereClause += ` AND aal.activity_type = $${params.length + 1}`;
        params.push(activityType);
      }

      if (startDate) {
        whereClause += ` AND aal.created_at >= $${params.length + 1}`;
        params.push(startDate);
      }

      if (endDate) {
        whereClause += ` AND aal.created_at <= $${params.length + 1}`;
        params.push(endDate);
      }

      const result = await query(`
        SELECT 
          aal.*,
          pa.first_name as admin_first_name,
          pa.last_name as admin_last_name,
          pa.email as admin_email
        FROM admin_activity_logs aal
        JOIN platform_admins pa ON aal.admin_id = pa.id
        ${whereClause}
        ORDER BY aal.created_at DESC
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

  // =============================================================================
  // HELPER METHODS
  // =============================================================================

  // Generate temporary password
  static generateTemporaryPassword() {
    const length = 12;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    
    return password;
  }

  // Get admin user statistics
  static async getAdminUserStatistics(req, res, next) {
    try {
      const [roleDistribution, activityStats, securityStats] = await Promise.all([
        // Role distribution
        query(`
          SELECT 
            role,
            COUNT(*) as count,
            COUNT(CASE WHEN status = 'active' THEN 1 END) as active_count
          FROM platform_admins
          GROUP BY role
          ORDER BY count DESC
        `),

        // Activity statistics
        query(`
          SELECT 
            activity_type,
            COUNT(*) as activity_count,
            COUNT(DISTINCT admin_id) as unique_admins
          FROM admin_activity_logs
          WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
          GROUP BY activity_type
          ORDER BY activity_count DESC
        `),

        // Security statistics
        query(`
          SELECT 
            COUNT(*) as total_admins,
            COUNT(CASE WHEN status = 'active' THEN 1 END) as active_admins,
            COUNT(CASE WHEN two_factor_enabled = true THEN 1 END) as two_factor_enabled_count,
            COUNT(CASE WHEN locked_until > CURRENT_TIMESTAMP THEN 1 END) as locked_accounts,
            COUNT(CASE WHEN password_changed_at < CURRENT_DATE - INTERVAL '90 days' THEN 1 END) as password_expired_count
          FROM platform_admins
        `)
      ]);

      res.json({
        success: true,
        data: {
          roleDistribution: roleDistribution.rows,
          activityStats: activityStats.rows,
          securityStats: securityStats.rows[0]
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = AdminUserController;