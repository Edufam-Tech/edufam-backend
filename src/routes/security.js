const express = require('express');
const router = express.Router();
const securityController = require('../controllers/securityController');
const { authenticate, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const { body, param, query } = require('express-validator');

/**
 * Security Routes
 * Handles security audit logging, monitoring, and incident management
 */

// Authentication middleware for all security routes
router.use(authenticate);

// ====================================
// SECURITY AUDIT LOGGING
// ====================================

/**
 * Get security audit logs
 * GET /api/v1/security/audit-logs
 */
router.get('/audit-logs', [
  requireRole(['super_admin', 'edufam_admin', 'security_officer', 'principal', 'school_director']),
  query('eventType').optional().isString().trim().withMessage('Event type must be a string'),
  query('severityLevel').optional().isIn(['low', 'medium', 'high', 'critical']).withMessage('Invalid severity level'),
  query('userId').optional().isUUID().withMessage('User ID must be valid UUID'),
  query('schoolId').optional().isUUID().withMessage('School ID must be valid UUID'),
  query('dateFrom').optional().isISO8601().withMessage('Date from must be valid ISO date'),
  query('dateTo').optional().isISO8601().withMessage('Date to must be valid ISO date'),
  query('minRiskScore').optional().isInt({ min: 0, max: 100 }).withMessage('Risk score must be between 0 and 100'),
  query('highRiskOnly').optional().isBoolean().withMessage('High risk only must be boolean'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 1000 }).withMessage('Limit must be between 1 and 1000')
], validate, securityController.getAuditLogs);

/**
 * Log custom security event
 * POST /api/v1/security/audit-logs
 */
router.post('/audit-logs', [
  requireRole(['super_admin', 'edufam_admin', 'security_officer', 'principal', 'school_director']),
  body('eventType').isString().trim().isLength({ min: 1, max: 50 }).withMessage('Event type is required (1-50 characters)'),
  body('eventCategory').isIn(['authentication', 'authorization', 'data_access', 'system_admin', 'compliance']).withMessage('Valid event category is required'),
  body('severityLevel').isIn(['low', 'medium', 'high', 'critical']).withMessage('Valid severity level is required'),
  body('eventDescription').isString().trim().isLength({ min: 1, max: 1000 }).withMessage('Event description is required (1-1000 characters)'),
  body('eventDetails').optional().isObject().withMessage('Event details must be an object'),
  body('dataSensitivity').optional().isIn(['public', 'internal', 'confidential', 'restricted']).withMessage('Invalid data sensitivity level'),
  body('threatIndicators').optional().isArray().withMessage('Threat indicators must be an array'),
  body('anomalyScore').optional().isFloat({ min: 0, max: 100 }).withMessage('Anomaly score must be between 0 and 100')
], validate, securityController.logSecurityEvent);

// ====================================
// SECURITY INCIDENT MANAGEMENT
// ====================================

/**
 * Create security incident
 * POST /api/v1/security/incidents
 */
router.post('/incidents', [
  requireRole(['super_admin', 'edufam_admin', 'security_officer', 'principal', 'school_director']),
  body('incidentType').isString().trim().isLength({ min: 1, max: 50 }).withMessage('Incident type is required'),
  body('incidentCategory').isIn(['security', 'privacy', 'operational', 'compliance']).withMessage('Valid incident category is required'),
  body('severityLevel').isIn(['low', 'medium', 'high', 'critical']).withMessage('Valid severity level is required'),
  body('urgencyLevel').isIn(['low', 'medium', 'high', 'urgent']).withMessage('Valid urgency level is required'),
  body('title').isString().trim().isLength({ min: 1, max: 255 }).withMessage('Title is required (1-255 characters)'),
  body('description').isString().trim().isLength({ min: 1, max: 2000 }).withMessage('Description is required (1-2000 characters)'),
  body('impactAssessment').optional().isString().trim().withMessage('Impact assessment must be a string'),
  body('affectedSystems').optional().isArray().withMessage('Affected systems must be an array'),
  body('affectedDataTypes').optional().isArray().withMessage('Affected data types must be an array'),
  body('estimatedRecordsAffected').optional().isInt({ min: 0 }).withMessage('Estimated records affected must be a positive integer'),
  body('incidentDetectedAt').optional().isISO8601().withMessage('Incident detected at must be valid ISO date'),
  body('incidentOccurredAt').optional().isISO8601().withMessage('Incident occurred at must be valid ISO date'),
  body('detectedBy').optional().isString().trim().withMessage('Detected by must be a string'),
  body('detectionMethod').optional().isString().trim().withMessage('Detection method must be a string'),
  body('confidentialityImpact').optional().isIn(['none', 'low', 'medium', 'high']).withMessage('Invalid confidentiality impact'),
  body('integrityImpact').optional().isIn(['none', 'low', 'medium', 'high']).withMessage('Invalid integrity impact'),
  body('availabilityImpact').optional().isIn(['none', 'low', 'medium', 'high']).withMessage('Invalid availability impact'),
  body('financialImpact').optional().isFloat({ min: 0 }).withMessage('Financial impact must be a positive number'),
  body('affectsMultipleSchools').optional().isBoolean().withMessage('Affects multiple schools must be boolean'),
  body('affectedSchools').optional().isArray().withMessage('Affected schools must be an array')
], validate, securityController.createSecurityIncident);

