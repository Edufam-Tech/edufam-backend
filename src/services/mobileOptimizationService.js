const { query } = require('../config/database');
const { ValidationError, NotFoundError } = require('../middleware/errorHandler');

/**
 * Mobile Optimization Service
 * Handles push notifications, offline sync, mobile analytics, and app management
 */
class MobileOptimizationService {

  /**
   * Device Management
   */
  async registerDevice({
    userId,
    schoolId,
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
    ipAddress,
    userAgent
  }) {
    const result = await query(`
      INSERT INTO mobile_devices (
        user_id, school_id, device_token, device_id, platform, app_version,
        os_version, device_model, device_name, device_type, screen_resolution,
        timezone, language_preference, notification_preferences, ip_address, user_agent
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      ON CONFLICT (device_token) 
      DO UPDATE SET
        user_id = EXCLUDED.user_id,
        school_id = EXCLUDED.school_id,
        device_id = EXCLUDED.device_id,
        app_version = EXCLUDED.app_version,
        os_version = EXCLUDED.os_version,
        device_model = EXCLUDED.device_model,
        device_name = EXCLUDED.device_name,
        device_type = EXCLUDED.device_type,
        screen_resolution = EXCLUDED.screen_resolution,
        timezone = EXCLUDED.timezone,
        language_preference = EXCLUDED.language_preference,
        notification_preferences = EXCLUDED.notification_preferences,
        is_active = true,
        last_active = NOW(),
        ip_address = EXCLUDED.ip_address,
        user_agent = EXCLUDED.user_agent,
        updated_at = NOW()
      RETURNING *
    `, [
      userId, schoolId, deviceToken, deviceId, platform, appVersion,
      osVersion, deviceModel, deviceName, deviceType, screenResolution,
      timezone, languagePreference, JSON.stringify(notificationPreferences),
      ipAddress, userAgent
    ]);

    return result.rows[0];
  }

