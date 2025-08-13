const express = require('express');
const router = express.Router();
const { authenticate, requireRole, requireUserType } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const { body, query, param } = require('express-validator');
const ExaminationController = require('../controllers/examinationController');

// Apply authentication to all routes
router.use(authenticate);
router.use(requireUserType(['school_user', 'admin_user']));

// =============================================================================
// EXAMINATION SCHEDULE MANAGEMENT
// =============================================================================

/**
 * @route   GET /api/examinations/schedules
 * @desc    Get examination schedules
 * @access  Private (All school staff)
 */
router.get('/schedules',
  query('academicYear').optional().isString().withMessage('Academic year must be a string'),
  query('term').optional().isString().withMessage('Term must be a string'),
  query('examType').optional().isIn(['mid_term', 'end_term', 'annual', 'mock', 'knec']).withMessage('Invalid exam type'),
  query('status').optional().isIn(['draft', 'published', 'in_progress', 'completed']).withMessage('Invalid status'),
  validate,
  ExaminationController.getExaminationSchedules
);

/**
 * @route   POST /api/examinations/schedules
 * @desc    Create examination schedule
 * @access  Private (Principal, School Director, Academic Coordinator)
 */
router.post('/schedules',
  requireRole(['principal', 'school_director', 'academic_coordinator']),
  body('name').notEmpty().withMessage('Examination name is required'),
  body('examType').isIn(['mid_term', 'end_term', 'annual', 'mock', 'knec']).withMessage('Invalid exam type'),
  body('startDate').isISO8601().withMessage('Start date must be a valid date'),
  body('endDate').isISO8601().withMessage('End date must be a valid date'),
  body('academicYearId').isUUID().withMessage('Academic year ID must be a valid UUID'),
  body('termId').isUUID().withMessage('Term ID must be a valid UUID'),
  body('curriculumType').isIn(['CBC', 'IGCSE', '8-4-4', 'IB', 'Cambridge']).withMessage('Invalid curriculum type'),
  body('gradeLevels').isArray().withMessage('Grade levels must be an array'),
  body('subjects').isArray().withMessage('Subjects must be an array'),
  validate,
  ExaminationController.createExaminationSchedule
);

/**
 * @route   PUT /api/examinations/schedules/:scheduleId
 * @desc    Update examination schedule
 * @access  Private (Principal, School Director, Academic Coordinator)
 */
router.put('/schedules/:scheduleId',
  requireRole(['principal', 'school_director', 'academic_coordinator']),
  param('scheduleId').isUUID().withMessage('Schedule ID must be a valid UUID'),
  body('name').optional().notEmpty().withMessage('Examination name cannot be empty'),
  body('examType').optional().isIn(['mid_term', 'end_term', 'annual', 'mock', 'knec']).withMessage('Invalid exam type'),
  body('startDate').optional().isISO8601().withMessage('Start date must be a valid date'),
  body('endDate').optional().isISO8601().withMessage('End date must be a valid date'),
  validate,
  ExaminationController.updateExaminationSchedule
);

/**
 * @route   DELETE /api/examinations/schedules/:scheduleId
 * @desc    Delete examination schedule
 * @access  Private (Principal, School Director)
 */
router.delete('/schedules/:scheduleId',
  requireRole(['principal', 'school_director']),
  param('scheduleId').isUUID().withMessage('Schedule ID must be a valid UUID'),
  validate,
  ExaminationController.deleteExaminationSchedule
);

// Aliases to satisfy frontend API map
// GET /api/examinations/papers → map to question bank fetch
router.get('/papers',
  query('subject').optional().isString(),
  query('gradeLevel').optional().isInt({ min: 1, max: 12 }),
  (req, res, next) => {
    // adapt query param names to controller expectations
    req.query.subject_id = req.query.subject;
    delete req.query.subject;
    return ExaminationController.getQuestionBank(req, res, next);
  }
);

// Approvals list stub aligning with frontend GET /api/examinations/approvals
router.get('/approvals',
  async (req, res, next) => {
    try {
      const { query } = require('../config/database');
      const schoolId = req.user.school_id;
      const result = await query(`
        SELECT id, request_type as type, request_title as title, requested_by, approval_status as status, requested_at
        FROM approval_requests
        WHERE school_id = $1 AND request_type IN ('examination','exam_schedule','exam_results') AND approval_status = 'pending'
        ORDER BY requested_at DESC
        LIMIT 100
      `, [schoolId]);
      res.json({ success: true, data: result.rows });
    } catch (error) { next(error); }
  }
);

