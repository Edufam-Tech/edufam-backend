const { query } = require('../../config/database');
const { ValidationError, NotFoundError } = require('../../middleware/errorHandler');

class MobileDirectorController {
  // =============================================================================
  // DIRECTOR DASHBOARD - MOBILE OPTIMIZED
  // =============================================================================

  // Get director dashboard overview
  static async getDashboard(req, res, next) {
    try {
      const directorId = req.user.userId;
      const { currentSchoolId } = req.user;

      const [
        directorProfile,
        schoolPortfolio,
        pendingApprovals,
        alerts,
        quickMetrics
      ] = await Promise.all([
        // Director profile and greeting
        query(`
          SELECT first_name, last_name, role, last_login_at
          FROM users 
          WHERE id = $1
        `, [directorId]),

        // School portfolio
        query(`
          SELECT 
            s.id,
            s.name,
            s.logo_url,
            s.school_type,
            (SELECT COUNT(*) FROM students WHERE school_id = s.id AND is_active = true) as student_count,
            (SELECT COUNT(*) FROM users WHERE school_id = s.id AND user_type = 'staff' AND is_active = true) as staff_count,
            (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE school_id = s.id AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)) as monthly_revenue,
            (SELECT AVG(overall_score) FROM academic_reports WHERE school_id = s.id AND term = (SELECT id FROM academic_terms WHERE is_current = true LIMIT 1)) as performance_score,
            CASE WHEN s.id = $1 THEN true ELSE false END as is_current
          FROM schools s
          JOIN school_directors sd ON s.id = sd.school_id
          WHERE sd.director_id = $2 AND s.is_active = true
          ORDER BY is_current DESC, s.name
        `, [currentSchoolId, directorId]),

        // Pending approvals summary
        query(`
          SELECT 
            approval_type,
            priority,
            COUNT(*) as count,
            SUM(CASE WHEN amount IS NOT NULL THEN amount ELSE 0 END) as total_amount
          FROM approval_requests ar
          JOIN schools s ON ar.school_id = s.id
          JOIN school_directors sd ON s.id = sd.school_id
          WHERE sd.director_id = $1 
            AND ar.status = 'pending'
            AND ar.requires_director_approval = true
          GROUP BY approval_type, priority
          ORDER BY 
            CASE priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END
        `, [directorId]),

        // Critical alerts
        query(`
          SELECT 
            a.type,
            a.title,
            a.message,
            a.severity,
            a.created_at,
            s.name as school_name,
            a.metadata
          FROM alerts a
          JOIN schools s ON a.school_id = s.id
          JOIN school_directors sd ON s.id = sd.school_id
          WHERE sd.director_id = $1
            AND a.status = 'active'
            AND a.severity IN ('critical', 'high')
          ORDER BY 
            CASE a.severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 ELSE 3 END,
            a.created_at DESC
          LIMIT 5
        `, [directorId]),

        // Quick metrics across all schools
        query(`
          SELECT 
            COUNT(DISTINCT s.id) as total_schools,
            SUM((SELECT COUNT(*) FROM students WHERE school_id = s.id AND is_active = true)) as total_students,
            SUM((SELECT COALESCE(SUM(amount), 0) FROM payments WHERE school_id = s.id AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE))) as total_monthly_revenue,
            AVG((SELECT COALESCE(SUM(amount), 0) FROM payments WHERE school_id = s.id AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE))) as avg_school_revenue,
            (SELECT COUNT(*) FROM approval_requests ar2 WHERE ar2.school_id IN (SELECT school_id FROM school_directors WHERE director_id = $1) AND ar2.status = 'pending' AND ar2.requires_director_approval = true) as pending_approvals_count
          FROM schools s
          JOIN school_directors sd ON s.id = sd.school_id
          WHERE sd.director_id = $1 AND s.is_active = true
        `, [directorId])
      ]);

      const profile = directorProfile.rows[0];
      const currentTime = new Date().getHours();
      const greeting = `Good ${currentTime < 12 ? 'morning' : currentTime < 17 ? 'afternoon' : 'evening'}, Director ${profile.first_name}`;

      // Process school portfolio
      const schools = schoolPortfolio.rows;
      const currentSchool = schools.find(s => s.is_current) || schools[0];
      const otherSchools = schools.filter(s => !s.is_current);

      // Process pending approvals
      const approvalsSummary = {
        total: pendingApprovals.rows.reduce((sum, item) => sum + parseInt(item.count), 0),
        critical: pendingApprovals.rows.filter(item => item.priority === 'critical').reduce((sum, item) => sum + parseInt(item.count), 0),
        byCategory: {}
      };

      pendingApprovals.rows.forEach(item => {
        approvalsSummary.byCategory[item.approval_type] = (approvalsSummary.byCategory[item.approval_type] || 0) + parseInt(item.count);
      });

      res.json({
        success: true,
        data: {
          greeting,
          lastLogin: profile.last_login_at,
          schoolPortfolio: {
            totalSchools: schools.length,
            currentSchool: currentSchool ? {
              id: currentSchool.id,
              name: currentSchool.name,
              logo: currentSchool.logo_url,
              type: currentSchool.school_type,
              metrics: {
                students: parseInt(currentSchool.student_count),
                staff: parseInt(currentSchool.staff_count),
                revenue: `KES ${(currentSchool.monthly_revenue / 1000).toFixed(0)}K`,
                performance: `${(currentSchool.performance_score || 0).toFixed(0)}%`
              }
            } : null,
            otherSchools: otherSchools.map(school => ({
              id: school.id,
              name: school.name,
              type: school.school_type,
              quickStats: {
                students: parseInt(school.student_count),
                revenue: `KES ${(school.monthly_revenue / 1000).toFixed(0)}K`
              }
            }))
          },
          pendingApprovals: approvalsSummary,
          alerts: alerts.rows.map(alert => ({
            type: alert.severity,
            message: alert.message,
            schoolName: alert.school_name,
            timestamp: alert.created_at,
            metadata: alert.metadata ? JSON.parse(alert.metadata) : {}
          })),
          quickMetrics: {
            monthlyRevenue: `KES ${(quickMetrics.rows[0].total_monthly_revenue / 1000000).toFixed(1)}M`,
            totalStudents: parseInt(quickMetrics.rows[0].total_students),
            totalSchools: parseInt(quickMetrics.rows[0].total_schools),
            pendingApprovals: parseInt(quickMetrics.rows[0].pending_approvals_count)
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // =============================================================================
  // SCHOOL SWITCHING & MANAGEMENT
  // =============================================================================

  // Switch current school context
  static async switchSchool(req, res, next) {
    try {
      const { schoolId } = req.body;
      const directorId = req.user.userId;

      if (!schoolId) {
        throw new ValidationError('School ID is required');
      }

      // Verify director has access to this school
      const schoolAccess = await query(`
        SELECT s.id, s.name, s.school_type
        FROM schools s
        JOIN school_directors sd ON s.id = sd.school_id
        WHERE sd.director_id = $1 AND s.id = $2 AND s.is_active = true
      `, [directorId, schoolId]);

      if (schoolAccess.rows.length === 0) {
        throw new ValidationError('You do not have access to this school');
      }

      // Update user's current school context
      await query(`
        UPDATE users 
        SET current_school_id = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [schoolId, directorId]);

      const school = schoolAccess.rows[0];

      res.json({
        success: true,
        message: 'School context switched successfully',
        data: {
          currentSchool: {
            id: school.id,
            name: school.name,
            type: school.school_type
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Get all schools managed by director
  static async getSchools(req, res, next) {
    try {
      const directorId = req.user.userId;

      const schools = await query(`
        SELECT 
          s.id,
          s.name,
          s.school_type,
          s.logo_url,
          s.address,
          s.phone,
          s.email,
          s.website,
          s.curriculum_types,
          s.created_at,
          (SELECT COUNT(*) FROM students WHERE school_id = s.id AND is_active = true) as student_count,
          (SELECT COUNT(*) FROM users WHERE school_id = s.id AND user_type = 'staff' AND is_active = true) as staff_count,
          (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE school_id = s.id AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)) as monthly_revenue,
          (SELECT AVG(overall_score) FROM academic_reports WHERE school_id = s.id AND term = (SELECT id FROM academic_terms WHERE is_current = true LIMIT 1)) as performance_score,
          (SELECT COUNT(*) FROM alerts WHERE school_id = s.id AND status = 'active' AND severity IN ('critical', 'high')) as alert_count,
          CASE WHEN s.id = u.current_school_id THEN true ELSE false END as is_current
        FROM schools s
        JOIN school_directors sd ON s.id = sd.school_id
        JOIN users u ON u.id = sd.director_id
        WHERE sd.director_id = $1 AND s.is_active = true
        ORDER BY is_current DESC, s.name
      `, [directorId]);

      const schoolsWithMetrics = schools.rows.map(school => ({
        id: school.id,
        name: school.name,
        type: school.school_type,
        logo: school.logo_url,
        curriculum: school.curriculum_types || [],
        location: {
          address: school.address,
          phone: school.phone,
          email: school.email,
          website: school.website
        },
        metrics: {
          students: parseInt(school.student_count),
          staff: parseInt(school.staff_count),
          monthlyRevenue: `KES ${(school.monthly_revenue / 1000).toFixed(0)}K`,
          performanceScore: parseInt(school.performance_score || 0),
          healthScore: MobileDirectorController.calculateHealthScore(school)
        },
        alerts: parseInt(school.alert_count),
        isCurrent: school.is_current,
        establishedDate: school.created_at
      }));

      res.json({
        success: true,
        data: {
          schools: schoolsWithMetrics,
          totalSchools: schoolsWithMetrics.length
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // =============================================================================
  // APPROVALS MANAGEMENT
  // =============================================================================

  // Get pending approvals
  static async getPendingApprovals(req, res, next) {
    try {
      const directorId = req.user.userId;
      const { 
        category, 
        schoolId, 
        priority, 
        page = 1, 
        limit = 20 
      } = req.query;

      let whereClause = 'WHERE sd.director_id = $1 AND ar.status = $2 AND ar.requires_director_approval = true';
      const params = [directorId, 'pending'];
      let paramIndex = 3;

      if (category) {
        whereClause += ` AND ar.approval_type = $${paramIndex}`;
        params.push(category);
        paramIndex++;
      }

      if (schoolId) {
        whereClause += ` AND ar.school_id = $${paramIndex}`;
        params.push(schoolId);
        paramIndex++;
      }

      if (priority) {
        whereClause += ` AND ar.priority = $${paramIndex}`;
        params.push(priority);
        paramIndex++;
      }

      const offset = (page - 1) * limit;

      const [approvals, summary] = await Promise.all([
        // Get approval requests
        query(`
          SELECT 
            ar.*,
            s.name as school_name,
            u.first_name,
            u.last_name,
            u.email,
            u.photo_url,
            u.role as requester_role
          FROM approval_requests ar
          JOIN schools s ON ar.school_id = s.id
          JOIN school_directors sd ON s.id = sd.school_id
          JOIN users u ON ar.requested_by = u.id
          ${whereClause}
          ORDER BY 
            CASE ar.priority 
              WHEN 'critical' THEN 1 
              WHEN 'high' THEN 2 
              WHEN 'medium' THEN 3 
              ELSE 4 
            END,
            ar.created_at DESC
          LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `, [...params, limit, offset]),

        // Get summary statistics
        query(`
          SELECT 
            COUNT(*) as total,
            COUNT(CASE WHEN ar.priority = 'critical' THEN 1 END) as critical,
            COUNT(CASE WHEN ar.priority = 'high' THEN 1 END) as high,
            COUNT(CASE WHEN ar.priority = 'medium' THEN 1 END) as medium,
            COUNT(CASE WHEN ar.priority = 'low' THEN 1 END) as low,
            COALESCE(SUM(ar.amount), 0) as total_value
          FROM approval_requests ar
          JOIN schools s ON ar.school_id = s.id
          JOIN school_directors sd ON s.id = sd.school_id
          WHERE sd.director_id = $1 AND ar.status = $2 AND ar.requires_director_approval = true
        `, [directorId, 'pending'])
      ]);

      const formattedApprovals = approvals.rows.map(approval => ({
        id: approval.id,
        type: approval.approval_type,
        priority: approval.priority,
        schoolName: approval.school_name,
        title: approval.title,
        description: approval.description,
        requestedBy: {
          name: `${approval.first_name} ${approval.last_name}`,
          role: approval.requester_role,
          photo: approval.photo_url,
          email: approval.email
        },
        amount: approval.amount,
        currency: 'KES',
        documents: approval.documents ? JSON.parse(approval.documents) : [],
        timeline: {
          requested: approval.created_at,
          dueDate: approval.due_date,
          daysRemaining: approval.due_date ? Math.ceil((new Date(approval.due_date) - new Date()) / (1000 * 60 * 60 * 24)) : null
        },
        metadata: approval.metadata ? JSON.parse(approval.metadata) : {},
        impactAnalysis: approval.impact_analysis ? JSON.parse(approval.impact_analysis) : {}
      }));

      res.json({
        success: true,
        data: {
          approvals: formattedApprovals,
          summary: {
            total: parseInt(summary.rows[0].total),
            byPriority: {
              critical: parseInt(summary.rows[0].critical),
              high: parseInt(summary.rows[0].high),
              medium: parseInt(summary.rows[0].medium),
              low: parseInt(summary.rows[0].low)
            },
            totalValue: `KES ${(summary.rows[0].total_value / 1000).toFixed(0)}K`
          },
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: parseInt(summary.rows[0].total)
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Approve request
  static async approveRequest(req, res, next) {
    try {
      const { id } = req.params;
      const { comments, conditions = [] } = req.body;
      const directorId = req.user.userId;

      // Verify approval exists and director has authority
      const approval = await query(`
        SELECT ar.*, s.name as school_name
        FROM approval_requests ar
        JOIN schools s ON ar.school_id = s.id
        JOIN school_directors sd ON s.id = sd.school_id
        WHERE ar.id = $1 AND sd.director_id = $2 AND ar.status = 'pending'
      `, [id, directorId]);

      if (approval.rows.length === 0) {
        throw new NotFoundError('Approval request not found or you do not have authority');
      }

      // Update approval status
      await query(`
        UPDATE approval_requests 
        SET status = 'approved',
            approved_by = $1,
            approved_at = CURRENT_TIMESTAMP,
            approval_comments = $2,
            approval_conditions = $3,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $4
      `, [directorId, comments, JSON.stringify(conditions), id]);

      // Log approval action
      await query(`
        INSERT INTO approval_logs (
          approval_id, action, performed_by, comments, created_at
        ) VALUES ($1, 'approved', $2, $3, CURRENT_TIMESTAMP)
      `, [id, directorId, comments]);

      res.json({
        success: true,
        message: 'Request approved successfully',
        data: {
          approvalId: id,
          status: 'approved',
          approvedAt: new Date().toISOString(),
          comments
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Reject request
  static async rejectRequest(req, res, next) {
    try {
      const { id } = req.params;
      const { reason, suggestions = [] } = req.body;
      const directorId = req.user.userId;

      if (!reason) {
        throw new ValidationError('Rejection reason is required');
      }

      // Verify approval exists and director has authority
      const approval = await query(`
        SELECT ar.*, s.name as school_name
        FROM approval_requests ar
        JOIN schools s ON ar.school_id = s.id
        JOIN school_directors sd ON s.id = sd.school_id
        WHERE ar.id = $1 AND sd.director_id = $2 AND ar.status = 'pending'
      `, [id, directorId]);

      if (approval.rows.length === 0) {
        throw new NotFoundError('Approval request not found or you do not have authority');
      }

      // Update approval status
      await query(`
        UPDATE approval_requests 
        SET status = 'rejected',
            approved_by = $1,
            approved_at = CURRENT_TIMESTAMP,
            approval_comments = $2,
            rejection_suggestions = $3,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $4
      `, [directorId, reason, JSON.stringify(suggestions), id]);

      // Log rejection action
      await query(`
        INSERT INTO approval_logs (
          approval_id, action, performed_by, comments, created_at
        ) VALUES ($1, 'rejected', $2, $3, CURRENT_TIMESTAMP)
      `, [id, directorId, reason]);

      res.json({
        success: true,
        message: 'Request rejected successfully',
        data: {
          approvalId: id,
          status: 'rejected',
          rejectedAt: new Date().toISOString(),
          reason
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // =============================================================================
  // MULTI-SCHOOL ANALYTICS
  // =============================================================================

  // Get portfolio analytics
  static async getPortfolioAnalytics(req, res, next) {
    try {
      const directorId = req.user.userId;
      const { period = 'month' } = req.query;

      const timeInterval = period === 'week' ? '7 days' : 
                          period === 'month' ? '30 days' : 
                          period === 'term' ? '90 days' : '30 days';

      const [portfolioMetrics, schoolComparison, financialTrends, alerts] = await Promise.all([
        // Overall portfolio metrics
        query(`
          SELECT 
            COUNT(DISTINCT s.id) as total_schools,
            SUM((SELECT COUNT(*) FROM students WHERE school_id = s.id AND is_active = true)) as total_students,
            SUM((SELECT COUNT(*) FROM users WHERE school_id = s.id AND user_type = 'staff' AND is_active = true)) as total_staff,
            SUM((SELECT COALESCE(SUM(amount), 0) FROM payments WHERE school_id = s.id AND created_at >= CURRENT_DATE - INTERVAL '${timeInterval}')) as total_revenue,
            AVG((SELECT AVG(overall_score) FROM academic_reports WHERE school_id = s.id AND created_at >= CURRENT_DATE - INTERVAL '${timeInterval}')) as avg_performance
          FROM schools s
          JOIN school_directors sd ON s.id = sd.school_id
          WHERE sd.director_id = $1 AND s.is_active = true
        `, [directorId]),

        // School comparison
        query(`
          SELECT 
            s.id,
            s.name,
            (SELECT AVG(overall_score) FROM academic_reports WHERE school_id = s.id AND created_at >= CURRENT_DATE - INTERVAL '${timeInterval}') as academic_performance,
            (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE school_id = s.id AND created_at >= CURRENT_DATE - INTERVAL '${timeInterval}') as revenue,
            (SELECT COUNT(*) FROM students WHERE school_id = s.id AND is_active = true) as student_count,
            (SELECT COUNT(*) FROM users WHERE school_id = s.id AND user_type = 'staff' AND is_active = true) as staff_count
          FROM schools s
          JOIN school_directors sd ON s.id = sd.school_id
          WHERE sd.director_id = $1 AND s.is_active = true
          ORDER BY revenue DESC
        `, [directorId]),

        // Financial trends
        query(`
          SELECT 
            DATE_TRUNC('week', p.created_at) as week,
            SUM(p.amount) as revenue,
            COUNT(DISTINCT p.school_id) as schools_with_payments
          FROM payments p
          JOIN schools s ON p.school_id = s.id
          JOIN school_directors sd ON s.id = sd.school_id
          WHERE sd.director_id = $1 
            AND p.created_at >= CURRENT_DATE - INTERVAL '${timeInterval}'
          GROUP BY DATE_TRUNC('week', p.created_at)
          ORDER BY week
        `, [directorId]),

        // Portfolio alerts and opportunities
        query(`
          SELECT 
            'opportunity' as type,
            s.name as school_name,
            'Growth potential identified' as message,
            (SELECT COUNT(*) FROM students WHERE school_id = s.id AND created_at >= CURRENT_DATE - INTERVAL '30 days') as new_students
          FROM schools s
          JOIN school_directors sd ON s.id = sd.school_id
          WHERE sd.director_id = $1 
            AND (SELECT COUNT(*) FROM students WHERE school_id = s.id AND created_at >= CURRENT_DATE - INTERVAL '30 days') > 10
          ORDER BY new_students DESC
          LIMIT 3
        `, [directorId])
      ]);

      const metrics = portfolioMetrics.rows[0];
      
      res.json({
        success: true,
        data: {
          portfolioMetrics: {
            totalStudents: parseInt(metrics.total_students),
            totalStaff: parseInt(metrics.total_staff),
            totalRevenue: `KES ${(metrics.total_revenue / 1000000).toFixed(1)}M`,
            averagePerformance: parseFloat(metrics.avg_performance || 0).toFixed(1),
            totalSchools: parseInt(metrics.total_schools)
          },
          schoolComparison: schoolComparison.rows.map(school => ({
            schoolName: school.name,
            metrics: {
              academicPerformance: parseInt(school.academic_performance || 0),
              revenue: parseInt(school.revenue),
              students: parseInt(school.student_count),
              staff: parseInt(school.staff_count),
              revenuePerStudent: Math.round(school.revenue / school.student_count)
            },
            trend: school.revenue > (metrics.total_revenue / metrics.total_schools) ? 'above_average' : 'below_average'
          })),
          financialTrends: {
            weekly: financialTrends.rows.map(trend => ({
              week: trend.week,
              revenue: parseInt(trend.revenue),
              schoolsActive: parseInt(trend.schools_with_payments)
            })),
            totalGrowth: financialTrends.rows.length > 1 ? 
              ((financialTrends.rows[financialTrends.rows.length - 1].revenue - financialTrends.rows[0].revenue) / financialTrends.rows[0].revenue * 100).toFixed(1) + '%' : '0%'
          },
          alerts: alerts.rows
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Get individual school analytics
  static async getSchoolAnalytics(req, res, next) {
    try {
      const { schoolId } = req.params;
      const { period = 'month' } = req.query;
      const directorId = req.user.userId;

      // Verify director has access to this school
      const schoolAccess = await query(`
        SELECT s.name
        FROM schools s
        JOIN school_directors sd ON s.id = sd.school_id
        WHERE sd.director_id = $1 AND s.id = $2 AND s.is_active = true
      `, [directorId, schoolId]);

      if (schoolAccess.rows.length === 0) {
        throw new ValidationError('You do not have access to this school');
      }

      const timeInterval = period === 'week' ? '7 days' : 
                          period === 'month' ? '30 days' : 
                          period === 'term' ? '90 days' : '30 days';

      const [academic, financial, operational, trends] = await Promise.all([
        // Academic metrics
        query(`
          SELECT 
            AVG(overall_score) as average_performance,
            COUNT(CASE WHEN overall_score >= 80 THEN 1 END) as top_performers,
            COUNT(CASE WHEN overall_score < 50 THEN 1 END) as needing_support,
            COUNT(*) as total_assessed
          FROM academic_reports
          WHERE school_id = $1 AND created_at >= CURRENT_DATE - INTERVAL '${timeInterval}'
        `, [schoolId]),

        // Financial metrics
        query(`
          SELECT 
            COALESCE(SUM(amount), 0) as revenue,
            COUNT(*) as transaction_count,
            (SELECT COALESCE(SUM(amount), 0) FROM fee_invoices WHERE school_id = $1 AND status = 'unpaid') as outstanding
          FROM payments
          WHERE school_id = $1 AND created_at >= CURRENT_DATE - INTERVAL '${timeInterval}'
        `, [schoolId]),

        // Operational metrics
        query(`
          SELECT 
            (SELECT AVG(attendance_percentage) FROM daily_attendance WHERE school_id = $1 AND date >= CURRENT_DATE - INTERVAL '${timeInterval}' AND attendance_type = 'staff') as staff_attendance,
            (SELECT AVG(attendance_percentage) FROM daily_attendance WHERE school_id = $1 AND date >= CURRENT_DATE - INTERVAL '${timeInterval}' AND attendance_type = 'student') as student_attendance,
            (SELECT COUNT(*) FROM users WHERE school_id = $1 AND user_type = 'staff' AND is_active = true) as total_staff,
            (SELECT COUNT(*) FROM students WHERE school_id = $1 AND is_active = true) as total_students
        `, [schoolId]),

        // Performance trends
        query(`
          SELECT 
            DATE_TRUNC('week', created_at) as week,
            AVG(overall_score) as performance,
            (SELECT SUM(amount) FROM payments WHERE school_id = $1 AND DATE_TRUNC('week', created_at) = DATE_TRUNC('week', ar.created_at)) as revenue,
            (SELECT COUNT(*) FROM students WHERE school_id = $1 AND DATE_TRUNC('week', created_at) = DATE_TRUNC('week', ar.created_at)) as enrollment
          FROM academic_reports ar
          WHERE school_id = $1 AND created_at >= CURRENT_DATE - INTERVAL '${timeInterval}'
          GROUP BY DATE_TRUNC('week', created_at)
          ORDER BY week
        `, [schoolId])
      ]);

      const academicData = academic.rows[0];
      const financialData = financial.rows[0];
      const operationalData = operational.rows[0];

      res.json({
        success: true,
        data: {
          schoolName: schoolAccess.rows[0].name,
          period,
          academic: {
            averagePerformance: parseFloat(academicData.average_performance || 0).toFixed(1),
            topPerformers: parseInt(academicData.top_performers),
            needingSupport: parseInt(academicData.needing_support),
            totalAssessed: parseInt(academicData.total_assessed),
            passRate: academicData.total_assessed > 0 ? 
              ((academicData.total_assessed - academicData.needing_support) / academicData.total_assessed * 100).toFixed(1) + '%' : '0%'
          },
          financial: {
            revenue: `KES ${(financialData.revenue / 1000).toFixed(0)}K`,
            transactions: parseInt(financialData.transaction_count),
            outstanding: `KES ${(financialData.outstanding / 1000).toFixed(0)}K`,
            collectionRate: financialData.revenue > 0 ? 
              (financialData.revenue / (financialData.revenue + financialData.outstanding) * 100).toFixed(1) + '%' : '0%'
          },
          operational: {
            staffAttendance: parseFloat(operationalData.staff_attendance || 0).toFixed(1),
            studentAttendance: parseFloat(operationalData.student_attendance || 0).toFixed(1),
            teacherStudentRatio: `1:${Math.round(operationalData.total_students / operationalData.total_staff)}`,
            totalStaff: parseInt(operationalData.total_staff),
            totalStudents: parseInt(operationalData.total_students)
          },
          trends: {
            labels: trends.rows.map(t => t.week),
            performance: trends.rows.map(t => parseFloat(t.performance || 0)),
            revenue: trends.rows.map(t => parseInt(t.revenue || 0)),
            enrollment: trends.rows.map(t => parseInt(t.enrollment || 0))
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // =============================================================================
  // HELPER METHODS
  // =============================================================================

  // Calculate school health score
  static calculateHealthScore(school) {
    const metrics = {
      academic: school.performance_score || 0,
      financial: school.monthly_revenue > 1000000 ? 100 : (school.monthly_revenue / 1000000) * 100,
      operational: school.staff_count > 0 && school.student_count > 0 ? 
        Math.min(100, (school.student_count / school.staff_count) * 4) : 0,
      alerts: Math.max(0, 100 - (school.alert_count * 10))
    };

    const average = (metrics.academic + metrics.financial + metrics.operational + metrics.alerts) / 4;

    if (average >= 85) return 'Excellent';
    if (average >= 70) return 'Good';
    if (average >= 55) return 'Fair';
    return 'Needs Attention';
  }
}

module.exports = MobileDirectorController;