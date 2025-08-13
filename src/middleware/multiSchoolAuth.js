const multiSchoolDirectorService = require('../services/multiSchoolDirectorService');
const { AuthorizationError, DatabaseError } = require('./errorHandler');

/**
 * Enhanced Multi-Tenancy Middleware for Multi-School Directors
 * Handles school context switching and cross-school access control
 */

/**
 * Advanced Multi-Tenant Middleware
 * Supports both single-school users and multi-school directors
 */
const advancedMultiTenantMiddleware = async (req, res, next) => {
  try {
    const user = req.user;
    if (!user) {
      return next();
    }

    const requestedSchoolId = req.headers['x-school-id'] || 
                             req.body.school_id || 
                             req.query.school_id ||
                             req.params.schoolId;

    // For Multi-School Directors: Allow school context switching
    if (user.role === 'school_director' || user.role === 'super_admin' || user.role === 'edufam_admin') {
      
      // Check if user is a multi-school director
      const isMultiSchoolDirector = await multiSchoolDirectorService.validateDirectorAccess(
        user.userId, 
        requestedSchoolId || user.schoolId
      );

      if (isMultiSchoolDirector || user.role === 'super_admin' || user.role === 'edufam_admin') {
        // For multi-school users, validate access to requested school
        if (requestedSchoolId) {
          const hasAccess = await multiSchoolDirectorService.validateDirectorAccess(
            user.userId, 
            requestedSchoolId
          );
          
          if (!hasAccess && user.role !== 'super_admin' && user.role !== 'edufam_admin') {
            await logSecurityIncident('unauthorized_school_access_attempt', {
              user_id: user.userId,
              attempted_school: requestedSchoolId,
              user_school: user.schoolId,
              ip_address: req.ip,
              user_agent: req.get('User-Agent')
            });
            
            return res.status(403).json({
              success: false,
              error: {
                code: 'SCHOOL_ACCESS_DENIED',
                message: 'Access denied to requested school context'
              }
            });
          }
          
          req.activeSchoolId = requestedSchoolId;
        } else {
          // No specific school requested, use current context or default
          const currentContext = await multiSchoolDirectorService.getCurrentContext(user.userId);
          req.activeSchoolId = currentContext?.active_school_id || user.schoolId;
        }
        
        req.isMultiSchoolUser = true;
        req.directorAccessLevel = 'full'; // This could be determined from director_school_access
        
      } else {
        // Single-school director
        req.activeSchoolId = user.schoolId;
        req.isMultiSchoolUser = false;
        
        // Prevent cross-school data access for single-school users
        if (requestedSchoolId && requestedSchoolId !== user.schoolId) {
          await logSecurityIncident('cross_tenant_access_attempt', {
            user_id: user.userId,
            attempted_school: requestedSchoolId,
            actual_school: user.schoolId,
            ip_address: req.ip,
            user_agent: req.get('User-Agent')
          });
          
          return res.status(403).json({
            success: false,
            error: {
              code: 'CROSS_TENANT_ACCESS_DENIED',
              message: 'Cross-school access not permitted'
            }
          });
        }
      }
    } else {
      // For all other users: Strict single-school isolation
      req.activeSchoolId = user.schoolId;
      req.isMultiSchoolUser = false;
      
      // Prevent cross-school data access
      if (requestedSchoolId && requestedSchoolId !== user.schoolId) {
        await logSecurityIncident('cross_tenant_access_attempt', {
          user_id: user.userId,
          attempted_school: requestedSchoolId,
          actual_school: user.schoolId,
          ip_address: req.ip,
          user_agent: req.get('User-Agent')
        });
        
        return res.status(403).json({
          success: false,
          error: {
            code: 'CROSS_TENANT_ACCESS_DENIED',
            message: 'Cross-school access not permitted'
          }
        });
      }
    }

    // Set database session variables for RLS (non-fatal)
    try {
      await (req.db?.query?.("SELECT set_config('app.current_school_id', $1, false)", [req.activeSchoolId]) ||
        require('../config/database').query("SELECT set_config('app.current_school_id', $1, false)", [req.activeSchoolId]));
      await (req.db?.query?.("SELECT set_config('app.current_user_id', $1, false)", [user.userId]) ||
        require('../config/database').query("SELECT set_config('app.current_user_id', $1, false)", [user.userId]));
    } catch (rlsError) {
      console.warn('RLS configuration error (multi-tenant):', rlsError.message);
    }

    // Add tenant context for logging and audit
    req.tenantContext = {
      schoolId: req.activeSchoolId,
      userId: user.userId,
      userRole: user.role,
      isMultiSchoolAccess: req.isMultiSchoolUser,
      accessLevel: req.directorAccessLevel || 'single_school',
      requestedSchoolId: requestedSchoolId,
      timestamp: new Date().toISOString()
    };

    // Add helper methods to request object
    req.hasSchoolAccess = (schoolId) => {
      if (req.isMultiSchoolUser) {
        return multiSchoolDirectorService.validateDirectorAccess(user.userId, schoolId);
      }
      return schoolId === user.schoolId;
    };

    req.requireSchoolAccess = (schoolId, accessLevel = 'read_only') => {
      if (!req.isMultiSchoolUser && schoolId !== user.schoolId) {
        throw new AuthorizationError('Access denied to requested school');
      }
      if (req.isMultiSchoolUser) {
        return multiSchoolDirectorService.validateDirectorAccess(user.userId, schoolId, accessLevel);
      }
      return true;
    };

    next();
  } catch (error) {
    console.error('Multi-tenant middleware error:', error);
    next(new DatabaseError('Failed to validate school access'));
  }
};

