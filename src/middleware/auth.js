// middleware/auth.js - Updated Authentication Middleware with Correct Roles

const jwt = require('jsonwebtoken');
const authService = require('../services/authService');
const { AuthenticationError, AuthorizationError } = require('./errorHandler');
const { query } = require('../config/database');
const { 
  AccessControl, 
  requireDashboardAccess, 
  blockSupportStaffAccess, 
  validateUserRole,
  SCHOOL_DASHBOARD_ROLES,
  SCHOOL_SUPPORT_STAFF_ROLES,
  ADMIN_DASHBOARD_ROLES
} = require('../auth/roleDefinitions');
const tokenBlacklist = require('../utils/tokenBlacklist');

/**
 * CORRECTED AUTHENTICATION MIDDLEWARE
 * 
 * This middleware enforces the correct user role access:
 * - School dashboard users: school_director, principal, teacher, parent, hr, finance
 * - School support staff: driver, cleaner, chef, gardener, watchman, nurse, secretary, lab_technician, librarian (NO API access)
 * - Admin dashboard users: super_admin, engineer, admin_finance, support_hr, sales_marketing
 */

// Extract token from request headers
const extractToken = (req) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return null;
  }
  
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    throw new AuthenticationError('Invalid authorization header format');
  }
  
  return parts[1];
};

// Main authentication middleware
const authenticate = async (req, res, next) => {
  try {
    const token = extractToken(req);
    
    if (!token) {
      throw new AuthenticationError('Access token required');
    }
    
    // Check if token has been revoked/blacklisted
    if (await tokenBlacklist.isBlacklisted(token)) {
      throw new AuthenticationError('Token revoked or invalidated');
    }

    // Verify the token
    const decoded = authService.verifyAccessToken(token);
    
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
      throw new AuthenticationError('Account is deactivated');
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
      console.error('RLS configuration error:', rlsError);
      // Continue without failing auth
    }

    next();
    
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return res.status(401).json({
        success: false,
        error: {
          type: 'AuthenticationError',
          message: error.message
        }
      });
    }
    
    return res.status(401).json({
      success: false,
      error: {
        type: 'AuthenticationError',
        message: 'Invalid or expired token'
      }
    });
  }
};

// Optional authentication for public endpoints
const optionalAuthenticate = async (req, res, next) => {
  try {
    const token = extractToken(req);
    
    if (!token) {
      return next(); // No token provided, continue without authentication
    }
    
    // Try to authenticate if token is provided
    await authenticate(req, res, next);
  } catch (error) {
    // If token is invalid, continue without authentication
    next();
  }
};

// Role-based authorization middleware
const authorize = (allowedRoles = [], options = {}) => {
  return (req, res, next) => {
    const userRole = req.user?.role;
    
    if (!userRole) {
      return res.status(401).json({
        success: false,
        error: {
          type: 'AuthenticationError',
          message: 'User role not found'
        }
      });
    }

    // Check if user role is in allowed roles
    if (allowedRoles.length > 0 && !allowedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        error: {
          type: 'AuthorizationError',
          message: 'Insufficient permissions for this operation',
          requiredRoles: allowedRoles,
          userRole: userRole
        }
      });
    }

    // Additional permission checks
    if (options.requireMultiSchool && !AccessControl.hasMultiSchoolAccess(userRole)) {
      return res.status(403).json({
        success: false,
        error: {
          type: 'AuthorizationError',
          message: 'Multi-school access required for this operation'
        }
      });
    }

    if (options.permissions && options.permissions.length > 0) {
      const applicationType = req.path.startsWith('/api/admin') ? 'admin' : 'school';
      const hasRequiredPermissions = options.permissions.every(permission => 
        AccessControl.hasPermission(userRole, permission, applicationType)
      );
      
      if (!hasRequiredPermissions) {
        return res.status(403).json({
          success: false,
          error: {
            type: 'AuthorizationError',
            message: 'Required permissions not found',
            requiredPermissions: options.permissions
          }
        });
      }
    }

    next();
  };
};

