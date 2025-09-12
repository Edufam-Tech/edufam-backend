const { query } = require('../config/database');

class AdminAuditController {
  static async listSystemLogs(req, res, next) {
    try {
      const {
        level = '',
        component = '',
        search = '',
        startTime,
        endTime,
        limit = 50,
        offset = 0,
      } = req.query || {};

      // Time range defaults
      const end = endTime ? new Date(endTime) : new Date();
      const start = startTime ? new Date(startTime) : new Date(end.getTime() - 24 * 60 * 60 * 1000);

      const params = [start.toISOString(), end.toISOString()];
      const filters = ['al.created_at BETWEEN $1 AND $2'];

      // Derived level from action text
      if (level) {
        const idx = params.push(level.toLowerCase());
        filters.push(`(
          CASE 
            WHEN al.action ILIKE '%error%' OR al.action ILIKE '%fail%' THEN 'error'
            WHEN al.action ILIKE '%warn%' THEN 'warning'
            WHEN al.action ILIKE '%critical%' THEN 'critical'
            ELSE 'info'
          END
        ) = $${idx}`);
      }

      if (component) {
        const idx = params.push(`%${component}%`);
        filters.push('(al.table_name ILIKE $' + idx + ' OR al.action ILIKE $' + idx + ')');
      }

      if (search) {
        const idx = params.push(`%${search}%`);
        filters.push('(al.action ILIKE $' + idx + ' OR al.user_agent ILIKE $' + idx + ' OR al.ip_address::text ILIKE $' + idx + ')');
      }

      const where = filters.length ? 'WHERE ' + filters.join(' AND ') : '';

      const countSql = `SELECT COUNT(*)::int AS total FROM audit_logs al ${where}`;
      const dataSql = `
        SELECT 
          al.created_at AS logged_at,
          CASE 
            WHEN al.action ILIKE '%error%' OR al.action ILIKE '%fail%' THEN 'error'
            WHEN al.action ILIKE '%warn%' THEN 'warning'
            WHEN al.action ILIKE '%critical%' THEN 'critical'
            ELSE 'info'
          END AS log_level,
          COALESCE(al.table_name, 'system') AS component,
          al.action AS message,
          al.user_id,
          u.school_id
        FROM audit_logs al
        LEFT JOIN users u ON u.id = al.user_id
        ${where}
        ORDER BY al.created_at DESC
        LIMIT $${params.push(Number(limit))} OFFSET $${params.push(Number(offset))}
      `;

      const total = await query(countSql, params.slice(0, params.length - 2));
      const data = await query(dataSql, params);

      res.json({ success: true, data: data.rows, pagination: { total: total.rows[0]?.total || 0, limit: Number(limit), offset: Number(offset) } });
    } catch (error) {
      next(error);
    }
  }

  static async analyzeSystemLogs(req, res, next) {
    try {
      const { period = '24h' } = req.query;
      const now = new Date();
      const hours = period === '1h' ? 1 : period === '7d' ? 24 * 7 : 24;
      const start = new Date(now.getTime() - hours * 60 * 60 * 1000);

      const { rows } = await query(`
        SELECT 
          CASE 
            WHEN action ILIKE '%error%' OR action ILIKE '%fail%' THEN 'error'
            WHEN action ILIKE '%warn%' THEN 'warning'
            WHEN action ILIKE '%critical%' THEN 'critical'
            ELSE 'info'
          END AS log_level,
          COUNT(*)::int AS log_count
        FROM audit_logs
        WHERE created_at BETWEEN $1 AND $2
        GROUP BY 1
        ORDER BY 2 DESC
      `, [start.toISOString(), now.toISOString()]);

      res.json({ success: true, data: { distribution: rows } });
    } catch (error) {
      next(error);
    }
  }

  static async listAdminActivityLogs(req, res, next) {
    try {
      const { startDate, endDate, search = '', limit = 50, offset = 0 } = req.query || {};
      const end = endDate ? new Date(endDate) : new Date();
      const start = startDate ? new Date(startDate) : new Date(end.getTime() - 24 * 60 * 60 * 1000);

      const params = [start.toISOString(), end.toISOString()];
      const filters = ['al.created_at BETWEEN $1 AND $2'];

      if (search) {
        const idx = params.push(`%${search}%`);
        filters.push('(u.email ILIKE $' + idx + ' OR al.action ILIKE $' + idx + ')');
      }

      const where = 'WHERE ' + filters.join(' AND ') + ' AND u.user_type = \"admin_user\"';

      const countSql = `
        SELECT COUNT(*)::int AS total
        FROM audit_logs al
        LEFT JOIN users u ON u.id = al.user_id
        ${where}
      `;
      const dataSql = `
        SELECT 
          al.created_at,
          u.email AS admin_email,
          SPLIT_PART(al.action, ':', 1) AS activity_type,
          COALESCE(al.table_name, 'system') AS target_type,
          al.record_id AS target_id,
          al.action AS action_description,
          al.ip_address
        FROM audit_logs al
        LEFT JOIN users u ON u.id = al.user_id
        ${where}
        ORDER BY al.created_at DESC
        LIMIT $${params.push(Number(limit))} OFFSET $${params.push(Number(offset))}
      `;

      const total = await query(countSql, params.slice(0, params.length - 2));
      const data = await query(dataSql, params);
      res.json({ success: true, data: data.rows, pagination: { total: total.rows[0]?.total || 0, limit: Number(limit), offset: Number(offset) } });
    } catch (error) {
      next(error);
    }
  }

  static async listIntegrationLogs(req, res, next) {
    try {
      const { startDate, endDate, status = '', limit = 50, offset = 0 } = req.query || {};
      const end = endDate ? new Date(endDate) : new Date();
      const start = startDate ? new Date(startDate) : new Date(end.getTime() - 24 * 60 * 60 * 1000);

      const params = [start.toISOString(), end.toISOString()];
      const filters = ['al.created_at BETWEEN $1 AND $2'];

      // Consider audit logs with integration/webhook keywords as integration logs
      filters.push("(al.table_name ILIKE '%integration%' OR al.action ILIKE '%integration%' OR al.action ILIKE '%webhook%')");

      if (status) {
        const idx = params.push(status.toLowerCase());
        filters.push(`(
          CASE WHEN al.action ILIKE '%error%' OR al.action ILIKE '%fail%' THEN 'error' ELSE 'success' END
        ) = $${idx}`);
      }

      const where = 'WHERE ' + filters.join(' AND ');

      const countSql = `SELECT COUNT(*)::int AS total FROM audit_logs al ${where}`;
      const dataSql = `
        SELECT 
          al.created_at AS logged_at,
          COALESCE(al.table_name, 'integration') AS integration_name,
          NULL::text AS provider_name,
          CASE WHEN al.action ILIKE '%error%' OR al.action ILIKE '%fail%' THEN 'error' ELSE 'success' END AS status,
          SPLIT_PART(al.action, ':', 1) AS operation_type,
          COALESCE((al.new_values ->> 'endpoint'), '') AS endpoint,
          NULL::int AS response_time_ms
        FROM audit_logs al
        ${where}
        ORDER BY al.created_at DESC
        LIMIT $${params.push(Number(limit))} OFFSET $${params.push(Number(offset))}
      `;

      const total = await query(countSql, params.slice(0, params.length - 2));
      const data = await query(dataSql, params);
      res.json({ success: true, data: data.rows, pagination: { total: total.rows[0]?.total || 0, limit: Number(limit), offset: Number(offset) } });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = AdminAuditController;


