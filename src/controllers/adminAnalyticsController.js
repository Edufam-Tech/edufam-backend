const { query } = require('../config/database');

/**
 * Admin Analytics Controller
 * Provides platform-wide metrics for the admin dashboard (not school-scoped)
 */
class AdminAnalyticsController {
  static async overview(req, res, next) {
    try {
      const { period = '30d' } = req.query;

      // Total schools
      const schoolsTotal = await query('SELECT COUNT(*)::int AS total FROM schools');

      // Active admin users (logged in within 30 days) and total admin users
      const usersTotals = await query(
        `SELECT
           COUNT(*) FILTER (WHERE user_type = 'admin_user')::int AS admin_total,
           COUNT(*) FILTER (WHERE user_type = 'school_user')::int AS school_total
         FROM users`
      );

      const activeAdmins = await query(
        `SELECT COUNT(*)::int AS active_admins
         FROM users
         WHERE user_type = 'admin_user' AND last_login >= NOW() - INTERVAL '30 days'`
      );

      // Revenue proxy: sum of current school subscription totals (last cycle)
      // If table is empty, treat as 0
      const revenueAgg = await query(
        `SELECT COALESCE(SUM(total_amount), 0)::numeric AS total_revenue
         FROM school_subscriptions
         WHERE cycle_end_date >= NOW() - INTERVAL '30 days'`
      );

      // Usage: simple response time placeholder from audit logs (if any)
      const usageAgg = await query(
        `SELECT COALESCE(AVG(EXTRACT(MILLISECOND FROM (NOW() - created_at))), 0)::int AS avg_ms
         FROM audit_logs
         WHERE created_at >= NOW() - INTERVAL '30 days'`
      );

      // Growth placeholders (can be refined later): compare last 30d vs prior 30d for schools created
      const currentSchools = await query(
        `SELECT COUNT(*)::int AS c FROM schools WHERE created_at >= NOW() - INTERVAL '30 days'`
      );
      const prevSchools = await query(
        `SELECT COUNT(*)::int AS p FROM schools WHERE created_at >= NOW() - INTERVAL '60 days' AND created_at < NOW() - INTERVAL '30 days'`
      );

      const currentRevenue = await query(
        `SELECT COALESCE(SUM(total_amount), 0)::numeric AS c
         FROM school_subscriptions
         WHERE cycle_end_date >= NOW() - INTERVAL '30 days'`
      );
      const prevRevenue = await query(
        `SELECT COALESCE(SUM(total_amount), 0)::numeric AS p
         FROM school_subscriptions
         WHERE cycle_end_date >= NOW() - INTERVAL '60 days' AND cycle_end_date < NOW() - INTERVAL '30 days'`
      );

      const pct = (a, b) => {
        const prev = Number(b);
        const curr = Number(a);
        if (prev <= 0) return curr > 0 ? 100 : 0;
        return Math.round(((curr - prev) / prev) * 100);
      };

      return res.json({
        success: true,
        data: {
          period,
          schools: {
            total_schools: schoolsTotal.rows[0].total || 0,
          },
          users: {
            total_admin_users: usersTotals.rows[0].admin_total || 0,
            total_school_users: usersTotals.rows[0].school_total || 0,
            active_users: activeAdmins.rows[0].active_admins || 0,
          },
          revenue: {
            total_revenue: Number(revenueAgg.rows[0].total_revenue || 0),
          },
          usage: {
            avg_response_time: usageAgg.rows[0].avg_ms || 0,
          },
          growth: {
            schools: pct(currentSchools.rows[0].c, prevSchools.rows[0].p),
            revenue: pct(currentRevenue.rows[0].c, prevRevenue.rows[0].p),
            users: null,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async growth(req, res, next) {
    try {
      const { metric = 'schools', period = 'monthly' } = req.query;

      // Return last 12 months series for requested metric
      let sql;
      if (metric === 'schools') {
        sql = `SELECT DATE_TRUNC('month', created_at) AS period, COUNT(*)::int AS new_count
               FROM schools
               WHERE created_at >= NOW() - INTERVAL '12 months'
               GROUP BY 1
               ORDER BY 1 ASC`;
      } else if (metric === 'revenue') {
        sql = `SELECT DATE_TRUNC('month', cycle_end_date) AS period, COALESCE(SUM(total_amount),0)::numeric AS new_count
               FROM school_subscriptions
               WHERE cycle_end_date >= NOW() - INTERVAL '12 months'
               GROUP BY 1
               ORDER BY 1 ASC`;
      } else {
        sql = `SELECT DATE_TRUNC('month', created_at) AS period, COUNT(*)::int AS new_count
               FROM users
               WHERE created_at >= NOW() - INTERVAL '12 months'
               GROUP BY 1
               ORDER BY 1 ASC`;
      }

      const result = await query(sql);
      return res.json({ success: true, data: { metric, period, data: result.rows } });
    } catch (error) {
      next(error);
    }
  }

  static async alerts(req, res, next) {
    try {
      // Basic placeholder: show recent audit logs as alerts with severity based on action
      const rows = await query(
        `SELECT action, created_at AS alert_time,
                CASE 
                  WHEN action ILIKE '%ERROR%' THEN 'critical'
                  WHEN action ILIKE '%SUSPEND%' THEN 'high'
                  WHEN action ILIKE '%UPDATE%' THEN 'medium'
                  ELSE 'low'
                END AS severity,
                action || ' event' AS message
         FROM audit_logs
         ORDER BY created_at DESC
         LIMIT 20`
      );

      return res.json({ success: true, data: { alerts: rows.rows } });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = AdminAnalyticsController;


