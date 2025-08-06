const express = require('express');
const router = express.Router();
const mobileOptimizationController = require('../controllers/mobileOptimizationController');
const { authenticate, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const { body, param, query } = require('express-validator');

/**
 * Mobile Optimization Routes
 * Handles push notifications, offline sync, mobile analytics, and app management
 */

// ====================================
// AUTHENTICATED ENDPOINTS
// ====================================

// Authentication middleware for all routes
router.use(authenticate);

// ====================================
// DEVICE MANAGEMENT
// ====================================

/**
 * Register mobile device
 * POST /api/v1/mobile/devices/register
 */
router.post('/devices/register', [
  body('deviceToken').isString().trim().isLength({ min: 1 }).withMessage('Device token is required'),
  body('deviceId').isString().trim().isLength({ min: 1 }).withMessage('Device ID is required'),
  body('platform').isIn(['ios', 'android', 'web']).withMessage('Valid platform is required'),
  body('appVersion').isString().trim().isLength({ min: 1 }).withMessage('App version is required'),
  body('osVersion').optional().isString().trim().withMessage('OS version must be a string'),
  body('deviceModel').optional().isString().trim().withMessage('Device model must be a string'),
  body('deviceName').optional().isString().trim().withMessage('Device name must be a string'),
  body('deviceType').optional().isIn(['phone', 'tablet', 'desktop', 'unknown']).withMessage('Invalid device type'),
  body('screenResolution').optional().isString().trim().withMessage('Screen resolution must be a string'),
  body('timezone').optional().isString().trim().withMessage('Timezone must be a string'),
  body('languagePreference').optional().isString().trim().isLength({ min: 2, max: 10 }).withMessage('Language preference must be 2-10 characters'),
  body('notificationPreferences').optional().isObject().withMessage('Notification preferences must be an object')
], validate, mobileOptimizationController.registerDevice);

/**
 * Get user devices
 * GET /api/v1/mobile/devices
 */
router.get('/devices', [
  query('platform').optional().isIn(['ios', 'android', 'web']).withMessage('Invalid platform'),
  query('isActive').optional().isBoolean().withMessage('Is active must be boolean')
], validate, mobileOptimizationController.getDevices);

/**
 * Update device activity
 * PUT /api/v1/mobile/devices/activity
 */
router.put('/devices/activity', [
  body('deviceToken').isString().trim().isLength({ min: 1 }).withMessage('Device token is required')
], validate, mobileOptimizationController.updateDeviceActivity);

/**
 * Update device settings
 * PUT /api/v1/mobile/devices/:deviceId/settings
 */
router.put('/devices/:deviceId/settings', [
  param('deviceId').isUUID().withMessage('Valid device ID is required'),
  body('notificationPreferences').optional().isObject().withMessage('Notification preferences must be an object'),
  body('pushEnabled').optional().isBoolean().withMessage('Push enabled must be boolean'),
  body('biometricEnabled').optional().isBoolean().withMessage('Biometric enabled must be boolean'),
  body('autoSyncEnabled').optional().isBoolean().withMessage('Auto sync enabled must be boolean'),
  body('offlineModeEnabled').optional().isBoolean().withMessage('Offline mode enabled must be boolean'),
  body('dataUsageWifiOnly').optional().isBoolean().withMessage('Data usage wifi only must be boolean'),
  body('darkModeEnabled').optional().isBoolean().withMessage('Dark mode enabled must be boolean'),
  body('fontSize').optional().isIn(['small', 'medium', 'large', 'extra_large']).withMessage('Invalid font size'),
  body('accessibilityFeatures').optional().isObject().withMessage('Accessibility features must be an object'),
  body('appSettings').optional().isObject().withMessage('App settings must be an object')
], validate, mobileOptimizationController.updateDeviceSettings);

// ====================================
// PUSH NOTIFICATION MANAGEMENT
// ====================================

/**
 * Send push notification
 * POST /api/v1/mobile/notifications/send
 */
router.post('/notifications/send', [
  requireRole(['super_admin', 'edufam_admin', 'school_admin', 'principal', 'teacher']),
  body('title').isString().trim().isLength({ min: 1, max: 255 }).withMessage('Title is required (1-255 characters)'),
  body('body').isString().trim().isLength({ min: 1, max: 2000 }).withMessage('Body is required (1-2000 characters)'),
  body('notificationType').isIn(['announcement', 'reminder', 'alert', 'message', 'update', 'promotional', 'emergency']).withMessage('Valid notification type is required'),
  body('userId').optional().isUUID().withMessage('User ID must be valid UUID'),
  body('deviceId').optional().isUUID().withMessage('Device ID must be valid UUID'),
  body('priority').optional().isIn(['low', 'normal', 'high', 'urgent']).withMessage('Invalid priority'),
  body('category').optional().isString().trim().withMessage('Category must be a string'),
  body('actionType').optional().isIn(['open_app', 'open_url', 'open_screen', 'custom_action']).withMessage('Invalid action type'),
  body('actionPayload').optional().isObject().withMessage('Action payload must be an object'),
  body('deepLinkUrl').optional().isURL().withMessage('Deep link URL must be valid'),
  body('imageUrl').optional().isURL().withMessage('Image URL must be valid'),
  body('sound').optional().isString().trim().withMessage('Sound must be a string'),
  body('badgeCount').optional().isInt({ min: 0 }).withMessage('Badge count must be non-negative'),
  body('dataPayload').optional().isObject().withMessage('Data payload must be an object'),
  body('scheduledAt').optional().isISO8601().withMessage('Scheduled at must be valid ISO date'),
  body('isSilent').optional().isBoolean().withMessage('Is silent must be boolean'),
  body('collapseKey').optional().isString().trim().withMessage('Collapse key must be a string'),
  body('timeToLive').optional().isInt({ min: 1 }).withMessage('Time to live must be positive')
], validate, mobileOptimizationController.sendPushNotification);

/**
 * Get push notifications
 * GET /api/v1/mobile/notifications
 */
router.get('/notifications', [
  query('deviceId').optional().isUUID().withMessage('Device ID must be valid UUID'),
  query('status').optional().isIn(['pending', 'sent', 'delivered', 'opened', 'failed', 'cancelled']).withMessage('Invalid status'),
  query('notificationType').optional().isIn(['announcement', 'reminder', 'alert', 'message', 'update', 'promotional', 'emergency']).withMessage('Invalid notification type'),
  query('startDate').optional().isISO8601().withMessage('Start date must be valid ISO date'),
  query('endDate').optional().isISO8601().withMessage('End date must be valid ISO date'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 200 }).withMessage('Limit must be between 1 and 200')
], validate, mobileOptimizationController.getPushNotifications);

