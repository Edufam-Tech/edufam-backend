// middleware/supabaseAuth.js - Supabase JWT Authentication Middleware

const { validateSupabaseJWT } = require('../config/supabase');
const { AuthenticationError } = require('./errorHandler');
const { query } = require('../config/database');

/**
 * Supabase JWT Authentication Middleware
 * Validates Supabase JWT tokens from frontend and sets up user context
 */
const authenticateSupabaseJWT = async (req, res, next) => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      throw new AuthenticationError('Authorization header required');
    }
    
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      throw new AuthenticationError('Invalid authorization format. Use "Bearer <token>"');
    }
    
    const token = parts[1];
    
    // Validate JWT with Supabase
    const supabaseUser = await validateSupabaseJWT(token);
    
    // Get additional user data from database
    const userResult = await query(`
      SELECT id, email, role, user_type, school_id, is_active, activation_status,
             first_name, last_name, profile_picture_url, locked_until
      FROM users 
      WHERE id = $1
    `, [supabaseUser.id]);
    
    if (userResult.rows.length === 0) {
      throw new AuthenticationError('User not found in database');
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
      activationStatus: user.activation_status,
      // Supabase context
      supabaseUserId: supabaseUser.id
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
    
    console.error('Supabase JWT authentication error:', error);
    return res.status(401).json({
      success: false,
      error: {
        type: 'AuthenticationError',
        message: 'Invalid or expired token'
      }
    });
  }
};

/**
 * Optional Supabase JWT authentication for public endpoints
 */
const optionalAuthenticateSupabaseJWT = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return next(); // No token provided, continue without authentication
    }
    
    // Try to authenticate if token is provided
    await authenticateSupabaseJWT(req, res, next);
  } catch (error) {
    // If token is invalid, continue without authentication
    next();
  }
};

module.exports = {
  authenticateSupabaseJWT,
  optionalAuthenticateSupabaseJWT
};
