const express = require('express');
const router = express.Router();
const { authenticate, requireRole, requireUserType } = require('../../middleware/auth');
const ComplianceController = require('../../controllers/admin/complianceController');

// Apply admin authentication to all routes
router.use(authenticate);
router.use(requireUserType('platform_admin'));

// =============================================================================
// COMPLIANCE DASHBOARD ROUTES
// =============================================================================

/**
 * @route   GET /api/admin/compliance/dashboard
 * @desc    Get compliance dashboard overview
 * @access  Private (Platform Admin)
 */
router.get('/dashboard',
  requireRole(['super_admin', 'compliance_admin', 'regional_admin']),
  ComplianceController.getComplianceDashboard
);

/**
 * @route   GET /api/admin/compliance/summary
 * @desc    Get compliance summary statistics
 * @access  Private (Platform Admin)
 */
router.get('/summary',
  requireRole(['super_admin', 'compliance_admin', 'regional_admin']),
  async (req, res, next) => {
    try {
      const { period = '30d', region } = req.query;
      const { query } = require('../../config/database');

      const timeInterval = period === '7d' ? '7 days' : 
                          period === '30d' ? '30 days' : 
                          period === '90d' ? '90 days' : '30 days';

      const [complianceOverview, riskAssessment, upcomingDeadlines] = await Promise.all([
        // Overall compliance metrics
        query(`
          SELECT 
            'overall' as metric_type,
            COUNT(DISTINCT school_id) as schools_assessed,
            AVG(compliance_score) as avg_compliance_score,
            COUNT(*) as total_assessments,
            COUNT(CASE WHEN status = 'compliant' THEN 1 END) as compliant_count
          FROM compliance_assessments
          WHERE assessed_at >= CURRENT_TIMESTAMP - INTERVAL '${timeInterval}'
        `),

        // Risk assessment
        query(`
          SELECT 
            severity,
            COUNT(*) as violation_count,
            COUNT(CASE WHEN status = 'open' THEN 1 END) as open_violations
          FROM compliance_violations
          WHERE identified_at >= CURRENT_TIMESTAMP - INTERVAL '${timeInterval}'
          GROUP BY severity
          ORDER BY 
            CASE severity 
              WHEN 'critical' THEN 1 
              WHEN 'high' THEN 2 
              WHEN 'medium' THEN 3 
              WHEN 'low' THEN 4 
            END
        `),

        // Upcoming compliance deadlines
        query(`
          SELECT 
            ca.action_type,
            ca.description,
            ca.due_date,
            ca.priority,
            s.name as school_name,
            COUNT(*) as action_count
          FROM compliance_actions ca
          JOIN schools s ON ca.school_id = s.id
          WHERE ca.status = 'pending'
            AND ca.due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
          GROUP BY ca.action_type, ca.description, ca.due_date, ca.priority, s.name
          ORDER BY ca.due_date ASC
          LIMIT 10
        `)
      ]);

      res.json({
        success: true,
        data: {
          period,
          overview: complianceOverview.rows[0],
          riskProfile: riskAssessment.rows,
          upcomingDeadlines: upcomingDeadlines.rows
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// =============================================================================
// COMPLIANCE REGULATIONS ROUTES
// =============================================================================

/**
 * @route   GET /api/admin/compliance/regulations
 * @desc    Get compliance regulations
 * @access  Private (Platform Admin)
 */
router.get('/regulations',
  requireRole(['super_admin', 'compliance_admin', 'regional_admin']),
  ComplianceController.getComplianceRegulations
);

/**
 * @route   POST /api/admin/compliance/regulations
 * @desc    Create compliance regulation
 * @access  Private (Super Admin, Compliance Admin)
 */
router.post('/regulations',
  requireRole(['super_admin', 'compliance_admin']),
  ComplianceController.createComplianceRegulation
);

/**
 * @route   GET /api/admin/compliance/regulations/:id
 * @desc    Get specific regulation details
 * @access  Private (Platform Admin)
 */
router.get('/regulations/:id',
  requireRole(['super_admin', 'compliance_admin', 'regional_admin']),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { query } = require('../../config/database');

      const [regulation, assessments, violations] = await Promise.all([
        // Regulation details
        query(`
          SELECT * FROM compliance_regulations WHERE id = $1
        `, [id]),

        // Recent assessments for this regulation
        query(`
          SELECT 
            ca.*,
            s.name as school_name
          FROM compliance_assessments ca
          JOIN schools s ON ca.school_id = s.id
          WHERE ca.regulation_id = $1
          ORDER BY ca.assessed_at DESC
          LIMIT 10
        `, [id]),

        // Violations related to this regulation
        query(`
          SELECT 
            cv.*,
            s.name as school_name
          FROM compliance_violations cv
          JOIN schools s ON cv.school_id = s.id
          WHERE cv.regulation_id = $1
          ORDER BY cv.identified_at DESC
          LIMIT 10
        `, [id])
      ]);

      if (regulation.rows.length === 0) {
        throw new NotFoundError('Compliance regulation not found');
      }

      res.json({
        success: true,
        data: {
          ...regulation.rows[0],
          requirements: JSON.parse(regulation.rows[0].requirements || '[]'),
          compliance_criteria: JSON.parse(regulation.rows[0].compliance_criteria || '{}'),
          recent_assessments: assessments.rows.map(assessment => ({
            ...assessment,
            assessment_results: JSON.parse(assessment.assessment_results || '{}')
          })),
          recent_violations: violations.rows.map(violation => ({
            ...violation,
            violation_details: JSON.parse(violation.violation_details || '{}')
          }))
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   PUT /api/admin/compliance/regulations/:id
 * @desc    Update compliance regulation
 * @access  Private (Super Admin, Compliance Admin)
 */
router.put('/regulations/:id',
  requireRole(['super_admin', 'compliance_admin']),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const { query } = require('../../config/database');

      const allowedFields = [
        'regulation_title', 'description', 'requirements', 'compliance_criteria',
        'applicable_school_types', 'effective_date', 'expiry_date', 'authority_name',
        'reference_url', 'is_active'
      ];

      const setClause = [];
      const values = [];
      let paramIndex = 1;

      Object.keys(updates).forEach(key => {
        if (allowedFields.includes(key)) {
          if (['requirements', 'compliance_criteria'].includes(key)) {
            setClause.push(`${key} = $${paramIndex}`);
            values.push(JSON.stringify(updates[key]));
          } else {
            setClause.push(`${key} = $${paramIndex}`);
            values.push(updates[key]);
          }
          paramIndex++;
        }
      });

      if (setClause.length === 0) {
        throw new ValidationError('No valid fields provided for update');
      }

      setClause.push(`updated_at = CURRENT_TIMESTAMP`);
      setClause.push(`updated_by = $${paramIndex}`);
      setClause.push(`updated_by_name = $${paramIndex + 1}`);
      values.push(req.user.userId, `${req.user.firstName} ${req.user.lastName}`, id);

      const result = await query(`
        UPDATE compliance_regulations 
        SET ${setClause.join(', ')}
        WHERE id = $${paramIndex + 2}
        RETURNING *
      `, values);

      if (result.rows.length === 0) {
        throw new NotFoundError('Compliance regulation not found');
      }

      res.json({
        success: true,
        message: 'Compliance regulation updated successfully',
        data: {
          ...result.rows[0],
          requirements: JSON.parse(result.rows[0].requirements || '[]'),
          compliance_criteria: JSON.parse(result.rows[0].compliance_criteria || '{}')
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// =============================================================================
// COMPLIANCE ASSESSMENTS ROUTES
// =============================================================================

/**
 * @route   GET /api/admin/compliance/assessments
 * @desc    Get compliance assessments
 * @access  Private (Platform Admin)
 */
router.get('/assessments',
  requireRole(['super_admin', 'compliance_admin', 'regional_admin']),
  ComplianceController.getComplianceAssessments
);

/**
 * @route   POST /api/admin/compliance/assessments
 * @desc    Create compliance assessment
 * @access  Private (Super Admin, Compliance Admin)
 */
router.post('/assessments',
  requireRole(['super_admin', 'compliance_admin']),
  ComplianceController.createComplianceAssessment
);

/**
 * @route   GET /api/admin/compliance/assessments/:id
 * @desc    Get assessment details
 * @access  Private (Platform Admin)
 */
router.get('/assessments/:id',
  requireRole(['super_admin', 'compliance_admin', 'regional_admin']),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { query } = require('../../config/database');

      const result = await query(`
        SELECT 
          ca.*,
          s.name as school_name,
          s.school_type,
          cr.regulation_title,
          cr.category as regulation_category,
          cr.requirements
        FROM compliance_assessments ca
        JOIN schools s ON ca.school_id = s.id
        JOIN compliance_regulations cr ON ca.regulation_id = cr.id
        WHERE ca.id = $1
      `, [id]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Compliance assessment not found');
      }

      res.json({
        success: true,
        data: {
          ...result.rows[0],
          assessment_results: JSON.parse(result.rows[0].assessment_results || '{}'),
          recommendations: JSON.parse(result.rows[0].recommendations || '[]'),
          requirements: JSON.parse(result.rows[0].requirements || '[]')
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// =============================================================================
// COMPLIANCE VIOLATIONS ROUTES
// =============================================================================

/**
 * @route   GET /api/admin/compliance/violations
 * @desc    Get compliance violations
 * @access  Private (Platform Admin)
 */
router.get('/violations',
  requireRole(['super_admin', 'compliance_admin', 'regional_admin']),
  ComplianceController.getComplianceViolations
);

/**
 * @route   POST /api/admin/compliance/violations
 * @desc    Report compliance violation
 * @access  Private (Super Admin, Compliance Admin)
 */
router.post('/violations',
  requireRole(['super_admin', 'compliance_admin']),
  ComplianceController.reportComplianceViolation
);

/**
 * @route   PUT /api/admin/compliance/violations/:id/status
 * @desc    Update violation status
 * @access  Private (Super Admin, Compliance Admin)
 */
router.put('/violations/:id/status',
  requireRole(['super_admin', 'compliance_admin']),
  ComplianceController.updateViolationStatus
);

/**
 * @route   GET /api/admin/compliance/violations/:id
 * @desc    Get violation details
 * @access  Private (Platform Admin)
 */
router.get('/violations/:id',
  requireRole(['super_admin', 'compliance_admin', 'regional_admin']),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { query } = require('../../config/database');

      const [violation, actions] = await Promise.all([
        // Violation details
        query(`
          SELECT 
            cv.*,
            s.name as school_name,
            s.school_type,
            cr.regulation_title,
            cr.category as regulation_category
          FROM compliance_violations cv
          JOIN schools s ON cv.school_id = s.id
          JOIN compliance_regulations cr ON cv.regulation_id = cr.id
          WHERE cv.id = $1
        `, [id]),

        // Related compliance actions
        query(`
          SELECT * FROM compliance_actions 
          WHERE violation_id = $1 
          ORDER BY created_at DESC
        `, [id])
      ]);

      if (violation.rows.length === 0) {
        throw new NotFoundError('Compliance violation not found');
      }

      res.json({
        success: true,
        data: {
          ...violation.rows[0],
          violation_details: JSON.parse(violation.rows[0].violation_details || '{}'),
          remediation_plan: JSON.parse(violation.rows[0].remediation_plan || '{}'),
          related_actions: actions.rows
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// =============================================================================
// COMPLIANCE AUDITS ROUTES
// =============================================================================

/**
 * @route   GET /api/admin/compliance/audits
 * @desc    Get compliance audits
 * @access  Private (Platform Admin)
 */
router.get('/audits',
  requireRole(['super_admin', 'compliance_admin', 'regional_admin']),
  ComplianceController.getComplianceAudits
);

/**
 * @route   POST /api/admin/compliance/audits
 * @desc    Create compliance audit
 * @access  Private (Super Admin, Compliance Admin)
 */
router.post('/audits',
  requireRole(['super_admin', 'compliance_admin']),
  ComplianceController.createComplianceAudit
);

/**
 * @route   POST /api/admin/compliance/audits/:id/complete
 * @desc    Complete compliance audit
 * @access  Private (Super Admin, Compliance Admin)
 */
router.post('/audits/:id/complete',
  requireRole(['super_admin', 'compliance_admin']),
  ComplianceController.completeComplianceAudit
);

/**
 * @route   GET /api/admin/compliance/audits/:id
 * @desc    Get audit details
 * @access  Private (Platform Admin)
 */
router.get('/audits/:id',
  requireRole(['super_admin', 'compliance_admin', 'regional_admin']),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { query } = require('../../config/database');

      const result = await query(`
        SELECT 
          ca.*,
          s.name as school_name,
          s.school_type,
          auditor.first_name as auditor_first_name,
          auditor.last_name as auditor_last_name,
          auditor.email as auditor_email
        FROM compliance_audits ca
        JOIN schools s ON ca.school_id = s.id
        LEFT JOIN platform_admins auditor ON ca.auditor_id = auditor.id
        WHERE ca.id = $1
      `, [id]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Compliance audit not found');
      }

      res.json({
        success: true,
        data: {
          ...result.rows[0],
          audit_scope: JSON.parse(result.rows[0].audit_scope || '[]'),
          findings: JSON.parse(result.rows[0].findings || '[]'),
          recommendations: JSON.parse(result.rows[0].recommendations || '[]')
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// =============================================================================
// COMPLIANCE ACTIONS ROUTES
// =============================================================================

/**
 * @route   GET /api/admin/compliance/actions
 * @desc    Get compliance actions
 * @access  Private (Platform Admin)
 */
router.get('/actions',
  requireRole(['super_admin', 'compliance_admin', 'regional_admin']),
  ComplianceController.getComplianceActions
);

/**
 * @route   PUT /api/admin/compliance/actions/:id
 * @desc    Update compliance action
 * @access  Private (Super Admin, Compliance Admin)
 */
router.put('/actions/:id',
  requireRole(['super_admin', 'compliance_admin']),
  ComplianceController.updateComplianceAction
);

/**
 * @route   POST /api/admin/compliance/actions/bulk-update
 * @desc    Bulk update compliance actions
 * @access  Private (Super Admin, Compliance Admin)
 */
router.post('/actions/bulk-update',
  requireRole(['super_admin', 'compliance_admin']),
  async (req, res, next) => {
    try {
      const { actionIds, updates } = req.body;

      if (!actionIds || !Array.isArray(actionIds) || actionIds.length === 0) {
        throw new ValidationError('Action IDs array is required');
      }

      if (!updates || Object.keys(updates).length === 0) {
        throw new ValidationError('Updates object is required');
      }

      const results = [];
      const errors = [];

      for (const actionId of actionIds) {
        try {
          req.params.id = actionId;
          req.body = updates;

          const mockRes = {
            json: (data) => {
              results.push({ actionId, success: true, data: data.data });
            }
          };

          await ComplianceController.updateComplianceAction(req, mockRes, (error) => {
            if (error) throw error;
          });
        } catch (error) {
          errors.push({ actionId, error: error.message });
        }
      }

      res.json({
        success: true,
        message: `Bulk update completed. ${results.length} actions updated, ${errors.length} errors`,
        data: {
          updated: results,
          errors: errors,
          summary: {
            total: actionIds.length,
            successful: results.length,
            failed: errors.length
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// =============================================================================
// COMPLIANCE REPORTS ROUTES
// =============================================================================

/**
 * @route   POST /api/admin/compliance/reports/generate
 * @desc    Generate compliance report
 * @access  Private (Super Admin, Compliance Admin)
 */
router.post('/reports/generate',
  requireRole(['super_admin', 'compliance_admin']),
  ComplianceController.generateComplianceReport
);

/**
 * @route   GET /api/admin/compliance/reports
 * @desc    Get compliance reports
 * @access  Private (Platform Admin)
 */
router.get('/reports',
  requireRole(['super_admin', 'compliance_admin', 'regional_admin']),
  async (req, res, next) => {
    try {
      const { reportType, status, limit = 20, offset = 0 } = req.query;
      const { query } = require('../../config/database');

      let whereClause = 'WHERE 1=1';
      const params = [];

      if (reportType) {
        whereClause += ` AND report_type = $${params.length + 1}`;
        params.push(reportType);
      }

      if (status) {
        whereClause += ` AND status = $${params.length + 1}`;
        params.push(status);
      }

      const result = await query(`
        SELECT 
          id, report_type, status, generated_at, generated_by_name,
          -- Don't return large report_data in list view
          CASE WHEN report_data IS NOT NULL THEN 'Available' ELSE 'Not Available' END as data_status
        FROM compliance_reports
        ${whereClause}
        ORDER BY generated_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `, [...params, limit, offset]);

      res.json({
        success: true,
        data: result.rows,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: result.rows.length
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/admin/compliance/reports/:id
 * @desc    Get compliance report details
 * @access  Private (Platform Admin)
 */
router.get('/reports/:id',
  requireRole(['super_admin', 'compliance_admin', 'regional_admin']),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { query } = require('../../config/database');

      const result = await query(`
        SELECT * FROM compliance_reports WHERE id = $1
      `, [id]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Compliance report not found');
      }

      res.json({
        success: true,
        data: {
          ...result.rows[0],
          parameters: JSON.parse(result.rows[0].parameters || '{}'),
          report_data: JSON.parse(result.rows[0].report_data || '{}')
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// =============================================================================
// COMPLIANCE ANALYTICS ROUTES
// =============================================================================

/**
 * @route   GET /api/admin/compliance/analytics/trends
 * @desc    Get compliance trends analytics
 * @access  Private (Platform Admin)
 */
router.get('/analytics/trends',
  requireRole(['super_admin', 'compliance_admin', 'regional_admin']),
  async (req, res, next) => {
    try {
      const { period = '6m', category } = req.query;
      const { query } = require('../../config/database');

      const timeInterval = period === '3m' ? '3 months' : 
                          period === '6m' ? '6 months' : 
                          period === '1y' ? '1 year' : '6 months';

      let categoryFilter = '';
      const params = [];

      if (category) {
        categoryFilter = ' AND cr.category = $1';
        params.push(category);
      }

      const [complianceTrends, violationTrends, auditTrends] = await Promise.all([
        // Compliance score trends
        query(`
          SELECT 
            DATE_TRUNC('month', ca.assessed_at) as month,
            cr.category,
            AVG(ca.compliance_score) as avg_score,
            COUNT(*) as assessment_count
          FROM compliance_assessments ca
          JOIN compliance_regulations cr ON ca.regulation_id = cr.id
          WHERE ca.assessed_at >= CURRENT_TIMESTAMP - INTERVAL '${timeInterval}' ${categoryFilter}
          GROUP BY DATE_TRUNC('month', ca.assessed_at), cr.category
          ORDER BY month, cr.category
        `, params),

        // Violation trends
        query(`
          SELECT 
            DATE_TRUNC('month', cv.identified_at) as month,
            cv.severity,
            COUNT(*) as violation_count
          FROM compliance_violations cv
          JOIN compliance_regulations cr ON cv.regulation_id = cr.id
          WHERE cv.identified_at >= CURRENT_TIMESTAMP - INTERVAL '${timeInterval}' ${categoryFilter}
          GROUP BY DATE_TRUNC('month', cv.identified_at), cv.severity
          ORDER BY month, cv.severity
        `, params),

        // Audit completion trends
        query(`
          SELECT 
            DATE_TRUNC('month', completed_at) as month,
            COUNT(*) as completed_audits,
            AVG(overall_score) as avg_audit_score
          FROM compliance_audits
          WHERE completed_at >= CURRENT_TIMESTAMP - INTERVAL '${timeInterval}'
            AND status = 'completed'
          GROUP BY DATE_TRUNC('month', completed_at)
          ORDER BY month
        `)
      ]);

      res.json({
        success: true,
        data: {
          period,
          category,
          complianceTrends: complianceTrends.rows,
          violationTrends: violationTrends.rows,
          auditTrends: auditTrends.rows
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/admin/compliance/analytics/schools
 * @desc    Get school compliance analytics
 * @access  Private (Platform Admin)
 */
router.get('/analytics/schools',
  requireRole(['super_admin', 'compliance_admin', 'regional_admin']),
  async (req, res, next) => {
    try {
      const { limit = 20, sortBy = 'score', order = 'desc' } = req.query;
      const { query } = require('../../config/database');

      const orderDirection = order === 'asc' ? 'ASC' : 'DESC';
      const sortColumn = sortBy === 'violations' ? 'violation_count' : 
                        sortBy === 'audits' ? 'audit_count' : 'avg_compliance_score';

      const result = await query(`
        SELECT 
          s.id,
          s.name as school_name,
          s.school_type,
          AVG(ca.compliance_score) as avg_compliance_score,
          COUNT(DISTINCT ca.id) as assessment_count,
          COUNT(DISTINCT cv.id) as violation_count,
          COUNT(DISTINCT cau.id) as audit_count,
          COUNT(DISTINCT CASE WHEN cv.status = 'open' THEN cv.id END) as open_violations
        FROM schools s
        LEFT JOIN compliance_assessments ca ON s.id = ca.school_id 
          AND ca.assessed_at >= CURRENT_TIMESTAMP - INTERVAL '90 days'
        LEFT JOIN compliance_violations cv ON s.id = cv.school_id
          AND cv.identified_at >= CURRENT_TIMESTAMP - INTERVAL '90 days'
        LEFT JOIN compliance_audits cau ON s.id = cau.school_id
          AND cau.created_at >= CURRENT_TIMESTAMP - INTERVAL '90 days'
        WHERE s.is_active = true
        GROUP BY s.id, s.name, s.school_type
        ORDER BY ${sortColumn} ${orderDirection}
        LIMIT $1
      `, [limit]);

      res.json({
        success: true,
        data: {
          schools: result.rows,
          sortBy,
          order,
          period: '90 days'
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;