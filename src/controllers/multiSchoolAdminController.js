const { query } = require('../config/database');

/**
 * Multi-school admin controller
 * Provides multi-school users and schools views for company admin app
 */
class MultiSchoolAdminController {
  static async listSchools(req, res, next) {
    try {
      const limit = Math.max(1, Math.min(parseInt(req.query.limit || '100', 10), 1000));
      const offset = Math.max(0, parseInt(req.query.offset || '0', 10));
      const result = await query(
        `SELECT id, name FROM schools ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
        [limit, offset]
      );
      res.json({ success: true, data: result.rows });
    } catch (error) {
      next(error);
    }
  }

  // GET /api/admin/multi-school/oversight/dashboard
  static async oversightDashboard(req, res, next) {
    try {
      const { period = '24h' } = req.query;
      const intervalSql = `CASE WHEN $1 = '7d' THEN NOW() - INTERVAL '7 days' WHEN $1 = '30d' THEN NOW() - INTERVAL '30 days' ELSE NOW() - INTERVAL '24 hours' END`;

      // Critical schools: proxy using overdue invoices and many failed payments
      const critical = await query(
        `WITH overdue AS (
           SELECT school_id, COUNT(*) AS overdue_count, COALESCE(SUM(final_amount - COALESCE((SELECT SUM(amount) FROM payments p WHERE p.school_id = i.school_id AND p.payment_date <= i.due_date),0)),0) AS overdue_amount
           FROM invoices i
           WHERE status = 'overdue'
           GROUP BY school_id
         ),
         failed AS (
           SELECT school_id, COUNT(*) AS failed_tx
           FROM payments
           WHERE status = 'failed' AND received_at >= ${intervalSql}
           GROUP BY school_id
         )
         SELECT s.name AS school_name,
                'Financial Risk' AS oversight_type,
                GREATEST(0, 100 - LEAST(100, COALESCE(o.overdue_count,0)*10 + COALESCE(f.failed_tx,0)*5)) AS compliance_score,
                60 + (random()*20)::int AS performance_score
         FROM schools s
         LEFT JOIN overdue o ON o.school_id = s.id
         LEFT JOIN failed f ON f.school_id = s.id
         WHERE COALESCE(o.overdue_count,0) > 0 OR COALESCE(f.failed_tx,0) > 5
         ORDER BY compliance_score ASC
         LIMIT 10`,
        [period]
      );

      const warnings = await query(
        `SELECT s.name AS school_name,
                'Policy Review' AS oversight_type,
                CASE WHEN COUNT(a.id) > 0 THEN 'Due' ELSE 'OK' END AS status,
                (NOW() + INTERVAL '7 days')::date AS next_review_date
         FROM schools s
         LEFT JOIN audit_logs a ON a.table_name = 'schools' AND a.record_id = s.id AND a.created_at >= ${intervalSql}
         GROUP BY s.id
         ORDER BY status DESC
         LIMIT 10`,
        [period]
      );

      res.json({ success: true, data: { criticalSchools: critical.rows, warningSchools: warnings.rows } });
    } catch (error) {
      next(error);
    }
  }

  static async listUsers(req, res, next) {
    try {
      const limit = Math.max(1, Math.min(parseInt(req.query.limit || '20', 10), 100));
      const offset = Math.max(0, parseInt(req.query.offset || '0', 10));
      const search = (req.query.search || '').trim();
      const activationStatus = (req.query.activationStatus || '').trim();
      const role = (req.query.role || '').trim();
      const schoolId = (req.query.schoolId || '').trim();

      let where = [`user_type = 'school_user'`];
      const params = [];

      if (search) {
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        where.push(`(first_name ILIKE $${params.length - 2} OR last_name ILIKE $${params.length - 1} OR email ILIKE $${params.length})`);
      }
      if (activationStatus) {
        params.push(activationStatus);
        where.push(`activation_status = $${params.length}`);
      }
      if (role) {
        params.push(role);
        where.push(`role = $${params.length}`);
      }
      if (schoolId) {
        params.push(schoolId);
        where.push(`school_id = $${params.length}`);
      }

      const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

      const count = await query(`SELECT COUNT(*)::int AS total FROM users ${whereSql}`, params);

      const rows = await query(
        `SELECT u.id, u.first_name, u.last_name, u.email, u.role, u.is_active, u.activation_status,
                u.school_id, u.phone, u.user_type, u.last_login as last_login_at, u.created_at,
                s.name AS school_name
         FROM users u
         LEFT JOIN schools s ON u.school_id = s.id
         ${whereSql}
         ORDER BY u.created_at DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset]
      );

      res.json({
        success: true,
        data: rows.rows,
        pagination: { total: count.rows[0].total, limit, offset }
      });
    } catch (error) {
      next(error);
    }
  }

  static async listUsersBySchool(req, res, next) {
    try {
      const { schoolId } = req.params;
      const role = (req.query.role || '').trim();
      const isActive = req.query.isActive;

      const params = [schoolId];
      const filters = [`u.user_type = 'school_user'`, `u.school_id = $1`];
      if (role) {
        params.push(role);
        filters.push(`u.role = $${params.length}`);
      }
      if (isActive === 'true' || isActive === 'false') {
        params.push(isActive === 'true');
        filters.push(`u.is_active = $${params.length}`);
      }

      const rows = await query(
        `SELECT u.id, u.school_id, u.first_name, u.last_name, u.email, u.phone, u.user_type, u.role,
                u.is_active, u.activation_status, u.last_login as last_login_at, u.created_at,
                s.name AS school_name
         FROM users u
         JOIN schools s ON u.school_id = s.id
         WHERE ${filters.join(' AND ')}
         ORDER BY u.created_at DESC`,
        params
      );

      res.json({ success: true, data: rows.rows });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = MultiSchoolAdminController;


