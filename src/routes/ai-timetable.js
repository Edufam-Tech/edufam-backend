const express = require('express');
const router = express.Router();
const { authenticate, requireRole, requireUserType } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const { body, query, param } = require('express-validator');
const AITimetableController = require('../controllers/aiTimetableController');

// Apply authentication to all routes
router.use(authenticate);
router.use(requireUserType(['school_user', 'admin_user']));

// =============================================================================
// AI TIMETABLE GENERATION
// =============================================================================

/**
 * @route   POST /api/timetable/ai/generate
 * @desc    Generate AI-powered timetable
 * @access  Private (Principal, School Director, Academic Coordinator)
 */
router.post('/ai/generate',
  requireRole(['principal', 'school_director', 'academic_coordinator', 'super_admin']),
  body('academicYearId').isUUID().withMessage('Academic year ID is required'),
  body('termId').isUUID().withMessage('Term ID is required'),
  body('parameters').isObject().withMessage('Parameters are required'),
  body('parameters.maxPeriodsPerDay').isInt({ min: 4, max: 10 }).withMessage('Max periods per day must be between 4 and 10'),
  body('parameters.lunchBreakDuration').isInt({ min: 30, max: 120 }).withMessage('Lunch break duration must be between 30 and 120 minutes'),
  body('parameters.shortBreakDuration').isInt({ min: 10, max: 30 }).withMessage('Short break duration must be between 10 and 30 minutes'),
  body('parameters.schoolStartTime').matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Invalid school start time format'),
  body('parameters.schoolEndTime').matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Invalid school end time format'),
  body('parameters.periodDuration').optional().isInt({ min: 30, max: 90 }).withMessage('Period duration must be between 30 and 90 minutes'),
  body('constraints').optional().isObject().withMessage('Constraints must be object'),
  body('preferences').optional().isObject().withMessage('Preferences must be object'),
  body('preferences.balanceWorkload').optional().isBoolean().withMessage('Balance workload must be boolean'),
  body('preferences.minimizeGaps').optional().isBoolean().withMessage('Minimize gaps must be boolean'),
  body('preferences.groupSimilarSubjects').optional().isBoolean().withMessage('Group similar subjects must be boolean'),
  body('preferences.prioritizeCoreSubjects').optional().isBoolean().withMessage('Prioritize core subjects must be boolean'),
  validate,
  AITimetableController.generateTimetable
);

/**
 * @route   GET /api/timetable/ai/generation-status/:jobId
 * @desc    Get timetable generation status
 * @access  Private (Principal, School Director, Academic Coordinator)
 */
router.get('/ai/generation-status/:jobId',
  requireRole(['principal', 'school_director', 'academic_coordinator', 'super_admin']),
  param('jobId').isUUID().withMessage('Job ID must be valid UUID'),
  validate,
  AITimetableController.getGenerationStatus
);

/**
 * @route   POST /api/timetable/ai/regenerate
 * @desc    Regenerate timetable with modifications
 * @access  Private (Principal, School Director, Academic Coordinator)
 */
router.post('/ai/regenerate',
  requireRole(['principal', 'school_director', 'academic_coordinator', 'super_admin']),
  body('timetableId').isUUID().withMessage('Timetable ID is required'),
  body('modifications').isObject().withMessage('Modifications are required'),
  body('modifications.constraints').optional().isObject().withMessage('Constraints must be object'),
  body('modifications.preferences').optional().isObject().withMessage('Preferences must be object'),
  body('modifications.fixedSlots').optional().isArray().withMessage('Fixed slots must be array'),
  body('modifications.excludeSlots').optional().isArray().withMessage('Exclude slots must be array'),
  body('reason').notEmpty().withMessage('Reason for regeneration is required'),
  validate,
  AITimetableController.regenerateTimetable
);

// =============================================================================
// CONSTRAINTS MANAGEMENT
// =============================================================================

/**
 * @route   GET /api/timetable/ai/constraints
 * @desc    Get timetable constraints
 * @access  Private (Principal, School Director, Academic Coordinator)
 */
router.get('/ai/constraints',
  requireRole(['principal', 'school_director', 'academic_coordinator', 'super_admin']),
  query('constraintType').optional().isIn(['teacher', 'room', 'subject', 'class', 'time']).withMessage('Invalid constraint type'),
  query('academicYearId').optional().isUUID().withMessage('Academic year ID must be valid UUID'),
  validate,
  AITimetableController.getConstraints
);

