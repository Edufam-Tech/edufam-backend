const { query } = require('../config/database');
const authService = require('./authService');
const { 
  AuthenticationError, 
  ValidationError, 
  NotFoundError, 
  ConflictError,
  DatabaseError 
} = require('../middleware/errorHandler');

class UserService {
  // Find user by email for login
  async findUserByEmail(email, userType = null) {
    try {
      let sql = `
        SELECT 
          u.id, u.email, u.password_hash, u.role, u.user_type, u.school_id,
          u.first_name, u.last_name, u.is_active, u.activation_status,
          u.failed_login_attempts, u.locked_until, u.profile_picture_url,
          u.phone, u.last_login,
          s.name AS school_name
        FROM users u
        LEFT JOIN schools s ON u.school_id = s.id
        WHERE u.email = $1
      `;
      
      const params = [email.toLowerCase()];
      
      if (userType) {
        sql += ' AND user_type = $2';
        params.push(userType);
      }
      
      const result = await query(sql, params);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return result.rows[0];
    } catch (error) {
      throw new DatabaseError('Failed to find user');
    }
  }

  // Find user by ID
  async findUserById(userId) {
    try {
      const result = await query(`
        SELECT id, email, role, user_type, school_id, first_name, last_name,
               is_active, activation_status, profile_picture_url, phone,
               created_at, last_login, email_verified
        FROM users 
        WHERE id = $1
      `, [userId]);
      
      if (result.rows.length === 0) {
        throw new NotFoundError('User not found');
      }
      
      return result.rows[0];
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError('Failed to find user');
    }
  }

  // Check if email exists
  async emailExists(email, excludeUserId = null) {
    try {
      let sql = 'SELECT id FROM users WHERE email = $1';
      const params = [email.toLowerCase()];
      
      if (excludeUserId) {
        sql += ' AND id != $2';
        params.push(excludeUserId);
      }
      
      const result = await query(sql, params);
      return result.rows.length > 0;
    } catch (error) {
      throw new DatabaseError('Failed to check email existence');
    }
  }

  // Create new user (for user management)
  async createUser(userData, createdBy) {
    try {
      const {
        email,
        password,
        firstName,
        lastName,
        phone,
        userType,
        role,
        schoolId
      } = userData;
      
      // Check if email already exists
      const emailExists = await this.emailExists(email);
      if (emailExists) {
        throw new ConflictError('Email already exists');
      }
      
      // Hash password
      const passwordHash = await authService.hashPassword(password);
      
      // Insert user
      const result = await query(`
        INSERT INTO users (
          email, password_hash, user_type, role, school_id,
          first_name, last_name, phone, created_by,
          activation_status, password_changed_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
        RETURNING id, email, role, user_type, school_id, 
                  first_name, last_name, created_at
      `, [
        email.toLowerCase(),
        passwordHash,
        userType,
        role,
        schoolId,
        firstName,
        lastName,
        phone || null,
        createdBy,
        'pending' // New users start as pending
      ]);
      
      const newUser = result.rows[0];
      
      // Log user creation
      await this.logUserActivity(newUser.id, 'USER_CREATED', {
        createdBy,
        userType,
        role,
        schoolId
      });
      
      return newUser;
    } catch (error) {
      if (error instanceof ConflictError || error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseError('Failed to create user');
    }
  }

  // Update user profile
  async updateUserProfile(userId, updateData) {
    try {
      const { firstName, lastName, phone } = updateData;
      
      const result = await query(`
        UPDATE users 
        SET first_name = $1, last_name = $2, phone = $3, updated_at = NOW()
        WHERE id = $4
        RETURNING id, email, role, user_type, school_id, 
                  first_name, last_name, phone, profile_picture_url
      `, [firstName, lastName, phone || null, userId]);
      
      if (result.rows.length === 0) {
        throw new NotFoundError('User not found');
      }
      
      // Log profile update
      await this.logUserActivity(userId, 'PROFILE_UPDATED', updateData);
      
      return result.rows[0];
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError('Failed to update user profile');
    }
  }

  // Change user password
  async changePassword(userId, currentPassword, newPassword) {
    try {
      // Get current password hash
      const user = await query(`
        SELECT password_hash FROM users WHERE id = $1
      `, [userId]);
      
      if (user.rows.length === 0) {
        throw new NotFoundError('User not found');
      }
      
      // Verify current password
      const isValidPassword = await authService.verifyPassword(
        currentPassword, 
        user.rows[0].password_hash
      );
      
      if (!isValidPassword) {
        throw new AuthenticationError('Current password is incorrect');
      }
      
      // Hash new password
      const newPasswordHash = await authService.hashPassword(newPassword);
      
      // Update password
      await query(`
        UPDATE users 
        SET password_hash = $1, password_changed_at = NOW(), 
            failed_login_attempts = 0, locked_until = NULL
        WHERE id = $2
      `, [newPasswordHash, userId]);
      
      // Revoke all existing sessions (force re-login)
      await authService.revokeAllUserSessions(userId);
      
      // Log password change
      await this.logUserActivity(userId, 'PASSWORD_CHANGED');
      
      return true;
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof AuthenticationError) {
        throw error;
      }
      throw new DatabaseError('Failed to change password');
    }
  }

