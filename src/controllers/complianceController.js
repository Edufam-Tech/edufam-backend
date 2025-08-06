const complianceService = require('../services/complianceService');
const realtimeIntegrations = require('../integrations/realtimeIntegrations');
const { asyncHandler } = require('../middleware/errorHandler');
const { ValidationError } = require('../middleware/errorHandler');

/**
 * Compliance Controller
 * Handles GDPR compliance, data protection, and regulatory requirements
 */
class ComplianceController {

  /**
   * Data Protection Records Management
   */

  // Create data protection record
  createDataProtectionRecord = asyncHandler(async (req, res) => {
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
      securityClassification
    } = req.body;

    // Validate required fields
    if (!dataSubjectType || !dataCategories || !legalBasis || !processingPurpose) {
      throw new ValidationError('Data subject type, data categories, legal basis, and processing purpose are required');
    }

    const record = await complianceService.createDataProtectionRecord({
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
      schoolId: req.activeSchoolId || req.user.schoolId,
      createdBy: req.user.userId
    });

    res.status(201).json({
      success: true,
      data: { record },
      message: 'Data protection record created successfully'
    });
  });

  // Update consent status
  updateConsent = asyncHandler(async (req, res) => {
    const { recordId } = req.params;
    const {
      consentGiven,
      consentDate,
      consentWithdrawn,
      consentWithdrawalDate,
      consentEvidence
    } = req.body;

    const record = await complianceService.updateConsent(recordId, {
      consentGiven,
      consentDate,
      consentWithdrawn,
      consentWithdrawalDate,
      consentEvidence
    });

    res.json({
      success: true,
      data: { record },
      message: 'Consent status updated successfully'
    });
  });

  // Get data protection records
  getDataProtectionRecords = asyncHandler(async (req, res) => {
    const filters = {
      dataSubjectType: req.query.dataSubjectType,
      dataSubjectId: req.query.dataSubjectId,
      legalBasis: req.query.legalBasis,
      schoolId: req.query.schoolId || req.activeSchoolId,
      consentRequired: req.query.consentRequired === 'true',
      deletionDue: req.query.deletionDue === 'true',
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 100
    };

    // Remove undefined values
    Object.keys(filters).forEach(key => 
      filters[key] === undefined && delete filters[key]
    );

    const records = await complianceService.getDataProtectionRecords(filters);

    res.json({
      success: true,
      data: {
        records,
        pagination: {
          page: filters.page,
          limit: filters.limit,
          hasMore: records.length === filters.limit
        }
      },
      message: 'Data protection records retrieved successfully'
    });
  });

  /**
   * Data Subject Rights Requests (GDPR)
   */

  // Create data subject rights request
  createDataSubjectRequest = asyncHandler(async (req, res) => {
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
      reasonForRequest
    } = req.body;

    // Validate required fields
    if (!requestType || !dataSubjectType || !requesterName || !requesterEmail) {
      throw new ValidationError('Request type, data subject type, requester name, and email are required');
    }

    const request = await complianceService.createDataSubjectRequest({
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
      schoolId: req.activeSchoolId || req.user.schoolId
    });

    // Send notification about new data subject request
    try {
      await realtimeIntegrations.createCustomEvent({
        eventType: 'dsr_request_created',
        schoolId: req.activeSchoolId || req.user.schoolId,
        sourceUserId: req.user.userId,
        targetRoles: ['data_protection_officer', 'principal', 'super_admin'],
        title: 'New Data Subject Rights Request',
        message: `A new ${requestType} request has been submitted by ${requesterName}`,
        eventPayload: {
          requestId: request.id,
          requestReference: request.request_reference,
          requestType,
          requesterName,
          statutoryDeadline: request.statutory_deadline
        },
        priority: 'high',
        sourceEntityType: 'data_subject_request',
        sourceEntityId: request.id,
        actionUrl: `/compliance/dsr-requests/${request.id}`
      });
    } catch (error) {
      console.error('Failed to send DSR notification:', error);
    }

    res.status(201).json({
      success: true,
      data: { request },
      message: 'Data subject rights request created successfully'
    });
  });

  // Update data subject request
  updateDataSubjectRequest = asyncHandler(async (req, res) => {
    const { requestId } = req.params;
    
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
    } = req.body;

    const request = await complianceService.updateDataSubjectRequest(requestId, {
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
    });

    res.json({
      success: true,
      data: { request },
      message: 'Data subject request updated successfully'
    });
  });

  // Get data subject requests
  getDataSubjectRequests = asyncHandler(async (req, res) => {
    const filters = {
      requestType: req.query.requestType,
      processingStatus: req.query.processingStatus,
      schoolId: req.query.schoolId || req.activeSchoolId,
      assignedTo: req.query.assignedTo,
      overdue: req.query.overdue === 'true',
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 50
    };

    // Remove undefined values
    Object.keys(filters).forEach(key => 
      filters[key] === undefined && delete filters[key]
    );

    const requests = await complianceService.getDataSubjectRequests(filters);

    res.json({
      success: true,
      data: {
        requests,
        pagination: {
          page: filters.page,
          limit: filters.limit,
          hasMore: requests.length === filters.limit
        }
      },
      message: 'Data subject requests retrieved successfully'
    });
  });

  // Get data subject request details
  getDataSubjectRequest = asyncHandler(async (req, res) => {
    const { requestId } = req.params;
    
    const requests = await complianceService.getDataSubjectRequests({ 
      requestId: requestId,
      limit: 1 
    });

    if (requests.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'DSR_REQUEST_NOT_FOUND',
          message: 'Data subject request not found'
        }
      });
    }

    res.json({
      success: true,
      data: { request: requests[0] },
      message: 'Data subject request details retrieved successfully'
    });
  });

  /**
   * Compliance Framework Management
   */

  // Get compliance frameworks
  getComplianceFrameworks = asyncHandler(async (req, res) => {
    const filters = {
      jurisdiction: req.query.jurisdiction,
      mandatory: req.query.mandatory === 'true'
    };

    // Remove undefined values
    Object.keys(filters).forEach(key => 
      filters[key] === undefined && delete filters[key]
    );

    const frameworks = await complianceService.getComplianceFrameworks(filters);

    res.json({
      success: true,
      data: { frameworks },
      message: 'Compliance frameworks retrieved successfully'
    });
  });

  // Get compliance controls
  getComplianceControls = asyncHandler(async (req, res) => {
    const { frameworkId } = req.params;
    const schoolId = req.query.schoolId || req.activeSchoolId;

    const controls = await complianceService.getComplianceControls(frameworkId, schoolId);

    res.json({
      success: true,
      data: { controls },
      message: 'Compliance controls retrieved successfully'
    });
  });

  // Update compliance control
  updateComplianceControl = asyncHandler(async (req, res) => {
    const { controlId } = req.params;
    
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
      nextMonitoringDate
    } = req.body;

    const control = await complianceService.updateComplianceControl(controlId, {
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
      updatedBy: req.user.userId
    });

    res.json({
      success: true,
      data: { control },
      message: 'Compliance control updated successfully'
    });
  });

  /**
   * Compliance Analytics and Reporting
   */

  // Get compliance dashboard
  getComplianceDashboard = asyncHandler(async (req, res) => {
    const schoolId = req.activeSchoolId || req.user.schoolId;

    const metrics = await complianceService.getComplianceDashboardMetrics(schoolId);
    const trends = await complianceService.getDataSubjectRequestTrends(90);

    res.json({
      success: true,
      data: {
        metrics,
        trends,
        schoolId,
        timestamp: new Date().toISOString()
      },
      message: 'Compliance dashboard retrieved successfully'
    });
  });

  // Generate compliance report
  generateComplianceReport = asyncHandler(async (req, res) => {
    const {
      schoolId,
      frameworkCode
    } = req.query;

    const targetSchoolId = schoolId || req.activeSchoolId;
    const report = await complianceService.generateComplianceReport(targetSchoolId, frameworkCode);

    res.json({
      success: true,
      data: {
        report,
        criteria: {
          schoolId: targetSchoolId,
          frameworkCode,
          generatedAt: new Date().toISOString()
        }
      },
      message: 'Compliance report generated successfully'
    });
  });

  // Get data retention compliance status
  getDataRetentionCompliance = asyncHandler(async (req, res) => {
    const expiredRecords = await complianceService.checkDataRetentionCompliance();

    res.json({
      success: true,
      data: {
        expiredRecords,
        summary: {
          totalExpiredRecords: expiredRecords.length,
          actionRequired: expiredRecords.length > 0,
          lastChecked: new Date().toISOString()
        }
      },
      message: 'Data retention compliance status retrieved successfully'
    });
  });

  /**
   * GDPR-Specific Features
   */

  // Get GDPR compliance status
  getGdprComplianceStatus = asyncHandler(async (req, res) => {
    const schoolId = req.activeSchoolId || req.user.schoolId;

    // Get GDPR-specific metrics
    const gdprFrameworks = await complianceService.getComplianceFrameworks({ 
      jurisdiction: 'EU' 
    });

    const gdprFramework = gdprFrameworks.find(f => f.framework_code === 'GDPR');
    
    if (!gdprFramework) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'GDPR_FRAMEWORK_NOT_FOUND',
          message: 'GDPR compliance framework not found'
        }
      });
    }

    const controls = await complianceService.getComplianceControls(gdprFramework.id, schoolId);
    const dataRecords = await complianceService.getDataProtectionRecords({ 
      schoolId, 
      limit: 1000 
    });

    const complianceScore = controls.length > 0 ? 
      (controls.filter(c => c.last_assessment_result === 'compliant').length / controls.length) * 100 : 0;

    res.json({
      success: true,
      data: {
        framework: gdprFramework,
        complianceScore: Math.round(complianceScore),
        totalControls: controls.length,
        compliantControls: controls.filter(c => c.last_assessment_result === 'compliant').length,
        nonCompliantControls: controls.filter(c => c.last_assessment_result === 'non_compliant').length,
        dataRecords: {
          total: dataRecords.length,
          withConsent: dataRecords.filter(r => r.consent_given).length,
          needingAction: dataRecords.filter(r => r.automatic_deletion_date && new Date(r.automatic_deletion_date) <= new Date()).length
        },
        lastAssessed: new Date().toISOString()
      },
      message: 'GDPR compliance status retrieved successfully'
    });
  });

  /**
   * Data Subject Portal (Public Endpoints)
   */

  // Submit data subject request (public endpoint)
  submitPublicDataSubjectRequest = asyncHandler(async (req, res) => {
    // This would be a public endpoint for data subjects to submit requests
    // without authentication
    const {
      requestType,
      dataSubjectType,
      requesterName,
      requesterEmail,
      requesterPhone,
      relationshipToSubject,
      reasonForRequest,
      schoolName
    } = req.body;

    // Validate required fields
    if (!requestType || !dataSubjectType || !requesterName || !requesterEmail || !schoolName) {
      throw new ValidationError('Request type, data subject type, name, email, and school name are required');
    }

    // Find school by name (in production, this might be more sophisticated)
    const schoolResult = await complianceService.query(`
      SELECT id FROM schools WHERE name ILIKE $1 LIMIT 1
    `, [`%${schoolName}%`]);

    const schoolId = schoolResult.rows[0]?.id;

    const request = await complianceService.createDataSubjectRequest({
      requestType,
      dataSubjectType,
      dataSubjectId: null, // External request
      requesterName,
      requesterEmail,
      requesterPhone,
      relationshipToSubject,
      dataCategoriesRequested: null,
      dateRangeFrom: null,
      dateRangeTo: null,
      specificRecordsRequested: null,
      reasonForRequest,
      schoolId
    });

    res.status(201).json({
      success: true,
      data: { 
        requestReference: request.request_reference,
        estimatedCompletionDate: request.statutory_deadline
      },
      message: 'Data subject request submitted successfully. You will receive an acknowledgment email shortly.'
    });
  });

  /**
   * Health Check
   */

  // Get compliance service health
  getComplianceServiceHealth = asyncHandler(async (req, res) => {
    const schoolId = req.activeSchoolId || req.user.schoolId;
    const metrics = await complianceService.getComplianceDashboardMetrics(schoolId);

    res.json({
      success: true,
      data: {
        service: 'Compliance Management Service',
        status: 'healthy',
        features: [
          'gdpr_compliance',
          'data_protection_records',
          'data_subject_rights',
          'compliance_frameworks',
          'audit_reporting',
          'consent_management',
          'data_retention',
          'breach_management'
        ],
        metrics: {
          totalDataRecords: metrics.total_data_records,
          pendingDSRRequests: metrics.pending_dsr_requests,
          overdueDSRRequests: metrics.overdue_dsr_requests,
          implementedControls: metrics.implemented_controls,
          recordsDueDeletion: metrics.records_due_deletion
        },
        timestamp: new Date().toISOString()
      },
      message: 'Compliance service health check completed'
    });
  });
}

module.exports = new ComplianceController();