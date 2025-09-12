const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const { AuthenticationError } = require('./errorHandler');

/**
 * JWT Authentication Middleware
 * 
 * This middleware provides stateless JWT authentication for the Edufam platform.
 * It extracts and validates JWT tokens from the Authorization header and sets
 * user information on the request object.
 */

// Extract token from Authorization header
const extractToken = (req) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return null;
  }
  
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    throw new AuthenticationError('Invalid authorization header format. Expected: Bearer <token>');
  }
  
  return parts[1];
};

// Main JWT authentication middleware
const authenticateJWT = async (req, res, next) => {
  try {
    const token = extractToken(req);
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'MISSING_TOKEN',
          message: 'Access token required. Please provide Authorization: Bearer <token> header.'
        }
      });
    }

    // Verify JWT token
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('❌ JWT_SECRET environment variable is not set');
      return res.status(500).json({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: 'Server configuration error'
        }
      });
    }

    const decoded = jwt.verify(token, jwtSecret);
    
    // Validate token structure
    if (!decoded.userId || !decoded.email || !decoded.role) {
      throw new AuthenticationError('Invalid token structure');
    }

    // Check if user still exists and is active
    const userResult = await query(`
      SELECT id, email, role, user_type, school_id, is_active, activation_status,
             first_name, last_name, profile_picture_url, locked_until
      FROM users 
      WHERE id = $1
    `, [decoded.userId]);
    
    if (userResult.rows.length === 0) {
      throw new AuthenticationError('User not found');
    }
    
    const user = userResult.rows[0];
    
    // Verify user is still active
    if (!user.is_active || user.activation_status !== 'active') {
      throw new AuthenticationError('Account is deactivated or not activated');
    }
    
    // Check if account is locked
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      throw new AuthenticationError('Account is temporarily locked');
    }
    
    // Add user info to request (expose both camelCase and snake_case for compatibility)
    req.user = {
      // IDs
      id: user.id,
      userId: user.id,
      // School context
      school_id: user.school_id,
      schoolId: user.school_id,
      // Identity
      email: user.email,
      role: user.role,
      userType: user.user_type,
      firstName: user.first_name,
      lastName: user.last_name,
      profilePictureUrl: user.profile_picture_url,
      // Status
      isActive: user.is_active,
      activationStatus: user.activation_status
    };
    
    // Set user context for RLS (non-fatal on failure)
    try {
      if (user.school_id) {
        await query("SELECT set_config('app.current_school_id', $1, false)", [user.school_id]);
      }
      await query("SELECT set_config('app.current_user_id', $1, false)", [user.id]);
    } catch (rlsError) {
      console.warn('⚠️ RLS configuration error:', rlsError.message);
      // Continue without failing auth
    }

    next();
    
  } catch (error) {
    console.error('JWT Authentication error:', error.message);
    
    if (error instanceof AuthenticationError) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_ERROR',
          message: error.message
        }
      });
    }
    
    // Handle JWT-specific errors
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'Access token has expired. Please refresh your token.'
        }
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid access token'
        }
      });
    }
    
    if (error.name === 'NotBeforeError') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'TOKEN_NOT_ACTIVE',
          message: 'Token is not active yet'
        }
      });
    }
    
    // Generic authentication error
    return res.status(401).json({
      success: false,
      error: {
        code: 'AUTHENTICATION_ERROR',
        message: 'Authentication failed'
      }
    });
  }
};

// Optional JWT authentication (doesn't fail if no token provided)
const optionalAuthenticateJWT = async (req, res, next) => {
  try {
    const token = extractToken(req);
    
    if (!token) {
      return next(); // No token provided, continue without authentication
    }
    
    // Try to authenticate if token is provided
    await authenticateJWT(req, res, next);
  } catch (error) {
    // If token is invalid, continue without authentication
    console.warn('Optional JWT authentication failed:', error.message);
    next();
  }
};

// Middleware to check if user has specific role
const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication required'
        }
      });
    }

    const userRole = req.user.role;
    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

    if (!roles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Insufficient permissions for this operation',
          requiredRoles: roles,
          userRole: userRole
        }
      });
    }

    next();
  };
};

// Middleware to check if user has specific user type
const requireUserType = (allowedTypes) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication required'
        }
      });
    }

    const userType = req.user.userType;
    const types = Array.isArray(allowedTypes) ? allowedTypes : [allowedTypes];

    if (!types.includes(userType)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Insufficient permissions for this operation',
          requiredTypes: types,
          userType: userType
        }
      });
    }

    next();
  };
};

// Middleware to check if user can access specific school
const requireSchoolAccess = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication required'
      }
    });
  }

  const schoolId = req.params.schoolId || req.body.schoolId || req.query.schoolId;
  
  if (!schoolId) {
    return next(); // No school ID provided, continue
  }
  
  // Admin users can access any school
  if (['super_admin', 'engineer', 'admin_finance', 'support_hr', 'sales_marketing'].includes(req.user.role)) {
    return next();
  }
  
  // School users can only access their own school
  if (req.user.schoolId !== schoolId) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'SCHOOL_ACCESS_DENIED',
        message: 'Access denied to this school data'
      }
    });
  }
  
  next();
};

module.exports = {
  authenticateJWT,
  optionalAuthenticateJWT,
  requireRole,
  requireUserType,
  requireSchoolAccess,
  extractToken
};
