const userService = require('../services/userService');
const authService = require('../services/authService');
const { asyncHandler } = require('../middleware/errorHandler');
const { 
  ValidationError, 
  AuthorizationError,
  NotFoundError,
  ConflictError 
} = require('../middleware/errorHandler');
const { query } = require('../config/database');

class UserController {
  // Get current user profile
  getProfile = asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const user = await userService.findUserById(userId);

    res.json({
      success: true,
      data: {
        user: userService.sanitizeUser(user)
      }
    });
  });

  // Update current user profile
  updateProfile = asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const { firstName, lastName, phone } = req.body;

    const updatedUser = await userService.updateUserProfile(userId, {
      firstName,
      lastName,
      phone
    });

    res.json({
      success: true,
      data: {
        user: userService.sanitizeUser(updatedUser)
      },
      message: 'Profile updated successfully'
    });
  });

  // Change password
  changePassword = asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const { currentPassword, password } = req.body;

    await userService.changePassword(userId, currentPassword, password);

    res.json({
      success: true,
      message: 'Password changed successfully. Please login again.'
    });
  });

  // Get user sessions
  getSessions = asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const sessions = await authService.getUserSessions(userId);

    res.json({
      success: true,
      data: {
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

  // Get all users (admin only - with pagination and filtering)
  getAllUsers = asyncHandler(async (req, res) => {
    const { 
      page = 1, 
      limit = 20, 
      userType, 
      role, 
      schoolId, 
      activationStatus, 
      search 
    } = req.query;

    // Build where clause based on user permissions and filters
    let whereConditions = [];
    let params = [];
    let paramCount = 0;

    // Apply user management permissions
    if (req.canManageAllUsers) {
      // Super admin can see all users
    } else if (req.canManageSchoolUsers) {
      // Support HR can only see school users
      whereConditions.push(`user_type = $${++paramCount}`);
      params.push('school_user');
    } else if (req.canManageOwnSchoolUsers) {
      // School director can only see users from their school
      whereConditions.push(`school_id = $${++paramCount}`);
      params.push(req.user.schoolId);
    }

    // Apply filters
    if (userType) {
      whereConditions.push(`user_type = $${++paramCount}`);
      params.push(userType);
    }

    if (role) {
      whereConditions.push(`role = $${++paramCount}`);
      params.push(role);
    }

    if (schoolId) {
      whereConditions.push(`school_id = $${++paramCount}`);
      params.push(schoolId);
    }

    if (activationStatus) {
      whereConditions.push(`activation_status = $${++paramCount}`);
      params.push(activationStatus);
    }

    if (search) {
      whereConditions.push(`(
        first_name ILIKE $${++paramCount} OR 
        last_name ILIKE $${++paramCount} OR 
        email ILIKE $${++paramCount}
      )`);
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }

    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';

    // Get total count
    const countResult = await query(`
      SELECT COUNT(*) as total
      FROM users
      ${whereClause}
    `, params);

    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;

    // Get users with pagination
    const usersResult = await query(`
      SELECT u.*, s.name as school_name
      FROM users u
      LEFT JOIN schools s ON u.school_id = s.id
      ${whereClause}
      ORDER BY u.created_at DESC
      LIMIT $${++paramCount} OFFSET $${++paramCount}
    `, [...params, limit, offset]);

    const users = usersResult.rows.map(user => ({
      ...userService.sanitizeUser(user),
      schoolName: user.school_name
    }));

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      }
    });
  });

  // Get single user by ID (admin only)
  getUserById = asyncHandler(async (req, res) => {
    const { userId } = req.params;

    // Check if user can access this user
    if (!req.canManageAllUsers) {
      if (req.canManageSchoolUsers) {
        // Support HR - check if it's a school user
        const userCheck = await query(`
          SELECT user_type FROM users WHERE id = $1
        `, [userId]);
        
        if (userCheck.rows.length === 0) {
          throw new NotFoundError('User not found');
        }
        
        if (userCheck.rows[0].user_type !== 'school_user') {
          throw new AuthorizationError('Cannot access admin users');
        }
      } else if (req.canManageOwnSchoolUsers) {
        // School director - check if user is from same school
        const userCheck = await query(`
          SELECT school_id FROM users WHERE id = $1
        `, [userId]);
        
        if (userCheck.rows.length === 0) {
          throw new NotFoundError('User not found');
        }
        
        if (userCheck.rows[0].school_id !== req.user.schoolId) {
          throw new AuthorizationError('Cannot access users from other schools');
        }
      }
    }

    const user = await userService.findUserById(userId);

    res.json({
      success: true,
      data: {
        user: userService.sanitizeUser(user)
      }
    });
  });

  // Create new user (admin only)
  createUser = asyncHandler(async (req, res) => {
    const {
      email,
      password,
      firstName,
      lastName,
      phone,
      userType,
      role,
      schoolId,
      activationStatus,
      emailVerified,
      profilePictureUrl
    } = req.body;

    // Validate permissions based on user type being created
    if (userType === 'admin_user' && !req.canManageAllUsers) {
      throw new AuthorizationError('Only super admin can create admin users');
    }

    if (userType === 'school_user' && !req.canManageSchoolUsers && !req.canManageOwnSchoolUsers) {
      throw new AuthorizationError('Insufficient permissions to create school users');
    }

    // If school director, force school ID to their own school
    let finalSchoolId = schoolId;
    if (req.canManageOwnSchoolUsers && !req.canManageAllUsers) {
      finalSchoolId = req.user.schoolId;
    }

    // Validate school ID for school users
    if (userType === 'school_user' && !finalSchoolId) {
      throw new ValidationError('School ID is required for school users');
    }

    // Admin users should not have school ID
    if (userType === 'admin_user' && finalSchoolId) {
      finalSchoolId = null;
    }

    // Set user context for RLS before database operations
    await authService.setUserContext(req.user.userId, req.user.schoolId);

    const newUser = await userService.createUser({
      email,
      password,
      firstName,
      lastName,
      phone,
      userType,
      role,
      schoolId: finalSchoolId,
      activationStatus,
      emailVerified,
      profilePictureUrl
    }, req.user.userId);

    res.status(201).json({
      success: true,
      data: {
        user: userService.sanitizeUser(newUser)
      },
      message: 'User created successfully'
    });
  });

  // Update user (admin only)
  updateUser = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const { firstName, lastName, phone, role, activationStatus } = req.body;

    // Check permissions (same logic as getUserById)
    if (!req.canManageAllUsers) {
      if (req.canManageSchoolUsers) {
        const userCheck = await query(`
          SELECT user_type FROM users WHERE id = $1
        `, [userId]);
        
        if (userCheck.rows.length === 0) {
          throw new NotFoundError('User not found');
        }
        
        if (userCheck.rows[0].user_type !== 'school_user') {
          throw new AuthorizationError('Cannot modify admin users');
        }
      } else if (req.canManageOwnSchoolUsers) {
        const userCheck = await query(`
          SELECT school_id FROM users WHERE id = $1
        `, [userId]);
        
        if (userCheck.rows.length === 0) {
          throw new NotFoundError('User not found');
        }
        
        if (userCheck.rows[0].school_id !== req.user.schoolId) {
          throw new AuthorizationError('Cannot modify users from other schools');
        }
      }
    }

    // Update basic profile info
    if (firstName || lastName || phone) {
      await userService.updateUserProfile(userId, {
        firstName,
        lastName,
        phone
      });
    }

    // Update role if provided and user has permission
    if (role) {
      await query(`
        UPDATE users 
        SET role = $1, updated_at = NOW()
        WHERE id = $2
      `, [role, userId]);
    }

    // Update activation status if provided
    if (activationStatus) {
      await userService.setUserActivationStatus(userId, activationStatus, req.user.userId);
    }

    // Get updated user
    const updatedUser = await userService.findUserById(userId);

    res.json({
      success: true,
      data: {
        user: userService.sanitizeUser(updatedUser)
      },
      message: 'User updated successfully'
    });
  });

  // Activate user (admin only)
  activateUser = asyncHandler(async (req, res) => {
    const { userId } = req.params;

    await userService.setUserActivationStatus(userId, 'active', req.user.userId);

    res.json({
      success: true,
      message: 'User activated successfully'
    });
  });

  // Deactivate user (admin only)
  deactivateUser = asyncHandler(async (req, res) => {
    const { userId } = req.params;

    await userService.setUserActivationStatus(userId, 'deactivated', req.user.userId);

    res.json({
      success: true,
      message: 'User deactivated successfully'
    });
  });

  // Reset user password (admin only)
  resetUserPassword = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const { newPassword } = req.body;

    // Check permissions (same logic as getUserById)
    if (!req.canManageAllUsers) {
      if (req.canManageSchoolUsers) {
        const userCheck = await query(`
          SELECT user_type FROM users WHERE id = $1
        `, [userId]);
        
        if (userCheck.rows.length === 0) {
          throw new NotFoundError('User not found');
        }
        
        if (userCheck.rows[0].user_type !== 'school_user') {
          throw new AuthorizationError('Cannot reset admin user passwords');
        }
      } else if (req.canManageOwnSchoolUsers) {
        const userCheck = await query(`
          SELECT school_id FROM users WHERE id = $1
        `, [userId]);
        
        if (userCheck.rows.length === 0) {
          throw new NotFoundError('User not found');
        }
        
        if (userCheck.rows[0].school_id !== req.user.schoolId) {
          throw new AuthorizationError('Cannot reset passwords for users from other schools');
        }
      }
    }

    await userService.resetUserPassword(userId, newPassword, req.user.userId);

    res.json({
      success: true,
      message: 'Password reset successfully'
    });
  });

  // Get user statistics
  getUserStats = asyncHandler(async (req, res) => {
    const stats = await userService.getUserStatistics();

    res.json({
      success: true,
      data: stats
    });
  });

  // Capabilities endpoint for platform access strategy
  getCapabilities = asyncHandler(async (req, res) => {
    const { role, userType, schoolId } = req.user;

    // Multi-school access only for directors
    const multiSchoolAccess = role === 'school_director';

    // Platform tiers
    const platforms = {
      web: 'full',
      mobile: role === 'parent' ? 'full' : 'essential'
    };

    // Web features (high-level; frontends use to toggle menus)
    const webFeaturesByRole = {
      school_director: ['dashboard','multi_school','approvals','financial','hr','reports','analytics','communications','calendar'],
      principal: ['dashboard','academic','approvals','hr','reports','analytics','communications','calendar'],
      teacher: ['dashboard','gradebook','attendance','timetable','reports','communications','calendar'],
      hr: ['dashboard','staff','recruitment','leave','payroll','appraisals','reports','communications'],
      finance: ['dashboard','fees','invoices','payments','mpesa','reports','analytics','communications'],
      parent: ['dashboard','academic','payments','communications','calendar']
    };

    // Mobile features (lightweight set except for parents)
    const mobileFeaturesByRole = {
      school_director: ['dashboard','switch_school','announcements','messages','attendance_overview','approval_alerts','profile'],
      principal: ['dashboard','announcements','messages','attendance_overview','grade_approval_alerts','profile'],
      teacher: ['dashboard','messages','announcements','attendance_quick','schedule_overview','profile'],
      hr: ['dashboard','messages','announcements','staff_attendance_overview','leave_alerts','profile'],
      finance: ['dashboard','messages','announcements','payment_alerts','fee_balance_overview','profile'],
      parent: ['home','messages','academic','marketplace','profile']
    };

    const response = {
      role,
      userType,
      platforms,
      webFeatures: webFeaturesByRole[role] || [],
      mobileFeatures: mobileFeaturesByRole[role] || [],
      multiSchoolAccess,
      schoolContext: {
        currentSchoolId: schoolId || null
      }
    };

    res.json({ success: true, data: response });
  });
}

module.exports = new UserController(); 