/**
 * Update notification status
 * PUT /api/v1/mobile/notifications/:notificationId/status
 */
router.put('/notifications/:notificationId/status', [
  param('notificationId').isString().trim().withMessage('Valid notification ID is required'),
  body('status').isIn(['pending', 'sent', 'delivered', 'opened', 'failed', 'cancelled']).withMessage('Valid status is required'),
  body('failureReason').optional().isString().trim().withMessage('Failure reason must be a string')
], validate, mobileOptimizationController.updateNotificationStatus);

// ====================================
// OFFLINE SYNC MANAGEMENT
// ====================================

/**
 * Add to sync queue
 * POST /api/v1/mobile/sync/queue
 */
router.post('/sync/queue', [
  body('deviceId').isUUID().withMessage('Valid device ID is required'),
  body('operationType').isIn(['create', 'update', 'delete', 'sync']).withMessage('Valid operation type is required'),
  body('entityType').isString().trim().isLength({ min: 1, max: 50 }).withMessage('Entity type is required (1-50 characters)'),
  body('entityId').optional().isUUID().withMessage('Entity ID must be valid UUID'),
  body('localId').optional().isString().trim().withMessage('Local ID must be a string'),
  body('operationData').isObject().withMessage('Operation data is required and must be an object'),
  body('priority').optional().isInt({ min: 1, max: 10 }).withMessage('Priority must be between 1 and 10')
], validate, mobileOptimizationController.addToSyncQueue);

/**
 * Get sync queue
 * GET /api/v1/mobile/sync/queue
 */
router.get('/sync/queue', [
  query('deviceId').optional().isUUID().withMessage('Device ID must be valid UUID'),
  query('status').optional().isIn(['pending', 'syncing', 'completed', 'failed', 'conflict']).withMessage('Invalid status'),
  query('limit').optional().isInt({ min: 1, max: 500 }).withMessage('Limit must be between 1 and 500')
], validate, mobileOptimizationController.getSyncQueue);

/**
 * Update sync status
 * PUT /api/v1/mobile/sync/:syncId/status
 */
