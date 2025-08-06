const express = require('express');
const router = express.Router();
const { authenticate, requireRole, requireUserType } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const { body, query, param } = require('express-validator');
const PerformanceController = require('../controllers/performanceController');

// Apply authentication to all routes
router.use(authenticate);
router.use(requireUserType(['school_user', 'admin_user']));

// =============================================================================
// APPRAISAL CYCLES MANAGEMENT
// =============================================================================

/**
 * @route   GET /api/performance/appraisal-cycles
 * @desc    Get appraisal cycles
 * @access  Private (HR, Principal, School Director)
 */
router.get('/appraisal-cycles',
  requireRole(['hr', 'principal', 'school_director', 'super_admin']),
  query('status').optional().isIn(['planning', 'active', 'completed', 'archived']).withMessage('Invalid status'),
  query('year').optional().isInt({ min: 2020, max: 2030 }).withMessage('Year must be between 2020 and 2030'),
  validate,
  PerformanceController.getAppraisalCycles
);

/**
 * @route   POST /api/performance/appraisal-cycles
 * @desc    Create appraisal cycle
 * @access  Private (HR, Principal, School Director)
 */
router.post('/appraisal-cycles',
  requireRole(['hr', 'principal', 'school_director', 'super_admin']),
  body('name').notEmpty().withMessage('Cycle name is required'),
  body('year').isInt({ min: 2020, max: 2030 }).withMessage('Year must be between 2020 and 2030'),
  body('startDate').isISO8601().withMessage('Start date is required'),
  body('endDate').isISO8601().withMessage('End date is required'),
  body('appraisalType').isIn(['annual', 'mid_year', 'probationary', '360_degree', 'project_based']).withMessage('Invalid appraisal type'),
  body('description').optional().isString().withMessage('Description must be string'),
  body('targetEmployees').optional().isArray().withMessage('Target employees must be array'),
  body('autoReminders').optional().isBoolean().withMessage('Auto reminders must be boolean'),
  validate,
  PerformanceController.createAppraisalCycle
);

/**
 * @route   PUT /api/performance/appraisal-cycles/:cycleId
 * @desc    Update appraisal cycle
 * @access  Private (HR, Principal, School Director)
 */
router.put('/appraisal-cycles/:cycleId',
  requireRole(['hr', 'principal', 'school_director', 'super_admin']),
  param('cycleId').isUUID().withMessage('Cycle ID must be valid UUID'),
  body('name').optional().notEmpty().withMessage('Cycle name cannot be empty'),
  body('endDate').optional().isISO8601().withMessage('End date must be valid'),
  body('status').optional().isIn(['planning', 'active', 'completed', 'archived']).withMessage('Invalid status'),
  validate,
  PerformanceController.updateAppraisalCycle
);

// =============================================================================
// APPRAISAL TEMPLATES
// =============================================================================

/**
 * @route   GET /api/performance/templates
 * @desc    Get appraisal templates
 * @access  Private (HR, Principal, School Director)
 */
router.get('/templates',
  requireRole(['hr', 'principal', 'school_director', 'super_admin']),
  query('templateType').optional().isIn(['teaching', 'administrative', 'support', 'leadership']).withMessage('Invalid template type'),
  query('active').optional().isBoolean().withMessage('Active must be boolean'),
  validate,
  PerformanceController.getAppraisalTemplates
);

/**
 * @route   POST /api/performance/templates
 * @desc    Create appraisal template
 * @access  Private (HR, Principal, School Director)
 */
router.post('/templates',
  requireRole(['hr', 'principal', 'school_director', 'super_admin']),
  body('name').notEmpty().withMessage('Template name is required'),
  body('templateType').isIn(['teaching', 'administrative', 'support', 'leadership']).withMessage('Invalid template type'),
  body('description').optional().isString().withMessage('Description must be string'),
  body('assessmentAreas').isArray({ min: 1 }).withMessage('Assessment areas are required'),
  body('assessmentAreas.*.name').notEmpty().withMessage('Assessment area name is required'),
  body('assessmentAreas.*.weight').isFloat({ min: 0, max: 100 }).withMessage('Weight must be between 0 and 100'),
  body('assessmentAreas.*.criteria').isArray().withMessage('Criteria must be array'),
  body('ratingScale').isObject().withMessage('Rating scale is required'),
  body('ratingScale.min').isInt({ min: 1 }).withMessage('Min rating must be positive'),
  body('ratingScale.max').isInt({ min: 2 }).withMessage('Max rating must be at least 2'),
  validate,
  PerformanceController.createAppraisalTemplate
);

