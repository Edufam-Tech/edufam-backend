const express = require('express');
const router = express.Router();
const adminHrController = require('../../controllers/adminHrController');
const { authenticate, requireRole } = require('../../middleware/auth');
const { validate } = require('../../middleware/validation');
const { body, param, query } = require('express-validator');

/**
 * Admin HR Routes
 * Internal Edufam company HR management and employee operations
 */

// Authentication middleware for all HR routes
router.use(authenticate);

// ====================================
// EMPLOYEE MANAGEMENT
// ====================================

/**
 * Create new employee
 * POST /api/v1/admin/hr/employees
 */
router.post('/employees', [
  requireRole(['super_admin', 'edufam_admin', 'hr_manager']),
  body('userId').isUUID().withMessage('Valid user ID is required'),
  body('employeeId').isString().trim().isLength({ min: 1, max: 20 }).withMessage('Employee ID is required (1-20 characters)'),
  body('employeeType').isIn(['permanent', 'contract', 'intern', 'consultant', 'part_time']).withMessage('Valid employee type is required'),
  body('jobTitle').isString().trim().isLength({ min: 1, max: 100 }).withMessage('Job title is required (1-100 characters)'),
  body('jobLevel').optional().isString().trim().withMessage('Job level must be a string'),
  body('departmentId').isUUID().withMessage('Valid department ID is required'),
  body('hireDate').isISO8601().withMessage('Valid hire date is required'),
  body('baseSalary').optional().isFloat({ min: 0 }).withMessage('Base salary must be a positive number'),
  body('currency').optional().isLength({ min: 3, max: 3 }).withMessage('Currency must be 3 characters'),
  body('reportingManagerId').optional().isUUID().withMessage('Reporting manager ID must be valid UUID'),
  body('workLocation').optional().isIn(['office', 'remote', 'hybrid']).withMessage('Work location must be office, remote, or hybrid'),
  body('officeLocation').optional().isString().trim().withMessage('Office location must be a string')
], validate, adminHrController.createEmployee);

/**
 * Get employee details
 * GET /api/v1/admin/hr/employees/:employeeId
 */
router.get('/employees/:employeeId', [
  requireRole(['super_admin', 'edufam_admin', 'hr_manager']),
  param('employeeId').isUUID().withMessage('Valid employee ID is required')
], validate, adminHrController.getEmployee);

/**
 * Update employee
 * PUT /api/v1/admin/hr/employees/:employeeId
 */
router.put('/employees/:employeeId', [
  requireRole(['super_admin', 'edufam_admin', 'hr_manager']),
  param('employeeId').isUUID().withMessage('Valid employee ID is required'),
  body('jobTitle').optional().isString().trim().isLength({ min: 1, max: 100 }).withMessage('Job title must be 1-100 characters'),
  body('jobLevel').optional().isString().trim().withMessage('Job level must be a string'),
  body('departmentId').optional().isUUID().withMessage('Department ID must be valid UUID'),
  body('baseSalary').optional().isFloat({ min: 0 }).withMessage('Base salary must be a positive number'),
  body('reportingManagerId').optional().isUUID().withMessage('Reporting manager ID must be valid UUID'),
  body('workLocation').optional().isIn(['office', 'remote', 'hybrid']).withMessage('Work location must be office, remote, or hybrid'),
  body('employmentStatus').optional().isIn(['active', 'on_leave', 'suspended', 'terminated', 'resigned']).withMessage('Invalid employment status'),
  body('performanceRating').optional().isFloat({ min: 1, max: 5 }).withMessage('Performance rating must be between 1 and 5')
], validate, adminHrController.updateEmployee);

/**
 * Get employees list
 * GET /api/v1/admin/hr/employees
 */
