const { query } = require('../config/database');
const { DatabaseError, ValidationError, NotFoundError } = require('../middleware/errorHandler');

/**
 * Compliance Service
 * Handles GDPR compliance, data protection, and regulatory requirements
 */
class ComplianceService {

  /**
   * Data Protection Records Management
   */

  // Create data protection record
  async createDataProtectionRecord(recordData) {
    try {
      const {
        dataSubjectType,
        dataSubjectId,
        externalSubjectId,
        dataCategories,
        sensitiveDataCategories,
        dataLocations,
        legalBasis,
        consentGiven,
        consentDate,
        consentEvidence,
        processingPurpose,
        processingActivities,
        retentionPeriodMonths,
        sharedWithThirdParties,
        thirdPartyDetails,
        internationalTransfers,
        transferSafeguards,
        encryptionStatus,
        accessControls,
        securityClassification,
        schoolId,
        createdBy
      } = recordData;

      // Calculate automatic deletion date
      const automaticDeletionDate = retentionPeriodMonths ? 
        new Date(Date.now() + (retentionPeriodMonths * 30 * 24 * 60 * 60 * 1000)) : null;

      const result = await query(`
        INSERT INTO data_protection_records (
          data_subject_type, data_subject_id, external_subject_id,
          data_categories, sensitive_data_categories, data_locations,
          legal_basis, consent_given, consent_date, consent_evidence,
          processing_purpose, processing_activities, retention_period_months,
          automatic_deletion_date, shared_with_third_parties, third_party_details,
          international_transfers, transfer_safeguards, encryption_status,
          access_controls, security_classification, school_id, created_by
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
          $16, $17, $18, $19, $20, $21, $22, $23
        )
        RETURNING *
      `, [
        dataSubjectType, dataSubjectId, externalSubjectId,
        dataCategories, sensitiveDataCategories, dataLocations,
        legalBasis, consentGiven, consentDate, JSON.stringify(consentEvidence),
        processingPurpose, processingActivities, retentionPeriodMonths,
        automaticDeletionDate, sharedWithThirdParties, JSON.stringify(thirdPartyDetails),
        internationalTransfers, transferSafeguards, encryptionStatus,
        accessControls, securityClassification, schoolId, createdBy
      ]);

      return result.rows[0];
    } catch (error) {
      throw new DatabaseError('Failed to create data protection record', error);
    }
  }

  // Update consent status
  async updateConsent(recordId, consentData) {
    try {
      const {
        consentGiven,
        consentDate,
        consentWithdrawn,
        consentWithdrawalDate,
        consentEvidence
      } = consentData;

      const result = await query(`
        UPDATE data_protection_records
        SET 
          consent_given = COALESCE($2, consent_given),
          consent_date = COALESCE($3, consent_date),
          consent_withdrawn = COALESCE($4, consent_withdrawn),
          consent_withdrawal_date = COALESCE($5, consent_withdrawal_date),
          consent_evidence = COALESCE($6, consent_evidence),
          updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `, [recordId, consentGiven, consentDate, consentWithdrawn, consentWithdrawalDate, JSON.stringify(consentEvidence)]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Data protection record not found');
      }

      return result.rows[0];
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new DatabaseError('Failed to update consent', error);
    }
  }

  // Get data protection records
  async getDataProtectionRecords(filters = {}) {
    try {
      let whereConditions = ['1=1'];
      let queryParams = [];
      let paramCount = 0;

      if (filters.dataSubjectType) {
        paramCount++;
        whereConditions.push(`data_subject_type = $${paramCount}`);
        queryParams.push(filters.dataSubjectType);
      }

      if (filters.dataSubjectId) {
        paramCount++;
        whereConditions.push(`data_subject_id = $${paramCount}`);
        queryParams.push(filters.dataSubjectId);
      }

      if (filters.legalBasis) {
        paramCount++;
        whereConditions.push(`legal_basis = $${paramCount}`);
        queryParams.push(filters.legalBasis);
      }

      if (filters.schoolId) {
        paramCount++;
        whereConditions.push(`school_id = $${paramCount}`);
        queryParams.push(filters.schoolId);
      }

      if (filters.consentRequired) {
        whereConditions.push(`legal_basis = 'consent'`);
      }

      if (filters.deletionDue) {
        whereConditions.push(`automatic_deletion_date <= CURRENT_DATE + INTERVAL '30 days'`);
      }

      const limit = Math.min(filters.limit || 100, 500);
      const offset = (filters.page - 1) * limit || 0;

      const result = await query(`
        SELECT 
          dpr.*,
          s.name as school_name,
          CASE 
            WHEN dpr.data_subject_id IS NOT NULL THEN 
              CASE dpr.data_subject_type
                WHEN 'student' THEN (SELECT first_name || ' ' || last_name FROM students WHERE id = dpr.data_subject_id)
                ELSE (SELECT first_name || ' ' || last_name FROM users WHERE id = dpr.data_subject_id)
              END
            ELSE dpr.external_subject_id
          END as subject_name
        FROM data_protection_records dpr
        LEFT JOIN schools s ON s.id = dpr.school_id
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY dpr.created_at DESC
        LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
      `, [...queryParams, limit, offset]);

      return result.rows;
    } catch (error) {
      throw new DatabaseError('Failed to get data protection records', error);
    }
  }

