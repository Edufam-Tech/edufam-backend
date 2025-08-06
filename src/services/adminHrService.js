const { query } = require('../config/database');
const { DatabaseError, ValidationError, NotFoundError } = require('../middleware/errorHandler');

/**
 * Admin HR Service
 * Handles internal Edufam company HR operations, employee management, and admin functions
 */
class AdminHrService {

  /**
   * Employee Management
   */

  // Create new employee
  async createEmployee(employeeData) {
    try {
      const {
        userId,
        employeeId,
        employeeType,
        jobTitle,
        jobLevel,
        departmentId,
        hireDate,
        baseSalary,
        currency = 'KES',
        reportingManagerId,
        workLocation = 'office',
        officeLocation,
        createdBy
      } = employeeData;

      // Validate required fields
      if (!userId || !employeeId || !jobTitle || !departmentId || !hireDate) {
        throw new ValidationError('User ID, employee ID, job title, department, and hire date are required');
      }

      // Check if employee ID already exists
      const existingEmployee = await query(
        'SELECT id FROM admin_employees WHERE employee_id = $1',
        [employeeId]
      );

      if (existingEmployee.rows.length > 0) {
        throw new ValidationError('Employee ID already exists');
      }

      // Create employee record
      const result = await query(`
        INSERT INTO admin_employees (
          user_id, employee_id, employee_type, job_title, job_level,
          department_id, hire_date, base_salary, currency,
          reporting_manager_id, work_location, office_location, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *
      `, [
        userId, employeeId, employeeType, jobTitle, jobLevel,
        departmentId, hireDate, baseSalary, currency,
        reportingManagerId, workLocation, officeLocation, createdBy
      ]);

      return result.rows[0];
    } catch (error) {
      if (error instanceof ValidationError) throw error;
      throw new DatabaseError('Failed to create employee', error);
    }
  }

  // Get employee details
  async getEmployee(employeeId) {
    try {
      const result = await query(`
        SELECT 
          e.*,
          u.first_name,
          u.last_name,
          u.email,
          u.phone,
          d.department_name,
          m.employee_id as manager_employee_id,
          mu.first_name as manager_first_name,
          mu.last_name as manager_last_name
        FROM admin_employees e
        JOIN users u ON u.id = e.user_id
        JOIN admin_departments d ON d.id = e.department_id
        LEFT JOIN admin_employees m ON m.id = e.reporting_manager_id
        LEFT JOIN users mu ON mu.id = m.user_id
        WHERE e.id = $1
      `, [employeeId]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Employee not found');
      }

      return result.rows[0];
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new DatabaseError('Failed to get employee', error);
    }
  }

  // Update employee
  async updateEmployee(employeeId, updateData) {
    try {
      const {
        jobTitle,
        jobLevel,
        departmentId,
        baseSalary,
        reportingManagerId,
        workLocation,
        officeLocation,
        employmentStatus,
        performanceRating
      } = updateData;

      const result = await query(`
        UPDATE admin_employees
        SET 
          job_title = COALESCE($2, job_title),
          job_level = COALESCE($3, job_level),
          department_id = COALESCE($4, department_id),
          base_salary = COALESCE($5, base_salary),
          reporting_manager_id = COALESCE($6, reporting_manager_id),
          work_location = COALESCE($7, work_location),
          office_location = COALESCE($8, office_location),
          employment_status = COALESCE($9, employment_status),
          performance_rating = COALESCE($10, performance_rating),
          updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `, [
        employeeId, jobTitle, jobLevel, departmentId, baseSalary,
        reportingManagerId, workLocation, officeLocation, employmentStatus, performanceRating
      ]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Employee not found');
      }

      return result.rows[0];
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new DatabaseError('Failed to update employee', error);
    }
  }