router.get('/employees', [
  requireRole(['super_admin', 'edufam_admin', 'hr_manager']),
  query('department').optional().isUUID().withMessage('Department must be valid UUID'),
  query('employeeType').optional().isIn(['permanent', 'contract', 'intern', 'consultant', 'part_time']).withMessage('Invalid employee type'),
  query('employmentStatus').optional().isIn(['active', 'on_leave', 'suspended', 'terminated', 'resigned']).withMessage('Invalid employment status'),
  query('search').optional().isString().trim().withMessage('Search must be a string'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
], validate, adminHrController.getEmployees);

// ====================================
// LEAVE MANAGEMENT
// ====================================

/**
 * Submit leave request
 * POST /api/v1/admin/hr/leaves
 */
router.post('/leaves', [
  body('employeeId').isUUID().withMessage('Valid employee ID is required'),
  body('leaveType').isIn(['annual', 'sick', 'maternity', 'paternity', 'bereavement', 'study', 'unpaid', 'emergency']).withMessage('Valid leave type is required'),
  body('leaveReason').optional().isString().trim().withMessage('Leave reason must be a string'),
  body('startDate').isISO8601().withMessage('Valid start date is required'),
  body('endDate').isISO8601().withMessage('Valid end date is required'),
  body('totalDays').isInt({ min: 1 }).withMessage('Total days must be a positive integer'),
  body('coverageArrangement').optional().isString().trim().withMessage('Coverage arrangement must be a string')
], validate, adminHrController.submitLeaveRequest);

/**
 * Process leave request (approve/reject)
 * PUT /api/v1/admin/hr/leaves/:leaveId/process
 */
router.put('/leaves/:leaveId/process', [
  requireRole(['super_admin', 'edufam_admin', 'hr_manager']),
  param('leaveId').isUUID().withMessage('Valid leave ID is required'),
  body('decision').isIn(['approved', 'rejected']).withMessage('Decision must be approved or rejected'),
  body('comments').optional().isString().trim().withMessage('Comments must be a string')
], validate, adminHrController.processLeaveRequest);

// List leave requests
router.get('/leaves', [
  requireRole(['super_admin', 'edufam_admin', 'hr_manager']),
  query('status').optional().isIn(['pending','approved','rejected']).withMessage('Invalid status'),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 200 })
], validate, adminHrController.getLeaves);

// ====================================
// DEPARTMENT MANAGEMENT
// ====================================

/**
 * Create department
 * POST /api/v1/admin/hr/departments
 */
router.post('/departments', [
  requireRole(['super_admin', 'edufam_admin', 'hr_manager']),
  body('departmentName').isString().trim().isLength({ min: 1, max: 100 }).withMessage('Department name is required (1-100 characters)'),
  body('departmentCode').isString().trim().isLength({ min: 1, max: 20 }).withMessage('Department code is required (1-20 characters)'),
  body('description').optional().isString().trim().withMessage('Description must be a string'),
  body('headOfDepartment').optional().isUUID().withMessage('Head of department must be valid UUID'),
  body('parentDepartmentId').optional().isUUID().withMessage('Parent department ID must be valid UUID'),
  body('annualBudget').optional().isFloat({ min: 0 }).withMessage('Annual budget must be a positive number'),
  body('officeLocation').optional().isString().trim().withMessage('Office location must be a string'),
  body('contactEmail').optional().isEmail().withMessage('Contact email must be valid')
], validate, adminHrController.createDepartment);

/**
 * Get departments
 * GET /api/v1/admin/hr/departments
 */
router.get('/departments', [
  requireRole(['super_admin', 'edufam_admin', 'hr_manager'])
], adminHrController.getDepartments);

// ====================================
// PERFORMANCE REVIEWS
// ====================================

/**
 * Create performance review
 * POST /api/v1/admin/hr/performance-reviews
 */
router.post('/performance-reviews', [
  requireRole(['super_admin', 'edufam_admin', 'hr_manager']),
  body('employeeId').isUUID().withMessage('Valid employee ID is required'),
  body('reviewPeriodStart').isISO8601().withMessage('Valid review period start date is required'),
  body('reviewPeriodEnd').isISO8601().withMessage('Valid review period end date is required'),
  body('reviewType').isIn(['probation', 'quarterly', 'annual', 'promotion', 'disciplinary']).withMessage('Valid review type is required'),
  body('overallRating').isFloat({ min: 1, max: 5 }).withMessage('Overall rating must be between 1 and 5'),
  body('technicalSkillsRating').optional().isFloat({ min: 1, max: 5 }).withMessage('Technical skills rating must be between 1 and 5'),
  body('communicationRating').optional().isFloat({ min: 1, max: 5 }).withMessage('Communication rating must be between 1 and 5'),
  body('teamworkRating').optional().isFloat({ min: 1, max: 5 }).withMessage('Teamwork rating must be between 1 and 5'),
  body('goalsSetPreviousReview').optional().isArray().withMessage('Goals must be an array'),
  body('keyAccomplishments').optional().isArray().withMessage('Key accomplishments must be an array'),
  body('areasForImprovement').optional().isArray().withMessage('Areas for improvement must be an array'),
  body('trainingRecommendations').optional().isArray().withMessage('Training recommendations must be an array')
], validate, adminHrController.createPerformanceReview);

