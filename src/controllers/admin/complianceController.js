const { query } = require('../../config/database');
const { ValidationError, NotFoundError } = require('../../middleware/errorHandler');

class ComplianceController {
  // =============================================================================
  // COMPLIANCE OVERVIEW AND DASHBOARD
  // =============================================================================

  // Get compliance dashboard
  static async getComplianceDashboard(req, res, next) {
    try {
      const { schoolId, region, period = '30d' } = req.query;

      const timeInterval = period === '7d' ? '7 days' : 
                          period === '30d' ? '30 days' : 
                          period === '90d' ? '90 days' : '30 days';

      let schoolFilter = '';
      let regionFilter = '';
      const params = [];

      if (schoolId) {
        schoolFilter = ' AND school_id = $1';
        params.push(schoolId);
      }

      if (region) {
        regionFilter = ' AND region_id = $' + (params.length + 1);
        params.push(region);
      }

      const [
        overallCompliance,
        complianceByCategory,
        recentViolations,
        auditSummary,
        pendingActions
      ] = await Promise.all([
        // Overall compliance score
        query(`
          SELECT 
            AVG(compliance_score) as overall_score,
            COUNT(*) as total_checks,
            COUNT(CASE WHEN status = 'compliant' THEN 1 END) as compliant_count,
            COUNT(CASE WHEN status = 'non_compliant' THEN 1 END) as non_compliant_count,
            COUNT(CASE WHEN status = 'partial' THEN 1 END) as partial_count
          FROM compliance_assessments
          WHERE assessed_at >= CURRENT_TIMESTAMP - INTERVAL '${timeInterval}' ${schoolFilter}
        `, params.slice(0, schoolId ? 1 : 0)),

        // Compliance by category
        query(`
          SELECT 
            category,
            AVG(compliance_score) as avg_score,
            COUNT(*) as assessment_count,
            COUNT(CASE WHEN status = 'compliant' THEN 1 END) as compliant_count
          FROM compliance_assessments
          WHERE assessed_at >= CURRENT_TIMESTAMP - INTERVAL '${timeInterval}' ${schoolFilter}
          GROUP BY category
          ORDER BY avg_score DESC
        `, params.slice(0, schoolId ? 1 : 0)),

        // Recent violations
        query(`
          SELECT 
            cv.*,
            s.name as school_name,
            cr.regulation_title
          FROM compliance_violations cv
          JOIN schools s ON cv.school_id = s.id
          JOIN compliance_regulations cr ON cv.regulation_id = cr.id
          WHERE cv.identified_at >= CURRENT_TIMESTAMP - INTERVAL '${timeInterval}'
            ${schoolFilter.replace('school_id', 'cv.school_id')}
          ORDER BY cv.severity DESC, cv.identified_at DESC
          LIMIT 10
        `, params.slice(0, schoolId ? 1 : 0)),

        // Audit summary
        query(`
          SELECT 
            COUNT(*) as total_audits,
            COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_audits,
            COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as ongoing_audits,
            AVG(CASE WHEN overall_score IS NOT NULL THEN overall_score END) as avg_audit_score
          FROM compliance_audits
          WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '${timeInterval}' ${schoolFilter}
        `, params.slice(0, schoolId ? 1 : 0)),

        // Pending compliance actions
        query(`
          SELECT 
            action_type,
            COUNT(*) as action_count,
            COUNT(CASE WHEN priority = 'high' THEN 1 END) as high_priority_count
          FROM compliance_actions
          WHERE status = 'pending' ${schoolFilter}
          GROUP BY action_type
          ORDER BY high_priority_count DESC
        `, params.slice(0, schoolId ? 1 : 0))
      ]);

      res.json({
        success: true,
        data: {
          period,
          overview: overallCompliance.rows[0],
          byCategory: complianceByCategory.rows,
          recentViolations: recentViolations.rows,
          auditSummary: auditSummary.rows[0],
          pendingActions: pendingActions.rows
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // =============================================================================
  // COMPLIANCE REGULATIONS MANAGEMENT
  // =============================================================================

  // Get compliance regulations
  static async getComplianceRegulations(req, res, next) {
    try {
      const { 
        category, 
        jurisdiction, 
        isActive,
        applicableSchoolTypes,
        limit = 20, 
        offset = 0 
      } = req.query;

      let whereClause = 'WHERE 1=1';
      const params = [];

      if (category) {
        whereClause += ` AND category = $${params.length + 1}`;
        params.push(category);
      }

      if (jurisdiction) {
        whereClause += ` AND jurisdiction = $${params.length + 1}`;
        params.push(jurisdiction);
      }

      if (isActive !== undefined) {
        whereClause += ` AND is_active = $${params.length + 1}`;
        params.push(isActive === 'true');
      }

      if (applicableSchoolTypes) {
        whereClause += ` AND $${params.length + 1} = ANY(applicable_school_types)`;
        params.push(applicableSchoolTypes);
      }

      const result = await query(`
        SELECT 
          cr.*,
          COUNT(DISTINCT ca.id) as assessment_count,
          COUNT(DISTINCT cv.id) as violation_count
        FROM compliance_regulations cr
        LEFT JOIN compliance_assessments ca ON cr.id = ca.regulation_id
        LEFT JOIN compliance_violations cv ON cr.id = cv.regulation_id
        ${whereClause}
        GROUP BY cr.id
        ORDER BY cr.regulation_title
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `, [...params, limit, offset]);

      const regulations = result.rows.map(regulation => ({
        ...regulation,
        requirements: JSON.parse(regulation.requirements || '[]'),
        compliance_criteria: JSON.parse(regulation.compliance_criteria || '{}'),
        applicable_school_types: regulation.applicable_school_types || []
      }));

      res.json({
        success: true,
        data: regulations,
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

  // Create compliance regulation
  static async createComplianceRegulation(req, res, next) {
    try {
      const {
        regulationTitle,
        category,
        jurisdiction,
        description,
        requirements = [],
        complianceCriteria = {},
        applicableSchoolTypes = [],
        effectiveDate,
        expiryDate,
        authorityName,
        referenceUrl
      } = req.body;

      if (!regulationTitle || !category || !jurisdiction) {
        throw new ValidationError('Regulation title, category, and jurisdiction are required');
      }

      const result = await query(`
        INSERT INTO compliance_regulations (
          regulation_title, category, jurisdiction, description, requirements,
          compliance_criteria, applicable_school_types, effective_date, expiry_date,
          authority_name, reference_url, created_by, created_by_name
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *
      `, [
        regulationTitle, category, jurisdiction, description, JSON.stringify(requirements),
        JSON.stringify(complianceCriteria), applicableSchoolTypes, effectiveDate, expiryDate,
        authorityName, referenceUrl, req.user.userId, `${req.user.firstName} ${req.user.lastName}`
      ]);

      res.status(201).json({
        success: true,
        message: 'Compliance regulation created successfully',
        data: {
          ...result.rows[0],
          requirements: JSON.parse(result.rows[0].requirements),
          compliance_criteria: JSON.parse(result.rows[0].compliance_criteria)
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // =============================================================================
  // COMPLIANCE ASSESSMENTS
  // =============================================================================

  // Get compliance assessments
  static async getComplianceAssessments(req, res, next) {
    try {
      const { 
        schoolId, 
        regulationId, 
        status, 
        category,
        limit = 20, 
        offset = 0 
      } = req.query;

      let whereClause = 'WHERE 1=1';
      const params = [];

      if (schoolId) {
        whereClause += ` AND ca.school_id = $${params.length + 1}`;
        params.push(schoolId);
      }

      if (regulationId) {
        whereClause += ` AND ca.regulation_id = $${params.length + 1}`;
        params.push(regulationId);
      }

      if (status) {
        whereClause += ` AND ca.status = $${params.length + 1}`;
        params.push(status);
      }

      if (category) {
        whereClause += ` AND cr.category = $${params.length + 1}`;
        params.push(category);
      }

      const result = await query(`
        SELECT 
          ca.*,
          s.name as school_name,
          cr.regulation_title,
          cr.category as regulation_category
        FROM compliance_assessments ca
        JOIN schools s ON ca.school_id = s.id
        JOIN compliance_regulations cr ON ca.regulation_id = cr.id
        ${whereClause}
        ORDER BY ca.assessed_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `, [...params, limit, offset]);

      const assessments = result.rows.map(assessment => ({
        ...assessment,
        assessment_results: JSON.parse(assessment.assessment_results || '{}'),
        recommendations: JSON.parse(assessment.recommendations || '[]')
      }));

      res.json({
        success: true,
        data: assessments,
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

  // Create compliance assessment
  static async createComplianceAssessment(req, res, next) {
    try {
      const {
        schoolId,
        regulationId,
        assessmentResults = {},
        complianceScore,
        status,
        recommendations = [],
        nextAssessmentDate
      } = req.body;

      if (!schoolId || !regulationId || complianceScore === undefined) {
        throw new ValidationError('School ID, regulation ID, and compliance score are required');
      }

      if (complianceScore < 0 || complianceScore > 100) {
        throw new ValidationError('Compliance score must be between 0 and 100');
      }

      const result = await query(`
        INSERT INTO compliance_assessments (
          school_id, regulation_id, assessment_results, compliance_score,
          status, recommendations, next_assessment_date, assessed_by, assessed_by_name
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `, [
        schoolId, regulationId, JSON.stringify(assessmentResults), complianceScore,
        status, JSON.stringify(recommendations), nextAssessmentDate,
        req.user.userId, `${req.user.firstName} ${req.user.lastName}`
      ]);

      // Create compliance actions if non-compliant
      if (status === 'non_compliant' || status === 'partial') {
        await ComplianceController.createComplianceActions(
          result.rows[0].id, recommendations, req.user.userId
        );
      }

      res.status(201).json({
        success: true,
        message: 'Compliance assessment created successfully',
        data: {
          ...result.rows[0],
          assessment_results: JSON.parse(result.rows[0].assessment_results),
          recommendations: JSON.parse(result.rows[0].recommendations)
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // =============================================================================
  // COMPLIANCE VIOLATIONS
  // =============================================================================

  // Get compliance violations
  static async getComplianceViolations(req, res, next) {
    try {
      const { 
        schoolId, 
        regulationId, 
        severity, 
        status,
        limit = 20, 
        offset = 0 
      } = req.query;

      let whereClause = 'WHERE 1=1';
      const params = [];

      if (schoolId) {
        whereClause += ` AND cv.school_id = $${params.length + 1}`;
        params.push(schoolId);
      }

      if (regulationId) {
        whereClause += ` AND cv.regulation_id = $${params.length + 1}`;
        params.push(regulationId);
      }

      if (severity) {
        whereClause += ` AND cv.severity = $${params.length + 1}`;
        params.push(severity);
      }

      if (status) {
        whereClause += ` AND cv.status = $${params.length + 1}`;
        params.push(status);
      }

      const result = await query(`
        SELECT 
          cv.*,
          s.name as school_name,
          cr.regulation_title,
          cr.category as regulation_category
        FROM compliance_violations cv
        JOIN schools s ON cv.school_id = s.id
        JOIN compliance_regulations cr ON cv.regulation_id = cr.id
        ${whereClause}
        ORDER BY 
          CASE cv.severity 
            WHEN 'critical' THEN 1 
            WHEN 'high' THEN 2 
            WHEN 'medium' THEN 3 
            WHEN 'low' THEN 4 
          END, cv.identified_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `, [...params, limit, offset]);

      const violations = result.rows.map(violation => ({
        ...violation,
        violation_details: JSON.parse(violation.violation_details || '{}'),
        remediation_plan: JSON.parse(violation.remediation_plan || '{}')
      }));

      res.json({
        success: true,
        data: violations,
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

  // Report compliance violation
  static async reportComplianceViolation(req, res, next) {
    try {
      const {
        schoolId,
        regulationId,
        violationType,
        severity,
        description,
        violationDetails = {},
        remediationPlan = {},
        dueDate
      } = req.body;

      if (!schoolId || !regulationId || !violationType || !severity) {
        throw new ValidationError('School ID, regulation ID, violation type, and severity are required');
      }

      const result = await query(`
        INSERT INTO compliance_violations (
          school_id, regulation_id, violation_type, severity, description,
          violation_details, remediation_plan, due_date, status,
          reported_by, reported_by_name
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'open', $9, $10)
        RETURNING *
      `, [
        schoolId, regulationId, violationType, severity, description,
        JSON.stringify(violationDetails), JSON.stringify(remediationPlan), dueDate,
        req.user.userId, `${req.user.firstName} ${req.user.lastName}`
      ]);

      // Create compliance action for remediation
      await query(`
        INSERT INTO compliance_actions (
          school_id, violation_id, action_type, priority, description,
          due_date, status, assigned_to, created_by, created_by_name
        ) VALUES ($1, $2, 'remediation', $3, $4, $5, 'pending', $6, $7, $8)
      `, [
        schoolId, result.rows[0].id, 
        severity === 'critical' ? 'high' : severity === 'high' ? 'high' : 'medium',
        `Remediate ${violationType} violation`, dueDate, schoolId,
        req.user.userId, `${req.user.firstName} ${req.user.lastName}`
      ]);

      res.status(201).json({
        success: true,
        message: 'Compliance violation reported successfully',
        data: {
          ...result.rows[0],
          violation_details: JSON.parse(result.rows[0].violation_details),
          remediation_plan: JSON.parse(result.rows[0].remediation_plan)
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Update violation status
  static async updateViolationStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { status, resolutionNotes, evidenceUrls = [] } = req.body;

      if (!status) {
        throw new ValidationError('Status is required');
      }

      const result = await query(`
        UPDATE compliance_violations 
        SET status = $1,
            resolution_notes = $2,
            evidence_urls = $3,
            resolved_at = CASE WHEN $1 = 'resolved' THEN CURRENT_TIMESTAMP ELSE resolved_at END,
            resolved_by = CASE WHEN $1 = 'resolved' THEN $4 ELSE resolved_by END,
            resolved_by_name = CASE WHEN $1 = 'resolved' THEN $5 ELSE resolved_by_name END,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $6
        RETURNING *
      `, [
        status, resolutionNotes, evidenceUrls,
        req.user.userId, `${req.user.firstName} ${req.user.lastName}`, id
      ]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Compliance violation not found');
      }

      res.json({
        success: true,
        message: 'Violation status updated successfully',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }

  // =============================================================================
  // COMPLIANCE AUDITS
  // =============================================================================

  // Get compliance audits
  static async getComplianceAudits(req, res, next) {
    try {
      const { 
        schoolId, 
        auditType, 
        status,
        auditorId,
        limit = 20, 
        offset = 0 
      } = req.query;

      let whereClause = 'WHERE 1=1';
      const params = [];

      if (schoolId) {
        whereClause += ` AND ca.school_id = $${params.length + 1}`;
        params.push(schoolId);
      }

      if (auditType) {
        whereClause += ` AND ca.audit_type = $${params.length + 1}`;
        params.push(auditType);
      }

      if (status) {
        whereClause += ` AND ca.status = $${params.length + 1}`;
        params.push(status);
      }

      if (auditorId) {
        whereClause += ` AND ca.auditor_id = $${params.length + 1}`;
        params.push(auditorId);
      }

      const result = await query(`
        SELECT 
          ca.*,
          s.name as school_name,
          auditor.first_name as auditor_first_name,
          auditor.last_name as auditor_last_name
        FROM compliance_audits ca
        JOIN schools s ON ca.school_id = s.id
        LEFT JOIN platform_admins auditor ON ca.auditor_id = auditor.id
        ${whereClause}
        ORDER BY ca.created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `, [...params, limit, offset]);

      const audits = result.rows.map(audit => ({
        ...audit,
        audit_scope: JSON.parse(audit.audit_scope || '[]'),
        findings: JSON.parse(audit.findings || '[]'),
        recommendations: JSON.parse(audit.recommendations || '[]')
      }));

      res.json({
        success: true,
        data: audits,
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

  // Create compliance audit
  static async createComplianceAudit(req, res, next) {
    try {
      const {
        schoolId,
        auditType,
        auditScope = [],
        scheduledDate,
        auditorId,
        description
      } = req.body;

      if (!schoolId || !auditType || !scheduledDate) {
        throw new ValidationError('School ID, audit type, and scheduled date are required');
      }

      const result = await query(`
        INSERT INTO compliance_audits (
          school_id, audit_type, audit_scope, scheduled_date, auditor_id,
          description, status, created_by, created_by_name
        ) VALUES ($1, $2, $3, $4, $5, $6, 'scheduled', $7, $8)
        RETURNING *
      `, [
        schoolId, auditType, JSON.stringify(auditScope), scheduledDate, auditorId,
        description, req.user.userId, `${req.user.firstName} ${req.user.lastName}`
      ]);

      res.status(201).json({
        success: true,
        message: 'Compliance audit created successfully',
        data: {
          ...result.rows[0],
          audit_scope: JSON.parse(result.rows[0].audit_scope)
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Complete compliance audit
  static async completeComplianceAudit(req, res, next) {
    try {
      const { id } = req.params;
      const {
        findings = [],
        recommendations = [],
        overallScore,
        auditReport
      } = req.body;

      if (overallScore === undefined) {
        throw new ValidationError('Overall score is required');
      }

      const result = await query(`
        UPDATE compliance_audits 
        SET status = 'completed',
            findings = $1,
            recommendations = $2,
            overall_score = $3,
            audit_report = $4,
            completed_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $5
        RETURNING *
      `, [
        JSON.stringify(findings), JSON.stringify(recommendations),
        overallScore, auditReport, id
      ]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Compliance audit not found');
      }

      res.json({
        success: true,
        message: 'Compliance audit completed successfully',
        data: {
          ...result.rows[0],
          findings: JSON.parse(result.rows[0].findings),
          recommendations: JSON.parse(result.rows[0].recommendations)
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // =============================================================================
  // COMPLIANCE ACTIONS
  // =============================================================================

  // Get compliance actions
  static async getComplianceActions(req, res, next) {
    try {
      const { 
        schoolId, 
        actionType, 
        status, 
        priority,
        assignedTo,
        limit = 20, 
        offset = 0 
      } = req.query;

      let whereClause = 'WHERE 1=1';
      const params = [];

      if (schoolId) {
        whereClause += ` AND ca.school_id = $${params.length + 1}`;
        params.push(schoolId);
      }

      if (actionType) {
        whereClause += ` AND ca.action_type = $${params.length + 1}`;
        params.push(actionType);
      }

      if (status) {
        whereClause += ` AND ca.status = $${params.length + 1}`;
        params.push(status);
      }

      if (priority) {
        whereClause += ` AND ca.priority = $${params.length + 1}`;
        params.push(priority);
      }

      if (assignedTo) {
        whereClause += ` AND ca.assigned_to = $${params.length + 1}`;
        params.push(assignedTo);
      }

      const result = await query(`
        SELECT 
          ca.*,
          s.name as school_name,
          cv.violation_type,
          cv.severity as violation_severity
        FROM compliance_actions ca
        JOIN schools s ON ca.school_id = s.id
        LEFT JOIN compliance_violations cv ON ca.violation_id = cv.id
        ${whereClause}
        ORDER BY 
          CASE ca.priority 
            WHEN 'high' THEN 1 
            WHEN 'medium' THEN 2 
            WHEN 'low' THEN 3 
          END, ca.due_date ASC
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

  // Update compliance action
  static async updateComplianceAction(req, res, next) {
    try {
      const { id } = req.params;
      const { status, progress, notes, completedAt } = req.body;

      const updates = {};
      const values = [];
      let paramIndex = 1;

      if (status) {
        updates.status = `$${paramIndex}`;
        values.push(status);
        paramIndex++;
      }

      if (progress !== undefined) {
        updates.progress = `$${paramIndex}`;
        values.push(progress);
        paramIndex++;
      }

      if (notes) {
        updates.notes = `$${paramIndex}`;
        values.push(notes);
        paramIndex++;
      }

      if (completedAt || status === 'completed') {
        updates.completed_at = status === 'completed' ? 'CURRENT_TIMESTAMP' : `$${paramIndex}`;
        if (completedAt && status !== 'completed') {
          values.push(completedAt);
          paramIndex++;
        }
      }

      if (Object.keys(updates).length === 0) {
        throw new ValidationError('No valid fields provided for update');
      }

      updates.updated_at = 'CURRENT_TIMESTAMP';
      values.push(id);

      const setClause = Object.keys(updates).map(key => `${key} = ${updates[key]}`).join(', ');

      const result = await query(`
        UPDATE compliance_actions 
        SET ${setClause}
        WHERE id = $${paramIndex}
        RETURNING *
      `, values);

      if (result.rows.length === 0) {
        throw new NotFoundError('Compliance action not found');
      }

      res.json({
        success: true,
        message: 'Compliance action updated successfully',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }

  // =============================================================================
  // COMPLIANCE REPORTS
  // =============================================================================

  // Generate compliance report
  static async generateComplianceReport(req, res, next) {
    try {
      const {
        reportType, // 'summary', 'detailed', 'violations', 'audits'
        schoolIds = [],
        startDate,
        endDate,
        categories = [],
        format = 'json' // 'json', 'pdf', 'csv'
      } = req.body;

      if (!reportType || !startDate || !endDate) {
        throw new ValidationError('Report type, start date, and end date are required');
      }

      const reportData = await ComplianceController.generateReportData(
        reportType, schoolIds, startDate, endDate, categories
      );

      // Create report record
      const report = await query(`
        INSERT INTO compliance_reports (
          report_type, parameters, status, generated_by, generated_by_name
        ) VALUES ($1, $2, 'completed', $3, $4)
        RETURNING *
      `, [
        reportType, JSON.stringify({ schoolIds, startDate, endDate, categories, format }),
        req.user.userId, `${req.user.firstName} ${req.user.lastName}`
      ]);

      res.json({
        success: true,
        message: 'Compliance report generated successfully',
        data: {
          reportId: report.rows[0].id,
          reportType,
          format,
          data: reportData,
          generatedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // =============================================================================
  // HELPER METHODS
  // =============================================================================

  // Create compliance actions from recommendations
  static async createComplianceActions(assessmentId, recommendations, userId) {
    for (const recommendation of recommendations) {
      if (recommendation.action_required) {
        await query(`
          INSERT INTO compliance_actions (
            assessment_id, action_type, priority, description, due_date,
            status, created_by, created_by_name
          ) VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7)
        `, [
          assessmentId, 'corrective_action', recommendation.priority || 'medium',
          recommendation.description, recommendation.due_date,
          userId, 'System Generated'
        ]);
      }
    }
  }

  // Generate report data based on type
  static async generateReportData(reportType, schoolIds, startDate, endDate, categories) {
    const schoolFilter = schoolIds.length > 0 ? `AND school_id = ANY($1)` : '';
    const categoryFilter = categories.length > 0 ? `AND category = ANY($2)` : '';
    const params = [];
    
    if (schoolIds.length > 0) params.push(schoolIds);
    if (categories.length > 0) params.push(categories);
    params.push(startDate, endDate);

    switch (reportType) {
      case 'summary':
        return await query(`
          SELECT 
            s.name as school_name,
            COUNT(DISTINCT ca.id) as total_assessments,
            AVG(ca.compliance_score) as avg_compliance_score,
            COUNT(DISTINCT cv.id) as total_violations,
            COUNT(DISTINCT cau.id) as total_audits
          FROM schools s
          LEFT JOIN compliance_assessments ca ON s.id = ca.school_id 
            AND ca.assessed_at BETWEEN $${params.length - 1} AND $${params.length}
          LEFT JOIN compliance_violations cv ON s.id = cv.school_id 
            AND cv.identified_at BETWEEN $${params.length - 1} AND $${params.length}
          LEFT JOIN compliance_audits cau ON s.id = cau.school_id 
            AND cau.created_at BETWEEN $${params.length - 1} AND $${params.length}
          WHERE 1=1 ${schoolFilter}
          GROUP BY s.id, s.name
          ORDER BY s.name
        `, params);

      case 'violations':
        return await query(`
          SELECT 
            cv.*,
            s.name as school_name,
            cr.regulation_title
          FROM compliance_violations cv
          JOIN schools s ON cv.school_id = s.id
          JOIN compliance_regulations cr ON cv.regulation_id = cr.id
          WHERE cv.identified_at BETWEEN $${params.length - 1} AND $${params.length}
            ${schoolFilter} ${categoryFilter}
          ORDER BY cv.severity DESC, cv.identified_at DESC
        `, params);

      default:
        return { message: 'Report type not implemented' };
    }
  }
}

module.exports = ComplianceController;