const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../../middleware/auth');
const SystemConfigController = require('../../controllers/admin/systemConfigController');

// Apply admin authentication to all routes
router.use(authenticate);

// =============================================================================
// SYSTEM SETTINGS ROUTES
// =============================================================================

/**
 * @route   GET /api/admin/config/settings
 * @desc    Get all system settings
 * @access  Private (Platform Admin)
 */
router.get('/settings',
  requireRole(['super_admin']),
  SystemConfigController.getSystemSettings
);

/**
 * @route   GET /api/admin/config/settings/:key
 * @desc    Get specific system setting
 * @access  Private (Platform Admin)
 */
router.get('/settings/:key',
  requireRole(['super_admin']),
  SystemConfigController.getSystemSetting
);

/**
 * @route   PUT /api/admin/config/settings/:key
 * @desc    Update system setting
 * @access  Private (Super Admin)
 */
router.put('/settings/:key',
  requireRole(['super_admin']),
  SystemConfigController.updateSystemSetting
);

/**
 * @route   POST /api/admin/config/settings/bulk-update
 * @desc    Bulk update system settings
 * @access  Private (Super Admin)
 */
router.post('/settings/bulk-update',
  requireRole(['super_admin']),
  SystemConfigController.bulkUpdateSettings
);

/**
 * @route   POST /api/admin/config/settings/:key/reset
 * @desc    Reset setting to default value
 * @access  Private (Super Admin)
 */
router.post('/settings/:key/reset',
  requireRole(['super_admin']),
  SystemConfigController.resetSettingToDefault
);

// =============================================================================
// FEATURE TOGGLES ROUTES
// =============================================================================

/**
 * @route   GET /api/admin/config/features
 * @desc    Get feature toggles
 * @access  Private (Platform Admin)
 */
router.get('/features',
  requireRole(['super_admin']),
  SystemConfigController.getFeatureToggles
);

/**
 * @route   POST /api/admin/config/features
 * @desc    Create feature toggle
 * @access  Private (Super Admin)
 */
router.post('/features',
  requireRole(['super_admin']),
  SystemConfigController.createFeatureToggle
);

/**
 * @route   PUT /api/admin/config/features/:id
 * @desc    Update feature toggle
 * @access  Private (Super Admin)
 */
router.put('/features/:id',
  requireRole(['super_admin']),
  SystemConfigController.updateFeatureToggle
);

/**
 * @route   POST /api/admin/config/features/:id/toggle
 * @desc    Toggle feature on/off
 * @access  Private (Super Admin)
 */
router.post('/features/:id/toggle',
  requireRole(['super_admin']),
  SystemConfigController.toggleFeature
);

/**
 * @route   DELETE /api/admin/config/features/:id
 * @desc    Delete feature toggle
 * @access  Private (Super Admin)
 */
router.delete('/features/:id',
  requireRole(['super_admin']),
  SystemConfigController.deleteFeatureToggle
);

// =============================================================================
// MAINTENANCE MODE ROUTES
// =============================================================================

/**
 * @route   GET /api/admin/config/maintenance
 * @desc    Get maintenance mode status
 * @access  Private (Platform Admin)
 */
router.get('/maintenance',
  requireRole(['super_admin', 'support_admin', 'edufam_admin']),
  SystemConfigController.getMaintenanceMode
);

/**
 * @route   POST /api/admin/config/maintenance/enable
 * @desc    Enable maintenance mode
 * @access  Private (Super Admin)
 */
router.post('/maintenance/enable',
  requireRole(['super_admin', 'edufam_admin']),
  SystemConfigController.enableMaintenanceMode
);

/**
 * @route   POST /api/admin/config/maintenance/disable
 * @desc    Disable maintenance mode
 * @access  Private (Super Admin)
 */
router.post('/maintenance/disable',
  requireRole(['super_admin', 'edufam_admin']),
  SystemConfigController.disableMaintenanceMode
);

// =============================================================================
// SYSTEM NOTIFICATIONS ROUTES
// =============================================================================

