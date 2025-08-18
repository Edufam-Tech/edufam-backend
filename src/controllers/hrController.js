const { ValidationError, NotFoundError, ConflictError, DatabaseError } = require('../middleware/errorHandler');
const { query } = require('../config/database');
const bcrypt = require('bcrypt');

class HRController {
  // Employee Management

  // Create employee profile
  static async createEmployee(req, res, next) {
    try {
      const employeeData = {
        ...req.body,
        schoolId: req.user.school_id
      };

      // Validate required fields
      if (!employeeData.userId || !employeeData.employeeNumber || !employeeData.position) {
        throw new ValidationError('User ID, employee number, and position are required');
      }

      const result = await query(`
        INSERT INTO employees (
          school_id, user_id, employee_number, position, department_id,
          employment_type, start_date, salary, hourly_rate,
          benefits, emergency_contact, created_by, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
        RETURNING *
      `, [
        employeeData.schoolId,
        employeeData.userId,
        employeeData.employeeNumber,
        employeeData.position,
        employeeData.departmentId || null,
        employeeData.employmentType || 'full_time',
        employeeData.startDate,
        employeeData.salary || null,
        employeeData.hourlyRate || null,
        JSON.stringify(employeeData.benefits || {}),
        JSON.stringify(employeeData.emergencyContact || {}),
        req.user.id
      ]);

      res.status(201).json({
        success: true,
        message: 'Employee profile created successfully',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }

  // Get all employees
  static async getEmployees(req, res, next) {
    try {
      const filters = {
        departmentId: req.query.departmentId,
        position: req.query.position,
        employmentType: req.query.employmentType,
        status: req.query.status || 'active',
        limit: parseInt(req.query.limit) || 20,
        offset: parseInt(req.query.offset) || 0
      };

      let sql = `
        SELECT 
          e.*,
          u.first_name || ' ' || u.last_name as full_name,
          u.email,
          u.phone_number,
          d.name as department_name
        FROM employees e
        JOIN users u ON e.user_id = u.id
        LEFT JOIN departments d ON e.department_id = d.id
        WHERE e.school_id = $1
      `;
      
      const params = [req.user.school_id];
      let paramCount = 1;

      // Apply filters
      if (filters.departmentId) {
        paramCount++;
        sql += ` AND e.department_id = $${paramCount}`;
        params.push(filters.departmentId);
      }

      if (filters.position) {
        paramCount++;
        sql += ` AND e.position ILIKE $${paramCount}`;
        params.push(`%${filters.position}%`);
      }

      if (filters.employmentType) {
        paramCount++;
        sql += ` AND e.employment_type = $${paramCount}`;
        params.push(filters.employmentType);
      }

      if (filters.status) {
        paramCount++;
        sql += ` AND e.status = $${paramCount}`;
        params.push(filters.status);
      }

      sql += ` ORDER BY e.created_at DESC`;

      if (filters.limit) {
        paramCount++;
        sql += ` LIMIT $${paramCount}`;
        params.push(filters.limit);
      }

      if (filters.offset) {
        paramCount++;
        sql += ` OFFSET $${paramCount}`;
        params.push(filters.offset);
      }

      const result = await query(sql, params);

      res.json({
        success: true,
        data: result.rows,
        pagination: {
          limit: filters.limit,
          offset: filters.offset,
          total: result.rows.length
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Get employee by ID
  static async getEmployee(req, res, next) {
    try {
      const { id } = req.params;

      const result = await query(`
        SELECT 
          e.*,
          u.first_name || ' ' || u.last_name as full_name,
          u.email,
          u.phone_number,
          d.name as department_name
        FROM employees e
        JOIN users u ON e.user_id = u.id
        LEFT JOIN departments d ON e.department_id = d.id
        WHERE e.id = $1 AND e.school_id = $2
      `, [id, req.user.school_id]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Employee not found');
      }

      res.json({
        success: true,
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }

  // Update employee
  static async updateEmployee(req, res, next) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const result = await query(`
        UPDATE employees 
        SET 
          employee_number = COALESCE($2, employee_number),
          position = COALESCE($3, position),
          department_id = COALESCE($4, department_id),
          employment_type = COALESCE($5, employment_type),
          start_date = COALESCE($6, start_date),
          end_date = COALESCE($7, end_date),
          salary = COALESCE($8, salary),
          hourly_rate = COALESCE($9, hourly_rate),
          benefits = COALESCE($10, benefits),
          emergency_contact = COALESCE($11, emergency_contact),
          status = COALESCE($12, status),
          updated_at = NOW()
        WHERE id = $1 AND school_id = $13
        RETURNING *
      `, [
        id,
        updateData.employeeNumber,
        updateData.position,
        updateData.departmentId,
        updateData.employmentType,
        updateData.startDate,
        updateData.endDate,
        updateData.salary,
        updateData.hourlyRate,
        updateData.benefits ? JSON.stringify(updateData.benefits) : null,
        updateData.emergencyContact ? JSON.stringify(updateData.emergencyContact) : null,
        updateData.status,
        req.user.school_id
      ]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Employee not found');
      }

      res.json({
        success: true,
        message: 'Employee updated successfully',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }

  // Payroll Management

  // Create payroll record
  static async createPayroll(req, res, next) {
    try {
      const payrollData = {
        ...req.body,
        schoolId: req.user.school_id
      };

      // Validate required fields
      if (!payrollData.employeeId || !payrollData.payPeriodStart || !payrollData.payPeriodEnd) {
        throw new ValidationError('Employee ID, pay period start, and pay period end are required');
      }

      const result = await query(`
        INSERT INTO payroll (
          school_id, employee_id, pay_period_start, pay_period_end,
          basic_salary, allowances, deductions, overtime_hours,
          overtime_rate, gross_pay, net_pay, tax_deductions,
          status, created_by, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
        RETURNING *
      `, [
        payrollData.schoolId,
        payrollData.employeeId,
        payrollData.payPeriodStart,
        payrollData.payPeriodEnd,
        payrollData.basicSalary || 0,
        JSON.stringify(payrollData.allowances || {}),
        JSON.stringify(payrollData.deductions || {}),
        payrollData.overtimeHours || 0,
        payrollData.overtimeRate || 0,
        payrollData.grossPay || 0,
        payrollData.netPay || 0,
        JSON.stringify(payrollData.taxDeductions || {}),
        payrollData.status || 'draft',
        req.user.id
      ]);

      res.status(201).json({
        success: true,
        message: 'Payroll record created successfully',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }

  // Get payroll records
  static async getPayrollRecords(req, res, next) {
    try {
      const filters = {
        employeeId: req.query.employeeId,
        payPeriodStart: req.query.payPeriodStart,
        payPeriodEnd: req.query.payPeriodEnd,
        status: req.query.status,
        limit: parseInt(req.query.limit) || 20,
        offset: parseInt(req.query.offset) || 0
      };

      let sql = `
        SELECT 
          p.*,
          e.employee_number,
          u.first_name || ' ' || u.last_name as employee_name
        FROM payroll p
        JOIN employees e ON p.employee_id = e.id
        JOIN users u ON e.user_id = u.id
        WHERE p.school_id = $1
      `;
      
      const params = [req.user.school_id];
      let paramCount = 1;

      // Apply filters
      if (filters.employeeId) {
        paramCount++;
        sql += ` AND p.employee_id = $${paramCount}`;
        params.push(filters.employeeId);
      }

      if (filters.payPeriodStart) {
        paramCount++;
        sql += ` AND p.pay_period_start >= $${paramCount}`;
        params.push(filters.payPeriodStart);
      }

      if (filters.payPeriodEnd) {
        paramCount++;
        sql += ` AND p.pay_period_end <= $${paramCount}`;
        params.push(filters.payPeriodEnd);
      }

      if (filters.status) {
        paramCount++;
        sql += ` AND p.status = $${paramCount}`;
        params.push(filters.status);
      }

      sql += ` ORDER BY p.pay_period_start DESC`;

      if (filters.limit) {
        paramCount++;
        sql += ` LIMIT $${paramCount}`;
        params.push(filters.limit);
      }

      if (filters.offset) {
        paramCount++;
        sql += ` OFFSET $${paramCount}`;
        params.push(filters.offset);
      }

      const result = await query(sql, params);

      res.json({
        success: true,
        data: result.rows,
        pagination: {
          limit: filters.limit,
          offset: filters.offset,
          total: result.rows.length
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Update payroll record
  static async updatePayroll(req, res, next) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const result = await query(`
        UPDATE payroll 
        SET 
          basic_salary = COALESCE($2, basic_salary),
          allowances = COALESCE($3, allowances),
          deductions = COALESCE($4, deductions),
          overtime_hours = COALESCE($5, overtime_hours),
          overtime_rate = COALESCE($6, overtime_rate),
          gross_pay = COALESCE($7, gross_pay),
          net_pay = COALESCE($8, net_pay),
          tax_deductions = COALESCE($9, tax_deductions),
          status = COALESCE($10, status),
          updated_at = NOW()
        WHERE id = $1 AND school_id = $11
        RETURNING *
      `, [
        id,
        updateData.basicSalary,
        updateData.allowances ? JSON.stringify(updateData.allowances) : null,
        updateData.deductions ? JSON.stringify(updateData.deductions) : null,
        updateData.overtimeHours,
        updateData.overtimeRate,
        updateData.grossPay,
        updateData.netPay,
        updateData.taxDeductions ? JSON.stringify(updateData.taxDeductions) : null,
        updateData.status,
        req.user.school_id
      ]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Payroll record not found');
      }

      res.json({
        success: true,
        message: 'Payroll record updated successfully',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }

  // Leave Management

  // Submit leave application
  static async submitLeaveApplication(req, res, next) {
    try {
      const leaveData = {
        ...req.body,
        schoolId: req.user.school_id,
        employeeId: req.body.employeeId || req.user.employee_id
      };

      // Validate required fields
      if (!leaveData.leaveTypeId || !leaveData.startDate || !leaveData.endDate) {
        throw new ValidationError('Leave type, start date, and end date are required');
      }

      const result = await query(`
        INSERT INTO leave_applications (
          school_id, employee_id, leave_type_id, start_date, end_date,
          reason, days_requested, attachment_url, status, applied_by, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', $9, NOW())
        RETURNING *
      `, [
        leaveData.schoolId,
        leaveData.employeeId,
        leaveData.leaveTypeId,
        leaveData.startDate,
        leaveData.endDate,
        leaveData.reason,
        leaveData.daysRequested,
        leaveData.attachmentUrl || null,
        req.user.id
      ]);

      res.status(201).json({
        success: true,
        message: 'Leave application submitted successfully',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }

  // Get leave applications
  static async getLeaveApplications(req, res, next) {
    try {
      const filters = {
        employeeId: req.query.employeeId,
        leaveTypeId: req.query.leaveTypeId,
        status: req.query.status,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        limit: parseInt(req.query.limit) || 20,
        offset: parseInt(req.query.offset) || 0
      };

      let sql = `
        SELECT 
          la.*,
          e.employee_number,
          u.first_name || ' ' || u.last_name as employee_name,
          lt.name as leave_type_name,
          lt.max_days_per_year
        FROM leave_applications la
        JOIN employees e ON la.employee_id = e.id
        JOIN users u ON e.user_id = u.id
        JOIN leave_types lt ON la.leave_type_id = lt.id
        WHERE la.school_id = $1
      `;
      
      const params = [req.user.school_id];
      let paramCount = 1;

      // Apply filters
      if (filters.employeeId) {
        paramCount++;
        sql += ` AND la.employee_id = $${paramCount}`;
        params.push(filters.employeeId);
      }

      if (filters.leaveTypeId) {
        paramCount++;
        sql += ` AND la.leave_type_id = $${paramCount}`;
        params.push(filters.leaveTypeId);
      }

      if (filters.status) {
        paramCount++;
        sql += ` AND la.status = $${paramCount}`;
        params.push(filters.status);
      }

      if (filters.startDate) {
        paramCount++;
        sql += ` AND la.start_date >= $${paramCount}`;
        params.push(filters.startDate);
      }

      if (filters.endDate) {
        paramCount++;
        sql += ` AND la.end_date <= $${paramCount}`;
        params.push(filters.endDate);
      }

      sql += ` ORDER BY la.created_at DESC`;

      if (filters.limit) {
        paramCount++;
        sql += ` LIMIT $${paramCount}`;
        params.push(filters.limit);
      }

      if (filters.offset) {
        paramCount++;
        sql += ` OFFSET $${paramCount}`;
        params.push(filters.offset);
      }

      const result = await query(sql, params);

      res.json({
        success: true,
        data: result.rows,
        pagination: {
          limit: filters.limit,
          offset: filters.offset,
          total: result.rows.length
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Approve/Reject leave application
  static async processLeaveApplication(req, res, next) {
    try {
      const { id } = req.params;
      const { action, comments } = req.body;

      if (!action || !['approve', 'reject'].includes(action)) {
        throw new ValidationError('Valid action (approve/reject) is required');
      }

      const result = await query(`
        UPDATE leave_applications 
        SET 
          status = $2,
          reviewed_by = $3,
          reviewed_at = NOW(),
          review_comments = $4,
          updated_at = NOW()
        WHERE id = $1 AND school_id = $5
        RETURNING *
      `, [id, action === 'approve' ? 'approved' : 'rejected', req.user.id, comments, req.user.school_id]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Leave application not found');
      }

      // Fire realtime notification to requester (best-effort)
      try {
        const RealtimeIntegrations = require('../integrations/realtimeIntegrations');
        const leave = result.rows[0];
        await RealtimeIntegrations.createCustomEvent({
          eventType: action === 'approve' ? 'leave_request_approved' : 'leave_request_rejected',
          schoolId: req.user.school_id,
          sourceUserId: req.user.id,
          targetUserIds: leave.applied_by ? [leave.applied_by] : [],
          title: action === 'approve' ? 'Leave Request Approved' : 'Leave Request Rejected',
          message: action === 'approve' ? 'Your leave request has been approved.' : `Your leave request was rejected${comments ? `: ${comments}` : ''}`,
          sourceEntityType: 'leave_application',
          sourceEntityId: leave.id,
          actionUrl: `/profile`,
          priority: action === 'approve' ? 'normal' : 'high',
        });
      } catch (e) { /* ignore notification errors */ }

      res.json({
        success: true,
        message: `Leave application ${action}d successfully`,
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }

  // Performance Management

  // Create performance review
  static async createPerformanceReview(req, res, next) {
    try {
      const reviewData = {
        ...req.body,
        schoolId: req.user.school_id
      };

      // Validate required fields
      if (!reviewData.employeeId || !reviewData.reviewPeriodStart || !reviewData.reviewPeriodEnd) {
        throw new ValidationError('Employee ID, review period start, and review period end are required');
      }

      const result = await query(`
        INSERT INTO performance_reviews (
          school_id, employee_id, reviewer_id, review_period_start, review_period_end,
          goals, achievements, ratings, overall_score, comments, status, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'draft', NOW())
        RETURNING *
      `, [
        reviewData.schoolId,
        reviewData.employeeId,
        req.user.id,
        reviewData.reviewPeriodStart,
        reviewData.reviewPeriodEnd,
        JSON.stringify(reviewData.goals || []),
        JSON.stringify(reviewData.achievements || []),
        JSON.stringify(reviewData.ratings || {}),
        reviewData.overallScore || null,
        reviewData.comments
      ]);

      res.status(201).json({
        success: true,
        message: 'Performance review created successfully',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }

  // Get performance reviews
  static async getPerformanceReviews(req, res, next) {
    try {
      const filters = {
        employeeId: req.query.employeeId,
        reviewerId: req.query.reviewerId,
        status: req.query.status,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        limit: parseInt(req.query.limit) || 20,
        offset: parseInt(req.query.offset) || 0
      };

      let sql = `
        SELECT 
          pr.*,
          e.employee_number,
          emp_user.first_name || ' ' || emp_user.last_name as employee_name,
          rev_user.first_name || ' ' || rev_user.last_name as reviewer_name
        FROM performance_reviews pr
        JOIN employees e ON pr.employee_id = e.id
        JOIN users emp_user ON e.user_id = emp_user.id
        JOIN users rev_user ON pr.reviewer_id = rev_user.id
        WHERE pr.school_id = $1
      `;
      
      const params = [req.user.school_id];
      let paramCount = 1;

      // Apply filters
      if (filters.employeeId) {
        paramCount++;
        sql += ` AND pr.employee_id = $${paramCount}`;
        params.push(filters.employeeId);
      }

      if (filters.reviewerId) {
        paramCount++;
        sql += ` AND pr.reviewer_id = $${paramCount}`;
        params.push(filters.reviewerId);
      }

      if (filters.status) {
        paramCount++;
        sql += ` AND pr.status = $${paramCount}`;
        params.push(filters.status);
      }

      if (filters.startDate) {
        paramCount++;
        sql += ` AND pr.review_period_start >= $${paramCount}`;
        params.push(filters.startDate);
      }

      if (filters.endDate) {
        paramCount++;
        sql += ` AND pr.review_period_end <= $${paramCount}`;
        params.push(filters.endDate);
      }

      sql += ` ORDER BY pr.created_at DESC`;

      if (filters.limit) {
        paramCount++;
        sql += ` LIMIT $${paramCount}`;
        params.push(filters.limit);
      }

      if (filters.offset) {
        paramCount++;
        sql += ` OFFSET $${paramCount}`;
        params.push(filters.offset);
      }

      const result = await query(sql, params);

      res.json({
        success: true,
        data: result.rows,
        pagination: {
          limit: filters.limit,
          offset: filters.offset,
          total: result.rows.length
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Update performance review
  static async updatePerformanceReview(req, res, next) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const result = await query(`
        UPDATE performance_reviews 
        SET 
          goals = COALESCE($2, goals),
          achievements = COALESCE($3, achievements),
          ratings = COALESCE($4, ratings),
          overall_score = COALESCE($5, overall_score),
          comments = COALESCE($6, comments),
          status = COALESCE($7, status),
          updated_at = NOW()
        WHERE id = $1 AND school_id = $8
        RETURNING *
      `, [
        id,
        updateData.goals ? JSON.stringify(updateData.goals) : null,
        updateData.achievements ? JSON.stringify(updateData.achievements) : null,
        updateData.ratings ? JSON.stringify(updateData.ratings) : null,
        updateData.overallScore,
        updateData.comments,
        updateData.status,
        req.user.school_id
      ]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Performance review not found');
      }

      res.json({
        success: true,
        message: 'Performance review updated successfully',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }

  // HR Analytics and Reports

  // Get HR dashboard
  static async getHRDashboard(req, res, next) {
    try {
      // Get employee statistics
      const empStats = await query(`
        SELECT 
          COUNT(*) as total_employees,
          COUNT(*) FILTER (WHERE status = 'active') as active_employees,
          COUNT(*) FILTER (WHERE employment_type = 'full_time') as full_time_employees,
          COUNT(*) FILTER (WHERE employment_type = 'part_time') as part_time_employees,
          COUNT(*) FILTER (WHERE employment_type = 'contract') as contract_employees
        FROM employees
        WHERE school_id = $1
      `, [req.user.school_id]);

      // Get leave statistics
      const leaveStats = await query(`
        SELECT 
          COUNT(*) as total_applications,
          COUNT(*) FILTER (WHERE status = 'pending') as pending_applications,
          COUNT(*) FILTER (WHERE status = 'approved') as approved_applications,
          COUNT(*) FILTER (WHERE status = 'rejected') as rejected_applications
        FROM leave_applications
        WHERE school_id = $1
        AND EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM CURRENT_DATE)
      `, [req.user.school_id]);

      // Get recent performance reviews
      const recentReviews = await query(`
        SELECT 
          pr.*,
          e.employee_number,
          u.first_name || ' ' || u.last_name as employee_name
        FROM performance_reviews pr
        JOIN employees e ON pr.employee_id = e.id
        JOIN users u ON e.user_id = u.id
        WHERE pr.school_id = $1
        ORDER BY pr.created_at DESC
        LIMIT 5
      `, [req.user.school_id]);

      const dashboard = {
        employeeStats: empStats.rows[0],
        leaveStats: leaveStats.rows[0],
        recentReviews: recentReviews.rows
      };

      res.json({
        success: true,
        data: dashboard
      });
    } catch (error) {
      next(error);
    }
  }

  // Get HR analytics
  static async getHRAnalytics(req, res, next) {
    try {
      const { startDate, endDate } = req.query;

      // Payroll analytics
      const payrollAnalytics = await query(`
        SELECT 
          DATE_TRUNC('month', pay_period_start) as month,
          SUM(gross_pay) as total_gross_pay,
          SUM(net_pay) as total_net_pay,
          AVG(gross_pay) as average_gross_pay,
          COUNT(*) as payroll_count
        FROM payroll
        WHERE school_id = $1
        AND pay_period_start >= COALESCE($2, DATE_TRUNC('year', CURRENT_DATE))
        AND pay_period_end <= COALESCE($3, CURRENT_DATE)
        GROUP BY DATE_TRUNC('month', pay_period_start)
        ORDER BY month
      `, [req.user.school_id, startDate, endDate]);

      // Leave trends
      const leaveTrends = await query(`
        SELECT 
          lt.name as leave_type,
          COUNT(la.id) as applications_count,
          SUM(la.days_requested) as total_days_requested,
          AVG(la.days_requested) as average_days_requested
        FROM leave_applications la
        JOIN leave_types lt ON la.leave_type_id = lt.id
        WHERE la.school_id = $1
        AND la.start_date >= COALESCE($2, DATE_TRUNC('year', CURRENT_DATE))
        AND la.end_date <= COALESCE($3, CURRENT_DATE)
        GROUP BY lt.id, lt.name
        ORDER BY applications_count DESC
      `, [req.user.school_id, startDate, endDate]);

      // Performance trends
      const performanceTrends = await query(`
        SELECT 
          AVG(overall_score) as average_score,
          COUNT(*) as review_count,
          DATE_TRUNC('quarter', review_period_start) as quarter
        FROM performance_reviews
        WHERE school_id = $1
        AND review_period_start >= COALESCE($2, DATE_TRUNC('year', CURRENT_DATE))
        AND review_period_end <= COALESCE($3, CURRENT_DATE)
        AND overall_score IS NOT NULL
        GROUP BY DATE_TRUNC('quarter', review_period_start)
        ORDER BY quarter
      `, [req.user.school_id, startDate, endDate]);

      const analytics = {
        payrollAnalytics: payrollAnalytics.rows,
        leaveTrends: leaveTrends.rows,
        performanceTrends: performanceTrends.rows
      };

      res.json({
        success: true,
        data: analytics
      });
    } catch (error) {
      next(error);
    }
  }

  // Generate payslip
  static async generatePayslip(req, res, next) {
    try {
      const { payrollId } = req.params;

      const payslip = await query(`
        SELECT 
          p.*,
          e.employee_number,
          e.position,
          u.first_name || ' ' || u.last_name as employee_name,
          d.name as department_name
        FROM payroll p
        JOIN employees e ON p.employee_id = e.id
        JOIN users u ON e.user_id = u.id
        LEFT JOIN departments d ON e.department_id = d.id
        WHERE p.id = $1 AND p.school_id = $2
      `, [payrollId, req.user.school_id]);

      if (payslip.rows.length === 0) {
        throw new NotFoundError('Payroll record not found');
      }

      res.json({
        success: true,
        data: payslip.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }

  // =============================================================================
  // ENHANCED STAFF MANAGEMENT METHODS
  // =============================================================================

  static async getAllStaffCategories(req, res, next) {
    try {
      const categories = await query(`
        SELECT 
          'teaching' as category,
          COUNT(*) as count
        FROM employees e
        JOIN users u ON e.user_id = u.id
        WHERE e.school_id = $1 AND u.user_type = 'school_user' 
        AND e.position LIKE '%teacher%'
        
        UNION ALL
        
        SELECT 
          'administrative' as category,
          COUNT(*) as count
        FROM employees e
        JOIN users u ON e.user_id = u.id
        WHERE e.school_id = $1 AND u.user_type = 'school_user' 
        AND e.position LIKE '%admin%'
        
        UNION ALL
        
        SELECT 
          'support' as category,
          COUNT(*) as count
        FROM employees e
        JOIN users u ON e.user_id = u.id
        WHERE e.school_id = $1 AND u.user_type = 'school_user' 
        AND e.position NOT LIKE '%teacher%' AND e.position NOT LIKE '%admin%'
      `, [req.user.school_id]);

      res.json({
        success: true,
        data: categories.rows
      });
    } catch (error) {
      next(error);
    }
  }

  // Dashboard users (teachers, principal, director, hr, finance) for current school
  static async getDashboardUsers(req, res, next) {
    try {
      const result = await query(`
        SELECT 
          u.id as user_id,
          u.first_name, u.last_name, u.email, u.role, u.activation_status,
          u.profile_picture_url,
          e.id as employee_id, e.position, e.employment_status, d.name as department_name
        FROM users u
        JOIN employees e ON e.user_id = u.id
        LEFT JOIN departments d ON e.department_id = d.id
        WHERE u.school_id = $1
          AND u.role IN ('school_director','principal','teacher','hr','finance','parent')
        ORDER BY u.first_name, u.last_name
      `, [req.user.school_id]);

      res.json({ success: true, data: result.rows });
    } catch (error) {
      next(error);
    }
  }

  // Create dashboard user account for an existing staff member (assign role)
  static async createDashboardUserForStaff(req, res, next) {
    try {
      const { employeeId } = req.params;
      const { role } = req.body; // 'teacher' | 'hr' | 'finance' | 'principal' | 'school_director'

      if (!role || !['teacher','hr','finance','principal','school_director'].includes(role)) {
        throw new ValidationError('Valid dashboard role is required');
      }

      // Get employee and existing user
      const emp = await query(`
        SELECT e.id as employee_id, e.user_id, u.role as current_role, u.activation_status
        FROM employees e JOIN users u ON e.user_id = u.id
        WHERE e.id = $1 AND e.school_id = $2
      `, [employeeId, req.user.school_id]);

      if (emp.rows.length === 0) {
        throw new NotFoundError('Employee not found');
      }

      // Update role on the existing user to grant dashboard access
      const updated = await query(`
        UPDATE users 
        SET role = $1, activation_status = COALESCE(activation_status, 'active')
        WHERE id = $2 AND school_id = $3
        RETURNING id, email, role, activation_status
      `, [role, emp.rows[0].user_id, req.user.school_id]);

      res.status(201).json({
        success: true,
        message: 'Dashboard user account created/updated for staff',
        data: updated.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }

  static async createTeachingStaff(req, res, next) {
    try {
      const { 
        first_name, last_name, email, phone, position, 
        department_id, subjects, qualifications, experience_years 
      } = req.body;

      // Create user first
      const hashedPassword = await bcrypt.hash('DefaultPass123!', 10);
      const userResult = await query(`
        INSERT INTO users (first_name, last_name, email, phone, password_hash, user_type, school_id, status)
        VALUES ($1, $2, $3, $4, $5, 'school_user', $6, 'active')
        RETURNING id
      `, [first_name, last_name, email, phone, hashedPassword, req.user.school_id]);

      const userId = userResult.rows[0].id;

      // Create employee record
      const employeeResult = await query(`
        INSERT INTO employees (
          user_id, school_id, employee_number, position, department_id,
          hire_date, employment_status, qualifications, experience_years
        )
        VALUES ($1, $2, $3, $4, $5, CURRENT_DATE, 'active', $6, $7)
        RETURNING *
      `, [
        userId, req.user.school_id, 
        `TCH${Date.now()}`, position, department_id,
        JSON.stringify(qualifications), experience_years
      ]);

      // Assign subjects if provided
      if (subjects && subjects.length > 0) {
        for (const subjectId of subjects) {
          await query(`
            INSERT INTO teacher_subjects (teacher_id, subject_id, school_id)
            VALUES ($1, $2, $3)
          `, [employeeResult.rows[0].id, subjectId, req.user.school_id]);
        }
      }

      res.status(201).json({
        success: true,
        message: 'Teaching staff created successfully',
        data: employeeResult.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }

  static async createAdministrativeStaff(req, res, next) {
    try {
      const { 
        first_name, last_name, email, phone, position, 
        department_id, responsibilities, access_level 
      } = req.body;

      const hashedPassword = await bcrypt.hash('DefaultPass123!', 10);
      const userResult = await query(`
        INSERT INTO users (first_name, last_name, email, phone, password_hash, user_type, school_id, status)
        VALUES ($1, $2, $3, $4, $5, 'school_user', $6, 'active')
        RETURNING id
      `, [first_name, last_name, email, phone, hashedPassword, req.user.school_id]);

      const userId = userResult.rows[0].id;

      const employeeResult = await query(`
        INSERT INTO employees (
          user_id, school_id, employee_number, position, department_id,
          hire_date, employment_status, additional_info
        )
        VALUES ($1, $2, $3, $4, $5, CURRENT_DATE, 'active', $6)
        RETURNING *
      `, [
        userId, req.user.school_id, 
        `ADM${Date.now()}`, position, department_id,
        JSON.stringify({ responsibilities, access_level })
      ]);

      res.status(201).json({
        success: true,
        message: 'Administrative staff created successfully',
        data: employeeResult.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }

  static async createSupportStaff(req, res, next) {
    try {
      const { 
        first_name, last_name, email, phone, position, 
        department_id, skills, shift_schedule 
      } = req.body;

      const hashedPassword = await bcrypt.hash('DefaultPass123!', 10);
      const userResult = await query(`
        INSERT INTO users (first_name, last_name, email, phone, password_hash, user_type, school_id, status)
        VALUES ($1, $2, $3, $4, $5, 'school_user', $6, 'active')
        RETURNING id
      `, [first_name, last_name, email, phone, hashedPassword, req.user.school_id]);

      const userId = userResult.rows[0].id;

      const employeeResult = await query(`
        INSERT INTO employees (
          user_id, school_id, employee_number, position, department_id,
          hire_date, employment_status, additional_info
        )
        VALUES ($1, $2, $3, $4, $5, CURRENT_DATE, 'active', $6)
        RETURNING *
      `, [
        userId, req.user.school_id, 
        `SUP${Date.now()}`, position, department_id,
        JSON.stringify({ skills, shift_schedule })
      ]);

      res.status(201).json({
        success: true,
        message: 'Support staff created successfully',
        data: employeeResult.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }

  static async createSpecializedStaff(req, res, next) {
    try {
      const { 
        first_name, last_name, email, phone, position, 
        department_id, specialization, certifications 
      } = req.body;

      const hashedPassword = await bcrypt.hash('DefaultPass123!', 10);
      const userResult = await query(`
        INSERT INTO users (first_name, last_name, email, phone, password_hash, user_type, school_id, status)
        VALUES ($1, $2, $3, $4, $5, 'school_user', $6, 'active')
        RETURNING id
      `, [first_name, last_name, email, phone, hashedPassword, req.user.school_id]);

      const userId = userResult.rows[0].id;

      const employeeResult = await query(`
        INSERT INTO employees (
          user_id, school_id, employee_number, position, department_id,
          hire_date, employment_status, additional_info
        )
        VALUES ($1, $2, $3, $4, $5, CURRENT_DATE, 'active', $6)
        RETURNING *
      `, [
        userId, req.user.school_id, 
        `SPE${Date.now()}`, position, department_id,
        JSON.stringify({ specialization, certifications })
      ]);

      res.status(201).json({
        success: true,
        message: 'Specialized staff created successfully',
        data: employeeResult.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }

  static async getNonDashboardUsers(req, res, next) {
    try {
      const nonDashboardUsers = await query(`
        SELECT 
          u.id, u.first_name, u.last_name, u.email, u.phone, u.profile_picture_url,
          e.employee_number, e.position, e.hire_date,
          d.name as department_name
        FROM users u
        JOIN employees e ON u.id = e.user_id
        LEFT JOIN departments d ON e.department_id = d.id
        WHERE u.school_id = $1 
        AND u.user_type = 'school_user'
        AND (e.additional_info->>'access_level' IS NULL OR e.additional_info->>'access_level' = 'limited')
        ORDER BY u.first_name, u.last_name
      `, [req.user.school_id]);

      res.json({
        success: true,
        data: nonDashboardUsers.rows
      });
    } catch (error) {
      next(error);
    }
  }

  static async createNonDashboardUser(req, res, next) {
    try {
      const { 
        first_name, last_name, email, phone, position, 
        department_id, role_description 
      } = req.body;

      const hashedPassword = await bcrypt.hash('DefaultPass123!', 10);
      const userResult = await query(`
        INSERT INTO users (first_name, last_name, email, phone, password_hash, user_type, school_id, status)
        VALUES ($1, $2, $3, $4, $5, 'school_user', $6, 'active')
        RETURNING id
      `, [first_name, last_name, email, phone, hashedPassword, req.user.school_id]);

      const userId = userResult.rows[0].id;

      const employeeResult = await query(`
        INSERT INTO employees (
          user_id, school_id, employee_number, position, department_id,
          hire_date, employment_status, additional_info
        )
        VALUES ($1, $2, $3, $4, $5, CURRENT_DATE, 'active', $6)
        RETURNING *
      `, [
        userId, req.user.school_id, 
        `NDU${Date.now()}`, position, department_id,
        JSON.stringify({ access_level: 'limited', role_description })
      ]);

      res.status(201).json({
        success: true,
        message: 'Non-dashboard user created successfully',
        data: employeeResult.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }

  // =========================
  // Parents Management
  // =========================
  static async getParents(req, res, next) {
    try {
      const parents = await query(`
        SELECT 
          u.id, u.first_name, u.last_name, u.email, u.phone_number, u.activation_status,
          (
            SELECT COUNT(*) FROM enrollments e WHERE e.parent_id = u.id
          ) AS children_count
        FROM users u
        WHERE u.school_id = $1 AND u.role = 'parent'
        ORDER BY u.first_name, u.last_name
      `, [req.user.school_id]);

      res.json({ success: true, data: parents.rows });
    } catch (error) {
      next(error);
    }
  }

  static async createParent(req, res, next) {
    try {
      const { first_name, last_name, email, phone_number, password, student_ids } = req.body;

      if (!first_name || !last_name || !email) {
        throw new ValidationError('first_name, last_name and email are required');
      }

      const hashed = await bcrypt.hash(password || 'DefaultPass123!', 10);
      const userRes = await query(`
        INSERT INTO users (first_name, last_name, email, phone_number, password_hash, user_type, role, school_id, activation_status)
        VALUES ($1, $2, $3, $4, $5, 'school_user', 'parent', $6, 'active')
        RETURNING id
      `, [first_name, last_name, email, phone_number || null, hashed, req.user.school_id]);

      const parentId = userRes.rows[0].id;

      if (Array.isArray(student_ids) && student_ids.length > 0) {
        for (const sid of student_ids) {
          await query(`
            INSERT INTO enrollments (student_id, parent_id, school_id)
            VALUES ($1, $2, $3)
            ON CONFLICT (student_id, parent_id) DO NOTHING
          `, [sid, parentId, req.user.school_id]);
        }
      }

      res.status(201).json({ success: true, message: 'Parent created successfully', data: { id: parentId } });
    } catch (error) {
      next(error);
    }
  }

  static async updateParent(req, res, next) {
    try {
      const { parentId } = req.params;
      const { first_name, last_name, phone_number, activation_status } = req.body;

      const result = await query(`
        UPDATE users
        SET first_name = COALESCE($2, first_name),
            last_name = COALESCE($3, last_name),
            phone_number = COALESCE($4, phone_number),
            activation_status = COALESCE($5, activation_status)
        WHERE id = $1 AND school_id = $6 AND role = 'parent'
        RETURNING id, first_name, last_name, email, phone_number, activation_status
      `, [parentId, first_name, last_name, phone_number, activation_status, req.user.school_id]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Parent not found');
      }

      res.json({ success: true, message: 'Parent updated', data: result.rows[0] });
    } catch (error) {
      next(error);
    }
  }

  static async linkParentStudent(req, res, next) {
    try {
      const { parentId } = req.params;
      const { student_id } = req.body;
      if (!student_id) throw new ValidationError('student_id required');

      await query(`
        INSERT INTO enrollments (student_id, parent_id, school_id)
        VALUES ($1, $2, $3)
        ON CONFLICT (student_id, parent_id) DO NOTHING
      `, [student_id, parentId, req.user.school_id]);

      res.status(201).json({ success: true, message: 'Student linked to parent' });
    } catch (error) {
      next(error);
    }
  }

  static async unlinkParentStudent(req, res, next) {
    try {
      const { parentId, studentId } = req.params;
      await query(`
        DELETE FROM enrollments WHERE parent_id = $1 AND student_id = $2 AND school_id = $3
      `, [parentId, studentId, req.user.school_id]);

      res.json({ success: true, message: 'Student unlinked from parent' });
    } catch (error) {
      next(error);
    }
  }

  static async updateStaffCategory(req, res, next) {
    try {
      const { employeeId } = req.params;
      const { category, position, additional_info } = req.body;

      const result = await query(`
        UPDATE employees 
        SET position = $1, additional_info = $2, updated_at = CURRENT_TIMESTAMP
        WHERE id = $3 AND school_id = $4
        RETURNING *
      `, [position, JSON.stringify(additional_info), employeeId, req.user.school_id]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Employee not found');
      }

      res.json({
        success: true,
        message: 'Staff category updated successfully',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }

  static async getOrganizationalChart(req, res, next) {
    try {
      const chart = await query(`
        WITH RECURSIVE org_chart AS (
          -- Start with top-level positions
          SELECT 
            e.id, e.position, u.first_name || ' ' || u.last_name as name,
            d.name as department, e.department_id,
            0 as level, ARRAY[e.id] as path
          FROM employees e
          JOIN users u ON e.user_id = u.id
          JOIN departments d ON e.department_id = d.id
          WHERE e.school_id = $1 
          AND (e.position LIKE '%principal%' OR e.position LIKE '%director%')
          
          UNION ALL
          
          -- Add subordinates
          SELECT 
            e.id, e.position, u.first_name || ' ' || u.last_name as name,
            d.name as department, e.department_id,
            oc.level + 1, oc.path || e.id
          FROM employees e
          JOIN users u ON e.user_id = u.id
          JOIN departments d ON e.department_id = d.id
          JOIN org_chart oc ON e.department_id = oc.department_id
          WHERE e.school_id = $1 
          AND e.id != ALL(oc.path)
          AND oc.level < 5
        )
        SELECT * FROM org_chart
        ORDER BY level, department, position
      `, [req.user.school_id]);

      res.json({
        success: true,
        data: chart.rows
      });
    } catch (error) {
      next(error);
    }
  }

  static async getStaffDirectory(req, res, next) {
    try {
      const { search, department, position } = req.query;
      
      let whereClause = 'WHERE e.school_id = $1';
      let params = [req.user.school_id];
      let paramCount = 1;

      if (search) {
        paramCount++;
        whereClause += ` AND (u.first_name ILIKE $${paramCount} OR u.last_name ILIKE $${paramCount} OR u.email ILIKE $${paramCount})`;
        params.push(`%${search}%`);
      }

      if (department) {
        paramCount++;
        whereClause += ` AND d.name ILIKE $${paramCount}`;
        params.push(`%${department}%`);
      }

      if (position) {
        paramCount++;
        whereClause += ` AND e.position ILIKE $${paramCount}`;
        params.push(`%${position}%`);
      }

      const directory = await query(`
        SELECT 
          e.id, u.first_name, u.last_name, u.email, u.phone,
          e.employee_number, e.position, e.hire_date,
          d.name as department_name,
          CASE 
            WHEN e.position LIKE '%teacher%' THEN 'Teaching'
            WHEN e.position LIKE '%admin%' THEN 'Administrative'
            ELSE 'Support'
          END as category
        FROM employees e
        JOIN users u ON e.user_id = u.id
        LEFT JOIN departments d ON e.department_id = d.id
        ${whereClause}
        AND e.employment_status = 'active'
        ORDER BY d.name, e.position, u.first_name
      `, params);

      res.json({
        success: true,
        data: directory.rows
      });
    } catch (error) {
      next(error);
    }
  }

  static async bulkImportStaff(req, res, next) {
    try {
      const { staff_data } = req.body;
      
      if (!Array.isArray(staff_data) || staff_data.length === 0) {
        throw new ValidationError('Staff data array is required');
      }

      const results = [];
      
      for (const staff of staff_data) {
        try {
          // Create user
          const hashedPassword = await bcrypt.hash('DefaultPass123!', 10);
          const userResult = await query(`
            INSERT INTO users (first_name, last_name, email, phone, password_hash, user_type, school_id, status)
            VALUES ($1, $2, $3, $4, $5, 'school_user', $6, 'active')
            RETURNING id
          `, [
            staff.first_name, staff.last_name, staff.email, 
            staff.phone, hashedPassword, req.user.school_id
          ]);

          // Create employee
          const employeeResult = await query(`
            INSERT INTO employees (
              user_id, school_id, employee_number, position, department_id,
              hire_date, employment_status
            )
            VALUES ($1, $2, $3, $4, $5, $6, 'active')
            RETURNING *
          `, [
            userResult.rows[0].id, req.user.school_id,
            staff.employee_number || `IMP${Date.now()}_${results.length}`,
            staff.position, staff.department_id, staff.hire_date || 'CURRENT_DATE'
          ]);

          results.push({ success: true, data: employeeResult.rows[0] });
        } catch (error) {
          results.push({ success: false, error: error.message, staff });
        }
      }

      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;

      res.status(201).json({
        success: true,
        message: `Bulk import completed: ${successCount} successful, ${failureCount} failed`,
        data: {
          results,
          summary: { successCount, failureCount }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // =============================================================================
  // CONTRACT AND RECRUITMENT MANAGEMENT METHODS
  // =============================================================================

  static async getStaffContracts(req, res, next) {
    try {
      const contracts = await query(`
        SELECT 
          e.id, u.first_name, u.last_name, e.employee_number, e.position,
          e.hire_date, e.employment_status, e.contract_end_date,
          e.contract_type, e.salary, d.name as department_name
        FROM employees e
        JOIN users u ON e.user_id = u.id
        LEFT JOIN departments d ON e.department_id = d.id
        WHERE e.school_id = $1
        ORDER BY e.hire_date DESC
      `, [req.user.school_id]);

      res.json({
        success: true,
        data: contracts.rows
      });
    } catch (error) {
      next(error);
    }
  }

  static async createStaffContract(req, res, next) {
    try {
      const { employee_id, contract_type, start_date, end_date, salary, terms } = req.body;

      const result = await query(`
        UPDATE employees 
        SET contract_type = $1, hire_date = $2, contract_end_date = $3, 
            salary = $4, contract_terms = $5, updated_at = CURRENT_TIMESTAMP
        WHERE id = $6 AND school_id = $7
        RETURNING *
      `, [contract_type, start_date, end_date, salary, JSON.stringify(terms), employee_id, req.user.school_id]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Employee not found');
      }

      res.status(201).json({
        success: true,
        message: 'Staff contract created successfully',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }

  static async renewStaffContract(req, res, next) {
    try {
      const { employee_id, new_end_date, salary_adjustment, terms } = req.body;

      const result = await query(`
        UPDATE employees 
        SET contract_end_date = $1, salary = COALESCE($2, salary), 
            contract_terms = $3, updated_at = CURRENT_TIMESTAMP
        WHERE id = $4 AND school_id = $5
        RETURNING *
      `, [new_end_date, salary_adjustment, JSON.stringify(terms), employee_id, req.user.school_id]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Employee not found');
      }

      res.json({
        success: true,
        message: 'Staff contract renewed successfully',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }

  static async getRecruitmentRequests(req, res, next) {
    try {
      const requests = await query(`
        SELECT 
          id, position_title, department_id, description, requirements,
          priority, status, requested_by, created_at
        FROM recruitment_requests
        WHERE school_id = $1
        ORDER BY created_at DESC
      `, [req.user.school_id]);

      res.json({
        success: true,
        data: requests.rows
      });
    } catch (error) {
      next(error);
    }
  }

  static async createRecruitmentRequest(req, res, next) {
    try {
      const { position_title, department_id, description, requirements, priority } = req.body;

      const result = await query(`
        INSERT INTO recruitment_requests (
          school_id, position_title, department_id, description, 
          requirements, priority, status, requested_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7)
        RETURNING *
      `, [req.user.school_id, position_title, department_id, description, 
          JSON.stringify(requirements), priority, req.user.userId]);

      const created = result.rows[0];

      // Create a corresponding approval request for the School Director dashboard
      try {
        await query(`
          INSERT INTO approval_requests (
            school_id,
            request_type,
            request_category,
            request_id,
            request_title,
            request_description,
            request_data,
            requested_by,
            priority,
            approval_status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending')
        `, [
          created.school_id,
          'recruitment',
          'hr',
          created.id,
          created.position_title,
          created.description || null,
          JSON.stringify(created),
          req.user.userId,
          created.priority || 'normal'
        ]);
      } catch (e) {
        // Do not block creation if approval logging fails; log and continue
        console.error('Failed to log recruitment approval request:', e?.message || e);
      }

      res.status(201).json({
        success: true,
        message: 'Recruitment request created successfully',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }

  static async approveRecruitmentRequest(req, res, next) {
    try {
      const { requestId } = req.params;
      const { approval_notes } = req.body;

      const result = await query(`
        UPDATE recruitment_requests 
        SET status = 'approved', approval_notes = $1, 
            approved_by = $2, approved_at = CURRENT_TIMESTAMP
        WHERE id = $3 AND school_id = $4
        RETURNING *
      `, [approval_notes, req.user.userId, requestId, req.user.school_id]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Recruitment request not found');
      }

      const approvedRequest = result.rows[0];

      // Auto-publish to public careers by creating a job_postings record
      try {
        await query(`
          INSERT INTO job_postings (
            school_id, title, department_id, description, requirements,
            status, posted_by
          )
          VALUES ($1, $2, $3, $4, $5, 'active', $6)
          ON CONFLICT DO NOTHING
        `, [
          approvedRequest.school_id,
          approvedRequest.position_title,
          approvedRequest.department_id || null,
          approvedRequest.description || null,
          JSON.stringify(approvedRequest.requirements || []),
          req.user.userId
        ]);
      } catch (inner) {
        // Do not block approval if publishing fails; log and continue
        console.error('Failed to auto-create job posting from approved recruitment:', inner?.message || inner);
      }

      // Sync approval_requests entry status if present
      try {
        await query(
          `UPDATE approval_requests SET approval_status = 'approved', final_approver_id = $1, final_approved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE request_type = 'recruitment' AND request_id = $2 AND school_id = $3`,
          [req.user.userId, requestId, req.user.school_id]
        );
      } catch (syncErr) {
        console.error('Failed to sync approval_requests for recruitment approval:', syncErr?.message || syncErr);
      }

      res.json({
        success: true,
        message: 'Recruitment request approved successfully',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }

  static async rejectRecruitmentRequest(req, res, next) {
    try {
      const { requestId } = req.params;
      const { rejection_reason } = req.body;

      const result = await query(`
        UPDATE recruitment_requests 
        SET status = 'rejected', rejection_reason = $1,
            rejected_by = $2, rejected_at = CURRENT_TIMESTAMP
        WHERE id = $3 AND school_id = $4
        RETURNING *
      `, [rejection_reason, req.user.userId, requestId, req.user.school_id]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Recruitment request not found');
      }

      // Sync approval_requests entry status if present
      try {
        await query(
          `UPDATE approval_requests SET approval_status = 'rejected', final_rejection_reason = $1, updated_at = CURRENT_TIMESTAMP WHERE request_type = 'recruitment' AND request_id = $2 AND school_id = $3`,
          [rejection_reason || null, requestId, req.user.school_id]
        );
      } catch (syncErr) {
        console.error('Failed to sync approval_requests for recruitment rejection:', syncErr?.message || syncErr);
      }

      res.json({
        success: true,
        message: 'Recruitment request rejected',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }

  // =============================================================================
  // JOB POSTING AND APPLICATION MANAGEMENT
  // =============================================================================

  static async getJobPostings(req, res, next) {
    try {
      const postings = await query(`
        SELECT 
          jp.*, d.name as department_name
        FROM job_postings jp
        LEFT JOIN departments d ON jp.department_id = d.id
        WHERE jp.school_id = $1
        ORDER BY jp.created_at DESC
      `, [req.user.school_id]);

      res.json({
        success: true,
        data: postings.rows
      });
    } catch (error) {
      next(error);
    }
  }

  static async createJobPosting(req, res, next) {
    try {
      const { 
        title, department_id, description, requirements, 
        salary_range, application_deadline, employment_type 
      } = req.body;

      const result = await query(`
        INSERT INTO job_postings (
          school_id, title, department_id, description, requirements,
          salary_range, application_deadline, employment_type, status, posted_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active', $9)
        RETURNING *
      `, [
        req.user.school_id, title, department_id, description,
        JSON.stringify(requirements), salary_range, application_deadline,
        employment_type, req.user.userId
      ]);

      res.status(201).json({
        success: true,
        message: 'Job posting created successfully',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }

  static async getJobApplications(req, res, next) {
    try {
      const { job_posting_id } = req.query;

      let whereClause = 'WHERE ja.school_id = $1';
      let params = [req.user.school_id];

      if (job_posting_id) {
        whereClause += ' AND ja.job_posting_id = $2';
        params.push(job_posting_id);
      }

      const applications = await query(`
        SELECT 
          ja.*, jp.title as job_title,
          ja.applicant_name, ja.applicant_email, ja.application_status
        FROM job_applications ja
        JOIN job_postings jp ON ja.job_posting_id = jp.id
        ${whereClause}
        ORDER BY ja.applied_at DESC
      `, params);

      res.json({
        success: true,
        data: applications.rows
      });
    } catch (error) {
      next(error);
    }
  }

  static async shortlistApplications(req, res, next) {
    try {
      const { application_ids, notes } = req.body;

      const results = [];
      for (const appId of application_ids) {
        const result = await query(`
          UPDATE job_applications 
          SET application_status = 'shortlisted', shortlist_notes = $1,
              shortlisted_by = $2, shortlisted_at = CURRENT_TIMESTAMP
          WHERE id = $3 AND school_id = $4
          RETURNING *
        `, [notes, req.user.userId, appId, req.user.school_id]);
        
        results.push(result.rows[0]);
      }

      res.json({
        success: true,
        message: `${results.length} applications shortlisted successfully`,
        data: results
      });
    } catch (error) {
      next(error);
    }
  }

  // =============================================================================
  // LEAVE MANAGEMENT METHODS
  // =============================================================================

  static async getLeaveTypes(req, res, next) {
    try {
      const leaveTypes = await query(`
        SELECT * FROM leave_types 
        WHERE school_id = $1 OR school_id IS NULL
        ORDER BY name
      `, [req.user.school_id]);

      res.json({
        success: true,
        data: leaveTypes.rows
      });
    } catch (error) {
      next(error);
    }
  }

  static async createLeaveType(req, res, next) {
    try {
      const { name, description, max_days, requires_approval, is_paid } = req.body;

      const result = await query(`
        INSERT INTO leave_types (school_id, name, description, max_days, requires_approval, is_paid)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `, [req.user.school_id, name, description, max_days, requires_approval, is_paid]);

      res.status(201).json({
        success: true,
        message: 'Leave type created successfully',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }

  static async getLeaveBalances(req, res, next) {
    try {
      const { employee_id } = req.query;

      let whereClause = 'WHERE lb.school_id = $1';
      let params = [req.user.school_id];

      if (employee_id) {
        whereClause += ' AND lb.employee_id = $2';
        params.push(employee_id);
      }

      const balances = await query(`
        SELECT 
          lb.*, lt.name as leave_type_name,
          u.first_name, u.last_name, e.employee_number
        FROM leave_balances lb
        JOIN leave_types lt ON lb.leave_type_id = lt.id
        JOIN employees e ON lb.employee_id = e.id
        JOIN users u ON e.user_id = u.id
        ${whereClause}
        ORDER BY u.first_name, lt.name
      `, params);

      res.json({
        success: true,
        data: balances.rows
      });
    } catch (error) {
      next(error);
    }
  }

  static async getLeaveCalendar(req, res, next) {
    try {
      const { month, year } = req.query;
      
      let dateFilter = '';
      let params = [req.user.school_id];
      
      if (month && year) {
        dateFilter = 'AND EXTRACT(MONTH FROM la.start_date) = $2 AND EXTRACT(YEAR FROM la.start_date) = $3';
        params.push(month, year);
      }

      const leaves = await query(`
        SELECT 
          la.id, la.start_date, la.end_date, la.status,
          lt.name as leave_type, u.first_name, u.last_name,
          e.employee_number, e.position
        FROM leave_applications la
        JOIN leave_types lt ON la.leave_type_id = lt.id
        JOIN employees e ON la.employee_id = e.id
        JOIN users u ON e.user_id = u.id
        WHERE la.school_id = $1 
        AND la.status IN ('approved', 'pending')
        ${dateFilter}
        ORDER BY la.start_date
      `, params);

      res.json({
        success: true,
        data: leaves.rows
      });
    } catch (error) {
      next(error);
    }
  }

  // Additional methods continue...
  static async getSubstituteTeachers(req, res, next) {
    try {
      const substitutes = await query(`
        SELECT 
          e.id, u.first_name, u.last_name, e.employee_number,
          e.position, e.subjects_qualified, e.availability_status
        FROM employees e
        JOIN users u ON e.user_id = u.id
        WHERE e.school_id = $1 
        AND e.position LIKE '%substitute%'
        AND e.employment_status = 'active'
        ORDER BY u.first_name
      `, [req.user.school_id]);

      res.json({
        success: true,
        data: substitutes.rows
      });
    } catch (error) {
      next(error);
    }
  }

  static async assignSubstituteTeacher(req, res, next) {
    try {
      const { substitute_id, original_teacher_id, class_id, subject_id, period, date } = req.body;

      const result = await query(`
        INSERT INTO substitute_assignments (
          school_id, substitute_teacher_id, original_teacher_id,
          class_id, subject_id, assignment_date, period, status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'assigned')
        RETURNING *
      `, [req.user.school_id, substitute_id, original_teacher_id, class_id, subject_id, date, period]);

      res.status(201).json({
        success: true,
        message: 'Substitute teacher assigned successfully',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }

  static async getLeavePatterns(req, res, next) {
    try {
      const patterns = await query(`
        SELECT 
          e.id, u.first_name, u.last_name,
          COUNT(la.id) as total_leaves,
          AVG(la.duration_days) as avg_duration,
          lt.name as most_common_type
        FROM employees e
        JOIN users u ON e.user_id = u.id
        LEFT JOIN leave_applications la ON e.id = la.employee_id
        LEFT JOIN leave_types lt ON la.leave_type_id = lt.id
        WHERE e.school_id = $1
        GROUP BY e.id, u.first_name, u.last_name, lt.name
        ORDER BY total_leaves DESC
      `, [req.user.school_id]);

      res.json({
        success: true,
        data: patterns.rows
      });
    } catch (error) {
      next(error);
    }
  }

  static async bulkApproveLeave(req, res, next) {
    try {
      const { leave_application_ids, approval_notes } = req.body;

      const results = [];
      for (const leaveId of leave_application_ids) {
        const result = await query(`
          UPDATE leave_applications 
          SET status = 'approved', approval_notes = $1,
              approved_by = $2, approved_at = CURRENT_TIMESTAMP
          WHERE id = $3 AND school_id = $4
          RETURNING *
        `, [approval_notes, req.user.userId, leaveId, req.user.school_id]);
        
        results.push(result.rows[0]);
      }

      res.json({
        success: true,
        message: `${results.length} leave applications approved successfully`,
        data: results
      });
    } catch (error) {
      next(error);
    }
  }

  static async getDepartmentLeaveReport(req, res, next) {
    try {
      const { department_id, start_date, end_date } = req.query;

      let whereClause = 'WHERE la.school_id = $1';
      let params = [req.user.school_id];

      if (department_id) {
        whereClause += ' AND e.department_id = $2';
        params.push(department_id);
      }

      if (start_date && end_date) {
        const paramCount = params.length;
        whereClause += ` AND la.start_date >= $${paramCount + 1} AND la.end_date <= $${paramCount + 2}`;
        params.push(start_date, end_date);
      }

      const report = await query(`
        SELECT 
          d.name as department_name,
          COUNT(la.id) as total_leaves,
          SUM(la.duration_days) as total_days,
          AVG(la.duration_days) as avg_duration,
          lt.name as leave_type,
          COUNT(CASE WHEN la.status = 'approved' THEN 1 END) as approved_leaves,
          COUNT(CASE WHEN la.status = 'pending' THEN 1 END) as pending_leaves
        FROM leave_applications la
        JOIN employees e ON la.employee_id = e.id
        JOIN departments d ON e.department_id = d.id
        JOIN leave_types lt ON la.leave_type_id = lt.id
        ${whereClause}
        GROUP BY d.name, lt.name
        ORDER BY d.name, total_leaves DESC
      `, params);

      res.json({
        success: true,
        data: report.rows
      });
    } catch (error) {
      next(error);
    }
  }

  // Interview and onboarding methods
  static async getInterviews(req, res, next) {
    try {
      const interviews = await query(`
        SELECT 
          i.*, ja.applicant_name, jp.title as job_title
        FROM interviews i
        JOIN job_applications ja ON i.application_id = ja.id
        JOIN job_postings jp ON ja.job_posting_id = jp.id
        WHERE i.school_id = $1
        ORDER BY i.scheduled_date DESC
      `, [req.user.school_id]);

      res.json({
        success: true,
        data: interviews.rows
      });
    } catch (error) {
      next(error);
    }
  }

  static async scheduleInterview(req, res, next) {
    try {
      const { application_id, scheduled_date, interview_type, panel_members } = req.body;

      const result = await query(`
        INSERT INTO interviews (
          school_id, application_id, scheduled_date, interview_type,
          panel_members, status, scheduled_by
        )
        VALUES ($1, $2, $3, $4, $5, 'scheduled', $6)
        RETURNING *
      `, [
        req.user.school_id, application_id, scheduled_date,
        interview_type, JSON.stringify(panel_members), req.user.userId
      ]);

      res.status(201).json({
        success: true,
        message: 'Interview scheduled successfully',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }

  static async generateJobOffer(req, res, next) {
    try {
      const { application_id, position, salary, start_date, terms } = req.body;

      const result = await query(`
        INSERT INTO job_offers (
          school_id, application_id, position, salary, start_date,
          terms, status, generated_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7)
        RETURNING *
      `, [
        req.user.school_id, application_id, position, salary,
        start_date, JSON.stringify(terms), req.user.userId
      ]);

      res.status(201).json({
        success: true,
        message: 'Job offer generated successfully',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }

  static async getOnboardingTasks(req, res, next) {
    try {
      const { employee_id } = req.query;

      let whereClause = 'WHERE ot.school_id = $1';
      let params = [req.user.school_id];

      if (employee_id) {
        whereClause += ' AND ot.employee_id = $2';
        params.push(employee_id);
      }

      const tasks = await query(`
        SELECT 
          ot.*, u.first_name, u.last_name, e.employee_number
        FROM onboarding_tasks ot
        JOIN employees e ON ot.employee_id = e.id
        JOIN users u ON e.user_id = u.id
        ${whereClause}
        ORDER BY ot.due_date, ot.priority DESC
      `, params);

      res.json({
        success: true,
        data: tasks.rows
      });
    } catch (error) {
      next(error);
    }
  }

  static async completeOnboarding(req, res, next) {
    try {
      const { employee_id, completed_tasks, notes } = req.body;

      // Update onboarding status
      const result = await query(`
        UPDATE employees 
        SET onboarding_status = 'completed', onboarding_completed_at = CURRENT_TIMESTAMP,
            onboarding_notes = $1
        WHERE id = $2 AND school_id = $3
        RETURNING *
      `, [notes, employee_id, req.user.school_id]);

      // Mark tasks as completed
      if (completed_tasks && completed_tasks.length > 0) {
        for (const taskId of completed_tasks) {
          await query(`
            UPDATE onboarding_tasks 
            SET status = 'completed', completed_at = CURRENT_TIMESTAMP,
                completed_by = $1
            WHERE id = $2 AND school_id = $3
          `, [req.user.userId, taskId, req.user.school_id]);
        }
      }

      res.json({
        success: true,
        message: 'Employee onboarding completed successfully',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = HRController;