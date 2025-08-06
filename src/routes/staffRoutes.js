const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const { validateStaffData, validateStaffUpdate } = require('../middleware/validation');
const staffController = require('../controllers/staffController');

// Apply authentication to all staff routes
router.use(authenticate);

/**
 * @route   GET /api/staff
 * @desc    Get all staff members with pagination and filtering
 * @access  Private (Admin, School Admin)
 */
router.get('/', 
  requireRole(['admin', 'school_admin']), 
  staffController.getAllStaff
);

/**
 * @route   GET /api/staff/:id
 * @desc    Get staff member by ID
 * @access  Private (Admin, School Admin, Staff - own profile)
 */
router.get('/:id', 
  requireRole(['admin', 'school_admin', 'staff']), 
  staffController.getStaffById
);

/**
 * @route   POST /api/staff
 * @desc    Create new staff member
 * @access  Private (Admin, School Admin)
 */
router.post('/', 
  requireRole(['admin', 'school_admin']), 
  validateStaffData, 
  staffController.createStaff
);

/**
 * @route   PUT /api/staff/:id
 * @desc    Update staff member
 * @access  Private (Admin, School Admin, Staff - own profile)
 */
router.put('/:id', 
  requireRole(['admin', 'school_admin', 'staff']), 
  validateStaffUpdate, 
  staffController.updateStaff
);

/**
 * @route   DELETE /api/staff/:id
 * @desc    Delete staff member
 * @access  Private (Admin, School Admin)
 */
router.delete('/:id', 
  requireRole(['admin', 'school_admin']), 
  staffController.deleteStaff
);

/**
 * @route   GET /api/staff/school/:schoolId
 * @desc    Get all staff members for a specific school
 * @access  Private (Admin, School Admin)
 */
router.get('/school/:schoolId', 
  requireRole(['admin', 'school_admin']), 
  staffController.getStaffBySchool
);

/**
 * @route   GET /api/staff/department/:departmentId
 * @desc    Get all staff members in a specific department
 * @access  Private (Admin, School Admin, Department Head)
 */
router.get('/department/:departmentId', 
  requireRole(['admin', 'school_admin', 'department_head']), 
  staffController.getStaffByDepartment
);

/**
 * @route   GET /api/staff/role/:role
 * @desc    Get all staff members with a specific role
 * @access  Private (Admin, School Admin)
 */
router.get('/role/:role', 
  requireRole(['admin', 'school_admin']), 
  staffController.getStaffByRole
);

/**
 * @route   POST /api/staff/:id/assign-school
 * @desc    Assign staff member to a school
 * @access  Private (Admin, School Admin)
 */
router.post('/:id/assign-school', 
  requireRole(['admin', 'school_admin']), 
  staffController.assignStaffToSchool
);

/**
 * @route   POST /api/staff/:id/assign-department
 * @desc    Assign staff member to a department
 * @access  Private (Admin, School Admin, Department Head)
 */
router.post('/:id/assign-department', 
  requireRole(['admin', 'school_admin', 'department_head']), 
  staffController.assignStaffToDepartment
);

/**
 * @route   POST /api/staff/:id/change-role
 * @desc    Change staff member role
 * @access  Private (Admin, School Admin)
 */
router.post('/:id/change-role', 
  requireRole(['admin', 'school_admin']), 
  staffController.changeStaffRole
);

/**
 * @route   POST /api/staff/:id/activate
 * @desc    Activate staff member account
 * @access  Private (Admin, School Admin)
 */
router.post('/:id/activate', 
  requireRole(['admin', 'school_admin']), 
  staffController.activateStaff
);

/**
 * @route   POST /api/staff/:id/deactivate
 * @desc    Deactivate staff member account
 * @access  Private (Admin, School Admin)
 */
router.post('/:id/deactivate', 
  requireRole(['admin', 'school_admin']), 
  staffController.deactivateStaff
);

/**
 * @route   GET /api/staff/:id/profile
 * @desc    Get staff member profile with detailed information
 * @access  Private (Admin, School Admin, Staff - own profile)
 */
router.get('/:id/profile', 
  requireRole(['admin', 'school_admin', 'staff']), 
  staffController.getStaffProfile
);

/**
 * @route   PUT /api/staff/:id/profile
 * @desc    Update staff member profile
 * @access  Private (Staff - own profile, Admin, School Admin)
 */
router.put('/:id/profile', 
  requireRole(['admin', 'school_admin', 'staff']), 
  validateStaffUpdate, 
  staffController.updateStaffProfile
);

/**
 * @route   GET /api/staff/search
 * @desc    Search staff members by name, email, or role
 * @access  Private (Admin, School Admin)
 */
router.get('/search', 
  requireRole(['admin', 'school_admin']), 
  staffController.searchStaff
);

/**
 * @route   GET /api/staff/statistics
 * @desc    Get staff statistics and analytics
 * @access  Private (Admin, School Admin)
 */
router.get('/statistics', 
  requireRole(['admin', 'school_admin']), 
  staffController.getStaffStatistics
);

module.exports = router; 