// Compatibility function for existing routes using requireUserType
function requireUserType(allowedTypes) {
  return (req, res, next) => {
    const types = Array.isArray(allowedTypes) ? allowedTypes : [allowedTypes];

    if (req.user && types.includes(req.user.userType)) {
      return next();
    }

    return res.status(403).json({
      success: false,
      error: {
        type: 'AuthorizationError',
        message: `Access denied. Required user types: ${types.join(', ')}`
      }
    });
  };
}

// Specific middleware for school application routes
const schoolAuth = [
  authenticate,
  blockSupportStaffAccess(), // Block support staff from accessing any school APIs
  requireDashboardAccess('school'), // Only allow dashboard users
  // Enforce userType to be school_user for school application routes
  requireUserType('school_user')
];

// Specific middleware for admin application routes  
const adminAuth = [
  authenticate,
  requireDashboardAccess('admin') // Only allow admin dashboard users
];

// Role-specific middleware functions
const requireSchoolDirector = authorize(['school_director']);
const requirePrincipal = authorize(['principal']);
const requireTeacher = authorize(['teacher']);  
const requireParent = authorize(['parent']);
const requireHR = authorize(['hr']);
const requireFinance = authorize(['finance']);

// Admin role-specific middleware
const requireSuperAdmin = authorize(['super_admin']);
const requireEngineer = authorize(['engineer']);
const requireAdminFinance = authorize(['admin_finance']);
const requireSupportHR = authorize(['support_hr']);
const requireSalesMarketing = authorize(['sales_marketing']);

// Multi-role middleware
const requirePrincipalOrTeacher = authorize(['principal', 'teacher']);
const requireHROrPrincipal = authorize(['hr', 'principal']);
const requireFinanceOrDirector = authorize(['finance', 'school_director']);

// Approval permissions
const requireExpenseApproval = authorize(['school_director'], { permissions: ['approve:expenses'] });
const requireRecruitmentApproval = authorize(['school_director'], { permissions: ['approve:recruitment'] });
const requireGradeApproval = authorize(['principal'], { permissions: ['approve:grades'] });
const requireFeeAssignmentApproval = authorize(['school_director'], { permissions: ['approve:fee_assignments'] });

// Multi-school access
const requireMultiSchoolAccess = authorize(['school_director'], { requireMultiSchool: true });

// Custom middleware for specific endpoints
const schoolDirectorOnly = (req, res, next) => {
  if (req.user.role !== 'school_director') {
    return res.status(403).json({
      success: false,
      error: {
        type: 'AuthorizationError',
        message: 'Only School Directors can access this resource'
      }
    });
  }
  next();
};

const parentAccessToOwnChildren = (req, res, next) => {
  if (req.user.role === 'parent') {
    // Add logic to check if parent is accessing their own children's data
    const studentId = req.params.studentId || req.body.studentId;
    if (studentId && !req.user.children?.includes(studentId)) {
      return res.status(403).json({
        success: false,
        error: {
          type: 'AuthorizationError',
          message: 'Parents can only access their own children\'s data'
        }
      });
    }
  }
  next();
};

// Middleware to log access attempts by support staff (for monitoring)
const logSupportStaffAccess = (req, res, next) => {
  if (AccessControl.isSupportStaff(req.user?.role)) {
    console.log(`🚫 Support staff access attempt: ${req.user.role} tried to access ${req.method} ${req.path}`);
    
    // You can also log to database here
    // logSecurityEvent('support_staff_access_attempt', {
    //   userId: req.user.id,
    //   role: req.user.role, 
    //   endpoint: req.path,
    //   method: req.method,
    //   ip: req.ip
    // });
  }
  next();
};