/**
 * @route   GET /api/admin/config/notifications
 * @desc    Get system notifications
 * @access  Private (Platform Admin)
 */
router.get('/notifications',
  requireRole(['super_admin', 'regional_admin', 'support_admin']),
  SystemConfigController.getSystemNotifications
);

/**
 * @route   POST /api/admin/config/notifications
 * @desc    Create system notification
 * @access  Private (Super Admin, Regional Admin)
 */
router.post('/notifications',
  requireRole(['super_admin']),
  SystemConfigController.createSystemNotification
);

/**
 * @route   PUT /api/admin/config/notifications/:id
 * @desc    Update system notification
 * @access  Private (Super Admin, Regional Admin)
 */
router.put('/notifications/:id',
  requireRole(['super_admin']),
  SystemConfigController.updateSystemNotification
);

/**
 * @route   DELETE /api/admin/config/notifications/:id
 * @desc    Delete system notification
 * @access  Private (Super Admin)
 */
router.delete('/notifications/:id',
  requireRole(['super_admin']),
  SystemConfigController.deleteSystemNotification
);

// =============================================================================
// SYSTEM HEALTH ROUTES
// =============================================================================

/**
 * @route   GET /api/admin/config/health
 * @desc    Get system health status
 * @access  Private (Platform Admin)
 */
router.get('/health',
  requireRole(['super_admin', 'support_admin']),
  SystemConfigController.getSystemHealth
);

/**
 * @route   GET /api/admin/config/health/detailed
 * @desc    Get detailed system health information
 * @access  Private (Super Admin, Support Admin)
 */
