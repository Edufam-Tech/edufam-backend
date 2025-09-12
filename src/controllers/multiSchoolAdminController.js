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