router.put('/sync/:syncId/status', [
  param('syncId').isUUID().withMessage('Valid sync ID is required'),
  body('syncStatus').isIn(['pending', 'syncing', 'completed', 'failed', 'conflict']).withMessage('Valid sync status is required'),
  body('errorMessage').optional().isString().trim().withMessage('Error message must be a string'),
  body('conflictData').optional().isObject().withMessage('Conflict data must be an object')
], validate, mobileOptimizationController.updateSyncStatus);

// ====================================
// MOBILE APP SESSION MANAGEMENT
// ====================================

/**
 * Start app session
 * POST /api/v1/mobile/sessions/start
 */
router.post('/sessions/start', [
  body('deviceId').isUUID().withMessage('Valid device ID is required'),
  body('appVersion').isString().trim().isLength({ min: 1 }).withMessage('App version is required'),
  body('networkType').optional().isIn(['wifi', 'cellular', 'offline', 'unknown']).withMessage('Invalid network type'),
  body('batteryLevelStart').optional().isInt({ min: 0, max: 100 }).withMessage('Battery level must be between 0 and 100'),
  body('locationPermissionsGranted').optional().isBoolean().withMessage('Location permissions granted must be boolean'),
  body('notificationPermissionsGranted').optional().isBoolean().withMessage('Notification permissions granted must be boolean'),
  body('cameraPermissionsGranted').optional().isBoolean().withMessage('Camera permissions granted must be boolean'),
  body('microphonePermissionsGranted').optional().isBoolean().withMessage('Microphone permissions granted must be boolean')
], validate, mobileOptimizationController.startAppSession);

/**
 * End app session
 * PUT /api/v1/mobile/sessions/:sessionId/end
 */
router.put('/sessions/:sessionId/end', [
  param('sessionId').isString().trim().withMessage('Valid session ID is required'),
  body('screensVisited').optional().isArray().withMessage('Screens visited must be an array'),
  body('featuresUsed').optional().isArray().withMessage('Features used must be an array'),
  body('dataUsageMb').optional().isFloat({ min: 0 }).withMessage('Data usage must be non-negative'),
  body('batteryLevelEnd').optional().isInt({ min: 0, max: 100 }).withMessage('Battery level must be between 0 and 100'),
  body('memoryUsageMb').optional().isFloat({ min: 0 }).withMessage('Memory usage must be non-negative'),
  body('cpuUsagePercent').optional().isFloat({ min: 0, max: 100 }).withMessage('CPU usage must be between 0 and 100'),
  body('crashCount').optional().isInt({ min: 0 }).withMessage('Crash count must be non-negative'),
  body('errorCount').optional().isInt({ min: 0 }).withMessage('Error count must be non-negative'),
  body('syncOperations').optional().isInt({ min: 0 }).withMessage('Sync operations must be non-negative'),
  body('offlineDurationSeconds').optional().isInt({ min: 0 }).withMessage('Offline duration must be non-negative'),
  body('sessionRating').optional().isInt({ min: 1, max: 5 }).withMessage('Session rating must be between 1 and 5'),
  body('userFeedback').optional().isString().trim().withMessage('User feedback must be a string'),
  body('sessionMetadata').optional().isObject().withMessage('Session metadata must be an object')
], validate, mobileOptimizationController.endAppSession);

// ====================================
// PERFORMANCE METRICS
// ====================================

/**
 * Record performance metric
 * POST /api/v1/mobile/performance/metrics
 */
router.post('/performance/metrics', [
  body('deviceId').isUUID().withMessage('Valid device ID is required'),
  body('metricType').isIn(['app_launch', 'screen_load', 'api_call', 'sync_operation', 'background_task']).withMessage('Valid metric type is required'),
  body('metricName').isString().trim().isLength({ min: 1, max: 255 }).withMessage('Metric name is required (1-255 characters)'),
  body('metricValue').isNumeric().withMessage('Metric value must be numeric'),
  body('metricUnit').isString().trim().isLength({ min: 1, max: 20 }).withMessage('Metric unit is required (1-20 characters)'),
  body('screenName').optional().isString().trim().withMessage('Screen name must be a string'),
  body('apiEndpoint').optional().isString().trim().withMessage('API endpoint must be a string'),
  body('operationName').optional().isString().trim().withMessage('Operation name must be a string'),
  body('appVersion').optional().isString().trim().withMessage('App version must be a string'),
  body('osVersion').optional().isString().trim().withMessage('OS version must be a string'),
  body('deviceModel').optional().isString().trim().withMessage('Device model must be a string'),
  body('networkType').optional().isString().trim().withMessage('Network type must be a string'),
  body('batteryLevel').optional().isInt({ min: 0, max: 100 }).withMessage('Battery level must be between 0 and 100'),
  body('memoryUsageMb').optional().isFloat({ min: 0 }).withMessage('Memory usage must be non-negative'),
  body('additionalData').optional().isObject().withMessage('Additional data must be an object')
], validate, mobileOptimizationController.recordPerformanceMetric);