// Approve/reject examination-related approval requests
router.put('/approvals/:id/approve',
  async (req, res, next) => {
    try {
      const { query } = require('../config/database');
      const id = req.params.id;
      const userId = req.user.userId || req.user.id;
      const result = await query(`
        UPDATE approval_requests
        SET approval_status = 'approved', final_approver_id = $1, final_approved_at = NOW(), updated_at = NOW()
        WHERE id = $2 AND school_id = $3
        RETURNING id, approval_status as status, final_approved_at
      `, [userId, id, req.user.school_id || req.user.schoolId]);
      if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Approval request not found' });
      return res.json({ success: true, message: 'Approval request approved', data: result.rows[0] });
    } catch (e) { next(e); }
  }
);

router.put('/approvals/:id/reject',
  async (req, res, next) => {
    try {
      const { query } = require('../config/database');
      const id = req.params.id;
      const { reason } = req.body || {};
      const result = await query(`
        UPDATE approval_requests
        SET approval_status = 'rejected', final_rejection_reason = $1, updated_at = NOW()
        WHERE id = $2 AND school_id = $3
        RETURNING id, approval_status as status
      `, [reason || null, id, req.user.school_id || req.user.schoolId]);
      if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Approval request not found' });
      return res.json({ success: true, message: 'Approval request rejected', data: result.rows[0] });
    } catch (e) { next(e); }
  }
);

/**
 * @route   POST /api/examinations/schedules/:scheduleId/publish
 * @desc    Publish examination schedule
 * @access  Private (Principal, School Director, Academic Coordinator)
 */
router.post('/schedules/:scheduleId/publish',
  requireRole(['principal', 'school_director', 'academic_coordinator']),
  param('scheduleId').isUUID().withMessage('Schedule ID must be a valid UUID'),
  validate,
  ExaminationController.publishExaminationSchedule
);

// =============================================================================
// QUESTION BANK MANAGEMENT
// =============================================================================

/**
 * @route   GET /api/examinations/question-bank
 * @desc    Get question bank
 * @access  Private (Teachers, Academic Coordinators, Principal, School Director)
 */
router.get('/question-bank',
  requireRole(['teacher', 'academic_coordinator', 'principal', 'school_director']),
  query('subject').optional().isString().withMessage('Subject must be a string'),
  query('gradeLevel').optional().isInt({ min: 1, max: 12 }).withMessage('Grade level must be between 1 and 12'),
  query('curriculumType').optional().isIn(['CBC', 'IGCSE', '8-4-4', 'IB', 'Cambridge']).withMessage('Invalid curriculum type'),
  query('difficulty').optional().isIn(['easy', 'medium', 'hard']).withMessage('Invalid difficulty level'),
  query('questionType').optional().isIn(['multiple_choice', 'true_false', 'short_answer', 'essay', 'practical']).withMessage('Invalid question type'),
  validate,
  ExaminationController.getQuestionBank
);

/**
 * @route   POST /api/examinations/question-bank
 * @desc    Add question to bank
 * @access  Private (Teachers, Academic Coordinators, Principal, School Director)
 */
router.post('/question-bank',
  requireRole(['teacher', 'academic_coordinator', 'principal', 'school_director']),
  body('question').notEmpty().withMessage('Question text is required'),
  body('questionType').isIn(['multiple_choice', 'true_false', 'short_answer', 'essay', 'practical']).withMessage('Invalid question type'),
  body('subject').notEmpty().withMessage('Subject is required'),
  body('gradeLevel').isInt({ min: 1, max: 12 }).withMessage('Grade level must be between 1 and 12'),
  body('curriculumType').isIn(['CBC', 'IGCSE', '8-4-4', 'IB', 'Cambridge']).withMessage('Invalid curriculum type'),
  body('difficulty').isIn(['easy', 'medium', 'hard']).withMessage('Invalid difficulty level'),
  body('marks').isInt({ min: 1 }).withMessage('Marks must be a positive integer'),
  body('options').optional().isArray().withMessage('Options must be an array'),
  body('correctAnswer').optional().notEmpty().withMessage('Correct answer cannot be empty'),
  body('explanation').optional().isString().withMessage('Explanation must be a string'),
  validate,
  ExaminationController.addQuestionToBank
);

/**
 * @route   PUT /api/examinations/question-bank/:questionId
 * @desc    Update question in bank
 * @access  Private (Teachers, Academic Coordinators, Principal, School Director)
 */
