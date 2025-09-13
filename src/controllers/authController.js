const authService = require('../services/authService');
const userService = require('../services/userService');
const { asyncHandler } = require('../middleware/errorHandler');
const { 
  AuthenticationError, 
  ValidationError, 
  NotFoundError,
  DatabaseError 
} = require('../middleware/errorHandler');

class AuthController {
  // User login
  login = asyncHandler(async (req, res) => {
    const { email, password, userType } = req.body;
    const normalizedEmail = (email || '').toLowerCase().trim();
    const ipAddress = req.ip;
    const userAgent = req.get('User-Agent');

    // If userType is not provided, try to find user by email only
    let user;
    if (userType) {
      user = await userService.findUserByEmail(normalizedEmail, userType);
      // Fallback: if not found with specified type, try without type filter
      if (!user) {
        user = await userService.findUserByEmail(normalizedEmail);
      }
    } else {
      // Try to find user by email regardless of type
      user = await userService.findUserByEmail(normalizedEmail);
    }
    
    if (!user) {
      // For non-existent users, we don't need to track failed login attempts
      // Just return authentication error immediately
      throw new AuthenticationError('Invalid email or password');
    }

    // Set RLS context early for this user (needed for failed login tracking)
    await authService.setUserContext(user.id, user.school_id);

    // Check if account is locked
    const isLocked = await authService.isAccountLocked(user.id);
    if (isLocked) {
      throw new AuthenticationError('Account is temporarily locked due to too many failed login attempts');
    }

    // Check if user is active
    if (!user.is_active) {
      throw new AuthenticationError('Account is deactivated');
    }

    if (user.activation_status !== 'active') {
      throw new AuthenticationError('Account is not activated. Please contact administrator.');
    }

    // Verify password
    const isValidPassword = await authService.verifyPassword(password, user.password_hash);
    
    if (!isValidPassword) {
      // Track failed login attempt
      await authService.trackFailedLogin(user.id);
      throw new AuthenticationError('Invalid email or password');
    }

    // Reset failed login attempts on successful login
    await authService.resetFailedLoginAttempts(user.id);

    // Allow admin users (admin application) and school users (school application + mobile)
    if (!['school_user', 'admin_user'].includes(user.user_type)) {
      throw new AuthenticationError('Account type not allowed');
    }

    // Enforce stricter role restriction for mobile client
    // Only allow: school_director, principal, teacher, parent
    const clientHeader = (req.get('X-Edufam-Client') || '').toLowerCase();
    if (clientHeader === 'mobile') {
      const allowedMobileRoles = new Set(['school_director', 'principal', 'teacher', 'parent']);
      if (!allowedMobileRoles.has(user.role)) {
        throw new AuthenticationError('Only directors, principals, teachers, and parents can log in on mobile');
      }
    }

    // Generate JWT tokens
    const tokens = authService.generateTokens(user);

    // RLS context already set earlier in the flow

    // Store refresh token in database (hashed for security)
    const deviceInfo = {
      ip: ipAddress,
      userAgent: userAgent,
      loginTime: new Date().toISOString()
    };
    
    await authService.storeRefreshToken(user.id, tokens.refreshToken, deviceInfo);

    // Update last login
    await authService.updateLastLogin(user.id);

    // Log successful login
    await userService.logUserActivity(
      user.id, 
      'LOGIN_SUCCESS', 
      { userType }, 
      ipAddress, 
      userAgent
    );

    // Sanitize user data for response
    const sanitizedUser = userService.sanitizeUser(user);

    res.json({
      success: true,
      data: {
        user: sanitizedUser,
        tokens: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresIn: tokens.expiresIn,
          tokenType: tokens.tokenType
        }
      },
      message: 'Login successful'
    });
  });

  // Refresh access token
  refreshToken = asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      throw new ValidationError('Refresh token is required');
    }

    // Verify refresh token
    const decoded = authService.verifyRefreshToken(refreshToken);

    // Validate refresh token in database
    const session = await authService.validateRefreshToken(refreshToken);

    // Check if user is still active
    if (!session.is_active || session.activation_status !== 'active') {
      // Revoke the refresh token
      await authService.revokeRefreshToken(refreshToken);
      throw new AuthenticationError('Account is no longer active');
    }

    // Generate new tokens
    const user = {
      id: session.user_id,
      email: session.email,
      role: session.role,
      user_type: session.user_type,
      school_id: session.school_id,
      is_active: session.is_active,
      activation_status: session.activation_status
    };

    const newTokens = authService.generateTokens(user);

    // Revoke old refresh token
    await authService.revokeRefreshToken(refreshToken);

    // Store new refresh token
    const deviceInfo = {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      refreshTime: new Date().toISOString()
    };
    
    await authService.storeRefreshToken(user.id, newTokens.refreshToken, deviceInfo);

    // Log token refresh
    await userService.logUserActivity(
      user.id,
      'TOKEN_REFRESHED',
      {},
      req.ip,
      req.get('User-Agent')
    );

    res.json({
      success: true,
      data: {
        tokens: {
          accessToken: newTokens.accessToken,
          refreshToken: newTokens.refreshToken,
          expiresIn: newTokens.expiresIn,
          tokenType: newTokens.tokenType
        }
      },
      message: 'Token refreshed successfully'
    });
  });

  // User logout
  logout = asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;
    const userId = req.user?.userId;

    if (refreshToken) {
      // Revoke specific refresh token
      await authService.revokeRefreshToken(refreshToken);
    } else if (userId) {
      // If no refresh token provided but user is authenticated, revoke all sessions
      await authService.revokeAllUserSessions(userId);
    }

    // Log logout
    if (userId) {
      await userService.logUserActivity(
        userId,
        'LOGOUT',
        { method: refreshToken ? 'single_session' : 'all_sessions' },
        req.ip,
        req.get('User-Agent')
      );
    }

    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  });

  // Logout from all devices
  logoutAll = asyncHandler(async (req, res) => {
    const userId = req.user.userId;

    // Revoke all user sessions
    await authService.revokeAllUserSessions(userId);

    // Log logout all
    await userService.logUserActivity(
      userId,
      'LOGOUT_ALL_DEVICES',
      {},
      req.ip,
      req.get('User-Agent')
    );

    res.json({
      success: true,
      message: 'Logged out from all devices successfully'
    });
  });

  // Request password reset
  forgotPassword = asyncHandler(async (req, res) => {
    const { email, userType } = req.body;
    const ipAddress = req.ip;

    // Find user by email
    const user = await userService.findUserByEmail(email, userType);
    
    // Always return success to prevent email enumeration
    const successResponse = {
      success: true,
      message: 'If an account with this email exists, a password reset link has been sent.'
    };

    if (!user) {
      // Log failed password reset attempt
      await userService.logUserActivity(
        null,
        'PASSWORD_RESET_FAILED',
        { email, reason: 'user_not_found' },
        ipAddress,
        req.get('User-Agent')
      );
      
      return res.json(successResponse);
    }

    // Check if user is active
    if (!user.is_active || user.activation_status !== 'active') {
      // Log failed password reset attempt
      await userService.logUserActivity(
        user.id,
        'PASSWORD_RESET_FAILED',
        { email, reason: 'account_inactive' },
        ipAddress,
        req.get('User-Agent')
      );
      
      return res.json(successResponse);
    }

    try {
      // Generate password reset token
      const resetToken = await authService.generatePasswordResetToken(user.id, ipAddress);

      // TODO: Send email with reset link (will be implemented in future)
      // For now, we'll just log the token (REMOVE IN PRODUCTION)
      console.log(`🔑 Password reset token for ${email}: ${resetToken}`);

      // Log password reset request
      await userService.logUserActivity(
        user.id,
        'PASSWORD_RESET_REQUESTED',
        { email },
        ipAddress,
        req.get('User-Agent')
      );

      res.json(successResponse);
    } catch (error) {
      // Log failed password reset
      await userService.logUserActivity(
        user.id,
        'PASSWORD_RESET_FAILED',
        { email, error: error.message },
        ipAddress,
        req.get('User-Agent')
      );
      
      throw error;
    }
  });

  // Reset password with token
  resetPassword = asyncHandler(async (req, res) => {
    const { token, newPassword } = req.body;
    const ipAddress = req.ip;

    if (!token || !newPassword) {
      throw new ValidationError('Reset token and new password are required');
    }

    // Validate reset token
    const resetData = await authService.validatePasswordResetToken(token);

    // Hash new password
    const passwordHash = await authService.hashPassword(newPassword);

    // Update user password
    await userService.resetUserPassword(resetData.user_id, newPassword, 'self');

    // Mark reset token as used
    await authService.markPasswordResetTokenAsUsed(token);

    // Log password reset success
    await userService.logUserActivity(
      resetData.user_id,
      'PASSWORD_RESET_COMPLETED',
      {},
      ipAddress,
      req.get('User-Agent')
    );

    res.json({
      success: true,
      message: 'Password reset successfully. Please login with your new password.'
    });
  });

  // Verify reset token (for frontend validation)
  verifyResetToken = asyncHandler(async (req, res) => {
    const { token } = req.params;

    try {
      const resetData = await authService.validatePasswordResetToken(token);
      
      res.json({
        success: true,
        data: {
          valid: true,
          email: resetData.email,
          userType: resetData.user_type
        },
        message: 'Reset token is valid'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        data: {
          valid: false
        },
        error: {
          code: 'INVALID_RESET_TOKEN',
          message: 'Reset token is invalid or expired'
        }
      });
    }
  });

  // Get current user info
  me = asyncHandler(async (req, res) => {
    const userId = req.user.userId;

    // Get current user data
    const user = await userService.findUserById(userId);

    // Get user's active sessions
    const sessions = await authService.getUserSessions(userId);

    res.json({
      success: true,
      data: {
        user: userService.sanitizeUser(user),
        sessions: sessions.map(session => ({
          id: session.id,
          ipAddress: session.ipAddress,
          userAgent: session.userAgent,
          createdAt: session.createdAt,
          expiresAt: session.expiresAt
        }))
      }
    });
  });

  // Terminate specific session
  terminateSession = asyncHandler(async (req, res) => {
    const { sessionId } = req.params;
    const userId = req.user.userId;

    // Get session to verify it belongs to the user
    const sessions = await authService.getUserSessions(userId);
    const session = sessions.find(s => s.id === sessionId);

    if (!session) {
      throw new NotFoundError('Session not found');
    }

    // Revoke the session (we'll need to implement this method)
    // For now, we'll revoke by session ID
    await authService.revokeRefreshToken(sessionId);

    // Log session termination
    await userService.logUserActivity(
      userId,
      'SESSION_TERMINATED',
      { sessionId },
      req.ip,
      req.get('User-Agent')
    );

    res.json({
      success: true,
      message: 'Session terminated successfully'
    });
  });

  // Get authentication statistics (admin only)
  getAuthStats = asyncHandler(async (req, res) => {
    // This endpoint will be protected by admin middleware
    const stats = await userService.getUserStatistics();

    res.json({
      success: true,
      data: stats
    });
  });

  // Validate session (for frontend to check if user is still authenticated)
  validateSession = asyncHandler(async (req, res) => {
    // If this endpoint is reached, the authenticate middleware has already validated the token
    res.json({
      success: true,
      data: {
        valid: true,
        user: {
          userId: req.user.userId,
          email: req.user.email,
          role: req.user.role,
          userType: req.user.userType,
          schoolId: req.user.schoolId
        }
      },
      message: 'Session is valid'
    });
  });
}

module.exports = new AuthController(); 