  /**
   * Data Subject Rights Requests (GDPR)
   */

  // Create data subject rights request
  async createDataSubjectRequest(requestData) {
    try {
      const {
        requestType,
        dataSubjectType,
        dataSubjectId,
        requesterName,
        requesterEmail,
        requesterPhone,
        relationshipToSubject,
        dataCategoriesRequested,
        dateRangeFrom,
        dateRangeTo,
        specificRecordsRequested,
        reasonForRequest,
        schoolId
      } = requestData;

      // Generate unique reference number
      const requestReference = await this.generateRequestReference(requestType);

      // Calculate statutory deadline (30 days for GDPR)
      const statutoryDeadline = new Date(Date.now() + (30 * 24 * 60 * 60 * 1000));

      const result = await query(`
        INSERT INTO data_subject_requests (
          request_type, request_reference, data_subject_type, data_subject_id,
          requester_name, requester_email, requester_phone, relationship_to_subject,
          data_categories_requested, date_range_from, date_range_to,
          specific_records_requested, reason_for_request, statutory_deadline, school_id
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
        )
        RETURNING *
      `, [
        requestType, requestReference, dataSubjectType, dataSubjectId,
        requesterName, requesterEmail, requesterPhone, relationshipToSubject,
        dataCategoriesRequested, dateRangeFrom, dateRangeTo,
        specificRecordsRequested, reasonForRequest, statutoryDeadline, schoolId
      ]);

      return result.rows[0];
    } catch (error) {
      throw new DatabaseError('Failed to create data subject request', error);
    }
  }

  // Generate unique request reference
  async generateRequestReference(requestType) {
    const year = new Date().getFullYear();
    const typePrefix = requestType.substring(0, 3).toUpperCase();
    
    const result = await query(`
      SELECT COUNT(*) + 1 as next_seq
      FROM data_subject_requests
      WHERE request_reference LIKE $1
    `, [`${typePrefix}${year}%`]);

    const sequenceNumber = result.rows[0].next_seq.toString().padStart(4, '0');
    return `${typePrefix}${year}${sequenceNumber}`;
  }

  // Update data subject request status
  async updateDataSubjectRequest(requestId, updateData) {
    try {
      const {
        processingStatus,
        assignedTo,
        identityVerified,
        identityVerificationMethod,
        identityVerificationDate,
        legalBasisConfirmed,
        legalReviewNotes,
        exemptionsApplied,
        dataSourcesSearched,
        recordsFoundCount,
        dataCollectionCompleted,
        dataCollectionNotes,
        thirdPartiesContacted,
        thirdPartyResponses,
        responseFormat,
        responseDeliveryMethod,
        responseSentDate,
        completionNotes,
        reviewedBy,
        reviewApproved,
        reviewComments
      } = updateData;

      const result = await query(`
        UPDATE data_subject_requests
        SET 
          processing_status = COALESCE($2, processing_status),
          assigned_to = COALESCE($3, assigned_to),
          identity_verified = COALESCE($4, identity_verified),
          identity_verification_method = COALESCE($5, identity_verification_method),
          identity_verification_date = COALESCE($6, identity_verification_date),
          legal_basis_confirmed = COALESCE($7, legal_basis_confirmed),
          legal_review_notes = COALESCE($8, legal_review_notes),
          exemptions_applied = COALESCE($9, exemptions_applied),
          data_sources_searched = COALESCE($10, data_sources_searched),
          records_found_count = COALESCE($11, records_found_count),
          data_collection_completed = COALESCE($12, data_collection_completed),
          data_collection_notes = COALESCE($13, data_collection_notes),
          third_parties_contacted = COALESCE($14, third_parties_contacted),
          third_party_responses = COALESCE($15, third_party_responses),
          response_format = COALESCE($16, response_format),
          response_delivery_method = COALESCE($17, response_delivery_method),
          response_sent_date = COALESCE($18, response_sent_date),
          completion_notes = COALESCE($19, completion_notes),
          reviewed_by = COALESCE($20, reviewed_by),
          review_approved = COALESCE($21, review_approved),
          review_comments = COALESCE($22, review_comments),
          updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `, [
        requestId, processingStatus, assignedTo, identityVerified, identityVerificationMethod,
        identityVerificationDate, legalBasisConfirmed, legalReviewNotes, exemptionsApplied,
        dataSourcesSearched, recordsFoundCount, dataCollectionCompleted, dataCollectionNotes,
        thirdPartiesContacted, JSON.stringify(thirdPartyResponses), responseFormat,
        responseDeliveryMethod, responseSentDate, completionNotes, reviewedBy,
        reviewApproved, reviewComments
      ]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Data subject request not found');
      }

      // Check if deadline is met
      const request = result.rows[0];
      const deadlineMet = request.response_sent_date <= request.statutory_deadline;
      
      if (request.processing_status === 'completed') {
        await query(`
          UPDATE data_subject_requests
          SET deadline_met = $2
          WHERE id = $1
        `, [requestId, deadlineMet]);
      }

      return result.rows[0];
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new DatabaseError('Failed to update data subject request', error);
    }
  }