router.put('/question-bank/:questionId',
  requireRole(['teacher', 'academic_coordinator', 'principal', 'school_director']),
  param('questionId').isUUID().withMessage('Question ID must be a valid UUID'),
  body('question').optional().notEmpty().withMessage('Question text cannot be empty'),
  body('questionType').optional().isIn(['multiple_choice', 'true_false', 'short_answer', 'essay', 'practical']).withMessage('Invalid question type'),
  body('difficulty').optional().isIn(['easy', 'medium', 'hard']).withMessage('Invalid difficulty level'),
  body('marks').optional().isInt({ min: 1 }).withMessage('Marks must be a positive integer'),
  validate,
  ExaminationController.updateQuestionInBank
);

// =============================================================================
// EXAMINATION REGISTRATION
// =============================================================================

/**
 * @route   GET /api/examinations/registrations
 * @desc    Get examination registrations
 * @access  Private (All school staff)
 */
router.get('/registrations',
  query('scheduleId').optional().isUUID().withMessage('Schedule ID must be a valid UUID'),
  query('studentId').optional().isUUID().withMessage('Student ID must be a valid UUID'),
  query('status').optional().isIn(['registered', 'confirmed', 'cancelled']).withMessage('Invalid status'),
  validate,
  ExaminationController.getExaminationRegistrations
);

/**
 * @route   POST /api/examinations/register-student
 * @desc    Register student for examination
 * @access  Private (Teachers, Academic Coordinators, Principal, School Director)
 */
router.post('/register-student',
  requireRole(['teacher', 'academic_coordinator', 'principal', 'school_director']),
  body('scheduleId').isUUID().withMessage('Schedule ID must be a valid UUID'),
  body('studentId').isUUID().withMessage('Student ID must be a valid UUID'),
  body('subjects').isArray().withMessage('Subjects must be an array'),
  body('specialRequirements').optional().isString().withMessage('Special requirements must be a string'),
  validate,
  ExaminationController.registerStudentForExamination
);

/**
 * @route   POST /api/examinations/bulk-register
 * @desc    Bulk register students for examination
 * @access  Private (Academic Coordinators, Principal, School Director)
 */
router.post('/bulk-register',
  requireRole(['academic_coordinator', 'principal', 'school_director']),
  body('scheduleId').isUUID().withMessage('Schedule ID must be a valid UUID'),
  body('classIds').optional().isArray().withMessage('Class IDs must be an array'),
  body('studentIds').optional().isArray().withMessage('Student IDs must be an array'),
  body('subjects').isArray().withMessage('Subjects must be an array'),
  validate,
  ExaminationController.bulkRegisterStudents
);

// =============================================================================
// EXAMINATION RESULTS
// =============================================================================

/**
 * @route   GET /api/examinations/results
 * @desc    Get examination results
 * @access  Private (All school staff)
 */
router.get('/results',
  query('scheduleId').optional().isUUID().withMessage('Schedule ID must be a valid UUID'),
  query('studentId').optional().isUUID().withMessage('Student ID must be a valid UUID'),
  query('subject').optional().isString().withMessage('Subject must be a string'),
  query('published').optional().isBoolean().withMessage('Published must be boolean'),
  validate,
  ExaminationController.getExaminationResults
);

/**
 * @route   POST /api/examinations/results
 * @desc    Submit examination results
 * @access  Private (Teachers, Academic Coordinators, Principal, School Director)
 */
router.post('/results',
  requireRole(['teacher', 'academic_coordinator', 'principal', 'school_director']),
  body('scheduleId').isUUID().withMessage('Schedule ID must be a valid UUID'),
  body('studentId').isUUID().withMessage('Student ID must be a valid UUID'),
  body('subject').notEmpty().withMessage('Subject is required'),
  body('marks').isInt({ min: 0 }).withMessage('Marks must be a non-negative integer'),
  body('totalMarks').isInt({ min: 1 }).withMessage('Total marks must be a positive integer'),
  body('grade').optional().isString().withMessage('Grade must be a string'),
  body('remarks').optional().isString().withMessage('Remarks must be a string'),
  validate,
  ExaminationController.submitExaminationResult
);

/**
 * @route   POST /api/examinations/results/publish
 * @desc    Publish examination results
 * @access  Private (Principal, School Director, Academic Coordinator)
 */
router.post('/results/publish',
  requireRole(['principal', 'school_director', 'academic_coordinator']),
  body('scheduleId').isUUID().withMessage('Schedule ID must be a valid UUID'),
  body('subjects').optional().isArray().withMessage('Subjects must be an array'),
  body('releaseToParents').optional().isBoolean().withMessage('Release to parents must be boolean'),
  validate,
  ExaminationController.publishExaminationResults
);

// =============================================================================
// EXAMINATION CERTIFICATES
// =============================================================================

/**
 * @route   GET /api/examinations/certificates/generate
 * @desc    Generate examination certificates
 * @access  Private (Principal, School Director, Academic Coordinator)
 */