  async getDevices({
    userId,
    schoolId,
    platform,
    isActive = true,
    page = 1,
    limit = 50
  } = {}) {
    let whereConditions = [];
    let params = [];
    let paramCount = 0;

    if (userId) {
      whereConditions.push(`user_id = $${++paramCount}`);
      params.push(userId);
    }

    if (schoolId) {
      whereConditions.push(`school_id = $${++paramCount}`);
      params.push(schoolId);
    }

    if (platform) {
      whereConditions.push(`platform = $${++paramCount}`);
      params.push(platform);
    }

    if (isActive !== undefined) {
      whereConditions.push(`is_active = $${++paramCount}`);
      params.push(isActive);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    const offset = (page - 1) * limit;

    params.push(limit, offset);

    const result = await query(`
      SELECT 
        md.*,
        u.first_name,
        u.last_name,
        u.email,
        s.name as school_name,
        EXTRACT(DAYS FROM NOW() - md.last_active) as days_since_active
      FROM mobile_devices md
      LEFT JOIN users u ON md.user_id = u.id
      LEFT JOIN schools s ON md.school_id = s.id
      ${whereClause}
      ORDER BY md.last_active DESC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `, params);

    return result.rows;
  }

  async updateDeviceActivity(deviceToken) {
    const result = await query(`
      UPDATE mobile_devices 
      SET last_active = NOW(), last_sync = NOW(), updated_at = NOW()
      WHERE device_token = $1
      RETURNING *
    `, [deviceToken]);

    return result.rows[0];
  }

  async updateDeviceSettings(deviceId, settings) {
    const {
      notificationPreferences,
      pushEnabled,
      biometricEnabled,
      autoSyncEnabled,
      offlineModeEnabled,
      dataUsageWifiOnly,
      darkModeEnabled,
      fontSize,
      accessibilityFeatures,
      appSettings
    } = settings;

    const result = await query(`
      UPDATE mobile_devices 
      SET 
        notification_preferences = COALESCE($2, notification_preferences),
        push_enabled = COALESCE($3, push_enabled),
        biometric_enabled = COALESCE($4, biometric_enabled),
        auto_sync_enabled = COALESCE($5, auto_sync_enabled),
        offline_mode_enabled = COALESCE($6, offline_mode_enabled),
        data_usage_wifi_only = COALESCE($7, data_usage_wifi_only),
        dark_mode_enabled = COALESCE($8, dark_mode_enabled),
        font_size = COALESCE($9, font_size),
        accessibility_features = COALESCE($10, accessibility_features),
        app_settings = COALESCE($11, app_settings),
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [
      deviceId,
      notificationPreferences ? JSON.stringify(notificationPreferences) : null,
      pushEnabled,
      biometricEnabled,
      autoSyncEnabled,
      offlineModeEnabled,
      dataUsageWifiOnly,
      darkModeEnabled,
      fontSize,
      accessibilityFeatures ? JSON.stringify(accessibilityFeatures) : null,
      appSettings ? JSON.stringify(appSettings) : null
    ]);

    if (result.rows.length === 0) {
      throw new NotFoundError('Device not found');
    }

    return result.rows[0];
  }

  /**
   * Push Notification Management
   */
  async createPushNotification({
    userId,
    deviceId,
    schoolId,
    title,
    body,
    notificationType,
    priority = 'normal',
    category,
    actionType,
    actionPayload,
    deepLinkUrl,
    imageUrl,
    sound = 'default',
    badgeCount,
    dataPayload,
    scheduledAt,
    isSilent = false,
    collapseKey,
    timeToLive = 86400
  }) {
    // Generate unique notification ID
    const notificationId = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const result = await query(`
      INSERT INTO push_notifications (
        notification_id, user_id, device_id, school_id, title, body,
        notification_type, priority, category, action_type, action_payload,
        deep_link_url, image_url, sound, badge_count, data_payload,
        scheduled_at, is_silent, collapse_key, time_to_live,
        expires_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
        $17, $18, $19, $20, $21
      )
      RETURNING *
    `, [
      notificationId, userId, deviceId, schoolId, title, body,
      notificationType, priority, category, actionType, 
      actionPayload ? JSON.stringify(actionPayload) : null,
      deepLinkUrl, imageUrl, sound, badgeCount, 
      dataPayload ? JSON.stringify(dataPayload) : null,
      scheduledAt, isSilent, collapseKey, timeToLive,
      scheduledAt ? new Date(Date.now() + timeToLive * 1000) : null
    ]);

    return result.rows[0];
  }

  async sendPushNotification(notificationId) {
    const result = await query(`
      UPDATE push_notifications 
      SET status = 'sent', sent_at = NOW(), updated_at = NOW()
      WHERE notification_id = $1
      RETURNING *
    `, [notificationId]);

    if (result.rows.length === 0) {
      throw new NotFoundError('Notification not found');
    }

    // Here you would integrate with FCM/APNS to actually send the notification
    // For now, we'll just update the status

    return result.rows[0];
  }

  async updateNotificationStatus(notificationId, { status, failureReason }) {
    const updateFields = { status };
    const params = [notificationId, status];
    let paramCount = 2;

    let setClause = 'status = $2';

    if (status === 'delivered') {
      setClause += ', delivered_at = NOW()';
    } else if (status === 'opened') {
      setClause += ', opened_at = NOW()';
    } else if (status === 'failed') {
      setClause += `, failure_reason = $${++paramCount}, retry_count = retry_count + 1`;
      params.push(failureReason);
    }

    setClause += ', updated_at = NOW()';

    const result = await query(`
      UPDATE push_notifications 
      SET ${setClause}
      WHERE notification_id = $1
      RETURNING *
    `, params);

    return result.rows[0];
  }

  async getPushNotifications({
    userId,
    deviceId,
    schoolId,
    status,
    notificationType,
    startDate,
    endDate,
    page = 1,
    limit = 50
  } = {}) {
    let whereConditions = [];
    let params = [];
    let paramCount = 0;

    if (userId) {
      whereConditions.push(`user_id = $${++paramCount}`);
      params.push(userId);
    }

    if (deviceId) {
      whereConditions.push(`device_id = $${++paramCount}`);
      params.push(deviceId);
    }

    if (schoolId) {
      whereConditions.push(`school_id = $${++paramCount}`);
      params.push(schoolId);
    }

    if (status) {
      whereConditions.push(`status = $${++paramCount}`);
      params.push(status);
    }

    if (notificationType) {
      whereConditions.push(`notification_type = $${++paramCount}`);
      params.push(notificationType);
    }

    if (startDate) {
      whereConditions.push(`created_at >= $${++paramCount}`);
      params.push(startDate);
    }

    if (endDate) {
      whereConditions.push(`created_at <= $${++paramCount}`);
      params.push(endDate);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    const offset = (page - 1) * limit;

    params.push(limit, offset);

    const result = await query(`
      SELECT 
        pn.*,
        CASE 
          WHEN pn.opened_at IS NOT NULL THEN 'opened'
          WHEN pn.delivered_at IS NOT NULL THEN 'delivered'
          WHEN pn.sent_at IS NOT NULL THEN 'sent'
          ELSE pn.status
        END as current_status
      FROM push_notifications pn
      ${whereClause}
      ORDER BY pn.created_at DESC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `, params);

    return result.rows;
  }

  /**
   * Offline Sync Management
   */
  async addToSyncQueue({
    userId,
    deviceId,
    schoolId,
    operationType,
    entityType,
    entityId,
    localId,
    operationData,
    priority = 5
  }) {
    const result = await query(`
      INSERT INTO offline_sync_queue (
        user_id, device_id, school_id, operation_type, entity_type,
        entity_id, local_id, operation_data, priority
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      userId, deviceId, schoolId, operationType, entityType,
      entityId, localId, JSON.stringify(operationData), priority
    ]);

    return result.rows[0];
  }

  async getSyncQueue({
    userId,
    deviceId,
    status = 'pending',
    limit = 100
  } = {}) {
    let whereConditions = [];
    let params = [];
    let paramCount = 0;

    if (userId) {
      whereConditions.push(`user_id = $${++paramCount}`);
      params.push(userId);
    }

    if (deviceId) {
      whereConditions.push(`device_id = $${++paramCount}`);
      params.push(deviceId);
    }

    if (status) {
      whereConditions.push(`sync_status = $${++paramCount}`);
      params.push(status);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    params.push(limit);

    const result = await query(`
      SELECT *
      FROM offline_sync_queue
      ${whereClause}
      ORDER BY priority ASC, created_at ASC
      LIMIT $${paramCount + 1}
    `, params);

    return result.rows;
  }

  async updateSyncStatus(syncId, { syncStatus, errorMessage, conflictData }) {
    let setClause = 'sync_status = $2';
    const params = [syncId, syncStatus];
    let paramCount = 2;

    if (syncStatus === 'completed') {
      setClause += ', last_attempt = NOW()';
    } else if (syncStatus === 'failed') {
      setClause += `, error_message = $${++paramCount}, retry_count = retry_count + 1, last_attempt = NOW()`;
      params.push(errorMessage);
      
      // Calculate next retry time with exponential backoff
      setClause += ', next_retry = NOW() + INTERVAL \'1 minute\' * POWER(2, retry_count)';
    } else if (syncStatus === 'conflict' && conflictData) {
      setClause += `, conflict_data = $${++paramCount}`;
      params.push(JSON.stringify(conflictData));
    }

    setClause += ', updated_at = NOW()';

    const result = await query(`
      UPDATE offline_sync_queue 
      SET ${setClause}
      WHERE id = $1
      RETURNING *
    `, params);

    if (result.rows.length === 0) {
      throw new NotFoundError('Sync queue item not found');
    }

    return result.rows[0];
  }

  /**
   * Mobile App Session Management
   */
  async createAppSession({
    userId,
    deviceId,
    schoolId,
    appVersion,
    networkType,
    batteryLevelStart,
    locationPermissionsGranted,
    notificationPermissionsGranted,
    cameraPermissionsGranted,
    microphonePermissionsGranted
  }) {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const result = await query(`
      INSERT INTO mobile_app_sessions (
        session_id, user_id, device_id, school_id, app_version,
        network_type, battery_level_start, location_permissions_granted,
        notification_permissions_granted, camera_permissions_granted,
        microphone_permissions_granted
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `, [
      sessionId, userId, deviceId, schoolId, appVersion,
      networkType, batteryLevelStart, locationPermissionsGranted,
      notificationPermissionsGranted, cameraPermissionsGranted,
      microphonePermissionsGranted
    ]);

    return result.rows[0];
  }

  async endAppSession(sessionId, {
    screensVisited,
    featuresUsed,
    dataUsageMb,
    batteryLevelEnd,
    memoryUsageMb,
    cpuUsagePercent,
    crashCount = 0,
    errorCount = 0,
    syncOperations = 0,
    offlineDurationSeconds = 0,
    sessionRating,
    userFeedback,
    sessionMetadata
  }) {
    const result = await query(`
      UPDATE mobile_app_sessions 
      SET 
        session_end = NOW(),
        duration_seconds = EXTRACT(EPOCH FROM NOW() - session_start)::INTEGER,
        screens_visited = $2,
        features_used = $3,
        data_usage_mb = $4,
        battery_level_end = $5,
        memory_usage_mb = $6,
        cpu_usage_percent = $7,
        crash_count = $8,
        error_count = $9,
        sync_operations = $10,
        offline_duration_seconds = $11,
        session_rating = $12,
        user_feedback = $13,
        session_metadata = $14,
        updated_at = NOW()
      WHERE session_id = $1
      RETURNING *
    `, [
      sessionId, screensVisited, featuresUsed, dataUsageMb,
      batteryLevelEnd, memoryUsageMb, cpuUsagePercent,
      crashCount, errorCount, syncOperations, offlineDurationSeconds,
      sessionRating, userFeedback, 
      sessionMetadata ? JSON.stringify(sessionMetadata) : null
    ]);

    if (result.rows.length === 0) {
      throw new NotFoundError('App session not found');
    }

    return result.rows[0];
  }

  /**
   * Performance Metrics
   */
  async recordPerformanceMetric({
    deviceId,
    metricType,
    metricName,
    metricValue,
    metricUnit,
    screenName,
    apiEndpoint,
    operationName,
    userId,
    schoolId,
    appVersion,
    osVersion,
    deviceModel,
    networkType,
    batteryLevel,
    memoryUsageMb,
    additionalData
  }) {
    const result = await query(`
      INSERT INTO mobile_performance_metrics (
        device_id, metric_type, metric_name, metric_value, metric_unit,
        screen_name, api_endpoint, operation_name, user_id, school_id,
        app_version, os_version, device_model, network_type,
        battery_level, memory_usage_mb, additional_data
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
      )
      RETURNING *
    `, [
      deviceId, metricType, metricName, metricValue, metricUnit,
      screenName, apiEndpoint, operationName, userId, schoolId,
      appVersion, osVersion, deviceModel, networkType,
      batteryLevel, memoryUsageMb, 
      additionalData ? JSON.stringify(additionalData) : null
    ]);

    return result.rows[0];
  }

  async getPerformanceMetrics({
    deviceId,
    metricType,
    screenName,
    startDate,
    endDate,
    limit = 1000
  } = {}) {
    let whereConditions = [];
    let params = [];
    let paramCount = 0;

    if (deviceId) {
      whereConditions.push(`device_id = $${++paramCount}`);
      params.push(deviceId);
    }

    if (metricType) {
      whereConditions.push(`metric_type = $${++paramCount}`);
      params.push(metricType);
    }

    if (screenName) {
      whereConditions.push(`screen_name = $${++paramCount}`);
      params.push(screenName);
    }

    if (startDate) {
      whereConditions.push(`timestamp >= $${++paramCount}`);
      params.push(startDate);
    }

    if (endDate) {
      whereConditions.push(`timestamp <= $${++paramCount}`);
      params.push(endDate);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    params.push(limit);

    const result = await query(`
      SELECT 
        *,
        AVG(metric_value) OVER (PARTITION BY metric_name) as avg_value,
        MIN(metric_value) OVER (PARTITION BY metric_name) as min_value,
        MAX(metric_value) OVER (PARTITION BY metric_name) as max_value
      FROM mobile_performance_metrics
      ${whereClause}
      ORDER BY timestamp DESC
      LIMIT $${paramCount + 1}
    `, params);

    return result.rows;
  }

  /**
   * Feature Flags
   */
  async getFeatureFlags({
    platform,
    appVersion,
    userId,
    schoolId
  } = {}) {
    // Get user's feature flag assignments first
    const assignmentsResult = await query(`
      SELECT fa.flag_id, fa.flag_value, f.flag_name
      FROM mobile_feature_flag_assignments fa
      JOIN mobile_feature_flags f ON fa.flag_id = f.id
      WHERE (fa.user_id = $1 OR fa.school_id = $2)
        AND (fa.expires_at IS NULL OR fa.expires_at > NOW())
        AND f.is_active = true
    `, [userId, schoolId]);

    const assignments = {};
    assignmentsResult.rows.forEach(row => {
      assignments[row.flag_name] = row.flag_value;
    });

    // Get all active feature flags
    let whereConditions = ['f.is_active = true'];
    let params = [];
    let paramCount = 0;

    if (platform) {
      whereConditions.push(`$${++paramCount} = ANY(f.target_platforms)`);
      params.push(platform);
    }

    const flagsResult = await query(`
      SELECT *
      FROM mobile_feature_flags f
      WHERE ${whereConditions.join(' AND ')}
        AND (f.start_date IS NULL OR f.start_date <= NOW())
        AND (f.end_date IS NULL OR f.end_date > NOW())
    `, params);

    const flags = {};
    flagsResult.rows.forEach(flag => {
      // Use assignment value if exists, otherwise use default
      flags[flag.flag_name] = assignments[flag.flag_name] || flag.default_value;
    });

    return flags;
  }

  /**
   * Crash Reporting
   */
  async reportCrash({
    userId,
    deviceId,
    schoolId,
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
  }) {
    const crashId = `crash_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const result = await query(`
      INSERT INTO mobile_crash_reports (
        crash_id, user_id, device_id, school_id, app_version, os_version,
        device_model, crash_timestamp, crash_type, exception_name,
        exception_message, stack_trace, thread_name, screen_name,
        user_action, memory_usage_mb, disk_space_mb, battery_level,
        network_type, is_rooted_jailbroken, custom_logs, breadcrumbs,
        device_orientation, available_ram_mb, total_ram_mb
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
        $16, $17, $18, $19, $20, $21, $22, $23, $24, $25
      )
      RETURNING *
    `, [
      crashId, userId, deviceId, schoolId, appVersion, osVersion,
      deviceModel, crashTimestamp, crashType, exceptionName,
      exceptionMessage, stackTrace, threadName, screenName,
      userAction, memoryUsageMb, diskSpaceMb, batteryLevel,
      networkType, isRootedJailbroken, customLogs,
      breadcrumbs ? JSON.stringify(breadcrumbs) : null,
      deviceOrientation, availableRamMb, totalRamMb
    ]);

    // Check for similar crashes to update count
    await query(`
      UPDATE mobile_crash_reports 
      SET 
        similar_crashes_count = similar_crashes_count + 1,
        last_occurrence = NOW()
      WHERE exception_name = $1 
        AND app_version = $2 
        AND crash_id != $3
        AND created_at > NOW() - INTERVAL '30 days'
    `, [exceptionName, appVersion, crashId]);

    return result.rows[0];
  }

  /**
   * Mobile Analytics Events
   */
  async trackAnalyticsEvent({
    userId,
    deviceId,
    sessionId,
    schoolId,
    eventName,
    eventCategory,
    screenName,
    eventProperties,
    userProperties,
    clientTimestamp,
    appVersion,
    osVersion,
    networkType,
    isOfflineEvent = false,
    geographicInfo
  }) {
    const eventId = `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const result = await query(`
      INSERT INTO mobile_analytics_events (
        event_id, user_id, device_id, session_id, school_id,
        event_name, event_category, screen_name, event_properties,
        user_properties, client_timestamp, app_version, os_version,
        network_type, is_offline_event, geographic_info
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
      )
      RETURNING *
    `, [
      eventId, userId, deviceId, sessionId, schoolId,
      eventName, eventCategory, screenName,
      eventProperties ? JSON.stringify(eventProperties) : null,
      userProperties ? JSON.stringify(userProperties) : null,
      clientTimestamp, appVersion, osVersion,
      networkType, isOfflineEvent,
      geographicInfo ? JSON.stringify(geographicInfo) : null
    ]);

    return result.rows[0];
  }

  /**
   * Mobile Analytics Dashboard
   */
  async getMobileAnalyticsDashboard(schoolId, timeframe = '30days') {
    const endDate = new Date();
    let startDate = new Date();
    
    switch (timeframe) {
      case '7days':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30days':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '90days':
        startDate.setDate(startDate.getDate() - 90);
        break;
      default:
        startDate.setDate(startDate.getDate() - 30);
    }

    // Get various mobile analytics metrics
    const [
      deviceMetrics,
      notificationMetrics,
      sessionMetrics,
      performanceMetrics,
      crashMetrics
    ] = await Promise.all([
      // Device Statistics
      query(`
        SELECT 
          COUNT(*) as total_devices,
          COUNT(CASE WHEN is_active = true THEN 1 END) as active_devices,
          COUNT(CASE WHEN platform = 'ios' THEN 1 END) as ios_devices,
          COUNT(CASE WHEN platform = 'android' THEN 1 END) as android_devices,
          COUNT(CASE WHEN last_active >= $1 THEN 1 END) as recently_active
        FROM mobile_devices
        WHERE ($2 IS NULL OR school_id = $2)
      `, [startDate.toISOString(), schoolId]),
      
      // Notification Statistics
      query(`
        SELECT 
          COUNT(*) as total_notifications,
          COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered_notifications,
          COUNT(CASE WHEN status = 'opened' THEN 1 END) as opened_notifications,
          AVG(CASE WHEN opened_at IS NOT NULL AND sent_at IS NOT NULL 
               THEN EXTRACT(EPOCH FROM opened_at - sent_at) END) as avg_open_time_seconds
        FROM push_notifications
        WHERE created_at >= $1 AND ($2 IS NULL OR school_id = $2)
      `, [startDate.toISOString(), schoolId]),
      
      // Session Statistics
      query(`
        SELECT 
          COUNT(*) as total_sessions,
          AVG(duration_seconds) as avg_session_duration,
          AVG(memory_usage_mb) as avg_memory_usage,
          SUM(crash_count) as total_crashes,
          AVG(session_rating) as avg_session_rating
        FROM mobile_app_sessions
        WHERE session_start >= $1 AND ($2 IS NULL OR school_id = $2)
      `, [startDate.toISOString(), schoolId]),
      
      // Performance Metrics
      query(`
        SELECT 
          metric_type,
          AVG(metric_value) as avg_value,
          MIN(metric_value) as min_value,
          MAX(metric_value) as max_value,
          COUNT(*) as metric_count
        FROM mobile_performance_metrics
        WHERE timestamp >= $1 AND ($2 IS NULL OR school_id = $2)
        GROUP BY metric_type
      `, [startDate.toISOString(), schoolId]),
      
      // Crash Statistics
      query(`
        SELECT 
          COUNT(*) as total_crashes,
          COUNT(DISTINCT exception_name) as unique_crash_types,
          AVG(similar_crashes_count) as avg_crash_frequency
        FROM mobile_crash_reports
        WHERE crash_timestamp >= $1 AND ($2 IS NULL OR school_id = $2)
      `, [startDate.toISOString(), schoolId])
    ]);

    return {
      timeframe,
      period: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      },
      metrics: {
        devices: deviceMetrics.rows[0],
        notifications: notificationMetrics.rows[0],
        sessions: sessionMetrics.rows[0],
        performance: performanceMetrics.rows,
        crashes: crashMetrics.rows[0]
      },
      generatedAt: new Date().toISOString()
    };
  }
}

module.exports = new MobileOptimizationService();