const express = require('express');
const router = express.Router();
const complianceController = require('../controllers/complianceController');
const { authenticate, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const { body, param, query } = require('express-validator');

/**
 * Compliance Routes
 * Handles GDPR compliance, data protection, and regulatory requirements
 */

// Authentication middleware for all compliance routes (except public endpoints)
// Public endpoints will handle authentication separately

// ====================================
// DATA PROTECTION RECORDS
// ====================================

/**
 * Create data protection record
 * POST /api/v1/compliance/data-protection
 */
router.post('/data-protection', [
  authenticate,
  requireRole(['super_admin', 'edufam_admin', 'data_protection_officer', 'principal', 'school_director']),
  body('dataSubjectType').isIn(['student', 'parent', 'teacher', 'employee', 'visitor']).withMessage('Valid data subject type is required'),
  body('dataSubjectId').optional().isUUID().withMessage('Data subject ID must be valid UUID'),
  body('externalSubjectId').optional().isString().trim().withMessage('External subject ID must be a string'),
  body('dataCategories').isArray({ min: 1 }).withMessage('Data categories array is required'),
  body('sensitiveDataCategories').optional().isArray().withMessage('Sensitive data categories must be an array'),
  body('dataLocations').optional().isArray().withMessage('Data locations must be an array'),
  body('legalBasis').isIn(['consent', 'contract', 'legal_obligation', 'vital_interests', 'public_task', 'legitimate_interests']).withMessage('Valid legal basis is required'),
  body('consentGiven').optional().isBoolean().withMessage('Consent given must be boolean'),
  body('consentDate').optional().isISO8601().withMessage('Consent date must be valid ISO date'),
  body('consentEvidence').optional().isObject().withMessage('Consent evidence must be an object'),
  body('processingPurpose').isString().trim().isLength({ min: 1, max: 500 }).withMessage('Processing purpose is required (1-500 characters)'),
  body('processingActivities').optional().isArray().withMessage('Processing activities must be an array'),
  body('retentionPeriodMonths').optional().isInt({ min: 1, max: 1200 }).withMessage('Retention period must be between 1 and 1200 months'),
  body('sharedWithThirdParties').optional().isBoolean().withMessage('Shared with third parties must be boolean'),
  body('thirdPartyDetails').optional().isObject().withMessage('Third party details must be an object'),
  body('internationalTransfers').optional().isBoolean().withMessage('International transfers must be boolean'),
  body('transferSafeguards').optional().isString().trim().withMessage('Transfer safeguards must be a string'),
  body('encryptionStatus').optional().isIn(['none', 'at_rest', 'in_transit', 'full']).withMessage('Invalid encryption status'),
  body('accessControls').optional().isArray().withMessage('Access controls must be an array'),
  body('securityClassification').optional().isIn(['public', 'internal', 'confidential', 'restricted']).withMessage('Invalid security classification')
], validate, complianceController.createDataProtectionRecord);

/**
 * Update consent status
 * PUT /api/v1/compliance/data-protection/:recordId/consent
 */
router.put('/data-protection/:recordId/consent', [
  authenticate,
  requireRole(['super_admin', 'edufam_admin', 'data_protection_officer', 'principal', 'school_director']),
  param('recordId').isUUID().withMessage('Valid record ID is required'),
  body('consentGiven').optional().isBoolean().withMessage('Consent given must be boolean'),
  body('consentDate').optional().isISO8601().withMessage('Consent date must be valid ISO date'),
  body('consentWithdrawn').optional().isBoolean().withMessage('Consent withdrawn must be boolean'),
  body('consentWithdrawalDate').optional().isISO8601().withMessage('Consent withdrawal date must be valid ISO date'),
  body('consentEvidence').optional().isObject().withMessage('Consent evidence must be an object')
], validate, complianceController.updateConsent);

/**
 * Get data protection records
 * GET /api/v1/compliance/data-protection
 */
router.get('/data-protection', [
  authenticate,
  requireRole(['super_admin', 'edufam_admin', 'data_protection_officer', 'principal', 'school_director']),
  query('dataSubjectType').optional().isIn(['student', 'parent', 'teacher', 'employee', 'visitor']).withMessage('Invalid data subject type'),
  query('dataSubjectId').optional().isUUID().withMessage('Data subject ID must be valid UUID'),
  query('legalBasis').optional().isIn(['consent', 'contract', 'legal_obligation', 'vital_interests', 'public_task', 'legitimate_interests']).withMessage('Invalid legal basis'),
  query('schoolId').optional().isUUID().withMessage('School ID must be valid UUID'),
  query('consentRequired').optional().isBoolean().withMessage('Consent required must be boolean'),
  query('deletionDue').optional().isBoolean().withMessage('Deletion due must be boolean'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 500 }).withMessage('Limit must be between 1 and 500')
], validate, complianceController.getDataProtectionRecords);

