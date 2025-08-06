const { query } = require('../../config/database');
const { ValidationError } = require('../../middleware/errorHandler');

class MobileNotificationController {
  // =============================================================================
  // PUSH NOTIFICATION MANAGEMENT
  // =============================================================================

  // Send individual push notification
  static async sendPushNotification(req, res, next) {
    try {
      const {
        userId,
        role,
        type,
        title,
        message,
        data = {},
        priority = 'normal',
        sound = 'default',
        badge = 1,
        scheduleAt = null
      } = req.body;

      if (!userId || !title || !message) {
        throw new ValidationError('User ID, title, and message are required');
      }

      // Get user's device tokens
      const deviceTokens = await query(`
        SELECT device_token, platform
        FROM user_devices
        WHERE user_id = $1 AND is_active = true AND device_token IS NOT NULL
      `, [userId]);

      if (deviceTokens.rows.length === 0) {
        throw new ValidationError('No active devices found for user');
      }

      // Create notification record
      const notification = await query(`
        INSERT INTO push_notifications (
          user_id, type, title, message, data, priority, sound, badge,
          schedule_at, status, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `, [
        userId, type, title, message, JSON.stringify(data), priority, sound, badge,
        scheduleAt, scheduleAt ? 'scheduled' : 'pending', req.user.userId
      ]);

      // Send to each device
      const deliveryResults = await Promise.all(
        deviceTokens.rows.map(device => 
          MobileNotificationController.sendToDevice(device, notification.rows[0])
        )
      );

      const successCount = deliveryResults.filter(result => result.success).length;
      const failureCount = deliveryResults.length - successCount;

      // Update notification status
      await query(`
        UPDATE push_notifications 
        SET status = $1, 
            delivery_count = $2,
            failure_count = $3,
            sent_at = CURRENT_TIMESTAMP
        WHERE id = $4
      `, [
        successCount > 0 ? 'sent' : 'failed',
        successCount,
        failureCount,
        notification.rows[0].id
      ]);

      res.json({
        success: true,
        message: 'Push notification sent',
        data: {
          notificationId: notification.rows[0].id,
          devicesTargeted: deviceTokens.rows.length,
          successfulDeliveries: successCount,
          failedDeliveries: failureCount
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Schedule notification
  static async scheduleNotification(req, res, next) {
    try {
      const {
        userId,
        sendAt,
        recurring = { enabled: false },
        notification
      } = req.body;

      if (!userId || !sendAt || !notification) {
        throw new ValidationError('User ID, send time, and notification details are required');
      }

      const result = await query(`
        INSERT INTO scheduled_notifications (
          user_id, title, message, data, send_at, recurring_config,
          priority, sound, badge, status, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'scheduled', $10)
        RETURNING *
      `, [
        userId, notification.title, notification.message,
        JSON.stringify(notification.data || {}), sendAt, JSON.stringify(recurring),
        notification.priority || 'normal', notification.sound || 'default',
        notification.badge || 1, req.user.userId
      ]);

      res.status(201).json({
        success: true,
        message: 'Notification scheduled successfully',
        data: {
          scheduledNotificationId: result.rows[0].id,
          sendAt,
          recurring: recurring.enabled
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Broadcast notification to multiple users
  static async broadcastNotification(req, res, next) {
    try {
      const {
        audience,
        notification
      } = req.body;

      if (!audience || !notification) {
        throw new ValidationError('Audience and notification details are required');
      }

      let targetUsers = [];

      // Build user query based on audience criteria
      if (audience.roles && audience.roles.length > 0) {
        const roleUsers = await query(`
          SELECT DISTINCT id FROM users
          WHERE user_type = ANY($1) AND is_active = true
          ${audience.schools ? 'AND school_id = ANY($2)' : ''}
        `, audience.schools ? [audience.roles, audience.schools] : [audience.roles]);
        
        targetUsers = targetUsers.concat(roleUsers.rows.map(u => u.id));
      }

      if (audience.custom && audience.custom.length > 0) {
        targetUsers = targetUsers.concat(audience.custom);
      }

      // Remove duplicates
      targetUsers = [...new Set(targetUsers)];

      if (targetUsers.length === 0) {
        throw new ValidationError('No target users found');
      }

      // Create broadcast record
      const broadcast = await query(`
        INSERT INTO notification_broadcasts (
          title, message, data, priority, target_criteria, recipient_count,
          created_by, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'processing')
        RETURNING *
      `, [
        notification.title, notification.message, JSON.stringify(notification.data || {}),
        notification.priority || 'normal', JSON.stringify(audience), targetUsers.length,
        req.user.userId
      ]);

      // Send to all target users (in production, this would be queued)
      const sendPromises = targetUsers.map(async (userId) => {
        try {
          const deviceTokens = await query(`
            SELECT device_token, platform
            FROM user_devices
            WHERE user_id = $1 AND is_active = true AND device_token IS NOT NULL
          `, [userId]);

          const userNotification = await query(`
            INSERT INTO push_notifications (
              user_id, type, title, message, data, priority, sound, badge,
              broadcast_id, status, created_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', $10)
            RETURNING *
          `, [
            userId, 'broadcast', notification.title, notification.message,
            JSON.stringify(notification.data || {}), notification.priority || 'normal',
            notification.sound || 'default', notification.badge || 1,
            broadcast.rows[0].id, req.user.userId
          ]);

          // Send to user's devices
          if (deviceTokens.rows.length > 0) {
            await Promise.all(
              deviceTokens.rows.map(device => 
                MobileNotificationController.sendToDevice(device, userNotification.rows[0])
              )
            );
          }

          return { userId, success: true };
        } catch (error) {
          return { userId, success: false, error: error.message };
        }
      });

      const results = await Promise.all(sendPromises);
      const successCount = results.filter(r => r.success).length;

      // Update broadcast status
      await query(`
        UPDATE notification_broadcasts 
        SET status = 'completed',
            successful_deliveries = $1,
            failed_deliveries = $2,
            completed_at = CURRENT_TIMESTAMP
        WHERE id = $3
      `, [successCount, results.length - successCount, broadcast.rows[0].id]);

      res.json({
        success: true,
        message: `Broadcast sent to ${successCount} out of ${targetUsers.length} users`,
        data: {
          broadcastId: broadcast.rows[0].id,
          targetCount: targetUsers.length,
          successfulDeliveries: successCount,
          failedDeliveries: results.length - successCount
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // =============================================================================
  // NOTIFICATION HISTORY AND ANALYTICS
  // =============================================================================

  // Get notification history
  static async getNotificationHistory(req, res, next) {
    try {
      const { 
        userId, 
        type, 
        status,
        startDate,
        endDate,
        limit = 50, 
        offset = 0 
      } = req.query;

      let whereClause = 'WHERE 1=1';
      const params = [];

      if (userId) {
        whereClause += ` AND user_id = $${params.length + 1}`;
        params.push(userId);
      }

      if (type) {
        whereClause += ` AND type = $${params.length + 1}`;
        params.push(type);
      }

      if (status) {
        whereClause += ` AND status = $${params.length + 1}`;
        params.push(status);
      }

      if (startDate) {
        whereClause += ` AND created_at >= $${params.length + 1}`;
        params.push(startDate);
      }

      if (endDate) {
        whereClause += ` AND created_at <= $${params.length + 1}`;
        params.push(endDate);
      }

      const notifications = await query(`
        SELECT 
          pn.*,
          u.first_name,
          u.last_name,
          nb.title as broadcast_title
        FROM push_notifications pn
        JOIN users u ON pn.user_id = u.id
        LEFT JOIN notification_broadcasts nb ON pn.broadcast_id = nb.id
        ${whereClause}
        ORDER BY pn.created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `, [...params, limit, offset]);

      res.json({
        success: true,
        data: {
          notifications: notifications.rows.map(notif => ({
            id: notif.id,
            user: `${notif.first_name} ${notif.last_name}`,
            type: notif.type,
            title: notif.title,
            message: notif.message,
            data: notif.data ? JSON.parse(notif.data) : {},
            status: notif.status,
            priority: notif.priority,
            deliveryCount: notif.delivery_count,
            failureCount: notif.failure_count,
            createdAt: notif.created_at,
            sentAt: notif.sent_at,
            broadcastTitle: notif.broadcast_title
          })),
          pagination: {
            limit: parseInt(limit),
            offset: parseInt(offset),
            total: notifications.rows.length
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Get notification analytics
  static async getNotificationAnalytics(req, res, next) {
    try {
      const { period = '7d' } = req.query;

      const timeInterval = period === '1d' ? '1 day' : 
                          period === '7d' ? '7 days' : 
                          period === '30d' ? '30 days' : '7 days';

      const [overview, byType, byStatus, deliveryTrends] = await Promise.all([
        // Overview statistics
        query(`
          SELECT 
            COUNT(*) as total_notifications,
            COUNT(DISTINCT user_id) as unique_recipients,
            SUM(delivery_count) as total_deliveries,
            SUM(failure_count) as total_failures,
            AVG(delivery_count) as avg_delivery_rate
          FROM push_notifications
          WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '${timeInterval}'
        `),

        // By notification type
        query(`
          SELECT 
            type,
            COUNT(*) as count,
            SUM(delivery_count) as deliveries,
            SUM(failure_count) as failures
          FROM push_notifications
          WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '${timeInterval}'
          GROUP BY type
          ORDER BY count DESC
        `),

        // By status
        query(`
          SELECT 
            status,
            COUNT(*) as count,
            ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
          FROM push_notifications
          WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '${timeInterval}'
          GROUP BY status
        `),

        // Delivery trends
        query(`
          SELECT 
            DATE_TRUNC('day', created_at) as date,
            COUNT(*) as notifications_sent,
            SUM(delivery_count) as successful_deliveries,
            SUM(failure_count) as failed_deliveries
          FROM push_notifications
          WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '${timeInterval}'
          GROUP BY DATE_TRUNC('day', created_at)
          ORDER BY date
        `)
      ]);

      res.json({
        success: true,
        data: {
          period,
          overview: overview.rows[0],
          byType: byType.rows,
          byStatus: byStatus.rows,
          deliveryTrends: deliveryTrends.rows
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // =============================================================================
  // DEVICE REGISTRATION
  // =============================================================================

  // Register device for push notifications
  static async registerDevice(req, res, next) {
    try {
      const { deviceToken, platform, deviceInfo = {} } = req.body;
      const userId = req.user.userId;

      if (!deviceToken || !platform) {
        throw new ValidationError('Device token and platform are required');
      }

      // Register or update device
      const result = await query(`
        INSERT INTO user_devices (
          user_id, device_token, platform, device_info, is_active
        ) VALUES ($1, $2, $3, $4, true)
        ON CONFLICT (user_id, device_token)
        DO UPDATE SET 
          platform = EXCLUDED.platform,
          device_info = EXCLUDED.device_info,
          is_active = true,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `, [userId, deviceToken, platform, JSON.stringify(deviceInfo)]);

      res.json({
        success: true,
        message: 'Device registered for push notifications',
        data: {
          deviceId: result.rows[0].id,
          platform,
          registeredAt: result.rows[0].updated_at || result.rows[0].created_at
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Unregister device
  static async unregisterDevice(req, res, next) {
    try {
      const { deviceToken } = req.body;
      const userId = req.user.userId;

      if (!deviceToken) {
        throw new ValidationError('Device token is required');
      }

      await query(`
        UPDATE user_devices 
        SET is_active = false, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $1 AND device_token = $2
      `, [userId, deviceToken]);

      res.json({
        success: true,
        message: 'Device unregistered from push notifications'
      });
    } catch (error) {
      next(error);
    }
  }

  // =============================================================================
  // NOTIFICATION PREFERENCES
  // =============================================================================

  // Get user notification preferences
  static async getNotificationPreferences(req, res, next) {
    try {
      const userId = req.user.userId;

      const preferences = await query(`
        SELECT * FROM notification_preferences
        WHERE user_id = $1
      `, [userId]);

      if (preferences.rows.length === 0) {
        // Create default preferences
        const defaultPrefs = {
          grades: { push: true, email: true, sms: false },
          attendance: { push: true, email: false, sms: true },
          announcements: { push: true, email: true, sms: false },
          fees: { push: true, email: true, sms: true },
          timetable: { push: true, email: false, sms: false }
        };

        await query(`
          INSERT INTO notification_preferences (user_id, preferences)
          VALUES ($1, $2)
        `, [userId, JSON.stringify(defaultPrefs)]);

        return res.json({
          success: true,
          data: { preferences: defaultPrefs }
        });
      }

      res.json({
        success: true,
        data: {
          preferences: JSON.parse(preferences.rows[0].preferences)
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Update notification preferences
  static async updateNotificationPreferences(req, res, next) {
    try {
      const { preferences } = req.body;
      const userId = req.user.userId;

      if (!preferences) {
        throw new ValidationError('Preferences object is required');
      }

      await query(`
        INSERT INTO notification_preferences (user_id, preferences)
        VALUES ($1, $2)
        ON CONFLICT (user_id)
        DO UPDATE SET 
          preferences = EXCLUDED.preferences,
          updated_at = CURRENT_TIMESTAMP
      `, [userId, JSON.stringify(preferences)]);

      res.json({
        success: true,
        message: 'Notification preferences updated',
        data: { preferences }
      });
    } catch (error) {
      next(error);
    }
  }

  // =============================================================================
  // HELPER METHODS
  // =============================================================================

  // Send notification to specific device
  static async sendToDevice(device, notification) {
    try {
      // In production, this would use Firebase FCM, Apple Push Notification service, etc.
      // For now, we'll simulate the sending process
      
      const payload = {
        to: device.device_token,
        notification: {
          title: notification.title,
          body: notification.message,
          sound: notification.sound,
          badge: notification.badge
        },
        data: notification.data ? JSON.parse(notification.data) : {},
        priority: notification.priority === 'high' ? 'high' : 'normal'
      };

      // Simulate API call to push service
      await new Promise(resolve => setTimeout(resolve, 100));

      // Log delivery attempt
      await query(`
        INSERT INTO notification_deliveries (
          notification_id, device_token, platform, status, delivered_at
        ) VALUES ($1, $2, $3, 'delivered', CURRENT_TIMESTAMP)
      `, [notification.id, device.device_token, device.platform]);

      return { success: true, deviceToken: device.device_token };
    } catch (error) {
      // Log delivery failure
      await query(`
        INSERT INTO notification_deliveries (
          notification_id, device_token, platform, status, error_message, delivered_at
        ) VALUES ($1, $2, $3, 'failed', $4, CURRENT_TIMESTAMP)
      `, [notification.id, device.device_token, device.platform, error.message]);

      return { success: false, deviceToken: device.device_token, error: error.message };
    }
  }

  // Process scheduled notifications (would be called by a cron job)
  static async processScheduledNotifications() {
    try {
      const dueNotifications = await query(`
        SELECT * FROM scheduled_notifications
        WHERE status = 'scheduled' 
          AND send_at <= CURRENT_TIMESTAMP
      `);

      for (const notification of dueNotifications.rows) {
        // Send the notification
        await MobileNotificationController.sendPushNotification({
          body: {
            userId: notification.user_id,
            title: notification.title,
            message: notification.message,
            data: JSON.parse(notification.data || '{}'),
            priority: notification.priority,
            sound: notification.sound,
            badge: notification.badge
          },
          user: { userId: 'system' }
        }, null, () => {});

        // Update status
        await query(`
          UPDATE scheduled_notifications 
          SET status = 'sent', sent_at = CURRENT_TIMESTAMP
          WHERE id = $1
        `, [notification.id]);

        // Handle recurring notifications
        const recurringConfig = JSON.parse(notification.recurring_config || '{}');
        if (recurringConfig.enabled) {
          let nextSendAt = new Date(notification.send_at);
          
          switch (recurringConfig.frequency) {
            case 'daily':
              nextSendAt.setDate(nextSendAt.getDate() + 1);
              break;
            case 'weekly':
              nextSendAt.setDate(nextSendAt.getDate() + 7);
              break;
            case 'monthly':
              nextSendAt.setMonth(nextSendAt.getMonth() + 1);
              break;
          }

          if (!recurringConfig.until || nextSendAt <= new Date(recurringConfig.until)) {
            await query(`
              INSERT INTO scheduled_notifications (
                user_id, title, message, data, send_at, recurring_config,
                priority, sound, badge, status, created_by
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'scheduled', $10)
            `, [
              notification.user_id, notification.title, notification.message,
              notification.data, nextSendAt, notification.recurring_config,
              notification.priority, notification.sound, notification.badge,
              notification.created_by
            ]);
          }
        }
      }
    } catch (error) {
      console.error('Error processing scheduled notifications:', error);
    }
  }
}

module.exports = MobileNotificationController;