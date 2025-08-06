const { query } = require('../config/database');
const { DatabaseError, ValidationError, NotFoundError } = require('../middleware/errorHandler');
const crypto = require('crypto');

/**
 * Security Service
 * Handles security audit logging, monitoring, and incident management
 */
class SecurityService {

  /**
   * Security Audit Logging
   */

  // Log security event
  async logSecurityEvent(eventData) {
    try {
      const {
        eventType,
        eventCategory,
        severityLevel,
        userId,
        sessionId,
        ipAddress,
        userAgent,
        requestMethod,
        requestUrl,
        requestHeaders,
        requestBody,
        responseStatus,
        responseSize,
        processingTimeMs,
        authenticationMethod,
        authorizationContext,
        dataSensitivity,
        schoolId,
        studentId,
        eventDescription,
        eventDetails,
        success = true,
        failureReason,
        threatIndicators,
        geolocation,
        deviceFingerprint,
        anomalyScore
      } = eventData;

      // Calculate risk score based on various factors
      const riskScore = this.calculateRiskScore({
        severityLevel,
        eventType,
        anomalyScore,
        threatIndicators,
        success,
        dataSensitivity
      });

      // Hash sensitive request body if provided
      const requestBodyHash = requestBody ? 
        crypto.createHash('sha256').update(JSON.stringify(requestBody)).digest('hex') : null;

      const result = await query(`
        INSERT INTO security_audit_logs (
          event_type, event_category, severity_level, risk_score,
          user_id, session_id, ip_address, user_agent,
          request_method, request_url, request_headers, request_body_hash,
          response_status, response_size, processing_time_ms,
          authentication_method, authorization_context, data_sensitivity,
          school_id, student_id, event_description, event_details,
          success, failure_reason, threat_indicators, geolocation,
          device_fingerprint, anomaly_score
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
          $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28
        )
        RETURNING id, created_at
      `, [
        eventType, eventCategory, severityLevel, riskScore,
        userId, sessionId, ipAddress, userAgent,
        requestMethod, requestUrl, JSON.stringify(requestHeaders), requestBodyHash,
        responseStatus, responseSize, processingTimeMs,
        authenticationMethod, JSON.stringify(authorizationContext), dataSensitivity,
        schoolId, studentId, eventDescription, JSON.stringify(eventDetails),
        success, failureReason, threatIndicators, JSON.stringify(geolocation),
        deviceFingerprint, anomalyScore
      ]);

      // If high risk event, create security alert
      if (riskScore >= 70) {
        await this.createSecurityAlert({
          eventId: result.rows[0].id,
          riskScore,
          eventType,
          severityLevel,
          userId,
          ipAddress,
          eventDescription
        });
      }

      return result.rows[0];
    } catch (error) {
      throw new DatabaseError('Failed to log security event', error);
    }
  }

  // Calculate risk score based on event characteristics
  calculateRiskScore(factors) {
    let score = 0;
    
    // Base score by severity
    const severityScores = { low: 10, medium: 25, high: 50, critical: 75 };
    score += severityScores[factors.severityLevel] || 0;
    
    // Event type risk
    const highRiskEvents = ['unauthorized_access', 'data_breach', 'privilege_escalation', 'malware_detected'];
    if (highRiskEvents.includes(factors.eventType)) {
      score += 20;
    }
    
    // Anomaly score contribution
    if (factors.anomalyScore) {
      score += Math.min(factors.anomalyScore * 0.3, 20);
    }
    
    // Threat indicators
    if (factors.threatIndicators && factors.threatIndicators.length > 0) {
      score += Math.min(factors.threatIndicators.length * 5, 15);
    }
    
    // Failed events are riskier
    if (!factors.success) {
      score += 10;
    }
    
    // Data sensitivity
    const sensitivityScores = { public: 0, internal: 5, confidential: 10, restricted: 15 };
    score += sensitivityScores[factors.dataSensitivity] || 0;
    
    return Math.min(Math.round(score), 100);
  }

  // Create security alert for high-risk events
  async createSecurityAlert(alertData) {
    try {
      // This could integrate with real-time notification system
      console.log('🚨 High-Risk Security Event Detected:', alertData);
      
      // In a real implementation, this would:
      // 1. Send immediate notifications to security team
      // 2. Create incident record if warranted
      // 3. Trigger automated response actions
      // 4. Update security dashboards
      
      return true;
    } catch (error) {
      console.error('Failed to create security alert:', error);
      return false;
    }
  }

