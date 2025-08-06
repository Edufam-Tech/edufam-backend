const { query } = require('../../config/database');
const { ValidationError, NotFoundError } = require('../../middleware/errorHandler');

class MonitoringController {
  // =============================================================================
  // SYSTEM HEALTH MONITORING
  // =============================================================================

  // Get system health overview
  static async getSystemHealthOverview(req, res, next) {
    try {
      const [
        overallHealth,
        serviceHealth,
        databaseHealth,
        performanceMetrics,
        alertsSummary
      ] = await Promise.all([
        // Overall system health
        MonitoringController.calculateOverallHealth(),
        
        // Individual service health
        query(`
          SELECT 
            check_name,
            status,
            response_time_ms,
            check_timestamp,
            error_message,
            consecutive_failures
          FROM system_health_checks
          WHERE check_timestamp >= CURRENT_TIMESTAMP - INTERVAL '5 minutes'
          ORDER BY check_timestamp DESC
        `),

        // Database health metrics
        query(`
          SELECT 
            'database' as component,
            COUNT(*) as active_connections,
            AVG(EXTRACT(EPOCH FROM (now() - state_change))::int) as avg_connection_age,
            MAX(EXTRACT(EPOCH FROM (now() - state_change))::int) as max_connection_age
          FROM pg_stat_activity
          WHERE state = 'active' AND datname = current_database()
        `),

        // Performance metrics (last hour)
        query(`
          SELECT 
            AVG(response_time_ms) as avg_response_time,
            MIN(response_time_ms) as min_response_time,
            MAX(response_time_ms) as max_response_time,
            PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY response_time_ms) as p95_response_time,
            COUNT(*) as total_requests,
            COUNT(CASE WHEN status_code >= 400 THEN 1 END) as error_count,
            COUNT(DISTINCT school_id) as active_schools,
            COUNT(DISTINCT user_id) as active_users
          FROM platform_usage_logs
          WHERE logged_at >= CURRENT_TIMESTAMP - INTERVAL '1 hour'
        `),

        // Active alerts summary
        query(`
          SELECT 
            severity,
            COUNT(*) as alert_count
          FROM system_alerts
          WHERE status = 'active' AND resolved_at IS NULL
          GROUP BY severity
        `)
      ]);

      const healthData = {
        overall: overallHealth,
        timestamp: new Date().toISOString(),
        services: serviceHealth.rows,
        database: databaseHealth.rows[0],
        performance: performanceMetrics.rows[0],
        alerts: {
          active: alertsSummary.rows,
          total: alertsSummary.rows.reduce((sum, alert) => sum + parseInt(alert.alert_count), 0)
        }
      };

      res.json({
        success: true,
        data: healthData
      });
    } catch (error) {
      next(error);
    }
  }