  // Get data subject requests
  async getDataSubjectRequests(filters = {}) {
    try {
      let whereConditions = ['1=1'];
      let queryParams = [];
      let paramCount = 0;

      if (filters.requestType) {
        paramCount++;
        whereConditions.push(`request_type = $${paramCount}`);
        queryParams.push(filters.requestType);
      }

      if (filters.processingStatus) {
        paramCount++;
        whereConditions.push(`processing_status = $${paramCount}`);
        queryParams.push(filters.processingStatus);
      }

      if (filters.schoolId) {
        paramCount++;
        whereConditions.push(`school_id = $${paramCount}`);
        queryParams.push(filters.schoolId);
      }

      if (filters.assignedTo) {
        paramCount++;
        whereConditions.push(`assigned_to = $${paramCount}`);
        queryParams.push(filters.assignedTo);
      }

      if (filters.overdue) {
        whereConditions.push(`statutory_deadline < NOW() AND processing_status NOT IN ('completed', 'rejected')`);
      }

      const limit = Math.min(filters.limit || 50, 200);
      const offset = (filters.page - 1) * limit || 0;

      const result = await query(`
        SELECT 
          dsr.*,
          u1.first_name as assigned_first_name,
          u1.last_name as assigned_last_name,
          u2.first_name as reviewer_first_name,
          u2.last_name as reviewer_last_name,
          s.name as school_name,
          EXTRACT(DAYS FROM (statutory_deadline - NOW())) as days_to_deadline
        FROM data_subject_requests dsr
        LEFT JOIN users u1 ON u1.id = dsr.assigned_to
        LEFT JOIN users u2 ON u2.id = dsr.reviewed_by
        LEFT JOIN schools s ON s.id = dsr.school_id
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY dsr.received_date DESC
        LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
      `, [...queryParams, limit, offset]);

      return result.rows;
    } catch (error) {
      throw new DatabaseError('Failed to get data subject requests', error);
    }
  }

  /**
   * Compliance Framework Management
   */

  // Get compliance frameworks
  async getComplianceFrameworks(filters = {}) {
    try {
      let whereConditions = ['is_active = true'];
      let queryParams = [];
      let paramCount = 0;

      if (filters.jurisdiction) {
        paramCount++;
        whereConditions.push(`jurisdiction = $${paramCount}`);
        queryParams.push(filters.jurisdiction);
      }

      if (filters.mandatory) {
        whereConditions.push(`mandatory_for_organization = true`);
      }

      const result = await query(`
        SELECT 
          cf.*,
          COUNT(cc.id) as total_controls,
          COUNT(cc.id) FILTER (WHERE cc.implementation_status = 'implemented') as implemented_controls,
          COUNT(cc.id) FILTER (WHERE cc.last_assessment_result = 'compliant') as compliant_controls
        FROM compliance_frameworks cf
        LEFT JOIN compliance_controls cc ON cc.framework_id = cf.id
        WHERE ${whereConditions.join(' AND ')}
        GROUP BY cf.id
        ORDER BY cf.framework_name
      `, queryParams);

      return result.rows;
    } catch (error) {
      throw new DatabaseError('Failed to get compliance frameworks', error);
    }
  }

