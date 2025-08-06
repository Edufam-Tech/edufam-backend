const express = require('express');
const router = express.Router();
const analyticsAiController = require('../controllers/analyticsAiController');
const { authenticate, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const { body, param, query } = require('express-validator');

/**
 * Advanced Analytics & AI Routes
 * Handles machine learning models, predictive analytics, and intelligent insights
 */

// ====================================
// AUTHENTICATED ENDPOINTS
// ====================================

// Authentication middleware for all routes
router.use(authenticate);

// ====================================
// AI MODEL MANAGEMENT
// ====================================

/**
 * Create AI model
 * POST /api/v1/analytics/models
 */
router.post('/models', [
  requireRole(['super_admin', 'edufam_admin', 'data_scientist']),
  body('modelName').isString().trim().isLength({ min: 1, max: 255 }).withMessage('Model name is required (1-255 characters)'),
  body('modelType').isIn(['classification', 'regression', 'clustering', 'recommendation', 'nlp', 'computer_vision', 'time_series']).withMessage('Valid model type is required'),
  body('modelCategory').isIn(['student_performance', 'risk_prediction', 'resource_optimization', 'sentiment_analysis', 'content_recommendation', 'attendance_prediction', 'fee_prediction']).withMessage('Valid model category is required'),
  body('modelVersion').isString().trim().isLength({ min: 1, max: 20 }).withMessage('Model version is required'),
  body('modelDescription').optional().isString().trim().withMessage('Model description must be a string'),
  body('modelAlgorithm').optional().isString().trim().withMessage('Model algorithm must be a string'),
  body('trainingDataDescription').optional().isString().trim().withMessage('Training data description must be a string'),
  body('featureColumns').optional().isArray().withMessage('Feature columns must be an array'),
  body('targetColumn').optional().isString().trim().withMessage('Target column must be a string'),
  body('modelConfig').optional().isObject().withMessage('Model config must be an object')
], validate, analyticsAiController.createAiModel);

/**
 * Get AI models
 * GET /api/v1/analytics/models
 */
router.get('/models', [
  requireRole(['super_admin', 'edufam_admin', 'data_scientist', 'school_admin', 'principal']),
  query('modelType').optional().isIn(['classification', 'regression', 'clustering', 'recommendation', 'nlp', 'computer_vision', 'time_series']).withMessage('Invalid model type'),
  query('modelCategory').optional().isIn(['student_performance', 'risk_prediction', 'resource_optimization', 'sentiment_analysis', 'content_recommendation', 'attendance_prediction', 'fee_prediction']).withMessage('Invalid model category'),
  query('deploymentStatus').optional().isIn(['development', 'testing', 'staging', 'production', 'retired']).withMessage('Invalid deployment status'),
  query('isActive').optional().isBoolean().withMessage('Is active must be boolean'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
], validate, analyticsAiController.getAiModels);

/**
 * Update model deployment
 * PUT /api/v1/analytics/models/:modelId/deployment
 */
router.put('/models/:modelId/deployment', [
  requireRole(['super_admin', 'edufam_admin', 'data_scientist']),
  param('modelId').isUUID().withMessage('Valid model ID is required'),
  body('deploymentStatus').isIn(['development', 'testing', 'staging', 'production', 'retired']).withMessage('Valid deployment status is required'),
  body('modelAccuracy').optional().isFloat({ min: 0, max: 1 }).withMessage('Model accuracy must be between 0 and 1'),
  body('modelFilePath').optional().isString().trim().withMessage('Model file path must be a string')
], validate, analyticsAiController.updateModelDeployment);

// ====================================
// PREDICTION MANAGEMENT
// ====================================

/**
 * Create prediction
 * POST /api/v1/analytics/predictions
 */
router.post('/predictions', [
  requireRole(['super_admin', 'edufam_admin', 'data_scientist', 'school_admin', 'principal']),
  body('modelId').isUUID().withMessage('Valid model ID is required'),
  body('predictionType').isString().trim().withMessage('Prediction type is required'),
  body('inputData').isObject().withMessage('Input data must be an object'),
  body('predictedValue').notEmpty().withMessage('Predicted value is required'),
  body('confidenceScore').optional().isFloat({ min: 0, max: 1 }).withMessage('Confidence score must be between 0 and 1'),
  body('predictionProbabilities').optional().isObject().withMessage('Prediction probabilities must be an object'),
  body('entityType').isString().trim().withMessage('Entity type is required'),
  body('entityId').optional().isUUID().withMessage('Entity ID must be valid UUID'),
  body('schoolId').optional().isUUID().withMessage('School ID must be valid UUID'),
  body('academicYear').optional().isString().trim().withMessage('Academic year must be a string')
], validate, analyticsAiController.createPrediction);

/**
 * Get predictions
 * GET /api/v1/analytics/predictions
 */
router.get('/predictions', [
  query('modelId').optional().isUUID().withMessage('Model ID must be valid UUID'),
  query('entityType').optional().isString().trim().withMessage('Entity type must be a string'),
  query('entityId').optional().isUUID().withMessage('Entity ID must be valid UUID'),
  query('predictionType').optional().isString().trim().withMessage('Prediction type must be a string'),
  query('minConfidence').optional().isFloat({ min: 0, max: 1 }).withMessage('Min confidence must be between 0 and 1'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 200 }).withMessage('Limit must be between 1 and 200')
], validate, analyticsAiController.getPredictions);

/**
 * Update prediction outcome
 * PUT /api/v1/analytics/predictions/:predictionId/outcome
 */
router.put('/predictions/:predictionId/outcome', [
  requireRole(['super_admin', 'edufam_admin', 'data_scientist', 'school_admin', 'principal', 'teacher']),
  param('predictionId').isUUID().withMessage('Valid prediction ID is required'),
  body('actualOutcome').notEmpty().withMessage('Actual outcome is required'),
  body('feedbackRating').optional().isInt({ min: 1, max: 5 }).withMessage('Feedback rating must be between 1 and 5'),
  body('feedbackNotes').optional().isString().trim().withMessage('Feedback notes must be a string')
], validate, analyticsAiController.updatePredictionOutcome);

// ====================================
// ANALYTICS REPORTS
// ====================================

/**
 * Create analytics report
 * POST /api/v1/analytics/reports
 */
router.post('/reports', [
  requireRole(['super_admin', 'edufam_admin', 'data_scientist', 'school_admin', 'principal']),
  body('reportName').isString().trim().isLength({ min: 1, max: 255 }).withMessage('Report name is required (1-255 characters)'),
  body('reportType').isIn(['dashboard', 'insight', 'prediction', 'recommendation', 'alert', 'summary']).withMessage('Valid report type is required'),
  body('reportCategory').isIn(['academic_performance', 'financial_analysis', 'operational_efficiency', 'risk_assessment', 'growth_projection', 'resource_utilization']).withMessage('Valid report category is required'),
  body('reportScope').isIn(['platform', 'school', 'grade', 'subject', 'individual']).withMessage('Valid report scope is required'),
  body('targetEntityType').optional().isString().trim().withMessage('Target entity type must be a string'),
  body('targetEntityId').optional().isUUID().withMessage('Target entity ID must be valid UUID'),
  body('reportData').isObject().withMessage('Report data is required and must be an object'),
  body('keyInsights').optional().isArray().withMessage('Key insights must be an array'),
  body('recommendations').optional().isArray().withMessage('Recommendations must be an array'),
  body('confidenceLevel').optional().isIn(['low', 'medium', 'high', 'very_high']).withMessage('Invalid confidence level'),
  body('dataSources').optional().isArray().withMessage('Data sources must be an array'),
  body('computationMethod').optional().isString().trim().withMessage('Computation method must be a string'),
  body('reportPeriodStart').optional().isISO8601().withMessage('Report period start must be valid date'),
  body('reportPeriodEnd').optional().isISO8601().withMessage('Report period end must be valid date'),
  body('isAutomated').optional().isBoolean().withMessage('Is automated must be boolean'),
  body('automationSchedule').optional().isString().trim().withMessage('Automation schedule must be a string'),
  body('recipients').optional().isArray().withMessage('Recipients must be an array'),
  body('sharingLevel').optional().isIn(['private', 'school', 'department', 'public']).withMessage('Invalid sharing level'),
  body('reportTags').optional().isArray().withMessage('Report tags must be an array')
], validate, analyticsAiController.createAnalyticsReport);

/**
 * Get analytics reports
 * GET /api/v1/analytics/reports
 */
router.get('/reports', [
  query('reportType').optional().isIn(['dashboard', 'insight', 'prediction', 'recommendation', 'alert', 'summary']).withMessage('Invalid report type'),
  query('reportCategory').optional().isIn(['academic_performance', 'financial_analysis', 'operational_efficiency', 'risk_assessment', 'growth_projection', 'resource_utilization']).withMessage('Invalid report category'),
  query('reportScope').optional().isIn(['platform', 'school', 'grade', 'subject', 'individual']).withMessage('Invalid report scope'),
  query('sharingLevel').optional().isIn(['private', 'school', 'department', 'public']).withMessage('Invalid sharing level'),
  query('isAutomated').optional().isBoolean().withMessage('Is automated must be boolean'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
], validate, analyticsAiController.getAnalyticsReports);

// ====================================
// PREDICTIVE ALERTS
// ====================================

/**
 * Get predictive alerts
 * GET /api/v1/analytics/alerts
 */
router.get('/alerts', [
  query('alertType').optional().isIn(['student_at_risk', 'attendance_drop', 'performance_decline', 'fee_default_risk', 'resource_shortage', 'capacity_overflow']).withMessage('Invalid alert type'),
  query('severityLevel').optional().isIn(['low', 'medium', 'high', 'critical']).withMessage('Invalid severity level'),
  query('status').optional().isIn(['active', 'acknowledged', 'investigating', 'resolved', 'dismissed']).withMessage('Invalid status'),
  query('entityType').optional().isString().trim().withMessage('Entity type must be a string'),
  query('entityId').optional().isUUID().withMessage('Entity ID must be valid UUID'),
  query('minRiskProbability').optional().isFloat({ min: 0, max: 1 }).withMessage('Min risk probability must be between 0 and 1'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 200 }).withMessage('Limit must be between 1 and 200')
], validate, analyticsAiController.getPredictiveAlerts);

/**
 * Update alert status
 * PUT /api/v1/analytics/alerts/:alertId/status
 */
router.put('/alerts/:alertId/status', [
  requireRole(['super_admin', 'edufam_admin', 'school_admin', 'principal', 'teacher']),
  param('alertId').isUUID().withMessage('Valid alert ID is required'),
  body('status').isIn(['active', 'acknowledged', 'investigating', 'resolved', 'dismissed']).withMessage('Valid status is required'),
  body('resolutionNotes').optional().isString().trim().withMessage('Resolution notes must be a string')
], validate, analyticsAiController.updateAlertStatus);

// ====================================
// STUDENT LEARNING ANALYTICS
// ====================================

/**
 * Generate student learning analytics
 * POST /api/v1/analytics/students/:studentId/analytics
 */
router.post('/students/:studentId/analytics', [
  requireRole(['super_admin', 'edufam_admin', 'school_admin', 'principal', 'teacher']),
  param('studentId').isUUID().withMessage('Valid student ID is required'),
  body('academicYear').isString().trim().withMessage('Academic year is required')
], validate, analyticsAiController.generateStudentAnalytics);

/**
 * Get student learning analytics
 * GET /api/v1/analytics/students
 */
router.get('/students', [
  query('studentId').optional().isUUID().withMessage('Student ID must be valid UUID'),
  query('academicYear').optional().isString().trim().withMessage('Academic year must be a string'),
  query('minSuccessProbability').optional().isFloat({ min: 0, max: 1 }).withMessage('Min success probability must be between 0 and 1'),
  query('maxSuccessProbability').optional().isFloat({ min: 0, max: 1 }).withMessage('Max success probability must be between 0 and 1'),
  query('atRiskOnly').optional().isBoolean().withMessage('At risk only must be boolean'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 200 }).withMessage('Limit must be between 1 and 200')
], validate, analyticsAiController.getStudentAnalytics);