/**
 * @route   POST /api/timetable/ai/constraints
 * @desc    Create timetable constraint
 * @access  Private (Principal, School Director, Academic Coordinator)
 */
router.post('/ai/constraints',
  requireRole(['principal', 'school_director', 'academic_coordinator', 'super_admin']),
  body('constraintType').isIn(['teacher', 'room', 'subject', 'class', 'time']).withMessage('Invalid constraint type'),
  body('name').notEmpty().withMessage('Constraint name is required'),
  body('description').optional().isString().withMessage('Description must be string'),
  body('priority').isIn(['low', 'medium', 'high', 'critical']).withMessage('Invalid priority'),
  body('isHard').isBoolean().withMessage('Is hard constraint is required'),
  body('academicYearId').isUUID().withMessage('Academic year ID is required'),
  body('parameters').isObject().withMessage('Parameters are required'),
  validate,
  AITimetableController.createConstraint
);

/**
 * @route   PUT /api/timetable/ai/constraints/:constraintId
 * @desc    Update timetable constraint
 * @access  Private (Principal, School Director, Academic Coordinator)
 */
router.put('/ai/constraints/:constraintId',
  requireRole(['principal', 'school_director', 'academic_coordinator', 'super_admin']),
  param('constraintId').isUUID().withMessage('Constraint ID must be valid UUID'),
  body('priority').optional().isIn(['low', 'medium', 'high', 'critical']).withMessage('Invalid priority'),
  body('isHard').optional().isBoolean().withMessage('Is hard constraint must be boolean'),
  body('parameters').optional().isObject().withMessage('Parameters must be object'),
  body('isActive').optional().isBoolean().withMessage('Is active must be boolean'),
  validate,
  AITimetableController.updateConstraint
);

/**
 * @route   DELETE /api/timetable/ai/constraints/:constraintId
 * @desc    Delete timetable constraint
 * @access  Private (Principal, School Director, Academic Coordinator)
 */
router.delete('/ai/constraints/:constraintId',
  requireRole(['principal', 'school_director', 'academic_coordinator', 'super_admin']),
  param('constraintId').isUUID().withMessage('Constraint ID must be valid UUID'),
  validate,
  AITimetableController.deleteConstraint
);

// =============================================================================
// TIMETABLE SCHEDULES
// =============================================================================

/**
 * @route   GET /api/timetable/ai/schedules
 * @desc    Get AI-generated timetables
 * @access  Private (All users)
 */
router.get('/ai/schedules',
  query('academicYearId').optional().isUUID().withMessage('Academic year ID must be valid UUID'),
  query('termId').optional().isUUID().withMessage('Term ID must be valid UUID'),
  query('status').optional().isIn(['draft', 'published', 'active', 'archived']).withMessage('Invalid status'),
  query('classId').optional().isUUID().withMessage('Class ID must be valid UUID'),
  query('teacherId').optional().isUUID().withMessage('Teacher ID must be valid UUID'),
  validate,
  AITimetableController.getSchedules
);

/**
 * @route   GET /api/timetable/ai/schedules/:timetableId
 * @desc    Get specific AI-generated timetable
 * @access  Private (All users)
 */
router.get('/ai/schedules/:timetableId',
  param('timetableId').isUUID().withMessage('Timetable ID must be valid UUID'),
  query('view').optional().isIn(['full', 'teacher', 'class', 'room', 'subject']).withMessage('Invalid view type'),
  query('format').optional().isIn(['json', 'pdf', 'excel']).withMessage('Invalid format'),
  validate,
  AITimetableController.getSchedule
);

/**
 * @route   POST /api/timetable/ai/schedules/publish
 * @desc    Publish AI-generated timetable
 * @access  Private (Principal, School Director)
 */
router.post('/ai/schedules/publish',
  requireRole(['principal', 'school_director', 'super_admin']),
  body('timetableId').isUUID().withMessage('Timetable ID is required'),
  body('publishDate').optional().isISO8601().withMessage('Publish date must be valid'),
  body('effectiveDate').isISO8601().withMessage('Effective date is required'),
  body('notifyUsers').optional().isBoolean().withMessage('Notify users must be boolean'),
  body('message').optional().isString().withMessage('Message must be string'),
  validate,
  AITimetableController.publishSchedule
);