// ====================================
// DATA SUBJECT RIGHTS REQUESTS (GDPR)
// ====================================

/**
 * Create data subject rights request
 * POST /api/v1/compliance/dsr-requests
 */
router.post('/dsr-requests', [
  authenticate,
  requireRole(['super_admin', 'edufam_admin', 'data_protection_officer', 'principal', 'school_director', 'parent', 'student']),
  body('requestType').isIn(['access', 'rectification', 'erasure', 'portability', 'restriction', 'objection']).withMessage('Valid request type is required'),
  body('dataSubjectType').isIn(['student', 'parent', 'teacher', 'employee']).withMessage('Valid data subject type is required'),
  body('dataSubjectId').optional().isUUID().withMessage('Data subject ID must be valid UUID'),
  body('requesterName').isString().trim().isLength({ min: 1, max: 255 }).withMessage('Requester name is required (1-255 characters)'),
  body('requesterEmail').isEmail().withMessage('Valid requester email is required'),
  body('requesterPhone').optional().isString().trim().withMessage('Requester phone must be a string'),
  body('relationshipToSubject').optional().isString().trim().withMessage('Relationship to subject must be a string'),
  body('dataCategoriesRequested').optional().isArray().withMessage('Data categories requested must be an array'),
  body('dateRangeFrom').optional().isISO8601().withMessage('Date range from must be valid ISO date'),
  body('dateRangeTo').optional().isISO8601().withMessage('Date range to must be valid ISO date'),
  body('specificRecordsRequested').optional().isString().trim().withMessage('Specific records requested must be a string'),
  body('reasonForRequest').optional().isString().trim().withMessage('Reason for request must be a string')
], validate, complianceController.createDataSubjectRequest);

/**
 * Update data subject request
 * PUT /api/v1/compliance/dsr-requests/:requestId
 */
router.put('/dsr-requests/:requestId', [
  authenticate,
  requireRole(['super_admin', 'edufam_admin', 'data_protection_officer']),
  param('requestId').isUUID().withMessage('Valid request ID is required'),
  body('processingStatus').optional().isIn(['received', 'acknowledged', 'processing', 'completed', 'rejected', 'partially_fulfilled']).withMessage('Invalid processing status'),
  body('assignedTo').optional().isUUID().withMessage('Assigned to must be valid UUID'),
  body('identityVerified').optional().isBoolean().withMessage('Identity verified must be boolean'),
  body('identityVerificationMethod').optional().isString().trim().withMessage('Identity verification method must be a string'),
  body('identityVerificationDate').optional().isISO8601().withMessage('Identity verification date must be valid ISO date'),
  body('legalBasisConfirmed').optional().isBoolean().withMessage('Legal basis confirmed must be boolean'),
  body('legalReviewNotes').optional().isString().trim().withMessage('Legal review notes must be a string'),
  body('exemptionsApplied').optional().isArray().withMessage('Exemptions applied must be an array'),
  body('dataSourcesSearched').optional().isArray().withMessage('Data sources searched must be an array'),
  body('recordsFoundCount').optional().isInt({ min: 0 }).withMessage('Records found count must be a positive integer'),
  body('dataCollectionCompleted').optional().isBoolean().withMessage('Data collection completed must be boolean'),
  body('dataCollectionNotes').optional().isString().trim().withMessage('Data collection notes must be a string'),
  body('thirdPartiesContacted').optional().isBoolean().withMessage('Third parties contacted must be boolean'),
  body('thirdPartyResponses').optional().isObject().withMessage('Third party responses must be an object'),
  body('responseFormat').optional().isIn(['pdf', 'csv', 'json', 'hard_copy']).withMessage('Invalid response format'),
  body('responseDeliveryMethod').optional().isIn(['email', 'postal', 'secure_download', 'in_person']).withMessage('Invalid response delivery method'),
  body('responseSentDate').optional().isISO8601().withMessage('Response sent date must be valid ISO date'),
  body('completionNotes').optional().isString().trim().withMessage('Completion notes must be a string'),
  body('reviewedBy').optional().isUUID().withMessage('Reviewed by must be valid UUID'),
  body('reviewApproved').optional().isBoolean().withMessage('Review approved must be boolean'),
  body('reviewComments').optional().isString().trim().withMessage('Review comments must be a string')
], validate, complianceController.updateDataSubjectRequest);

