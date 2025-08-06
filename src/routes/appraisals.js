const express = require('express');
const router = express.Router();
const { authenticate, requireRole, requireUserType } = require('../middleware/auth');
const AppraisalController = require('../controllers/appraisalController');

// Apply authentication to all routes
router.use(authenticate);
router.use(requireUserType('school_user'));

// =============================================================================
// APPRAISAL CYCLE ROUTES
// =============================================================================

/**
 * @route   POST /api/appraisals/cycles
 * @desc    Create a new appraisal cycle
 * @access  Private (Principal, School Director, HR)
 */
router.post('/cycles',
  requireRole(['principal', 'school_director', 'hr']),
  AppraisalController.createCycle
);

/**
 * @route   GET /api/appraisals/cycles
 * @desc    Get all appraisal cycles
 * @access  Private (All school staff)
 */
router.get('/cycles',
  AppraisalController.getCycles
);

/**
 * @route   GET /api/appraisals/cycles/current
 * @desc    Get current active cycle
 * @access  Private (All school staff)
 */
router.get('/cycles/current',
  AppraisalController.getCurrentCycle
);

/**
 * @route   POST /api/appraisals/cycles/:id/activate
 * @desc    Activate an appraisal cycle
 * @access  Private (Principal, School Director, HR)
 */
router.post('/cycles/:id/activate',
  requireRole(['principal', 'school_director', 'hr']),
  AppraisalController.activateCycle
);

// =============================================================================
// APPRAISAL TEMPLATE ROUTES
// =============================================================================

/**
 * @route   POST /api/appraisals/templates
 * @desc    Create a new appraisal template
 * @access  Private (Principal, School Director, HR)
 */
router.post('/templates',
  requireRole(['principal', 'school_director', 'hr']),
  AppraisalController.createTemplate
);

/**
 * @route   GET /api/appraisals/templates
 * @desc    Get all appraisal templates
 * @access  Private (All school staff)
 */
router.get('/templates',
  AppraisalController.getTemplates
);

/**
 * @route   GET /api/appraisals/templates/:id
 * @desc    Get template details with categories and questions
 * @access  Private (All school staff)
 */
router.get('/templates/:id',
  AppraisalController.getTemplateDetails
);

/**
 * @route   PUT /api/appraisals/templates/:id
 * @desc    Update an appraisal template
 * @access  Private (Principal, School Director, HR)
 */
