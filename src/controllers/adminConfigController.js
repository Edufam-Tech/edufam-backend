const { query } = require('../config/database');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * Admin Config Controller
 * - Manage maintenance mode (get/enable/disable)
 * - Manage data backups (list/create) [scaffold]
 */
class AdminConfigController {
  // GET /api/admin/config/health
  static getHealth = asyncHandler(async (req, res) => {
    const { period = '24h' } = req.query;
    // Basic overall status derived from maintenance mode and recent errors
    const mm = await query(`SELECT is_active FROM maintenance_mode WHERE is_active = true LIMIT 1`);
    const recentErrors = await query(
      `SELECT COUNT(*)::int AS c
       FROM audit_logs
       WHERE created_at >= NOW() - INTERVAL '24 hours'
         AND (action ILIKE '%ERROR%' OR action ILIKE '%FAIL%')`
    );
    const dbConns = await query(`SELECT COUNT(*)::int AS cnt FROM pg_stat_activity WHERE datname = current_database()`);

    res.json({
      success: true,
      data: {
        overall: mm.rows[0]?.is_active ? 'maintenance' : (recentErrors.rows[0]?.c > 0 ? 'degraded' : 'healthy'),
        metrics: {
          // Approximate from audit lag as response time signal
          avg_response_time: Number(
            (await query(
              `SELECT COALESCE(AVG(EXTRACT(MILLISECOND FROM (NOW() - created_at))), 0)::int AS ms
               FROM audit_logs
               WHERE created_at >= NOW() - (CASE WHEN $1 = '7d' THEN INTERVAL '7 days' WHEN $1 = '30d' THEN INTERVAL '30 days' ELSE INTERVAL '24 hours' END)`,
              [period]
            )).rows[0]?.ms || 0
          ),
        },
        database: {
          connection_count: dbConns.rows[0]?.cnt || 0,
        },
      },
    });
  });

  // GET /api/admin/config/health/detailed
  static getDetailedHealth = asyncHandler(async (req, res) => {
    const { period = '24h' } = req.query;
    const intervalSql = `CASE WHEN $1 = '7d' THEN NOW() - INTERVAL '7 days' WHEN $1 = '30d' THEN NOW() - INTERVAL '30 days' ELSE NOW() - INTERVAL '24 hours' END`;

    const perf = await query(
      `SELECT DATE_TRUNC('hour', created_at) AS hour,
              COALESCE(AVG(EXTRACT(MILLISECOND FROM (NOW() - created_at))), 0)::int AS avg_response_time,
              COUNT(*) FILTER (WHERE action ILIKE '%ERROR%' OR action ILIKE '%FAIL%')::int AS error_count
       FROM audit_logs
       WHERE created_at >= ${intervalSql}
       GROUP BY 1
       ORDER BY 1 DESC
       LIMIT 24`,
      [period]
    );

    const errors = await query(
      `SELECT COALESCE(action, 'Unknown') AS error_type,
              COUNT(*)::int AS occurrence_count
       FROM audit_logs
       WHERE created_at >= ${intervalSql}
         AND (action ILIKE '%ERROR%' OR action ILIKE '%FAIL%')
       GROUP BY 1
       ORDER BY 2 DESC
       LIMIT 10`,
      [period]
    );

    res.json({
      success: true,
      data: {
        performanceMetrics: perf.rows,
        systemErrors: errors.rows,
      },
    });
  });
  // GET /api/admin/config/maintenance
  static getMaintenanceStatus = asyncHandler(async (req, res) => {
    const result = await query(`
      SELECT id, scope, is_active, message, scheduled_start, scheduled_end, affected_schools, created_at, updated_at
      FROM maintenance_mode
      WHERE is_active = true
      ORDER BY scheduled_start DESC NULLS LAST, created_at DESC
      LIMIT 1
    `);

    const record = result.rows[0] || null;

    // Read affected clients and allowed IPs from settings
    let affectedClients = ['web'];
    let allowedIps = [];
    try {
      const settings = await query(`SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ($1,$2)`, ['maintenance_affected_clients','maintenance_allowed_ips']);
      for (const row of settings.rows) {
        const raw = row.setting_value;
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (row.setting_key === 'maintenance_affected_clients' && Array.isArray(parsed)) {
          affectedClients = parsed;
        }
        if (row.setting_key === 'maintenance_allowed_ips' && Array.isArray(parsed)) {
          allowedIps = parsed;
        }
      }
    } catch (_) {}

    res.json({
      success: true,
      data: record ? {
        id: record.id,
        scope: record.scope,
        is_active: record.is_active,
        message: record.message,
        scheduled_start: record.scheduled_start,
        scheduled_end: record.scheduled_end,
        affected_schools: record.affected_schools,
        affected_clients: affectedClients,
        allowed_ips: allowedIps,
      } : { is_active: false, affected_clients: affectedClients, allowed_ips: allowedIps }
    });
  });

