const { query } = require('../config/database');
const { DatabaseError, ValidationError, AuthorizationError } = require('../middleware/errorHandler');

/**
 * Fee Assignment Service
 * Handles fee assignment workflow, approvals, and processing
 */
class FeeAssignmentService {

  /**
   * Create a new fee assignment
   */
  async createFeeAssignment(assignmentData, createdBy) {
    try {
      // Generate assignment code
      const assignmentCode = await this.generateAssignmentCode(
        assignmentData.schoolId, 
        assignmentData.assignmentType
      );

      // Calculate total amount from fee items
      const totalAmount = this.calculateTotalAmount(assignmentData.feeItems);

      const result = await query(`
        INSERT INTO fee_assignments (
          school_id,
          assignment_name,
          assignment_code,
          assignment_type,
          target_class_id,
          target_grade_level,
          target_students,
          target_criteria,
          fee_structure_id,
          custom_fees,
          curriculum_type,
          academic_year,
          academic_term,
          base_amount,
          discount_amount,
          discount_percentage,
          penalty_amount,
          tax_amount,
          total_amount,
          currency,
          payment_schedule,
          is_installment_based,
          installment_count,
          effective_date,
          due_date,
          grace_period_days,
          auto_assign_new_students,
          apply_to_existing_balances,
          override_existing_assignments,
          notify_parents,
          notify_students,
          notification_method,
          custom_notification_message,
          created_by
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 
          $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, 
          $29, $30, $31, $32, $33, $34
        ) RETURNING *
      `, [
        assignmentData.schoolId,
        assignmentData.assignmentName,
        assignmentCode,
        assignmentData.assignmentType,
        assignmentData.targetClassId || null,
        assignmentData.targetGradeLevel || null,
        assignmentData.targetStudents || null,
        assignmentData.targetCriteria ? JSON.stringify(assignmentData.targetCriteria) : null,
        assignmentData.feeStructureId || null,
        assignmentData.customFees ? JSON.stringify(assignmentData.customFees) : null,
        assignmentData.curriculumType || 'UNIVERSAL',
        assignmentData.academicYear,
        assignmentData.academicTerm || null,
        assignmentData.baseAmount || totalAmount,
        assignmentData.discountAmount || 0,
        assignmentData.discountPercentage || 0,
        assignmentData.penaltyAmount || 0,
        assignmentData.taxAmount || 0,
        totalAmount,
        assignmentData.currency || 'KES',
        assignmentData.paymentSchedule ? JSON.stringify(assignmentData.paymentSchedule) : null,
        assignmentData.isInstallmentBased || false,
        assignmentData.installmentCount || 1,
        assignmentData.effectiveDate,
        assignmentData.dueDate,
        assignmentData.gracePeriodDays || 0,
        assignmentData.autoAssignNewStudents || false,
        assignmentData.applyToExistingBalances || false,
        assignmentData.overrideExistingAssignments || false,
        assignmentData.notifyParents !== false, // Default true
        assignmentData.notifyStudents !== false, // Default true
        assignmentData.notificationMethod || 'sms',
        assignmentData.customNotificationMessage || null,
        createdBy
      ]);

      const assignment = result.rows[0];

      // Create fee assignment items
      if (assignmentData.feeItems && assignmentData.feeItems.length > 0) {
        await this.createFeeAssignmentItems(assignment.id, assignmentData.feeItems);
      }

      // Log creation
      await this.logAssignmentHistory(
        assignment.id,
        'created',
        'workflow',
        createdBy,
        null,
        assignment,
        'Fee assignment created'
      );

      return assignment;
    } catch (error) {
      throw new DatabaseError('Failed to create fee assignment', error);
    }
  }

  /**
   * Create fee assignment items
   */
  async createFeeAssignmentItems(assignmentId, feeItems) {
    try {
      const itemQueries = feeItems.map(item => {
        return query(`
          INSERT INTO fee_assignment_items (
            fee_assignment_id,
            fee_category,
            fee_subcategory,
            category_code,
            amount,
            original_amount,
            discount_amount,
            tax_rate,
            tax_amount,
            is_mandatory,
            is_refundable,
            is_prorated,
            proration_basis,
            description,
            internal_notes,
            applies_to_curriculum,
            grade_level_specific
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
          )
        `, [
          assignmentId,
          item.feeCategory,
          item.feeSubcategory || null,
          item.categoryCode || null,
          item.amount,
          item.originalAmount || item.amount,
          item.discountAmount || 0,
          item.taxRate || 0,
          item.taxAmount || 0,
          item.isMandatory !== false, // Default true
          item.isRefundable || false,
          item.isProrated || false,
          item.prorationBasis || null,
          item.description || null,
          item.internalNotes || null,
          item.appliesToCurriculum || null,
          item.gradeLevelSpecific || null
        ]);
      });

      await Promise.all(itemQueries);
    } catch (error) {
      throw new DatabaseError('Failed to create fee assignment items', error);
    }
  }

