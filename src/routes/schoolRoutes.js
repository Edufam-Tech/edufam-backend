const express = require('express');
const router = express.Router();
const SchoolController = require('../controllers/schoolController');
const { authenticate, requireUserType, requireRole } = require('../middleware/auth');
const { validateSchoolData, validateAcademicYearData, validateAcademicTermData } = require('../middleware/validation');

// Apply authentication middleware to all routes
router.use(authenticate);

// ============================================================================
// SCHOOL MANAGEMENT ROUTES
// ============================================================================

// Create new school (Admin only)
router.post('/',
  requireUserType(['admin_user']),
  validateSchoolData,
  SchoolController.createSchool
);

// Get all schools with pagination and filters
router.get('/',
  requireUserType(['admin_user']),
  SchoolController.getAllSchools
);

// Search schools
router.get('/search',
  requireUserType(['admin_user']),
  SchoolController.searchSchools
);

// Get schools by subscription type
router.get('/subscription/:subscriptionType',
  requireUserType(['admin_user']),
  SchoolController.getSchoolsBySubscriptionType
);

// Get schools by status
router.get('/status/:status',
  requireUserType(['admin_user']),
  SchoolController.getSchoolsByStatus
);

// Get specific school by ID
router.get('/:schoolId',
  requireUserType(['admin_user', 'school_user']),
  SchoolController.getSchool
);

// Update school
router.put('/:schoolId',
  requireUserType(['admin_user']),
  validateSchoolData,
  SchoolController.updateSchool
);

// Deactivate school
router.patch('/:schoolId/deactivate',
  requireUserType(['admin_user']),
  SchoolController.deactivateSchool
);

// Reactivate school
router.patch('/:schoolId/reactivate',
  requireUserType(['admin_user']),
  SchoolController.reactivateSchool
);

// ============================================================================
// SCHOOL CONFIGURATION ROUTES
// ============================================================================

// Get school configuration
router.get('/:schoolId/configuration',
  requireUserType(['admin_user', 'school_user']),
  SchoolController.getSchoolConfiguration
);

// Update school subscription
router.put('/:schoolId/subscription',
  requireUserType(['admin_user']),
  SchoolController.updateSubscription
);

// ============================================================================
// SCHOOL DASHBOARD ROUTES
// ============================================================================

// Get school dashboard
router.get('/:schoolId/dashboard',
  requireUserType(['admin_user', 'school_user']),
  SchoolController.getSchoolDashboard
);

// Generate school report
router.post('/:schoolId/reports',
  requireUserType(['admin_user', 'school_user']),
  SchoolController.generateReport
);

// Export school data
router.get('/:schoolId/export',
  requireUserType(['admin_user', 'school_user']),
  SchoolController.exportSchoolData
);

// ============================================================================
// ACADEMIC YEAR ROUTES
// ============================================================================

// Create academic year for a school
router.post('/:schoolId/academic-years',
  requireUserType(['admin_user', 'school_user']),
  requireRole(['admin', 'principal', 'head_teacher']),
  validateAcademicYearData,
  SchoolController.createAcademicYear
);

// Get all academic years for a school
router.get('/:schoolId/academic-years',
  requireUserType(['admin_user', 'school_user']),
  SchoolController.getAcademicYears
);

// Get specific academic year with terms
router.get('/academic-years/:academicYearId',
  requireUserType(['admin_user', 'school_user']),
  SchoolController.getAcademicYear
);

// Update academic year
router.put('/academic-years/:academicYearId',
  requireUserType(['admin_user', 'school_user']),
  requireRole(['admin', 'principal', 'head_teacher']),
  validateAcademicYearData,
  SchoolController.updateAcademicYear
);

// Set academic year as active
router.patch('/academic-years/:academicYearId/activate',
  requireUserType(['admin_user', 'school_user']),
  requireRole(['admin', 'principal', 'head_teacher']),
  SchoolController.setActiveAcademicYear
);

// ============================================================================
// ACADEMIC TERM ROUTES
// ============================================================================

// Create academic term for an academic year
router.post('/academic-years/:academicYearId/terms',
  requireUserType(['admin_user', 'school_user']),
  requireRole(['admin', 'principal', 'head_teacher']),
  validateAcademicTermData,
  SchoolController.createAcademicTerm
);

// Get all terms for an academic year
router.get('/academic-years/:academicYearId/terms',
  requireUserType(['admin_user', 'school_user']),
  SchoolController.getAcademicTerms
);

// Get specific academic term details
router.get('/terms/:termId',
  requireUserType(['admin_user', 'school_user']),
  SchoolController.getAcademicTerm
);

// Update academic term
router.put('/terms/:termId',
  requireUserType(['admin_user', 'school_user']),
  requireRole(['admin', 'principal', 'head_teacher']),
  validateAcademicTermData,
  SchoolController.updateAcademicTerm
);

// Set academic term as active
router.patch('/terms/:termId/activate',
  requireUserType(['admin_user', 'school_user']),
  requireRole(['admin', 'principal', 'head_teacher']),
  SchoolController.setActiveAcademicTerm
);

// ============================================================================
// BULK OPERATIONS ROUTES
// ============================================================================

// Create multiple terms for an academic year
router.post('/academic-years/:academicYearId/terms/bulk',
  requireUserType(['admin_user', 'school_user']),
  requireRole(['admin', 'principal', 'head_teacher']),
  SchoolController.createBulkTerms
);

// Create default terms for curriculum type
router.post('/academic-years/:academicYearId/terms/default',
  requireUserType(['admin_user', 'school_user']),
  requireRole(['admin', 'principal', 'head_teacher']),
  SchoolController.createDefaultTerms
);

// ============================================================================
// CURRICULUM-SPECIFIC ROUTES
// ============================================================================

// Get terms by curriculum type for a school
router.get('/:schoolId/curriculum/:curriculumType/terms',
  requireUserType(['admin_user', 'school_user']),
  SchoolController.getTermsByCurriculum
);

// ============================================================================
// STATISTICS AND ANALYTICS ROUTES
// ============================================================================

// Get school statistics
router.get('/:schoolId/statistics',
  requireUserType(['admin_user', 'school_user']),
  SchoolController.getSchoolStatistics
);

// Get academic year statistics
router.get('/academic-years/:academicYearId/statistics',
  requireUserType(['admin_user', 'school_user']),
  SchoolController.getAcademicYearStatistics
);

// Get academic term statistics
router.get('/terms/:termId/statistics',
  requireUserType(['admin_user', 'school_user']),
  SchoolController.getAcademicTermStatistics
);

// ============================================================================
// VALIDATION AND UTILITY ROUTES
// ============================================================================

// Validate school access
router.get('/:schoolId/validate-access',
  requireUserType(['admin_user', 'school_user']),
  SchoolController.validateSchoolAccess
);

// Get current academic year for a school
router.get('/:schoolId/current-academic-year',
  requireUserType(['admin_user', 'school_user']),
  SchoolController.getCurrentAcademicYear
);

// Get current academic term for a school
router.get('/:schoolId/current-term',
  requireUserType(['admin_user', 'school_user']),
  SchoolController.getCurrentAcademicTerm
);

// ============================================================================
// ERROR HANDLING MIDDLEWARE
// ============================================================================

// Handle 404 for undefined routes
router.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'School route not found'
  });
});

module.exports = router; 