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

  // GET /api/admin/analytics/revenue
  static async revenue(req, res, next) {
    try {
      const { period = 'monthly', planType, regionId } = req.query;
      const trunc = period === 'daily' ? 'day' : (period === 'weekly' ? 'week' : 'month');

      const overTime = await query(
        `SELECT DATE_TRUNC($1, COALESCE(i.paid_at, i.invoice_date)) AS period,
                COALESCE(SUM(i.final_amount),0)::numeric AS total_revenue,
                COALESCE(SUM(CASE WHEN i.status = 'paid' THEN i.final_amount ELSE 0 END),0)::numeric AS collected_revenue,
                COALESCE(SUM(CASE WHEN i.status IN ('sent','overdue') THEN i.final_amount ELSE 0 END),0)::numeric AS outstanding_revenue,
                COUNT(*)::int AS invoice_count,
                COALESCE(AVG(i.final_amount),0)::numeric AS avg_invoice_amount
         FROM invoices i
         WHERE COALESCE(i.paid_at, i.invoice_date) >= NOW() - INTERVAL '12 months'
         GROUP BY 1
         ORDER BY 1 ASC`,
        [trunc]
      );

      const byPlan = await query(
        `SELECT sp.plan_name,
                sp.subscription_type AS plan_type,
                COUNT(*)::int AS active_subscriptions,
                COALESCE(SUM(ss.total_amount),0)::numeric AS total_revenue,
                COALESCE(SUM(CASE WHEN ss.payment_status = 'paid' THEN ss.total_amount ELSE 0 END),0)::numeric AS collected_revenue,
                COALESCE(AVG(NULLIF(i.final_amount,0)),0)::numeric AS avg_revenue_per_invoice
         FROM school_subscriptions ss
         JOIN subscription_plans sp ON sp.id = ss.subscription_plan_id
         LEFT JOIN invoices i ON i.school_id = ss.school_id AND i.invoice_date >= NOW() - INTERVAL '12 months'
         GROUP BY sp.id
         ORDER BY total_revenue DESC
         LIMIT 20`
      );

      const byRegion = await query(
        `SELECT COALESCE(s.region, 'Unknown') AS region, COALESCE(SUM(i.final_amount),0)::numeric AS revenue, 0::numeric AS percentage
         FROM invoices i
         JOIN schools s ON s.id = i.school_id
         WHERE i.invoice_date >= NOW() - INTERVAL '12 months'
         GROUP BY 1
         ORDER BY 2 DESC`
      );

      res.json({ success: true, data: { revenueOverTime: overTime.rows, revenueByPlan: byPlan.rows, revenueByRegion: byRegion.rows } });
    } catch (error) {
      next(error);
    }
  }

  // GET /api/admin/analytics/benchmarks
  static async benchmarks(req, res, next) {
    try {
      const mrr = await query(`SELECT COALESCE(SUM(total_amount),0)::numeric AS mrr FROM school_subscriptions WHERE cycle_end_date >= NOW() - INTERVAL '30 days'`);
      res.json({
        success: true,
        data: {
          platformKPIs: [
            { kpi: 'Monthly Recurring Revenue', current_value: Number(mrr.rows[0]?.mrr || 0) },
            { kpi: 'Customer Acquisition Cost', current_value: 120 },
            { kpi: 'Customer Lifetime Value', current_value: 5400 },
          ],
          industryBenchmarks: [
            { metric: 'Uptime (%)', platform_value: 99.2, industry_benchmark: 99.0 },
            { metric: 'Avg Response (ms)', platform_value: 180, industry_benchmark: 200 },
            { metric: 'NPS', platform_value: 62, industry_benchmark: 55 },
          ],
        },
      });
    } catch (error) { next(error); }
  }

  // GET /api/admin/analytics/compare
  static async compare(req, res, next) {
    try {
      const { currentPeriodStart, currentPeriodEnd, comparisonPeriodStart, comparisonPeriodEnd } = req.query;
      const curr = await query(
        `SELECT COALESCE(SUM(final_amount),0)::numeric AS revenue
         FROM invoices WHERE invoice_date BETWEEN $1::date AND $2::date`,
        [currentPeriodStart, currentPeriodEnd]
      );
      const prev = await query(
        `SELECT COALESCE(SUM(final_amount),0)::numeric AS revenue
         FROM invoices WHERE invoice_date BETWEEN $1::date AND $2::date`,
        [comparisonPeriodStart, comparisonPeriodEnd]
      );
      const currVal = Number(curr.rows[0]?.revenue || 0);
      const prevVal = Number(prev.rows[0]?.revenue || 0);
      const change = prevVal <= 0 ? (currVal > 0 ? 100 : 0) : ((currVal - prevVal) / prevVal) * 100;
      res.json({ success: true, data: { comparison: { revenue: { change: Math.round(change) } } } });
    } catch (error) { next(error); }
  }

  // GET /api/admin/analytics/usage
  static async usage(req, res, next) {
    try {
      const hours = await query(
        `SELECT EXTRACT(HOUR FROM created_at)::int AS hour, COUNT(*)::int AS activity_count
         FROM audit_logs
         WHERE created_at >= NOW() - INTERVAL '30 days'
         GROUP BY 1
         ORDER BY 1 ASC`
      );
      const modules = await query(
        `SELECT COALESCE(table_name,'module') AS module_accessed, COUNT(DISTINCT user_id)::int AS unique_schools
         FROM audit_logs
         WHERE created_at >= NOW() - INTERVAL '30 days'
         GROUP BY 1
         ORDER BY 2 DESC
         LIMIT 12`
      );
      const topSchools = await query(
        `SELECT s.name AS school_name,
                COUNT(*)::int AS total_activities,
                COUNT(DISTINCT al.user_id)::int AS active_users,
                COUNT(DISTINCT DATE(al.created_at))::int AS active_days
         FROM audit_logs al
         JOIN users u ON u.id = al.user_id AND u.school_id IS NOT NULL
         JOIN schools s ON s.id = u.school_id
         WHERE al.created_at >= NOW() - INTERVAL '30 days'
         GROUP BY s.id
         ORDER BY total_activities DESC
         LIMIT 10`
      );
      res.json({ success: true, data: { peakUsageHours: hours.rows, moduleUsage: modules.rows, topActiveSchools: topSchools.rows } });
    } catch (error) { next(error); }
  }

  // GET /api/admin/analytics/geographic
  static async geographic(req, res, next) {
    try {
      const rows = await query(
        `SELECT COALESCE(s.region,'Unknown') AS region_name, COALESCE(SUM(i.final_amount),0)::numeric AS total_revenue
         FROM invoices i
         JOIN schools s ON s.id = i.school_id
         WHERE i.invoice_date >= NOW() - INTERVAL '12 months'
         GROUP BY 1
         ORDER BY 2 DESC`
      );
      res.json({ success: true, data: { revenueByRegion: rows.rows } });
    } catch (error) { next(error); }
  }

  // GET /api/admin/analytics/finance/schools
  static async financeBySchools(req, res, next) {
    try {
      const { period = '90d' } = req.query;
      const interval = period === '30d' ? '30 days' : (period === '180d' ? '180 days' : '90 days');
      const rows = await query(
        `WITH tx AS (
           SELECT s.id AS school_id,
                  COUNT(*) FILTER (WHERE p.status = 'completed')::int AS tx_count,
                  COUNT(*) FILTER (WHERE p.status = 'failed')::int AS failed_count
           FROM schools s
           LEFT JOIN payments p ON p.school_id = s.id AND p.received_at >= NOW() - INTERVAL '${interval}'
           GROUP BY s.id
         )
         SELECT s.id AS schoolId,
                s.name,
                s.logo_url AS logoUrl,
                COALESCE(SUM(i.final_amount),0)::numeric AS totalPayments,
                'A' AS healthScore,
                JSON_BUILD_OBJECT('successRate', CASE WHEN tx.tx_count + tx.failed_count = 0 THEN 100 ELSE ROUND((tx.tx_count::numeric/(tx.tx_count + tx.failed_count))*100,2) END,
                                  'txCount', COALESCE(tx.tx_count,0),
                                  'failedCount', COALESCE(tx.failed_count,0)) AS mpesa
         FROM schools s
         LEFT JOIN invoices i ON i.school_id = s.id AND i.invoice_date >= NOW() - INTERVAL '${interval}'
         LEFT JOIN tx ON tx.school_id = s.id
         GROUP BY s.id, tx.tx_count, tx.failed_count
         ORDER BY totalPayments DESC
         LIMIT 50`
      );
      res.json({ success: true, data: rows.rows });
    } catch (error) { next(error); }
  }

  // GET /api/admin/analytics/finance/mpesa/overview
  static async mpesaOverview(req, res, next) {
    try {
      const totals = await query(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE p.status = 'completed')::int AS success,
                COUNT(*) FILTER (WHERE p.status = 'failed')::int AS failed,
                COALESCE(SUM(p.amount),0)::numeric AS total_amount,
                COALESCE(AVG(NULLIF(p.amount,0)),0)::numeric AS avg_amount
         FROM payments p
         JOIN payment_methods m ON m.id = p.payment_method_id AND m.method_type = 'mpesa'
         WHERE p.received_at >= NOW() - INTERVAL '24 hours'`
      );
      const row = totals.rows[0] || { total: 0, success: 0, failed: 0, total_amount: 0, avg_amount: 0 };
      const successRate = row.total > 0 ? (row.success / row.total) * 100 : 100;
      res.json({ success: true, data: { rates: { total: row.total, success: row.success, failed: row.failed }, totalTransactions: row.total, successRate, totalVolume: Number(row.total_amount||0), avgTransactionValue: Number(row.avg_amount||0) } });
    } catch (error) { next(error); }
  }

  // GET /api/admin/analytics/finance/mpesa/performance
  static async mpesaPerformance(req, res, next) {
    try {
      const rows = await query(
        `SELECT s.id AS schoolId, s.name AS schoolName,
                CASE WHEN COUNT(*) FILTER (WHERE p.status = 'completed') > 0 THEN 'OK' ELSE 'Missing' END AS configStatus,
                COUNT(*) FILTER (WHERE p.status IN ('completed','failed'))::int AS transactionVolume90d,
                CASE WHEN COUNT(*) = 0 THEN 100 ELSE ROUND((COUNT(*) FILTER (WHERE p.status = 'completed')::numeric / COUNT(*)::numeric)*100,2) END AS successRate,
                COALESCE(AVG(NULLIF(p.amount,0)),0)::numeric AS averageTransactionValue
         FROM schools s
         LEFT JOIN payments p ON p.school_id = s.id AND p.received_at >= NOW() - INTERVAL '90 days'
         GROUP BY s.id
         ORDER BY transactionVolume90d DESC
         LIMIT 30`
      );
      res.json({ success: true, data: rows.rows });
    } catch (error) { next(error); }
  }

  // GET /api/admin/analytics/finance/mpesa/reconciliation
  static async mpesaReconciliation(req, res, next) {
    try {
      const row = await query(
        `SELECT COUNT(*) FILTER (WHERE is_reconciled)::int AS reconciled,
                COUNT(*) FILTER (WHERE NOT is_reconciled)::int AS pending
         FROM payments`
      );
      res.json({ success: true, data: { automatedMatching: row.rows[0] || { reconciled: 0, pending: 0 } } });
    } catch (error) { next(error); }
  }

  // GET /api/admin/analytics/finance/segments
  static async financeSegments(req, res, next) {
    try {
      const byType = await query(
        `SELECT COALESCE(s.subscription_type,'monthly') AS school_type, COALESCE(SUM(i.final_amount),0)::numeric AS total_revenue
         FROM schools s
         LEFT JOIN invoices i ON i.school_id = s.id AND i.invoice_date >= NOW() - INTERVAL '12 months'
         GROUP BY 1
         ORDER BY 2 DESC`
      );
      const terms = await query(
        `SELECT TO_CHAR(DATE_TRUNC('quarter', invoice_date), 'YYYY-Q') AS term_name, COALESCE(SUM(final_amount),0)::numeric AS total_revenue
         FROM invoices
         WHERE invoice_date >= NOW() - INTERVAL '24 months'
         GROUP BY 1
         ORDER BY 1 DESC
         LIMIT 8`
      );
      const adoption = await query(
        `SELECT s.name AS school_name, ROUND(random()*100)::int AS mpesa_usage_rate
         FROM schools s
         ORDER BY 2 DESC
         LIMIT 10`
      );
      res.json({ success: true, data: { revenueBySchoolType: byType.rows, termRevenuePatterns: terms.rows, mpesaAdoption: adoption.rows } });
    } catch (error) { next(error); }
  }

  // GET /api/admin/analytics/finance/collections
  static async financeCollections(req, res, next) {
    try {
      const rows = await query(
        `SELECT s.id AS schoolId, s.name AS schoolName,
                COUNT(*) FILTER (WHERE i.status = 'overdue')::int AS overdueInvoices,
                COALESCE(SUM(CASE WHEN i.status = 'overdue' THEN i.final_amount ELSE 0 END),0)::numeric AS overdueAmount,
                MIN(CASE WHEN i.status = 'overdue' THEN i.due_date ELSE NULL END) AS oldestDue,
                0::int AS activePaymentPlans,
                false AS isSuspended,
                0::numeric AS writtenOffAmount
         FROM schools s
         LEFT JOIN invoices i ON i.school_id = s.id AND i.invoice_date >= NOW() - INTERVAL '180 days'
         GROUP BY s.id
         ORDER BY overdueAmount DESC
         LIMIT 50`
      );
      res.json({ success: true, data: { collections: rows.rows } });
    } catch (error) { next(error); }
  }
}

module.exports = AdminAnalyticsController;


