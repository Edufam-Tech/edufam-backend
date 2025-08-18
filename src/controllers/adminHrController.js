const adminHrService = require('../services/adminHrService');
const { asyncHandler } = require('../middleware/errorHandler');
const { ValidationError } = require('../middleware/errorHandler');

/**
 * Admin HR Controller
 * Handles internal Edufam company HR operations and employee management
 */
class AdminHrController {

  /**
   * Employee Management
   */

  // Create new employee
  createEmployee = asyncHandler(async (req, res) => {
    const {
      userId,
      employeeId,
      employeeType,
      jobTitle,
      jobLevel,
      departmentId,
      hireDate,
      baseSalary,
      currency,
      reportingManagerId,
      workLocation,
      officeLocation
    } = req.body;

    // Validate required fields
    if (!userId || !employeeId || !jobTitle || !departmentId || !hireDate) {
      throw new ValidationError('User ID, employee ID, job title, department, and hire date are required');
    }

    const employee = await adminHrService.createEmployee({
      userId,
      employeeId,
      employeeType,
      jobTitle,
      jobLevel,
      departmentId,
      hireDate,
      baseSalary,
      currency,
      reportingManagerId,
      workLocation,
      officeLocation,
      createdBy: req.user.userId
    });

    res.status(201).json({
      success: true,
      data: { employee },
      message: 'Employee created successfully'
    });
  });

  // Get employee details
  getEmployee = asyncHandler(async (req, res) => {
    const { employeeId } = req.params;
    
    const employee = await adminHrService.getEmployee(employeeId);

    res.json({
      success: true,
      data: { employee },
      message: 'Employee details retrieved successfully'
    });
  });

  // Update employee
  updateEmployee = asyncHandler(async (req, res) => {
    const { employeeId } = req.params;
    const updateData = req.body;

    const employee = await adminHrService.updateEmployee(employeeId, updateData);

    res.json({
      success: true,
      data: { employee },
      message: 'Employee updated successfully'
    });
  });

  // Get employees list
  getEmployees = asyncHandler(async (req, res) => {
    const filters = {
      department: req.query.department,
      employeeType: req.query.employeeType,
      employmentStatus: req.query.employmentStatus,
      search: req.query.search,
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20
    };

    // Remove undefined values
    Object.keys(filters).forEach(key => 
      filters[key] === undefined && delete filters[key]
    );

    const employees = await adminHrService.getEmployees(filters);

    res.json({
      success: true,
      data: {
        employees,
        pagination: {
          page: filters.page,
          limit: filters.limit,
          hasMore: employees.length === filters.limit
        }
      },
      message: 'Employees retrieved successfully'
    });
  });

  /**
   * Leave Management
   */

  // Submit leave request
  submitLeaveRequest = asyncHandler(async (req, res) => {
    const {
      employeeId,
      leaveType,
      leaveReason,
      startDate,
      endDate,
      totalDays,
      coverageArrangement
    } = req.body;

    if (!employeeId || !leaveType || !startDate || !endDate || !totalDays) {
      throw new ValidationError('Employee ID, leave type, dates, and total days are required');
    }

    const leaveRequest = await adminHrService.submitLeaveRequest({
      employeeId,
      leaveType,
      leaveReason,
      startDate,
      endDate,
      totalDays,
      coverageArrangement,
      requestedBy: req.user.userId
    });

    res.status(201).json({
      success: true,
      data: { leaveRequest },
      message: 'Leave request submitted successfully'
    });
  });

  // Process leave request (approve/reject)
  processLeaveRequest = asyncHandler(async (req, res) => {
    const { leaveId } = req.params;
    const { decision, comments } = req.body;

    if (!decision || !['approved', 'rejected'].includes(decision)) {
      throw new ValidationError('Decision must be either approved or rejected');
    }

    const leaveRequest = await adminHrService.processLeaveRequest(
      leaveId,
      decision,
      req.user.userId,
      comments
    );

    res.json({
      success: true,
      data: { leaveRequest },
      message: `Leave request ${decision} successfully`
    });
  });

