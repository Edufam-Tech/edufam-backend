const { query } = require('../../config/database');
const { ValidationError, NotFoundError } = require('../../middleware/errorHandler');

class SystemConfigController {
  // =============================================================================
  // SYSTEM SETTINGS MANAGEMENT
  // =============================================================================

  // Get all system settings
  static async getSystemSettings(req, res, next) {
    try {
      const { category, scope = 'platform' } = req.query;

      let whereClause = 'WHERE 1=1';
      const params = [];

      if (category) {
        whereClause += ` AND category = $${params.length + 1}`;
        params.push(category);
      }

      if (scope) {
        whereClause += ` AND scope = $${params.length + 1}`;
        params.push(scope);
      }

      const result = await query(`
        SELECT 
          id, setting_key, setting_value, category, data_type, scope,
          description, is_encrypted, is_public, is_editable, default_value,
          validation_rules, created_at, updated_at,
          updated_by_name
        FROM system_settings
        ${whereClause}
        ORDER BY category, setting_key
      `, params);

      // Group settings by category
      const settingsByCategory = result.rows.reduce((acc, setting) => {
        if (!acc[setting.category]) {
          acc[setting.category] = [];
        }
        
        // Parse JSON values
        let parsedValue = setting.setting_value;
        if (setting.data_type === 'json' && setting.setting_value) {
          try {
            parsedValue = JSON.parse(setting.setting_value);
          } catch (e) {
            // Keep original value if JSON parsing fails
          }
        }

        acc[setting.category].push({
          ...setting,
          setting_value: parsedValue,
          validation_rules: setting.validation_rules ? JSON.parse(setting.validation_rules) : null
        });
        return acc;
      }, {});

      res.json({
        success: true,
        data: {
          settings: settingsByCategory,
          total: result.rows.length
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Get specific system setting
  static async getSystemSetting(req, res, next) {
    try {
      const { key } = req.params;

      const result = await query(`
        SELECT 
          id, setting_key, setting_value, category, data_type, scope,
          description, is_encrypted, is_public, is_editable, default_value,
          validation_rules, created_at, updated_at, updated_by_name
        FROM system_settings
        WHERE setting_key = $1
      `, [key]);

      if (result.rows.length === 0) {
        throw new NotFoundError('System setting not found');
      }

      const setting = result.rows[0];
      
      // Parse JSON values
      let parsedValue = setting.setting_value;
      if (setting.data_type === 'json' && setting.setting_value) {
        try {
          parsedValue = JSON.parse(setting.setting_value);
        } catch (e) {
          // Keep original value if JSON parsing fails
        }
      }

      res.json({
        success: true,
        data: {
          ...setting,
          setting_value: parsedValue,
          validation_rules: setting.validation_rules ? JSON.parse(setting.validation_rules) : null
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Update system setting
  static async updateSystemSetting(req, res, next) {
    try {
      const { key } = req.params;
      const { value, description } = req.body;

      if (value === undefined) {
        throw new ValidationError('Setting value is required');
      }

      // Get current setting to validate
      const currentSetting = await query(`
        SELECT * FROM system_settings WHERE setting_key = $1
      `, [key]);

      if (currentSetting.rows.length === 0) {
        throw new NotFoundError('System setting not found');
      }

      const setting = currentSetting.rows[0];

      if (!setting.is_editable) {
        throw new ValidationError('This setting is not editable');
      }

      // Validate setting value based on data type and validation rules
      const validatedValue = await SystemConfigController.validateSettingValue(
        value, 
        setting.data_type, 
        setting.validation_rules
      );

      // Prepare value for storage
      let storedValue = validatedValue;
      if (setting.data_type === 'json') {
        storedValue = JSON.stringify(validatedValue);
      }

      // Update setting
      const result = await query(`
        UPDATE system_settings 
        SET setting_value = $1,
            description = COALESCE($2, description),
            updated_at = CURRENT_TIMESTAMP,
            updated_by = $3,
            updated_by_name = $4
        WHERE setting_key = $5
        RETURNING *
      `, [
        storedValue, 
        description, 
        req.user.userId, 
        `${req.user.firstName} ${req.user.lastName}`,
        key
      ]);

      // Log setting change
      await query(`
        INSERT INTO system_setting_changes (
          setting_key, old_value, new_value, changed_by, changed_by_name, change_reason
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        key,
        setting.setting_value,
        storedValue,
        req.user.userId,
        `${req.user.firstName} ${req.user.lastName}`,
        description || 'Setting updated via admin panel'
      ]);

      res.json({
        success: true,
        message: 'System setting updated successfully',
        data: {
          ...result.rows[0],
          setting_value: validatedValue
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Bulk update system settings
  static async bulkUpdateSettings(req, res, next) {
    try {
      const { settings } = req.body;

      if (!settings || !Array.isArray(settings) || settings.length === 0) {
        throw new ValidationError('Settings array is required');
      }

      const results = [];
      const errors = [];

      for (const settingUpdate of settings) {
        try {
          const { key, value, description } = settingUpdate;
          
          // Simulate individual update
          req.params.key = key;
          req.body = { value, description };
          
          const mockRes = {
            json: (data) => {
              results.push({ key, success: true, data: data.data });
            }
          };

          await SystemConfigController.updateSystemSetting(req, mockRes, (error) => {
            if (error) throw error;
          });
        } catch (error) {
          errors.push({ 
            key: settingUpdate.key, 
            error: error.message 
          });
        }
      }

      res.json({
        success: true,
        message: `Bulk update completed. ${results.length} settings updated, ${errors.length} errors`,
        data: {
          updated: results,
          errors: errors,
          summary: {
            total: settings.length,
            successful: results.length,
            failed: errors.length
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Reset setting to default
  static async resetSettingToDefault(req, res, next) {
    try {
      const { key } = req.params;

      const result = await query(`
        UPDATE system_settings 
        SET setting_value = default_value,
            updated_at = CURRENT_TIMESTAMP,
            updated_by = $1,
            updated_by_name = $2
        WHERE setting_key = $3
        RETURNING *
      `, [
        req.user.userId,
        `${req.user.firstName} ${req.user.lastName}`,
        key
      ]);

      if (result.rows.length === 0) {
        throw new NotFoundError('System setting not found');
      }

      res.json({
        success: true,
        message: 'Setting reset to default value',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }

  // =============================================================================
  // FEATURE TOGGLES MANAGEMENT
  // =============================================================================

  // Get feature toggles
  static async getFeatureToggles(req, res, next) {
    try {
      const { environment, school_id } = req.query;

      let whereClause = 'WHERE 1=1';
      const params = [];

      if (environment) {
        whereClause += ` AND (environment = $${params.length + 1} OR environment = 'all')`;
        params.push(environment);
      }

      if (school_id) {
        whereClause += ` AND (school_id = $${params.length + 1} OR school_id IS NULL)`;
        params.push(school_id);
      }

      const result = await query(`
        SELECT 
          id, feature_name, is_enabled, environment, school_id,
          description, configuration, rollout_percentage,
          start_date, end_date, created_at, updated_at,
          created_by_name, updated_by_name
        FROM feature_toggles
        ${whereClause}
        ORDER BY feature_name
      `, params);

      // Parse configuration JSON
      const features = result.rows.map(feature => ({
        ...feature,
        configuration: feature.configuration ? JSON.parse(feature.configuration) : null
      }));

      res.json({
        success: true,
        data: features
      });
    } catch (error) {
      next(error);
    }
  }

  // Create feature toggle
  static async createFeatureToggle(req, res, next) {
    try {
      const {
        featureName,
        isEnabled = false,
        environment = 'all',
        schoolId,
        description,
        configuration = {},
        rolloutPercentage = 100,
        startDate,
        endDate
      } = req.body;

      if (!featureName) {
        throw new ValidationError('Feature name is required');
      }

      // Check if feature toggle already exists
      const existing = await query(`
        SELECT id FROM feature_toggles 
        WHERE feature_name = $1 AND environment = $2 AND COALESCE(school_id, 0) = COALESCE($3, 0)
      `, [featureName, environment, schoolId]);

      if (existing.rows.length > 0) {
        throw new ValidationError('Feature toggle already exists for this environment/school combination');
      }

      const result = await query(`
        INSERT INTO feature_toggles (
          feature_name, is_enabled, environment, school_id, description,
          configuration, rollout_percentage, start_date, end_date,
          created_by, created_by_name
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `, [
        featureName, isEnabled, environment, schoolId, description,
        JSON.stringify(configuration), rolloutPercentage, startDate, endDate,
        req.user.userId, `${req.user.firstName} ${req.user.lastName}`
      ]);

      res.status(201).json({
        success: true,
        message: 'Feature toggle created successfully',
        data: {
          ...result.rows[0],
          configuration: JSON.parse(result.rows[0].configuration || '{}')
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Update feature toggle
  static async updateFeatureToggle(req, res, next) {
    try {
      const { id } = req.params;
      const updates = req.body;

      const allowedFields = [
        'is_enabled', 'description', 'configuration', 'rollout_percentage',
        'start_date', 'end_date'
      ];

      const setClause = [];
      const values = [];
      let paramIndex = 1;

      Object.keys(updates).forEach(key => {
        if (allowedFields.includes(key)) {
          if (key === 'configuration') {
            setClause.push(`configuration = $${paramIndex}`);
            values.push(JSON.stringify(updates[key]));
          } else {
            setClause.push(`${key} = $${paramIndex}`);
            values.push(updates[key]);
          }
          paramIndex++;
        }
      });

      if (setClause.length === 0) {
        throw new ValidationError('No valid fields provided for update');
      }

      setClause.push(`updated_at = CURRENT_TIMESTAMP`);
      setClause.push(`updated_by = $${paramIndex}`);
      setClause.push(`updated_by_name = $${paramIndex + 1}`);
      values.push(req.user.userId, `${req.user.firstName} ${req.user.lastName}`, id);

      const result = await query(`
        UPDATE feature_toggles 
        SET ${setClause.join(', ')}
        WHERE id = $${paramIndex + 2}
        RETURNING *
      `, values);

      if (result.rows.length === 0) {
        throw new NotFoundError('Feature toggle not found');
      }

      res.json({
        success: true,
        message: 'Feature toggle updated successfully',
        data: {
          ...result.rows[0],
          configuration: JSON.parse(result.rows[0].configuration || '{}')
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Toggle feature on/off
  static async toggleFeature(req, res, next) {
    try {
      const { id } = req.params;
      const { enabled } = req.body;

      if (typeof enabled !== 'boolean') {
        throw new ValidationError('Enabled must be a boolean value');
      }

      const result = await query(`
        UPDATE feature_toggles 
        SET is_enabled = $1,
            updated_at = CURRENT_TIMESTAMP,
            updated_by = $2,
            updated_by_name = $3
        WHERE id = $4
        RETURNING *
      `, [
        enabled,
        req.user.userId,
        `${req.user.firstName} ${req.user.lastName}`,
        id
      ]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Feature toggle not found');
      }

      res.json({
        success: true,
        message: `Feature ${enabled ? 'enabled' : 'disabled'} successfully`,
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }

  // Delete feature toggle
  static async deleteFeatureToggle(req, res, next) {
    try {
      const { id } = req.params;

      const result = await query(`
        DELETE FROM feature_toggles 
        WHERE id = $1
        RETURNING feature_name
      `, [id]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Feature toggle not found');
      }

      res.json({
        success: true,
        message: 'Feature toggle deleted successfully',
        data: { feature_name: result.rows[0].feature_name }
      });
    } catch (error) {
      next(error);
    }
  }

  // =============================================================================
  // MAINTENANCE MODE MANAGEMENT
  // =============================================================================

  // Get maintenance mode status
  static async getMaintenanceMode(req, res, next) {
    try {
      let result;
      try {
        result = await query(`
          SELECT 
            id,
            is_active,
            message,
            allowed_ips,
            scheduled_start,
            scheduled_end
          FROM maintenance_mode 
          WHERE is_active = true
          ORDER BY scheduled_start DESC
          LIMIT 1
        `);
      } catch (e) {
        // Fallback for environments without allowed_ips column
        result = await query(`
          SELECT 
            id,
            is_active,
            message,
            scheduled_start,
            scheduled_end
          FROM maintenance_mode 
          WHERE is_active = true
          ORDER BY scheduled_start DESC
          LIMIT 1
        `);
      }

      const maintenanceMode = result.rows[0] || {
        is_active: false,
        message: null,
        scheduled_start: null,
        scheduled_end: null
      };

      res.json({
        success: true,
        data: maintenanceMode
      });
    } catch (error) {
      next(error);
    }
  }

  // Enable maintenance mode
  static async enableMaintenanceMode(req, res, next) {
    try {
      const {
        message = 'System maintenance in progress. Please try again later.',
        estimatedEndTime,
        allowedIps = []
      } = req.body;

      // Disable any existing maintenance mode
      await query(`
        UPDATE maintenance_mode 
        SET is_active = false
        WHERE is_active = true
      `);

      // Create new maintenance mode
      let result;
      try {
        result = await query(`
          INSERT INTO maintenance_mode (
            is_active, message, allowed_ips, scheduled_start, scheduled_end,
            created_by
          ) VALUES (true, $1, $2::inet[], NOW(), $3, $4)
          RETURNING id, is_active, message, allowed_ips, scheduled_start, scheduled_end
        `, [
          message,
          Array.isArray(allowedIps) ? allowedIps : [],
          estimatedEndTime || null,
          req.user.userId
        ]);
      } catch (e) {
        // Fallback for environments without allowed_ips column
        result = await query(`
          INSERT INTO maintenance_mode (
            is_active, message, scheduled_start, scheduled_end,
            created_by
          ) VALUES (true, $1, NOW(), $2, $3)
          RETURNING id, is_active, message, scheduled_start, scheduled_end
        `, [
          message,
          estimatedEndTime || null,
          req.user.userId
        ]);
      }

      res.json({
        success: true,
        message: 'Maintenance mode enabled successfully',
        data: {
          ...result.rows[0]
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Disable maintenance mode
  static async disableMaintenanceMode(req, res, next) {
    try {
      let result;
      try {
        result = await query(`
          UPDATE maintenance_mode 
          SET is_active = false,
              updated_at = CURRENT_TIMESTAMP,
              created_by = COALESCE(created_by, $1)
          WHERE is_active = true
          RETURNING id, is_active, message, allowed_ips, scheduled_start, scheduled_end
        `, [req.user.userId]);
      } catch (e) {
        // Fallback for environments without allowed_ips column
        result = await query(`
          UPDATE maintenance_mode 
          SET is_active = false,
              updated_at = CURRENT_TIMESTAMP,
              created_by = COALESCE(created_by, $1)
          WHERE is_active = true
          RETURNING id, is_active, message, scheduled_start, scheduled_end
        `, [req.user.userId]);
      }

      if (result.rows.length === 0) {
        throw new NotFoundError('No active maintenance mode found');
      }

      res.json({
        success: true,
        message: 'Maintenance mode disabled successfully',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }

  // =============================================================================
  // SYSTEM NOTIFICATIONS MANAGEMENT
  // =============================================================================

  // Get system notifications
  static async getSystemNotifications(req, res, next) {
    try {
      const { 
        type, 
        isActive,
        limit = 20, 
        offset = 0 
      } = req.query;

      let whereClause = 'WHERE 1=1';
      const params = [];

      if (type) {
        whereClause += ` AND notification_type = $${params.length + 1}`;
        params.push(type);
      }

      if (isActive !== undefined) {
        whereClause += ` AND is_active = $${params.length + 1}`;
        params.push(isActive === 'true');
      }

      const result = await query(`
        SELECT 
          id, notification_type, title, message, priority, is_active,
          target_audience, display_duration, start_time, end_time,
          action_url, action_text, created_at, updated_at,
          created_by_name, updated_by_name
        FROM system_notifications
        ${whereClause}
        ORDER BY priority DESC, created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `, [...params, limit, offset]);

      res.json({
        success: true,
        data: result.rows,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: result.rows.length
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Create system notification
  static async createSystemNotification(req, res, next) {
    try {
      const {
        notificationType,
        title,
        message,
        priority = 'medium',
        targetAudience = 'all',
        displayDuration,
        startTime,
        endTime,
        actionUrl,
        actionText
      } = req.body;

      if (!notificationType || !title || !message) {
        throw new ValidationError('Notification type, title, and message are required');
      }

      const result = await query(`
        INSERT INTO system_notifications (
          notification_type, title, message, priority, target_audience,
          display_duration, start_time, end_time, action_url, action_text,
          created_by, created_by_name
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `, [
        notificationType, title, message, priority, targetAudience,
        displayDuration, startTime, endTime, actionUrl, actionText,
        req.user.userId, `${req.user.firstName} ${req.user.lastName}`
      ]);

      res.status(201).json({
        success: true,
        message: 'System notification created successfully',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }

  // Update system notification
  static async updateSystemNotification(req, res, next) {
    try {
      const { id } = req.params;
      const updates = req.body;

      const allowedFields = [
        'title', 'message', 'priority', 'target_audience', 'display_duration',
        'start_time', 'end_time', 'action_url', 'action_text', 'is_active'
      ];

      const setClause = [];
      const values = [];
      let paramIndex = 1;

      Object.keys(updates).forEach(key => {
        if (allowedFields.includes(key)) {
          setClause.push(`${key} = $${paramIndex}`);
          values.push(updates[key]);
          paramIndex++;
        }
      });

      if (setClause.length === 0) {
        throw new ValidationError('No valid fields provided for update');
      }

      setClause.push(`updated_at = CURRENT_TIMESTAMP`);
      setClause.push(`updated_by = $${paramIndex}`);
      setClause.push(`updated_by_name = $${paramIndex + 1}`);
      values.push(req.user.userId, `${req.user.firstName} ${req.user.lastName}`, id);

      const result = await query(`
        UPDATE system_notifications 
        SET ${setClause.join(', ')}
        WHERE id = $${paramIndex + 2}
        RETURNING *
      `, values);

      if (result.rows.length === 0) {
        throw new NotFoundError('System notification not found');
      }

      res.json({
        success: true,
        message: 'System notification updated successfully',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }

  // Delete system notification
  static async deleteSystemNotification(req, res, next) {
    try {
      const { id } = req.params;

      const result = await query(`
        DELETE FROM system_notifications 
        WHERE id = $1
        RETURNING title
      `, [id]);

      if (result.rows.length === 0) {
        throw new NotFoundError('System notification not found');
      }

      res.json({
        success: true,
        message: 'System notification deleted successfully',
        data: { title: result.rows[0].title }
      });
    } catch (error) {
      next(error);
    }
  }

  // =============================================================================
  // SYSTEM HEALTH AND STATUS
  // =============================================================================

  // Get system health status
  static async getSystemHealth(req, res, next) {
    try {
      const [
        databaseHealth,
        serviceHealth,
        systemMetrics,
        recentErrors
      ] = await Promise.all([
        // Database health
        query(`
          SELECT 
            'database' as service,
            CASE 
              WHEN COUNT(*) > 0 THEN 'healthy'
              ELSE 'unhealthy'
            END as status,
            COUNT(*) as connection_count
          FROM pg_stat_activity
          WHERE state = 'active'
        `),

        // Service health checks
        query(`
          SELECT 
            check_name,
            status,
            response_time_ms,
            check_timestamp,
            error_message
          FROM system_health_checks
          WHERE check_timestamp >= CURRENT_TIMESTAMP - INTERVAL '5 minutes'
          ORDER BY check_timestamp DESC
        `),

        // System metrics
        query(`
          SELECT 
            AVG(response_time_ms) as avg_response_time,
            COUNT(*) as total_requests,
            COUNT(CASE WHEN status_code >= 400 THEN 1 END) as error_count,
            COUNT(DISTINCT school_id) as active_schools
          FROM platform_usage_logs
          WHERE logged_at >= CURRENT_TIMESTAMP - INTERVAL '1 hour'
        `),

        // Recent errors
        query(`
          SELECT 
            error_type,
            error_message,
            occurrence_count,
            first_occurred,
            last_occurred
          FROM system_errors
          WHERE last_occurred >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
          ORDER BY last_occurred DESC
          LIMIT 10
        `)
      ]);

      const healthStatus = {
        overall: 'healthy', // Calculate based on individual service health
        timestamp: new Date().toISOString(),
        database: databaseHealth.rows[0],
        services: serviceHealth.rows,
        metrics: systemMetrics.rows[0],
        recentErrors: recentErrors.rows
      };

      // Determine overall health
      const unhealthyServices = serviceHealth.rows.filter(s => s.status !== 'healthy');
      if (unhealthyServices.length > 0) {
        healthStatus.overall = 'degraded';
      }

      res.json({
        success: true,
        data: healthStatus
      });
    } catch (error) {
      next(error);
    }
  }

  // =============================================================================
  // HELPER METHODS
  // =============================================================================

  // Validate setting value based on data type and rules
  static async validateSettingValue(value, dataType, validationRules) {
    const rules = validationRules ? JSON.parse(validationRules) : {};

    switch (dataType) {
      case 'string':
        if (typeof value !== 'string') {
          throw new ValidationError('Value must be a string');
        }
        if (rules.minLength && value.length < rules.minLength) {
          throw new ValidationError(`Value must be at least ${rules.minLength} characters`);
        }
        if (rules.maxLength && value.length > rules.maxLength) {
          throw new ValidationError(`Value must be at most ${rules.maxLength} characters`);
        }
        if (rules.pattern && !new RegExp(rules.pattern).test(value)) {
          throw new ValidationError('Value does not match required pattern');
        }
        break;

      case 'number':
        const numValue = Number(value);
        if (isNaN(numValue)) {
          throw new ValidationError('Value must be a number');
        }
        if (rules.min !== undefined && numValue < rules.min) {
          throw new ValidationError(`Value must be at least ${rules.min}`);
        }
        if (rules.max !== undefined && numValue > rules.max) {
          throw new ValidationError(`Value must be at most ${rules.max}`);
        }
        return numValue;

      case 'boolean':
        if (typeof value !== 'boolean') {
          throw new ValidationError('Value must be a boolean');
        }
        break;

      case 'json':
        if (typeof value === 'string') {
          try {
            return JSON.parse(value);
          } catch (e) {
            throw new ValidationError('Value must be valid JSON');
          }
        }
        return value;

      case 'array':
        if (!Array.isArray(value)) {
          throw new ValidationError('Value must be an array');
        }
        if (rules.minItems && value.length < rules.minItems) {
          throw new ValidationError(`Array must have at least ${rules.minItems} items`);
        }
        if (rules.maxItems && value.length > rules.maxItems) {
          throw new ValidationError(`Array must have at most ${rules.maxItems} items`);
        }
        break;

      default:
        // No validation for unknown types
        break;
    }

    return value;
  }
}

module.exports = SystemConfigController;