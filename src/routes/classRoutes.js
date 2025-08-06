const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const { validateClassData, validateClassUpdate } = require('../middleware/validation');
const classController = require('../controllers/classController');

// Apply authentication to all class routes
router.use(authenticate);

/**
 * @route   GET /api/classes
 * @desc    Get all classes with pagination and filtering
 * @access  Private (Admin, School Admin, Teacher)
 */
router.get('/', 
  requireRole(['admin', 'school_admin', 'teacher']), 
  classController.getAllClasses
);

/**
 * @route   GET /api/classes/:id
 * @desc    Get class by ID
 * @access  Private (Admin, School Admin, Teacher)
 */
router.get('/:id', 
  requireRole(['admin', 'school_admin', 'teacher']), 
  classController.getClassById
);

/**
 * @route   POST /api/classes
 * @desc    Create new class
 * @access  Private (Admin, School Admin)
 */
router.post('/', 
  requireRole(['admin', 'school_admin']), 
  validateClassData, 
  classController.createClass
);

/**
 * @route   PUT /api/classes/:id
 * @desc    Update class
 * @access  Private (Admin, School Admin, Teacher)
 */
router.put('/:id', 
  requireRole(['admin', 'school_admin', 'teacher']), 
  validateClassUpdate, 
  classController.updateClass
);

/**
 * @route   DELETE /api/classes/:id
 * @desc    Delete class
 * @access  Private (Admin, School Admin)
 */
router.delete('/:id', 
  requireRole(['admin', 'school_admin']), 
  classController.deleteClass
);

/**
 * @route   GET /api/classes/school/:schoolId
 * @desc    Get all classes for a specific school
 * @access  Private (Admin, School Admin, Teacher)
 */
router.get('/school/:schoolId', 
  requireRole(['admin', 'school_admin', 'teacher']), 
  classController.getClassesBySchool
);

/**
 * @route   GET /api/classes/academic-year/:academicYearId
 * @desc    Get all classes for a specific academic year
 * @access  Private (Admin, School Admin, Teacher)
 */
router.get('/academic-year/:academicYearId', 
  requireRole(['admin', 'school_admin', 'teacher']), 
  classController.getClassesByAcademicYear
);

/**
 * @route   GET /api/classes/:id/students
 * @desc    Get all students in a specific class
 * @access  Private (Admin, School Admin, Teacher)
 */
router.get('/:id/students', 
  requireRole(['admin', 'school_admin', 'teacher']), 
  classController.getClassStudents
);

/**
 * @route   POST /api/classes/:id/assign-teacher
 * @desc    Assign teacher to class
 * @access  Private (Admin, School Admin)
 */
router.post('/:id/assign-teacher', 
  requireRole(['admin', 'school_admin']), 
  classController.assignTeacherToClass
);

/**
 * @route   POST /api/classes/:id/remove-teacher
 * @desc    Remove teacher from class
 * @access  Private (Admin, School Admin)
 */
router.post('/:id/remove-teacher', 
  requireRole(['admin', 'school_admin']), 
  classController.removeTeacherFromClass
);

/**
 * @route   POST /api/classes/:id/add-student
 * @desc    Add student to class
 * @access  Private (Admin, School Admin, Teacher)
 */
router.post('/:id/add-student', 
  requireRole(['admin', 'school_admin', 'teacher']), 
  classController.addStudentToClass
);

/**
 * @route   POST /api/classes/:id/remove-student
 * @desc    Remove student from class
 * @access  Private (Admin, School Admin, Teacher)
 */
router.post('/:id/remove-student', 
  requireRole(['admin', 'school_admin', 'teacher']), 
  classController.removeStudentFromClass
);

/**
 * @route   POST /api/classes/:id/activate
 * @desc    Activate class
 * @access  Private (Admin, School Admin)
 */
router.post('/:id/activate', 
  requireRole(['admin', 'school_admin']), 
  classController.activateClass
);

/**
 * @route   POST /api/classes/:id/deactivate
 * @desc    Deactivate class
 * @access  Private (Admin, School Admin)
 */
router.post('/:id/deactivate', 
  requireRole(['admin', 'school_admin']), 
  classController.deactivateClass
);

/**
 * @route   GET /api/classes/:id/statistics
 * @desc    Get class statistics
 * @access  Private (Admin, School Admin, Teacher)
 */
router.get('/:id/statistics', 
  requireRole(['admin', 'school_admin', 'teacher']), 
  classController.getClassStatistics
);

/**
 * @route   GET /api/classes/search
 * @desc    Search classes by name or code
 * @access  Private (Admin, School Admin, Teacher)
 */
router.get('/search', 
  requireRole(['admin', 'school_admin', 'teacher']), 
  classController.searchClasses
);

/**
 * @route   GET /api/classes/statistics/overview
 * @desc    Get overall class statistics
 * @access  Private (Admin, School Admin)
 */
router.get('/statistics/overview', 
  requireRole(['admin', 'school_admin']), 
  classController.getClassesOverview
);

/**
 * @route   GET /api/classes/teacher/:teacherId
 * @desc    Get all classes taught by a specific teacher
 * @access  Private (Admin, School Admin, Teacher)
 */
router.get('/teacher/:teacherId', 
  requireRole(['admin', 'school_admin', 'teacher']), 
  classController.getClassesByTeacher
);

module.exports = router; 