// ====================================
// ASSET MANAGEMENT
// ====================================

/**
 * Add company asset
 * POST /api/v1/admin/hr/assets
 */
router.post('/assets', [
  requireRole(['super_admin', 'edufam_admin', 'hr_manager']),
  body('assetName').isString().trim().isLength({ min: 1, max: 200 }).withMessage('Asset name is required (1-200 characters)'),
  body('assetCode').isString().trim().isLength({ min: 1, max: 50 }).withMessage('Asset code is required (1-50 characters)'),
  body('assetCategory').isString().trim().isLength({ min: 1, max: 50 }).withMessage('Asset category is required'),
  body('assetType').optional().isString().trim().withMessage('Asset type must be a string'),
  body('brand').optional().isString().trim().withMessage('Brand must be a string'),
  body('model').optional().isString().trim().withMessage('Model must be a string'),
  body('serialNumber').optional().isString().trim().withMessage('Serial number must be a string'),
  body('purchaseCost').optional().isFloat({ min: 0 }).withMessage('Purchase cost must be a positive number'),
  body('purchaseDate').optional().isISO8601().withMessage('Purchase date must be valid'),
  body('supplier').optional().isString().trim().withMessage('Supplier must be a string'),
  body('warrantyPeriodMonths').optional().isInt({ min: 0 }).withMessage('Warranty period must be a positive integer'),
  body('departmentId').optional().isUUID().withMessage('Department ID must be valid UUID')
], validate, adminHrController.addAsset);

// List assets
router.get('/assets', [
  requireRole(['super_admin', 'edufam_admin', 'hr_manager']),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 200 })
], validate, adminHrController.getAssets);

/**
 * Assign asset to employee
 * PUT /api/v1/admin/hr/assets/:assetId/assign
 */
router.put('/assets/:assetId/assign', [
  requireRole(['super_admin', 'edufam_admin', 'hr_manager']),
  param('assetId').isUUID().withMessage('Valid asset ID is required'),
  body('employeeId').isUUID().withMessage('Valid employee ID is required')
], validate, adminHrController.assignAsset);

// ====================================
// ANALYTICS AND REPORTS
// ====================================

/**
 * Get HR dashboard
 * GET /api/v1/admin/hr/dashboard
 */
router.get('/dashboard', [
  requireRole(['super_admin', 'edufam_admin', 'hr_manager'])
], adminHrController.getHrDashboard);

/**
 * Get department analytics
 * GET /api/v1/admin/hr/departments/:departmentId/analytics
 */
router.get('/departments/:departmentId/analytics', [
  requireRole(['super_admin', 'edufam_admin', 'hr_manager']),
  param('departmentId').isUUID().withMessage('Valid department ID is required')
], validate, adminHrController.getDepartmentAnalytics);

/**
 * Export employee data
 * GET /api/v1/admin/hr/employees/export
 */
router.get('/employees/export', [
  requireRole(['super_admin', 'edufam_admin', 'hr_manager']),
  query('format').optional().isIn(['csv', 'excel', 'json']).withMessage('Format must be csv, excel, or json'),
  query('department').optional().isUUID().withMessage('Department must be valid UUID'),
  query('employmentStatus').optional().isIn(['active', 'on_leave', 'suspended', 'terminated', 'resigned']).withMessage('Invalid employment status')
], validate, adminHrController.exportEmployeeData);

// ====================================
// EMPLOYEE SELF-SERVICE
// ====================================

/**
 * Get my employee profile
 * GET /api/v1/admin/hr/my-profile
 */
router.get('/my-profile', adminHrController.getMyProfile);

/**
 * Get my leave history
 * GET /api/v1/admin/hr/my-leaves
 */
router.get('/my-leaves', adminHrController.getMyLeaveHistory);

// ====================================
// ERROR HANDLING
// ====================================

// Global error handler for HR routes
router.use((error, req, res, next) => {
  console.error('Admin HR route error:', error);
  
  res.status(error.statusCode || 500).json({
    success: false,
    error: {
      code: error.code || 'HR_ERROR',
      message: error.message || 'An error occurred in HR management'
    }
  });
});

module.exports = router;