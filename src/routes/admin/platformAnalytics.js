const express = require('express');
const router = express.Router();
const { requireRole } = require('../../middleware/auth');
const PlatformAnalyticsController = require('../../controllers/admin/platformAnalyticsController');

// Note: Authentication and admin dashboard access are enforced at mount in routes/index.js

// =============================================================================
// PLATFORM OVERVIEW ROUTES
// =============================================================================

/**
 * @route   GET /api/admin/analytics/overview
 * @desc    Get platform overview dashboard metrics
 * @access  Private (Platform Admin)
 */
router.get('/overview',
  requireRole(['super_admin', 'regional_admin', 'admin_finance', 'support_hr']),
  PlatformAnalyticsController.getPlatformOverview
);

/**
 * @route   GET /api/admin/analytics/growth
 * @desc    Get growth analytics over time
 * @access  Private (Platform Admin)
 */
router.get('/growth',
  requireRole(['super_admin', 'regional_admin', 'admin_finance']),
  PlatformAnalyticsController.getGrowthAnalytics
);

// =============================================================================
// USAGE ANALYTICS ROUTES
// =============================================================================

/**
 * @route   GET /api/admin/analytics/usage
 * @desc    Get platform usage analytics
 * @access  Private (Platform Admin)
 */
router.get('/usage',
  requireRole(['super_admin', 'regional_admin', 'support_admin']),
  PlatformAnalyticsController.getUsageAnalytics
);

/**
 * @route   GET /api/admin/analytics/feature-adoption
 * @desc    Get feature adoption analytics
 * @access  Private (Platform Admin)
 */
router.get('/feature-adoption',
  requireRole(['super_admin', 'regional_admin', 'support_admin']),
  PlatformAnalyticsController.getFeatureAdoptionAnalytics
);

// =============================================================================
// REVENUE ANALYTICS ROUTES
// =============================================================================

/**
 * @route   GET /api/admin/analytics/revenue
 * @desc    Get revenue analytics and trends
 * @access  Private (Super Admin, Finance Admin)
 */
router.get('/revenue',
  requireRole(['super_admin', 'admin_finance']),
  PlatformAnalyticsController.getRevenueAnalytics
);

/**
 * @route   GET /api/admin/analytics/revenue/summary
 * @desc    Get revenue summary with key metrics
 * @access  Private (Super Admin, Finance Admin)
 */