  /**
   * Get fee assignments with filters
   */
  async getFeeAssignments(schoolId, filters = {}) {
    try {
      let whereConditions = ['fa.school_id = $1'];
      let queryParams = [schoolId];
      let paramCount = 1;

      // Build dynamic filters
      if (filters.status) {
        paramCount++;
        whereConditions.push(`fa.status = $${paramCount}`);
        queryParams.push(filters.status);
      }

      if (filters.curriculumType) {
        paramCount++;
        whereConditions.push(`fa.curriculum_type = $${paramCount}`);
        queryParams.push(filters.curriculumType);
      }

      if (filters.academicYear) {
        paramCount++;
        whereConditions.push(`fa.academic_year = $${paramCount}`);
        queryParams.push(filters.academicYear);
      }

      if (filters.academicTerm) {
        paramCount++;
        whereConditions.push(`fa.academic_term = $${paramCount}`);
        queryParams.push(filters.academicTerm);
      }

      if (filters.assignmentType) {
        paramCount++;
        whereConditions.push(`fa.assignment_type = $${paramCount}`);
        queryParams.push(filters.assignmentType);
      }

      if (filters.createdBy) {
        paramCount++;
        whereConditions.push(`fa.created_by = $${paramCount}`);
        queryParams.push(filters.createdBy);
      }

      if (filters.dueDateFrom) {
        paramCount++;
        whereConditions.push(`fa.due_date >= $${paramCount}`);
        queryParams.push(filters.dueDateFrom);
      }

      if (filters.dueDateTo) {
        paramCount++;
        whereConditions.push(`fa.due_date <= $${paramCount}`);
        queryParams.push(filters.dueDateTo);
      }

      // Add pagination
      const limit = Math.min(filters.limit || 50, 100);
      const offset = (filters.page - 1) * limit || 0;

      const result = await query(`
        SELECT 
          fa.*,
          u_created.first_name || ' ' || u_created.last_name as created_by_name,
          u_approved.first_name || ' ' || u_approved.last_name as approved_by_name,
          c.name as target_class_name,
          COUNT(sfa.id) as students_assigned,
          SUM(CASE WHEN sfa.payment_status = 'completed' THEN 1 ELSE 0 END) as students_completed,
          SUM(CASE WHEN sfa.payment_status = 'overdue' THEN 1 ELSE 0 END) as students_overdue,
          SUM(sfa.total_amount) as total_assignment_amount,
          SUM(sfa.amount_paid) as total_amount_paid,
          SUM(sfa.balance_due) as total_balance_due
        FROM fee_assignments fa
        LEFT JOIN users u_created ON u_created.id = fa.created_by
        LEFT JOIN users u_approved ON u_approved.id = fa.approved_by
        LEFT JOIN classes c ON c.id = fa.target_class_id
        LEFT JOIN student_fee_assignments sfa ON sfa.fee_assignment_id = fa.id
        WHERE ${whereConditions.join(' AND ')}
        GROUP BY fa.id, u_created.id, u_approved.id, c.id
        ORDER BY fa.created_at DESC
        LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
      `, [...queryParams, limit, offset]);

      // Get total count for pagination
      const countResult = await query(`
        SELECT COUNT(DISTINCT fa.id) as total
        FROM fee_assignments fa
        WHERE ${whereConditions.join(' AND ')}
      `, queryParams);

      return {
        assignments: result.rows,
        pagination: {
          total: parseInt(countResult.rows[0].total),
          page: filters.page || 1,
          limit: limit,
          totalPages: Math.ceil(countResult.rows[0].total / limit)
        }
      };
    } catch (error) {
      throw new DatabaseError('Failed to get fee assignments', error);
    }
  }