/**
 * @route   POST /api/timetable/ai/schedules/:timetableId/archive
 * @desc    Archive timetable
 * @access  Private (Principal, School Director)
 */
router.post('/ai/schedules/:timetableId/archive',
  requireRole(['principal', 'school_director', 'super_admin']),
  param('timetableId').isUUID().withMessage('Timetable ID must be valid UUID'),
  body('reason').notEmpty().withMessage('Archive reason is required'),
  body('replacementTimetableId').optional().isUUID().withMessage('Replacement timetable ID must be valid UUID'),
  validate,
  AITimetableController.archiveSchedule
);

// =============================================================================
// CONFLICT RESOLUTION
// =============================================================================

/**
 * @route   GET /api/timetable/ai/conflicts
 * @desc    Get timetable conflicts
 * @access  Private (Principal, School Director, Academic Coordinator)
 */
router.get('/ai/conflicts',
  requireRole(['principal', 'school_director', 'academic_coordinator', 'super_admin']),
  query('timetableId').optional().isUUID().withMessage('Timetable ID must be valid UUID'),
  query('conflictType').optional().isIn(['teacher_double_booking', 'room_conflict', 'subject_clash', 'resource_unavailable']).withMessage('Invalid conflict type'),
  query('severity').optional().isIn(['low', 'medium', 'high', 'critical']).withMessage('Invalid severity'),
  query('resolved').optional().isBoolean().withMessage('Resolved must be boolean'),
  validate,
  AITimetableController.getConflicts
);

/**
 * @route   POST /api/timetable/ai/conflicts/resolve
 * @desc    Resolve timetable conflicts
 * @access  Private (Principal, School Director, Academic Coordinator)
 */
router.post('/ai/conflicts/resolve',
  requireRole(['principal', 'school_director', 'academic_coordinator', 'super_admin']),
  body('conflictId').isUUID().withMessage('Conflict ID is required'),
  body('resolutionMethod').isIn(['auto_resolve', 'manual_adjust', 'constraint_relax', 'schedule_change']).withMessage('Invalid resolution method'),
  body('resolutionData').optional().isObject().withMessage('Resolution data must be object'),
  body('notes').optional().isString().withMessage('Notes must be string'),
  validate,
  AITimetableController.resolveConflict
);

/**
 * @route   POST /api/timetable/ai/conflicts/bulk-resolve
 * @desc    Bulk resolve timetable conflicts
 * @access  Private (Principal, School Director, Academic Coordinator)
 */
router.post('/ai/conflicts/bulk-resolve',
  requireRole(['principal', 'school_director', 'academic_coordinator', 'super_admin']),
  body('conflictIds').isArray({ min: 1 }).withMessage('Conflict IDs array is required'),
  body('conflictIds.*').isUUID().withMessage('Each conflict ID must be valid UUID'),
  body('resolutionMethod').isIn(['auto_resolve', 'manual_adjust', 'constraint_relax']).withMessage('Invalid resolution method'),
  body('notes').optional().isString().withMessage('Notes must be string'),
  validate,
  AITimetableController.bulkResolveConflicts
);

// =============================================================================
// OPTIMIZATION SUGGESTIONS
// =============================================================================

/**
 * @route   GET /api/timetable/ai/optimization/suggestions
 * @desc    Get AI optimization suggestions
 * @access  Private (Principal, School Director, Academic Coordinator)
 */
router.get('/ai/optimization/suggestions',
  requireRole(['principal', 'school_director', 'academic_coordinator', 'super_admin']),
  query('timetableId').isUUID().withMessage('Timetable ID is required'),
  query('optimizationType').optional().isIn(['workload_balance', 'minimize_gaps', 'resource_utilization', 'student_welfare']).withMessage('Invalid optimization type'),
  query('priority').optional().isIn(['low', 'medium', 'high']).withMessage('Invalid priority'),
  validate,
  AITimetableController.getOptimizationSuggestions
);

/**
 * @route   POST /api/timetable/ai/optimization/apply
 * @desc    Apply optimization suggestions
 * @access  Private (Principal, School Director, Academic Coordinator)
 */
