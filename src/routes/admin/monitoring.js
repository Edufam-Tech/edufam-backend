const express = require('express');
const router = express.Router();
const { authenticate, requireRole, requireUserType } = require('../../middleware/auth');
const MonitoringController = require('../../controllers/admin/monitoringController');

// Apply admin authentication to all routes
router.use(authenticate);
router.use(requireUserType('platform_admin'));

// =============================================================================
// SYSTEM HEALTH MONITORING ROUTES
// =============================================================================

/**
 * @route   GET /api/admin/monitoring/health
 * @desc    Get system health overview
 * @access  Private (Platform Admin)
 */
router.get('/health',
  requireRole(['super_admin', 'support_admin', 'regional_admin']),
  MonitoringController.getSystemHealthOverview
);

/**
 * @route   GET /api/admin/monitoring/infrastructure
 * @desc    Infrastructure dashboard (servers, DB, APIs, storage, M-Pesa KPIs)
 * @access  Private (Platform Admin)
 */
router.get('/infrastructure',
  requireRole(['super_admin', 'support_admin', 'regional_admin']),
  MonitoringController.getInfrastructureDashboard
);

/**
 * @route   POST /api/admin/monitoring/health/check
 * @desc    Perform comprehensive health check
 * @access  Private (Super Admin, Support Admin)
 */
router.post('/health/check',
  requireRole(['super_admin', 'support_admin']),
  MonitoringController.performHealthCheck
);

/**
 * @route   GET /api/admin/monitoring/health/detailed
 * @desc    Get detailed health check with comprehensive metrics
 * @access  Private (Super Admin, Support Admin)
 */
router.get('/health/detailed',
  requireRole(['super_admin', 'support_admin']),
  async (req, res, next) => {
    try {
      // Set includeDetailed flag for comprehensive check
      req.query.includeDetailed = 'true';
      return MonitoringController.performHealthCheck(req, res, next);
    } catch (error) {
      next(error);
    }
  }
);

// =============================================================================
// PERFORMANCE MONITORING ROUTES
// =============================================================================

/**
 * @route   GET /api/admin/monitoring/performance
 * @desc    Get performance metrics
 * @access  Private (Platform Admin)
 */
router.get('/performance',
  requireRole(['super_admin', 'support_admin', 'regional_admin']),
  MonitoringController.getPerformanceMetrics
);

/**
 * @route   GET /api/admin/monitoring/performance/slow-queries
 * @desc    Get slow query analysis
 * @access  Private (Super Admin, Support Admin)
 */
router.get('/performance/slow-queries',
  requireRole(['super_admin', 'support_admin']),
  MonitoringController.getSlowQueryAnalysis
);

/**
 * @route   GET /api/admin/monitoring/performance/real-time
 * @desc    Get real-time performance metrics
 * @access  Private (Platform Admin)
 */