/**
 * Update security incident
 * PUT /api/v1/security/incidents/:incidentId
 */
router.put('/incidents/:incidentId', [
  requireRole(['super_admin', 'edufam_admin', 'security_officer']),
  param('incidentId').isUUID().withMessage('Valid incident ID is required'),
  body('investigationStatus').optional().isIn(['pending', 'in_progress', 'completed', 'closed']).withMessage('Invalid investigation status'),
  body('assignedInvestigator').optional().isUUID().withMessage('Assigned investigator must be valid UUID'),
  body('investigationFindings').optional().isString().trim().withMessage('Investigation findings must be a string'),
  body('rootCauseAnalysis').optional().isString().trim().withMessage('Root cause analysis must be a string'),
  body('containmentActions').optional().isArray().withMessage('Containment actions must be an array'),
  body('containmentStatus').optional().isIn(['none', 'partial', 'full']).withMessage('Invalid containment status'),
  body('eradicationActions').optional().isArray().withMessage('Eradication actions must be an array'),
  body('recoveryActions').optional().isArray().withMessage('Recovery actions must be an array'),
  body('currentStatus').optional().isIn(['open', 'investigating', 'contained', 'resolved', 'closed']).withMessage('Invalid current status'),
  body('resolutionSummary').optional().isString().trim().withMessage('Resolution summary must be a string'),
  body('lessonsLearned').optional().isString().trim().withMessage('Lessons learned must be a string'),
  body('preventiveMeasures').optional().isArray().withMessage('Preventive measures must be an array')
], validate, securityController.updateSecurityIncident);

/**
 * Get security incidents
 * GET /api/v1/security/incidents
 */
router.get('/incidents', [
  requireRole(['super_admin', 'edufam_admin', 'security_officer', 'principal', 'school_director']),
  query('incidentType').optional().isString().trim().withMessage('Incident type must be a string'),
  query('severityLevel').optional().isIn(['low', 'medium', 'high', 'critical']).withMessage('Invalid severity level'),
  query('currentStatus').optional().isIn(['open', 'investigating', 'contained', 'resolved', 'closed']).withMessage('Invalid current status'),
  query('schoolId').optional().isUUID().withMessage('School ID must be valid UUID'),
  query('assignedInvestigator').optional().isUUID().withMessage('Assigned investigator must be valid UUID'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 200 }).withMessage('Limit must be between 1 and 200')
], validate, securityController.getSecurityIncidents);

/**
 * Get security incident details
 * GET /api/v1/security/incidents/:incidentId
 */
router.get('/incidents/:incidentId', [
  requireRole(['super_admin', 'edufam_admin', 'security_officer', 'principal', 'school_director']),
  param('incidentId').isUUID().withMessage('Valid incident ID is required')
], validate, securityController.getSecurityIncident);

// ====================================
// SECURITY ANALYTICS AND MONITORING
// ====================================

/**
 * Get security dashboard
 * GET /api/v1/security/dashboard
 */
router.get('/dashboard', [
  requireRole(['super_admin', 'edufam_admin', 'security_officer', 'principal', 'school_director']),
  query('timeframe').optional().isIn(['24hours', '7days', '30days', '90days']).withMessage('Invalid timeframe')
], validate, securityController.getSecurityDashboard);

/**
 * Get security trends
 * GET /api/v1/security/trends
 */
router.get('/trends', [
  requireRole(['super_admin', 'edufam_admin', 'security_officer', 'principal', 'school_director']),
  query('days').optional().isInt({ min: 1, max: 365 }).withMessage('Days must be between 1 and 365')
], validate, securityController.getSecurityTrends);

/**
 * Detect anomalous activities
 * GET /api/v1/security/anomalies
 */