/**
 * @route   PUT /api/performance/templates/:templateId
 * @desc    Update appraisal template
 * @access  Private (HR, Principal, School Director)
 */
router.put('/templates/:templateId',
  requireRole(['hr', 'principal', 'school_director', 'super_admin']),
  param('templateId').isUUID().withMessage('Template ID must be valid UUID'),
  body('name').optional().notEmpty().withMessage('Template name cannot be empty'),
  body('assessmentAreas').optional().isArray().withMessage('Assessment areas must be array'),
  validate,
  PerformanceController.updateAppraisalTemplate
);

// =============================================================================
// INDIVIDUAL APPRAISALS
// =============================================================================

/**
 * @route   GET /api/performance/appraisals
 * @desc    Get appraisals
 * @access  Private (All staff can see their own, HR/Principal see all)
 */
router.get('/appraisals',
  query('employeeId').optional().isUUID().withMessage('Employee ID must be valid UUID'),
  query('cycleId').optional().isUUID().withMessage('Cycle ID must be valid UUID'),
  query('status').optional().isIn(['not_started', 'self_assessment', 'supervisor_review', 'peer_feedback', 'completed']).withMessage('Invalid status'),
  query('year').optional().isInt({ min: 2020, max: 2030 }).withMessage('Year must be between 2020 and 2030'),
  validate,
  PerformanceController.getAppraisals
);

/**
 * @route   POST /api/performance/appraisals/initiate
 * @desc    Initiate appraisal for employee
 * @access  Private (HR, Principal, School Director)
 */
router.post('/appraisals/initiate',
  requireRole(['hr', 'principal', 'school_director', 'super_admin']),
  body('employeeId').isUUID().withMessage('Employee ID is required'),
  body('cycleId').isUUID().withMessage('Cycle ID is required'),
  body('templateId').isUUID().withMessage('Template ID is required'),
  body('supervisorId').isUUID().withMessage('Supervisor ID is required'),
  body('reviewPeriod').isObject().withMessage('Review period is required'),
  body('reviewPeriod.startDate').isISO8601().withMessage('Review period start date is required'),
  body('reviewPeriod.endDate').isISO8601().withMessage('Review period end date is required'),
  body('goals').optional().isArray().withMessage('Goals must be array'),
  body('deadlines').optional().isObject().withMessage('Deadlines must be object'),
  validate,
  PerformanceController.initiateAppraisal
);

/**
 * @route   PUT /api/performance/appraisals/:appraisalId/self-assessment
 * @desc    Submit self-assessment
 * @access  Private (Employee being appraised)
 */
router.put('/appraisals/:appraisalId/self-assessment',
  param('appraisalId').isUUID().withMessage('Appraisal ID must be valid UUID'),
  body('ratings').isObject().withMessage('Ratings are required'),
  body('achievements').optional().isArray().withMessage('Achievements must be array'),
  body('challenges').optional().isArray().withMessage('Challenges must be array'),
  body('developmentNeeds').optional().isArray().withMessage('Development needs must be array'),
  body('comments').optional().isString().withMessage('Comments must be string'),
  body('goalProgress').optional().isArray().withMessage('Goal progress must be array'),
  validate,
  PerformanceController.submitSelfAssessment
);

/**
 * @route   PUT /api/performance/appraisals/:appraisalId/supervisor-review
 * @desc    Submit supervisor review
 * @access  Private (Supervisor)
 */
router.put('/appraisals/:appraisalId/supervisor-review',
  param('appraisalId').isUUID().withMessage('Appraisal ID must be valid UUID'),
  body('ratings').isObject().withMessage('Ratings are required'),
  body('strengths').optional().isArray().withMessage('Strengths must be array'),
  body('areasForImprovement').optional().isArray().withMessage('Areas for improvement must be array'),
  body('overallComments').optional().isString().withMessage('Overall comments must be string'),
  body('recommendedActions').optional().isArray().withMessage('Recommended actions must be array'),
  body('promotionRecommendation').optional().isIn(['not_recommended', 'ready_in_6_months', 'ready_in_1_year', 'ready_now']).withMessage('Invalid promotion recommendation'),
  validate,
  PerformanceController.submitSupervisorReview
);

/**
 * @route   PUT /api/performance/appraisals/:appraisalId/peer-feedback
 * @desc    Submit peer feedback
 * @access  Private (Designated peers)
 */