router.post('/ai/optimization/apply',
  requireRole(['principal', 'school_director', 'academic_coordinator', 'super_admin']),
  body('timetableId').isUUID().withMessage('Timetable ID is required'),
  body('suggestionIds').isArray({ min: 1 }).withMessage('Suggestion IDs are required'),
  body('suggestionIds.*').isUUID().withMessage('Each suggestion ID must be valid UUID'),
  body('applyMethod').isIn(['immediate', 'next_generation', 'preview']).withMessage('Invalid apply method'),
  body('notes').optional().isString().withMessage('Notes must be string'),
  validate,
  AITimetableController.applyOptimizations
);

// =============================================================================
// MANUAL ADJUSTMENTS
// =============================================================================

/**
 * @route   POST /api/timetable/ai/manual-adjustments
 * @desc    Make manual adjustments to AI timetable
 * @access  Private (Principal, School Director, Academic Coordinator)
 */
router.post('/ai/manual-adjustments',
  requireRole(['principal', 'school_director', 'academic_coordinator', 'super_admin']),
  body('timetableId').isUUID().withMessage('Timetable ID is required'),
  body('adjustments').isArray({ min: 1 }).withMessage('Adjustments array is required'),
  body('adjustments.*.slotId').notEmpty().withMessage('Slot ID is required'),
  body('adjustments.*.action').isIn(['swap', 'move', 'cancel', 'reschedule']).withMessage('Invalid action'),
  body('adjustments.*.newTeacherId').optional().isUUID().withMessage('New teacher ID must be valid UUID'),
  body('adjustments.*.newSubjectId').optional().isUUID().withMessage('New subject ID must be valid UUID'),
  body('adjustments.*.newRoomId').optional().isUUID().withMessage('New room ID must be valid UUID'),
  body('adjustments.*.newTimeSlot').optional().isString().withMessage('New time slot must be string'),
  body('adjustments.*.reason').notEmpty().withMessage('Adjustment reason is required'),
  body('validateConstraints').optional().isBoolean().withMessage('Validate constraints must be boolean'),
  body('notifyAffectedParties').optional().isBoolean().withMessage('Notify affected parties must be boolean'),
  validate,
  AITimetableController.makeManualAdjustments
);

/**
 * @route   GET /api/timetable/ai/adjustment-history/:timetableId
 * @desc    Get manual adjustment history
 * @access  Private (Principal, School Director, Academic Coordinator)
 */
router.get('/ai/adjustment-history/:timetableId',
  requireRole(['principal', 'school_director', 'academic_coordinator', 'super_admin']),
  param('timetableId').isUUID().withMessage('Timetable ID must be valid UUID'),
  query('adjustmentType').optional().isIn(['swap', 'move', 'cancel', 'reschedule']).withMessage('Invalid adjustment type'),
  query('startDate').optional().isISO8601().withMessage('Start date must be valid'),
  query('endDate').optional().isISO8601().withMessage('End date must be valid'),
  validate,
  AITimetableController.getAdjustmentHistory
);

// =============================================================================
// WORKLOAD ANALYSIS
// =============================================================================

/**
 * @route   GET /api/timetable/ai/teacher-workload
 * @desc    Get teacher workload analysis
 * @access  Private (Principal, School Director, Academic Coordinator, HR)
 */
router.get('/ai/teacher-workload',
  requireRole(['principal', 'school_director', 'academic_coordinator', 'hr', 'super_admin']),
  query('timetableId').optional().isUUID().withMessage('Timetable ID must be valid UUID'),
  query('teacherId').optional().isUUID().withMessage('Teacher ID must be valid UUID'),
  query('department').optional().isString().withMessage('Department must be string'),
  query('analysisType').optional().isIn(['hours_per_week', 'subject_distribution', 'class_load', 'free_periods']).withMessage('Invalid analysis type'),
  validate,
  AITimetableController.getTeacherWorkload
);

/**
 * @route   GET /api/timetable/ai/room-utilization
 * @desc    Get room utilization analysis
 * @access  Private (Principal, School Director, Academic Coordinator)
 */
router.get('/ai/room-utilization',
  requireRole(['principal', 'school_director', 'academic_coordinator', 'super_admin']),
  query('timetableId').optional().isUUID().withMessage('Timetable ID must be valid UUID'),
  query('roomId').optional().isUUID().withMessage('Room ID must be valid UUID'),
  query('roomType').optional().isIn(['classroom', 'laboratory', 'library', 'hall', 'sports']).withMessage('Invalid room type'),
  query('utilizationThreshold').optional().isFloat({ min: 0, max: 100 }).withMessage('Utilization threshold must be between 0 and 100'),
  validate,
  AITimetableController.getRoomUtilization
);

