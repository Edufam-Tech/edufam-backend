const express = require('express');
const router = express.Router();
const realtimeController = require('../controllers/realtimeController');
const { authenticate, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const { body, param, query } = require('express-validator');

/**
 * Real-Time Routes
 * Handles WebSocket events, notifications, and live updates
 */

// Authentication middleware for all real-time routes
router.use(authenticate);

// ====================================
// USER EVENTS AND NOTIFICATIONS
// ====================================

/**
 * Get user's real-time events/notifications
 * GET /api/v1/realtime/events
 */
router.get('/events', [
  query('status').optional().isIn(['pending', 'delivered', 'read', 'acknowledged', 'failed']).withMessage('Invalid status'),
  query('eventType').optional().isString().trim().withMessage('Event type must be a string'),
  query('priority').optional().isIn(['low', 'normal', 'high', 'urgent', 'critical']).withMessage('Invalid priority'),
  query('dateFrom').optional().isISO8601().withMessage('Date from must be in ISO 8601 format'),
  query('unreadOnly').optional().isBoolean().withMessage('Unread only must be boolean'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
], validate, realtimeController.getUserEvents);

/**
 * Mark event as read
 * PUT /api/v1/realtime/events/:eventId/read
 */
router.put('/events/:eventId/read', [
  param('eventId').isUUID().withMessage('Valid event ID is required')
], validate, realtimeController.markEventAsRead);

/**
 * Get event types
 * GET /api/v1/realtime/event-types
 */
router.get('/event-types', realtimeController.getEventTypes);

// ====================================
// EVENT CREATION AND BROADCASTING
// ====================================

/**
 * Send test notification
 * POST /api/v1/realtime/events/test
 */
router.post('/events/test', [
  body('title').isString().trim().isLength({ min: 1, max: 255 }).withMessage('Title is required (1-255 characters)'),
  body('message').isString().trim().isLength({ min: 1, max: 1000 }).withMessage('Message is required (1-1000 characters)'),
  body('targetUserIds').optional().isArray().withMessage('Target user IDs must be an array'),
  body('targetUserIds.*').optional().isUUID().withMessage('Each target user ID must be valid UUID')
], validate, realtimeController.sendTestNotification);

/**
 * Broadcast message to school
 * POST /api/v1/realtime/broadcast/school
 */
router.post('/broadcast/school', [
  requireRole(['principal', 'school_director', 'super_admin']),
  body('title').isString().trim().isLength({ min: 1, max: 255 }).withMessage('Title is required (1-255 characters)'),
  body('message').isString().trim().isLength({ min: 1, max: 1000 }).withMessage('Message is required (1-1000 characters)'),
  body('targetRoles').optional().isArray().withMessage('Target roles must be an array'),
  body('targetRoles.*').optional().isString().withMessage('Each target role must be a string'),
  body('priority').optional().isIn(['low', 'normal', 'high', 'urgent', 'critical']).withMessage('Invalid priority')
], validate, realtimeController.broadcastToSchool);

/**
 * Create system event (admin only)
 * POST /api/v1/realtime/events/system
 */
router.post('/events/system', [
  requireRole(['super_admin', 'edufam_admin']),
  body('eventType').isString().trim().isLength({ min: 1, max: 50 }).withMessage('Event type is required (1-50 characters)'),
  body('title').isString().trim().isLength({ min: 1, max: 255 }).withMessage('Title is required (1-255 characters)'),
  body('message').isString().trim().isLength({ min: 1, max: 1000 }).withMessage('Message is required (1-1000 characters)'),
  body('schoolId').optional().isUUID().withMessage('School ID must be valid UUID'),
  body('targetUserIds').optional().isArray().withMessage('Target user IDs must be an array'),
  body('targetUserIds.*').optional().isUUID().withMessage('Each target user ID must be valid UUID'),
  body('targetRoles').optional().isArray().withMessage('Target roles must be an array'),
  body('targetRoles.*').optional().isString().withMessage('Each target role must be a string'),
  body('priority').optional().isIn(['low', 'normal', 'high', 'urgent', 'critical']).withMessage('Invalid priority'),
  body('eventPayload').optional().isObject().withMessage('Event payload must be an object')
], validate, realtimeController.createSystemEvent);

// ====================================
// WEBSOCKET TESTING AND DIAGNOSTICS
// ====================================

/**
 * Test WebSocket connectivity
 * POST /api/v1/realtime/test-connection
 */
router.post('/test-connection', realtimeController.testConnection);

/**
 * Get real-time connection metrics
 * GET /api/v1/realtime/metrics
 */
router.get('/metrics', [
  requireRole(['principal', 'school_director', 'super_admin', 'edufam_admin']),
  query('dateFrom').optional().isISO8601().withMessage('Date from must be in ISO 8601 format'),
  query('dateTo').optional().isISO8601().withMessage('Date to must be in ISO 8601 format')
], validate, realtimeController.getMetrics);

/**
 * Get event statistics
 * GET /api/v1/realtime/statistics
 */
router.get('/statistics', [
  query('dateFrom').optional().isISO8601().withMessage('Date from must be in ISO 8601 format'),
  query('dateTo').optional().isISO8601().withMessage('Date to must be in ISO 8601 format')
], validate, realtimeController.getEventStatistics);

// ====================================
// HEALTH CHECK
// ====================================

/**
 * Health check for real-time services
 * GET /api/v1/realtime/health
 */
router.get('/health', realtimeController.healthCheck);

// ====================================
// CHANNEL MANAGEMENT (Future Feature)
// ====================================

/**
 * Get available channels
 * GET /api/v1/realtime/channels
 */
router.get('/channels', [
  query('type').optional().isIn(['school', 'class', 'role', 'user', 'global']).withMessage('Invalid channel type'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50')
], validate, (req, res) => {
  // Placeholder for future channel management feature
  res.json({
    success: true,
    data: { channels: [], message: 'Channel management feature coming soon' },
    message: 'Channels endpoint placeholder'
  });
});

/**
 * Subscribe to channel
 * POST /api/v1/realtime/channels/:channelId/subscribe
 */
router.post('/channels/:channelId/subscribe', [
  param('channelId').isUUID().withMessage('Valid channel ID is required')
], validate, (req, res) => {
  // Placeholder for future channel subscription feature
  res.json({
    success: true,
    data: { subscribed: false },
    message: 'Channel subscription feature coming soon'
  });
});

/**
 * Unsubscribe from channel
 * DELETE /api/v1/realtime/channels/:channelId/subscribe
 */
router.delete('/channels/:channelId/subscribe', [
  param('channelId').isUUID().withMessage('Valid channel ID is required')
], validate, (req, res) => {
  // Placeholder for future channel unsubscription feature
  res.json({
    success: true,
    data: { unsubscribed: false },
    message: 'Channel unsubscription feature coming soon'
  });
});

// ====================================
// ERROR HANDLING
// ====================================

// Global error handler for real-time routes
router.use((error, req, res, next) => {
  console.error('Real-time route error:', error);
  
  res.status(error.statusCode || 500).json({
    success: false,
    error: {
      code: error.code || 'REALTIME_ERROR',
      message: error.message || 'An error occurred in real-time service'
    }
  });
});

module.exports = router;