/**
 * Get performance metrics
 * GET /api/v1/mobile/performance/metrics
 */
router.get('/performance/metrics', [
  query('deviceId').optional().isUUID().withMessage('Device ID must be valid UUID'),
  query('metricType').optional().isIn(['app_launch', 'screen_load', 'api_call', 'sync_operation', 'background_task']).withMessage('Invalid metric type'),
  query('screenName').optional().isString().trim().withMessage('Screen name must be a string'),
  query('startDate').optional().isISO8601().withMessage('Start date must be valid ISO date'),
  query('endDate').optional().isISO8601().withMessage('End date must be valid ISO date'),
  query('limit').optional().isInt({ min: 1, max: 5000 }).withMessage('Limit must be between 1 and 5000')
], validate, mobileOptimizationController.getPerformanceMetrics);

// ====================================
// FEATURE FLAGS
// ====================================

/**
 * Get feature flags
 * GET /api/v1/mobile/features/flags
 */
router.get('/features/flags', [
  query('platform').optional().isIn(['ios', 'android', 'web']).withMessage('Invalid platform'),
  query('appVersion').optional().isString().trim().withMessage('App version must be a string')
], validate, mobileOptimizationController.getFeatureFlags);

// ====================================
// CRASH REPORTING
// ====================================

/**
 * Report crash
 * POST /api/v1/mobile/crashes/report
 */
router.post('/crashes/report', [
  body('deviceId').isUUID().withMessage('Valid device ID is required'),
  body('appVersion').isString().trim().isLength({ min: 1 }).withMessage('App version is required'),
  body('crashTimestamp').isISO8601().withMessage('Valid crash timestamp is required'),
  body('crashType').isIn(['fatal', 'non-fatal', 'anr']).withMessage('Valid crash type is required'),
  body('osVersion').optional().isString().trim().withMessage('OS version must be a string'),
  body('deviceModel').optional().isString().trim().withMessage('Device model must be a string'),
  body('exceptionName').optional().isString().trim().withMessage('Exception name must be a string'),
  body('exceptionMessage').optional().isString().trim().withMessage('Exception message must be a string'),
  body('stackTrace').optional().isString().trim().withMessage('Stack trace must be a string'),
  body('threadName').optional().isString().trim().withMessage('Thread name must be a string'),
  body('screenName').optional().isString().trim().withMessage('Screen name must be a string'),
  body('userAction').optional().isString().trim().withMessage('User action must be a string'),
  body('memoryUsageMb').optional().isFloat({ min: 0 }).withMessage('Memory usage must be non-negative'),
  body('diskSpaceMb').optional().isFloat({ min: 0 }).withMessage('Disk space must be non-negative'),
  body('batteryLevel').optional().isInt({ min: 0, max: 100 }).withMessage('Battery level must be between 0 and 100'),
  body('networkType').optional().isString().trim().withMessage('Network type must be a string'),
  body('isRootedJailbroken').optional().isBoolean().withMessage('Is rooted/jailbroken must be boolean'),
  body('customLogs').optional().isString().trim().withMessage('Custom logs must be a string'),
  body('breadcrumbs').optional().isArray().withMessage('Breadcrumbs must be an array'),
  body('deviceOrientation').optional().isString().trim().withMessage('Device orientation must be a string'),
  body('availableRamMb').optional().isFloat({ min: 0 }).withMessage('Available RAM must be non-negative'),
  body('totalRamMb').optional().isFloat({ min: 0 }).withMessage('Total RAM must be non-negative')
], validate, mobileOptimizationController.reportCrash);

// ====================================
// MOBILE ANALYTICS EVENTS
// ====================================

/**
 * Track analytics event
 * POST /api/v1/mobile/analytics/events
 */