  /**
   * Department Management
   */

  // Create department
  createDepartment = asyncHandler(async (req, res) => {
    const {
      departmentName,
      departmentCode,
      description,
      headOfDepartment,
      parentDepartmentId,
      annualBudget,
      officeLocation,
      contactEmail
    } = req.body;

    if (!departmentName || !departmentCode) {
      throw new ValidationError('Department name and code are required');
    }

    const department = await adminHrService.createDepartment({
      departmentName,
      departmentCode,
      description,
      headOfDepartment,
      parentDepartmentId,
      annualBudget,
      officeLocation,
      contactEmail,
      createdBy: req.user.userId
    });

    res.status(201).json({
      success: true,
      data: { department },
      message: 'Department created successfully'
    });
  });

  // Get departments
  getDepartments = asyncHandler(async (req, res) => {
    const departments = await adminHrService.getDepartments();

    res.json({
      success: true,
      data: { departments },
      message: 'Departments retrieved successfully'
    });
  });

  /**
   * Performance Reviews
   */

  // Create performance review
  createPerformanceReview = asyncHandler(async (req, res) => {
    const {
      employeeId,
      reviewPeriodStart,
      reviewPeriodEnd,
      reviewType,
      overallRating,
      technicalSkillsRating,
      communicationRating,
      teamworkRating,
      goalsSetPreviousReview,
      keyAccomplishments,
      areasForImprovement,
      trainingRecommendations
    } = req.body;

    if (!employeeId || !reviewPeriodStart || !reviewPeriodEnd || !reviewType || !overallRating) {
      throw new ValidationError('Employee ID, review period, type, and overall rating are required');
    }

    const review = await adminHrService.createPerformanceReview({
      employeeId,
      reviewerId: req.user.userId,
      reviewPeriodStart,
      reviewPeriodEnd,
      reviewType,
      overallRating,
      technicalSkillsRating,
      communicationRating,
      teamworkRating,
      goalsSetPreviousReview,
      keyAccomplishments,
      areasForImprovement,
      trainingRecommendations
    });

    res.status(201).json({
      success: true,
      data: { review },
      message: 'Performance review created successfully'
    });
  });

  /**
   * Asset Management
   */

  // Add company asset
  addAsset = asyncHandler(async (req, res) => {
    const {
      assetName,
      assetCode,
      assetCategory,
      assetType,
      brand,
      model,
      serialNumber,
      purchaseCost,
      purchaseDate,
      supplier,
      warrantyPeriodMonths,
      departmentId
    } = req.body;

    if (!assetName || !assetCode || !assetCategory) {
      throw new ValidationError('Asset name, code, and category are required');
    }

    const asset = await adminHrService.addAsset({
      assetName,
      assetCode,
      assetCategory,
      assetType,
      brand,
      model,
      serialNumber,
      purchaseCost,
      purchaseDate,
      supplier,
      warrantyPeriodMonths,
      departmentId,
      createdBy: req.user.userId
    });

    res.status(201).json({
      success: true,
      data: { asset },
      message: 'Asset added successfully'
    });
  });

  // Assign asset to employee
  assignAsset = asyncHandler(async (req, res) => {
    const { assetId } = req.params;
    const { employeeId } = req.body;

    if (!employeeId) {
      throw new ValidationError('Employee ID is required');
    }

    const asset = await adminHrService.assignAsset(assetId, employeeId, req.user.userId);

    res.json({
      success: true,
      data: { asset },
      message: 'Asset assigned successfully'
    });
  });

  /**
   * HR Analytics and Reports
   */

  // Get HR dashboard metrics
  getHrDashboard = asyncHandler(async (req, res) => {
    const metrics = await adminHrService.getHrDashboardMetrics();
    const performanceDistribution = await adminHrService.getPerformanceDistribution();

    res.json({
      success: true,
      data: {
        metrics,
        performanceDistribution,
        timestamp: new Date().toISOString()
      },
      message: 'HR dashboard data retrieved successfully'
    });
  });