  /**
   * Get fee assignment by ID with items
   */
  async getFeeAssignmentById(assignmentId, schoolId) {
    try {
      // Get assignment details
      const assignmentResult = await query(`
        SELECT 
          fa.*,
          u_created.first_name || ' ' || u_created.last_name as created_by_name,
          u_created.email as created_by_email,
          u_approved.first_name || ' ' || u_approved.last_name as approved_by_name,
          u_approved.email as approved_by_email,
          c.name as target_class_name,
          COUNT(sfa.id) as students_assigned,
          SUM(CASE WHEN sfa.payment_status = 'completed' THEN 1 ELSE 0 END) as students_completed,
          SUM(CASE WHEN sfa.payment_status = 'overdue' THEN 1 ELSE 0 END) as students_overdue,
          SUM(sfa.total_amount) as total_assignment_amount,
          SUM(sfa.amount_paid) as total_amount_paid,
          SUM(sfa.balance_due) as total_balance_due
        FROM fee_assignments fa
        LEFT JOIN users u_created ON u_created.id = fa.created_by
        LEFT JOIN users u_approved ON u_approved.id = fa.approved_by
        LEFT JOIN classes c ON c.id = fa.target_class_id
        LEFT JOIN student_fee_assignments sfa ON sfa.fee_assignment_id = fa.id
        WHERE fa.id = $1 AND fa.school_id = $2
        GROUP BY fa.id, u_created.id, u_approved.id, c.id
      `, [assignmentId, schoolId]);

      if (assignmentResult.rows.length === 0) {
        return null;
      }

      const assignment = assignmentResult.rows[0];

      // Get fee items
      const itemsResult = await query(`
        SELECT * FROM fee_assignment_items
        WHERE fee_assignment_id = $1
        ORDER BY fee_category
      `, [assignmentId]);

      assignment.feeItems = itemsResult.rows;

      // Get approval history
      const approvalsResult = await query(`
        SELECT 
          faa.*,
          u_approved.first_name || ' ' || u_approved.last_name as approved_by_name,
          u_delegated.first_name || ' ' || u_delegated.last_name as delegated_to_name
        FROM fee_assignment_approvals faa
        LEFT JOIN users u_approved ON u_approved.id = faa.approved_by
        LEFT JOIN users u_delegated ON u_delegated.id = faa.delegated_to
        WHERE faa.fee_assignment_id = $1
        ORDER BY faa.approval_level
      `, [assignmentId]);

      assignment.approvals = approvalsResult.rows;

      return assignment;
    } catch (error) {
      throw new DatabaseError('Failed to get fee assignment', error);
    }
  }

  /**
   * Submit fee assignment for approval
   */
  async submitForApproval(assignmentId, submittedBy, justification = null) {
    try {
      // Validate assignment exists and is in draft status
      const assignment = await this.getFeeAssignmentById(assignmentId);
      if (!assignment) {
        throw new ValidationError('Fee assignment not found');
      }

      if (assignment.status !== 'draft') {
        throw new ValidationError('Only draft assignments can be submitted for approval');
      }

      // Update assignment status
      const result = await query(`
        UPDATE fee_assignments 
        SET 
          status = 'submitted',
          submitted_by = $1,
          submitted_at = NOW(),
          updated_at = NOW()
        WHERE id = $2
        RETURNING *
      `, [submittedBy, assignmentId]);

      // Create approval records based on school's approval rules
      await this.createApprovalWorkflow(assignmentId, assignment.school_id, assignment.total_amount);

      // Log submission
      await this.logAssignmentHistory(
        assignmentId,
        'submitted',
        'workflow',
        submittedBy,
        assignment,
        result.rows[0],
        justification || 'Submitted for approval'
      );

      return result.rows[0];
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseError('Failed to submit fee assignment for approval', error);
    }
  }