router.post('/analytics/events', [
  body('deviceId').isUUID().withMessage('Valid device ID is required'),
  body('eventName').isString().trim().isLength({ min: 1, max: 100 }).withMessage('Event name is required (1-100 characters)'),
  body('sessionId').optional().isUUID().withMessage('Session ID must be valid UUID'),
  body('eventCategory').optional().isIn(['screen_view', 'user_action', 'error', 'performance']).withMessage('Invalid event category'),
  body('screenName').optional().isString().trim().withMessage('Screen name must be a string'),
  body('eventProperties').optional().isObject().withMessage('Event properties must be an object'),
  body('userProperties').optional().isObject().withMessage('User properties must be an object'),
  body('clientTimestamp').optional().isISO8601().withMessage('Client timestamp must be valid ISO date'),
  body('appVersion').optional().isString().trim().withMessage('App version must be a string'),
  body('osVersion').optional().isString().trim().withMessage('OS version must be a string'),
  body('networkType').optional().isString().trim().withMessage('Network type must be a string'),
  body('isOfflineEvent').optional().isBoolean().withMessage('Is offline event must be boolean'),
  body('geographicInfo').optional().isObject().withMessage('Geographic info must be an object')
], validate, mobileOptimizationController.trackAnalyticsEvent);

// ====================================
// MOBILE ANALYTICS DASHBOARD
// ====================================

/**
 * Get mobile analytics dashboard
 * GET /api/v1/mobile/analytics/dashboard
 */
router.get('/analytics/dashboard', [
  requireRole(['super_admin', 'edufam_admin', 'school_admin', 'principal']),
  query('timeframe').optional().isIn(['7days', '30days', '90days']).withMessage('Invalid timeframe')
], validate, mobileOptimizationController.getMobileAnalyticsDashboard);

// ====================================
// ADMIN MOBILE MANAGEMENT
// ====================================

/**
 * Get all mobile devices (admin)
 * GET /api/v1/mobile/admin/devices
 */
router.get('/admin/devices', [
  requireRole(['super_admin', 'edufam_admin', 'school_admin', 'principal']),
  query('schoolId').optional().isUUID().withMessage('School ID must be valid UUID'),
  query('platform').optional().isIn(['ios', 'android', 'web']).withMessage('Invalid platform'),
  query('isActive').optional().isBoolean().withMessage('Is active must be boolean'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 200 }).withMessage('Limit must be between 1 and 200')
], validate, mobileOptimizationController.getAllDevices);

/**
 * Send bulk push notifications (admin)
 * POST /api/v1/mobile/admin/notifications/bulk
 */
router.post('/admin/notifications/bulk', [
  requireRole(['super_admin', 'edufam_admin', 'school_admin', 'principal']),
  body('title').isString().trim().isLength({ min: 1, max: 255 }).withMessage('Title is required (1-255 characters)'),
  body('body').isString().trim().isLength({ min: 1, max: 2000 }).withMessage('Body is required (1-2000 characters)'),
  body('notificationType').isIn(['announcement', 'reminder', 'alert', 'message', 'update', 'promotional', 'emergency']).withMessage('Valid notification type is required'),
  body('targetCriteria').isObject().withMessage('Target criteria is required and must be an object'),
  body('priority').optional().isIn(['low', 'normal', 'high', 'urgent']).withMessage('Invalid priority'),
  body('category').optional().isString().trim().withMessage('Category must be a string'),
  body('actionType').optional().isIn(['open_app', 'open_url', 'open_screen', 'custom_action']).withMessage('Invalid action type'),
  body('actionPayload').optional().isObject().withMessage('Action payload must be an object'),
  body('deepLinkUrl').optional().isURL().withMessage('Deep link URL must be valid'),
  body('imageUrl').optional().isURL().withMessage('Image URL must be valid'),
  body('scheduledAt').optional().isISO8601().withMessage('Scheduled at must be valid ISO date')
], validate, mobileOptimizationController.sendBulkPushNotifications);

// ====================================
// MOBILE APP CONFIGURATION
// ====================================

/**
 * Get mobile app configuration
 * GET /api/v1/mobile/config
 */
router.get('/config', [
  query('platform').optional().isIn(['ios', 'android', 'web']).withMessage('Invalid platform'),
  query('appVersion').optional().isString().trim().withMessage('App version must be a string')
], validate, mobileOptimizationController.getMobileAppConfig);

// ====================================
// HEALTH CHECK
// ====================================

/**
 * Mobile optimization service health check
 * GET /api/v1/mobile/health
 */
router.get('/health', mobileOptimizationController.getMobileOptimizationHealth);

// ====================================
// ERROR HANDLING
// ====================================

// Global error handler for mobile routes
router.use((error, req, res, next) => {
  console.error('Mobile optimization route error:', error);
  
  res.status(error.statusCode || 500).json({
    success: false,
    error: {
      code: error.code || 'MOBILE_OPTIMIZATION_ERROR',
      message: error.message || 'An error occurred in mobile optimization'
    }
  });
});

module.exports = router;