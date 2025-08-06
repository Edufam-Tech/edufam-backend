const express = require('express');
const router = express.Router();
const StudentController = require('../controllers/studentController');
const { authenticate, requireUserType, requireRole } = require('../middleware/auth');
const { validateStudentData, validateClassData, validateEnrollmentData } = require('../middleware/validation');

router.use(authenticate); // Apply authentication middleware to all routes

// STUDENT MANAGEMENT ROUTES
// Create new student
router.post('/', 
  requireUserType(['school_user', 'admin_user']),
  requireRole(['school_director', 'principal', 'teacher', 'hr', 'super_admin']),
  validateStudentData,
  StudentController.createStudent
);

// Get all students with pagination and filters
router.get('/',
  requireUserType(['school_user', 'admin_user']),
  StudentController.getAllStudents
);

// Search students
router.get('/search',
  requireUserType(['school_user', 'admin_user']),
  StudentController.getAllStudents // Uses search parameter
);

// Get student by ID
router.get('/:studentId',
  requireUserType(['school_user', 'admin_user']),
  StudentController.getStudent
);

// Update student
router.put('/:studentId',
  requireUserType(['school_user', 'admin_user']),
  requireRole(['school_director', 'principal', 'teacher', 'hr', 'super_admin']),
  validateStudentData,
  StudentController.updateStudent
);

// Deactivate student
router.patch('/:studentId/deactivate',
  requireUserType(['school_user', 'admin_user']),
  requireRole(['school_director', 'principal', 'hr', 'super_admin']),
  StudentController.deactivateStudent
);

// Reactivate student
router.patch('/:studentId/reactivate',
  requireUserType(['school_user', 'admin_user']),
  requireRole(['school_director', 'principal', 'hr', 'super_admin']),
  StudentController.reactivateStudent
);

// Generate student ID card
router.get('/:studentId/id-card',
  requireUserType(['school_user', 'admin_user']),
  StudentController.generateIdCard
);

// Get student academic history
router.get('/:studentId/academic-history',
  requireUserType(['school_user', 'admin_user']),
  StudentController.getStudentAcademicHistory
);

// Get student disciplinary records
router.get('/:studentId/disciplinary-records',
  requireUserType(['school_user', 'admin_user']),
  StudentController.getStudentDisciplinaryRecords
);

// Add disciplinary record
router.post('/:studentId/disciplinary-records',
  requireUserType(['school_user', 'admin_user']),
  requireRole(['school_director', 'principal', 'teacher', 'super_admin']),
  StudentController.addDisciplinaryRecord
);

// Get student health records
router.get('/:studentId/health-records',
  requireUserType(['school_user', 'admin_user']),
  requireRole(['school_director', 'principal', 'nurse', 'hr', 'super_admin']),
  StudentController.getStudentHealthRecords
);

// Add health record
router.post('/:studentId/health-records',
  requireUserType(['school_user', 'admin_user']),
  requireRole(['school_director', 'principal', 'nurse', 'hr', 'super_admin']),
  StudentController.addHealthRecord
);

// CLASS MANAGEMENT ROUTES
// Create new class
router.post('/classes',
  requireUserType(['school_user', 'admin_user']),
  requireRole(['school_director', 'principal', 'super_admin']),
  validateClassData,
  StudentController.createClass
);

// Get all classes with pagination and filters
router.get('/classes',
  requireUserType(['school_user', 'admin_user']),
  StudentController.getAllClasses
);

// Get class by ID
router.get('/classes/:classId',
  requireUserType(['school_user', 'admin_user']),
  StudentController.getClass
);

// Update class
router.put('/classes/:classId',
  requireUserType(['school_user', 'admin_user']),
  requireRole(['school_director', 'principal', 'super_admin']),
  validateClassData,
  StudentController.updateClass
);

// Get students by class
router.get('/classes/:classId/students',
  requireUserType(['school_user', 'admin_user']),
  StudentController.getStudentsByClass
);

// Get class statistics
router.get('/classes/:classId/statistics',
  requireUserType(['school_user', 'admin_user']),
  StudentController.getClassStatistics
);

// ENROLLMENT MANAGEMENT ROUTES
// Enroll student
router.post('/enrollments',
  requireUserType(['school_user', 'admin_user']),
  requireRole(['school_director', 'principal', 'teacher', 'hr', 'super_admin']),
  validateEnrollmentData,
  StudentController.enrollStudent
);

