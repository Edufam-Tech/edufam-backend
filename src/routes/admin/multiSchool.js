const express = require('express');
const router = express.Router();
const { requireRole } = require('../../middleware/auth');
const MultiSchoolController = require('../../controllers/admin/multiSchoolController');

// Admin authentication is applied at router.mount in routes/index.js via adminAuth

// =============================================================================
// DIRECT SCHOOL CREATION ROUTES
// =============================================================================

/**
 * @route   POST /api/admin/multi-school/schools
 * @desc    Create a new school directly (Super Admin and Support HR only)
 * @access  Private (Super Admin, Support HR)
 */
router.post('/schools',
  requireRole(['super_admin', 'support_hr']),
  MultiSchoolController.createSchool
);

// =============================================================================
// SCHOOL ONBOARDING ROUTES
// =============================================================================

/**
 * @route   POST /api/admin/multi-school/onboarding
 * @desc    Create a new school onboarding request
 * @access  Private (Platform Admin)
 */
router.post('/onboarding',
  requireRole(['super_admin']),
  MultiSchoolController.createOnboardingRequest
);

/**
 * @route   GET /api/admin/multi-school/onboarding
 * @desc    Get all onboarding requests with filtering
 * @access  Private (Platform Admin)
 */
router.get('/onboarding',
  requireRole(['super_admin']),
  MultiSchoolController.getOnboardingRequests
);

/**
 * @route   PUT /api/admin/multi-school/onboarding/:id/assign
 * @desc    Assign onboarding request to an admin
 * @access  Private (Super Admin, Regional Admin)
 */
router.put('/onboarding/:id/assign',
  requireRole(['super_admin']),
  MultiSchoolController.assignOnboardingRequest
);

/**
 * @route   PUT /api/admin/multi-school/onboarding/:id/review
 * @desc    Review and approve/reject onboarding request
 * @access  Private (Super Admin, Regional Admin)
 */
router.put('/onboarding/:id/review',
  requireRole(['super_admin']),
  MultiSchoolController.reviewOnboardingRequest
);

/**
 * @route   POST /api/admin/multi-school/onboarding/:id/complete
 * @desc    Complete onboarding by creating the actual school
 * @access  Private (Super Admin, Regional Admin)
 */
router.post('/onboarding/:id/complete',
  requireRole(['super_admin']),
  MultiSchoolController.completeOnboarding
);

// =============================================================================
// SCHOOL MANAGEMENT ROUTES
// =============================================================================

/**
 * @route   GET /api/admin/multi-school/schools
 * @desc    Get all schools with filtering and statistics
 * @access  Private (Platform Admin)
 */
router.get('/schools',
  requireRole(['super_admin', 'support_hr']),
  MultiSchoolController.getAllSchools
);

/**
 * @route   GET /api/admin/multi-school/schools/:id
 * @desc    Get detailed school information
 * @access  Private (Platform Admin)
 */
router.get('/schools/:id',
  requireRole(['super_admin', 'support_hr']),
  MultiSchoolController.getSchoolDetails
);

/**
 * @route   PUT /api/admin/multi-school/schools/:id/suspend
 * @desc    Suspend a school
 * @access  Private (Super Admin, Regional Admin)
 */
router.put('/schools/:id/suspend',
  requireRole(['super_admin', 'support_hr']),
  MultiSchoolController.suspendSchool
);

/**
 * @route   PUT /api/admin/multi-school/schools/:id/reactivate
 * @desc    Reactivate a suspended school
 * @access  Private (Super Admin, Regional Admin)
 */
router.put('/schools/:id/reactivate',
  requireRole(['super_admin', 'support_hr']),
  MultiSchoolController.reactivateSchool
);

/**
 * @route   GET /api/admin/multi-school/schools/:id/users
 * @desc    Get all users for a specific school
 * @access  Private (Platform Admin)
 */