// ====================================
// AI CHATBOT MANAGEMENT
// ====================================

/**
 * Create chatbot session
 * POST /api/v1/analytics/chatbot/sessions
 */
router.post('/chatbot/sessions', [
  body('chatContext').isIn(['support', 'academic', 'administrative', 'general']).withMessage('Valid chat context is required'),
  body('languageCode').optional().isString().trim().isLength({ min: 2, max: 10 }).withMessage('Language code must be 2-10 characters')
], validate, analyticsAiController.createChatbotSession);

/**
 * Add chatbot message
 * POST /api/v1/analytics/chatbot/messages
 */
router.post('/chatbot/messages', [
  body('sessionId').isString().trim().withMessage('Session ID is required'),
  body('senderType').isIn(['user', 'bot', 'system']).withMessage('Valid sender type is required'),
  body('messageText').isString().trim().isLength({ min: 1, max: 2000 }).withMessage('Message text is required (1-2000 characters)'),
  body('messageIntent').optional().isString().trim().withMessage('Message intent must be a string'),
  body('intentConfidence').optional().isFloat({ min: 0, max: 1 }).withMessage('Intent confidence must be between 0 and 1'),
  body('entitiesExtracted').optional().isObject().withMessage('Entities extracted must be an object'),
  body('botResponseType').optional().isString().trim().withMessage('Bot response type must be a string')
], validate, analyticsAiController.addChatbotMessage);