  /**
   * Approve fee assignment
   */
  async approveFeeAssignment(assignmentId, approverId, comments = null, approvalLevel = 1) {
    try {
      // Get assignment
      const assignment = await this.getFeeAssignmentById(assignmentId);
      if (!assignment) {
        throw new ValidationError('Fee assignment not found');
      }

      if (assignment.status !== 'submitted') {
        throw new ValidationError('Only submitted assignments can be approved');
      }

      // Validate approver has permission
      const canApprove = await this.validateApproverPermissions(
        approverId, 
        assignment.school_id, 
        approvalLevel,
        assignment.total_amount
      );

      if (!canApprove) {
        throw new AuthorizationError('Insufficient permissions to approve this assignment');
      }

      // Update approval record
      await query(`
        UPDATE fee_assignment_approvals
        SET 
          approval_status = 'approved',
          approved_by = $1,
          approved_at = NOW(),
          approval_comments = $2
        WHERE fee_assignment_id = $3 AND approval_level = $4
      `, [approverId, comments, assignmentId, approvalLevel]);

      // Check if all required approvals are complete
      const pendingApprovals = await query(`
        SELECT COUNT(*) as pending_count
        FROM fee_assignment_approvals
        WHERE fee_assignment_id = $1 AND approval_status = 'pending'
      `, [assignmentId]);

      let newStatus = 'submitted';
      let approvedBy = null;
      let approvedAt = null;

      if (parseInt(pendingApprovals.rows[0].pending_count) === 0) {
        newStatus = 'approved';
        approvedBy = approverId;
        approvedAt = new Date();
      }

      // Update assignment status
      const result = await query(`
        UPDATE fee_assignments 
        SET 
          status = $1,
          approved_by = $2,
          approved_at = $3,
          updated_at = NOW()
        WHERE id = $4
        RETURNING *
      `, [newStatus, approvedBy, approvedAt, assignmentId]);

      // Log approval
      await this.logAssignmentHistory(
        assignmentId,
        'approved',
        'workflow',
        approverId,
        assignment,
        result.rows[0],
        `Approved at level ${approvalLevel}: ${comments || 'No comments'}`
      );

      return result.rows[0];
    } catch (error) {
      if (error instanceof ValidationError || error instanceof AuthorizationError) {
        throw error;
      }
      throw new DatabaseError('Failed to approve fee assignment', error);
    }
  }

  /**
   * Reject fee assignment
   */
  async rejectFeeAssignment(assignmentId, rejectedBy, rejectionReason, rejectionDetails = null) {
    try {
      const assignment = await this.getFeeAssignmentById(assignmentId);
      if (!assignment) {
        throw new ValidationError('Fee assignment not found');
      }

      if (!['submitted', 'approved'].includes(assignment.status)) {
        throw new ValidationError('Only submitted or approved assignments can be rejected');
      }

      // Update assignment
      const result = await query(`
        UPDATE fee_assignments 
        SET 
          status = 'rejected',
          rejection_reason = $1,
          rejection_details = $2,
          updated_at = NOW()
        WHERE id = $3
        RETURNING *
      `, [rejectionReason, rejectionDetails ? JSON.stringify(rejectionDetails) : null, assignmentId]);

      // Update all pending approvals to rejected
      await query(`
        UPDATE fee_assignment_approvals
        SET 
          approval_status = 'rejected',
          approved_by = $1,
          approved_at = NOW(),
          approval_comments = $2
        WHERE fee_assignment_id = $3 AND approval_status = 'pending'
      `, [rejectedBy, rejectionReason, assignmentId]);

      // Log rejection
      await this.logAssignmentHistory(
        assignmentId,
        'rejected',
        'workflow',
        rejectedBy,
        assignment,
        result.rows[0],
        `Rejected: ${rejectionReason}`
      );

      return result.rows[0];
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseError('Failed to reject fee assignment', error);
    }
  }

  /**
   * Execute fee assignment (create student assignments)
   */
  async executeFeeAssignment(assignmentId, executedBy) {
    try {
      const assignment = await this.getFeeAssignmentById(assignmentId);
      if (!assignment) {
        throw new ValidationError('Fee assignment not found');
      }

      if (assignment.status !== 'approved') {
        throw new ValidationError('Only approved assignments can be executed');
      }

      if (assignment.execution_status === 'processing') {
        throw new ValidationError('Assignment is already being processed');
      }

      // Execute using database function
      const result = await query(`
        SELECT process_fee_assignment($1) as result
      `, [assignmentId]);

      const executionResult = result.rows[0].result;

      // Update assignment status to active if execution was successful
      if (executionResult.status === 'completed') {
        await query(`
          UPDATE fee_assignments 
          SET status = 'active', updated_at = NOW()
          WHERE id = $1
        `, [assignmentId]);
      }

      // Log execution
      await this.logAssignmentHistory(
        assignmentId,
        'executed',
        'execution',
        executedBy,
        assignment,
        executionResult,
        `Execution ${executionResult.status}: ${executionResult.students_successful}/${executionResult.students_processed} students processed`
      );

      return executionResult;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseError('Failed to execute fee assignment', error);
    }
  }