router.put('/appraisals/:appraisalId/peer-feedback',
  param('appraisalId').isUUID().withMessage('Appraisal ID must be valid UUID'),
  body('feedback').isArray({ min: 1 }).withMessage('Feedback is required'),
  body('feedback.*.area').notEmpty().withMessage('Feedback area is required'),
  body('feedback.*.rating').optional().isFloat({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  body('feedback.*.comments').notEmpty().withMessage('Feedback comments are required'),
  body('collaborationRating').optional().isFloat({ min: 1, max: 5 }).withMessage('Collaboration rating must be between 1 and 5'),
  validate,
  PerformanceController.submitPeerFeedback
);

/**
 * @route   POST /api/performance/appraisals/:appraisalId/finalize
 * @desc    Finalize appraisal
 * @access  Private (HR, Principal, School Director)
 */
router.post('/appraisals/:appraisalId/finalize',
  requireRole(['hr', 'principal', 'school_director', 'super_admin']),
  param('appraisalId').isUUID().withMessage('Appraisal ID must be valid UUID'),
  body('finalRating').isFloat({ min: 1, max: 5 }).withMessage('Final rating is required'),
  body('finalComments').notEmpty().withMessage('Final comments are required'),
  body('developmentPlan').optional().isArray().withMessage('Development plan must be array'),
  body('salaryRecommendation').optional().isObject().withMessage('Salary recommendation must be object'),
  body('nextReviewDate').optional().isISO8601().withMessage('Next review date must be valid'),
  validate,
  PerformanceController.finalizeAppraisal
);

// =============================================================================
// GOAL MANAGEMENT
// =============================================================================

/**
 * @route   GET /api/performance/goals
 * @desc    Get performance goals
 * @access  Private (All staff can see their own, supervisors see team goals)
 */
router.get('/goals',
  query('employeeId').optional().isUUID().withMessage('Employee ID must be valid UUID'),
  query('status').optional().isIn(['draft', 'active', 'completed', 'cancelled']).withMessage('Invalid status'),
  query('year').optional().isInt({ min: 2020, max: 2030 }).withMessage('Year must be between 2020 and 2030'),
  validate,
  PerformanceController.getPerformanceGoals
);

/**
 * @route   POST /api/performance/goals
 * @desc    Create performance goal
 * @access  Private (Employee, Supervisor, HR, Principal, School Director)
 */
router.post('/goals',
  body('employeeId').isUUID().withMessage('Employee ID is required'),
  body('description').notEmpty().withMessage('Goal description is required'),
  body('category').isIn(['performance', 'development', 'behavior', 'project', 'skill']).withMessage('Invalid goal category'),
  body('targetDate').isISO8601().withMessage('Target date is required'),
  body('weight').optional().isFloat({ min: 0, max: 100 }).withMessage('Weight must be between 0 and 100'),
  body('measurementCriteria').notEmpty().withMessage('Measurement criteria is required'),
  body('resources').optional().isArray().withMessage('Resources must be array'),
  validate,
  PerformanceController.createPerformanceGoal
);

/**
 * @route   PUT /api/performance/goals/:goalId/progress
 * @desc    Update goal progress
 * @access  Private (Employee, Supervisor)
 */
router.put('/goals/:goalId/progress',
  param('goalId').isUUID().withMessage('Goal ID must be valid UUID'),
  body('progressPercentage').isFloat({ min: 0, max: 100 }).withMessage('Progress percentage must be between 0 and 100'),
  body('progressNotes').optional().isString().withMessage('Progress notes must be string'),
  body('challenges').optional().isArray().withMessage('Challenges must be array'),
  body('supportNeeded').optional().isString().withMessage('Support needed must be string'),
  validate,
  PerformanceController.updateGoalProgress
);

// =============================================================================
// DEVELOPMENT PLANS
// =============================================================================

/**
 * @route   GET /api/performance/development-plans
 * @desc    Get development plans
 * @access  Private (Employee, Supervisor, HR, Principal, School Director)
 */
router.get('/development-plans',
  query('employeeId').optional().isUUID().withMessage('Employee ID must be valid UUID'),
  query('status').optional().isIn(['draft', 'active', 'completed', 'on_hold']).withMessage('Invalid status'),
  validate,
  PerformanceController.getDevelopmentPlans
);

/**
 * @route   POST /api/performance/development-plans
 * @desc    Create development plan
 * @access  Private (HR, Principal, School Director, Supervisor)
 */
router.post('/development-plans',
  requireRole(['hr', 'principal', 'school_director', 'super_admin', 'teacher']),
  body('employeeId').isUUID().withMessage('Employee ID is required'),
  body('planName').notEmpty().withMessage('Plan name is required'),
  body('developmentAreas').isArray({ min: 1 }).withMessage('Development areas are required'),
  body('developmentAreas.*.area').notEmpty().withMessage('Development area is required'),
  body('developmentAreas.*.currentLevel').isIn(['beginner', 'intermediate', 'advanced', 'expert']).withMessage('Invalid current level'),
  body('developmentAreas.*.targetLevel').isIn(['beginner', 'intermediate', 'advanced', 'expert']).withMessage('Invalid target level'),
  body('developmentAreas.*.actions').isArray().withMessage('Actions must be array'),
  body('timeline').isObject().withMessage('Timeline is required'),
  body('timeline.startDate').isISO8601().withMessage('Start date is required'),
  body('timeline.endDate').isISO8601().withMessage('End date is required'),
  body('budget').optional().isFloat({ min: 0 }).withMessage('Budget must be positive'),
  validate,
  PerformanceController.createDevelopmentPlan
);

// =============================================================================
// PERFORMANCE ANALYTICS
// =============================================================================

/**
 * @route   GET /api/performance/analytics/trends
 * @desc    Get performance trends
 * @access  Private (HR, Principal, School Director)
 */
router.get('/analytics/trends',
  requireRole(['hr', 'principal', 'school_director', 'super_admin']),
  query('period').optional().isIn(['quarterly', 'yearly', 'multi_year']).withMessage('Invalid period'),
  query('department').optional().isString().withMessage('Department must be string'),
  query('startDate').optional().isISO8601().withMessage('Start date must be valid'),
  query('endDate').optional().isISO8601().withMessage('End date must be valid'),
  validate,
  PerformanceController.getPerformanceTrends
);

/**
 * @route   GET /api/performance/analytics/distribution
 * @desc    Get performance rating distribution
 * @access  Private (HR, Principal, School Director)
 */
router.get('/analytics/distribution',
  requireRole(['hr', 'principal', 'school_director', 'super_admin']),
  query('cycleId').optional().isUUID().withMessage('Cycle ID must be valid UUID'),
  query('department').optional().isString().withMessage('Department must be string'),
  query('position').optional().isString().withMessage('Position must be string'),
  validate,
  PerformanceController.getPerformanceDistribution
);

/**
 * @route   GET /api/performance/analytics/goal-achievement
 * @desc    Get goal achievement analytics
 * @access  Private (HR, Principal, School Director)
 */
router.get('/analytics/goal-achievement',
  requireRole(['hr', 'principal', 'school_director', 'super_admin']),
  query('year').optional().isInt({ min: 2020, max: 2030 }).withMessage('Year must be between 2020 and 2030'),
  query('quarter').optional().isInt({ min: 1, max: 4 }).withMessage('Quarter must be between 1 and 4'),
  validate,
  PerformanceController.getGoalAchievementAnalytics
);

// =============================================================================
// PERFORMANCE REPORTS
// =============================================================================

/**
 * @route   GET /api/performance/reports/individual/:employeeId
 * @desc    Generate individual performance report
 * @access  Private (Employee, Supervisor, HR, Principal, School Director)
 */
router.get('/reports/individual/:employeeId',
  param('employeeId').isUUID().withMessage('Employee ID must be valid UUID'),
  query('cycleId').optional().isUUID().withMessage('Cycle ID must be valid UUID'),
  query('format').optional().isIn(['json', 'pdf', 'excel']).withMessage('Invalid format'),
  validate,
  PerformanceController.generateIndividualReport
);

/**
 * @route   GET /api/performance/reports/department
 * @desc    Generate department performance report
 * @access  Private (HR, Principal, School Director)
 */
router.get('/reports/department',
  requireRole(['hr', 'principal', 'school_director', 'super_admin']),
  query('departmentId').isUUID().withMessage('Department ID is required'),
  query('cycleId').isUUID().withMessage('Cycle ID is required'),
  query('format').optional().isIn(['json', 'pdf', 'excel']).withMessage('Invalid format'),
  validate,
  PerformanceController.generateDepartmentReport
);

/**
 * @route   GET /api/performance/reports/school-wide
 * @desc    Generate school-wide performance report
 * @access  Private (Principal, School Director)
 */
router.get('/reports/school-wide',
  requireRole(['principal', 'school_director', 'super_admin']),
  query('cycleId').isUUID().withMessage('Cycle ID is required'),
  query('includeComparisons').optional().isBoolean().withMessage('Include comparisons must be boolean'),
  query('format').optional().isIn(['json', 'pdf', 'excel']).withMessage('Invalid format'),
  validate,
  PerformanceController.generateSchoolWideReport
);

module.exports = router;