  // Get security audit logs with filtering
  async getAuditLogs(filters = {}) {
    try {
      let whereConditions = ['1=1'];
      let queryParams = [];
      let paramCount = 0;

      if (filters.eventType) {
        paramCount++;
        whereConditions.push(`event_type = $${paramCount}`);
        queryParams.push(filters.eventType);
      }

      if (filters.severityLevel) {
        paramCount++;
        whereConditions.push(`severity_level = $${paramCount}`);
        queryParams.push(filters.severityLevel);
      }

      if (filters.userId) {
        paramCount++;
        whereConditions.push(`user_id = $${paramCount}`);
        queryParams.push(filters.userId);
      }

      if (filters.schoolId) {
        paramCount++;
        whereConditions.push(`school_id = $${paramCount}`);
        queryParams.push(filters.schoolId);
      }

      if (filters.dateFrom) {
        paramCount++;
        whereConditions.push(`created_at >= $${paramCount}`);
        queryParams.push(filters.dateFrom);
      }

      if (filters.dateTo) {
        paramCount++;
        whereConditions.push(`created_at <= $${paramCount}`);
        queryParams.push(filters.dateTo);
      }

      if (filters.minRiskScore) {
        paramCount++;
        whereConditions.push(`risk_score >= $${paramCount}`);
        queryParams.push(filters.minRiskScore);
      }

      if (filters.highRiskOnly) {
        whereConditions.push(`risk_score >= 70`);
      }

      const limit = Math.min(filters.limit || 100, 1000);
      const offset = (filters.page - 1) * limit || 0;

      const result = await query(`
        SELECT 
          sal.*,
          u.first_name,
          u.last_name,
          u.email,
          s.name as school_name
        FROM security_audit_logs sal
        LEFT JOIN users u ON u.id = sal.user_id
        LEFT JOIN schools s ON s.id = sal.school_id
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY sal.created_at DESC
        LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
      `, [...queryParams, limit, offset]);

      return result.rows;
    } catch (error) {
      throw new DatabaseError('Failed to get audit logs', error);
    }
  }

  /**
   * Security Incident Management
   */