  /**
   * Get student fee assignments
   */
  async getStudentFeeAssignments(schoolId, filters = {}) {
    try {
      let whereConditions = ['sfa.school_id = $1'];
      let queryParams = [schoolId];
      let paramCount = 1;

      if (filters.studentId) {
        paramCount++;
        whereConditions.push(`sfa.student_id = $${paramCount}`);
        queryParams.push(filters.studentId);
      }

      if (filters.classId) {
        paramCount++;
        whereConditions.push(`sfa.student_class_id = $${paramCount}`);
        queryParams.push(filters.classId);
      }

      if (filters.paymentStatus) {
        paramCount++;
        whereConditions.push(`sfa.payment_status = $${paramCount}`);
        queryParams.push(filters.paymentStatus);
      }

      if (filters.assignmentStatus) {
        paramCount++;
        whereConditions.push(`sfa.assignment_status = $${paramCount}`);
        queryParams.push(filters.assignmentStatus);
      }

      if (filters.dueDateFrom) {
        paramCount++;
        whereConditions.push(`sfa.due_date >= $${paramCount}`);
        queryParams.push(filters.dueDateFrom);
      }

      if (filters.dueDateTo) {
        paramCount++;
        whereConditions.push(`sfa.due_date <= $${paramCount}`);
        queryParams.push(filters.dueDateTo);
      }

      if (filters.hasBalance) {
        whereConditions.push('sfa.balance_due > 0');
      }

      if (filters.isOverdue) {
        whereConditions.push('sfa.overdue_since IS NOT NULL');
      }

      const limit = Math.min(filters.limit || 50, 100);
      const offset = (filters.page - 1) * limit || 0;

      const result = await query(`
        SELECT 
          sfa.*,
          s.first_name || ' ' || s.last_name as student_name,
          s.admission_number,
          s.grade_level as current_grade_level,
          c.name as class_name,
          fa.assignment_name,
          fa.assignment_code,
          fa.curriculum_type,
          fa.academic_year,
          fa.academic_term
        FROM student_fee_assignments sfa
        JOIN students s ON s.id = sfa.student_id
        LEFT JOIN classes c ON c.id = sfa.student_class_id
        JOIN fee_assignments fa ON fa.id = sfa.fee_assignment_id
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY sfa.due_date ASC, s.first_name, s.last_name
        LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
      `, [...queryParams, limit, offset]);

      const countResult = await query(`
        SELECT COUNT(*) as total
        FROM student_fee_assignments sfa
        WHERE ${whereConditions.join(' AND ')}
      `, queryParams);

      return {
        assignments: result.rows,
        pagination: {
          total: parseInt(countResult.rows[0].total),
          page: filters.page || 1,
          limit: limit,
          totalPages: Math.ceil(countResult.rows[0].total / limit)
        }
      };
    } catch (error) {
      throw new DatabaseError('Failed to get student fee assignments', error);
    }
  }

  /**
   * Get assignment templates
   */
  async getAssignmentTemplates(schoolId, filters = {}) {
    try {
      let whereConditions = ['school_id = $1'];
      let queryParams = [schoolId];
      let paramCount = 1;

      if (filters.curriculum) {
        paramCount++;
        whereConditions.push(`curriculum_type = $${paramCount}`);
        queryParams.push(filters.curriculum);
      }

      if (filters.category) {
        paramCount++;
        whereConditions.push(`template_category = $${paramCount}`);
        queryParams.push(filters.category);
      }

      if (filters.isActive !== undefined) {
        paramCount++;
        whereConditions.push(`is_active = $${paramCount}`);
        queryParams.push(filters.isActive);
      }

      const result = await query(`
        SELECT 
          *,
          (SELECT first_name || ' ' || last_name FROM users WHERE id = created_by) as created_by_name
        FROM fee_assignment_templates
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY is_default DESC, template_name ASC
      `, queryParams);

      return result.rows;
    } catch (error) {
      throw new DatabaseError('Failed to get assignment templates', error);
    }
  }

  /**
   * Create assignment template
   */
  async createAssignmentTemplate(templateData, createdBy) {
    try {
      const result = await query(`
        INSERT INTO fee_assignment_templates (
          school_id,
          template_name,
          template_description,
          template_category,
          curriculum_type,
          grade_levels,
          target_type,
          fee_items,
          default_amounts,
          is_active,
          is_default,
          auto_apply,
          created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *
      `, [
        templateData.schoolId,
        templateData.templateName,
        templateData.templateDescription || null,
        templateData.templateCategory,
        templateData.curriculumType || 'UNIVERSAL',
        templateData.gradeLevels || null,
        templateData.targetType || 'class',
        JSON.stringify(templateData.feeItems),
        JSON.stringify(templateData.defaultAmounts || {}),
        templateData.isActive !== false,
        templateData.isDefault || false,
        templateData.autoApply || false,
        createdBy
      ]);

      return result.rows[0];
    } catch (error) {
      throw new DatabaseError('Failed to create assignment template', error);
    }
  }