// School context validation (ensure user can access school data)
const validateSchoolAccess = (req, res, next) => {
  const schoolId = req.params.schoolId || req.body.schoolId || req.query.schoolId;
  
  if (!schoolId) {
    return next(); // No school ID provided, continue
  }
  
  // Admin users can access any school
  if (ADMIN_DASHBOARD_ROLES.includes(req.user?.role)) {
    return next();
  }
  
  // School directors with multi-school access can access any school they manage
  if (req.user.role === 'school_director' && AccessControl.hasMultiSchoolAccess(req.user.role)) {
    // TODO: Add logic to check if director manages this school
    return next();
  }
  
  // School users can only access their own school
  if (req.user.schoolId !== schoolId) {
    return res.status(403).json({
      success: false,
      error: {
        type: 'AuthorizationError',
        message: 'Access denied to this school data'
      }
    });
  }
  
  next();
};

// Check maintenance mode bypass (super admin only)
const bypassMaintenance = (req, res, next) => {
  if (req.user && req.user.role === 'super_admin') {
    req.bypassMaintenance = true;
  }
  next();
};

// Rate limiting bypass for admin users
const adminRateLimitBypass = (req, res, next) => {
  if (req.user && ADMIN_DASHBOARD_ROLES.includes(req.user.role)) {
    req.skipRateLimit = true;
  }
  next();
};

// Utility function to check if user has specific role
const hasRole = (role) => {
  return (req, res, next) => {
    if (req.user && req.user.role === role) {
      return next();
    }
    
    return res.status(403).json({
      success: false,
      error: {
        type: 'AuthorizationError',
        message: `Access denied. Required role: ${role}`
      }
    });
  };
};

// Utility function to check if user has any of the specified roles
const hasAnyRole = (roles) => {
  return (req, res, next) => {
    if (req.user && roles.includes(req.user.role)) {
      return next();
    }
    
    return res.status(403).json({
      success: false,
      error: {
        type: 'AuthorizationError',
        message: `Access denied. Required roles: ${roles.join(', ')}`
      }
    });
  };
};

// Compatibility function for existing routes using requireRole
const requireRole = (allowedRoles) => {
  return hasAnyRole(allowedRoles);
};

// (moved above)

// User management middleware (for admin and school director access)
const requireUserManagement = (req, res, next) => {
  const role = req.user?.role;
  const userType = req.user?.userType;
  
  // Super admin can manage all users
  if (role === 'super_admin') {
    req.canManageAllUsers = true;
    return next();
  }
  
  // Support HR can manage school users only
  if (role === 'support_hr' && userType === 'admin_user') {
    req.canManageSchoolUsers = true;
    return next();
  }
  
  // School directors can manage users in their school only
  if (role === 'school_director' && userType === 'school_user') {
    req.canManageOwnSchoolUsers = true;
    return next();
  }
  
  return res.status(403).json({
    success: false,
    error: {
      type: 'AuthorizationError',
      message: 'Insufficient permissions for user management'
    }
  });
};

module.exports = {
  authenticate,
  optionalAuthenticate,
  authorize,
  schoolAuth,
  adminAuth,
  
  // School role middleware
  requireSchoolDirector,
  requirePrincipal,
  requireTeacher,
  requireParent,
  requireHR,
  requireFinance,
  
  // Admin role middleware  
  requireSuperAdmin,
  requireEngineer,
  requireAdminFinance,
  requireSupportHR,
  requireSalesMarketing,
  
  // Multi-role middleware
  requirePrincipalOrTeacher,
  requireHROrPrincipal,
  requireFinanceOrDirector,
  
  // Approval middleware
  requireExpenseApproval,
  requireRecruitmentApproval,
  requireGradeApproval,
  requireFeeAssignmentApproval,
  
  // Special access middleware
  requireMultiSchoolAccess,
  schoolDirectorOnly,
  parentAccessToOwnChildren,
  logSupportStaffAccess,
  validateSchoolAccess,
  bypassMaintenance,
  adminRateLimitBypass,
  
  // Utility middleware
  hasRole,
  hasAnyRole,
  
  // Compatibility exports for existing routes
  requireRole,
  requireUserType,
  requireUserManagement,
  
  // Export role arrays for reference
  SCHOOL_DASHBOARD_ROLES,
  SCHOOL_SUPPORT_STAFF_ROLES,
  ADMIN_DASHBOARD_ROLES
};