  // Get employees list with filters
  async getEmployees(filters = {}) {
    try {
      let whereConditions = ['e.employment_status != $1'];
      let queryParams = ['terminated'];
      let paramCount = 1;

      if (filters.department) {
        paramCount++;
        whereConditions.push(`e.department_id = $${paramCount}`);
        queryParams.push(filters.department);
      }

      if (filters.employeeType) {
        paramCount++;
        whereConditions.push(`e.employee_type = $${paramCount}`);
        queryParams.push(filters.employeeType);
      }

      if (filters.employmentStatus) {
        paramCount++;
        whereConditions.push(`e.employment_status = $${paramCount}`);
        queryParams.push(filters.employmentStatus);
      }

      if (filters.search) {
        paramCount++;
        whereConditions.push(`(u.first_name ILIKE $${paramCount} OR u.last_name ILIKE $${paramCount} OR u.email ILIKE $${paramCount} OR e.employee_id ILIKE $${paramCount})`);
        queryParams.push(`%${filters.search}%`);
      }

      const limit = Math.min(filters.limit || 50, 100);
      const offset = (filters.page - 1) * limit || 0;

      const result = await query(`
        SELECT 
          e.*,
          u.first_name,
          u.last_name,
          u.email,
          u.phone,
          d.department_name,
          d.department_code
        FROM admin_employees e
        JOIN users u ON u.id = e.user_id
        JOIN admin_departments d ON d.id = e.department_id
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY e.created_at DESC
        LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
      `, [...queryParams, limit, offset]);

      return result.rows;
    } catch (error) {
      throw new DatabaseError('Failed to get employees', error);
    }
  }

  /**
   * Leave Management
   */

  // Submit leave request
  async submitLeaveRequest(leaveData) {
    try {
      const {
        employeeId,
        leaveType,
        leaveReason,
        startDate,
        endDate,
        totalDays,
        coverageArrangement,
        requestedBy
      } = leaveData;

      // Validate dates
      if (new Date(startDate) >= new Date(endDate)) {
        throw new ValidationError('Start date must be before end date');
      }

      // Check for overlapping leave requests
      const overlapping = await query(`
        SELECT id FROM admin_employee_leaves
        WHERE employee_id = $1 
          AND status IN ('pending', 'approved')
          AND (
            (start_date <= $2 AND end_date >= $2) OR
            (start_date <= $3 AND end_date >= $3) OR
            (start_date >= $2 AND end_date <= $3)
          )
      `, [employeeId, startDate, endDate]);

      if (overlapping.rows.length > 0) {
        throw new ValidationError('Leave request overlaps with existing leave');
      }

      const result = await query(`
        INSERT INTO admin_employee_leaves (
          employee_id, leave_type, leave_reason, start_date, end_date,
          total_days, coverage_arrangement, requested_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `, [employeeId, leaveType, leaveReason, startDate, endDate, totalDays, coverageArrangement, requestedBy]);

      return result.rows[0];
    } catch (error) {
      if (error instanceof ValidationError) throw error;
      throw new DatabaseError('Failed to submit leave request', error);
    }
  }