  // Create security incident
  async createSecurityIncident(incidentData) {
    try {
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
        reportedBy,
        confidentialityImpact,
        integrityImpact,
        availabilityImpact,
        financialImpact,
        schoolId,
        affectsMultipleSchools,
        affectedSchools,
        createdBy
      } = incidentData;

      const result = await query(`
        INSERT INTO security_incidents (
          incident_type, incident_category, severity_level, urgency_level,
          title, description, impact_assessment, affected_systems,
          affected_data_types, estimated_records_affected, incident_detected_at,
          incident_occurred_at, detected_by, detection_method, reported_by,
          confidentiality_impact, integrity_impact, availability_impact,
          financial_impact, school_id, affects_multiple_schools, affected_schools,
          created_by
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
          $16, $17, $18, $19, $20, $21, $22, $23
        )
        RETURNING *
      `, [
        incidentType, incidentCategory, severityLevel, urgencyLevel,
        title, description, impactAssessment, affectedSystems,
        affectedDataTypes, estimatedRecordsAffected, incidentDetectedAt,
        incidentOccurredAt, detectedBy, detectionMethod, reportedBy,
        confidentialityImpact, integrityImpact, availabilityImpact,
        financialImpact, schoolId, affectsMultipleSchools, affectedSchools,
        createdBy
      ]);

      return result.rows[0];
    } catch (error) {
      throw new DatabaseError('Failed to create security incident', error);
    }
  }

  // Update security incident
  async updateSecurityIncident(incidentId, updateData) {
    try {
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
      } = updateData;

      const result = await query(`
        UPDATE security_incidents
        SET 
          investigation_status = COALESCE($2, investigation_status),
          assigned_investigator = COALESCE($3, assigned_investigator),
          investigation_findings = COALESCE($4, investigation_findings),
          root_cause_analysis = COALESCE($5, root_cause_analysis),
          containment_actions = COALESCE($6, containment_actions),
          containment_status = COALESCE($7, containment_status),
          eradication_actions = COALESCE($8, eradication_actions),
          recovery_actions = COALESCE($9, recovery_actions),
          current_status = COALESCE($10, current_status),
          resolution_summary = COALESCE($11, resolution_summary),
          lessons_learned = COALESCE($12, lessons_learned),
          preventive_measures = COALESCE($13, preventive_measures),
          updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `, [
        incidentId, investigationStatus, assignedInvestigator, investigationFindings,
        rootCauseAnalysis, containmentActions, containmentStatus, eradicationActions,
        recoveryActions, currentStatus, resolutionSummary, lessonsLearned, preventiveMeasures
      ]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Security incident not found');
      }

      return result.rows[0];
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new DatabaseError('Failed to update security incident', error);
    }
  }

  // Get security incidents
  async getSecurityIncidents(filters = {}) {
    try {
      let whereConditions = ['1=1'];
      let queryParams = [];
      let paramCount = 0;

      if (filters.incidentType) {
        paramCount++;
        whereConditions.push(`incident_type = $${paramCount}`);
        queryParams.push(filters.incidentType);
      }

      if (filters.severityLevel) {
        paramCount++;
        whereConditions.push(`severity_level = $${paramCount}`);
        queryParams.push(filters.severityLevel);
      }

      if (filters.currentStatus) {
        paramCount++;
        whereConditions.push(`current_status = $${paramCount}`);
        queryParams.push(filters.currentStatus);
      }

      if (filters.schoolId) {
        paramCount++;
        whereConditions.push(`(school_id = $${paramCount} OR affects_multiple_schools = true)`);
        queryParams.push(filters.schoolId);
      }

      if (filters.assignedInvestigator) {
        paramCount++;
        whereConditions.push(`assigned_investigator = $${paramCount}`);
        queryParams.push(filters.assignedInvestigator);
      }

      const limit = Math.min(filters.limit || 50, 200);
      const offset = (filters.page - 1) * limit || 0;

      const result = await query(`
        SELECT 
          si.*,
          u1.first_name as investigator_first_name,
          u1.last_name as investigator_last_name,
          u2.first_name as reporter_first_name,
          u2.last_name as reporter_last_name,
          s.name as school_name
        FROM security_incidents si
        LEFT JOIN users u1 ON u1.id = si.assigned_investigator
        LEFT JOIN users u2 ON u2.id = si.reported_by
        LEFT JOIN schools s ON s.id = si.school_id
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY si.incident_detected_at DESC
        LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
      `, [...queryParams, limit, offset]);

      return result.rows;
    } catch (error) {
      throw new DatabaseError('Failed to get security incidents', error);
    }
  }

  /**
   * Security Analytics and Monitoring
   */

  // Get security dashboard metrics
  async getSecurityDashboardMetrics(schoolId = null, timeframe = '30days') {
    try {
      let timeCondition = '';
      let timeValue = null;
      
      switch (timeframe) {
        case '24hours':
          timeCondition = 'created_at >= NOW() - INTERVAL \'24 hours\'';
          break;
        case '7days':
          timeCondition = 'created_at >= NOW() - INTERVAL \'7 days\'';
          break;
        case '30days':
          timeCondition = 'created_at >= NOW() - INTERVAL \'30 days\'';
          break;
        case '90days':
          timeCondition = 'created_at >= NOW() - INTERVAL \'90 days\'';
          break;
        default:
          timeCondition = 'created_at >= NOW() - INTERVAL \'30 days\'';
      }

      let schoolCondition = '';
      let queryParams = [];
      
      if (schoolId) {
        schoolCondition = 'AND (school_id = $1 OR school_id IS NULL)';
        queryParams.push(schoolId);
      }

      const metrics = await query(`
        SELECT 
          COUNT(*) as total_events,
          COUNT(*) FILTER (WHERE severity_level = 'critical') as critical_events,
          COUNT(*) FILTER (WHERE severity_level = 'high') as high_severity_events,
          COUNT(*) FILTER (WHERE risk_score >= 70) as high_risk_events,
          COUNT(*) FILTER (WHERE success = false) as failed_events,
          COUNT(DISTINCT user_id) as unique_users,
          COUNT(DISTINCT ip_address) as unique_ip_addresses,
          AVG(risk_score) as avg_risk_score,
          COUNT(*) FILTER (WHERE event_type = 'login') as login_events,
          COUNT(*) FILTER (WHERE event_type = 'data_access') as data_access_events,
          COUNT(*) FILTER (WHERE event_type = 'unauthorized_access') as unauthorized_access_events,
          COUNT(*) FILTER (WHERE anomaly_score > 50) as anomalous_events
        FROM security_audit_logs
        WHERE ${timeCondition} ${schoolCondition}
      `, queryParams);

      const incidents = await query(`
        SELECT 
          COUNT(*) as total_incidents,
          COUNT(*) FILTER (WHERE current_status = 'open') as open_incidents,
          COUNT(*) FILTER (WHERE severity_level = 'critical') as critical_incidents,
          COUNT(*) FILTER (WHERE incident_detected_at >= NOW() - INTERVAL '${timeframe}') as recent_incidents
        FROM security_incidents
        WHERE 1=1 ${schoolCondition.replace('school_id', 'school_id')}
      `, queryParams);

      return {
        auditMetrics: metrics.rows[0],
        incidentMetrics: incidents.rows[0],
        timeframe,
        schoolId,
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      throw new DatabaseError('Failed to get security dashboard metrics', error);
    }
  }

  // Get security trends
  async getSecurityTrends(schoolId = null, days = 30) {
    try {
      let schoolCondition = '';
      let queryParams = [days];
      
      if (schoolId) {
        schoolCondition = 'AND (school_id = $2 OR school_id IS NULL)';
        queryParams.push(schoolId);
      }

      const trends = await query(`
        SELECT 
          DATE_TRUNC('day', created_at) as date,
          COUNT(*) as total_events,
          COUNT(*) FILTER (WHERE severity_level IN ('high', 'critical')) as high_severity_events,
          COUNT(*) FILTER (WHERE risk_score >= 70) as high_risk_events,
          COUNT(*) FILTER (WHERE success = false) as failed_events,
          AVG(risk_score) as avg_risk_score
        FROM security_audit_logs
        WHERE created_at >= NOW() - INTERVAL '1 day' * $1 ${schoolCondition}
        GROUP BY DATE_TRUNC('day', created_at)
        ORDER BY date DESC
      `, queryParams);

      return trends.rows;
    } catch (error) {
      throw new DatabaseError('Failed to get security trends', error);
    }
  }

  // Detect anomalous activities
  async detectAnomalies(userId = null, ipAddress = null, timeWindow = '1 hour') {
    try {
      let conditions = [`created_at >= NOW() - INTERVAL '${timeWindow}'`];
      let queryParams = [];
      let paramCount = 0;

      if (userId) {
        paramCount++;
        conditions.push(`user_id = $${paramCount}`);
        queryParams.push(userId);
      }

      if (ipAddress) {
        paramCount++;
        conditions.push(`ip_address = $${paramCount}`);
        queryParams.push(ipAddress);
      }

      const anomalies = await query(`
        SELECT 
          user_id,
          ip_address,
          COUNT(*) as event_count,
          COUNT(DISTINCT event_type) as unique_event_types,
          COUNT(*) FILTER (WHERE success = false) as failed_attempts,
          MAX(risk_score) as max_risk_score,
          AVG(risk_score) as avg_risk_score,
          ARRAY_AGG(DISTINCT event_type) as event_types,
          MIN(created_at) as first_event,
          MAX(created_at) as last_event
        FROM security_audit_logs
        WHERE ${conditions.join(' AND ')}
        GROUP BY user_id, ip_address
        HAVING 
          COUNT(*) > 50 OR  -- High volume
          COUNT(*) FILTER (WHERE success = false) > 5 OR  -- Multiple failures
          MAX(risk_score) > 80 OR  -- High risk events
          COUNT(DISTINCT event_type) > 10  -- Diverse activities
        ORDER BY max_risk_score DESC, event_count DESC
      `, queryParams);

      return anomalies.rows;
    } catch (error) {
      throw new DatabaseError('Failed to detect anomalies', error);
    }
  }

  /**
   * Utility Methods
   */

  // Check if event should be logged based on configuration
  shouldLogEvent(eventType, severityLevel) {
    // In a real implementation, this would check security configuration
    // For now, log all events above 'low' severity
    return severityLevel !== 'low';
  }

  // Anonymize audit log data for reporting
  async anonymizeAuditData(auditLogId) {
    try {
      await query(`
        UPDATE security_audit_logs
        SET 
          user_id = NULL,
          ip_address = '0.0.0.0'::inet,
          user_agent = 'anonymized',
          request_headers = '{}',
          updated_at = NOW()
        WHERE id = $1
      `, [auditLogId]);

      return true;
    } catch (error) {
      throw new DatabaseError('Failed to anonymize audit data', error);
    }
  }

  // Archive old audit logs
  async archiveOldAuditLogs(retentionDays = 2555) { // 7 years default
    try {
      const result = await query(`
        UPDATE security_audit_logs
        SET archived = true, archived_at = NOW()
        WHERE created_at < NOW() - INTERVAL '1 day' * $1
          AND archived = false
      `, [retentionDays]);

      return result.rowCount;
    } catch (error) {
      throw new DatabaseError('Failed to archive audit logs', error);
    }
  }
}

module.exports = new SecurityService();