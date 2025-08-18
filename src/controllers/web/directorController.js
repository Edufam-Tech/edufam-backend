const { query } = require('../../config/database');

class DirectorWebController {
  // Get main dashboard data for School Director
  async getDashboard(req, res) {
    try {
      const userId = req.user.userId;
      const selectedSchoolId = req.query.schoolId || null;

      const schoolsResult = await query(`
        SELECT s.*, 
               (SELECT COUNT(*) FROM students st WHERE st.school_id = s.id AND st.is_active = true) AS student_count,
               (SELECT COUNT(*) FROM users staff WHERE staff.school_id = s.id AND staff.user_type = 'staff' AND staff.is_active = true) AS staff_count,
               (SELECT COALESCE(SUM(p.amount), 0) FROM payments p WHERE p.school_id = s.id AND p.created_at >= DATE_TRUNC('year', CURRENT_DATE)) AS total_revenue
        FROM schools s
        JOIN school_directors sd ON s.id = sd.school_id
        WHERE sd.director_id = $1 AND s.is_active = true
        ORDER BY s.name
      `, [userId]);

      const schools = schoolsResult.rows;

      let dashboardData;
      if (selectedSchoolId) {
        dashboardData = await this.getSchoolSpecificData(selectedSchoolId, userId);
      } else {
        dashboardData = await this.getPortfolioData(schools, userId);
      }

      const pendingApprovals = await this.getAllPendingApprovals(userId);

      res.json({
        success: true,
        data: {
          schools,
          selectedSchool: selectedSchoolId,
          dashboard: dashboardData,
          pendingApprovals,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Error fetching director web dashboard:', error);
      res.status(500).json({ success: false, error: { code: 'DASHBOARD_ERROR', message: 'Failed to fetch dashboard data' } });
    }
  }

  // Get specific school dashboard data
  async getSchoolSpecificDashboard(req, res) {
    try {
      const { schoolId } = req.params;
      const userId = req.user.userId;

      const access = await query(`
        SELECT 1 FROM school_directors WHERE director_id = $1 AND school_id = $2
      `, [userId, schoolId]);

      if (access.rows.length === 0) {
        return res.status(403).json({ success: false, error: { code: 'ACCESS_DENIED', message: 'Access denied to this school' } });
      }

      const dashboardData = await this.getSchoolSpecificData(schoolId, userId);
      res.json({ success: true, data: dashboardData });
    } catch (error) {
      console.error('Error fetching school-specific dashboard:', error);
      res.status(500).json({ success: false, error: { code: 'SCHOOL_DASHBOARD_ERROR', message: 'Failed to fetch school dashboard data' } });
    }
  }

  // Get director's schools list
  async getDirectorSchools(req, res) {
    try {
      const userId = req.user.userId;
      const schoolsResult = await query(`
        SELECT s.id as school_id, s.name, s.address, s.phone, s.email, s.logo_url,
               s.curriculum_types, s.student_capacity, s.established_year,
               (SELECT COUNT(*) FROM students st WHERE st.school_id = s.id AND st.is_active = true) as current_students,
               (SELECT COUNT(*) FROM users staff WHERE staff.school_id = s.id AND staff.user_type = 'staff' AND staff.is_active = true) as total_staff,
               ROUND((SELECT AVG(ar.overall_score) FROM academic_reports ar WHERE ar.school_id = s.id AND ar.created_at >= DATE_TRUNC('year', CURRENT_DATE)), 2) as avg_performance,
               (SELECT COALESCE(SUM(p.amount), 0) FROM payments p WHERE p.school_id = s.id AND p.created_at >= DATE_TRUNC('month', CURRENT_DATE)) as monthly_revenue,
               (SELECT COALESCE(SUM(p.amount), 0) FROM payments p WHERE p.school_id = s.id AND p.created_at >= DATE_TRUNC('year', CURRENT_DATE)) as yearly_revenue
        FROM schools s
        JOIN school_directors sd ON s.id = sd.school_id
        WHERE sd.director_id = $1 AND s.is_active = true
        ORDER BY s.name
      `, [userId]);

      const schools = schoolsResult.rows;
      res.json({
        success: true,
        data: {
          schools,
          total_schools: schools.length,
          portfolio_metrics: this.calculatePortfolioMetrics(schools)
        }
      });
    } catch (error) {
      console.error('Error fetching director schools:', error);
      res.status(500).json({ success: false, error: { code: 'SCHOOLS_FETCH_ERROR', message: 'Failed to fetch schools data' } });
    }
  }

  // Pending approvals list
  async getPendingApprovals(req, res) {
    try {
      const userId = req.user.userId;
      const schoolId = req.query.schoolId || null;
      const approvals = await this.getAllPendingApprovals(userId, schoolId);
      res.json({
        success: true,
        data: {
          approvals,
          summary: {
            total_pending: approvals.expenses.length + approvals.recruitment.length + approvals.fee_assignments.length + approvals.policies.length,
            by_type: {
              expenses: approvals.expenses.length,
              recruitment: approvals.recruitment.length,
              fee_assignments: approvals.fee_assignments.length,
              policies: approvals.policies.length
            }
          }
        }
      });
    } catch (error) {
      console.error('Error fetching pending approvals:', error);
      res.status(500).json({ success: false, error: { code: 'APPROVALS_FETCH_ERROR', message: 'Failed to fetch pending approvals' } });
    }
  }

  // Switch school context for director
  async switchSchoolContext(req, res) {
    try {
      const { schoolId } = req.params;
      const userId = req.user.userId;

      const access = await query(`
        SELECT s.* FROM schools s
        JOIN school_directors sd ON s.id = sd.school_id
        WHERE sd.director_id = $1 AND s.id = $2 AND s.is_active = true
      `, [userId, schoolId]);

      if (access.rows.length === 0) {
        return res.status(403).json({ success: false, error: { code: 'ACCESS_DENIED', message: 'Access denied to this school' } });
      }

      await query(`
        UPDATE users SET current_school_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2
      `, [schoolId, userId]);

      const schoolData = await this.getSchoolSpecificData(schoolId, userId);
      res.json({ success: true, data: { school: access.rows[0], dashboard: schoolData, message: `Successfully switched to ${access.rows[0].name}` } });
    } catch (error) {
      console.error('Error switching school context:', error);
      res.status(500).json({ success: false, error: { code: 'CONTEXT_SWITCH_ERROR', message: 'Failed to switch school context' } });
    }
  }

  // Portfolio overview
  async getPortfolioOverview(req, res) {
    try {
      const userId = req.user.userId;
      const schoolsResult = await query(`
        SELECT s.id, s.name,
               (SELECT COUNT(*) FROM students st WHERE st.school_id = s.id AND st.is_active = true) as student_count,
               (SELECT COUNT(*) FROM users staff WHERE staff.school_id = s.id AND staff.user_type = 'staff' AND staff.is_active = true) as staff_count,
               (SELECT COALESCE(SUM(p.amount), 0) FROM payments p WHERE p.school_id = s.id AND p.created_at >= DATE_TRUNC('year', CURRENT_DATE)) as total_revenue
        FROM schools s
        JOIN school_directors sd ON s.id = sd.school_id
        WHERE sd.director_id = $1 AND s.is_active = true
        ORDER BY s.name
      `, [userId]);

      const portfolioData = await this.getPortfolioData(schoolsResult.rows, userId);
      res.json({ success: true, data: portfolioData });
    } catch (error) {
      console.error('Error fetching portfolio overview:', error);
      res.status(500).json({ success: false, error: { code: 'PORTFOLIO_ERROR', message: 'Failed to fetch portfolio data' } });
    }
  }

  // Portfolio analytics (stub)
  async getPortfolioAnalytics(req, res) {
    return res.json({ success: true, data: { analytics: {} } });
  }

  // School comparison (stub)
  async getSchoolComparison(req, res) {
    return res.json({ success: true, data: { comparison: [] } });
  }

  // Helpers
  async getSchoolSpecificData(schoolId, userId) {
    const metrics = await query(`
      SELECT 
        s.name as school_name,
        (SELECT COUNT(*) FROM students st WHERE st.school_id = s.id AND st.is_active = true) as total_students,
        (SELECT COUNT(*) FROM users staff WHERE staff.school_id = s.id AND staff.user_type = 'staff' AND staff.is_active = true) as total_staff,
        (SELECT COUNT(*) FROM classes c WHERE c.school_id = s.id AND c.is_active = true) as total_classes,
        ROUND((SELECT AVG(ar.overall_score) FROM academic_reports ar WHERE ar.school_id = s.id AND ar.created_at >= DATE_TRUNC('month', CURRENT_DATE)), 2) as avg_performance,
        (SELECT COUNT(*) FROM attendance_students att WHERE att.school_id = s.id AND att.date = CURRENT_DATE AND att.status = 'present') as today_attendance,
        (SELECT COALESCE(SUM(p.amount), 0) FROM payments p WHERE p.school_id = s.id AND p.created_at >= DATE_TRUNC('month', CURRENT_DATE)) as monthly_revenue,
        (SELECT COALESCE(SUM(p.amount), 0) FROM payments p WHERE p.school_id = s.id AND p.created_at >= DATE_TRUNC('year', CURRENT_DATE)) as yearly_revenue
      FROM schools s
      WHERE s.id = $1
    `, [schoolId]);

    return { school_metrics: metrics.rows[0] || {} };
  }

  async getPortfolioData(schools, userId) {
    const toInt = (v) => parseInt(v || 0, 10);
    const toFloat = (v) => parseFloat(v || 0);
    const totalStudents = schools.reduce((sum, s) => sum + toInt(s.student_count), 0);
    const totalStaff = schools.reduce((sum, s) => sum + toInt(s.staff_count), 0);
    const totalRevenue = schools.reduce((sum, s) => sum + toFloat(s.total_revenue), 0);

    return {
      portfolio_summary: {
        total_schools: schools.length,
        total_students: totalStudents,
        total_staff: totalStaff,
        total_revenue: totalRevenue,
        avg_students_per_school: schools.length ? Math.round(totalStudents / schools.length) : 0
      },
      schools_overview: schools
    };
  }

  async getAllPendingApprovals(userId, schoolId = null) {
    const whereBase = `WHERE sd.director_id = $1 AND ar.status = 'pending' AND ar.requires_director_approval = true`;
    const where = schoolId ? `${whereBase} AND ar.school_id = $2` : whereBase;
    const params = schoolId ? [userId, schoolId] : [userId];

    const approvals = await query(`
      SELECT ar.*, s.name as school_name, u.first_name, u.last_name
      FROM approval_requests ar
      JOIN schools s ON ar.school_id = s.id
      JOIN school_directors sd ON s.id = sd.school_id
      JOIN users u ON ar.requested_by = u.id
      ${where}
      ORDER BY ar.created_at DESC
    `, params);

    // Split by type
    const expenses = approvals.rows.filter(a => a.approval_type === 'expense');
    const recruitment = approvals.rows.filter(a => a.approval_type === 'recruitment');
    const feeAssignments = approvals.rows.filter(a => a.approval_type === 'fee_assignment');
    const policies = approvals.rows.filter(a => a.approval_type === 'policy');

    return {
      expenses,
      recruitment,
      fee_assignments: feeAssignments,
      policies
    };
  }

  calculatePortfolioMetrics(schools) {
    const toInt = (v) => parseInt(v || 0, 10);
    const toFloat = (v) => parseFloat(v || 0);
    return {
      total_students: schools.reduce((sum, s) => sum + toInt(s.current_students), 0),
      total_staff: schools.reduce((sum, s) => sum + toInt(s.total_staff), 0),
      total_monthly_revenue: schools.reduce((sum, s) => sum + toFloat(s.monthly_revenue), 0),
      avg_performance: schools.length ? schools.reduce((sum, s) => sum + parseFloat(s.avg_performance || 0), 0) / schools.length : 0
    };
  }

  // Stubs/additional endpoints referenced by routes
  async getSchoolOverview(req, res) { return this.getSchoolSpecificDashboard(req, res); }
  async getSchoolPendingApprovals(req, res) { req.query.schoolId = req.params.schoolId; return this.getPendingApprovals(req, res); }
  async getApprovalHistory(req, res) { return res.json({ success: true, data: { history: [] } }); }

  async getPendingExpenseApprovals(req, res) { req.query.category = 'expense'; return this.getPendingApprovals(req, res); }

  async approveExpense(req, res) {
    try {
      const { expenseId } = req.params;
      const { comments } = req.body || {};
      const userId = req.user.userId;

      await query(`
        UPDATE expenses 
        SET approval_status = 'approved', approved_by = $1, approved_at = CURRENT_TIMESTAMP, approval_comments = $2
        WHERE id = $3
      `, [userId, comments || null, expenseId]);

      res.json({ success: true, message: 'Expense approved successfully' });
    } catch (error) {
      console.error('Error approving expense:', error);
      res.status(500).json({ success: false, error: { code: 'APPROVAL_ERROR', message: 'Failed to approve expense' } });
    }
  }

  async rejectExpense(req, res) {
    try {
      const { expenseId } = req.params;
      const { comments } = req.body || {};
      const userId = req.user.userId;

      await query(`
        UPDATE expenses 
        SET approval_status = 'rejected', approved_by = $1, approved_at = CURRENT_TIMESTAMP, approval_comments = $2
        WHERE id = $3
      `, [userId, comments || null, expenseId]);

      res.json({ success: true, message: 'Expense rejected successfully' });
    } catch (error) {
      console.error('Error rejecting expense:', error);
      res.status(500).json({ success: false, error: { code: 'APPROVAL_ERROR', message: 'Failed to reject expense' } });
    }
  }

  // Recruitment and fee assignment approvals (stubs delegating to approval_requests table when available)
  async getPendingRecruitmentApprovals(req, res) {
    try {
      req.query.category = 'recruitment';
      return this.getPendingApprovals(req, res);
    } catch (e) {
      return res.status(500).json({ success: false, error: { message: 'Failed to fetch recruitment approvals' } });
    }
  }
  async approveRecruitment(req, res) {
    try {
      const { recruitmentId } = req.params;
      const { comments } = req.body || {};
      const userId = req.user.userId;
      const schoolId = req.user.schoolId || req.user.school_id;

      // Update recruitment request
      const result = await query(`
        UPDATE recruitment_requests 
        SET status = 'approved', approval_notes = $1, approved_by = $2, approved_at = CURRENT_TIMESTAMP
        WHERE id = $3 AND school_id = $4
        RETURNING *
      `, [comments || null, userId, recruitmentId, schoolId]);

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: { message: 'Recruitment request not found' } });
      }
      const approved = result.rows[0];

      // Sync approval_requests
      await query(
        `UPDATE approval_requests SET approval_status = 'approved', final_approver_id = $1, final_approved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE request_type = 'recruitment' AND request_id = $2 AND school_id = $3`,
        [userId, recruitmentId, schoolId]
      );

      // Publish job posting
      try {
        await query(`
          INSERT INTO job_postings (school_id, title, department_id, description, requirements, status, posted_by)
          VALUES ($1, $2, $3, $4, $5, 'active', $6)
          ON CONFLICT DO NOTHING
        `, [
          approved.school_id,
          approved.position_title,
          approved.department_id || null,
          approved.description || null,
          JSON.stringify(approved.requirements || []),
          userId,
        ]);
      } catch (e) {
        // ignore publish failure
      }

      return res.json({ success: true, message: 'Recruitment approved' });
    } catch (e) {
      return res.status(500).json({ success: false, error: { message: 'Failed to approve recruitment' } });
    }
  }
  async rejectRecruitment(req, res) {
    try {
      const { recruitmentId } = req.params;
      const { reason } = req.body || {};
      const userId = req.user.userId;
      const schoolId = req.user.schoolId || req.user.school_id;

      const result = await query(`
        UPDATE recruitment_requests 
        SET status = 'rejected', rejection_reason = $1, rejected_by = $2, rejected_at = CURRENT_TIMESTAMP
        WHERE id = $3 AND school_id = $4
        RETURNING *
      `, [reason || null, userId, recruitmentId, schoolId]);

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: { message: 'Recruitment request not found' } });
      }

      await query(
        `UPDATE approval_requests SET approval_status = 'rejected', final_rejection_reason = $1, updated_at = CURRENT_TIMESTAMP WHERE request_type = 'recruitment' AND request_id = $2 AND school_id = $3`,
        [reason || null, recruitmentId, schoolId]
      );

      return res.json({ success: true, message: 'Recruitment rejected' });
    } catch (e) {
      return res.status(500).json({ success: false, error: { message: 'Failed to reject recruitment' } });
    }
  }

  async getPendingFeeAssignmentApprovals(req, res) { return res.json({ success: true, data: { approvals: [] } }); }
  async approveFeeAssignment(req, res) { return res.json({ success: true, message: 'Fee assignment approved' }); }
  async rejectFeeAssignment(req, res) { return res.json({ success: true, message: 'Fee assignment rejected' }); }

  async getPendingPolicyApprovals(req, res) { return res.json({ success: true, data: { approvals: [] } }); }
  async approvePolicy(req, res) { return res.json({ success: true, message: 'Policy approved' }); }
  async rejectPolicy(req, res) { return res.json({ success: true, message: 'Policy rejected' }); }

  // Financial and staff stubs
  async getFinancialOverview(req, res) {
    try {
      const directorId = req.user.userId;
      const rows = await query(`
        SELECT s.id, s.name,
          (SELECT COALESCE(SUM(amount),0) FROM payments WHERE school_id = s.id AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)) as monthly_revenue,
          (SELECT COALESCE(SUM(amount),0) FROM payments WHERE school_id = s.id AND DATE_TRUNC('year', created_at) = DATE_TRUNC('year', CURRENT_DATE)) as yearly_revenue,
          (SELECT COALESCE(SUM(amount),0) FROM fee_invoices WHERE school_id = s.id AND status = 'unpaid') as outstanding
        FROM schools s
        JOIN school_directors sd ON s.id = sd.school_id
        WHERE sd.director_id = $1 AND s.is_active = true
        ORDER BY s.name
      `, [directorId]);
      res.json({ success: true, data: { schools: rows.rows } });
    } catch (e) { res.status(500).json({ success: false, error: { message: 'Failed to fetch financial overview' } }); }
  }

  async getRevenueTrends(req, res) {
    try {
      const directorId = req.user.userId;
      const rows = await query(`
        SELECT s.name as school_name, DATE_TRUNC('month', p.created_at) as month, SUM(p.amount) as revenue
        FROM payments p
        JOIN schools s ON p.school_id = s.id
        JOIN school_directors sd ON s.id = sd.school_id
        WHERE sd.director_id = $1 AND p.created_at >= CURRENT_DATE - INTERVAL '12 months'
        GROUP BY s.name, DATE_TRUNC('month', p.created_at)
        ORDER BY s.name, month
      `, [directorId]);
      res.json({ success: true, data: { trends: rows.rows } });
    } catch (e) { res.status(500).json({ success: false, error: { message: 'Failed to fetch revenue trends' } }); }
  }

  async getSchoolFinancialComparison(req, res) {
    try {
      const directorId = req.user.userId;
      const rows = await query(`
        SELECT s.name,
          (SELECT COALESCE(SUM(amount),0) FROM payments WHERE school_id = s.id AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)) as monthly_revenue,
          (SELECT COUNT(*) FROM payments WHERE school_id = s.id AND status = 'failed' AND created_at >= CURRENT_DATE - INTERVAL '30 days') as failed_tx,
          (SELECT COALESCE(SUM(amount),0) FROM fee_invoices WHERE school_id = s.id AND status = 'unpaid') as outstanding
        FROM schools s
        JOIN school_directors sd ON s.id = sd.school_id
        WHERE sd.director_id = $1 AND s.is_active = true
        ORDER BY monthly_revenue DESC
      `, [directorId]);
      res.json({ success: true, data: { comparison: rows.rows } });
    } catch (e) { res.status(500).json({ success: false, error: { message: 'Failed to fetch financial comparison' } }); }
  }

  async getStaffOverview(req, res) {
    try {
      const directorId = req.user.userId;
      const rows = await query(`
        SELECT s.name,
          (SELECT COUNT(*) FROM users WHERE school_id = s.id AND user_type = 'staff' AND is_active = true) as staff_total,
          (SELECT COUNT(*) FROM users WHERE school_id = s.id AND user_type = 'staff' AND role = 'teacher' AND is_active = true) as teachers,
          (SELECT COUNT(*) FROM users WHERE school_id = s.id AND user_type = 'staff' AND role != 'teacher' AND is_active = true) as non_teaching
        FROM schools s
        JOIN school_directors sd ON s.id = sd.school_id
        WHERE sd.director_id = $1 AND s.is_active = true
        ORDER BY s.name
      `, [directorId]);
      res.json({ success: true, data: { overview: rows.rows } });
    } catch (e) { res.status(500).json({ success: false, error: { message: 'Failed to fetch staff overview' } }); }
  }

  async getStaffPerformanceAnalytics(req, res) {
    try {
      const directorId = req.user.userId;
      const rows = await query(`
        SELECT s.name as school_name, u.first_name, u.last_name,
          AVG(sg.score) as avg_score, COUNT(DISTINCT gs.class_id) as classes,
          COUNT(DISTINCT sg.student_id) as students
        FROM schools s
        JOIN school_directors sd ON s.id = sd.school_id
        JOIN grade_submissions gs ON gs.school_id = s.id
        JOIN student_grades sg ON sg.grade_submission_id = gs.id
        JOIN users u ON u.id = gs.teacher_id
        WHERE sd.director_id = $1 AND gs.submitted_at >= CURRENT_DATE - INTERVAL '90 days'
        GROUP BY s.name, u.id, u.first_name, u.last_name
        ORDER BY school_name, avg_score DESC
      `, [directorId]);
      res.json({ success: true, data: { analytics: rows.rows } });
    } catch (e) { res.status(500).json({ success: false, error: { message: 'Failed to fetch staff performance' } }); }
  }

  async getStaffDistribution(req, res) {
    try {
      const directorId = req.user.userId;
      const rows = await query(`
        SELECT s.name as school_name, d.name as department, COUNT(u.id) as count
        FROM schools s
        JOIN school_directors sd ON s.id = sd.school_id
        JOIN users u ON u.school_id = s.id AND u.user_type = 'staff' AND u.is_active = true
        LEFT JOIN departments d ON u.department_id = d.id
        WHERE sd.director_id = $1
        GROUP BY s.name, d.name
        ORDER BY s.name, department
      `, [directorId]);
      res.json({ success: true, data: { distribution: rows.rows } });
    } catch (e) { res.status(500).json({ success: false, error: { message: 'Failed to fetch staff distribution' } }); }
  }

  // Strategic planning stubs
  async getStrategicGoals(req, res) { return res.json({ success: true, data: { goals: [] } }); }
  async getPerformanceMetrics(req, res) { return res.json({ success: true, data: { metrics: [] } }); }
  async getForecasts(req, res) { return res.json({ success: true, data: { forecasts: [] } }); }

  // School settings stubs
  async getSchoolSettings(req, res) { return res.json({ success: true, data: { settings: {} } }); }
  async updateSchoolSettings(req, res) { return res.json({ success: true, message: 'Settings updated' }); }

  // Notifications stubs
  async getNotifications(req, res) { return res.json({ success: true, data: { notifications: [] } }); }
  async markNotificationAsRead(req, res) { return res.json({ success: true, message: 'Notification marked as read' }); }
}

module.exports = new DirectorWebController();