/**
 * Get data subject requests
 * GET /api/v1/compliance/dsr-requests
 */
router.get('/dsr-requests', [
  authenticate,
  requireRole(['super_admin', 'edufam_admin', 'data_protection_officer', 'principal', 'school_director']),
  query('requestType').optional().isIn(['access', 'rectification', 'erasure', 'portability', 'restriction', 'objection']).withMessage('Invalid request type'),
  query('processingStatus').optional().isIn(['received', 'acknowledged', 'processing', 'completed', 'rejected', 'partially_fulfilled']).withMessage('Invalid processing status'),
  query('schoolId').optional().isUUID().withMessage('School ID must be valid UUID'),
  query('assignedTo').optional().isUUID().withMessage('Assigned to must be valid UUID'),
  query('overdue').optional().isBoolean().withMessage('Overdue must be boolean'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 200 }).withMessage('Limit must be between 1 and 200')
], validate, complianceController.getDataSubjectRequests);

/**
 * Get data subject request details
 * GET /api/v1/compliance/dsr-requests/:requestId
 */
router.get('/dsr-requests/:requestId', [
  authenticate,
  requireRole(['super_admin', 'edufam_admin', 'data_protection_officer', 'principal', 'school_director']),
  param('requestId').isUUID().withMessage('Valid request ID is required')
], validate, complianceController.getDataSubjectRequest);

// ====================================
// COMPLIANCE FRAMEWORKS
// ====================================

/**
 * Get compliance frameworks
 * GET /api/v1/compliance/frameworks
 */
router.get('/frameworks', [
  authenticate,
  requireRole(['super_admin', 'edufam_admin', 'data_protection_officer', 'compliance_officer']),
  query('jurisdiction').optional().isString().trim().withMessage('Jurisdiction must be a string'),
  query('mandatory').optional().isBoolean().withMessage('Mandatory must be boolean')
], validate, complianceController.getComplianceFrameworks);

/**
 * Get compliance controls for a framework
 * GET /api/v1/compliance/frameworks/:frameworkId/controls
 */
router.get('/frameworks/:frameworkId/controls', [
  authenticate,
  requireRole(['super_admin', 'edufam_admin', 'data_protection_officer', 'compliance_officer', 'principal', 'school_director']),
  param('frameworkId').isUUID().withMessage('Valid framework ID is required'),
  query('schoolId').optional().isUUID().withMessage('School ID must be valid UUID')
], validate, complianceController.getComplianceControls);

/**
 * Update compliance control
 * PUT /api/v1/compliance/controls/:controlId
 */
router.put('/controls/:controlId', [
  authenticate,
  requireRole(['super_admin', 'edufam_admin', 'data_protection_officer', 'compliance_officer']),
  param('controlId').isUUID().withMessage('Valid control ID is required'),
  body('implementationStatus').optional().isIn(['not_implemented', 'partially_implemented', 'implemented', 'not_applicable']).withMessage('Invalid implementation status'),
  body('implementationEvidence').optional().isString().trim().withMessage('Implementation evidence must be a string'),
  body('implementationDate').optional().isISO8601().withMessage('Implementation date must be valid ISO date'),
  body('responsibleParty').optional().isUUID().withMessage('Responsible party must be valid UUID'),
  body('lastAssessmentResult').optional().isIn(['compliant', 'non_compliant', 'partially_compliant', 'not_assessed']).withMessage('Invalid assessment result'),
  body('assessmentNotes').optional().isString().trim().withMessage('Assessment notes must be a string'),
  body('assessorId').optional().isUUID().withMessage('Assessor ID must be valid UUID'),
  body('complianceGaps').optional().isArray().withMessage('Compliance gaps must be an array'),
  body('remediationActions').optional().isArray().withMessage('Remediation actions must be an array'),
  body('remediationDeadline').optional().isISO8601().withMessage('Remediation deadline must be valid ISO date'),
  body('remediationCost').optional().isFloat({ min: 0 }).withMessage('Remediation cost must be a positive number'),
  body('lastMonitoringDate').optional().isISO8601().withMessage('Last monitoring date must be valid ISO date'),
  body('nextMonitoringDate').optional().isISO8601().withMessage('Next monitoring date must be valid ISO date')
], validate, complianceController.updateComplianceControl);

// ====================================
// COMPLIANCE ANALYTICS AND REPORTING
// ====================================

/**
 * Get compliance dashboard
 * GET /api/v1/compliance/dashboard
 */
router.get('/dashboard', [
  authenticate,
  requireRole(['super_admin', 'edufam_admin', 'data_protection_officer', 'compliance_officer', 'principal', 'school_director'])
], complianceController.getComplianceDashboard);