  // Get compliance controls for a framework
  async getComplianceControls(frameworkId, schoolId = null) {
    try {
      let schoolCondition = '';
      let queryParams = [frameworkId];
      
      if (schoolId) {
        schoolCondition = 'AND (cc.school_id = $2 OR cc.applies_to_all_schools = true)';
        queryParams.push(schoolId);
      }

      const result = await query(`
        SELECT 
          cc.*,
          cf.framework_name,
          u1.first_name as responsible_first_name,
          u1.last_name as responsible_last_name,
          u2.first_name as assessor_first_name,
          u2.last_name as assessor_last_name
        FROM compliance_controls cc
        JOIN compliance_frameworks cf ON cf.id = cc.framework_id
        LEFT JOIN users u1 ON u1.id = cc.responsible_party
        LEFT JOIN users u2 ON u2.id = cc.assessor_id
        WHERE cc.framework_id = $1 ${schoolCondition}
        ORDER BY cc.control_code
      `, queryParams);

      return result.rows;
    } catch (error) {
      throw new DatabaseError('Failed to get compliance controls', error);
    }
  }

  // Update compliance control
  async updateComplianceControl(controlId, updateData) {
    try {
      const {
        implementationStatus,
        implementationEvidence,
        implementationDate,
        responsibleParty,
        lastAssessmentResult,
        assessmentNotes,
        assessorId,
        complianceGaps,
        remediationActions,
        remediationDeadline,
        remediationCost,
        lastMonitoringDate,
        nextMonitoringDate,
        updatedBy
      } = updateData;

      const result = await query(`
        UPDATE compliance_controls
        SET 
          implementation_status = COALESCE($2, implementation_status),
          implementation_evidence = COALESCE($3, implementation_evidence),
          implementation_date = COALESCE($4, implementation_date),
          responsible_party = COALESCE($5, responsible_party),
          last_assessment_result = COALESCE($6, last_assessment_result),
          assessment_notes = COALESCE($7, assessment_notes),
          assessor_id = COALESCE($8, assessor_id),
          compliance_gaps = COALESCE($9, compliance_gaps),
          remediation_actions = COALESCE($10, remediation_actions),
          remediation_deadline = COALESCE($11, remediation_deadline),
          remediation_cost = COALESCE($12, remediation_cost),
          last_monitoring_date = COALESCE($13, last_monitoring_date),
          next_monitoring_date = COALESCE($14, next_monitoring_date),
          updated_by = COALESCE($15, updated_by),
          updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `, [
        controlId, implementationStatus, implementationEvidence, implementationDate,
        responsibleParty, lastAssessmentResult, assessmentNotes, assessorId,
        complianceGaps, remediationActions, remediationDeadline, remediationCost,
        lastMonitoringDate, nextMonitoringDate, updatedBy
      ]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Compliance control not found');
      }

      return result.rows[0];
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new DatabaseError('Failed to update compliance control', error);
    }
  }

  /**
   * Compliance Analytics and Reporting
   */

  // Get compliance dashboard metrics
  async getComplianceDashboardMetrics(schoolId = null) {
    try {
      let schoolCondition = '';
      let queryParams = [];
      
      if (schoolId) {
        schoolCondition = 'WHERE school_id = $1 OR school_id IS NULL';
        queryParams.push(schoolId);
      }

      const metrics = await query(`
        SELECT 
          (SELECT COUNT(*) FROM data_protection_records ${schoolCondition}) as total_data_records,
          (SELECT COUNT(*) FROM data_protection_records WHERE consent_given = true ${schoolCondition ? 'AND (school_id = $1 OR school_id IS NULL)' : ''}) as consented_records,
          (SELECT COUNT(*) FROM data_protection_records WHERE automatic_deletion_date <= CURRENT_DATE + INTERVAL '30 days' ${schoolCondition ? 'AND (school_id = $1 OR school_id IS NULL)' : ''}) as records_due_deletion,
          (SELECT COUNT(*) FROM data_subject_requests WHERE processing_status IN ('received', 'acknowledged', 'processing') ${schoolCondition ? 'AND (school_id = $1 OR school_id IS NULL)' : ''}) as pending_dsr_requests,
          (SELECT COUNT(*) FROM data_subject_requests WHERE statutory_deadline < NOW() AND processing_status NOT IN ('completed', 'rejected') ${schoolCondition ? 'AND (school_id = $1 OR school_id IS NULL)' : ''}) as overdue_dsr_requests,
          (SELECT COUNT(*) FROM compliance_controls WHERE implementation_status = 'implemented' ${schoolCondition ? 'AND (school_id = $1 OR applies_to_all_schools = true)' : ''}) as implemented_controls,
          (SELECT COUNT(*) FROM compliance_controls WHERE last_assessment_result = 'compliant' ${schoolCondition ? 'AND (school_id = $1 OR applies_to_all_schools = true)' : ''}) as compliant_controls,
          (SELECT COUNT(*) FROM compliance_controls WHERE last_assessment_result = 'non_compliant' ${schoolCondition ? 'AND (school_id = $1 OR applies_to_all_schools = true)' : ''}) as non_compliant_controls
      `, queryParams);

      return metrics.rows[0];
    } catch (error) {
      throw new DatabaseError('Failed to get compliance dashboard metrics', error);
    }
  }

