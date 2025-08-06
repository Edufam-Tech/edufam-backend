const feeAssignmentService = require('../services/feeAssignmentService');
const { asyncHandler } = require('../middleware/errorHandler');
const { ValidationError, AuthorizationError } = require('../middleware/errorHandler');

/**
 * Fee Assignment Controller
 * Handles fee assignment workflow, approvals, and management
 */
class FeeAssignmentController {

  /**
   * Create a new fee assignment
   * POST /api/v1/finance/fee-assignments
   */
  createFeeAssignment = asyncHandler(async (req, res) => {
    const createdBy = req.user.userId;
    const schoolId = req.activeSchoolId || req.user.schoolId;

    // Validate required fields
    const requiredFields = [
      'assignmentName', 'assignmentType', 'academicYear', 
      'effectiveDate', 'dueDate', 'feeItems'
    ];

    for (const field of requiredFields) {
      if (!req.body[field]) {
        throw new ValidationError(`${field} is required`);
      }
    }

    // Validate assignment type specific requirements
    const { assignmentType } = req.body;
    if (assignmentType === 'class' && !req.body.targetClassId) {
      throw new ValidationError('Target class ID is required for class assignments');
    }
    if (assignmentType === 'grade_level' && !req.body.targetGradeLevel) {
      throw new ValidationError('Target grade level is required for grade level assignments');
    }
    if (assignmentType === 'individual' && (!req.body.targetStudents || req.body.targetStudents.length === 0)) {
      throw new ValidationError('Target students are required for individual assignments');
    }

    // Validate fee items
    if (!Array.isArray(req.body.feeItems) || req.body.feeItems.length === 0) {
      throw new ValidationError('At least one fee item is required');
    }

    // Validate dates
    const effectiveDate = new Date(req.body.effectiveDate);
    const dueDate = new Date(req.body.dueDate);
    if (dueDate < effectiveDate) {
      throw new ValidationError('Due date cannot be before effective date');
    }

    const assignmentData = {
      ...req.body,
      schoolId
    };

    const assignment = await feeAssignmentService.createFeeAssignment(assignmentData, createdBy);

    res.status(201).json({
      success: true,
      data: {
        assignment
      },
      message: 'Fee assignment created successfully'
    });
  });

  /**
   * Get fee assignments with filters
   * GET /api/v1/finance/fee-assignments
   */
  getFeeAssignments = asyncHandler(async (req, res) => {
    const schoolId = req.activeSchoolId || req.user.schoolId;
    
    // Build filters from query parameters
    const filters = {
      status: req.query.status,
      curriculumType: req.query.curriculum,
      academicYear: req.query.academicYear,
      academicTerm: req.query.academicTerm,
      assignmentType: req.query.assignmentType,
      createdBy: req.query.createdBy,
      dueDateFrom: req.query.dueDateFrom,
      dueDateTo: req.query.dueDateTo,
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 50
    };

    // Remove undefined values
    Object.keys(filters).forEach(key => 
      filters[key] === undefined && delete filters[key]
    );

    const result = await feeAssignmentService.getFeeAssignments(schoolId, filters);

    res.json({
      success: true,
      data: result,
      message: 'Fee assignments retrieved successfully'
    });
  });

  /**
   * Get fee assignment by ID
   * GET /api/v1/finance/fee-assignments/:id
   */
  getFeeAssignmentById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const schoolId = req.activeSchoolId || req.user.schoolId;

    const assignment = await feeAssignmentService.getFeeAssignmentById(id, schoolId);