router.get('/revenue/summary',
  requireRole(['super_admin', 'admin_finance']),
  async (req, res, next) => {
    try {
      const { query } = require('../../config/database');
      const { period = '30d' } = req.query;

      const dateFilter = period === '30d' ? '30 days' : 
                        period === '7d' ? '7 days' : 
                        period === '90d' ? '90 days' : 
                        period === '1y' ? '1 year' : '30 days';

      const [currentPeriod, previousPeriod, topPlans, overdueInvoices] = await Promise.all([
        // Current period revenue
        query(`
          SELECT 
            COALESCE(SUM(total_amount), 0) as total_revenue,
            COALESCE(SUM(amount_paid), 0) as collected_revenue,
            COALESCE(SUM(balance_due), 0) as outstanding_revenue,
            COUNT(*) as invoice_count,
            COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_invoices,
            COUNT(DISTINCT school_id) as revenue_generating_schools
          FROM subscription_invoices
          WHERE invoice_date >= CURRENT_DATE - INTERVAL '${dateFilter}'
        `),

        // Previous period for comparison
        query(`
          SELECT 
            COALESCE(SUM(total_amount), 0) as total_revenue,
            COALESCE(SUM(amount_paid), 0) as collected_revenue
          FROM subscription_invoices
          WHERE invoice_date >= CURRENT_DATE - INTERVAL '${dateFilter}' - INTERVAL '${dateFilter}'
            AND invoice_date < CURRENT_DATE - INTERVAL '${dateFilter}'
        `),

        // Top revenue generating plans
        query(`
          SELECT 
            sp.plan_name,
            sp.plan_type,
            COUNT(ss.id) as subscription_count,
            SUM(si.total_amount) as total_revenue,
            AVG(si.total_amount) as avg_revenue_per_invoice
          FROM subscription_plans sp
          JOIN school_subscriptions ss ON sp.id = ss.plan_id
          JOIN subscription_invoices si ON ss.id = si.subscription_id
          WHERE si.invoice_date >= CURRENT_DATE - INTERVAL '${dateFilter}'
          GROUP BY sp.id, sp.plan_name, sp.plan_type
          ORDER BY total_revenue DESC
          LIMIT 5
        `),

        // Overdue invoices
        query(`
          SELECT 
            COUNT(*) as overdue_count,
            SUM(balance_due) as overdue_amount
          FROM subscription_invoices
          WHERE due_date < CURRENT_DATE AND status != 'paid'
        `)
      ]);

      const current = currentPeriod.rows[0];
      const previous = previousPeriod.rows[0];

      const calculateGrowth = (currentVal, previousVal) => {
        if (!previousVal || previousVal === 0) return currentVal > 0 ? 100 : 0;
        return ((currentVal - previousVal) / previousVal * 100).toFixed(2);
      };

      res.json({
        success: true,
        data: {
          current: current,
          growth: {
            revenue: calculateGrowth(current.total_revenue, previous.total_revenue),
            collected: calculateGrowth(current.collected_revenue, previous.collected_revenue)
          },
          topPlans: topPlans.rows,
          overdue: overdueInvoices.rows[0],
          period: period
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// =============================================================================
// PLATFORM FINANCE MODULE ROUTES
// =============================================================================

// 1) School Financial Dashboard
router.get('/finance/schools',
  requireRole(['super_admin', 'admin_finance']),
  PlatformAnalyticsController.getSchoolFinanceDashboard
);

// 2) M-Pesa Revenue Analytics
router.get('/finance/mpesa/overview',
  requireRole(['super_admin', 'admin_finance']),
  PlatformAnalyticsController.getMpesaOverview
);

router.get('/finance/mpesa/performance',
  requireRole(['super_admin', 'admin_finance']),
  PlatformAnalyticsController.getMpesaPerformance
);

router.get('/finance/mpesa/reconciliation',
  requireRole(['super_admin', 'admin_finance']),
  PlatformAnalyticsController.getMpesaReconciliation
);

// 3) Segments & Reporting
router.get('/finance/segments',
  requireRole(['super_admin', 'admin_finance']),
  PlatformAnalyticsController.getFinanceSegments
);

// 4) Collections & Credit Management
router.get('/finance/collections',
  requireRole(['super_admin', 'admin_finance']),
  PlatformAnalyticsController.getCollectionsOverview
);

router.get('/finance/clv-by-category',
  requireRole(['super_admin', 'admin_finance']),
  PlatformAnalyticsController.getClvByCategory
);

// =============================================================================
// GEOGRAPHIC ANALYTICS ROUTES
// =============================================================================

/**
 * @route   GET /api/admin/analytics/geographic
 * @desc    Get geographic distribution analytics
 * @access  Private (Platform Admin)
 */
router.get('/geographic',
  requireRole(['super_admin', 'regional_admin']),
  PlatformAnalyticsController.getGeographicAnalytics
);

/**
 * @route   GET /api/admin/analytics/regions/:regionId
 * @desc    Get specific region analytics
 * @access  Private (Super Admin, Regional Admin)
 */
router.get('/regions/:regionId',
  requireRole(['super_admin', 'regional_admin']),
  async (req, res, next) => {
    try {
      const { query } = require('../../config/database');
      const { regionId } = req.params;
      const { period = '30d' } = req.query;

      const dateFilter = period === '30d' ? '30 days' : 
                        period === '7d' ? '7 days' : 
                        period === '90d' ? '90 days' : '30 days';

      const [regionInfo, schoolsInRegion, performance, revenue] = await Promise.all([
        // Region basic info
        query(`
          SELECT 
            pr.*,
            COUNT(DISTINCT sor.id) as onboarding_requests,
            COUNT(DISTINCT s.id) as active_schools
          FROM platform_regions pr
          LEFT JOIN school_onboarding_requests sor ON pr.id = sor.region_id
          LEFT JOIN schools s ON sor.principal_email = s.email AND s.is_active = true
          WHERE pr.id = $1
          GROUP BY pr.id
        `, [regionId]),

        // Schools in region
        query(`
          SELECT 
            s.id,
            s.name,
            s.created_at,
            ss.subscription_status,
            sp.plan_name,
            COUNT(DISTINCT u.id) as user_count
          FROM schools s
          JOIN school_onboarding_requests sor ON s.email = sor.principal_email
          JOIN school_subscriptions ss ON s.id = ss.school_id
          JOIN subscription_plans sp ON ss.plan_id = sp.id
          LEFT JOIN users u ON s.id = u.school_id AND u.is_active = true
          WHERE sor.region_id = $1
          GROUP BY s.id, s.name, s.created_at, ss.subscription_status, sp.plan_name
          ORDER BY s.created_at DESC
        `, [regionId]),

        // Regional performance
        query(`
          SELECT *
          FROM regional_performance
          WHERE region_id = $1
          ORDER BY performance_date DESC
          LIMIT 30
        `, [regionId]),

        // Regional revenue
        query(`
          SELECT 
            DATE_TRUNC('week', si.invoice_date) as week,
            SUM(si.total_amount) as revenue,
            COUNT(*) as invoice_count
          FROM subscription_invoices si
          JOIN schools s ON si.school_id = s.id
          JOIN school_onboarding_requests sor ON s.email = sor.principal_email
          WHERE sor.region_id = $1
            AND si.invoice_date >= CURRENT_DATE - INTERVAL '${dateFilter}'
          GROUP BY DATE_TRUNC('week', si.invoice_date)
          ORDER BY week
        `, [regionId])
      ]);

      if (regionInfo.rows.length === 0) {
        throw new NotFoundError('Region not found');
      }

      res.json({
        success: true,
        data: {
          region: regionInfo.rows[0],
          schools: schoolsInRegion.rows,
          performance: performance.rows,
          revenue: revenue.rows
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// =============================================================================
// COMPARATIVE ANALYTICS ROUTES
// =============================================================================

/**
 * @route   GET /api/admin/analytics/compare
 * @desc    Get comparative analytics between periods
 * @access  Private (Platform Admin)
 */
router.get('/compare',
  requireRole(['super_admin', 'regional_admin', 'admin_finance']),
  PlatformAnalyticsController.getComparativeAnalytics
);

/**
 * @route   GET /api/admin/analytics/benchmarks
 * @desc    Get platform benchmarks and KPIs
 * @access  Private (Platform Admin)
 */
router.get('/benchmarks',
  requireRole(['super_admin', 'regional_admin']),
  async (req, res, next) => {
    try {
      const { query } = require('../../config/database');

      const [industryBenchmarks, platformKPIs, performanceMetrics] = await Promise.all([
        // Industry benchmarks (simulated for demo)
        query(`
          SELECT 
            'Average Revenue Per School' as metric,
            AVG(monthly_cost) as platform_value,
            500.00 as industry_benchmark,
            (AVG(monthly_cost) / 500.00 * 100) as benchmark_score
          FROM school_subscriptions
          WHERE subscription_status = 'active'
          
          UNION ALL
          
          SELECT 
            'Monthly Churn Rate' as metric,
            (COUNT(CASE WHEN cancelled_at >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END)::float / 
             COUNT(CASE WHEN subscription_status = 'active' THEN 1 END) * 100) as platform_value,
            5.0 as industry_benchmark,
            (5.0 / GREATEST(COUNT(CASE WHEN cancelled_at >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END)::float / 
             COUNT(CASE WHEN subscription_status = 'active' THEN 1 END) * 100, 0.1) * 100) as benchmark_score
          FROM school_subscriptions
        `),

        // Platform KPIs
        query(`
          SELECT 
            'Monthly Recurring Revenue' as kpi,
            SUM(monthly_cost) as current_value,
            'USD' as currency
          FROM school_subscriptions
          WHERE subscription_status = 'active'
          
          UNION ALL
          
          SELECT 
            'Customer Acquisition Cost' as kpi,
            COALESCE(AVG(setup_fee), 0) as current_value,
            'USD' as currency
          FROM subscription_plans
          WHERE is_active = true
          
          UNION ALL
          
          SELECT 
            'Customer Lifetime Value' as kpi,
            AVG(
              CASE 
                WHEN cancelled_at IS NOT NULL THEN 
                  EXTRACT(DAYS FROM cancelled_at - start_date) / 30.0 * monthly_cost
                ELSE 
                  EXTRACT(DAYS FROM CURRENT_DATE - start_date) / 30.0 * monthly_cost
              END
            ) as current_value,
            'USD' as currency
          FROM school_subscriptions
        `),

        // Performance metrics
        query(`
          SELECT 
            'Average Response Time' as metric,
            AVG(response_time_ms) as value,
            'milliseconds' as unit
          FROM platform_usage_logs
          WHERE logged_at >= CURRENT_DATE - INTERVAL '24 hours'
          
          UNION ALL
          
          SELECT 
            'System Uptime' as metric,
            (COUNT(CASE WHEN status = 'healthy' THEN 1 END)::float / COUNT(*) * 100) as value,
            'percentage' as unit
          FROM system_health_checks
          WHERE check_timestamp >= CURRENT_DATE - INTERVAL '24 hours'
          
          UNION ALL
          
          SELECT 
            'Error Rate' as metric,
            (COUNT(CASE WHEN status_code >= 400 THEN 1 END)::float / COUNT(*) * 100) as value,
            'percentage' as unit
          FROM platform_usage_logs
          WHERE logged_at >= CURRENT_DATE - INTERVAL '24 hours'
        `)
      ]);

      res.json({
        success: true,
        data: {
          industryBenchmarks: industryBenchmarks.rows,
          platformKPIs: platformKPIs.rows,
          performanceMetrics: performanceMetrics.rows
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// =============================================================================
// REAL-TIME ANALYTICS ROUTES
// =============================================================================

/**
 * @route   GET /api/admin/analytics/realtime
 * @desc    Get real-time platform metrics
 * @access  Private (Platform Admin)
 */
router.get('/realtime',
  requireRole(['super_admin', 'regional_admin', 'support_admin']),
  PlatformAnalyticsController.getRealTimeMetrics
);

/**
 * @route   GET /api/admin/analytics/alerts
 * @desc    Get analytics-based alerts and notifications
 * @access  Private (Platform Admin)
 */
router.get('/alerts',
  requireRole(['super_admin', 'regional_admin', 'support_admin']),
  async (req, res, next) => {
    try {
      const { query } = require('../../config/database');

      const [performanceAlerts, revenueAlerts, usageAlerts, systemAlerts] = await Promise.all([
        // Performance alerts
        query(`
          SELECT 
            'High Response Time' as alert_type,
            'warning' as severity,
            'Average response time is above 2000ms' as message,
            AVG(response_time_ms) as metric_value,
            CURRENT_TIMESTAMP as alert_time
          FROM platform_usage_logs
          WHERE logged_at >= CURRENT_TIMESTAMP - INTERVAL '1 hour'
          HAVING AVG(response_time_ms) > 2000
        `),

        // Revenue alerts
        query(`
          SELECT 
            'Overdue Invoices' as alert_type,
            CASE 
              WHEN COUNT(*) > 10 THEN 'critical'
              WHEN COUNT(*) > 5 THEN 'warning'
              ELSE 'info'
            END as severity,
            'There are ' || COUNT(*) || ' overdue invoices totaling $' || SUM(balance_due) as message,
            COUNT(*) as metric_value,
            CURRENT_TIMESTAMP as alert_time
          FROM subscription_invoices
          WHERE due_date < CURRENT_DATE AND status != 'paid'
          HAVING COUNT(*) > 0
        `),

        // Usage alerts
        query(`
          SELECT 
            'Low Usage School' as alert_type,
            'info' as severity,
            s.name || ' has not been active in the last 7 days' as message,
            EXTRACT(DAYS FROM CURRENT_DATE - MAX(pul.logged_at)) as metric_value,
            CURRENT_TIMESTAMP as alert_time
          FROM schools s
          LEFT JOIN platform_usage_logs pul ON s.id = pul.school_id
          WHERE s.is_active = true
          GROUP BY s.id, s.name
          HAVING MAX(pul.logged_at) < CURRENT_DATE - INTERVAL '7 days' OR MAX(pul.logged_at) IS NULL
          LIMIT 5
        `),

        // System health alerts
        query(`
          SELECT 
            'System Health Check Failed' as alert_type,
            'critical' as severity,
            check_name || ' check failed: ' || COALESCE(error_message, 'Unknown error') as message,
            response_time_ms as metric_value,
            check_timestamp as alert_time
          FROM system_health_checks
          WHERE status != 'healthy'
            AND check_timestamp >= CURRENT_TIMESTAMP - INTERVAL '1 hour'
          ORDER BY check_timestamp DESC
          LIMIT 10
        `)
      ]);

      const allAlerts = [
        ...performanceAlerts.rows,
        ...revenueAlerts.rows,
        ...usageAlerts.rows,
        ...systemAlerts.rows
      ].sort((a, b) => new Date(b.alert_time) - new Date(a.alert_time));

      res.json({
        success: true,
        data: {
          alerts: allAlerts,
          summary: {
            total: allAlerts.length,
            critical: allAlerts.filter(a => a.severity === 'critical').length,
            warning: allAlerts.filter(a => a.severity === 'warning').length,
            info: allAlerts.filter(a => a.severity === 'info').length
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// =============================================================================
// EXPORT AND REPORTING ROUTES
// =============================================================================

/**
 * @route   POST /api/admin/analytics/export
 * @desc    Export analytics data
 * @access  Private (Platform Admin)
 */
router.post('/export',
  requireRole(['super_admin', 'regional_admin', 'admin_finance']),
  async (req, res, next) => {
    try {
      const {
        reportType, // 'overview', 'revenue', 'usage', 'schools'
        format = 'csv', // 'csv', 'json', 'pdf'
        startDate,
        endDate,
        filters = {}
      } = req.body;

      if (!reportType) {
        throw new ValidationError('Report type is required');
      }

      // In a real implementation, this would generate actual export files
      // For now, we'll simulate the export process
      
      const exportId = `export_${reportType}_${Date.now()}`;
      const exportUrl = `https://exports.edufam.com/admin/analytics/${exportId}.${format}`;
      
      res.json({
        success: true,
        message: 'Analytics export initiated successfully',
        data: {
          exportId,
          exportUrl,
          reportType,
          format,
          filters,
          estimatedCompletionTime: '2-5 minutes',
          generatedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;