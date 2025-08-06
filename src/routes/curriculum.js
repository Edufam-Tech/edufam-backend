const express = require('express');
const router = express.Router();
const curriculumController = require('../controllers/curriculumController');
const { authenticate, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const { body, param, query } = require('express-validator');

/**
 * Curriculum Routes
 * Handles curriculum-specific operations for CBC, IGCSE, 8-4-4, IB and other educational systems
 */

// Authentication middleware for all curriculum routes
router.use(authenticate);

// ====================================
// CURRICULUM SYSTEMS
// ====================================

/**
 * Get all curriculum systems
 * GET /api/v1/curriculum/systems
 */
router.get('/systems', [
  query('country').optional().isString().trim().withMessage('Country must be a string'),
  query('search').optional().isString().trim().withMessage('Search must be a string')
], validate, curriculumController.getCurriculumSystems);

/**
 * Get curriculum system details
 * GET /api/v1/curriculum/systems/:curriculumId
 */
router.get('/systems/:curriculumId', [
  param('curriculumId').isUUID().withMessage('Valid curriculum ID is required')
], validate, curriculumController.getCurriculumSystem);

/**
 * Get curriculum by code
 * GET /api/v1/curriculum/code/:curriculumCode
 */
router.get('/code/:curriculumCode', [
  param('curriculumCode').isString().trim().isLength({ min: 1, max: 20 }).withMessage('Valid curriculum code is required')
], validate, curriculumController.getCurriculumByCode);

// ====================================
// GRADE LEVELS
// ====================================

/**
 * Get grade levels for a curriculum
 * GET /api/v1/curriculum/systems/:curriculumId/grades
 */
router.get('/systems/:curriculumId/grades', [
  param('curriculumId').isUUID().withMessage('Valid curriculum ID is required')
], validate, curriculumController.getGradeLevels);

/**
 * Get grade level details
 * GET /api/v1/curriculum/grades/:gradeLevelId
 */
router.get('/grades/:gradeLevelId', [
  param('gradeLevelId').isUUID().withMessage('Valid grade level ID is required')
], validate, curriculumController.getGradeLevel);

// ====================================
// SUBJECTS
// ====================================

/**
 * Get subjects for a curriculum
 * GET /api/v1/curriculum/systems/:curriculumId/subjects
 */
router.get('/systems/:curriculumId/subjects', [
  param('curriculumId').isUUID().withMessage('Valid curriculum ID is required'),
  query('subjectType').optional().isIn(['core', 'optional', 'elective', 'specialization']).withMessage('Invalid subject type'),
  query('category').optional().isString().trim().withMessage('Category must be a string'),
  query('gradeLevel').optional().isString().trim().withMessage('Grade level must be a string'),
  query('mandatoryOnly').optional().isBoolean().withMessage('Mandatory only must be boolean')
], validate, curriculumController.getSubjects);

/**
 * Get subject details
 * GET /api/v1/curriculum/subjects/:subjectId
 */
router.get('/subjects/:subjectId', [
  param('subjectId').isUUID().withMessage('Valid subject ID is required')
], validate, curriculumController.getSubject);

// ====================================
// ASSESSMENT STANDARDS
// ====================================

/**
 * Get assessment standards
 * GET /api/v1/curriculum/systems/:curriculumId/standards
 */
router.get('/systems/:curriculumId/standards', [
  param('curriculumId').isUUID().withMessage('Valid curriculum ID is required'),
  query('subjectId').optional().isUUID().withMessage('Subject ID must be valid UUID'),
  query('gradeLevelId').optional().isUUID().withMessage('Grade level ID must be valid UUID'),
  query('standardType').optional().isIn(['learning_outcome', 'competency', 'skill', 'knowledge_area']).withMessage('Invalid standard type'),
  query('complexityLevel').optional().isIn(['basic', 'intermediate', 'advanced', 'mastery']).withMessage('Invalid complexity level')
], validate, curriculumController.getAssessmentStandards);

// ====================================
// SCHOOL IMPLEMENTATION
// ====================================

/**
 * Get school's curriculum implementations
 * GET /api/v1/curriculum/school/implementations
 */
router.get('/school/implementations', [
  requireRole(['principal', 'school_director', 'teacher', 'academic_coordinator'])
], curriculumController.getSchoolImplementations);

/**
 * Update school curriculum implementation
 * PUT /api/v1/curriculum/school/implementations/:curriculumId
 */
router.put('/school/implementations/:curriculumId', [
  requireRole(['principal', 'school_director', 'academic_coordinator']),
  param('curriculumId').isUUID().withMessage('Valid curriculum ID is required'),
  body('implementationStatus').isIn(['planning', 'pilot', 'partial', 'full', 'phasing_out', 'discontinued']).withMessage('Valid implementation status is required'),
  body('implementationDate').isISO8601().withMessage('Valid implementation date is required'),
  body('gradeLevelsImplemented').optional().isArray().withMessage('Grade levels implemented must be an array'),
  body('subjectsImplemented').optional().isArray().withMessage('Subjects implemented must be an array'),
  body('percentageImplementation').optional().isFloat({ min: 0, max: 100 }).withMessage('Percentage implementation must be between 0 and 100'),
  body('teacherTrainingCompleted').optional().isBoolean().withMessage('Teacher training completed must be boolean'),
  body('resourcesAcquired').optional().isBoolean().withMessage('Resources acquired must be boolean'),
  body('assessmentToolsReady').optional().isBoolean().withMessage('Assessment tools ready must be boolean'),
  body('implementationChallenges').optional().isArray().withMessage('Implementation challenges must be an array'),
  body('solutionsImplemented').optional().isArray().withMessage('Solutions implemented must be an array'),
  body('implementationCost').optional().isFloat({ min: 0 }).withMessage('Implementation cost must be a positive number'),
  body('fundingSource').optional().isString().trim().withMessage('Funding source must be a string'),
  body('notes').optional().isString().trim().withMessage('Notes must be a string')
], validate, curriculumController.updateSchoolImplementation);

// ====================================
// STUDENT PROGRESS TRACKING
// ====================================

/**
 * Get student's curriculum progress
 * GET /api/v1/curriculum/students/:studentId/progress
 */
router.get('/students/:studentId/progress', [
  requireRole(['principal', 'school_director', 'teacher', 'academic_coordinator', 'parent']),
  param('studentId').isUUID().withMessage('Valid student ID is required'),
  query('academicYear').optional().isString().trim().withMessage('Academic year must be a string')
], validate, curriculumController.getStudentProgress);

/**
 * Update student curriculum progress
 * PUT /api/v1/curriculum/students/:studentId/progress
 */
router.put('/students/:studentId/progress', [
  requireRole(['principal', 'school_director', 'teacher', 'academic_coordinator']),
  param('studentId').isUUID().withMessage('Valid student ID is required'),
  body('curriculumId').isUUID().withMessage('Valid curriculum ID is required'),
  body('currentGradeLevelId').isUUID().withMessage('Valid grade level ID is required'),
  body('academicYear').isString().trim().isLength({ min: 1, max: 20 }).withMessage('Academic year is required'),
  body('termSemester').optional().isString().trim().withMessage('Term/semester must be a string'),
  body('subjectsEnrolled').optional().isArray().withMessage('Subjects enrolled must be an array'),
  body('subjectsCompleted').optional().isArray().withMessage('Subjects completed must be an array'),
  body('subjectsFailed').optional().isArray().withMessage('Subjects failed must be an array'),
  body('overallGrade').optional().isString().trim().withMessage('Overall grade must be a string'),
  body('gpaScore').optional().isFloat({ min: 0, max: 10 }).withMessage('GPA score must be between 0 and 10'),
  body('classRank').optional().isInt({ min: 1 }).withMessage('Class rank must be a positive integer'),
  body('totalStudentsInClass').optional().isInt({ min: 1 }).withMessage('Total students in class must be a positive integer'),
  body('competenciesAchieved').optional().isArray().withMessage('Competencies achieved must be an array'),
  body('competenciesDeveloping').optional().isArray().withMessage('Competencies developing must be an array'),
  body('competenciesNeedsSupport').optional().isArray().withMessage('Competencies needs support must be an array'),
  body('subjectPerformance').optional().isObject().withMessage('Subject performance must be an object'),
  body('assessmentScores').optional().isObject().withMessage('Assessment scores must be an object'),
  body('examResults').optional().isObject().withMessage('Exam results must be an object'),
  body('promotionStatus').optional().isIn(['promoted', 'on_track', 'at_risk', 'retained', 'transferred']).withMessage('Invalid promotion status'),
  body('individualizedSupportPlan').optional().isBoolean().withMessage('Individualized support plan must be boolean'),
  body('specialNeedsAccommodation').optional().isArray().withMessage('Special needs accommodation must be an array'),
  body('riskFactors').optional().isArray().withMessage('Risk factors must be an array'),
  body('interventionStrategies').optional().isArray().withMessage('Intervention strategies must be an array'),
  body('schoolId').optional().isUUID().withMessage('School ID must be valid UUID')
], validate, curriculumController.updateStudentProgress);

// ====================================
// CURRICULUM EQUIVALENCIES
// ====================================

/**
 * Get curriculum equivalencies
 * GET /api/v1/curriculum/equivalencies/:sourceCurriculumId
 */
router.get('/equivalencies/:sourceCurriculumId', [
  param('sourceCurriculumId').isUUID().withMessage('Valid source curriculum ID is required'),
  query('targetCurriculumId').optional().isUUID().withMessage('Target curriculum ID must be valid UUID')
], validate, curriculumController.getCurriculumEquivalencies);

// ====================================
// ANALYTICS AND REPORTS
// ====================================

/**
 * Get curriculum implementation analytics
 * GET /api/v1/curriculum/analytics
 */
router.get('/analytics', [
  requireRole(['principal', 'school_director', 'super_admin', 'edufam_admin', 'curriculum_specialist'])
], curriculumController.getCurriculumAnalytics);

/**
 * Get grade distribution for a curriculum
 * GET /api/v1/curriculum/systems/:curriculumId/grade-distribution
 */
router.get('/systems/:curriculumId/grade-distribution', [
  requireRole(['principal', 'school_director', 'teacher', 'academic_coordinator', 'super_admin', 'edufam_admin']),
  param('curriculumId').isUUID().withMessage('Valid curriculum ID is required')
], validate, curriculumController.getGradeDistribution);

/**
 * Get school curriculum dashboard
 * GET /api/v1/curriculum/school/dashboard
 */
router.get('/school/dashboard', [
  requireRole(['principal', 'school_director', 'teacher', 'academic_coordinator'])
], curriculumController.getSchoolCurriculumDashboard);

// ====================================
// CURRICULUM-SPECIFIC FEATURES
// ====================================

/**
 * Get CBC competency tracking
 * GET /api/v1/curriculum/cbc/students/:studentId/competencies
 */
router.get('/cbc/students/:studentId/competencies', [
  requireRole(['principal', 'school_director', 'teacher', 'academic_coordinator', 'parent']),
  param('studentId').isUUID().withMessage('Valid student ID is required'),
  query('academicYear').optional().isString().trim().withMessage('Academic year must be a string')
], validate, curriculumController.getCbcCompetencyTracking);

/**
 * Get IGCSE subject performance
 * GET /api/v1/curriculum/igcse/students/:studentId/performance
 */
router.get('/igcse/students/:studentId/performance', [
  requireRole(['principal', 'school_director', 'teacher', 'academic_coordinator', 'parent']),
  param('studentId').isUUID().withMessage('Valid student ID is required'),
  query('academicYear').optional().isString().trim().withMessage('Academic year must be a string')
], validate, curriculumController.getIgcseSubjectPerformance);

// ====================================
// HEALTH CHECK
// ====================================

/**
 * Curriculum service health check
 * GET /api/v1/curriculum/health
 */
router.get('/health', curriculumController.getCurriculumServiceHealth);

// ====================================
// ADMIN ENDPOINTS (Curriculum Management)
// ====================================

/**
 * Admin routes for curriculum specialists and super admins
 */

// Get comprehensive curriculum analytics (admin only)
router.get('/admin/comprehensive-analytics', [
  requireRole(['super_admin', 'edufam_admin', 'curriculum_specialist'])
], (req, res) => {
  // Placeholder for comprehensive analytics
  res.json({
    success: true,
    data: {
      message: 'Comprehensive curriculum analytics feature coming soon',
      availableFeatures: [
        'cross_curriculum_comparison',
        'implementation_effectiveness',
        'student_outcome_analysis',
        'resource_utilization',
        'teacher_performance_correlation'
      ]
    },
    message: 'Admin curriculum analytics endpoint'
  });
});

// Curriculum system management (admin only)
router.post('/admin/systems', [
  requireRole(['super_admin', 'edufam_admin', 'curriculum_specialist'])
], (req, res) => {
  // Placeholder for curriculum system creation
  res.json({
    success: true,
    data: { message: 'Curriculum system management feature coming soon' },
    message: 'Admin curriculum system creation endpoint'
  });
});

// ====================================
// ERROR HANDLING
// ====================================

// Global error handler for curriculum routes
router.use((error, req, res, next) => {
  console.error('Curriculum route error:', error);
  
  res.status(error.statusCode || 500).json({
    success: false,
    error: {
      code: error.code || 'CURRICULUM_ERROR',
      message: error.message || 'An error occurred in curriculum management'
    }
  });
});

module.exports = router;