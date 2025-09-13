const express = require('express');
const router = express.Router();
const { authenticate, requireRole, requireUserType } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const { body, query, param } = require('express-validator');
const SchoolController = require('../controllers/schoolController');
const { query: dbQuery } = require('../config/database');

// Apply authentication to all routes
router.use(authenticate);
router.use(requireUserType(['school_user', 'admin_user']));

// =============================================================================
// CLASS MANAGEMENT WITH MULTI-CURRICULUM SUPPORT
// =============================================================================

/**
 * @route   GET /api/school/classes
 * @desc    Get all classes with multi-curriculum support
 * @access  Private (All school staff)
 */
router.get('/classes',
  query('curriculumType').optional().isIn(['CBC', 'IGCSE', '8-4-4', 'IB', 'Cambridge']).withMessage('Invalid curriculum type'),
  query('gradeLevel').optional().isInt({ min: 1, max: 12 }).withMessage('Grade level must be between 1 and 12'),
  query('academicYear').optional().isString().withMessage('Academic year must be a string'),
  query('classTeacher').optional().isUUID().withMessage('Class teacher must be a valid UUID'),
  validate,
  SchoolController.getClasses
);

/**
 * @route   POST /api/school/classes
 * @desc    Create new class with curriculum support
 * @access  Private (Principal, School Director)
 */
router.post('/classes',
  requireRole(['principal', 'school_director']),
  body('name').notEmpty().withMessage('Class name is required'),
  body('curriculumType').isIn(['CBC', 'IGCSE', '8-4-4', 'IB', 'Cambridge']).withMessage('Invalid curriculum type'),
  body('gradeLevel').isInt({ min: 1, max: 12 }).withMessage('Grade level must be between 1 and 12'),
  body('capacity').isInt({ min: 1, max: 100 }).withMessage('Capacity must be between 1 and 100'),
  body('classTeacherId').optional().isUUID().withMessage('Class teacher ID must be a valid UUID'),
  body('academicYearId').isUUID().withMessage('Academic year ID must be a valid UUID'),
  body('subjects').isArray().withMessage('Subjects must be an array'),
  body('room').optional().isString().withMessage('Room must be a string'),
  body('stream').optional().isString().withMessage('Stream must be a string'),
  validate,
  SchoolController.createClass
);

/**
 * @route   PUT /api/school/classes/:classId
 * @desc    Update class information
 * @access  Private (Principal, School Director)
 */
router.put('/classes/:classId',
  requireRole(['principal', 'school_director']),
  param('classId').isUUID().withMessage('Class ID must be a valid UUID'),
  body('name').optional().notEmpty().withMessage('Class name cannot be empty'),
  body('capacity').optional().isInt({ min: 1, max: 100 }).withMessage('Capacity must be between 1 and 100'),
  body('classTeacherId').optional().isUUID().withMessage('Class teacher ID must be a valid UUID'),
  body('room').optional().isString().withMessage('Room must be a string'),
  validate,
  SchoolController.updateClass
);

/**
 * @route   DELETE /api/school/classes/:classId
 * @desc    Delete class
 * @access  Private (Principal, School Director)
 */
router.delete('/classes/:classId',
  requireRole(['principal', 'school_director']),
  param('classId').isUUID().withMessage('Class ID must be a valid UUID'),
  validate,
  SchoolController.deleteClass
);

/**
 * @route   GET /api/school/classes/analytics
 * @desc    Get class analytics
 * @access  Private (All school staff)
 */
router.get('/classes/analytics',
  query('academicYearId').optional().isUUID().withMessage('Academic year ID must be a valid UUID'),
  query('curriculumType').optional().isIn(['CBC', 'IGCSE', '8-4-4', 'IB', 'Cambridge']).withMessage('Invalid curriculum type'),
  validate,
  SchoolController.getClassAnalytics
);

// =============================================================================
// SUBJECT MANAGEMENT
// =============================================================================

/**
 * @route   GET /api/school/subjects
 * @desc    Get all subjects
 * @access  Private (All school staff)
 */
router.get('/subjects',
  query('curriculumType').optional().isIn(['CBC', 'IGCSE', '8-4-4', 'IB', 'Cambridge']).withMessage('Invalid curriculum type'),
  query('gradeLevel').optional().isInt({ min: 1, max: 12 }).withMessage('Grade level must be between 1 and 12'),
  query('active').optional().isBoolean().withMessage('Active must be boolean'),
  validate,
  SchoolController.getSubjects
);

/**
 * @route   POST /api/school/subjects
 * @desc    Create new subject
 * @access  Private (Principal, School Director, Academic Coordinator)
 */