// Get all enrollments with pagination and filters
router.get('/enrollments',
  requireUserType(['school_user', 'admin_user']),
  StudentController.getAllEnrollments
);

// Get enrollment by ID
router.get('/enrollments/:enrollmentId',
  requireUserType(['school_user', 'admin_user']),
  StudentController.getEnrollment
);

// Update enrollment
router.put('/enrollments/:enrollmentId',
  requireUserType(['school_user', 'admin_user']),
  requireRole(['school_director', 'principal', 'teacher', 'hr', 'super_admin']),
  StudentController.updateEnrollment
);

// Transfer student to different class
router.patch('/enrollments/:enrollmentId/transfer',
  requireUserType(['school_user', 'admin_user']),
  requireRole(['school_director', 'principal', 'super_admin']),
  StudentController.transferStudentClass
);

// STUDENT ID CARD OPERATIONS
// Generate single student ID card
router.post('/:studentId/id-card/generate',
  requireUserType(['school_user', 'admin_user']),
  requireRole(['school_director', 'principal', 'hr', 'super_admin']),
  StudentController.generateStudentIdCard
);

// Download student ID card
router.get('/:studentId/id-card/download',
  requireUserType(['school_user', 'admin_user']),
  StudentController.downloadStudentIdCard
);

// Bulk generate ID cards
router.post('/bulk/id-cards/generate',
  requireUserType(['school_user', 'admin_user']),
  requireRole(['school_director', 'principal', 'hr', 'super_admin']),
  StudentController.bulkGenerateIdCards
);

// STUDENT TRANSFER OPERATIONS
// Initiate student transfer
router.post('/:studentId/transfer',
  requireUserType(['school_user', 'admin_user']),
  requireRole(['school_director', 'principal', 'super_admin']),
  StudentController.initiateStudentTransfer
);

// Get pending transfers
router.get('/transfers/pending',
  requireUserType(['school_user', 'admin_user']),
  requireRole(['school_director', 'principal', 'super_admin']),
  StudentController.getPendingTransfers
);

// Approve transfer
router.put('/transfers/:transferId/approve',
  requireUserType(['school_user', 'admin_user']),
  requireRole(['school_director', 'principal', 'super_admin']),
  StudentController.approveTransfer
);

// Reject transfer
router.put('/transfers/:transferId/reject',
  requireUserType(['school_user', 'admin_user']),
  requireRole(['school_director', 'principal', 'super_admin']),
  StudentController.rejectTransfer
);

// BULK OPERATIONS ROUTES
// Bulk import students
router.post('/bulk-import',
  requireUserType(['school_user', 'admin_user']),
  requireRole(['school_director', 'principal', 'hr', 'super_admin']),
  StudentController.bulkImportStudents
);

// STATISTICS AND ANALYTICS ROUTES
// Get student statistics
router.get('/statistics/students',
  requireUserType(['school_user', 'admin_user']),
  StudentController.getStudentStatistics
);

// Get enrollment statistics
router.get('/statistics/enrollments',
  requireUserType(['school_user', 'admin_user']),
  StudentController.getEnrollmentStatistics
);

// DASHBOARD ROUTES
// Get student dashboard
router.get('/dashboard/overview',
  requireUserType(['school_user', 'admin_user']),
  StudentController.getStudentDashboard
);

// REPORTING ROUTES
// Generate student report
router.post('/reports/students',
  requireUserType(['school_user', 'admin_user']),
  requireRole(['school_director', 'principal', 'hr', 'super_admin']),
  StudentController.generateStudentReport
);

// Generate class report
router.get('/reports/classes',
  requireUserType(['school_user', 'admin_user']),
  requireRole(['school_director', 'principal', 'hr', 'super_admin']),
  StudentController.generateClassReport
);

// EXPORT ROUTES
// Export student data
router.get('/export/students',
  requireUserType(['school_user', 'admin_user']),
  requireRole(['school_director', 'principal', 'hr', 'super_admin']),
  StudentController.exportStudentData
);

// UTILITY ROUTES
// Get students by parent
router.get('/parents/:parentId/students',
  requireUserType(['school_user', 'admin_user']),
  StudentController.getStudentsByParent
);

// 404 handler for student routes
router.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Student route not found'
    }
  });
});

module.exports = router; 