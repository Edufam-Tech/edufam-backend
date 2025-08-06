const securityService = require('../services/securityService');
const { asyncHandler } = require('../middleware/errorHandler');
const { ValidationError } = require('../middleware/errorHandler');

/**
 * Security Controller
 * Handles security audit logging, monitoring, and incident management
 */
class SecurityController {

  /**
   * Security Audit Logging
   */

  // Get security audit logs
  getAuditLogs = asyncHandler(async (req, res) => {
    const filters = {
      eventType: req.query.eventType,
      severityLevel: req.query.severityLevel,
      userId: req.query.userId,
      schoolId: req.query.schoolId || req.activeSchoolId,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
      minRiskScore: req.query.minRiskScore ? parseInt(req.query.minRiskScore) : null,
      highRiskOnly: req.query.highRiskOnly === 'true',
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 100
    };

    // Remove undefined values
    Object.keys(filters).forEach(key => 
      filters[key] === undefined && delete filters[key]
    );

    const auditLogs = await securityService.getAuditLogs(filters);

    res.json({
      success: true,
      data: {
        auditLogs,
        pagination: {
          page: filters.page,
          limit: filters.limit,
          hasMore: auditLogs.length === filters.limit
        }
      },
      message: 'Security audit logs retrieved successfully'
    });
  });

  // Log custom security event
  logSecurityEvent = asyncHandler(async (req, res) => {
    const {
      eventType,
      eventCategory,
      severityLevel,
      eventDescription,
      eventDetails,
      dataSensitivity,
      threatIndicators,
      anomalyScore
    } = req.body;

    // Validate required fields
    if (!eventType || !eventCategory || !severityLevel || !eventDescription) {
      throw new ValidationError('Event type, category, severity level, and description are required');
    }

    const eventData = {
      eventType,
      eventCategory,
      severityLevel,
      userId: req.user.userId,
      sessionId: req.sessionID,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      requestMethod: req.method,
      requestUrl: req.originalUrl,
      requestHeaders: req.headers,
      authenticationMethod: req.user.authMethod || 'password',
      authorizationContext: {
        role: req.user.role,
        schoolId: req.activeSchoolId,
        permissions: req.user.permissions
      },
      dataSensitivity,
      schoolId: req.activeSchoolId || req.user.schoolId,
      eventDescription,
      eventDetails,
      success: true,
      threatIndicators,
      anomalyScore
    };

    const logEntry = await securityService.logSecurityEvent(eventData);

    res.status(201).json({
      success: true,
      data: { logEntry },
      message: 'Security event logged successfully'
    });
  });

  /**
   * Security Incident Management
   */

  // Create security incident
  createSecurityIncident = asyncHandler(async (req, res) => {
    const {
      incidentType,
      incidentCategory,
      severityLevel,
      urgencyLevel,
      title,
      description,
      impactAssessment,
      affectedSystems,
      affectedDataTypes,
      estimatedRecordsAffected,
      incidentDetectedAt,
      incidentOccurredAt,
      detectedBy,
      detectionMethod,
      confidentialityImpact,
      integrityImpact,
      availabilityImpact,
      financialImpact,
      affectsMultipleSchools,
      affectedSchools
    } = req.body;

    // Validate required fields
    if (!incidentType || !incidentCategory || !severityLevel || !urgencyLevel || !title || !description) {
      throw new ValidationError('Incident type, category, severity, urgency, title, and description are required');
    }

    const incident = await securityService.createSecurityIncident({
      incidentType,
      incidentCategory,
      severityLevel,
      urgencyLevel,
      title,
      description,
      impactAssessment,
      affectedSystems,
      affectedDataTypes,
      estimatedRecordsAffected,
      incidentDetectedAt: incidentDetectedAt || new Date(),
      incidentOccurredAt,
      detectedBy,
      detectionMethod,
      reportedBy: req.user.userId,
      confidentialityImpact,
      integrityImpact,
      availabilityImpact,
      financialImpact,
      schoolId: req.activeSchoolId || req.user.schoolId,
      affectsMultipleSchools,
      affectedSchools,
      createdBy: req.user.userId
    });

    res.status(201).json({
      success: true,
      data: { incident },
      message: 'Security incident created successfully'
    });
  });