router.put('/templates/:id',
  requireRole(['principal', 'school_director', 'hr']),
  async (req, res, next) => {
    try {
      const { query } = require('../config/database');
      const { ValidationError, NotFoundError } = require('../middleware/errorHandler');
      const { id } = req.params;
      const updates = req.body;

      const allowedFields = [
        'template_name', 'description', 'applicable_roles', 'includes_self_review',
        'includes_manager_review', 'includes_peer_feedback', 'includes_360_feedback',
        'scoring_method', 'max_score', 'passing_score', 'is_default', 'is_active'
      ];

      const setClause = [];
      const values = [];
      let paramIndex = 1;

      Object.keys(updates).forEach(key => {
        if (allowedFields.includes(key)) {
          if (key === 'applicable_roles') {
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
      values.push(id, req.user.schoolId);

      const result = await query(`
        UPDATE appraisal_templates 
        SET ${setClause.join(', ')}
        WHERE id = $${paramIndex} AND school_id = $${paramIndex + 1}
        RETURNING *
      `, values);

      if (result.rows.length === 0) {
        throw new NotFoundError('Appraisal template not found');
      }

      res.json({
        success: true,
        message: 'Appraisal template updated successfully',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }
);

// =============================================================================
// APPRAISAL MANAGEMENT ROUTES
// =============================================================================

/**
 * @route   POST /api/appraisals/initiate
 * @desc    Initiate appraisal for an employee
 * @access  Private (Principal, School Director, HR, Manager)
 */
router.post('/initiate',
  requireRole(['principal', 'school_director', 'hr', 'manager']),
  AppraisalController.initiateAppraisal
);

/**
 * @route   GET /api/appraisals/my-appraisals
 * @desc    Get current user's appraisals
 * @access  Private (All staff)
 */
router.get('/my-appraisals',
  AppraisalController.getMyAppraisals
);

/**
 * @route   POST /api/appraisals/:id/self-review
 * @desc    Submit self review
 * @access  Private (Employee being appraised)
 */
router.post('/:id/self-review',
  AppraisalController.submitSelfReview
);

/**
 * @route   POST /api/appraisals/:id/manager-review
 * @desc    Submit manager review
 * @access  Private (Manager conducting review)
 */
router.post('/:id/manager-review',
  AppraisalController.submitManagerReview
);

/**
 * @route   POST /api/appraisals/:id/peer-feedback
 * @desc    Submit peer feedback
 * @access  Private (Peers providing feedback)
 */
router.post('/:id/peer-feedback',
  AppraisalController.submitPeerFeedback
);

/**
 * @route   GET /api/appraisals/:id/feedback
 * @desc    Get all feedback for an appraisal
 * @access  Private (Employee, Manager, HR)
 */
router.get('/:id/feedback',
  AppraisalController.getAppraisalFeedback
);

// =============================================================================
// GOAL MANAGEMENT ROUTES
// =============================================================================

/**
 * @route   POST /api/appraisals/:id/goals
 * @desc    Set goals for an appraisal
 * @access  Private (Employee, Manager, HR)
 */
router.post('/:id/goals',
  AppraisalController.setGoals
);

/**
 * @route   GET /api/appraisals/:id/progress
 * @desc    Get goal progress for an appraisal
 * @access  Private (Employee, Manager, HR)
 */
router.get('/:id/progress',
  AppraisalController.getGoalProgress
);

/**
 * @route   PUT /api/appraisals/goals/:goalId/progress
 * @desc    Update goal progress
 * @access  Private (Employee, Manager, HR)
 */
router.put('/goals/:goalId/progress',
  AppraisalController.updateGoalProgress
);

// =============================================================================
// APPRAISAL COMPLETION ROUTES
// =============================================================================

/**
 * @route   POST /api/appraisals/:id/complete
 * @desc    Complete an appraisal (HR final step)
 * @access  Private (Principal, School Director, HR)
 */
router.post('/:id/complete',
  requireRole(['principal', 'school_director', 'hr']),
  AppraisalController.completeAppraisal
);

/**
 * @route   GET /api/appraisals/:id
 * @desc    Get specific appraisal details
 * @access  Private (Employee, Manager, HR)
 */
router.get('/:id',
  async (req, res, next) => {
    try {
      const { query } = require('../config/database');
      const { NotFoundError } = require('../middleware/errorHandler');
      const { id } = req.params;

      const result = await query(`
        SELECT 
          a.*,
          ac.cycle_name,
          at.template_name,
          e.first_name as employee_first_name,
          e.last_name as employee_last_name,
          e.role as employee_role,
          m.first_name as manager_first_name,
          m.last_name as manager_last_name
        FROM appraisals a
        JOIN appraisal_cycles ac ON a.cycle_id = ac.id
        JOIN appraisal_templates at ON a.template_id = at.id
        JOIN staff e ON a.employee_id = e.id
        LEFT JOIN staff m ON a.manager_id = m.id
        WHERE a.id = $1 AND a.school_id = $2
          AND (a.employee_id = $3 OR a.manager_id = $3 OR $4 IN ('principal', 'school_director', 'hr'))
      `, [id, req.user.schoolId, req.user.userId, req.user.role]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Appraisal not found or access denied');
      }

      res.json({
        success: true,
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
 * @route   POST /api/appraisals/bulk-initiate
 * @desc    Initiate appraisals for multiple employees
 * @access  Private (Principal, School Director, HR)
 */
router.post('/bulk-initiate',
  requireRole(['principal', 'school_director', 'hr']),
  async (req, res, next) => {
    try {
      const { query } = require('../config/database');
      const { ValidationError } = require('../middleware/errorHandler');

      const {
        cycleId,
        templateId,
        employeeIds,
        appraisalPeriodStart,
        appraisalPeriodEnd
      } = req.body;

      if (!cycleId || !templateId || !employeeIds || !Array.isArray(employeeIds)) {
        throw new ValidationError('Cycle ID, template ID, and employee IDs array are required');
      }

      const results = [];
      const errors = [];

      for (const employeeId of employeeIds) {
        try {
          // Get employee's manager
          const managerResult = await query(`
            SELECT manager_id FROM staff WHERE id = $1 AND school_id = $2
          `, [employeeId, req.user.schoolId]);

          const managerId = managerResult.rows[0]?.manager_id;

          // Check if appraisal already exists
          const existingResult = await query(`
            SELECT id FROM appraisals 
            WHERE cycle_id = $1 AND employee_id = $2
          `, [cycleId, employeeId]);

          if (existingResult.rows.length > 0) {
            errors.push({
              employeeId,
              error: 'Appraisal already exists for this employee in this cycle'
            });
            continue;
          }

          const result = await query(`
            INSERT INTO appraisals (
              school_id, cycle_id, template_id, employee_id, manager_id,
              appraisal_period_start, appraisal_period_end, created_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
          `, [
            req.user.schoolId, cycleId, templateId, employeeId, managerId,
            appraisalPeriodStart, appraisalPeriodEnd, req.user.userId
          ]);

          results.push(result.rows[0]);
        } catch (error) {
          errors.push({
            employeeId,
            error: error.message
          });
        }
      }

      res.status(201).json({
        success: true,
        message: 'Bulk appraisal initiation completed',
        data: {
          successful: results,
          errors: errors,
          totalProcessed: employeeIds.length,
          successCount: results.length,
          errorCount: errors.length
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// =============================================================================
// REPORTING AND ANALYTICS ROUTES
// =============================================================================

/**
 * @route   GET /api/appraisals/reports
 * @desc    Get appraisal analytics and reports
 * @access  Private (Principal, School Director, HR)
 */
router.get('/reports',
  requireRole(['principal', 'school_director', 'hr']),
  AppraisalController.getAnalytics
);

/**
 * @route   GET /api/appraisals/reports/completion-status
 * @desc    Get completion status report
 * @access  Private (Principal, School Director, HR)
 */
router.get('/reports/completion-status',
  requireRole(['principal', 'school_director', 'hr']),
  async (req, res, next) => {
    try {
      const { query } = require('../config/database');
      const { cycleId } = req.query;

      let whereClause = 'WHERE a.school_id = $1';
      const params = [req.user.schoolId];

      if (cycleId) {
        whereClause += ` AND a.cycle_id = $${params.length + 1}`;
        params.push(cycleId);
      }

      const result = await query(`
        SELECT 
          a.id,
          ac.cycle_name,
          e.first_name as employee_first_name,
          e.last_name as employee_last_name,
          e.role as employee_role,
          m.first_name as manager_first_name,
          m.last_name as manager_last_name,
          a.status,
          a.self_review_completed,
          a.manager_review_completed,
          a.final_score,
          a.overall_rating,
          CASE 
            WHEN a.status = 'completed' THEN 'Completed'
            WHEN a.manager_review_completed THEN 'Awaiting HR Review'
            WHEN a.self_review_completed THEN 'Awaiting Manager Review'
            ELSE 'Awaiting Self Review'
          END as next_action
        FROM appraisals a
        JOIN appraisal_cycles ac ON a.cycle_id = ac.id
        JOIN staff e ON a.employee_id = e.id
        LEFT JOIN staff m ON a.manager_id = m.id
        ${whereClause}
        ORDER BY e.last_name, e.first_name
      `, params);

      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/appraisals/reports/performance-trends
 * @desc    Get performance trends report
 * @access  Private (Principal, School Director, HR)
 */
router.get('/reports/performance-trends',
  requireRole(['principal', 'school_director', 'hr']),
  async (req, res, next) => {
    try {
      const { query } = require('../config/database');
      const { employeeId, department } = req.query;

      let whereClause = 'WHERE ah.employee_id IN (SELECT id FROM staff WHERE school_id = $1)';
      const params = [req.user.schoolId];

      if (employeeId) {
        whereClause += ` AND ah.employee_id = $${params.length + 1}`;
        params.push(employeeId);
      }

      if (department) {
        whereClause += ` AND ah.employee_id IN (SELECT id FROM staff WHERE department_id = $${params.length + 1})`;
        params.push(department);
      }

      const result = await query(`
        SELECT 
          ah.*,
          s.first_name,
          s.last_name,
          s.role,
          d.department_name
        FROM appraisal_history ah
        JOIN staff s ON ah.employee_id = s.id
        LEFT JOIN departments d ON s.department_id = d.id
        ${whereClause}
        ORDER BY ah.employee_id, ah.appraisal_year DESC
      `, params);

      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   POST /api/appraisals/reports/export
 * @desc    Export appraisal reports
 * @access  Private (Principal, School Director, HR)
 */
router.post('/reports/export',
  requireRole(['principal', 'school_director', 'hr']),
  async (req, res, next) => {
    try {
      const {
        reportType,
        cycleId,
        format = 'csv',
        includeDetails = false
      } = req.body;

      // In a real implementation, you would generate actual files
      // For now, we'll simulate the export process
      
      const exportUrl = `https://exports.edufam.com/appraisals/${reportType}_${cycleId}.${format}`;
      
      res.json({
        success: true,
        message: 'Report export initiated successfully',
        data: {
          exportUrl,
          reportType,
          format,
          generatedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// =============================================================================
// DEVELOPMENT PLANS ROUTES
// =============================================================================

/**
 * @route   POST /api/appraisals/:id/development-plan
 * @desc    Create development plan for an appraisal
 * @access  Private (Manager, HR)
 */
router.post('/:id/development-plan',
  requireRole(['principal', 'school_director', 'hr', 'manager']),
  async (req, res, next) => {
    try {
      const { query } = require('../config/database');
      const { ValidationError } = require('../middleware/errorHandler');
      const { id } = req.params;

      const {
        planTitle,
        developmentAreas,
        objectives,
        actionItems,
        requiredResources,
        supportNeeded,
        targetCompletionDate,
        reviewSchedule
      } = req.body;

      if (!planTitle || !developmentAreas) {
        throw new ValidationError('Plan title and development areas are required');
      }

      // Get employee ID from appraisal
      const appraisalResult = await query(`
        SELECT employee_id FROM appraisals 
        WHERE id = $1 AND school_id = $2
      `, [id, req.user.schoolId]);

      if (appraisalResult.rows.length === 0) {
        throw new NotFoundError('Appraisal not found');
      }

      const employeeId = appraisalResult.rows[0].employee_id;

      const result = await query(`
        INSERT INTO development_plans (
          appraisal_id, employee_id, plan_title, development_areas,
          objectives, action_items, required_resources, support_needed,
          target_completion_date, review_schedule, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `, [
        id, employeeId, planTitle, JSON.stringify(developmentAreas),
        objectives, JSON.stringify(actionItems), requiredResources,
        supportNeeded, targetCompletionDate, reviewSchedule, req.user.userId
      ]);

      res.status(201).json({
        success: true,
        message: 'Development plan created successfully',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/appraisals/:id/development-plan
 * @desc    Get development plan for an appraisal
 * @access  Private (Employee, Manager, HR)
 */
router.get('/:id/development-plan',
  async (req, res, next) => {
    try {
      const { query } = require('../config/database');
      const { id } = req.params;

      const result = await query(`
        SELECT *
        FROM development_plans
        WHERE appraisal_id = $1
      `, [id]);

      res.json({
        success: true,
        data: result.rows[0] || null
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;