  // Get leave requests list
  getLeaves = asyncHandler(async (req, res) => {
    const { status, page, limit } = req.query;
    const leaves = await adminHrService.getLeaves({ status, page, limit });
    res.json({ success: true, data: { leaves }, message: 'Leaves retrieved successfully' });
  });

  // Get assets list
  getAssets = asyncHandler(async (req, res) => {
    const { page, limit } = req.query;
    const assets = await adminHrService.getAssets({ page, limit });
    res.json({ success: true, data: { assets }, message: 'Assets retrieved successfully' });
  });

  // Get department analytics
  getDepartmentAnalytics = asyncHandler(async (req, res) => {
    const { departmentId } = req.params;
    
    // Get department-specific metrics
    const departmentMetrics = await adminHrService.query(`
      SELECT 
        d.department_name,
        d.annual_budget,
        d.current_budget_used,
        COUNT(e.id) as total_employees,
        COUNT(e.id) FILTER (WHERE e.employment_status = 'active') as active_employees,
        AVG(e.performance_rating) as avg_performance_rating,
        COUNT(l.id) FILTER (WHERE l.status = 'pending') as pending_leave_requests,
        COUNT(a.id) as department_assets
      FROM admin_departments d
      LEFT JOIN admin_employees e ON e.department_id = d.id
      LEFT JOIN admin_employee_leaves l ON l.employee_id = e.id AND l.status = 'pending'
      LEFT JOIN admin_company_assets a ON a.department_id = d.id
      WHERE d.id = $1
      GROUP BY d.id, d.department_name, d.annual_budget, d.current_budget_used
    `, [departmentId]);

    res.json({
      success: true,
      data: { departmentMetrics: departmentMetrics.rows[0] },
      message: 'Department analytics retrieved successfully'
    });
  });

  // Export employee data
  exportEmployeeData = asyncHandler(async (req, res) => {
    const { format = 'csv', department, employmentStatus } = req.query;

    const employees = await adminHrService.getEmployees({
      department,
      employmentStatus,
      limit: 1000 // Large limit for export
    });

    // For now, return JSON format
    // In production, implement actual CSV/Excel export
    res.json({
      success: true,
      data: {
        employees,
        format,
        exportedAt: new Date().toISOString(),
        totalRecords: employees.length
      },
      message: 'Employee data exported successfully'
    });
  });

  /**
   * Employee Self-Service
   */

  // Get my employee profile
  getMyProfile = asyncHandler(async (req, res) => {
    // Find employee record for current user
    const employeeResult = await adminHrService.query(`
      SELECT e.*, d.department_name
      FROM admin_employees e
      JOIN admin_departments d ON d.id = e.department_id
      WHERE e.user_id = $1
    `, [req.user.userId]);

    if (employeeResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'EMPLOYEE_NOT_FOUND',
          message: 'Employee profile not found'
        }
      });
    }

    res.json({
      success: true,
      data: { employee: employeeResult.rows[0] },
      message: 'Employee profile retrieved successfully'
    });
  });

  // Get my leave history
  getMyLeaveHistory = asyncHandler(async (req, res) => {
    const employeeResult = await adminHrService.query(`
      SELECT id FROM admin_employees WHERE user_id = $1
    `, [req.user.userId]);

    if (employeeResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'EMPLOYEE_NOT_FOUND',
          message: 'Employee profile not found'
        }
      });
    }

    const leaveHistory = await adminHrService.query(`
      SELECT * FROM admin_employee_leaves
      WHERE employee_id = $1
      ORDER BY start_date DESC
      LIMIT 50
    `, [employeeResult.rows[0].id]);

    res.json({
      success: true,
      data: { leaveHistory: leaveHistory.rows },
      message: 'Leave history retrieved successfully'
    });
  });
}

module.exports = new AdminHrController();