  // Get data subject request trends
  async getDataSubjectRequestTrends(days = 90) {
    try {
      const trends = await query(`
        SELECT 
          DATE_TRUNC('week', received_date) as week,
          request_type,
          COUNT(*) as request_count,
          COUNT(*) FILTER (WHERE processing_status = 'completed') as completed_count,
          COUNT(*) FILTER (WHERE deadline_met = true) as deadline_met_count
        FROM data_subject_requests
        WHERE received_date >= NOW() - INTERVAL '1 day' * $1
        GROUP BY DATE_TRUNC('week', received_date), request_type
        ORDER BY week DESC, request_type
      `, [days]);

      return trends.rows;
    } catch (error) {
      throw new DatabaseError('Failed to get data subject request trends', error);
    }
  }

  /**
   * Utility Methods
   */

  // Check if data retention period has expired
  async checkDataRetentionCompliance() {
    try {
      const expiredRecords = await query(`
        SELECT id, data_subject_type, data_subject_id, school_id, automatic_deletion_date
        FROM data_protection_records
        WHERE automatic_deletion_date <= CURRENT_DATE
          AND archived = false
      `);

      return expiredRecords.rows;
    } catch (error) {
      throw new DatabaseError('Failed to check data retention compliance', error);
    }
  }

  // Generate compliance report
  async generateComplianceReport(schoolId = null, frameworkCode = null) {
    try {
      let schoolCondition = '';
      let frameworkCondition = '';
      let queryParams = [];
      let paramCount = 0;

      if (schoolId) {
        paramCount++;
        schoolCondition = 'AND (cc.school_id = $' + paramCount + ' OR cc.applies_to_all_schools = true)';
        queryParams.push(schoolId);
      }

      if (frameworkCode) {
        paramCount++;
        frameworkCondition = 'AND cf.framework_code = $' + paramCount;
        queryParams.push(frameworkCode);
      }

      const report = await query(`
        SELECT 
          cf.framework_code,
          cf.framework_name,
          COUNT(cc.id) as total_controls,
          COUNT(cc.id) FILTER (WHERE cc.implementation_status = 'implemented') as implemented_controls,
          COUNT(cc.id) FILTER (WHERE cc.implementation_status = 'not_implemented') as not_implemented_controls,
          COUNT(cc.id) FILTER (WHERE cc.last_assessment_result = 'compliant') as compliant_controls,
          COUNT(cc.id) FILTER (WHERE cc.last_assessment_result = 'non_compliant') as non_compliant_controls,
          COUNT(cc.id) FILTER (WHERE cc.inherent_risk_level = 'high') as high_risk_controls,
          AVG(CASE 
            WHEN cc.last_assessment_result = 'compliant' THEN 100
            WHEN cc.last_assessment_result = 'partially_compliant' THEN 50
            WHEN cc.last_assessment_result = 'non_compliant' THEN 0
            ELSE NULL
          END) as compliance_percentage
        FROM compliance_frameworks cf
        LEFT JOIN compliance_controls cc ON cc.framework_id = cf.id
        WHERE cf.is_active = true ${frameworkCondition} ${schoolCondition}
        GROUP BY cf.id, cf.framework_code, cf.framework_name
        ORDER BY cf.framework_name
      `, queryParams);

      return report.rows;
    } catch (error) {
      throw new DatabaseError('Failed to generate compliance report', error);
    }
  }
}

module.exports = new ComplianceService();