router.get('/performance/real-time',
  requireRole(['super_admin', 'support_admin']),
  async (req, res, next) => {
    try {
      const { query } = require('../../config/database');

      const [currentMetrics, activeConnections, recentErrors] = await Promise.all([
        // Current performance metrics (last 5 minutes)
        query(`
          SELECT 
            COUNT(*) as requests_last_5min,
            AVG(response_time_ms) as avg_response_time,
            MAX(response_time_ms) as max_response_time,
            COUNT(CASE WHEN status_code >= 400 THEN 1 END) as error_count,
            COUNT(DISTINCT user_id) as active_users,
            COUNT(DISTINCT school_id) as active_schools
          FROM platform_usage_logs
          WHERE logged_at >= CURRENT_TIMESTAMP - INTERVAL '5 minutes'
        `),

        // Database connections
        query(`
          SELECT 
            COUNT(*) as total_connections,
            COUNT(CASE WHEN state = 'active' THEN 1 END) as active_connections,
            COUNT(CASE WHEN state = 'idle' THEN 1 END) as idle_connections
          FROM pg_stat_activity
          WHERE datname = current_database()
        `),

        // Recent errors
        query(`
          SELECT 
            log_level,
            COUNT(*) as error_count
          FROM system_logs
          WHERE log_level IN ('error', 'critical') 
            AND logged_at >= CURRENT_TIMESTAMP - INTERVAL '5 minutes'
          GROUP BY log_level
        `)
      ]);

      res.json({
        success: true,
        data: {
          timestamp: new Date().toISOString(),
          performance: currentMetrics.rows[0],
          database: activeConnections.rows[0],
          errors: recentErrors.rows,
          status: 'real_time'
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/admin/monitoring/schools/:schoolId
 * @desc    Per-school monitoring metrics (usage, storage, M-Pesa, errors)
 * @access  Private (Platform Admin)
 */
router.get('/schools/:schoolId',
  requireRole(['super_admin', 'support_admin', 'regional_admin']),
  MonitoringController.getSchoolMonitoring
);

/**
 * @route   GET /api/admin/monitoring/mpesa/health
 * @desc    M-Pesa health and performance overview
 * @access  Private (Platform Admin)
 */
router.get('/mpesa/health',
  requireRole(['super_admin', 'support_admin', 'regional_admin']),
  MonitoringController.getMpesaHealth
);

// =============================================================================
// ALERTING SYSTEM ROUTES
// =============================================================================

/**
 * @route   GET /api/admin/monitoring/alerts
 * @desc    Get system alerts
 * @access  Private (Platform Admin)
 */
router.get('/alerts',
  requireRole(['super_admin', 'support_admin', 'regional_admin']),
  MonitoringController.getAlerts
);

/**
 * @route   POST /api/admin/monitoring/alerts
 * @desc    Create new alert
 * @access  Private (Super Admin, Support Admin)
 */
router.post('/alerts',
  requireRole(['super_admin', 'support_admin']),
  MonitoringController.createAlert
);

/**
 * @route   POST /api/admin/monitoring/alerts/:id/resolve
 * @desc    Resolve alert
 * @access  Private (Super Admin, Support Admin)
 */
router.post('/alerts/:id/resolve',
  requireRole(['super_admin', 'support_admin']),
  MonitoringController.resolveAlert
);

/**
 * @route   GET /api/admin/monitoring/alerts/summary
 * @desc    Get alerts summary dashboard
 * @access  Private (Platform Admin)
 */
router.get('/alerts/summary',
  requireRole(['super_admin', 'support_admin', 'regional_admin']),
  async (req, res, next) => {
    try {
      const { query } = require('../../config/database');

      const [alertsSummary, recentAlerts, alertTrends] = await Promise.all([
        // Alerts summary by severity
        query(`
          SELECT 
            severity,
            status,
            COUNT(*) as alert_count
          FROM system_alerts
          WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
          GROUP BY severity, status
          ORDER BY 
            CASE severity 
              WHEN 'critical' THEN 1 
              WHEN 'high' THEN 2 
              WHEN 'medium' THEN 3 
              WHEN 'low' THEN 4 
            END, status
        `),

        // Recent alerts (last 24 hours)
        query(`
          SELECT 
            id, alert_type, severity, title, status, created_at,
            CASE 
              WHEN resolved_at IS NOT NULL THEN 
                EXTRACT(EPOCH FROM (resolved_at - created_at))/60
              ELSE 
                EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - created_at))/60
            END as duration_minutes
          FROM system_alerts
          WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
          ORDER BY created_at DESC
          LIMIT 10
        `),

        // Alert trends (last 7 days)
        query(`
          SELECT 
            DATE(created_at) as alert_date,
            severity,
            COUNT(*) as alert_count
          FROM system_alerts
          WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
          GROUP BY DATE(created_at), severity
          ORDER BY alert_date DESC, severity
        `)
      ]);

      // Calculate summary statistics
      const totalActiveAlerts = alertsSummary.rows
        .filter(row => row.status === 'active')
        .reduce((sum, row) => sum + parseInt(row.alert_count), 0);

      const totalResolvedAlerts = alertsSummary.rows
        .filter(row => row.status === 'resolved')
        .reduce((sum, row) => sum + parseInt(row.alert_count), 0);

      const criticalActiveAlerts = alertsSummary.rows
        .filter(row => row.severity === 'critical' && row.status === 'active')
        .reduce((sum, row) => sum + parseInt(row.alert_count), 0);

      res.json({
        success: true,
        data: {
          summary: {
            totalActive: totalActiveAlerts,
            totalResolved: totalResolvedAlerts,
            criticalActive: criticalActiveAlerts,
            averageResolutionTime: recentAlerts.rows
              .filter(alert => alert.status === 'resolved')
              .reduce((sum, alert, _, arr) => sum + alert.duration_minutes / arr.length, 0)
          },
          breakdown: alertsSummary.rows,
          recent: recentAlerts.rows,
          trends: alertTrends.rows
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// =============================================================================
// ALERT RULES MANAGEMENT ROUTES
// =============================================================================

/**
 * @route   GET /api/admin/monitoring/alert-rules
 * @desc    Get alert rules
 * @access  Private (Super Admin, Support Admin)
 */
router.get('/alert-rules',
  requireRole(['super_admin', 'support_admin']),
  MonitoringController.getAlertRules
);

/**
 * @route   POST /api/admin/monitoring/alert-rules
 * @desc    Create alert rule
 * @access  Private (Super Admin)
 */
router.post('/alert-rules',
  requireRole(['super_admin']),
  MonitoringController.createAlertRule
);

/**
 * @route   PUT /api/admin/monitoring/alert-rules/:id
 * @desc    Update alert rule
 * @access  Private (Super Admin)
 */
router.put('/alert-rules/:id',
  requireRole(['super_admin']),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const { query } = require('../../config/database');

      const allowedFields = [
        'rule_name', 'description', 'category', 'conditions', 'actions',
        'severity', 'cooldown_minutes', 'metadata', 'is_active'
      ];

      const setClause = [];
      const values = [];
      let paramIndex = 1;

      Object.keys(updates).forEach(key => {
        if (allowedFields.includes(key)) {
          if (['conditions', 'actions', 'metadata'].includes(key)) {
            setClause.push(`${key} = $${paramIndex}`);
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
        UPDATE alert_rules 
        SET ${setClause.join(', ')}
        WHERE id = $${paramIndex + 2}
        RETURNING *
      `, values);

      if (result.rows.length === 0) {
        throw new NotFoundError('Alert rule not found');
      }

      res.json({
        success: true,
        message: 'Alert rule updated successfully',
        data: {
          ...result.rows[0],
          conditions: JSON.parse(result.rows[0].conditions || '{}'),
          actions: JSON.parse(result.rows[0].actions || '{}'),
          metadata: JSON.parse(result.rows[0].metadata || '{}')
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   DELETE /api/admin/monitoring/alert-rules/:id
 * @desc    Delete alert rule
 * @access  Private (Super Admin)
 */
router.delete('/alert-rules/:id',
  requireRole(['super_admin']),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { query } = require('../../config/database');

      const result = await query(`
        DELETE FROM alert_rules 
        WHERE id = $1
        RETURNING rule_name
      `, [id]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Alert rule not found');
      }

      res.json({
        success: true,
        message: 'Alert rule deleted successfully',
        data: { rule_name: result.rows[0].rule_name }
      });
    } catch (error) {
      next(error);
    }
  }
);

// =============================================================================
// UPTIME MONITORING ROUTES
// =============================================================================

/**
 * @route   GET /api/admin/monitoring/uptime
 * @desc    Get uptime statistics
 * @access  Private (Platform Admin)
 */
router.get('/uptime',
  requireRole(['super_admin', 'support_admin', 'regional_admin']),
  MonitoringController.getUptimeStatistics
);

/**
 * @route   GET /api/admin/monitoring/uptime/status-page
 * @desc    Get public status page data
 * @access  Private (Platform Admin)
 */
router.get('/uptime/status-page',
  requireRole(['super_admin', 'support_admin']),
  async (req, res, next) => {
    try {
      const { query } = require('../../config/database');

      const [servicesStatus, recentIncidents, plannedMaintenance] = await Promise.all([
        // Current service status
        query(`
          SELECT DISTINCT ON (check_name) 
            check_name,
            status,
            response_time_ms,
            check_timestamp
          FROM system_health_checks
          WHERE check_timestamp >= CURRENT_TIMESTAMP - INTERVAL '5 minutes'
          ORDER BY check_name, check_timestamp DESC
        `),

        // Recent incidents (last 7 days)
        query(`
          SELECT 
            id, title, description, severity, status,
            created_at, resolved_at
          FROM system_alerts
          WHERE severity IN ('critical', 'high')
            AND created_at >= CURRENT_DATE - INTERVAL '7 days'
          ORDER BY created_at DESC
          LIMIT 5
        `),

        // Planned maintenance (align with maintenance_mode schema)
        query(`
          SELECT 
            id, message, scheduled_start, scheduled_end
          FROM maintenance_mode
          WHERE scheduled_start >= CURRENT_TIMESTAMP
            OR (is_active = true AND scheduled_end > CURRENT_TIMESTAMP)
          ORDER BY scheduled_start
        `)
      ]);

      const overallStatus = servicesStatus.rows.every(service => service.status === 'healthy') 
        ? 'operational' 
        : servicesStatus.rows.some(service => service.status === 'critical')
        ? 'major_outage'
        : 'partial_outage';

      res.json({
        success: true,
        data: {
          overallStatus,
          lastUpdated: new Date().toISOString(),
          services: servicesStatus.rows,
          recentIncidents: recentIncidents.rows,
          plannedMaintenance: plannedMaintenance.rows
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// =============================================================================
// INCIDENT MANAGEMENT ROUTES
// =============================================================================

/**
 * @route   GET /api/admin/monitoring/incidents
 * @desc    List incidents with filters
 * @access  Private (Platform Admin)
 */
router.get('/incidents',
  requireRole(['super_admin', 'support_admin', 'regional_admin']),
  async (req, res, next) => {
    try {
      const { query } = require('../../config/database');
      const { status, severity, schoolId, limit = 50, offset = 0 } = req.query;

      let where = 'WHERE 1=1';
      const params = [];
      if (status) { where += ` AND status = $${params.length + 1}`; params.push(status); }
      if (severity) { where += ` AND severity = $${params.length + 1}`; params.push(severity); }
      if (schoolId) {
        where += ` AND id IN (SELECT incident_id FROM incident_school_impacts WHERE school_id = $${params.length + 1})`;
        params.push(schoolId);
      }

      const result = await query(`
        SELECT * FROM system_incidents
        ${where}
        ORDER BY detected_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `, [...params, limit, offset]);

      res.json({ success: true, data: result.rows });
    } catch (error) { next(error); }
  }
);

/**
 * @route   POST /api/admin/monitoring/incidents
 * @desc    Create a new incident
 * @access  Private (Super Admin, Support Admin)
 */
router.post('/incidents',
  requireRole(['super_admin', 'support_admin']),
  async (req, res, next) => {
    try {
      const { query } = require('../../config/database');
      const { title, description, severity = 'medium', impacts = [] } = req.body;
      if (!title) throw new (require('../../middleware/errorHandler').ValidationError)('Title is required');

      const number = `INC-${Date.now()}`;
      const inc = await query(`
        INSERT INTO system_incidents (incident_number, title, description, severity, created_by, created_by_name)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `, [number, title, description || null, severity, req.user.userId, `${req.user.firstName} ${req.user.lastName}`]);

      const incident = inc.rows[0];
      for (const imp of (impacts || [])) {
        await query(`
          INSERT INTO incident_school_impacts (incident_id, school_id, impact_level, downtime_minutes, estimated_financial_impact, notes)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [incident.id, imp.schoolId, imp.impactLevel || 'minor', imp.downtimeMinutes || 0, imp.financialImpact || 0, imp.notes || null]);
      }

      await query(`
        INSERT INTO incident_events (incident_id, event_type, details, created_by, created_by_name)
        VALUES ($1, 'created', $2, $3, $4)
      `, [incident.id, JSON.stringify({ severity }), req.user.userId, `${req.user.firstName} ${req.user.lastName}`]);

      res.status(201).json({ success: true, data: incident });
    } catch (error) { next(error); }
  }
);

/**
 * @route   POST /api/admin/monitoring/incidents/:id/update
 * @desc    Add timeline event / change status
 * @access  Private (Super Admin, Support Admin)
 */
router.post('/incidents/:id/update',
  requireRole(['super_admin', 'support_admin']),
  async (req, res, next) => {
    try {
      const { query } = require('../../config/database');
      const { id } = req.params;
      const { status, eventType = 'update', details = {} } = req.body;

      if (status) {
        await query(`
          UPDATE system_incidents SET status = $1 WHERE id = $2
        `, [status, id]);
      }

      const ev = await query(`
        INSERT INTO incident_events (incident_id, event_type, details, created_by, created_by_name)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `, [id, eventType, JSON.stringify(details), req.user.userId, `${req.user.firstName} ${req.user.lastName}`]);

      res.json({ success: true, data: ev.rows[0] });
    } catch (error) { next(error); }
  }
);

/**
 * @route   POST /api/admin/monitoring/incidents/:id/resolve
 * @desc    Resolve incident and optionally create post-mortem
 * @access  Private (Super Admin)
 */
router.post('/incidents/:id/resolve',
  requireRole(['super_admin']),
  async (req, res, next) => {
    try {
      const { query } = require('../../config/database');
      const { id } = req.params;
      const { rootCause, postMortem } = req.body;

      const upd = await query(`
        UPDATE system_incidents
        SET status = 'resolved', root_cause = $1, resolved_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *
      `, [rootCause || null, id]);

      if (postMortem) {
        await query(`
          INSERT INTO incident_post_mortems (
            incident_id, summary, timeline, contributing_factors, corrective_actions, lessons_learned, created_by, created_by_name
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
          id,
          postMortem.summary || null,
          JSON.stringify(postMortem.timeline || []),
          JSON.stringify(postMortem.contributingFactors || []),
          JSON.stringify(postMortem.correctiveActions || []),
          JSON.stringify(postMortem.lessonsLearned || []),
          req.user.userId,
          `${req.user.firstName} ${req.user.lastName}`
        ]);
      }

      await query(`
        INSERT INTO incident_events (incident_id, event_type, details, created_by, created_by_name)
        VALUES ($1, 'resolved', $2, $3, $4)
      `, [id, JSON.stringify({ rootCause: rootCause || null }), req.user.userId, `${req.user.firstName} ${req.user.lastName}`]);

      res.json({ success: true, data: upd.rows[0] });
    } catch (error) { next(error); }
  }
);

// =============================================================================
// LOG MANAGEMENT ROUTES
// =============================================================================

/**
 * @route   GET /api/admin/monitoring/logs
 * @desc    Get system logs
 * @access  Private (Super Admin, Support Admin)
 */
router.get('/logs',
  requireRole(['super_admin', 'support_admin']),
  MonitoringController.getSystemLogs
);

/**
 * @route   GET /api/admin/monitoring/logs/analysis
 * @desc    Get log analysis and patterns
 * @access  Private (Super Admin, Support Admin)
 */
router.get('/logs/analysis',
  requireRole(['super_admin', 'support_admin']),
  async (req, res, next) => {
    try {
      const { period = '24h' } = req.query;
      const { query } = require('../../config/database');

      const timeInterval = period === '1h' ? '1 hour' : 
                          period === '24h' ? '24 hours' : 
                          period === '7d' ? '7 days' : '24 hours';

      const [logLevelDistribution, errorPatterns, componentActivity, topErrors] = await Promise.all([
        // Log level distribution
        query(`
          SELECT 
            log_level,
            COUNT(*) as log_count,
            COUNT(*) * 100.0 / SUM(COUNT(*)) OVER () as percentage
          FROM system_logs
          WHERE logged_at >= CURRENT_TIMESTAMP - INTERVAL '${timeInterval}'
          GROUP BY log_level
          ORDER BY log_count DESC
        `),

        // Error patterns
        query(`
          SELECT 
            DATE_TRUNC('hour', logged_at) as hour,
            log_level,
            COUNT(*) as error_count
          FROM system_logs
          WHERE log_level IN ('error', 'critical', 'warning')
            AND logged_at >= CURRENT_TIMESTAMP - INTERVAL '${timeInterval}'
          GROUP BY DATE_TRUNC('hour', logged_at), log_level
          ORDER BY hour DESC
        `),

        // Component activity
        query(`
          SELECT 
            component,
            COUNT(*) as log_count,
            COUNT(CASE WHEN log_level IN ('error', 'critical') THEN 1 END) as error_count
          FROM system_logs
          WHERE logged_at >= CURRENT_TIMESTAMP - INTERVAL '${timeInterval}'
            AND component IS NOT NULL
          GROUP BY component
          ORDER BY log_count DESC
          LIMIT 10
        `),

        // Top error messages
        query(`
          SELECT 
            message,
            COUNT(*) as occurrence_count,
            MAX(logged_at) as last_occurrence
          FROM system_logs
          WHERE log_level IN ('error', 'critical')
            AND logged_at >= CURRENT_TIMESTAMP - INTERVAL '${timeInterval}'
          GROUP BY message
          ORDER BY occurrence_count DESC
          LIMIT 10
        `)
      ]);

      res.json({
        success: true,
        data: {
          period,
          distribution: logLevelDistribution.rows,
          errorPatterns: errorPatterns.rows,
          componentActivity: componentActivity.rows,
          topErrors: topErrors.rows
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// =============================================================================
// MONITORING DASHBOARD ROUTES
// =============================================================================

/**
 * @route   GET /api/admin/monitoring/dashboard
 * @desc    Get comprehensive monitoring dashboard data
 * @access  Private (Platform Admin)
 */
router.get('/dashboard',
  requireRole(['super_admin', 'support_admin', 'regional_admin']),
  async (req, res, next) => {
    try {
      const { query } = require('../../config/database');

      const [
        systemOverview,
        performanceSummary,
        alertsSummary,
        uptimeSummary,
        resourceUsage
      ] = await Promise.all([
        // System overview
        query(`
          SELECT 
            (SELECT COUNT(*) FROM schools WHERE is_active = true) as active_schools,
            (SELECT COUNT(*) FROM users WHERE is_active = true) as active_users,
            (SELECT COUNT(*) FROM platform_usage_logs WHERE logged_at >= CURRENT_TIMESTAMP - INTERVAL '1 hour') as requests_last_hour,
            (SELECT COUNT(*) FROM system_alerts WHERE status = 'active') as active_alerts
        `),

        // Performance summary
        query(`
          SELECT 
            AVG(response_time_ms) as avg_response_time,
            MAX(response_time_ms) as max_response_time,
            COUNT(CASE WHEN status_code >= 400 THEN 1 END) as error_count,
            COUNT(*) as total_requests
          FROM platform_usage_logs
          WHERE logged_at >= CURRENT_TIMESTAMP - INTERVAL '1 hour'
        `),

        // Alerts summary
        query(`
          SELECT 
            severity,
            COUNT(*) as count
          FROM system_alerts
          WHERE status = 'active'
          GROUP BY severity
        `),

        // Uptime summary
        query(`
          SELECT 
            check_name,
            AVG(CASE WHEN status = 'healthy' THEN 100.0 ELSE 0.0 END) as uptime_percentage
          FROM system_health_checks
          WHERE check_timestamp >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
          GROUP BY check_name
        `),

        // Resource usage (simulated)
        query(`
          SELECT 
            'cpu' as resource, 45.2 as usage_percentage, 'CPU Usage' as label
          UNION ALL
          SELECT 
            'memory' as resource, 68.7 as usage_percentage, 'Memory Usage' as label
          UNION ALL
          SELECT 
            'disk' as resource, 72.1 as usage_percentage, 'Disk Usage' as label
        `)
      ]);

      res.json({
        success: true,
        data: {
          overview: systemOverview.rows[0],
          performance: performanceSummary.rows[0],
          alerts: alertsSummary.rows,
          uptime: uptimeSummary.rows,
          resources: resourceUsage.rows,
          lastUpdated: new Date().toISOString()
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;