  /**
   * Helper: Generate assignment code
   */
  async generateAssignmentCode(schoolId, assignmentType) {
    try {
      const result = await query(`
        SELECT generate_fee_assignment_code($1, $2) as code
      `, [schoolId, assignmentType]);

      return result.rows[0].code;
    } catch (error) {
      throw new DatabaseError('Failed to generate assignment code', error);
    }
  }

  /**
   * Helper: Calculate total amount from fee items
   */
  calculateTotalAmount(feeItems) {
    if (!feeItems || !Array.isArray(feeItems)) {
      return 0;
    }

    return feeItems.reduce((total, item) => {
      const itemAmount = parseFloat(item.amount || 0);
      const discountAmount = parseFloat(item.discountAmount || 0);
      const taxAmount = parseFloat(item.taxAmount || 0);
      return total + (itemAmount - discountAmount + taxAmount);
    }, 0);
  }

  /**
   * Helper: Create approval workflow
   */
  async createApprovalWorkflow(assignmentId, schoolId, totalAmount) {
    try {
      // This is a simplified approval workflow
      // In a real implementation, you'd fetch approval rules from a configuration table
      
      const approvalLevels = [];

      // Level 1: Finance Manager (for all assignments)
      approvalLevels.push({
        level: 1,
        role: 'finance_manager',
        conditions: null
      });

      // Level 2: Principal (for assignments > 100,000)
      if (totalAmount > 100000) {
        approvalLevels.push({
          level: 2,
          role: 'principal',
          conditions: { min_amount: 100000 }
        });
      }

      // Level 3: Director (for assignments > 500,000)
      if (totalAmount > 500000) {
        approvalLevels.push({
          level: 3,
          role: 'school_director',
          conditions: { min_amount: 500000 }
        });
      }

      // Create approval records
      for (const level of approvalLevels) {
        await query(`
          INSERT INTO fee_assignment_approvals (
            fee_assignment_id,
            approval_level,
            approver_role,
            approval_conditions
          ) VALUES ($1, $2, $3, $4)
        `, [
          assignmentId,
          level.level,
          level.role,
          level.conditions ? JSON.stringify(level.conditions) : null
        ]);
      }
    } catch (error) {
      throw new DatabaseError('Failed to create approval workflow', error);
    }
  }

  /**
   * Helper: Validate approver permissions
   */
  async validateApproverPermissions(approverId, schoolId, approvalLevel, amount) {
    try {
      const result = await query(`
        SELECT 
          u.role,
          u.school_id,
          CASE 
            WHEN u.role IN ('super_admin', 'edufam_admin') THEN true
            WHEN u.role = 'school_director' AND (
              u.school_id = $2 OR 
              EXISTS (
                SELECT 1 FROM director_school_access 
                WHERE director_id = $1 AND school_id = $2 AND is_active = true
              )
            ) THEN true
            WHEN u.role = 'principal' AND u.school_id = $2 THEN true
            WHEN u.role = 'finance_manager' AND u.school_id = $2 THEN true
            ELSE false
          END as can_approve
        FROM users u
        WHERE u.id = $1
      `, [approverId, schoolId]);

      if (result.rows.length === 0) {
        return false;
      }

      return result.rows[0].can_approve;
    } catch (error) {
      throw new DatabaseError('Failed to validate approver permissions', error);
    }
  }

  /**
   * Helper: Log assignment history
   */
  async logAssignmentHistory(assignmentId, action, category, performedBy, previousData, newData, comments) {
    try {
      await query(`
        INSERT INTO fee_assignment_history (
          fee_assignment_id,
          action,
          action_category,
          performed_by,
          previous_data,
          new_data,
          changes_summary,
          comments
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        assignmentId,
        action,
        category,
        performedBy,
        previousData ? JSON.stringify(previousData) : null,
        newData ? JSON.stringify(newData) : null,
        `${action} action performed`,
        comments
      ]);
    } catch (error) {
      console.warn('Failed to log assignment history:', error.message);
      // Non-critical, don't throw
    }
  }
}

module.exports = new FeeAssignmentService();