router.get('/schools/:id/users',
  requireRole(['super_admin', 'support_hr']),
  async (req, res, next) => {
    try {
      const { query } = require('../../config/database');
      const { id } = req.params;
      const { userType, isActive, limit = 50, offset = 0 } = req.query;

      let whereClause = 'WHERE u.school_id = $1';
      const params = [id];

      if (userType) {
        whereClause += ` AND u.user_type = $${params.length + 1}`;
        params.push(userType);
      }

      if (isActive !== undefined) {
        whereClause += ` AND u.is_active = $${params.length + 1}`;
        params.push(isActive === 'true');
      }

      const result = await query(`
        SELECT 
          u.id, u.first_name, u.last_name, u.email, u.phone, u.user_type, 
          u.role, u.is_active, u.activation_status, u.last_login_at, u.created_at,
          s.name as school_name
        FROM users u
        JOIN schools s ON u.school_id = s.id
        ${whereClause}
        ORDER BY u.created_at DESC
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
);

/**
 * @route   GET /api/admin/multi-school/users
 * @desc    Get all school users across all schools with filtering and pagination
 * @access  Private (Platform Admin)
 */
router.get('/users',
  requireRole(['super_admin', 'support_hr']),
  async (req, res, next) => {
    try {
      const { query } = require('../../config/database');
      const {
        role,
        activationStatus,
        isActive,
        search,
        limit = 50,
        offset = 0,
      } = req.query;

      let whereClause = "WHERE u.user_type = 'school_user'";
      const params = [];

      if (role) {
        whereClause += ` AND u.role = $${params.length + 1}`;
        params.push(role);
      }

      if (activationStatus) {
        whereClause += ` AND u.activation_status = $${params.length + 1}`;
        params.push(activationStatus);
      }

      if (typeof isActive !== 'undefined') {
        whereClause += ` AND u.is_active = $${params.length + 1}`;
        params.push(String(isActive) === 'true');
      }

      if (search) {
        whereClause += ` AND (u.first_name ILIKE $${params.length + 1} OR u.last_name ILIKE $${params.length + 1} OR u.email ILIKE $${params.length + 1})`;
        params.push(`%${search}%`);
      }

      const result = await query(`
        SELECT 
          u.id,
          u.first_name,
          u.last_name,
          u.email,
          u.phone,
          u.user_type,
          u.role,
          u.is_active,
          u.activation_status,
          u.last_login_at,
          u.created_at,
          s.id as school_id,
          s.name as school_name
        FROM users u
        JOIN schools s ON u.school_id = s.id
        ${whereClause}
        ORDER BY u.created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `, [...params, parseInt(limit, 10), parseInt(offset, 10)]);

      res.json({
        success: true,
        data: result.rows,
        pagination: {
          limit: parseInt(limit, 10),
          offset: parseInt(offset, 10),
          total: result.rows.length,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/admin/multi-school/schools/:id/metrics
 * @desc    Get key metrics for a specific school
 * @access  Private (Platform Admin)
 */
router.get('/schools/:id/metrics',
  requireRole(['super_admin', 'support_hr']),
  async (req, res, next) => {
    try {
      const { query } = require('../../config/database');
      const { id } = req.params;
      const { startDate, endDate } = req.query;

      let dateFilter = '';
      const params = [id];

      if (startDate && endDate) {
        dateFilter = ` AND summary_date BETWEEN $${params.length + 1} AND $${params.length + 2}`;
        params.push(startDate, endDate);
      }

      const [currentMetrics, historicalMetrics, usageStats] = await Promise.all([
        // Current metrics
        query(`
          SELECT 
            active_students, active_staff, total_classes, monthly_logins,
            storage_used_gb, api_calls, support_tickets, performance_score
          FROM school_analytics_summary 
          WHERE school_id = $1 
          ORDER BY summary_date DESC 
          LIMIT 1
        `, [id]),

        // Historical trends
        query(`
          SELECT 
            summary_date, active_students, active_staff, monthly_logins,
            storage_used_gb, performance_score
          FROM school_analytics_summary 
          WHERE school_id = $1 ${dateFilter}
          ORDER BY summary_date DESC 
          LIMIT 30
        `, params),

        // Usage statistics
        query(`
          SELECT 
            activity_type,
            COUNT(*) as activity_count,
            DATE_TRUNC('day', logged_at) as activity_date
          FROM platform_usage_logs 
          WHERE school_id = $1 
            AND logged_at >= CURRENT_DATE - INTERVAL '30 days'
          GROUP BY activity_type, DATE_TRUNC('day', logged_at)
          ORDER BY activity_date DESC
        `, [id])
      ]);

      res.json({
        success: true,
        data: {
          current: currentMetrics.rows[0] || {},
          historical: historicalMetrics.rows,
          usage: usageStats.rows
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// =============================================================================
// SCHOOL OVERSIGHT ROUTES
// =============================================================================

/**
 * @route   POST /api/admin/multi-school/schools/:schoolId/oversight
 * @desc    Create a new oversight record for a school
 * @access  Private (Super Admin, Regional Admin)
 */
router.post('/schools/:schoolId/oversight',
  requireRole(['super_admin']),
  MultiSchoolController.createOversightRecord
);

/**
 * @route   GET /api/admin/multi-school/schools/:schoolId/oversight
 * @desc    Get oversight records for a school
 * @access  Private (Platform Admin)
 */
router.get('/schools/:schoolId/oversight',
  requireRole(['super_admin', 'compliance_admin']),
  MultiSchoolController.getOversightRecords
);

/**
 * @route   PUT /api/admin/multi-school/oversight/:id
 * @desc    Update an oversight record
 * @access  Private (Super Admin, Regional Admin)
 */
router.put('/oversight/:id',
  requireRole(['super_admin']),
  MultiSchoolController.updateOversightRecord
);

/**
 * @route   GET /api/admin/multi-school/oversight/dashboard
 * @desc    Get oversight dashboard with schools requiring attention
 * @access  Private (Platform Admin)
 */
router.get('/oversight/dashboard',
  requireRole(['super_admin', 'compliance_admin', 'support_hr']),
  async (req, res, next) => {
    try {
      const { query } = require('../../config/database');

      const [criticalSchools, warningSchools, overviewStats] = await Promise.all([
        // Schools with critical status
        query(`
          SELECT 
            so.school_id, s.name as school_name, so.oversight_type, so.status,
            so.compliance_score, so.performance_score, so.financial_health_score,
            so.last_review_date, so.issues_identified
          FROM school_oversight so
          JOIN schools s ON so.school_id = s.id
          WHERE so.status = 'critical'
          ORDER BY so.last_review_date ASC
        `),

        // Schools with warning status
        query(`
          SELECT 
            so.school_id, s.name as school_name, so.oversight_type, so.status,
            so.compliance_score, so.performance_score, so.financial_health_score,
            so.last_review_date, so.next_review_date
          FROM school_oversight so
          JOIN schools s ON so.school_id = s.id
          WHERE so.status = 'warning' OR so.next_review_date < CURRENT_DATE
          ORDER BY so.next_review_date ASC
        `),

        // Overview statistics
        query(`
          SELECT 
            COUNT(DISTINCT school_id) as total_schools_monitored,
            COUNT(CASE WHEN status = 'good' THEN 1 END) as schools_good,
            COUNT(CASE WHEN status = 'warning' THEN 1 END) as schools_warning,
            COUNT(CASE WHEN status = 'critical' THEN 1 END) as schools_critical,
            AVG(compliance_score) as avg_compliance_score,
            AVG(performance_score) as avg_performance_score,
            AVG(financial_health_score) as avg_financial_health_score
          FROM school_oversight
          WHERE last_review_date >= CURRENT_DATE - INTERVAL '90 days'
        `)
      ]);

      res.json({
        success: true,
        data: {
          criticalSchools: criticalSchools.rows,
          warningSchools: warningSchools.rows,
          overview: overviewStats.rows[0] || {}
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// =============================================================================
// PLATFORM REGIONS ROUTES
// =============================================================================

/**
 * @route   GET /api/admin/multi-school/regions
 * @desc    Get all platform regions
 * @access  Private (Platform Admin)
 */
router.get('/regions',
  requireRole(['super_admin']),
  MultiSchoolController.getPlatformRegions
);

/**
 * @route   POST /api/admin/multi-school/regions
 * @desc    Create a new platform region
 * @access  Private (Super Admin)
 */
router.post('/regions',
  requireRole(['super_admin']),
  MultiSchoolController.createPlatformRegion
);

/**
 * @route   PUT /api/admin/multi-school/regions/:id
 * @desc    Update a platform region
 * @access  Private (Super Admin)
 */
router.put('/regions/:id',
  requireRole(['super_admin']),
  async (req, res, next) => {
    try {
      const { query } = require('../../config/database');
      const { ValidationError, NotFoundError } = require('../../middleware/errorHandler');
      const { id } = req.params;
      const updates = req.body;

      const allowedFields = [
        'region_name', 'country', 'state_province', 'timezone',
        'currency', 'language', 'regional_manager_id', 'is_active'
      ];

      const setClause = [];
      const values = [];
      let paramIndex = 1;

      Object.keys(updates).forEach(key => {
        if (allowedFields.includes(key)) {
          setClause.push(`${key} = $${paramIndex}`);
          values.push(updates[key]);
          paramIndex++;
        }
      });

      if (setClause.length === 0) {
        throw new ValidationError('No valid fields provided for update');
      }

      setClause.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(id);

      const result = await query(`
        UPDATE platform_regions 
        SET ${setClause.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `, values);

      if (result.rows.length === 0) {
        throw new NotFoundError('Platform region not found');
      }

      res.json({
        success: true,
        message: 'Platform region updated successfully',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }
);

// =============================================================================
// BULK OPERATIONS ROUTES
// =============================================================================

/**
 * @route   POST /api/admin/multi-school/bulk/suspend
 * @desc    Bulk suspend multiple schools
 * @access  Private (Super Admin)
 */
router.post('/bulk/suspend',
  requireRole(['super_admin']),
  async (req, res, next) => {
    try {
      const { query } = require('../../config/database');
      const { ValidationError } = require('../../middleware/errorHandler');
      const { schoolIds, reason } = req.body;

      if (!schoolIds || !Array.isArray(schoolIds) || schoolIds.length === 0) {
        throw new ValidationError('School IDs array is required');
      }

      if (!reason) {
        throw new ValidationError('Suspension reason is required');
      }

      const results = [];
      const errors = [];

      for (const schoolId of schoolIds) {
        try {
          const result = await query(`
            UPDATE schools 
            SET is_active = false, updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
            RETURNING id, name
          `, [schoolId]);

          if (result.rows.length > 0) {
            results.push(result.rows[0]);
            
            // Log the action
            await query(`
              INSERT INTO admin_activity_logs (
                admin_id, activity_type, target_type, target_id, action_description
              ) VALUES ($1, 'bulk_suspension', 'school', $2, $3)
            `, [req.user.userId, schoolId, `Bulk suspension: ${reason}`]);
          } else {
            errors.push({ schoolId, error: 'School not found' });
          }
        } catch (error) {
          errors.push({ schoolId, error: error.message });
        }
      }

      res.json({
        success: true,
        message: 'Bulk suspension operation completed',
        data: {
          suspended: results,
          errors: errors,
          totalProcessed: schoolIds.length,
          successCount: results.length,
          errorCount: errors.length
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;