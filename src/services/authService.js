const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { query } = require('../config/database');
const { AuthenticationError, ValidationError, DatabaseError } = require('../middleware/errorHandler');

class AuthService {
  constructor() {
    this.jwtSecret = process.env.JWT_SECRET;
    this.jwtRefreshSecret = process.env.JWT_REFRESH_SECRET;
    this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '15m';
    this.jwtRefreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
    
    if (!this.jwtSecret || !this.jwtRefreshSecret) {
      throw new Error('JWT secrets are required in environment variables');
    }
  }

  // Generate JWT access and refresh tokens
  generateTokens(user) {
    try {
      const payload = {
        userId: user.id,
        email: user.email,
        role: user.role,
        userType: user.user_type,
        schoolId: user.school_id || null,
        isActive: user.is_active,
        activationStatus: user.activation_status
      };

      const accessToken = jwt.sign(payload, this.jwtSecret, {
        expiresIn: this.jwtExpiresIn,
        issuer: 'edufam-platform',
        audience: user.user_type === 'admin_user' ? 'admin-app' : 'school-app'
      });

      const refreshToken = jwt.sign(
        { userId: user.id, tokenType: 'refresh' },
        this.jwtRefreshSecret,
        {
          expiresIn: this.jwtRefreshExpiresIn,
          issuer: 'edufam-platform'
        }
      );

      return {
        accessToken,
        refreshToken,
        expiresIn: this.jwtExpiresIn,
        tokenType: 'Bearer'
      };
    } catch (error) {
      throw new AuthenticationError('Token generation failed');
    }
  }

  // Verify JWT access token
  verifyAccessToken(token) {
    try {
      const decoded = jwt.verify(token, this.jwtSecret);
      
      // Check if user is active
      if (!decoded.isActive) {
        throw new AuthenticationError('Account is deactivated');
      }
      
      if (decoded.activationStatus !== 'active') {
        throw new AuthenticationError('Account is not activated');
      }
      
      return decoded;
    } catch (error) {
      if (error instanceof AuthenticationError) {
        throw error;
      }
      
      switch (error.name) {
        case 'TokenExpiredError':
          throw new AuthenticationError('Token has expired');
        case 'JsonWebTokenError':
          throw new AuthenticationError('Invalid token');
        case 'NotBeforeError':
          throw new AuthenticationError('Token not active yet');
        default:
          throw new AuthenticationError('Token verification failed');
      }
    }
  }

  // Verify refresh token
  verifyRefreshToken(token) {
    try {
      return jwt.verify(token, this.jwtRefreshSecret);
    } catch (error) {
      switch (error.name) {
        case 'TokenExpiredError':
          throw new AuthenticationError('Refresh token has expired');
        case 'JsonWebTokenError':
          throw new AuthenticationError('Invalid refresh token');
        default:
          throw new AuthenticationError('Refresh token verification failed');
      }
    }
  }

  // Hash password
  async hashPassword(password) {
    try {
      const saltRounds = 12;
      return await bcrypt.hash(password, saltRounds);
    } catch (error) {
      throw new ValidationError('Password hashing failed');
    }
  }

  // Verify password
  async verifyPassword(plainPassword, hashedPassword) {
    try {
      return await bcrypt.compare(plainPassword, hashedPassword);
    } catch (error) {
      throw new AuthenticationError('Password verification failed');
    }
  }

  // Store refresh token in database
  async storeRefreshToken(userId, refreshToken, deviceInfo = {}) {
    try {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now

      const result = await query(`
        INSERT INTO user_sessions (user_id, refresh_token, ip_address, user_agent, device_info, expires_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `, [
        userId,
        refreshToken,
        deviceInfo.ip || null,
        deviceInfo.userAgent || null,
        JSON.stringify(deviceInfo),
        expiresAt
      ]);

      return result.rows[0].id;
    } catch (error) {
      throw new DatabaseError('Failed to store refresh token');
    }
  }

  // Validate refresh token from database
  async validateRefreshToken(refreshToken) {
    try {
      const result = await query(`
        SELECT us.*, u.id as user_id, u.email, u.role, u.user_type, u.school_id, 
               u.is_active, u.activation_status
        FROM user_sessions us
        JOIN users u ON us.user_id = u.id
        WHERE us.refresh_token = $1 
          AND us.is_active = true 
          AND us.expires_at > NOW()
      `, [refreshToken]);

      if (result.rows.length === 0) {
        throw new AuthenticationError('Invalid or expired refresh token');
      }

      return result.rows[0];
    } catch (error) {
      if (error instanceof AuthenticationError) {
        throw error;
      }
      throw new DatabaseError('Failed to validate refresh token');
    }
  }

  // Revoke refresh token
  async revokeRefreshToken(refreshToken) {
    try {
      await query(`
        UPDATE user_sessions 
        SET is_active = false 
        WHERE refresh_token = $1
      `, [refreshToken]);
    } catch (error) {
      throw new DatabaseError('Failed to revoke refresh token');
    }
  }

  // Revoke all user sessions
  async revokeAllUserSessions(userId) {
    try {
      await query(`
        UPDATE user_sessions 
        SET is_active = false 
        WHERE user_id = $1
      `, [userId]);
    } catch (error) {
      throw new DatabaseError('Failed to revoke user sessions');
    }
  }

  // Clean up expired tokens
  async cleanupExpiredTokens() {
    try {
      const result = await query(`
        DELETE FROM user_sessions 
        WHERE expires_at < NOW() OR is_active = false
      `);
      
      console.log(`🧹 Cleaned up ${result.rowCount} expired/inactive sessions`);
      return result.rowCount;
    } catch (error) {
      console.error('Failed to cleanup expired tokens:', error);
      throw new DatabaseError('Failed to cleanup expired tokens');
    }
  }

