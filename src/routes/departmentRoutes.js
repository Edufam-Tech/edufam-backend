const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const { validateDepartmentData, validateDepartmentUpdate } = require('../middleware/validation');
const departmentController = require('../controllers/departmentController');

// Apply authentication to all department routes
router.use(authenticate);

/**
 * @route   GET /api/departments
 * @desc    Get all departments with pagination and filtering
 * @access  Private (Admin, School Admin, Department Head)
 */
router.get('/', 
  requireRole(['admin', 'school_admin', 'department_head']), 
  departmentController.getAllDepartments
);

/**
 * @route   GET /api/departments/:id
 * @desc    Get department by ID
 * @access  Private (Admin, School Admin, Department Head)
 */
router.get('/:id', 
  requireRole(['admin', 'school_admin', 'department_head']), 
  departmentController.getDepartmentById
);

/**
 * @route   POST /api/departments
 * @desc    Create new department
 * @access  Private (Admin, School Admin)
 */
router.post('/', 
  requireRole(['admin', 'school_admin']), 
  validateDepartmentData, 
  departmentController.createDepartment
);

/**
 * @route   PUT /api/departments/:id
 * @desc    Update department
 * @access  Private (Admin, School Admin, Department Head)
 */
router.put('/:id', 
  requireRole(['admin', 'school_admin', 'department_head']), 
  validateDepartmentUpdate, 
  departmentController.updateDepartment
);

/**
 * @route   DELETE /api/departments/:id
 * @desc    Delete department
 * @access  Private (Admin, School Admin)
 */
router.delete('/:id', 
  requireRole(['admin', 'school_admin']), 
  departmentController.deleteDepartment
);

/**
 * @route   GET /api/departments/school/:schoolId
 * @desc    Get all departments for a specific school
 * @access  Private (Admin, School Admin, Department Head)
 */
router.get('/school/:schoolId', 
  requireRole(['admin', 'school_admin', 'department_head']), 
  departmentController.getDepartmentsBySchool
);

/**
 * @route   GET /api/departments/:id/staff
 * @desc    Get all staff members in a specific department
 * @access  Private (Admin, School Admin, Department Head)
 */
router.get('/:id/staff', 
  requireRole(['admin', 'school_admin', 'department_head']), 
  departmentController.getDepartmentStaff
);

/**
 * @route   POST /api/departments/:id/assign-head
 * @desc    Assign department head
 * @access  Private (Admin, School Admin)
 */
router.post('/:id/assign-head', 
  requireRole(['admin', 'school_admin']), 
  departmentController.assignDepartmentHead
);

/**
 * @route   POST /api/departments/:id/remove-head
 * @desc    Remove department head
 * @access  Private (Admin, School Admin)
 */
router.post('/:id/remove-head', 
  requireRole(['admin', 'school_admin']), 
  departmentController.removeDepartmentHead
);

/**
 * @route   POST /api/departments/:id/activate
 * @desc    Activate department
 * @access  Private (Admin, School Admin)
 */
router.post('/:id/activate', 
  requireRole(['admin', 'school_admin']), 
  departmentController.activateDepartment
);

/**
 * @route   POST /api/departments/:id/deactivate
 * @desc    Deactivate department
 * @access  Private (Admin, School Admin)
 */
router.post('/:id/deactivate', 
  requireRole(['admin', 'school_admin']), 
  departmentController.deactivateDepartment
);

/**
 * @route   GET /api/departments/:id/statistics
 * @desc    Get department statistics
 * @access  Private (Admin, School Admin, Department Head)
 */
router.get('/:id/statistics', 
  requireRole(['admin', 'school_admin', 'department_head']), 
  departmentController.getDepartmentStatistics
);

/**
 * @route   GET /api/departments/search
 * @desc    Search departments by name or code
 * @access  Private (Admin, School Admin, Department Head)
 */
router.get('/search', 
  requireRole(['admin', 'school_admin', 'department_head']), 
  departmentController.searchDepartments
);

/**
 * @route   GET /api/departments/statistics/overview
 * @desc    Get overall department statistics
 * @access  Private (Admin, School Admin)
 */
router.get('/statistics/overview', 
  requireRole(['admin', 'school_admin']), 
  departmentController.getDepartmentsOverview
);

module.exports = router; 