router.get('/anomalies', [
  requireRole(['super_admin', 'edufam_admin', 'security_officer']),
  query('userId').optional().isUUID().withMessage('User ID must be valid UUID'),
  query('ipAddress').optional().isIP().withMessage('IP address must be valid'),
  query('timeWindow').optional().isString().trim().withMessage('Time window must be a string')
], validate, securityController.detectAnomalies);

/**
 * Get high-risk events
 * GET /api/v1/security/high-risk-events
 */
router.get('/high-risk-events', [
  requireRole(['super_admin', 'edufam_admin', 'security_officer', 'principal', 'school_director']),
  query('hours').optional().isInt({ min: 1, max: 168 }).withMessage('Hours must be between 1 and 168 (7 days)')
], validate, securityController.getHighRiskEvents);

/**
 * Get failed login attempts
 * GET /api/v1/security/failed-logins
 */
router.get('/failed-logins', [
  requireRole(['super_admin', 'edufam_admin', 'security_officer', 'principal', 'school_director']),
  query('hours').optional().isInt({ min: 1, max: 168 }).withMessage('Hours must be between 1 and 168')
], validate, securityController.getFailedLoginAttempts);

// ====================================
// DATA ACCESS MONITORING
// ====================================

/**
 * Get data access logs
 * GET /api/v1/security/data-access
 */
router.get('/data-access', [
  requireRole(['super_admin', 'edufam_admin', 'security_officer', 'data_protection_officer']),
  query('dataType').optional().isString().trim().withMessage('Data type must be a string'),
  query('studentId').optional().isUUID().withMessage('Student ID must be valid UUID'),
  query('userId').optional().isUUID().withMessage('User ID must be valid UUID'),
  query('dataSensitivity').optional().isIn(['public', 'internal', 'confidential', 'restricted']).withMessage('Invalid data sensitivity level'),
  query('hours').optional().isInt({ min: 1, max: 168 }).withMessage('Hours must be between 1 and 168'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
], validate, securityController.getDataAccessLogs);

// ====================================
// SECURITY ADMINISTRATION
// ====================================

/**
 * Security administrator endpoints
 */

// Archive old audit logs (admin only)
router.post('/admin/archive-logs', [
  requireRole(['super_admin', 'edufam_admin']),
  body('retentionDays').optional().isInt({ min: 365, max: 3650 }).withMessage('Retention days must be between 365 and 3650 (1-10 years)')
], validate, (req, res) => {
  // Placeholder for log archiving functionality
  res.json({
    success: true,
    data: { message: 'Log archiving feature coming soon' },
    message: 'Security log archiving endpoint'
  });
});

// Generate security report (admin only)
router.post('/admin/generate-report', [
  requireRole(['super_admin', 'edufam_admin', 'security_officer']),
  body('reportType').isIn(['security_summary', 'incident_report', 'risk_assessment', 'compliance_audit']).withMessage('Valid report type is required'),
  body('dateFrom').isISO8601().withMessage('Valid start date is required'),
  body('dateTo').isISO8601().withMessage('Valid end date is required'),
  body('schoolId').optional().isUUID().withMessage('School ID must be valid UUID'),
  body('includePersonalData').optional().isBoolean().withMessage('Include personal data must be boolean')
], validate, (req, res) => {
  // Placeholder for report generation
  res.json({
    success: true,
    data: { message: 'Security report generation feature coming soon' },
    message: 'Security report generation endpoint'
  });
});

// ====================================
// HEALTH CHECK
// ====================================

/**
 * Security service health check
 * GET /api/v1/security/health
 */
router.get('/health', securityController.getSecurityServiceHealth);

// ====================================
// MIDDLEWARE FOR SECURITY LOGGING
// ====================================

/**
 * Security event logging middleware
 * This middleware can be used to automatically log security events
 */
router.use('/log-middleware', (req, res, next) => {
  // Placeholder for security logging middleware
  res.json({
    success: true,
    data: {
      message: 'Security logging middleware endpoint',
      features: [
        'automatic_event_logging',
        'request_response_monitoring',
        'anomaly_detection',
        'threat_intelligence_integration'
      ]
    },
    message: 'Security logging middleware configuration'
  });
});

// ====================================
// ERROR HANDLING
// ====================================

// Global error handler for security routes
router.use((error, req, res, next) => {
  console.error('Security route error:', error);
  
  res.status(error.statusCode || 500).json({
    success: false,
    error: {
      code: error.code || 'SECURITY_ERROR',
      message: error.message || 'An error occurred in security management'
    }
  });
});

module.exports = router;