/**
 * End chatbot session
 * PUT /api/v1/analytics/chatbot/sessions/:sessionId/end
 */
router.put('/chatbot/sessions/:sessionId/end', [
  param('sessionId').isString().trim().withMessage('Valid session ID is required'),
  body('userSatisfactionRating').optional().isInt({ min: 1, max: 5 }).withMessage('User satisfaction rating must be between 1 and 5'),
  body('issueResolved').optional().isBoolean().withMessage('Issue resolved must be boolean'),
  body('escalatedToHuman').optional().isBoolean().withMessage('Escalated to human must be boolean'),
  body('escalationReason').optional().isString().trim().withMessage('Escalation reason must be a string')
], validate, analyticsAiController.endChatbotSession);

// ====================================
// DATA MINING OPERATIONS
// ====================================

/**
 * Create data mining job
 * POST /api/v1/analytics/mining/jobs
 */
router.post('/mining/jobs', [
  requireRole(['super_admin', 'edufam_admin', 'data_scientist']),
  body('jobName').isString().trim().isLength({ min: 1, max: 255 }).withMessage('Job name is required (1-255 characters)'),
  body('miningType').isIn(['association_rules', 'clustering', 'classification', 'regression', 'anomaly_detection', 'pattern_recognition']).withMessage('Valid mining type is required'),
  body('datasetDescription').optional().isString().trim().withMessage('Dataset description must be a string'),
  body('dataSourceQuery').isString().trim().withMessage('Data source query is required'),
  body('algorithmUsed').optional().isString().trim().withMessage('Algorithm used must be a string'),
  body('jobParameters').optional().isObject().withMessage('Job parameters must be an object')
], validate, analyticsAiController.createDataMiningJob);