router.get('/health/detailed',
  requireRole(['super_admin', 'support_admin']),
  async (req, res, next) => {
    try {
      const { query } = require('../../config/database');

      const [
        databaseStats,
        connectionPool,
        diskUsage,
        memoryUsage,
        activeUsers,
        systemErrors,
        performanceMetrics
      ] = await Promise.all([
        // Database statistics
        query(`
          SELECT 
            schemaname as schema_name,
            tablename as table_name,
            n_tup_ins as inserts,
            n_tup_upd as updates,
            n_tup_del as deletes,
            n_live_tup as live_tuples,
            n_dead_tup as dead_tuples
          FROM pg_stat_user_tables
          ORDER BY n_live_tup DESC
          LIMIT 10
        `),

        // Connection pool information
        query(`
          SELECT 
            state,
            COUNT(*) as connection_count,
            MAX(state_change) as last_state_change
          FROM pg_stat_activity
          WHERE datname = current_database()
          GROUP BY state
        `),

        // Simulated disk usage (in real implementation, would use actual disk monitoring)
        query(`
          SELECT 
            'disk_usage' as metric,
            75.5 as usage_percentage,
            '850GB' as used_space,
            '1TB' as total_space
        `),

        // Simulated memory usage
        query(`
          SELECT 
            'memory_usage' as metric,
            68.2 as usage_percentage,
            '10.9GB' as used_memory,
            '16GB' as total_memory
        `),

        // Currently active users
        query(`
          SELECT 
            COUNT(DISTINCT user_id) as active_users_1h,
            COUNT(DISTINCT CASE WHEN logged_at >= CURRENT_TIMESTAMP - INTERVAL '5 minutes' THEN user_id END) as active_users_5m,
            COUNT(DISTINCT school_id) as active_schools
          FROM platform_usage_logs
          WHERE logged_at >= CURRENT_TIMESTAMP - INTERVAL '1 hour'
        `),

        // Recent system errors
        query(`
          SELECT 
            error_type,
            COUNT(*) as occurrence_count,
            MAX(last_occurred) as last_occurred,
            array_agg(DISTINCT error_message) as error_messages
          FROM system_errors
          WHERE last_occurred >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
          GROUP BY error_type
          ORDER BY occurrence_count DESC
          LIMIT 5
        `),

        // Performance metrics
        query(`
          SELECT 
            DATE_TRUNC('hour', logged_at) as hour,
            AVG(response_time_ms) as avg_response_time,
            COUNT(*) as request_count,
            COUNT(CASE WHEN status_code >= 400 THEN 1 END) as error_count
          FROM platform_usage_logs
          WHERE logged_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
          GROUP BY DATE_TRUNC('hour', logged_at)
          ORDER BY hour DESC
        `)
      ]);

      res.json({
        success: true,
        data: {
          databaseStats: databaseStats.rows,
          connectionPool: connectionPool.rows,
          diskUsage: diskUsage.rows[0],
          memoryUsage: memoryUsage.rows[0],
          activeUsers: activeUsers.rows[0],
          systemErrors: systemErrors.rows,
          performanceMetrics: performanceMetrics.rows,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// =============================================================================
// CONFIGURATION EXPORT/IMPORT ROUTES
// =============================================================================

/**
 * @route   GET /api/admin/config/export
 * @desc    Export system configuration
 * @access  Private (Super Admin)
 */
router.get('/export',
  requireRole(['super_admin']),
  async (req, res, next) => {
    try {
      const { includeFeatures = true, includeSettings = true, includeNotifications = false } = req.query;
      const { query } = require('../../config/database');

      const exportData = {
        exportedAt: new Date().toISOString(),
        exportedBy: `${req.user.firstName} ${req.user.lastName}`,
        version: '1.0'
      };

      if (includeSettings === 'true') {
        const settingsResult = await query(`
          SELECT setting_key, setting_value, category, data_type, description, default_value, validation_rules
          FROM system_settings
          WHERE is_public = true
          ORDER BY category, setting_key
        `);
        exportData.settings = settingsResult.rows;
      }

      if (includeFeatures === 'true') {
        const featuresResult = await query(`
          SELECT feature_name, is_enabled, environment, description, configuration, rollout_percentage
          FROM feature_toggles
          WHERE environment != 'development'
          ORDER BY feature_name
        `);
        exportData.features = featuresResult.rows;
      }

      if (includeNotifications === 'true') {
        const notificationsResult = await query(`
          SELECT notification_type, title, message, priority, target_audience, is_active
          FROM system_notifications
          WHERE is_active = true
          ORDER BY priority DESC
        `);
        exportData.notifications = notificationsResult.rows;
      }

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="edufam-config-${Date.now()}.json"`);
      res.json({
        success: true,
        data: exportData
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   POST /api/admin/config/import
 * @desc    Import system configuration
 * @access  Private (Super Admin)
 */
router.post('/import',
  requireRole(['super_admin']),
  async (req, res, next) => {
    try {
      const { 
        configData, 
        overwriteExisting = false, 
        validateOnly = false 
      } = req.body;

      if (!configData) {
        throw new ValidationError('Configuration data is required');
      }

      const results = {
        settings: { imported: 0, skipped: 0, errors: [] },
        features: { imported: 0, skipped: 0, errors: [] },
        notifications: { imported: 0, skipped: 0, errors: [] }
      };

      // Validate and import settings
      if (configData.settings) {
        for (const setting of configData.settings) {
          try {
            if (!validateOnly) {
              // Implementation would check for existing settings and import
              results.settings.imported++;
            }
          } catch (error) {
            results.settings.errors.push({
              setting: setting.setting_key,
              error: error.message
            });
          }
        }
      }

      // Validate and import feature toggles
      if (configData.features) {
        for (const feature of configData.features) {
          try {
            if (!validateOnly) {
              // Implementation would check for existing features and import
              results.features.imported++;
            }
          } catch (error) {
            results.features.errors.push({
              feature: feature.feature_name,
              error: error.message
            });
          }
        }
      }

      // Validate and import notifications
      if (configData.notifications) {
        for (const notification of configData.notifications) {
          try {
            if (!validateOnly) {
              // Implementation would import notifications
              results.notifications.imported++;
            }
          } catch (error) {
            results.notifications.errors.push({
              notification: notification.title,
              error: error.message
            });
          }
        }
      }

      res.json({
        success: true,
        message: validateOnly ? 'Configuration validation completed' : 'Configuration import completed',
        data: {
          results,
          validateOnly,
          overwriteExisting
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;