router.post('/subjects',
  requireRole(['principal', 'school_director', 'academic_coordinator']),
  body('name').notEmpty().withMessage('Subject name is required'),
  body('code').notEmpty().withMessage('Subject code is required'),
  body('curriculumType').isIn(['CBC', 'IGCSE', '8-4-4', 'IB', 'Cambridge']).withMessage('Invalid curriculum type'),
  body('gradeLevel').isInt({ min: 1, max: 12 }).withMessage('Grade level must be between 1 and 12'),
  body('category').optional().isIn(['core', 'elective', 'extra_curricular']).withMessage('Invalid category'),
  body('description').optional().isString().withMessage('Description must be a string'),
  body('maxMarks').optional().isInt({ min: 1 }).withMessage('Max marks must be a positive integer'),
  body('passingMarks').optional().isInt({ min: 1 }).withMessage('Passing marks must be a positive integer'),
  validate,
  SchoolController.createSubject
);

/**
 * @route   GET /api/school/subjects/by-curriculum/:curriculumType
 * @desc    Get subjects by curriculum type
 * @access  Private (All school staff)
 */
router.get('/subjects/by-curriculum/:curriculumType',
  param('curriculumType').isIn(['CBC', 'IGCSE', '8-4-4', 'IB', 'Cambridge']).withMessage('Invalid curriculum type'),
  query('gradeLevel').optional().isInt({ min: 1, max: 12 }).withMessage('Grade level must be between 1 and 12'),
  validate,
  SchoolController.getSubjectsByCurriculum
);

// =============================================================================
// TEACHER ASSIGNMENTS
// =============================================================================

/**
 * @route   GET /api/school/teacher-assignments
 * @desc    Get teacher assignments
 * @access  Private (All school staff)
 */
router.get('/teacher-assignments',
  query('teacherId').optional().isUUID().withMessage('Teacher ID must be a valid UUID'),
  query('classId').optional().isUUID().withMessage('Class ID must be a valid UUID'),
  query('subjectId').optional().isUUID().withMessage('Subject ID must be a valid UUID'),
  query('academicYear').optional().isString().withMessage('Academic year must be a string'),
  validate,
  SchoolController.getTeacherAssignments
);

/**
 * @route   POST /api/school/teacher-assignments
 * @desc    Create teacher assignment
 * @access  Private (Principal, School Director, Academic Coordinator)
 */
router.post('/teacher-assignments',
  requireRole(['principal', 'school_director', 'academic_coordinator']),
  body('teacherId').isUUID().withMessage('Teacher ID must be a valid UUID'),
  body('classId').optional().isUUID().withMessage('Class ID must be a valid UUID'),
  body('subjectIds').isArray().withMessage('Subject IDs must be an array'),
  body('role').isIn(['subject_teacher', 'class_teacher', 'head_teacher']).withMessage('Invalid role'),
  body('curriculumExpertise').optional().isArray().withMessage('Curriculum expertise must be an array'),
  body('academicYearId').isUUID().withMessage('Academic year ID must be a valid UUID'),
  body('termId').optional().isUUID().withMessage('Term ID must be a valid UUID'),
  validate,
  SchoolController.createTeacherAssignment
);

/**
 * @route   PUT /api/school/teacher-assignments/:assignmentId
 * @desc    Update teacher assignment
 * @access  Private (Principal, School Director, Academic Coordinator)
 */
router.put('/teacher-assignments/:assignmentId',
  requireRole(['principal', 'school_director', 'academic_coordinator']),
  param('assignmentId').isUUID().withMessage('Assignment ID must be a valid UUID'),
  body('classId').optional().isUUID().withMessage('Class ID must be a valid UUID'),
  body('subjectIds').optional().isArray().withMessage('Subject IDs must be an array'),
  body('role').optional().isIn(['subject_teacher', 'class_teacher', 'head_teacher']).withMessage('Invalid role'),
  body('curriculumExpertise').optional().isArray().withMessage('Curriculum expertise must be an array'),
  validate,
  SchoolController.updateTeacherAssignment
);

/**
 * @route   DELETE /api/school/teacher-assignments/:assignmentId
 * @desc    Delete teacher assignment
 * @access  Private (Principal, School Director)
 */
router.delete('/teacher-assignments/:assignmentId',
  requireRole(['principal', 'school_director']),
  param('assignmentId').isUUID().withMessage('Assignment ID must be a valid UUID'),
  validate,
  SchoolController.deleteTeacherAssignment
);

// =============================================================================
// ACADEMIC YEAR MANAGEMENT
// =============================================================================

/**
 * @route   GET /api/school/academic-years
 * @desc    Get academic years
 * @access  Private (All school staff)
 */
router.get('/academic-years',
  query('active').optional().isBoolean().withMessage('Active must be boolean'),
  query('current').optional().isBoolean().withMessage('Current must be boolean'),
  validate,
  SchoolController.getAcademicYears
);