  // Reset user password (admin function)
  async resetUserPassword(userId, newPassword, resetBy) {
    try {
      const passwordHash = await authService.hashPassword(newPassword);
      
      await query(`
        UPDATE users 
        SET password_hash = $1, password_changed_at = NOW(),
            failed_login_attempts = 0, locked_until = NULL
        WHERE id = $2
      `, [passwordHash, userId]);
      
      // Revoke all existing sessions
      await authService.revokeAllUserSessions(userId);
      
      // Log password reset
      await this.logUserActivity(userId, 'PASSWORD_RESET_BY_ADMIN', { resetBy });
      
      return true;
    } catch (error) {
      throw new DatabaseError('Failed to reset user password');
    }
  }

  // Activate/deactivate user
  async setUserActivationStatus(userId, activationStatus, updatedBy) {
    try {
      const validStatuses = ['pending', 'active', 'suspended', 'deactivated'];
      
      if (!validStatuses.includes(activationStatus)) {
        throw new ValidationError('Invalid activation status');
      }
      
      await query(`
        UPDATE users 
        SET activation_status = $1, updated_at = NOW()
        WHERE id = $2
      `, [activationStatus, userId]);
      
      // If deactivating, revoke all sessions
      if (activationStatus !== 'active') {
        await authService.revokeAllUserSessions(userId);
      }
      
      // Log activation change
      await this.logUserActivity(userId, 'ACTIVATION_STATUS_CHANGED', {
        newStatus: activationStatus,
        updatedBy
      });
      
      return true;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseError('Failed to update user activation status');
    }
  }

  // Update profile picture
  async updateProfilePicture(userId, profilePictureUrl) {
    try {
      const result = await query(`
        UPDATE users 
        SET profile_picture_url = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING profile_picture_url
      `, [profilePictureUrl, userId]);
      
      if (result.rows.length === 0) {
        throw new NotFoundError('User not found');
      }
      
      // Log profile picture update
      await this.logUserActivity(userId, 'PROFILE_PICTURE_UPDATED');
      
      return result.rows[0].profile_picture_url;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError('Failed to update profile picture');
    }
  }

  // Log user activity to audit logs
  async logUserActivity(userId, action, details = {}, ipAddress = null, userAgent = null) {
    try {
      await query(`
        INSERT INTO audit_logs (user_id, action, table_name, record_id, new_values, ip_address, user_agent)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        userId,
        action,
        'users',
        userId,
        JSON.stringify(details),
        ipAddress,
        userAgent
      ]);
    } catch (error) {
      // Don't throw error for audit logging failures - just log to console
      console.error('Failed to log user activity:', error);
    }
  }

  // Get user statistics (for admin dashboard)
  async getUserStatistics() {
    try {
      const result = await query(`
        SELECT 
          COUNT(*) as total_users,
          COUNT(*) FILTER (WHERE user_type = 'school_user') as school_users,
          COUNT(*) FILTER (WHERE user_type = 'admin_user') as admin_users,
          COUNT(*) FILTER (WHERE activation_status = 'active') as active_users,
          COUNT(*) FILTER (WHERE activation_status = 'pending') as pending_users,
          COUNT(*) FILTER (WHERE activation_status = 'suspended') as suspended_users,
          COUNT(*) FILTER (WHERE last_login > NOW() - INTERVAL '7 days') as active_last_week,
          COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days') as new_users_month
        FROM users
      `);
      
      return result.rows[0];
    } catch (error) {
      throw new DatabaseError('Failed to get user statistics');
    }
  }

  // Sanitize user data for API responses
  sanitizeUser(user) {
    // Map database fields to camelCase API response and drop sensitive fields
    return {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role,
      userType: user.user_type,
      schoolId: user.school_id,
      schoolName: user.school_name || null,
      permissions: user.permissions || [],
      profileImage: user.profile_picture_url || null,
      phoneNumber: user.phone || null,
      isActive: user.is_active,
      lastLogin: user.last_login || null
    };
  }
}

module.exports = new UserService(); 