router.post('/certificates/generate',
  requireRole(['principal', 'school_director', 'academic_coordinator']),
  body('scheduleId').isUUID().withMessage('Schedule ID must be a valid UUID'),
  body('studentIds').isArray().withMessage('Student IDs must be an array'),
  body('certificateType').isIn(['completion', 'achievement', 'participation']).withMessage('Invalid certificate type'),
  validate,
  ExaminationController.generateExaminationCertificates
);

// =============================================================================
// KNEC INTEGRATION
// =============================================================================

/**
 * @route   GET /api/examinations/knec-integration
 * @desc    Get KNEC integration status and data
 * @access  Private (Principal, School Director, Academic Coordinator)
 */
router.get('/knec-integration',
  requireRole(['principal', 'school_director', 'academic_coordinator']),
  ExaminationController.getKnecIntegration
);

/**
 * @route   POST /api/examinations/knec-integration/sync
 * @desc    Sync with KNEC system
 * @access  Private (Principal, School Director, Academic Coordinator)
 */
router.post('/knec-integration/sync',
  requireRole(['principal', 'school_director', 'academic_coordinator']),
  body('examType').isIn(['kcpe', 'kcse']).withMessage('Invalid KNEC exam type'),
  body('year').isInt({ min: 2020, max: 2030 }).withMessage('Year must be between 2020 and 2030'),
  validate,
  ExaminationController.syncWithKnec
);

/**
 * @route   POST /api/examinations/knec-integration/upload-results
 * @desc    Upload results to KNEC
 * @access  Private (Principal, School Director)
 */
router.post('/knec-integration/upload-results',
  requireRole(['principal', 'school_director']),
  body('scheduleId').isUUID().withMessage('Schedule ID must be a valid UUID'),
  body('examType').isIn(['kcpe', 'kcse']).withMessage('Invalid KNEC exam type'),
  validate,
  ExaminationController.uploadResultsToKnec
);

// =============================================================================
// EXAMINATION ANALYTICS
// =============================================================================

/**
 * @route   GET /api/examinations/analytics/performance
 * @desc    Get examination performance analytics
 * @access  Private (All school staff)
 */
router.get('/analytics/performance',
  query('scheduleId').optional().isUUID().withMessage('Schedule ID must be a valid UUID'),
  query('subject').optional().isString().withMessage('Subject must be a string'),
  query('gradeLevel').optional().isInt({ min: 1, max: 12 }).withMessage('Grade level must be between 1 and 12'),
  validate,
  ExaminationController.getExaminationAnalytics
);

/**
 * @route   GET /api/examinations/analytics/trends
 * @desc    Get examination performance trends
 * @access  Private (All school staff)
 */
router.get('/analytics/trends',
  query('subject').optional().isString().withMessage('Subject must be a string'),
  query('gradeLevel').optional().isInt({ min: 1, max: 12 }).withMessage('Grade level must be between 1 and 12'),
  query('period').optional().isIn(['term', 'year', 'all']).withMessage('Invalid period'),
  validate,
  ExaminationController.getExaminationTrends
);

// =============================================================================
// EXAMINATION REPORTS
// =============================================================================

/**
 * @route   GET /api/examinations/reports/student/:studentId
 * @desc    Generate student examination report
 * @access  Private (All school staff)
 */
router.get('/reports/student/:studentId',
  param('studentId').isUUID().withMessage('Student ID must be a valid UUID'),
  query('scheduleId').optional().isUUID().withMessage('Schedule ID must be a valid UUID'),
  validate,
  ExaminationController.generateStudentExaminationReport
);

/**
 * @route   GET /api/examinations/reports/class/:classId
 * @desc    Generate class examination report
 * @access  Private (Teachers, Academic Coordinators, Principal, School Director)
 */
router.get('/reports/class/:classId',
  requireRole(['teacher', 'academic_coordinator', 'principal', 'school_director']),
  param('classId').isUUID().withMessage('Class ID must be a valid UUID'),
  query('scheduleId').optional().isUUID().withMessage('Schedule ID must be a valid UUID'),
  validate,
  ExaminationController.generateClassExaminationReport
);

/**
 * @route   GET /api/examinations/reports/school
 * @desc    Generate school examination report
 * @access  Private (Principal, School Director, Academic Coordinator)
 */
router.get('/reports/school',
  requireRole(['principal', 'school_director', 'academic_coordinator']),
  query('scheduleId').optional().isUUID().withMessage('Schedule ID must be a valid UUID'),
  query('year').optional().isInt({ min: 2020, max: 2030 }).withMessage('Year must be between 2020 and 2030'),
  validate,
  ExaminationController.generateSchoolExaminationReport
);

module.exports = router;