/**
 * @route   POST /api/school/academic-years
 * @desc    Create academic year
 * @access  Private (Principal, School Director)
 */
router.post('/academic-years',
  requireRole(['principal', 'school_director']),
  body('name').notEmpty().withMessage('Academic year name is required'),
  body('startDate').isISO8601().withMessage('Start date must be a valid date'),
  body('endDate').isISO8601().withMessage('End date must be a valid date'),
  body('description').optional().isString().withMessage('Description must be a string'),
  body('isCurrent').optional().isBoolean().withMessage('Is current must be boolean'),
  validate,
  SchoolController.createAcademicYear
);

/**
 * @route   PUT /api/school/academic-years/:yearId
 * @desc    Update academic year
 * @access  Private (Principal, School Director)
 */
router.put('/academic-years/:yearId',
  requireRole(['principal', 'school_director']),
  param('yearId').isUUID().withMessage('Year ID must be a valid UUID'),
  body('name').optional().notEmpty().withMessage('Academic year name cannot be empty'),
  body('startDate').optional().isISO8601().withMessage('Start date must be a valid date'),
  body('endDate').optional().isISO8601().withMessage('End date must be a valid date'),
  body('isCurrent').optional().isBoolean().withMessage('Is current must be boolean'),
  validate,
  SchoolController.updateAcademicYear
);

// =============================================================================
// ACADEMIC TERM MANAGEMENT
// =============================================================================

/**
 * @route   GET /api/school/academic-terms
 * @desc    Get academic terms
 * @access  Private (All school staff)
 */
router.get('/academic-terms',
  query('academicYearId').optional().isUUID().withMessage('Academic year ID must be a valid UUID'),
  query('active').optional().isBoolean().withMessage('Active must be boolean'),
  query('current').optional().isBoolean().withMessage('Current must be boolean'),
  validate,
  SchoolController.getAcademicTerms
);

/**
 * @route   POST /api/school/academic-terms
 * @desc    Create academic term
 * @access  Private (Principal, School Director)
 */
router.post('/academic-terms',
  requireRole(['principal', 'school_director']),
  body('name').notEmpty().withMessage('Term name is required'),
  body('academicYearId').isUUID().withMessage('Academic year ID must be a valid UUID'),
  body('startDate').isISO8601().withMessage('Start date must be a valid date'),
  body('endDate').isISO8601().withMessage('End date must be a valid date'),
  body('termNumber').isInt({ min: 1, max: 4 }).withMessage('Term number must be between 1 and 4'),
  body('isCurrent').optional().isBoolean().withMessage('Is current must be boolean'),
  validate,
  SchoolController.createAcademicTerm
);

/**
 * @route   PUT /api/school/academic-terms/:termId
 * @desc    Update academic term
 * @access  Private (Principal, School Director)
 */
router.put('/academic-terms/:termId',
  requireRole(['principal', 'school_director']),
  param('termId').isUUID().withMessage('Term ID must be a valid UUID'),
  body('name').optional().notEmpty().withMessage('Term name cannot be empty'),
  body('startDate').optional().isISO8601().withMessage('Start date must be a valid date'),
  body('endDate').optional().isISO8601().withMessage('End date must be a valid date'),
  body('isCurrent').optional().isBoolean().withMessage('Is current must be boolean'),
  validate,
  SchoolController.updateAcademicTerm
);

// =============================================================================
// SCHOOL SETTINGS AND CONFIGURATION
// =============================================================================

/**
 * @route   GET /api/school/settings
 * @desc    Get school settings
 * @access  Private (All school staff)
 */
router.get('/settings',
  SchoolController.getSchoolSettings
);

/**
 * @route   PUT /api/school/settings
 * @desc    Update school settings
 * @access  Private (Principal, School Director)
 */
router.put('/settings',
  requireRole(['principal', 'school_director']),
  body('schoolName').optional().notEmpty().withMessage('School name cannot be empty'),
  body('logo').optional().isString().withMessage('Logo must be a string'),
  body('address').optional().isObject().withMessage('Address must be an object'),
  body('contact').optional().isObject().withMessage('Contact must be an object'),
  body('academicSettings').optional().isObject().withMessage('Academic settings must be an object'),
  body('gradingSystem').optional().isObject().withMessage('Grading system must be an object'),
  validate,
  SchoolController.updateSchoolSettings
);

// =============================================================================
// SCHOOL STATISTICS AND ANALYTICS
// =============================================================================

/**
 * @route   GET /api/school/statistics/overview
 * @desc    Get school overview statistics
 * @access  Private (All school staff)
 */
router.get('/statistics/overview',
  SchoolController.getSchoolOverviewStatistics
);

