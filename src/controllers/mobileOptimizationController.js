const mobileOptimizationService = require('../services/mobileOptimizationService');
const realtimeIntegrations = require('../integrations/realtimeIntegrations');
const { asyncHandler } = require('../middleware/errorHandler');
const { ValidationError } = require('../middleware/errorHandler');

/**
 * Mobile Optimization Controller
 * Handles push notifications, offline sync, mobile analytics, and app management
 */
class MobileOptimizationController {

  /**
   * Device Management
   */

  // Register mobile device
  registerDevice = asyncHandler(async (req, res) => {
    const {
      deviceToken,
      deviceId,
      platform,
      appVersion,
      osVersion,
      deviceModel,
      deviceName,
      deviceType,
      screenResolution,
      timezone,
      languagePreference,
      notificationPreferences
    } = req.body;

    // Validate required fields
    if (!deviceToken || !deviceId || !platform || !appVersion) {
      throw new ValidationError('Device token, device ID, platform, and app version are required');
    }

    const device = await mobileOptimizationService.registerDevice({
      userId: req.user.userId,
      schoolId: req.user.schoolId,
      deviceToken,
      deviceId,
      platform,
      appVersion,
      osVersion,
      deviceModel,
      deviceName,
      deviceType,
      screenResolution,
      timezone,
      languagePreference,
      notificationPreferences,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.status(201).json({
      success: true,
      data: { device },
      message: 'Device registered successfully'
    });
  });

  // Get user devices
  getDevices = asyncHandler(async (req, res) => {
    const { platform, isActive } = req.query;

    const devices = await mobileOptimizationService.getDevices({
      userId: req.user.userId,
      platform,
      isActive: isActive !== undefined ? isActive === 'true' : undefined
    });

    res.json({
      success: true,
      data: { devices },
      message: 'Devices retrieved successfully'
    });
  });

  // Update device activity
  updateDeviceActivity = asyncHandler(async (req, res) => {
    const { deviceToken } = req.body;

    if (!deviceToken) {
      throw new ValidationError('Device token is required');
    }

    const device = await mobileOptimizationService.updateDeviceActivity(deviceToken);

    res.json({
      success: true,
      data: { device },
      message: 'Device activity updated successfully'
    });
  });

  // Update device settings
  updateDeviceSettings = asyncHandler(async (req, res) => {
    const { deviceId } = req.params;
    const settings = req.body;

    const device = await mobileOptimizationService.updateDeviceSettings(deviceId, settings);

    res.json({
      success: true,
      data: { device },
      message: 'Device settings updated successfully'
    });
  });

  /**
   * Push Notification Management
   */

  // Send push notification
  sendPushNotification = asyncHandler(async (req, res) => {
    const {
      userId,
      deviceId,
      title,
      body,
      notificationType,
      priority,
      category,
      actionType,
      actionPayload,
      deepLinkUrl,
      imageUrl,
      sound,
      badgeCount,
      dataPayload,
      scheduledAt,
      isSilent,
      collapseKey,
      timeToLive
    } = req.body;

    // Validate required fields
    if (!title || !body || !notificationType) {
      throw new ValidationError('Title, body, and notification type are required');
    }

    const notification = await mobileOptimizationService.createPushNotification({
      userId: userId || req.user.userId,
      deviceId,
      schoolId: req.user.schoolId,
      title,
      body,
      notificationType,
      priority,
      category,
      actionType,
      actionPayload,
      deepLinkUrl,
      imageUrl,
      sound,
      badgeCount,
      dataPayload,
      scheduledAt,
      isSilent,
      collapseKey,
      timeToLive
    });

    // If not scheduled, send immediately
    if (!scheduledAt) {
      await mobileOptimizationService.sendPushNotification(notification.notification_id);
    }

    res.status(201).json({
      success: true,
      data: { notification },
      message: scheduledAt ? 'Notification scheduled successfully' : 'Notification sent successfully'
    });
  });

  // Get push notifications
  getPushNotifications = asyncHandler(async (req, res) => {
    const {
      deviceId,
      status,
      notificationType,
      startDate,
      endDate,
      page,
      limit
    } = req.query;

    const notifications = await mobileOptimizationService.getPushNotifications({
      userId: req.user.userId,
      deviceId,
      schoolId: req.user.schoolId,
      status,
      notificationType,
      startDate,
      endDate,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 50
    });

    res.json({
      success: true,
      data: {
        notifications,
        pagination: {
          page: parseInt(page) || 1,
          limit: parseInt(limit) || 50,
          hasMore: notifications.length === (parseInt(limit) || 50)
        }
      },
      message: 'Push notifications retrieved successfully'
    });
  });

  // Update notification status
  updateNotificationStatus = asyncHandler(async (req, res) => {
    const { notificationId } = req.params;
    const { status, failureReason } = req.body;

    if (!status) {
      throw new ValidationError('Status is required');
    }

    const notification = await mobileOptimizationService.updateNotificationStatus(notificationId, {
      status,
      failureReason
    });

    res.json({
      success: true,
      data: { notification },
      message: 'Notification status updated successfully'
    });
  });

  /**
   * Offline Sync Management
   */

  // Add to sync queue
  addToSyncQueue = asyncHandler(async (req, res) => {
    const {
      deviceId,
      operationType,
      entityType,
      entityId,
      localId,
      operationData,
      priority
    } = req.body;

    // Validate required fields
    if (!deviceId || !operationType || !entityType || !operationData) {
      throw new ValidationError('Device ID, operation type, entity type, and operation data are required');
    }

    const syncItem = await mobileOptimizationService.addToSyncQueue({
      userId: req.user.userId,
      deviceId,
      schoolId: req.user.schoolId,
      operationType,
      entityType,
      entityId,
      localId,
      operationData,
      priority
    });

    res.status(201).json({
      success: true,
      data: { syncItem },
      message: 'Item added to sync queue successfully'
    });
  });

  // Get sync queue
  getSyncQueue = asyncHandler(async (req, res) => {
    const { deviceId, status, limit } = req.query;

    const syncQueue = await mobileOptimizationService.getSyncQueue({
      userId: req.user.userId,
      deviceId,
      status,
      limit: parseInt(limit) || 100
    });

    res.json({
      success: true,
      data: { syncQueue },
      message: 'Sync queue retrieved successfully'
    });
  });

  // Update sync status
  updateSyncStatus = asyncHandler(async (req, res) => {
    const { syncId } = req.params;
    const { syncStatus, errorMessage, conflictData } = req.body;

    if (!syncStatus) {
      throw new ValidationError('Sync status is required');
    }

    const syncItem = await mobileOptimizationService.updateSyncStatus(syncId, {
      syncStatus,
      errorMessage,
      conflictData
    });

    res.json({
      success: true,
      data: { syncItem },
      message: 'Sync status updated successfully'
    });
  });

  /**
   * Mobile App Session Management
   */

  // Start app session
  startAppSession = asyncHandler(async (req, res) => {
    const {
      deviceId,
      appVersion,
      networkType,
      batteryLevelStart,
      locationPermissionsGranted,
      notificationPermissionsGranted,
      cameraPermissionsGranted,
      microphonePermissionsGranted
    } = req.body;

    // Validate required fields
    if (!deviceId || !appVersion) {
      throw new ValidationError('Device ID and app version are required');
    }

    const session = await mobileOptimizationService.createAppSession({
      userId: req.user.userId,
      deviceId,
      schoolId: req.user.schoolId,
      appVersion,
      networkType,
      batteryLevelStart,
      locationPermissionsGranted,
      notificationPermissionsGranted,
      cameraPermissionsGranted,
      microphonePermissionsGranted
    });

    res.status(201).json({
      success: true,
      data: { session },
      message: 'App session started successfully'
    });
  });

  // End app session
  endAppSession = asyncHandler(async (req, res) => {
    const { sessionId } = req.params;
    const sessionData = req.body;

    const session = await mobileOptimizationService.endAppSession(sessionId, sessionData);

    res.json({
      success: true,
      data: { session },
      message: 'App session ended successfully'
    });
  });

  /**
   * Performance Metrics
   */

  // Record performance metric
  recordPerformanceMetric = asyncHandler(async (req, res) => {
    const {
      deviceId,
      metricType,
      metricName,
      metricValue,
      metricUnit,
      screenName,
      apiEndpoint,
      operationName,
      appVersion,
      osVersion,
      deviceModel,
      networkType,
      batteryLevel,
      memoryUsageMb,
      additionalData
    } = req.body;

    // Validate required fields
    if (!deviceId || !metricType || !metricName || metricValue === undefined || !metricUnit) {
      throw new ValidationError('Device ID, metric type, metric name, metric value, and metric unit are required');
    }

    const metric = await mobileOptimizationService.recordPerformanceMetric({
      deviceId,
      metricType,
      metricName,
      metricValue,
      metricUnit,
      screenName,
      apiEndpoint,
      operationName,
      userId: req.user.userId,
      schoolId: req.user.schoolId,
      appVersion,
      osVersion,
      deviceModel,
      networkType,
      batteryLevel,
      memoryUsageMb,
      additionalData
    });

    res.status(201).json({
      success: true,
      data: { metric },
      message: 'Performance metric recorded successfully'
    });
  });

  // Get performance metrics
  getPerformanceMetrics = asyncHandler(async (req, res) => {
    const {
      deviceId,
      metricType,
      screenName,
      startDate,
      endDate,
      limit
    } = req.query;

    const metrics = await mobileOptimizationService.getPerformanceMetrics({
      deviceId,
      metricType,
      screenName,
      startDate,
      endDate,
      limit: parseInt(limit) || 1000
    });

    res.json({
      success: true,
      data: { metrics },
      message: 'Performance metrics retrieved successfully'
    });
  });

  /**
   * Feature Flags
   */

  // Get feature flags
  getFeatureFlags = asyncHandler(async (req, res) => {
    const { platform, appVersion } = req.query;

    const flags = await mobileOptimizationService.getFeatureFlags({
      platform,
      appVersion,
      userId: req.user.userId,
      schoolId: req.user.schoolId
    });

    res.json({
      success: true,
      data: { flags },
      message: 'Feature flags retrieved successfully'
    });
  });

  /**
   * Crash Reporting
   */

  // Report crash
  reportCrash = asyncHandler(async (req, res) => {
    const {
      deviceId,
      appVersion,
      osVersion,
      deviceModel,
      crashTimestamp,
      crashType,
      exceptionName,
      exceptionMessage,
      stackTrace,
      threadName,
      screenName,
      userAction,
      memoryUsageMb,
      diskSpaceMb,
      batteryLevel,
      networkType,
      isRootedJailbroken,
      customLogs,
      breadcrumbs,
      deviceOrientation,
      availableRamMb,
      totalRamMb
    } = req.body;

    // Validate required fields
    if (!deviceId || !appVersion || !crashTimestamp || !crashType) {
      throw new ValidationError('Device ID, app version, crash timestamp, and crash type are required');
    }

    const crashReport = await mobileOptimizationService.reportCrash({
      userId: req.user.userId,
      deviceId,
      schoolId: req.user.schoolId,
      appVersion,
      osVersion,
      deviceModel,
      crashTimestamp,
      crashType,
      exceptionName,
      exceptionMessage,
      stackTrace,
      threadName,
      screenName,
      userAction,
      memoryUsageMb,
      diskSpaceMb,
      batteryLevel,
      networkType,
      isRootedJailbroken,
      customLogs,
      breadcrumbs,
      deviceOrientation,
      availableRamMb,
      totalRamMb
    });

    // Send alert for critical crashes
    if (crashType === 'fatal') {
      try {
        await realtimeIntegrations.createCustomEvent({
          eventType: 'mobile_app_crash',
          schoolId: req.user.schoolId,
          sourceUserId: req.user.userId,
          targetRoles: ['super_admin', 'edufam_admin', 'mobile_dev'],
          title: 'Mobile App Crash Reported',
          message: `Fatal crash reported in ${appVersion} on ${platform}: ${exceptionName}`,
          eventPayload: {
            crashId: crashReport.crash_id,
            appVersion,
            platform: osVersion,
            exceptionName,
            screenName,
            deviceModel
          },
          priority: 'high',
          sourceEntityType: 'crash_report',
          sourceEntityId: crashReport.id,
          actionUrl: `/mobile/crashes/${crashReport.id}`
        });
      } catch (error) {
        console.error('Failed to send crash notification:', error);
      }
    }

    res.status(201).json({
      success: true,
      data: { crashReport },
      message: 'Crash report submitted successfully'
    });
  });

  /**
   * Mobile Analytics Events
   */

  // Track analytics event
  trackAnalyticsEvent = asyncHandler(async (req, res) => {
    const {
      deviceId,
      sessionId,
      eventName,
      eventCategory,
      screenName,
      eventProperties,
      userProperties,
      clientTimestamp,
      appVersion,
      osVersion,
      networkType,
      isOfflineEvent,
      geographicInfo
    } = req.body;

    // Validate required fields
    if (!deviceId || !eventName) {
      throw new ValidationError('Device ID and event name are required');
    }

    const event = await mobileOptimizationService.trackAnalyticsEvent({
      userId: req.user.userId,
      deviceId,
      sessionId,
      schoolId: req.user.schoolId,
      eventName,
      eventCategory,
      screenName,
      eventProperties,
      userProperties,
      clientTimestamp,
      appVersion,
      osVersion,
      networkType,
      isOfflineEvent,
      geographicInfo
    });

    res.status(201).json({
      success: true,
      data: { event },
      message: 'Analytics event tracked successfully'
    });
  });

  /**
   * Mobile Analytics Dashboard
   */

  // Get mobile analytics dashboard
  getMobileAnalyticsDashboard = asyncHandler(async (req, res) => {
    const { timeframe } = req.query;

    const dashboard = await mobileOptimizationService.getMobileAnalyticsDashboard(
      req.user.schoolId,
      timeframe || '30days'
    );

    res.json({
      success: true,
      data: { dashboard },
      message: 'Mobile analytics dashboard retrieved successfully'
    });
  });

  /**
   * Admin Mobile Management
   */

  // Get all mobile devices (admin)
  getAllDevices = asyncHandler(async (req, res) => {
    const {
      schoolId,
      platform,
      isActive,
      page,
      limit
    } = req.query;

    const devices = await mobileOptimizationService.getDevices({
      schoolId: schoolId || req.user.schoolId,
      platform,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 50
    });

    res.json({
      success: true,
      data: {
        devices,
        pagination: {
          page: parseInt(page) || 1,
          limit: parseInt(limit) || 50,
          hasMore: devices.length === (parseInt(limit) || 50)
        }
      },
      message: 'All mobile devices retrieved successfully'
    });
  });

  // Send bulk push notifications (admin)
  sendBulkPushNotifications = asyncHandler(async (req, res) => {
    const {
      title,
      body,
      notificationType,
      priority,
      category,
      targetCriteria, // { platform, userRoles, schoolIds, etc. }
      actionType,
      actionPayload,
      deepLinkUrl,
      imageUrl,
      scheduledAt
    } = req.body;

    // Validate required fields
    if (!title || !body || !notificationType || !targetCriteria) {
      throw new ValidationError('Title, body, notification type, and target criteria are required');
    }

    // Get devices based on target criteria
    const devices = await mobileOptimizationService.getDevices({
      platform: targetCriteria.platform,
      schoolId: targetCriteria.schoolId,
      isActive: true
    });

    const notifications = [];

    // Create notifications for each device
    for (const device of devices) {
      const notification = await mobileOptimizationService.createPushNotification({
        userId: device.user_id,
        deviceId: device.id,
        schoolId: device.school_id,
        title,
        body,
        notificationType,
        priority,
        category,
        actionType,
        actionPayload,
        deepLinkUrl,
        imageUrl,
        scheduledAt
      });

      notifications.push(notification);

      // If not scheduled, send immediately
      if (!scheduledAt) {
        await mobileOptimizationService.sendPushNotification(notification.notification_id);
      }
    }

    res.status(201).json({
      success: true,
      data: {
        notifications,
        summary: {
          totalDevices: devices.length,
          notificationsCreated: notifications.length,
          scheduled: !!scheduledAt
        }
      },
      message: `Bulk notifications ${scheduledAt ? 'scheduled' : 'sent'} successfully`
    });
  });

  /**
   * Mobile App Configuration
   */

  // Get mobile app configuration
  getMobileAppConfig = asyncHandler(async (req, res) => {
    const { platform, appVersion } = req.query;

    // Get feature flags
    const featureFlags = await mobileOptimizationService.getFeatureFlags({
      platform,
      appVersion,
      userId: req.user.userId,
      schoolId: req.user.schoolId
    });

    // Build mobile app configuration
    const config = {
      user: {
        id: req.user.userId,
        schoolId: req.user.schoolId,
        role: req.user.role
      },
      features: featureFlags,
      settings: {
        apiBaseUrl: process.env.API_BASE_URL || 'https://api.edufam.com',
        websocketUrl: process.env.WEBSOCKET_URL || 'wss://api.edufam.com',
        maxOfflineDataAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
        syncInterval: 5 * 60 * 1000, // 5 minutes in milliseconds
        crashReportingEnabled: true,
        analyticsEnabled: true,
        performanceMonitoringEnabled: true
      },
      themes: {
        default: 'light',
        available: ['light', 'dark', 'auto']
      },
      languages: {
        default: 'en',
        available: ['en', 'sw'] // English, Swahili
      },
      notifications: {
        enabledByDefault: true,
        categories: {
          academic: { enabled: true, sound: 'default' },
          financial: { enabled: true, sound: 'default' },
          attendance: { enabled: true, sound: 'default' },
          announcement: { enabled: true, sound: 'default' },
          emergency: { enabled: true, sound: 'urgent' }
        }
      }
    };

    res.json({
      success: true,
      data: { config },
      message: 'Mobile app configuration retrieved successfully'
    });
  });

  /**
   * Health Check
   */

  // Get mobile optimization service health
  getMobileOptimizationHealth = asyncHandler(async (req, res) => {
    const dashboard = await mobileOptimizationService.getMobileAnalyticsDashboard(null, '7days');

    res.json({
      success: true,
      data: {
        service: 'Mobile Optimization Service',
        status: 'healthy',
        features: [
          'device_registration',
          'push_notifications',
          'offline_sync',
          'performance_monitoring',
          'crash_reporting',
          'analytics_tracking',
          'feature_flags',
          'ab_testing',
          'session_management',
          'bulk_notifications'
        ],
        metrics: {
          totalDevices: dashboard.metrics.devices.total_devices || 0,
          activeDevices: dashboard.metrics.devices.active_devices || 0,
          iosDevices: dashboard.metrics.devices.ios_devices || 0,
          androidDevices: dashboard.metrics.devices.android_devices || 0,
          totalNotifications: dashboard.metrics.notifications.total_notifications || 0,
          deliveredNotifications: dashboard.metrics.notifications.delivered_notifications || 0,
          openedNotifications: dashboard.metrics.notifications.opened_notifications || 0,
          totalSessions: dashboard.metrics.sessions.total_sessions || 0,
          avgSessionDuration: parseFloat(dashboard.metrics.sessions.avg_session_duration) || 0,
          totalCrashes: dashboard.metrics.crashes.total_crashes || 0
        },
        platforms: {
          ios: {
            supported: true,
            pushNotifications: true,
            offlineSync: true,
            crashReporting: true
          },
          android: {
            supported: true,
            pushNotifications: true,
            offlineSync: true,
            crashReporting: true
          }
        },
        timestamp: new Date().toISOString()
      },
      message: 'Mobile optimization service health check completed'
    });
  });
}

module.exports = new MobileOptimizationController();