/**
 * @route   GET /api/timetable/ai/subject-distribution
 * @desc    Get subject distribution analysis
 * @access  Private (Principal, School Director, Academic Coordinator)
 */
router.get('/ai/subject-distribution',
  requireRole(['principal', 'school_director', 'academic_coordinator', 'super_admin']),
  query('timetableId').isUUID().withMessage('Timetable ID is required'),
  query('classId').optional().isUUID().withMessage('Class ID must be valid UUID'),
  query('subjectId').optional().isUUID().withMessage('Subject ID must be valid UUID'),
  query('distributionType').optional().isIn(['daily', 'weekly', 'optimal_timing']).withMessage('Invalid distribution type'),
  validate,
  AITimetableController.getSubjectDistribution
);

// =============================================================================
// SCENARIO COMPARISON
// =============================================================================

/**
 * @route   POST /api/timetable/ai/scenarios/compare
 * @desc    Compare different timetable scenarios
 * @access  Private (Principal, School Director, Academic Coordinator)
 */
router.post('/ai/scenarios/compare',
  requireRole(['principal', 'school_director', 'academic_coordinator', 'super_admin']),
  body('timetableIds').isArray({ min: 2, max: 5 }).withMessage('2-5 timetable IDs are required for comparison'),
  body('timetableIds.*').isUUID().withMessage('Each timetable ID must be valid UUID'),
  body('comparisonCriteria').isArray({ min: 1 }).withMessage('Comparison criteria are required'),
  body('comparisonCriteria.*').isIn(['workload_balance', 'room_utilization', 'conflict_count', 'constraint_satisfaction', 'optimization_score']).withMessage('Invalid comparison criteria'),
  body('weightings').optional().isObject().withMessage('Weightings must be object'),
  validate,
  AITimetableController.compareScenarios
);

/**
 * @route   POST /api/timetable/ai/scenarios/save
 * @desc    Save timetable scenario
 * @access  Private (Principal, School Director, Academic Coordinator)
 */
router.post('/ai/scenarios/save',
  requireRole(['principal', 'school_director', 'academic_coordinator', 'super_admin']),
  body('timetableId').isUUID().withMessage('Timetable ID is required'),
  body('scenarioName').notEmpty().withMessage('Scenario name is required'),
  body('description').optional().isString().withMessage('Description must be string'),
  body('tags').optional().isArray().withMessage('Tags must be array'),
  body('parameters').optional().isObject().withMessage('Parameters must be object'),
  validate,
  AITimetableController.saveScenario
);

// =============================================================================
// AI ANALYTICS & INSIGHTS
// =============================================================================

/**
 * @route   GET /api/timetable/ai/analytics/performance
 * @desc    Get AI timetable performance analytics
 * @access  Private (Principal, School Director, Academic Coordinator)
 */
router.get('/ai/analytics/performance',
  requireRole(['principal', 'school_director', 'academic_coordinator', 'super_admin']),
  query('timetableId').optional().isUUID().withMessage('Timetable ID must be valid UUID'),
  query('startDate').optional().isISO8601().withMessage('Start date must be valid'),
  query('endDate').optional().isISO8601().withMessage('End date must be valid'),
  query('metricType').optional().isIn(['generation_time', 'conflict_resolution', 'optimization_score', 'user_satisfaction']).withMessage('Invalid metric type'),
  validate,
  AITimetableController.getPerformanceAnalytics
);

/**
 * @route   GET /api/timetable/ai/analytics/trends
 * @desc    Get AI timetable trends
 * @access  Private (Principal, School Director, Academic Coordinator)
 */
router.get('/ai/analytics/trends',
  requireRole(['principal', 'school_director', 'academic_coordinator', 'super_admin']),
  query('period').optional().isIn(['weekly', 'monthly', 'termly', 'yearly']).withMessage('Invalid period'),
  query('trendType').optional().isIn(['usage_patterns', 'efficiency_improvement', 'constraint_evolution', 'optimization_success']).withMessage('Invalid trend type'),
  validate,
  AITimetableController.getTrendAnalytics
);

module.exports = router;