/**
 * @route   GET /api/school/statistics/academic-performance
 * @desc    Get academic performance statistics
 * @access  Private (All school staff)
 */
router.get('/statistics/academic-performance',
  query('academicYear').optional().isString().withMessage('Academic year must be a string'),
  query('term').optional().isString().withMessage('Term must be a string'),
  query('curriculumType').optional().isIn(['CBC', 'IGCSE', '8-4-4', 'IB', 'Cambridge']).withMessage('Invalid curriculum type'),
  validate,
  SchoolController.getAcademicPerformanceStatistics
);

/**
 * @route   GET /api/school/statistics/enrollment-trends
 * @desc    Get enrollment trends
 * @access  Private (All school staff)
 */
router.get('/statistics/enrollment-trends',
  query('period').optional().isIn(['monthly', 'termly', 'yearly']).withMessage('Invalid period'),
  query('years').optional().isInt({ min: 1, max: 10 }).withMessage('Years must be between 1 and 10'),
  validate,
  SchoolController.getEnrollmentTrends
);

module.exports = router;

// =============================================================================
// SCHOOL CALENDAR EVENTS (CRUD)
// =============================================================================

// List calendar events for a given month/year
router.get('/calendar/events', async (req, res, next) => {
  try {
    const schoolId = req.user.school_id || req.user.schoolId;
    const month = parseInt(req.query.month, 10);
    const year = parseInt(req.query.year, 10);
    const params = [schoolId];
    let dateFilter = '';
    if (!isNaN(month) && !isNaN(year)) {
      params.push(month, year);
      dateFilter = 'AND EXTRACT(MONTH FROM start_at) = $2 AND EXTRACT(YEAR FROM start_at) = $3';
    }
    const result = await dbQuery(`
      SELECT id, title, description, start_at, end_at, all_day, type, curriculum, class_ids
      FROM calendar_events
      WHERE school_id = $1 ${dateFilter}
      ORDER BY start_at ASC
    `, params);
    const data = result.rows.map(r => ({
      id: r.id,
      title: r.title,
      description: r.description,
      start_at: r.start_at,
      end_at: r.end_at,
      all_day: r.all_day,
      type: r.type,
      curriculum: r.curriculum,
      class_ids: r.class_ids,
    }));
    res.json({ success: true, data });
  } catch (e) {
    if (e && (e.code === '42P01' || e.code === '42703')) {
      return res.json({ success: true, data: [] });
    }
    next(e);
  }
});

// Create calendar event
router.post('/calendar/events', async (req, res, next) => {
  try {
    const schoolId = req.user.school_id || req.user.schoolId;
    const userId = req.user.userId;
    const { title, description, startDate, endDate, type, allDay, curriculum, classes } = req.body || {};
    if (!title || !startDate || !endDate || !type) {
      return res.status(400).json({ success: false, message: 'title, startDate, endDate, and type are required' });
    }
    const result = await dbQuery(`
      INSERT INTO calendar_events (school_id, title, description, start_at, end_at, all_day, type, curriculum, class_ids, created_by)
      VALUES ($1, $2, $3, $4, $5, COALESCE($6,false), $7, $8, COALESCE($9, '{}')::uuid[], $10)
      RETURNING *
    `, [schoolId, title, description || null, startDate, endDate, allDay, type, curriculum || null, (classes && classes.length ? classes : null), userId]);
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (e) {
    next(e);
  }
});

// Update calendar event
router.put('/calendar/events/:id', async (req, res, next) => {
  try {
    const schoolId = req.user.school_id || req.user.schoolId;
    const { id } = req.params;
    const { title, description, startDate, endDate, type, allDay, curriculum, classes } = req.body || {};
    const result = await dbQuery(`
      UPDATE calendar_events
      SET title = COALESCE($3, title),
          description = COALESCE($4, description),
          start_at = COALESCE($5, start_at),
          end_at = COALESCE($6, end_at),
          all_day = COALESCE($7, all_day),
          type = COALESCE($8, type),
          curriculum = COALESCE($9, curriculum),
          class_ids = COALESCE($10::uuid[], class_ids),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND school_id = $2
      RETURNING *
    `, [id, schoolId, title || null, description || null, startDate || null, endDate || null, allDay, type || null, curriculum || null, (classes && classes.length ? classes : null)]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (e) {
    next(e);
  }
});

// Delete calendar event
router.delete('/calendar/events/:id', async (req, res, next) => {
  try {
    const schoolId = req.user.school_id || req.user.schoolId;
    const { id } = req.params;
    const result = await dbQuery('DELETE FROM calendar_events WHERE id = $1 AND school_id = $2 RETURNING id', [id, schoolId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }
    res.json({ success: true, data: { id } });
  } catch (e) {
    next(e);
  }
});