/**
 * Middleware to require multi-school director privileges
 */
const requireMultiSchoolDirector = async (req, res, next) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication required'
        }
      });
    }

    // Check if user has director role
    if (!['school_director', 'super_admin', 'edufam_admin'].includes(user.role)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'DIRECTOR_ACCESS_REQUIRED',
          message: 'Director privileges required'
        }
      });
    }

    // For school directors, verify they have multi-school access
    if (user.role === 'school_director') {
      const schools = await multiSchoolDirectorService.getDirectorSchools(user.userId);
      if (schools.length <= 1) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'MULTI_SCHOOL_ACCESS_REQUIRED',
            message: 'Multi-school director privileges required'
          }
        });
      }
    }

    req.isMultiSchoolDirector = true;
    next();
  } catch (error) {
    console.error('Multi-school director middleware error:', error);
    next(new DatabaseError('Failed to validate director privileges'));
  }
};

/**
 * Middleware to validate access to specific school
 */
const validateSchoolAccess = (requiredAccessLevel = 'read_only') => {
  return async (req, res, next) => {
    try {
      const user = req.user;
      const schoolId = req.params.schoolId || req.body.school_id || req.query.school_id;
      
      if (!schoolId) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'SCHOOL_ID_REQUIRED',
            message: 'School ID is required'
          }
        });
      }

      // Super admins have access to all schools
      if (user.role === 'super_admin' || user.role === 'edufam_admin') {
        return next();
      }

      // Check access for directors
      if (user.role === 'school_director') {
        const hasAccess = await multiSchoolDirectorService.validateDirectorAccess(
          user.userId,
          schoolId,
          requiredAccessLevel
        );
        
        if (!hasAccess) {
          return res.status(403).json({
            success: false,
            error: {
              code: 'INSUFFICIENT_SCHOOL_ACCESS',
              message: `Insufficient access level (${requiredAccessLevel}) for requested school`
            }
          });
        }
        return next();
      }

      // For other users, check single-school access
      if (schoolId !== user.schoolId) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'SCHOOL_ACCESS_DENIED',
            message: 'Access denied to requested school'
          }
        });
      }

      next();
    } catch (error) {
      console.error('School access validation error:', error);
      next(new DatabaseError('Failed to validate school access'));
    }
  };
};

/**
 * Middleware to log school context switches
 */
const logSchoolSwitch = async (req, res, next) => {
  const originalSchoolId = req.headers['x-previous-school-id'];
  const currentSchoolId = req.activeSchoolId;
  
  if (originalSchoolId && originalSchoolId !== currentSchoolId && req.isMultiSchoolUser) {
    try {
      await multiSchoolDirectorService.logSchoolSwitch(
        req.user.userId,
        originalSchoolId,
        currentSchoolId,
        req.sessionId || req.headers['x-session-id'],
        req.ip,
        req.get('User-Agent'),
        'Automatic context switch via API'
      );
    } catch (error) {
      console.warn('Failed to log school switch:', error.message);
      // Non-critical, continue processing
    }
  }
  
  next();
};

/**
 * Log security incidents
 */
async function logSecurityIncident(incidentType, details) {
  try {
    const { query } = require('../config/database');
    await query(`
      INSERT INTO security_audit_trail (
        event_type,
        event_category,
        severity,
        user_id,
        ip_address,
        user_agent,
        metadata,
        event_timestamp
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
    `, [
      incidentType,
      'authorization',
      'warning',
      details.user_id,
      details.ip_address,
      details.user_agent,
      JSON.stringify(details)
    ]);
  } catch (error) {
    console.error('Failed to log security incident:', error);
  }
}

module.exports = {
  advancedMultiTenantMiddleware,
  requireMultiSchoolDirector,
  validateSchoolAccess,
  logSchoolSwitch
};