  // Perform comprehensive health check
  static async performHealthCheck(req, res, next) {
    try {
      const { includeDetailed = false } = req.query;

      const healthChecks = await Promise.all([
        MonitoringController.checkDatabaseHealth(),
        MonitoringController.checkAPIHealth(),
        MonitoringController.checkExternalServicesHealth(),
        MonitoringController.checkResourceHealth(),
        includeDetailed === 'true' ? MonitoringController.checkDetailedMetrics() : null
      ].filter(Boolean));

      // Record health check results
      const healthCheckId = await MonitoringController.recordHealthCheckResults(healthChecks, req.user.userId);

      const overallStatus = healthChecks.every(check => check.status === 'healthy') ? 'healthy' : 
                           healthChecks.some(check => check.status === 'critical') ? 'critical' : 'degraded';

      res.json({
        success: true,
        data: {
          healthCheckId,
          overallStatus,
          timestamp: new Date().toISOString(),
          checks: healthChecks,
          summary: {
            total: healthChecks.length,
            healthy: healthChecks.filter(c => c.status === 'healthy').length,
            degraded: healthChecks.filter(c => c.status === 'degraded').length,
            critical: healthChecks.filter(c => c.status === 'critical').length
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // =============================================================================
  // PERFORMANCE MONITORING
  // =============================================================================

  // Get performance metrics
  static async getPerformanceMetrics(req, res, next) {
    try {
      const { 
        period = '1h', // '5m', '1h', '24h', '7d', '30d'
        metric = 'all', // 'response_time', 'throughput', 'errors', 'resources'
        schoolId
      } = req.query;

      const periodMapping = {
        '5m': '5 minutes',
        '1h': '1 hour',
        '24h': '24 hours',
        '7d': '7 days',
        '30d': '30 days'
      };

      const timeInterval = periodMapping[period] || '1 hour';
      let schoolFilter = '';
      const params = [];

      if (schoolId) {
        schoolFilter = ' AND school_id = $1';
        params.push(schoolId);
      }

      const [
        responseTimeMetrics,
        throughputMetrics,
        errorMetrics,
        resourceMetrics
      ] = await Promise.all([
        // Response time metrics
        metric === 'all' || metric === 'response_time' ? query(`
          SELECT 
            DATE_TRUNC('minute', logged_at) as time_bucket,
            AVG(response_time_ms) as avg_response_time,
            MIN(response_time_ms) as min_response_time,
            MAX(response_time_ms) as max_response_time,
            PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY response_time_ms) as p50_response_time,
            PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY response_time_ms) as p95_response_time,
            PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY response_time_ms) as p99_response_time
          FROM platform_usage_logs
          WHERE logged_at >= CURRENT_TIMESTAMP - INTERVAL '${timeInterval}' ${schoolFilter}
          GROUP BY DATE_TRUNC('minute', logged_at)
          ORDER BY time_bucket DESC
        `, params) : Promise.resolve({ rows: [] }),

        // Throughput metrics
        metric === 'all' || metric === 'throughput' ? query(`
          SELECT 
            DATE_TRUNC('minute', logged_at) as time_bucket,
            COUNT(*) as requests_per_minute,
            COUNT(DISTINCT user_id) as unique_users,
            COUNT(DISTINCT school_id) as unique_schools,
            AVG(COUNT(*)) OVER (ORDER BY DATE_TRUNC('minute', logged_at) ROWS BETWEEN 4 PRECEDING AND CURRENT ROW) as moving_avg_rpm
          FROM platform_usage_logs
          WHERE logged_at >= CURRENT_TIMESTAMP - INTERVAL '${timeInterval}' ${schoolFilter}
          GROUP BY DATE_TRUNC('minute', logged_at)
          ORDER BY time_bucket DESC
        `, params) : Promise.resolve({ rows: [] }),

        // Error metrics
        metric === 'all' || metric === 'errors' ? query(`
          SELECT 
            DATE_TRUNC('minute', logged_at) as time_bucket,
            COUNT(*) as total_requests,
            COUNT(CASE WHEN status_code >= 400 THEN 1 END) as error_count,
            COUNT(CASE WHEN status_code >= 500 THEN 1 END) as server_error_count,
            COUNT(CASE WHEN status_code >= 400 AND status_code < 500 THEN 1 END) as client_error_count,
            (COUNT(CASE WHEN status_code >= 400 THEN 1 END)::float / COUNT(*) * 100) as error_rate
          FROM platform_usage_logs
          WHERE logged_at >= CURRENT_TIMESTAMP - INTERVAL '${timeInterval}' ${schoolFilter}
          GROUP BY DATE_TRUNC('minute', logged_at)
          ORDER BY time_bucket DESC
        `, params) : Promise.resolve({ rows: [] }),

        // Resource metrics (simulated - in production would come from system monitoring)
        metric === 'all' || metric === 'resources' ? query(`
          SELECT 
            CURRENT_TIMESTAMP as time_bucket,
            75.5 as cpu_usage_percent,
            68.2 as memory_usage_percent,
            82.1 as disk_usage_percent,
            45 as active_connections,
            100 as max_connections
        `) : Promise.resolve({ rows: [] })
      ]);

      res.json({
        success: true,
        data: {
          period,
          metric,
          schoolId,
          responseTime: responseTimeMetrics.rows,
          throughput: throughputMetrics.rows,
          errors: errorMetrics.rows,
          resources: resourceMetrics.rows
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Get slow query analysis
  static async getSlowQueryAnalysis(req, res, next) {
    try {
      const { limit = 10, minDuration = 1000 } = req.query;

      const [slowQueries, queryPatterns, resourceConsumers] = await Promise.all([
        // Slow queries from logs
        query(`
          SELECT 
            DATE_TRUNC('hour', logged_at) as hour,
            module_accessed,
            activity_type,
            AVG(response_time_ms) as avg_response_time,
            MAX(response_time_ms) as max_response_time,
            COUNT(*) as occurrence_count,
            COUNT(DISTINCT user_id) as affected_users,
            COUNT(DISTINCT school_id) as affected_schools
          FROM platform_usage_logs
          WHERE response_time_ms > $1
            AND logged_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
          GROUP BY DATE_TRUNC('hour', logged_at), module_accessed, activity_type
          ORDER BY max_response_time DESC
          LIMIT $2
        `, [minDuration, limit]),

        // Query patterns analysis
        query(`
          SELECT 
            module_accessed,
            COUNT(*) as total_requests,
            AVG(response_time_ms) as avg_response_time,
            MAX(response_time_ms) as max_response_time,
            COUNT(CASE WHEN response_time_ms > $1 THEN 1 END) as slow_requests,
            (COUNT(CASE WHEN response_time_ms > $1 THEN 1 END)::float / COUNT(*) * 100) as slow_request_rate
          FROM platform_usage_logs
          WHERE logged_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
            AND module_accessed IS NOT NULL
          GROUP BY module_accessed
          ORDER BY slow_request_rate DESC
        `, [minDuration]),

        // Resource consumers
        query(`
          SELECT 
            school_id,
            COUNT(*) as total_requests,
            AVG(response_time_ms) as avg_response_time,
            SUM(CASE WHEN response_time_ms > $1 THEN 1 ELSE 0 END) as slow_requests,
            COUNT(DISTINCT user_id) as unique_users
          FROM platform_usage_logs
          WHERE logged_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
          GROUP BY school_id
          ORDER BY total_requests DESC
          LIMIT $2
        `, [minDuration, limit])
      ]);

      res.json({
        success: true,
        data: {
          slowQueries: slowQueries.rows,
          queryPatterns: queryPatterns.rows,
          resourceConsumers: resourceConsumers.rows,
          criteria: {
            minDuration: parseInt(minDuration),
            limit: parseInt(limit)
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // =============================================================================
  // ALERTING SYSTEM
  // =============================================================================

  // Get alerts
  static async getAlerts(req, res, next) {
    try {
      const { 
        severity, 
        status = 'active', 
        category,
        limit = 50, 
        offset = 0 
      } = req.query;

      let whereClause = 'WHERE 1=1';
      const params = [];

      if (severity) {
        whereClause += ` AND severity = $${params.length + 1}`;
        params.push(severity);
      }

      if (status) {
        whereClause += ` AND status = $${params.length + 1}`;
        params.push(status);
      }

      if (category) {
        whereClause += ` AND category = $${params.length + 1}`;
        params.push(category);
      }

      const result = await query(`
        SELECT 
          sa.*,
          pa.first_name as created_by_first_name,
          pa.last_name as created_by_last_name,
          resolver.first_name as resolved_by_first_name,
          resolver.last_name as resolved_by_last_name
        FROM system_alerts sa
        LEFT JOIN platform_admins pa ON sa.created_by = pa.id
        LEFT JOIN platform_admins resolver ON sa.resolved_by = resolver.id
        ${whereClause}
        ORDER BY sa.created_at DESC
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

  // Create alert
  static async createAlert(req, res, next) {
    try {
      const {
        alertType,
        severity = 'medium',
        category = 'system',
        title,
        description,
        metadata = {},
        autoResolve = false,
        escalationMinutes = 30
      } = req.body;

      if (!alertType || !title || !description) {
        throw new ValidationError('Alert type, title, and description are required');
      }

      const result = await query(`
        INSERT INTO system_alerts (
          alert_type, severity, category, title, description, metadata,
          auto_resolve, escalation_minutes, created_by, created_by_name
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `, [
        alertType, severity, category, title, description, JSON.stringify(metadata),
        autoResolve, escalationMinutes, req.user.userId, `${req.user.firstName} ${req.user.lastName}`
      ]);

      // Trigger alert notifications
      await MonitoringController.triggerAlertNotifications(result.rows[0]);

      res.status(201).json({
        success: true,
        message: 'Alert created successfully',
        data: {
          ...result.rows[0],
          metadata: JSON.parse(result.rows[0].metadata || '{}')
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Resolve alert
  static async resolveAlert(req, res, next) {
    try {
      const { id } = req.params;
      const { resolution, resolutionNotes } = req.body;

      if (!resolution) {
        throw new ValidationError('Resolution status is required');
      }

      const result = await query(`
        UPDATE system_alerts 
        SET status = 'resolved',
            resolution = $1,
            resolution_notes = $2,
            resolved_at = CURRENT_TIMESTAMP,
            resolved_by = $3,
            resolved_by_name = $4
        WHERE id = $5 AND status = 'active'
        RETURNING *
      `, [
        resolution, resolutionNotes, req.user.userId,
        `${req.user.firstName} ${req.user.lastName}`, id
      ]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Active alert not found');
      }

      res.json({
        success: true,
        message: 'Alert resolved successfully',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }

  // Get alert rules
  static async getAlertRules(req, res, next) {
    try {
      const { isActive } = req.query;

      let whereClause = 'WHERE 1=1';
      const params = [];

      if (isActive !== undefined) {
        whereClause += ` AND is_active = $${params.length + 1}`;
        params.push(isActive === 'true');
      }

      const result = await query(`
        SELECT *
        FROM alert_rules
        ${whereClause}
        ORDER BY rule_name
      `, params);

      const rules = result.rows.map(rule => ({
        ...rule,
        conditions: JSON.parse(rule.conditions || '{}'),
        actions: JSON.parse(rule.actions || '{}'),
        metadata: JSON.parse(rule.metadata || '{}')
      }));

      res.json({
        success: true,
        data: rules
      });
    } catch (error) {
      next(error);
    }
  }

  // Create alert rule
  static async createAlertRule(req, res, next) {
    try {
      const {
        ruleName,
        description,
        category = 'performance',
        conditions = {},
        actions = {},
        severity = 'medium',
        cooldownMinutes = 15,
        metadata = {}
      } = req.body;

      if (!ruleName || !conditions || Object.keys(conditions).length === 0) {
        throw new ValidationError('Rule name and conditions are required');
      }

      const result = await query(`
        INSERT INTO alert_rules (
          rule_name, description, category, conditions, actions, severity,
          cooldown_minutes, metadata, created_by, created_by_name
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `, [
        ruleName, description, category, JSON.stringify(conditions),
        JSON.stringify(actions), severity, cooldownMinutes, JSON.stringify(metadata),
        req.user.userId, `${req.user.firstName} ${req.user.lastName}`
      ]);

      res.status(201).json({
        success: true,
        message: 'Alert rule created successfully',
        data: {
          ...result.rows[0],
          conditions: JSON.parse(result.rows[0].conditions),
          actions: JSON.parse(result.rows[0].actions),
          metadata: JSON.parse(result.rows[0].metadata || '{}')
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // =============================================================================
  // UPTIME MONITORING
  // =============================================================================

  // Get uptime statistics
  static async getUptimeStatistics(req, res, next) {
    try {
      const { period = '24h', service } = req.query;

      const periodMapping = {
        '1h': '1 hour',
        '24h': '24 hours',
        '7d': '7 days',
        '30d': '30 days'
      };

      const timeInterval = periodMapping[period] || '24 hours';
      let serviceFilter = '';
      const params = [];

      if (service) {
        serviceFilter = ' AND check_name = $1';
        params.push(service);
      }

      const [uptimeData, incidentHistory, serviceAvailability] = await Promise.all([
        // Overall uptime metrics
        query(`
          SELECT 
            check_name,
            COUNT(*) as total_checks,
            COUNT(CASE WHEN status = 'healthy' THEN 1 END) as successful_checks,
            COUNT(CASE WHEN status != 'healthy' THEN 1 END) as failed_checks,
            (COUNT(CASE WHEN status = 'healthy' THEN 1 END)::float / COUNT(*) * 100) as uptime_percentage,
            AVG(response_time_ms) as avg_response_time,
            MAX(response_time_ms) as max_response_time
          FROM system_health_checks
          WHERE check_timestamp >= CURRENT_TIMESTAMP - INTERVAL '${timeInterval}' ${serviceFilter}
          GROUP BY check_name
          ORDER BY uptime_percentage DESC
        `, params),

        // Incident history
        query(`
          SELECT 
            DATE_TRUNC('hour', check_timestamp) as incident_hour,
            check_name,
            COUNT(*) as incident_count,
            STRING_AGG(DISTINCT status, ', ') as statuses,
            AVG(response_time_ms) as avg_response_time
          FROM system_health_checks
          WHERE status != 'healthy'
            AND check_timestamp >= CURRENT_TIMESTAMP - INTERVAL '${timeInterval}' ${serviceFilter}
          GROUP BY DATE_TRUNC('hour', check_timestamp), check_name
          ORDER BY incident_hour DESC
        `, params),

        // Service availability over time
        query(`
          SELECT 
            DATE_TRUNC('hour', check_timestamp) as time_bucket,
            check_name,
            COUNT(*) as total_checks,
            COUNT(CASE WHEN status = 'healthy' THEN 1 END) as successful_checks,
            (COUNT(CASE WHEN status = 'healthy' THEN 1 END)::float / COUNT(*) * 100) as availability_percentage
          FROM system_health_checks
          WHERE check_timestamp >= CURRENT_TIMESTAMP - INTERVAL '${timeInterval}' ${serviceFilter}
          GROUP BY DATE_TRUNC('hour', check_timestamp), check_name
          ORDER BY time_bucket DESC, check_name
        `, params)
      ]);

      res.json({
        success: true,
        data: {
          period,
          service,
          uptime: uptimeData.rows,
          incidents: incidentHistory.rows,
          availability: serviceAvailability.rows,
          summary: {
            overallUptime: uptimeData.rows.length > 0 
              ? (uptimeData.rows.reduce((sum, row) => sum + parseFloat(row.uptime_percentage), 0) / uptimeData.rows.length).toFixed(2)
              : 0,
            totalServices: uptimeData.rows.length,
            totalIncidents: incidentHistory.rows.reduce((sum, row) => sum + parseInt(row.incident_count), 0)
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // =============================================================================
  // LOG MANAGEMENT
  // =============================================================================

  // Get system logs
  static async getSystemLogs(req, res, next) {
    try {
      const { 
        level, 
        component, 
        startTime, 
        endTime,
        search,
        limit = 100, 
        offset = 0 
      } = req.query;

      let whereClause = 'WHERE 1=1';
      const params = [];

      if (level) {
        whereClause += ` AND log_level = $${params.length + 1}`;
        params.push(level);
      }

      if (component) {
        whereClause += ` AND component = $${params.length + 1}`;
        params.push(component);
      }

      if (startTime) {
        whereClause += ` AND logged_at >= $${params.length + 1}`;
        params.push(startTime);
      }

      if (endTime) {
        whereClause += ` AND logged_at <= $${params.length + 1}`;
        params.push(endTime);
      }

      if (search) {
        whereClause += ` AND (message ILIKE $${params.length + 1} OR metadata::text ILIKE $${params.length + 1})`;
        params.push(`%${search}%`);
      }

      const result = await query(`
        SELECT 
          id, log_level, component, message, metadata, logged_at,
          user_id, school_id, ip_address, user_agent
        FROM system_logs
        ${whereClause}
        ORDER BY logged_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `, [...params, limit, offset]);

      const logs = result.rows.map(log => ({
        ...log,
        metadata: log.metadata ? JSON.parse(log.metadata) : null
      }));

      res.json({
        success: true,
        data: logs,
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

  // =============================================================================
  // HELPER METHODS
  // =============================================================================

  // Calculate overall system health
  static async calculateOverallHealth() {
    const recentChecks = await query(`
      SELECT DISTINCT ON (check_name) check_name, status
      FROM system_health_checks
      WHERE check_timestamp >= CURRENT_TIMESTAMP - INTERVAL '5 minutes'
      ORDER BY check_name, check_timestamp DESC
    `);

    const healthyServices = recentChecks.rows.filter(check => check.status === 'healthy').length;
    const totalServices = recentChecks.rows.length;

    if (totalServices === 0) return 'unknown';
    if (healthyServices === totalServices) return 'healthy';
    if (healthyServices / totalServices >= 0.8) return 'degraded';
    return 'critical';
  }

  // Individual health check methods
  static async checkDatabaseHealth() {
    try {
      const start = Date.now();
      const result = await query('SELECT 1 as test');
      const responseTime = Date.now() - start;

      return {
        component: 'database',
        status: responseTime < 1000 ? 'healthy' : 'degraded',
        responseTime,
        message: `Database responding in ${responseTime}ms`,
        details: {
          connectionTest: result.rows.length > 0 ? 'passed' : 'failed'
        }
      };
    } catch (error) {
      return {
        component: 'database',
        status: 'critical',
        responseTime: null,
        message: 'Database connection failed',
        error: error.message
      };
    }
  }

  static async checkAPIHealth() {
    // Simulate API health check
    return {
      component: 'api',
      status: 'healthy',
      responseTime: 45,
      message: 'API endpoints responding normally',
      details: {
        endpoints: ['auth', 'schools', 'students', 'financial'].map(endpoint => ({
          name: endpoint,
          status: 'healthy',
          responseTime: Math.floor(Math.random() * 100) + 20
        }))
      }
    };
  }

  static async checkExternalServicesHealth() {
    // Simulate external service checks
    return {
      component: 'external_services',
      status: 'healthy',
      responseTime: 120,
      message: 'External services operational',
      details: {
        sms_gateway: { status: 'healthy', responseTime: 98 },
        email_service: { status: 'healthy', responseTime: 142 },
        payment_gateway: { status: 'healthy', responseTime: 156 }
      }
    };
  }

  static async checkResourceHealth() {
    // Simulate resource health check
    return {
      component: 'resources',
      status: 'healthy',
      responseTime: 15,
      message: 'System resources within normal limits',
      details: {
        cpu_usage: 45.2,
        memory_usage: 68.7,
        disk_usage: 72.1,
        load_average: 1.2
      }
    };
  }

  static async checkDetailedMetrics() {
    const metrics = await query(`
      SELECT 
        COUNT(*) as total_requests_last_hour,
        AVG(response_time_ms) as avg_response_time,
        COUNT(CASE WHEN status_code >= 400 THEN 1 END) as error_count
      FROM platform_usage_logs
      WHERE logged_at >= CURRENT_TIMESTAMP - INTERVAL '1 hour'
    `);

    return {
      component: 'detailed_metrics',
      status: 'healthy',
      responseTime: 25,
      message: 'Detailed performance metrics collected',
      details: metrics.rows[0]
    };
  }

  // Record health check results
  static async recordHealthCheckResults(healthChecks, userId) {
    const healthCheckId = `hc_${Date.now()}`;
    
    for (const check of healthChecks) {
      await query(`
        INSERT INTO system_health_checks (
          check_name, status, response_time_ms, error_message, 
          check_details, performed_by
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        check.component, check.status, check.responseTime || 0,
        check.error || check.message, JSON.stringify(check.details || {}), userId
      ]);
    }

    return healthCheckId;
  }

  // Trigger alert notifications
  static async triggerAlertNotifications(alert) {
    // In production, this would trigger actual notifications
    // Email, SMS, Slack, PagerDuty, etc.
    
    const notification = {
      type: 'alert',
      severity: alert.severity,
      title: alert.title,
      description: alert.description,
      timestamp: alert.created_at
    };

    // Log the notification (in production, send actual notifications)
    await query(`
      INSERT INTO system_logs (
        log_level, component, message, metadata
      ) VALUES ($1, $2, $3, $4)
    `, [
      'warning', 'alerting', 
      `Alert triggered: ${alert.title}`,
      JSON.stringify(notification)
    ]);
  }
}

module.exports = MonitoringController;