  // Update security incident
  updateSecurityIncident = asyncHandler(async (req, res) => {
    const { incidentId } = req.params;
    
    const {
      investigationStatus,
      assignedInvestigator,
      investigationFindings,
      rootCauseAnalysis,
      containmentActions,
      containmentStatus,
      eradicationActions,
      recoveryActions,
      currentStatus,
      resolutionSummary,
      lessonsLearned,
      preventiveMeasures
    } = req.body;

    const incident = await securityService.updateSecurityIncident(incidentId, {
      investigationStatus,
      assignedInvestigator,
      investigationFindings,
      rootCauseAnalysis,
      containmentActions,
      containmentStatus,
      eradicationActions,
      recoveryActions,
      currentStatus,
      resolutionSummary,
      lessonsLearned,
      preventiveMeasures
    });

    res.json({
      success: true,
      data: { incident },
      message: 'Security incident updated successfully'
    });
  });

  // Get security incidents
  getSecurityIncidents = asyncHandler(async (req, res) => {
    const filters = {
      incidentType: req.query.incidentType,
      severityLevel: req.query.severityLevel,
      currentStatus: req.query.currentStatus,
      schoolId: req.query.schoolId || req.activeSchoolId,
      assignedInvestigator: req.query.assignedInvestigator,
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 50
    };

    // Remove undefined values
    Object.keys(filters).forEach(key => 
      filters[key] === undefined && delete filters[key]
    );

    const incidents = await securityService.getSecurityIncidents(filters);

    res.json({
      success: true,
      data: {
        incidents,
        pagination: {
          page: filters.page,
          limit: filters.limit,
          hasMore: incidents.length === filters.limit
        }
      },
      message: 'Security incidents retrieved successfully'
    });
  });