  // POST /api/admin/config/maintenance/enable
  static enableMaintenance = asyncHandler(async (req, res) => {
    const {
      message,
      scheduledStart,
      estimatedEndTime,
      allowedIps,
      affectedClients, // ['web','mobile']
      scope = 'school_app',
      affectedSchools = [],
    } = req.body || {};

    // Normalize arrays
    const normalizedAllowedIps = Array.isArray(allowedIps) ? allowedIps : [];
    const normalizedAffectedClients = Array.isArray(affectedClients) ? affectedClients : ['web'];

    // Insert a new active record; also store clients list in system_settings for middleware usage
    const insert = await query(`
      INSERT INTO maintenance_mode (scope, is_active, message, scheduled_start, scheduled_end)
      VALUES ($1, true, $2, $3, $4)
      RETURNING id, scope, is_active, message, scheduled_start, scheduled_end
    `, [scope, message || null, scheduledStart || null, estimatedEndTime || null]);

    // Persist affected clients and allowed IPs in system_settings keys
    await query(`
      INSERT INTO system_settings (setting_key, setting_value, data_type, description, is_public)
      VALUES ($1, $2, 'json', 'Which client types are affected by maintenance', false)
      ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = CURRENT_TIMESTAMP
    `, ['maintenance_affected_clients', JSON.stringify(normalizedAffectedClients)]);

    await query(`
      INSERT INTO system_settings (setting_key, setting_value, data_type, description, is_public)
      VALUES ($1, $2, 'json', 'Allowed IPs during maintenance', false)
      ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = CURRENT_TIMESTAMP
    `, ['maintenance_allowed_ips', JSON.stringify(normalizedAllowedIps)]);

    res.status(201).json({ success: true, data: insert.rows[0], message: 'Maintenance enabled' });
  });

  // POST /api/admin/config/maintenance/disable
  static disableMaintenance = asyncHandler(async (req, res) => {
    const update = await query(`
      UPDATE maintenance_mode
      SET is_active = false, updated_at = CURRENT_TIMESTAMP
      WHERE is_active = true
      RETURNING id
    `);

    res.json({ success: true, data: { disabled: update.rowCount }, message: 'Maintenance disabled' });
  });

  // GET /api/admin/migration/backups
  static listBackups = asyncHandler(async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const { rows } = await query(`
      SELECT id, created_at, status, file_size, download_url
      FROM data_backups
      ORDER BY created_at DESC
      LIMIT $1
    `, [limit]).catch(() => ({ rows: [] }));

    res.json({ success: true, data: rows });
  });

  // POST /api/admin/migration/backups
  static createBackup = asyncHandler(async (req, res) => {
    const { description = 'Manual backup from admin panel' } = req.body || {};

    const queued = await query(`
      INSERT INTO data_backups (status, description)
      VALUES ('queued', $1)
      RETURNING *
    `, [description]);

    // Start background dump
    const backupId = queued.rows[0].id;
    process.nextTick(async () => {
      const fs = require('fs');
      const path = require('path');
      const { spawn } = require('child_process');

      try {
        // Ensure backups directory exists
        const backupsDir = path.resolve(process.cwd(), 'backups');
        fs.mkdirSync(backupsDir, { recursive: true });

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `edufam-backup-${timestamp}.sql.gz`;
        const filePath = path.join(backupsDir, fileName);

        const pgDumpBin = process.env.PG_DUMP_PATH || 'pg_dump';
        const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || '';

        // Update status to running
        await query(`UPDATE data_backups SET status = 'running', updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [backupId]);

        // Spawn pg_dump and gzip
        const dump = spawn(pgDumpBin, ['--dbname', dbUrl, '--no-owner', '--no-privileges'], { shell: process.platform === 'win32' });
        const zlib = require('zlib');
        const gzip = zlib.createGzip();
        const writeStream = fs.createWriteStream(filePath);

        dump.stdout.pipe(gzip).pipe(writeStream);

        let stderr = '';
        dump.stderr.on('data', (d) => { stderr += d.toString(); });

        const onFail = async (errMsg) => {
          await query(`UPDATE data_backups SET status = 'failed', description = COALESCE(description,'') || ' | ' || $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [backupId, errMsg.substring(0, 500)]);
        };

        dump.on('error', async (err) => {
          await onFail(`pg_dump error: ${err.message}`);
        });

        writeStream.on('finish', async () => {
          try {
            const stats = fs.statSync(filePath);
            const size = stats.size;
            const downloadUrl = `/backups/${fileName}`;

            await query(`
              UPDATE data_backups
              SET status = 'completed', file_size = $2, download_url = $3, updated_at = CURRENT_TIMESTAMP
              WHERE id = $1
            `, [backupId, size, downloadUrl]);
          } catch (e) {
            await onFail(`file finalize error: ${e.message}`);
          }
        });

        dump.on('close', async (code) => {
          if (code !== 0) {
            await onFail(`pg_dump exited with code ${code}: ${stderr}`);
          }
        });
      } catch (e) {
        await query(`UPDATE data_backups SET status = 'failed', description = COALESCE(description,'') || ' | ' || $2 WHERE id = $1`, [backupId, e.message.substring(0, 500)]).catch(() => null);
      }
    });

    res.status(202).json({ success: true, data: queued.rows[0], message: 'Backup started' });
  });
}

module.exports = AdminConfigController;