/**
 * Generate compliance report
 * GET /api/v1/compliance/reports
 */
router.get('/reports', [
  authenticate,
  requireRole(['super_admin', 'edufam_admin', 'data_protection_officer', 'compliance_officer']),
  query('schoolId').optional().isUUID().withMessage('School ID must be valid UUID'),
  query('frameworkCode').optional().isString().trim().withMessage('Framework code must be a string')
], validate, complianceController.generateComplianceReport);

/**
 * Get data retention compliance status
 * GET /api/v1/compliance/data-retention
 */
router.get('/data-retention', [
  authenticate,
  requireRole(['super_admin', 'edufam_admin', 'data_protection_officer'])
], complianceController.getDataRetentionCompliance);

// ====================================
// GDPR-SPECIFIC FEATURES
// ====================================

/**
 * Get GDPR compliance status
 * GET /api/v1/compliance/gdpr/status
 */
router.get('/gdpr/status', [
  authenticate,
  requireRole(['super_admin', 'edufam_admin', 'data_protection_officer', 'principal', 'school_director'])
], complianceController.getGdprComplianceStatus);

// ====================================
// PUBLIC DATA SUBJECT PORTAL
// ====================================

/**
 * Submit data subject request (public endpoint)
 * POST /api/v1/compliance/public/dsr-request
 */
router.post('/public/dsr-request', [
  body('requestType').isIn(['access', 'rectification', 'erasure', 'portability', 'restriction', 'objection']).withMessage('Valid request type is required'),
  body('dataSubjectType').isIn(['student', 'parent', 'teacher', 'employee']).withMessage('Valid data subject type is required'),
  body('requesterName').isString().trim().isLength({ min: 1, max: 255 }).withMessage('Requester name is required (1-255 characters)'),
  body('requesterEmail').isEmail().withMessage('Valid requester email is required'),
  body('requesterPhone').optional().isString().trim().withMessage('Requester phone must be a string'),
  body('relationshipToSubject').optional().isString().trim().withMessage('Relationship to subject must be a string'),
  body('reasonForRequest').optional().isString().trim().withMessage('Reason for request must be a string'),
  body('schoolName').isString().trim().isLength({ min: 1, max: 255 }).withMessage('School name is required')
], validate, complianceController.submitPublicDataSubjectRequest);

// ====================================
// COMPLIANCE ADMINISTRATION
// ====================================

/**
 * Admin endpoints for compliance management
 */

// Bulk update data protection records (admin only)
router.post('/admin/bulk-update-records', [
  authenticate,
  requireRole(['super_admin', 'edufam_admin']),
  body('recordIds').isArray({ min: 1 }).withMessage('Record IDs array is required'),
  body('updateData').isObject().withMessage('Update data object is required')
], validate, (req, res) => {
  // Placeholder for bulk update functionality
  res.json({
    success: true,
    data: { message: 'Bulk update feature coming soon' },
    message: 'Compliance bulk update endpoint'
  });
});

// Export compliance data (admin only)
router.post('/admin/export-data', [
  authenticate,
  requireRole(['super_admin', 'edufam_admin', 'data_protection_officer']),
  body('exportType').isIn(['data_protection_records', 'dsr_requests', 'compliance_controls', 'audit_trail']).withMessage('Valid export type is required'),
  body('dateFrom').isISO8601().withMessage('Valid start date is required'),
  body('dateTo').isISO8601().withMessage('Valid end date is required'),
  body('schoolId').optional().isUUID().withMessage('School ID must be valid UUID'),
  body('format').optional().isIn(['csv', 'json', 'pdf']).withMessage('Invalid export format')
], validate, (req, res) => {
  // Placeholder for data export functionality
  res.json({
    success: true,
    data: { message: 'Data export feature coming soon' },
    message: 'Compliance data export endpoint'
  });
});

// ====================================
// HEALTH CHECK
// ====================================

/**
 * Compliance service health check
 * GET /api/v1/compliance/health
 */
router.get('/health', [
  authenticate,
  requireRole(['super_admin', 'edufam_admin', 'data_protection_officer'])
], complianceController.getComplianceServiceHealth);

// ====================================
// ERROR HANDLING
// ====================================

// Global error handler for compliance routes
router.use((error, req, res, next) => {
  console.error('Compliance route error:', error);
  
  res.status(error.statusCode || 500).json({
    success: false,
    error: {
      code: error.code || 'COMPLIANCE_ERROR',
      message: error.message || 'An error occurred in compliance management'
    }
  });
});

module.exports = router;