  // Approve/reject leave request
  async processLeaveRequest(leaveId, decision, processedBy, comments = null) {
    try {
      if (!['approved', 'rejected'].includes(decision)) {
        throw new ValidationError('Decision must be either approved or rejected');
      }

      const updateFields = {
        status: decision,
        approved_by: processedBy,
        approved_at: 'NOW()'
      };

      if (decision === 'rejected') {
        updateFields.rejection_reason = comments;
      }

      const result = await query(`
        UPDATE admin_employee_leaves
        SET 
          status = $2,
          approved_by = $3,
          approved_at = NOW(),
          rejection_reason = $4,
          updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `, [leaveId, decision, processedBy, comments]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Leave request not found');
      }

      return result.rows[0];
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NotFoundError) throw error;
      throw new DatabaseError('Failed to process leave request', error);
    }
  }

  /**
   * Department Management
   */

  // Create department
  async createDepartment(departmentData) {
    try {
      const {
        departmentName,
        departmentCode,
        description,
        headOfDepartment,
        parentDepartmentId,
        annualBudget,
        officeLocation,
        contactEmail,
        createdBy
      } = departmentData;

      const result = await query(`
        INSERT INTO admin_departments (
          department_name, department_code, description,
          head_of_department, parent_department_id, annual_budget,
          office_location, contact_email, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `, [
        departmentName, departmentCode, description,
        headOfDepartment, parentDepartmentId, annualBudget,
        officeLocation, contactEmail, createdBy
      ]);

      return result.rows[0];
    } catch (error) {
      throw new DatabaseError('Failed to create department', error);
    }
  }

  // Get departments
  async getDepartments() {
    try {
      const result = await query(`
        SELECT 
          d.*,
          u.first_name as head_first_name,
          u.last_name as head_last_name,
          pd.department_name as parent_department_name,
          (SELECT COUNT(*) FROM admin_employees WHERE department_id = d.id AND employment_status = 'active') as employee_count
        FROM admin_departments d
        LEFT JOIN admin_employees e ON e.id = d.head_of_department
        LEFT JOIN users u ON u.id = e.user_id
        LEFT JOIN admin_departments pd ON pd.id = d.parent_department_id
        WHERE d.is_active = true
        ORDER BY d.department_name
      `);

      return result.rows;
    } catch (error) {
      throw new DatabaseError('Failed to get departments', error);
    }
  }

  /**
   * Performance Reviews
   */

  // Create performance review
  async createPerformanceReview(reviewData) {
    try {
      const {
        employeeId,
        reviewerId,
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
      } = reviewData;

      const result = await query(`
        INSERT INTO admin_performance_reviews (
          employee_id, reviewer_id, review_period_start, review_period_end,
          review_type, overall_rating, technical_skills_rating,
          communication_rating, teamwork_rating, goals_set_previous_review,
          key_accomplishments, areas_for_improvement, training_recommendations
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *
      `, [
        employeeId, reviewerId, reviewPeriodStart, reviewPeriodEnd,
        reviewType, overallRating, technicalSkillsRating,
        communicationRating, teamworkRating, goalsSetPreviousReview,
        keyAccomplishments, areasForImprovement, trainingRecommendations
      ]);

      return result.rows[0];
    } catch (error) {
      throw new DatabaseError('Failed to create performance review', error);
    }
  }

  /**
   * Company Assets
   */

  // Add company asset
  async addAsset(assetData) {
    try {
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
        departmentId,
        createdBy
      } = assetData;

      const result = await query(`
        INSERT INTO admin_company_assets (
          asset_name, asset_code, asset_category, asset_type,
          brand, model, serial_number, purchase_cost, purchase_date,
          supplier, warranty_period_months, department_id, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *
      `, [
        assetName, assetCode, assetCategory, assetType,
        brand, model, serialNumber, purchaseCost, purchaseDate,
        supplier, warrantyPeriodMonths, departmentId, createdBy
      ]);

      return result.rows[0];
    } catch (error) {
      throw new DatabaseError('Failed to add asset', error);
    }
  }

  // Assign asset to employee
  async assignAsset(assetId, employeeId, assignedBy) {
    try {
      const result = await query(`
        UPDATE admin_company_assets
        SET 
          assigned_to_employee = $2,
          assignment_date = CURRENT_DATE,
          updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `, [assetId, employeeId]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Asset not found');
      }

      return result.rows[0];
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new DatabaseError('Failed to assign asset', error);
    }
  }

  /**
   * HR Analytics and Reports
   */

  // Get HR dashboard metrics
  async getHrDashboardMetrics() {
    try {
      const metrics = await query(`
        SELECT 
          (SELECT COUNT(*) FROM admin_employees WHERE employment_status = 'active') as total_active_employees,
          (SELECT COUNT(*) FROM admin_employees WHERE hire_date >= CURRENT_DATE - INTERVAL '30 days') as new_hires_30_days,
          (SELECT COUNT(*) FROM admin_employee_leaves WHERE status = 'pending') as pending_leave_requests,
          (SELECT COUNT(*) FROM admin_employee_leaves WHERE start_date <= CURRENT_DATE AND end_date >= CURRENT_DATE AND status = 'approved') as employees_on_leave,
          (SELECT AVG(performance_rating) FROM admin_employees WHERE performance_rating IS NOT NULL) as avg_performance_rating,
          (SELECT COUNT(*) FROM admin_performance_reviews WHERE review_status = 'draft' OR review_status = 'employee_review') as pending_reviews,
          (SELECT COUNT(*) FROM admin_company_assets WHERE asset_status = 'active') as total_active_assets,
          (SELECT COUNT(DISTINCT department_id) FROM admin_employees WHERE employment_status = 'active') as active_departments
      `);

      return metrics.rows[0];
    } catch (error) {
      throw new DatabaseError('Failed to get HR dashboard metrics', error);
    }
  }

  // Get employee performance distribution
  async getPerformanceDistribution() {
    try {
      const result = await query(`
        SELECT 
          CASE 
            WHEN performance_rating >= 4.5 THEN 'Excellent'
            WHEN performance_rating >= 3.5 THEN 'Good'
            WHEN performance_rating >= 2.5 THEN 'Satisfactory'
            WHEN performance_rating >= 1.5 THEN 'Needs Improvement'
            ELSE 'Poor'
          END as performance_category,
          COUNT(*) as employee_count
        FROM admin_employees
        WHERE employment_status = 'active' AND performance_rating IS NOT NULL
        GROUP BY performance_category
        ORDER BY MIN(performance_rating) DESC
      `);

      return result.rows;
    } catch (error) {
      throw new DatabaseError('Failed to get performance distribution', error);
    }
  }
}

module.exports = new AdminHrService();