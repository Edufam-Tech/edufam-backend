const realtimeEventService = require('../services/realtimeEventService');
const websocketManager = require('../services/websocketManager');
const { asyncHandler } = require('../middleware/errorHandler');
const { ValidationError } = require('../middleware/errorHandler');

/**
 * Real-Time Controller
 * Handles real-time events, notifications, and WebSocket management
 */
class RealtimeController {

  /**
   * Get user's real-time events/notifications
   * GET /api/v1/realtime/events
   */
  getUserEvents = asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    
    const filters = {
      status: req.query.status,
      eventType: req.query.eventType,
      priority: req.query.priority,
      dateFrom: req.query.dateFrom,
      unreadOnly: req.query.unreadOnly === 'true',
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 50
    };

    // Remove undefined values
    Object.keys(filters).forEach(key => 
      filters[key] === undefined && delete filters[key]
    );

    const events = await realtimeEventService.getUserEvents(userId, filters);

    res.json({
      success: true,
      data: {
        events,
        pagination: {
          page: filters.page,
          limit: filters.limit,
          hasMore: events.length === filters.limit
        }
      },
      message: 'Events retrieved successfully'
    });
  });

  /**
   * Mark event as read
   * PUT /api/v1/realtime/events/:eventId/read
   */
  markEventAsRead = asyncHandler(async (req, res) => {
    const { eventId } = req.params;
    const userId = req.user.userId;

    const result = await realtimeEventService.markEventAsRead(eventId, userId);

    if (!result) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'EVENT_NOT_FOUND',
          message: 'Event not found or not delivered to user'
        }
      });
    }

    res.json({
      success: true,
      data: { result },
      message: 'Event marked as read'
    });
  });

  /**
   * Send test notification
   * POST /api/v1/realtime/events/test
   */
  sendTestNotification = asyncHandler(async (req, res) => {
    const { targetUserIds, message, title } = req.body;
    const schoolId = req.activeSchoolId || req.user.schoolId;
    const sourceUserId = req.user.userId;

    if (!message || !title) {
      throw new ValidationError('Title and message are required');
    }

    const eventId = await realtimeEventService.createEvent({
      eventType: 'system_test',
      schoolId,
      sourceUserId,
      targetUserIds: targetUserIds || [sourceUserId],
      title,
      message,
      eventPayload: { test: true, sentBy: req.user.email },
      priority: 'normal'
    });

    res.status(201).json({
      success: true,
      data: { eventId },
      message: 'Test notification sent successfully'
    });
  });

  /**
   * Broadcast message to school
   * POST /api/v1/realtime/broadcast/school
   */
  broadcastToSchool = asyncHandler(async (req, res) => {
    const { message, title, targetRoles, priority } = req.body;
    const schoolId = req.activeSchoolId || req.user.schoolId;
    const sourceUserId = req.user.userId;

    // Validate user has broadcast permissions
    if (!['principal', 'school_director', 'super_admin'].includes(req.user.role)) {
      throw new ValidationError('Insufficient permissions to broadcast to school');
    }

    if (!message || !title) {
      throw new ValidationError('Title and message are required');
    }

    const eventId = await realtimeEventService.createEvent({
      eventType: 'school_announcement',
      schoolId,
      sourceUserId,
      targetRoles: targetRoles || null, // null means all users in school
      title,
      message,
      eventPayload: {
        broadcast: true,
        sentBy: req.user.email,
        schoolBroadcast: true
      },
      priority: priority || 'normal'
    });

    res.status(201).json({
      success: true,
      data: { eventId },
      message: 'School broadcast sent successfully'
    });
  });

  /**
   * Get real-time connection metrics
   * GET /api/v1/realtime/metrics
   */
  getMetrics = asyncHandler(async (req, res) => {
    // Only allow admin access to metrics
    if (!['principal', 'school_director', 'super_admin', 'edufam_admin'].includes(req.user.role)) {
      throw new ValidationError('Insufficient permissions to view metrics');
    }

    const connectionMetrics = websocketManager.getMetrics();
    const schoolId = req.activeSchoolId || req.user.schoolId;
    
    const eventStats = await realtimeEventService.getEventStatistics(schoolId, {
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo
    });

    res.json({
      success: true,
      data: {
        connections: connectionMetrics,
        events: eventStats,
        timestamp: new Date().toISOString()
      },
      message: 'Real-time metrics retrieved successfully'
    });
  });

  /**
   * Get event statistics
   * GET /api/v1/realtime/statistics
   */
  getEventStatistics = asyncHandler(async (req, res) => {
    const schoolId = req.activeSchoolId || req.user.schoolId;
    
    const filters = {
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo
    };

    const statistics = await realtimeEventService.getEventStatistics(schoolId, filters);

    res.json({
      success: true,
      data: { statistics },
      message: 'Event statistics retrieved successfully'
    });
  });

  /**
   * Create system event (admin only)
   * POST /api/v1/realtime/events/system
   */
  createSystemEvent = asyncHandler(async (req, res) => {
    // Only allow system admins
    if (!['super_admin', 'edufam_admin'].includes(req.user.role)) {
      throw new ValidationError('Only system administrators can create system events');
    }

    const {
      eventType,
      schoolId,
      targetUserIds,
      targetRoles,
      title,
      message,
      eventPayload,
      priority
    } = req.body;

    if (!eventType || !title || !message) {
      throw new ValidationError('Event type, title, and message are required');
    }

    const eventId = await realtimeEventService.createEvent({
      eventType,
      schoolId: schoolId || req.user.schoolId,
      sourceUserId: req.user.userId,
      targetUserIds,
      targetRoles,
      title,
      message,
      eventPayload,
      priority: priority || 'normal'
    });

    res.status(201).json({
      success: true,
      data: { eventId },
      message: 'System event created successfully'
    });
  });

  /**
   * Get real-time event types
   * GET /api/v1/realtime/event-types
   */
  getEventTypes = asyncHandler(async (req, res) => {
    try {
      const result = await require('../config/database').query(`
        SELECT 
          event_type,
          event_category,
          display_name,
          description,
          priority,
          icon,
          color
        FROM realtime_event_types
        WHERE is_active = true
        ORDER BY event_category, display_name
      `);

      res.json({
        success: true,
        data: { eventTypes: result.rows },
        message: 'Event types retrieved successfully'
      });
    } catch (error) {
      throw new DatabaseError('Failed to get event types', error);
    }
  });

  /**
   * Test WebSocket connectivity
   * POST /api/v1/realtime/test-connection
   */
  testConnection = asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const schoolId = req.activeSchoolId || req.user.schoolId;

    // Send a test message to the user
    const testData = {
      type: 'connection_test',
      message: 'WebSocket connection test successful',
      timestamp: new Date().toISOString(),
      userId,
      schoolId
    };

    try {
      await websocketManager.broadcastToUsers([userId], 'connection_test', testData);
      
      res.json({
        success: true,
        data: { testData },
        message: 'Connection test sent successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'CONNECTION_TEST_FAILED',
          message: 'Failed to send test message'
        }
      });
    }
  });

  /**
   * Health check for real-time services
   * GET /api/v1/realtime/health
   */
  healthCheck = asyncHandler(async (req, res) => {
    const metrics = websocketManager.getMetrics();
    const isHealthy = websocketManager.io !== null;

    res.json({
      success: true,
      data: {
        service: 'Real-Time WebSocket Service',
        status: isHealthy ? 'healthy' : 'unhealthy',
        websocketServer: isHealthy ? 'running' : 'stopped',
        connections: metrics,
        features: [
          'websocket_connections',
          'real_time_events',
          'live_notifications',
          'school_broadcasting',
          'user_activity_tracking',
          'connection_metrics'
        ],
        timestamp: new Date().toISOString()
      },
      message: 'Real-time service health check completed'
    });
  });
}

module.exports = new RealtimeController();