/**
 * Get data mining jobs
 * GET /api/v1/analytics/mining/jobs
 */
router.get('/mining/jobs', [
  requireRole(['super_admin', 'edufam_admin', 'data_scientist']),
  query('miningType').optional().isIn(['association_rules', 'clustering', 'classification', 'regression', 'anomaly_detection', 'pattern_recognition']).withMessage('Invalid mining type'),
  query('jobStatus').optional().isIn(['pending', 'running', 'completed', 'failed', 'cancelled']).withMessage('Invalid job status'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
], validate, analyticsAiController.getDataMiningJobs);

// ====================================
// ANALYTICS DASHBOARD
// ====================================

/**
 * Get analytics dashboard
 * GET /api/v1/analytics/dashboard
 */
router.get('/dashboard', [
  query('timeframe').optional().isIn(['7days', '30days', '90days', '365days']).withMessage('Invalid timeframe')
], validate, analyticsAiController.getAnalyticsDashboard);

// ====================================
// ADVANCED KPI MANAGEMENT
// ====================================

/**
 * Calculate advanced KPIs
 * POST /api/v1/analytics/kpis/calculate
 */
router.post('/kpis/calculate', [
  requireRole(['super_admin', 'edufam_admin', 'data_scientist', 'school_admin', 'principal']),
  body('entityType').isString().trim().withMessage('Entity type is required'),
  body('entityId').isUUID().withMessage('Valid entity ID is required'),
  body('period').isObject().withMessage('Period is required and must be an object'),
  body('period.type').isIn(['daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'semester']).withMessage('Valid period type is required'),
  body('period.start').isISO8601().withMessage('Valid period start date is required'),
  body('period.end').isISO8601().withMessage('Valid period end date is required')
], validate, analyticsAiController.calculateAdvancedKpis);

// ====================================
// AI INSIGHTS & RECOMMENDATIONS
// ====================================

/**
 * Get AI insights
 * GET /api/v1/analytics/insights
 */
router.get('/insights', [
  query('entityType').optional().isString().trim().withMessage('Entity type must be a string'),
  query('entityId').optional().isUUID().withMessage('Entity ID must be valid UUID')
], validate, analyticsAiController.getAiInsights);

// ====================================
// HEALTH CHECK
// ====================================

/**
 * Analytics AI service health check
 * GET /api/v1/analytics/health
 */
router.get('/health', analyticsAiController.getAnalyticsAiHealth);

// ====================================
// ERROR HANDLING
// ====================================

// Global error handler for analytics routes
router.use((error, req, res, next) => {
  console.error('Analytics AI route error:', error);
  
  res.status(error.statusCode || 500).json({
    success: false,
    error: {
      code: error.code || 'ANALYTICS_AI_ERROR',
      message: error.message || 'An error occurred in analytics AI processing'
    }
  });
});

module.exports = router;