  // Get user active sessions
  async getUserSessions(userId) {
    try {
      const result = await query(`
        SELECT id, ip_address, user_agent, device_info, created_at, expires_at
        FROM user_sessions
        WHERE user_id = $1 AND is_active = true AND expires_at > NOW()
        ORDER BY created_at DESC
      `, [userId]);

      return result.rows.map(session => ({
        id: session.id,
        ipAddress: session.ip_address,
        userAgent: session.user_agent,
        deviceInfo: session.device_info,
        createdAt: session.created_at,
        expiresAt: session.expires_at,
        isCurrentSession: false // Will be set by calling function
      }));
    } catch (error) {
      throw new DatabaseError('Failed to get user sessions');
    }
  }

  // Generate password reset token
  async generatePasswordResetToken(userId, ipAddress = null) {
    try {
      // Generate secure random token
      const resetToken = jwt.sign(
        { userId, type: 'password_reset' },
        this.jwtSecret,
        { expiresIn: '1h' }
      );

      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 1); // 1 hour from now

      // Store in database
      await query(`
        INSERT INTO password_reset_tokens (user_id, token, expires_at, ip_address)
        VALUES ($1, $2, $3, $4)
      `, [userId, resetToken, expiresAt, ipAddress]);

      return resetToken;
    } catch (error) {
      throw new DatabaseError('Failed to generate password reset token');
    }
  }

  // Validate password reset token
  async validatePasswordResetToken(token) {
    try {
      // Verify JWT token first
      const decoded = jwt.verify(token, this.jwtSecret);
      
      if (decoded.type !== 'password_reset') {
        throw new AuthenticationError('Invalid token type');
      }

      // Check if token exists in database and is not used
      const result = await query(`
        SELECT prt.*, u.email, u.user_type
        FROM password_reset_tokens prt
        JOIN users u ON prt.user_id = u.id
        WHERE prt.token = $1 
          AND prt.used = false 
          AND prt.expires_at > NOW()
      `, [token]);

      if (result.rows.length === 0) {
        throw new AuthenticationError('Invalid or expired reset token');
      }

      return result.rows[0];
    } catch (error) {
      if (error instanceof AuthenticationError) {
        throw error;
      }
      throw new AuthenticationError('Invalid password reset token');
    }
  }

  // Mark password reset token as used
  async markPasswordResetTokenAsUsed(token) {
    try {
      await query(`
        UPDATE password_reset_tokens 
        SET used = true 
        WHERE token = $1
      `, [token]);
    } catch (error) {
      throw new DatabaseError('Failed to mark reset token as used');
    }
  }

  // Clean up expired password reset tokens
  async cleanupExpiredResetTokens() {
    try {
      const result = await query(`
        DELETE FROM password_reset_tokens 
        WHERE expires_at < NOW() OR used = true
      `);
      
      console.log(`🧹 Cleaned up ${result.rowCount} expired/used reset tokens`);
      return result.rowCount;
    } catch (error) {
      console.error('Failed to cleanup expired reset tokens:', error);
      throw new DatabaseError('Failed to cleanup expired reset tokens');
    }
  }

  // Update user last login
  async updateLastLogin(userId) {
    try {
      await query(`
        UPDATE users 
        SET last_login = NOW() 
        WHERE id = $1
      `, [userId]);
    } catch (error) {
      throw new DatabaseError('Failed to update last login');
    }
  }

  // Track failed login attempt
  async trackFailedLogin(userId) {
    try {
      const result = await query(`
        UPDATE users 
        SET failed_login_attempts = failed_login_attempts + 1
        WHERE id = $1
        RETURNING failed_login_attempts
      `, [userId]);

      const failedAttempts = result.rows[0]?.failed_login_attempts || 0;

      // Lock account after 5 failed attempts for 30 minutes
      if (failedAttempts >= 5) {
        const lockUntil = new Date();
        lockUntil.setMinutes(lockUntil.getMinutes() + 30);

        await query(`
          UPDATE users 
          SET locked_until = $1 
          WHERE id = $2
        `, [lockUntil, userId]);

        throw new AuthenticationError('Account locked due to too many failed login attempts');
      }

      return failedAttempts;
    } catch (error) {
      if (error instanceof AuthenticationError) {
        throw error;
      }
      throw new DatabaseError('Failed to track failed login');
    }
  }

  // Reset failed login attempts
  async resetFailedLoginAttempts(userId) {
    try {
      await query(`
        UPDATE users 
        SET failed_login_attempts = 0, locked_until = NULL 
        WHERE id = $1
      `, [userId]);
    } catch (error) {
      throw new DatabaseError('Failed to reset failed login attempts');
    }
  }

  // Check if account is locked
  async isAccountLocked(userId) {
    try {
      const result = await query(`
        SELECT locked_until 
        FROM users 
        WHERE id = $1
      `, [userId]);

      const lockedUntil = result.rows[0]?.locked_until;
      
      if (lockedUntil && new Date(lockedUntil) > new Date()) {
        return true;
      }

      // If lock time has passed, reset the lock
      if (lockedUntil) {
        await this.resetFailedLoginAttempts(userId);
      }

      return false;
    } catch (error) {
      throw new DatabaseError('Failed to check account lock status');
    }
  }

  // Set user context for RLS policies
  async setUserContext(userId, schoolId = null) {
    try {
      await query("SELECT set_config('app.current_user_id', $1, false)", [userId]);
      if (schoolId) {
        await query("SELECT set_config('app.current_school_id', $1, false)", [schoolId]);
      }
    } catch (error) {
      // Non-critical error, continue without throwing
      console.warn('Warning: Failed to set user context for RLS:', error.message);
    }
  }
}

module.exports = new AuthService(); 