    if (!assignment) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'ASSIGNMENT_NOT_FOUND',
          message: 'Fee assignment not found'
        }
      });
    }

    res.json({
      success: true,
      data: {
        assignment
      },
      message: 'Fee assignment retrieved successfully'
    });
  });

  /**
   * Update fee assignment
   * PUT /api/v1/finance/fee-assignments/:id
   */
  updateFeeAssignment = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const schoolId = req.activeSchoolId || req.user.schoolId;
    const updatedBy = req.user.userId;

    // Get existing assignment
    const existingAssignment = await feeAssignmentService.getFeeAssignmentById(id, schoolId);
    if (!existingAssignment) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'ASSIGNMENT_NOT_FOUND',
          message: 'Fee assignment not found'
        }
      });
    }

    // Validate assignment can be updated
    if (!['draft', 'rejected'].includes(existingAssignment.status)) {
      throw new ValidationError('Only draft or rejected assignments can be updated');
    }

    // Validate user can update this assignment
    if (existingAssignment.created_by !== updatedBy && !['principal', 'finance_manager', 'school_director'].includes(req.user.role)) {
      throw new AuthorizationError('You can only update your own assignments');
    }

    const updateData = {
      ...req.body,
      updatedBy
    };

    const updatedAssignment = await feeAssignmentService.updateFeeAssignment(id, updateData, updatedBy);

    res.json({
      success: true,
      data: {
        assignment: updatedAssignment
      },
      message: 'Fee assignment updated successfully'
    });
  });

  /**
   * Delete fee assignment
   * DELETE /api/v1/finance/fee-assignments/:id
   */
  deleteFeeAssignment = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const schoolId = req.activeSchoolId || req.user.schoolId;
    const deletedBy = req.user.userId;

    const assignment = await feeAssignmentService.getFeeAssignmentById(id, schoolId);
    if (!assignment) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'ASSIGNMENT_NOT_FOUND',
          message: 'Fee assignment not found'
        }
      });
    }

    // Validate assignment can be deleted
    if (!['draft', 'rejected'].includes(assignment.status)) {
      throw new ValidationError('Only draft or rejected assignments can be deleted');
    }

    // Validate user can delete this assignment
    if (assignment.created_by !== deletedBy && !['principal', 'finance_manager', 'school_director'].includes(req.user.role)) {
      throw new AuthorizationError('You can only delete your own assignments');
    }

    await feeAssignmentService.deleteFeeAssignment(id, deletedBy);

    res.json({
      success: true,
      message: 'Fee assignment deleted successfully'
    });
  });

  /**
   * Submit fee assignment for approval
   * PUT /api/v1/finance/fee-assignments/:id/submit-approval
   */
  submitForApproval = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { justification } = req.body;
    const submittedBy = req.user.userId;

    const assignment = await feeAssignmentService.submitForApproval(id, submittedBy, justification);

    res.json({
      success: true,
      data: {
        assignment
      },
      message: 'Fee assignment submitted for approval successfully'
    });
  });

  /**
   * Approve fee assignment
   * POST /api/v1/director/fee-assignments/:id/approve
   */
  approveFeeAssignment = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { comments, approvalLevel } = req.body;
    const approverId = req.user.userId;

    // Validate user has approval permissions
    if (!['principal', 'finance_manager', 'school_director', 'super_admin'].includes(req.user.role)) {
      throw new AuthorizationError('Insufficient permissions to approve fee assignments');
    }

    const assignment = await feeAssignmentService.approveFeeAssignment(
      id, 
      approverId, 
      comments, 
      approvalLevel || 1
    );

    res.json({
      success: true,
      data: {
        assignment
      },
      message: 'Fee assignment approved successfully'
    });
  });

  /**
   * Reject fee assignment
   * POST /api/v1/director/fee-assignments/:id/reject
   */
  rejectFeeAssignment = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { rejectionReason, rejectionDetails } = req.body;
    const rejectedBy = req.user.userId;

    if (!rejectionReason) {
      throw new ValidationError('Rejection reason is required');
    }

    // Validate user has approval permissions
    if (!['principal', 'finance_manager', 'school_director', 'super_admin'].includes(req.user.role)) {
      throw new AuthorizationError('Insufficient permissions to reject fee assignments');
    }

    const assignment = await feeAssignmentService.rejectFeeAssignment(
      id, 
      rejectedBy, 
      rejectionReason, 
      rejectionDetails
    );

    res.json({
      success: true,
      data: {
        assignment
      },
      message: 'Fee assignment rejected successfully'
    });
  });

  /**
   * Execute fee assignment (create student assignments)
   * POST /api/v1/finance/fee-assignments/:id/execute
   */
  executeFeeAssignment = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const executedBy = req.user.userId;

    // Validate user has execution permissions
    if (!['finance_manager', 'principal', 'school_director', 'super_admin'].includes(req.user.role)) {
      throw new AuthorizationError('Insufficient permissions to execute fee assignments');
    }

    const result = await feeAssignmentService.executeFeeAssignment(id, executedBy);

    res.json({
      success: true,
      data: {
        executionResult: result
      },
      message: 'Fee assignment execution completed'
    });
  });

  /**
   * Get pending approvals
   * GET /api/v1/finance/fee-assignments/pending-approvals
   */
  getPendingApprovals = asyncHandler(async (req, res) => {
    const schoolId = req.activeSchoolId || req.user.schoolId;
    const userRole = req.user.role;

    // Get assignments pending approval that the user can approve
    const filters = {
      status: 'submitted',
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 50
    };

    const result = await feeAssignmentService.getFeeAssignments(schoolId, filters);

    // Filter based on user's approval level
    let assignments = result.assignments;
    if (userRole === 'finance_manager') {
      // Finance managers can approve level 1
      assignments = assignments.filter(a => 
        a.approvals && a.approvals.some(approval => 
          approval.approval_level === 1 && 
          approval.approval_status === 'pending' &&
          approval.approver_role === 'finance_manager'
        )
      );
    } else if (userRole === 'principal') {
      // Principals can approve level 2
      assignments = assignments.filter(a => 
        a.approvals && a.approvals.some(approval => 
          approval.approval_level === 2 && 
          approval.approval_status === 'pending' &&
          approval.approver_role === 'principal'
        )
      );
    } else if (['school_director', 'super_admin'].includes(userRole)) {
      // Directors can approve any level
      assignments = assignments.filter(a => 
        a.approvals && a.approvals.some(approval => 
          approval.approval_status === 'pending'
        )
      );
    }

    res.json({
      success: true,
      data: {
        assignments,
        pagination: result.pagination
      },
      message: 'Pending approvals retrieved successfully'
    });
  });

  /**
   * Get approval history
   * GET /api/v1/finance/fee-assignments/approval-history
   */
  getApprovalHistory = asyncHandler(async (req, res) => {
    const schoolId = req.activeSchoolId || req.user.schoolId;
    
    const filters = {
      status: ['approved', 'rejected'],
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 50
    };

    if (req.query.dateFrom) {
      filters.dueDateFrom = req.query.dateFrom;
    }
    if (req.query.dateTo) {
      filters.dueDateTo = req.query.dateTo;
    }

    const result = await feeAssignmentService.getFeeAssignments(schoolId, filters);

    res.json({
      success: true,
      data: result,
      message: 'Approval history retrieved successfully'
    });
  });

  /**
   * Get student fee assignments
   * GET /api/v1/finance/student-fee-assignments
   */
  getStudentFeeAssignments = asyncHandler(async (req, res) => {
    const schoolId = req.activeSchoolId || req.user.schoolId;
    
    const filters = {
      studentId: req.query.studentId,
      classId: req.query.classId,
      paymentStatus: req.query.paymentStatus,
      assignmentStatus: req.query.assignmentStatus,
      dueDateFrom: req.query.dueDateFrom,
      dueDateTo: req.query.dueDateTo,
      hasBalance: req.query.hasBalance === 'true',
      isOverdue: req.query.isOverdue === 'true',
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 50
    };

    // Remove undefined values
    Object.keys(filters).forEach(key => 
      filters[key] === undefined && delete filters[key]
    );

    const result = await feeAssignmentService.getStudentFeeAssignments(schoolId, filters);

    res.json({
      success: true,
      data: result,
      message: 'Student fee assignments retrieved successfully'
    });
  });

  /**
   * Get fee assignment templates
   * GET /api/v1/finance/fee-structures/templates
   */
  getAssignmentTemplates = asyncHandler(async (req, res) => {
    const schoolId = req.activeSchoolId || req.user.schoolId;
    
    const filters = {
      curriculum: req.query.curriculum,
      category: req.query.category,
      isActive: req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined
    };

    // Remove undefined values
    Object.keys(filters).forEach(key => 
      filters[key] === undefined && delete filters[key]
    );

    const templates = await feeAssignmentService.getAssignmentTemplates(schoolId, filters);

    res.json({
      success: true,
      data: {
        templates
      },
      message: 'Assignment templates retrieved successfully'
    });
  });

  /**
   * Create fee assignment template
   * POST /api/v1/finance/fee-structures/templates
   */
  createAssignmentTemplate = asyncHandler(async (req, res) => {
    const createdBy = req.user.userId;
    const schoolId = req.activeSchoolId || req.user.schoolId;

    // Validate required fields
    if (!req.body.templateName) {
      throw new ValidationError('Template name is required');
    }
    if (!req.body.templateCategory) {
      throw new ValidationError('Template category is required');
    }
    if (!req.body.feeItems || !Array.isArray(req.body.feeItems)) {
      throw new ValidationError('Fee items are required');
    }

    const templateData = {
      ...req.body,
      schoolId
    };

    const template = await feeAssignmentService.createAssignmentTemplate(templateData, createdBy);

    res.status(201).json({
      success: true,
      data: {
        template
      },
      message: 'Assignment template created successfully'
    });
  });

  /**
   * Get curriculum-specific templates
   * GET /api/v1/finance/fee-structures/templates/:curriculum
   */
  getCurriculumTemplates = asyncHandler(async (req, res) => {
    const { curriculum } = req.params;
    const schoolId = req.activeSchoolId || req.user.schoolId;

    // Validate curriculum type
    const validCurriculums = ['CBC', 'IGCSE', '8-4-4', 'CAMBRIDGE', 'IB', 'UNIVERSAL'];
    if (!validCurriculums.includes(curriculum.toUpperCase())) {
      throw new ValidationError('Invalid curriculum type');
    }

    const filters = {
      curriculum: curriculum.toUpperCase(),
      isActive: true
    };

    const templates = await feeAssignmentService.getAssignmentTemplates(schoolId, filters);

    res.json({
      success: true,
      data: {
        curriculum: curriculum.toUpperCase(),
        templates
      },
      message: `${curriculum.toUpperCase()} templates retrieved successfully`
    });
  });

  /**
   * Bulk create fee assignments
   * POST /api/v1/finance/fee-assignments/bulk-create
   */
  bulkCreateFeeAssignments = asyncHandler(async (req, res) => {
    const createdBy = req.user.userId;
    const { assignments } = req.body;

    if (!Array.isArray(assignments) || assignments.length === 0) {
      throw new ValidationError('Assignments array is required');
    }

    if (assignments.length > 50) {
      throw new ValidationError('Maximum 50 assignments can be created at once');
    }

    // Validate each assignment
    for (const assignment of assignments) {
      if (!assignment.assignmentName || !assignment.assignmentType) {
        throw new ValidationError('Each assignment must have name and type');
      }
    }

    const results = {
      successful: [],
      failed: []
    };

    // Process each assignment
    for (const assignmentData of assignments) {
      try {
        const assignment = await feeAssignmentService.createFeeAssignment(
          { ...assignmentData, schoolId: req.activeSchoolId || req.user.schoolId }, 
          createdBy
        );
        results.successful.push(assignment);
      } catch (error) {
        results.failed.push({
          assignment: assignmentData,
          error: error.message
        });
      }
    }

    res.json({
      success: true,
      data: {
        results,
        summary: {
          total: assignments.length,
          successful: results.successful.length,
          failed: results.failed.length
        }
      },
      message: `Bulk creation completed: ${results.successful.length}/${assignments.length} successful`
    });
  });

  /**
   * Get fee assignment analytics
   * GET /api/v1/finance/fee-assignments/analytics
   */
  getAssignmentAnalytics = asyncHandler(async (req, res) => {
    const schoolId = req.activeSchoolId || req.user.schoolId;
    const { period, curriculum, groupBy } = req.query;

    // This is a placeholder for analytics implementation
    // In a real implementation, you would calculate various metrics
    const analytics = {
      overview: {
        totalAssignments: 0,
        totalAmount: 0,
        pendingApprovals: 0,
        executedAssignments: 0
      },
      byStatus: {
        draft: 0,
        submitted: 0,
        approved: 0,
        rejected: 0,
        active: 0,
        completed: 0
      },
      byCurriculum: {
        CBC: 0,
        IGCSE: 0,
        '8-4-4': 0,
        UNIVERSAL: 0
      },
      trends: [],
      period: period || 'last_30_days',
      generatedAt: new Date().toISOString()
    };

    res.json({
      success: true,
      data: {
        analytics
      },
      message: 'Fee assignment analytics retrieved successfully'
    });
  });
}

module.exports = new FeeAssignmentController();