  // Get security incident details
  getSecurityIncident = asyncHandler(async (req, res) => {
    const { incidentId } = req.params;
    
    const incidents = await securityService.getSecurityIncidents({ 
      incidentId: incidentId,
      limit: 1 
    });

    if (incidents.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'INCIDENT_NOT_FOUND',
          message: 'Security incident not found'
        }
      });
    }

    res.json({
      success: true,
      data: { incident: incidents[0] },
      message: 'Security incident details retrieved successfully'
    });
  });

  /**
   * Security Analytics and Monitoring
   */

  // Get security dashboard
  getSecurityDashboard = asyncHandler(async (req, res) => {
    const schoolId = req.activeSchoolId || req.user.schoolId;
    const timeframe = req.query.timeframe || '30days';

    const metrics = await securityService.getSecurityDashboardMetrics(schoolId, timeframe);
    const trends = await securityService.getSecurityTrends(schoolId, 30);

    res.json({
      success: true,
      data: {
        metrics,
        trends,
        schoolId,
        timeframe,
        timestamp: new Date().toISOString()
      },
      message: 'Security dashboard retrieved successfully'
    });
  });

  // Get security trends
  getSecurityTrends = asyncHandler(async (req, res) => {
    const schoolId = req.activeSchoolId || req.user.schoolId;
    const days = parseInt(req.query.days) || 30;

    const trends = await securityService.getSecurityTrends(schoolId, days);

    res.json({
      success: true,
      data: { trends },
      message: 'Security trends retrieved successfully'
    });
  });

  // Detect anomalous activities
  detectAnomalies = asyncHandler(async (req, res) => {
    const {
      userId,
      ipAddress,
      timeWindow = '1 hour'
    } = req.query;

    const anomalies = await securityService.detectAnomalies(userId, ipAddress, timeWindow);

    res.json({
      success: true,
      data: {
        anomalies,
        detectionCriteria: {
          userId,
          ipAddress,
          timeWindow
        },
        detectedAt: new Date().toISOString()
      },
      message: 'Anomaly detection completed successfully'
    });
  });

  /**
   * Security Monitoring and Alerts
   */

  // Get high-risk events
  getHighRiskEvents = asyncHandler(async (req, res) => {
    const schoolId = req.activeSchoolId || req.user.schoolId;
    const hours = parseInt(req.query.hours) || 24;

    const filters = {
      schoolId,
      minRiskScore: 70,
      dateFrom: new Date(Date.now() - (hours * 60 * 60 * 1000)),
      limit: 100
    };

    const highRiskEvents = await securityService.getAuditLogs(filters);

    res.json({
      success: true,
      data: {
        highRiskEvents,
        criteria: {
          minRiskScore: 70,
          timeWindow: `${hours} hours`,
          schoolId
        }
      },
      message: 'High-risk events retrieved successfully'
    });
  });

  // Get failed login attempts
  getFailedLoginAttempts = asyncHandler(async (req, res) => {
    const schoolId = req.activeSchoolId || req.user.schoolId;
    const hours = parseInt(req.query.hours) || 24;

    const filters = {
      eventType: 'login',
      schoolId,
      success: false,
      dateFrom: new Date(Date.now() - (hours * 60 * 60 * 1000)),
      limit: 200
    };

    const failedLogins = await securityService.getAuditLogs(filters);

    res.json({
      success: true,
      data: {
        failedLogins,
        summary: {
          totalAttempts: failedLogins.length,
          uniqueUsers: [...new Set(failedLogins.map(f => f.user_id))].length,
          uniqueIPs: [...new Set(failedLogins.map(f => f.ip_address))].length,
          timeWindow: `${hours} hours`
        }
      },
      message: 'Failed login attempts retrieved successfully'
    });
  });

  /**
   * Data Access Monitoring
   */

  // Get data access logs
  getDataAccessLogs = asyncHandler(async (req, res) => {
    const {
      dataType,
      studentId,
      userId,
      dataSensitivity,
      hours = 24
    } = req.query;

    const filters = {
      eventCategory: 'data_access',
      schoolId: req.activeSchoolId || req.user.schoolId,
      dateFrom: new Date(Date.now() - (hours * 60 * 60 * 1000)),
      studentId,
      userId,
      dataSensitivity,
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 100
    };

    // Remove undefined values
    Object.keys(filters).forEach(key => 
      filters[key] === undefined && delete filters[key]
    );

    const dataAccessLogs = await securityService.getAuditLogs(filters);

    res.json({
      success: true,
      data: {
        dataAccessLogs,
        filters: {
          dataType,
          studentId,
          userId,
          dataSensitivity,
          timeWindow: `${hours} hours`
        }
      },
      message: 'Data access logs retrieved successfully'
    });
  });

  /**
   * Security Health Check
   */

  // Get security service health
  getSecurityServiceHealth = asyncHandler(async (req, res) => {
    const schoolId = req.activeSchoolId || req.user.schoolId;
    const metrics = await securityService.getSecurityDashboardMetrics(schoolId, '24hours');

    res.json({
      success: true,
      data: {
        service: 'Security Management Service',
        status: 'healthy',
        features: [
          'security_audit_logging',
          'incident_management',
          'anomaly_detection',
          'security_monitoring',
          'risk_assessment',
          'threat_detection',
          'compliance_tracking'
        ],
        metrics: {
          last24Hours: {
            totalEvents: metrics.auditMetrics.total_events,
            highRiskEvents: metrics.auditMetrics.high_risk_events,
            criticalEvents: metrics.auditMetrics.critical_events,
            openIncidents: metrics.incidentMetrics.open_incidents
          }
        },
        timestamp: new Date().toISOString()
      },
      message: 'Security service health check completed'
    });
  });
}

module.exports = new SecurityController();