const { query } = require('../../config/database');
const { ValidationError, NotFoundError } = require('../../middleware/errorHandler');

class PlatformAnalyticsController {
  // =============================================================================
  // PLATFORM OVERVIEW ANALYTICS
  // =============================================================================

  // Get platform overview dashboard
  static async getPlatformOverview(req, res, next) {
    try {
      const { period = '30d' } = req.query;

      // Calculate date range based on period
      const dateRanges = {
        '24h': 'CURRENT_TIMESTAMP - INTERVAL \'24 hours\'',
        '7d': 'CURRENT_TIMESTAMP - INTERVAL \'7 days\'',
        '30d': 'CURRENT_TIMESTAMP - INTERVAL \'30 days\'',
        '90d': 'CURRENT_TIMESTAMP - INTERVAL \'90 days\'',
        '1y': 'CURRENT_TIMESTAMP - INTERVAL \'1 year\''
      };

      const dateFilter = dateRanges[period] || dateRanges['30d'];

      const [
        schoolsMetrics,
        usersMetrics,
        revenueMetrics,
        usageMetrics,
        growthMetrics
      ] = await Promise.all([
        // Schools metrics
        query(`
          SELECT 
            COUNT(*) as total_schools,
            COUNT(CASE WHEN is_active = true THEN 1 END) as active_schools,
            COUNT(CASE WHEN created_at >= ${dateFilter} THEN 1 END) as new_schools,
            COUNT(CASE WHEN is_active = false THEN 1 END) as suspended_schools
          FROM schools
        `),

        // Users metrics
        query(`
          SELECT 
            COUNT(*) as total_users,
            COUNT(CASE WHEN is_active = true THEN 1 END) as active_users,
            COUNT(CASE WHEN created_at >= ${dateFilter} THEN 1 END) as new_users,
            COUNT(CASE WHEN last_login_at >= ${dateFilter} THEN 1 END) as active_users_period,
            COUNT(DISTINCT school_id) as schools_with_users
          FROM users
          WHERE user_type = 'school_user'
        `),

        // Revenue metrics
        query(`
          SELECT 
            COALESCE(SUM(total_amount), 0) as total_revenue,
            COALESCE(SUM(amount_paid), 0) as collected_revenue,
            COALESCE(SUM(balance_due), 0) as outstanding_revenue,
            COUNT(*) as total_invoices,
            COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_invoices
          FROM subscription_invoices
          WHERE invoice_date >= ${dateFilter}
        `),

        // Platform usage metrics
        query(`
          SELECT 
            COUNT(*) as total_activities,
            COUNT(DISTINCT school_id) as active_schools,
            COUNT(DISTINCT user_id) as active_users,
            AVG(response_time_ms) as avg_response_time
          FROM platform_usage_logs
          WHERE logged_at >= ${dateFilter}
        `),

        // Growth metrics (comparing current period with previous period)
        query(`
          SELECT 
            period,
            COUNT(DISTINCT school_id) as schools,
            COUNT(*) as total_users,
            SUM(revenue) as revenue
          FROM (
            SELECT 
              CASE 
                WHEN s.created_at >= ${dateFilter} THEN 'current'
                WHEN s.created_at >= ${dateFilter} - (${dateFilter} - CURRENT_TIMESTAMP) THEN 'previous'
                ELSE 'older'
              END as period,
              s.id as school_id,
              COALESCE(si.total_amount, 0) as revenue
            FROM schools s
            LEFT JOIN school_subscriptions ss ON s.id = ss.school_id
            LEFT JOIN subscription_invoices si ON ss.id = si.subscription_id
            WHERE s.created_at >= ${dateFilter} - (${dateFilter} - CURRENT_TIMESTAMP)
          ) grouped
          WHERE period IN ('current', 'previous')
          GROUP BY period
        `)
      ]);

      // Calculate growth percentages
      const currentPeriod = growthMetrics.rows.find(row => row.period === 'current') || {};
      const previousPeriod = growthMetrics.rows.find(row => row.period === 'previous') || {};

      const calculateGrowth = (current, previous) => {
        if (!previous || previous === 0) return current > 0 ? 100 : 0;
        return ((current - previous) / previous * 100).toFixed(2);
      };

      const growth = {
        schools: calculateGrowth(currentPeriod.schools, previousPeriod.schools),
        users: calculateGrowth(currentPeriod.total_users, previousPeriod.total_users),
        revenue: calculateGrowth(currentPeriod.revenue, previousPeriod.revenue)
      };

      const overview = {
        schools: schoolsMetrics.rows[0],
        users: usersMetrics.rows[0],
        revenue: revenueMetrics.rows[0],
        usage: usageMetrics.rows[0],
        growth: growth,
        period: period
      };

      res.json({
        success: true,
        data: overview
      });
    } catch (error) {
      next(error);
    }
  }

  // =============================================================================
  // GROWTH ANALYTICS
  // =============================================================================

  // Get growth analytics
  static async getGrowthAnalytics(req, res, next) {
    try {
      const { 
        period = 'monthly',
        startDate, 
        endDate,
        metric = 'schools' // schools, users, revenue
      } = req.query;

      let dateGrouping;
      let dateFilter = '';

      switch (period) {
        case 'daily':
          dateGrouping = 'DATE_TRUNC(\'day\', created_at)';
          break;
        case 'weekly':
          dateGrouping = 'DATE_TRUNC(\'week\', created_at)';
          break;
        case 'monthly':
          dateGrouping = 'DATE_TRUNC(\'month\', created_at)';
          break;
        case 'quarterly':
          dateGrouping = 'DATE_TRUNC(\'quarter\', created_at)';
          break;
        case 'yearly':
          dateGrouping = 'DATE_TRUNC(\'year\', created_at)';
          break;
        default:
          dateGrouping = 'DATE_TRUNC(\'month\', created_at)';
      }

      if (startDate && endDate) {
        dateFilter = `AND created_at BETWEEN '${startDate}' AND '${endDate}'`;
      } else {
        dateFilter = 'AND created_at >= CURRENT_DATE - INTERVAL \'12 months\'';
      }

      let growthQuery;

      switch (metric) {
        case 'schools':
          growthQuery = `
            SELECT 
              ${dateGrouping} as period,
              COUNT(*) as new_count,
              SUM(COUNT(*)) OVER (ORDER BY ${dateGrouping}) as cumulative_count
            FROM schools
            WHERE 1=1 ${dateFilter}
            GROUP BY ${dateGrouping}
            ORDER BY period ASC
          `;
          break;

        case 'users':
          growthQuery = `
            SELECT 
              ${dateGrouping} as period,
              COUNT(*) as new_count,
              SUM(COUNT(*)) OVER (ORDER BY ${dateGrouping}) as cumulative_count
            FROM users
            WHERE user_type = 'school_user' ${dateFilter}
            GROUP BY ${dateGrouping}
            ORDER BY period ASC
          `;
          break;

        case 'revenue':
          growthQuery = `
            SELECT 
              DATE_TRUNC('${period === 'daily' ? 'day' : period === 'weekly' ? 'week' : period === 'quarterly' ? 'quarter' : period === 'yearly' ? 'year' : 'month'}', invoice_date) as period,
              SUM(total_amount) as new_count,
              SUM(SUM(total_amount)) OVER (ORDER BY DATE_TRUNC('${period === 'daily' ? 'day' : period === 'weekly' ? 'week' : period === 'quarterly' ? 'quarter' : period === 'yearly' ? 'year' : 'month'}', invoice_date)) as cumulative_count
            FROM subscription_invoices
            WHERE 1=1 ${dateFilter.replace('created_at', 'invoice_date')}
            GROUP BY DATE_TRUNC('${period === 'daily' ? 'day' : period === 'weekly' ? 'week' : period === 'quarterly' ? 'quarter' : period === 'yearly' ? 'year' : 'month'}', invoice_date)
            ORDER BY period ASC
          `;
          break;

        default:
          throw new ValidationError('Invalid metric. Must be schools, users, or revenue');
      }

      const result = await query(growthQuery);

      res.json({
        success: true,
        data: {
          metric: metric,
          period: period,
          data: result.rows
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // =============================================================================
  // USAGE ANALYTICS
  // =============================================================================

  // Get platform usage analytics
  static async getUsageAnalytics(req, res, next) {
    try {
      const { startDate, endDate, schoolId, activityType } = req.query;

      let dateFilter = '';
      let schoolFilter = '';
      let activityFilter = '';
      const params = [];

      if (startDate && endDate) {
        dateFilter = ` AND logged_at BETWEEN $${params.length + 1} AND $${params.length + 2}`;
        params.push(startDate, endDate);
      } else {
        dateFilter = ' AND logged_at >= CURRENT_DATE - INTERVAL \'30 days\'';
      }

      if (schoolId) {
        schoolFilter = ` AND school_id = $${params.length + 1}`;
        params.push(schoolId);
      }

      if (activityType) {
        activityFilter = ` AND activity_type = $${params.length + 1}`;
        params.push(activityType);
      }

      const [
        activityBreakdown,
        moduleUsage,
        peakUsageHours,
        topActiveSchools,
        responseTimeMetrics
      ] = await Promise.all([
        // Activity type breakdown
        query(`
          SELECT 
            activity_type,
            COUNT(*) as activity_count,
            COUNT(DISTINCT school_id) as unique_schools,
            COUNT(DISTINCT user_id) as unique_users,
            AVG(response_time_ms) as avg_response_time
          FROM platform_usage_logs
          WHERE 1=1 ${dateFilter} ${schoolFilter} ${activityFilter}
          GROUP BY activity_type
          ORDER BY activity_count DESC
        `, params),

        // Module usage
        query(`
          SELECT 
            module_accessed,
            COUNT(*) as access_count,
            COUNT(DISTINCT school_id) as unique_schools,
            AVG(response_time_ms) as avg_response_time
          FROM platform_usage_logs
          WHERE module_accessed IS NOT NULL ${dateFilter} ${schoolFilter}
          GROUP BY module_accessed
          ORDER BY access_count DESC
        `, params.slice(0, schoolId ? (startDate && endDate ? 3 : 1) : (startDate && endDate ? 2 : 0))),

        // Peak usage hours
        query(`
          SELECT 
            EXTRACT(HOUR FROM logged_at) as hour,
            COUNT(*) as activity_count,
            AVG(response_time_ms) as avg_response_time
          FROM platform_usage_logs
          WHERE 1=1 ${dateFilter} ${schoolFilter}
          GROUP BY EXTRACT(HOUR FROM logged_at)
          ORDER BY hour
        `, params.slice(0, schoolId ? (startDate && endDate ? 3 : 1) : (startDate && endDate ? 2 : 0))),

        // Top active schools
        query(`
          SELECT 
            pul.school_id,
            s.name as school_name,
            COUNT(*) as total_activities,
            COUNT(DISTINCT pul.user_id) as active_users,
            COUNT(DISTINCT DATE(pul.logged_at)) as active_days,
            AVG(pul.response_time_ms) as avg_response_time
          FROM platform_usage_logs pul
          JOIN schools s ON pul.school_id = s.id
          WHERE 1=1 ${dateFilter} ${activityFilter}
          GROUP BY pul.school_id, s.name
          ORDER BY total_activities DESC
          LIMIT 20
        `, params.slice(0, activityType ? (startDate && endDate ? 3 : 1) : (startDate && endDate ? 2 : 0))),

        // Response time metrics
        query(`
          SELECT 
            DATE_TRUNC('day', logged_at) as date,
            AVG(response_time_ms) as avg_response_time,
            MIN(response_time_ms) as min_response_time,
            MAX(response_time_ms) as max_response_time,
            PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY response_time_ms) as p95_response_time
          FROM platform_usage_logs
          WHERE response_time_ms IS NOT NULL ${dateFilter} ${schoolFilter}
          GROUP BY DATE_TRUNC('day', logged_at)
          ORDER BY date DESC
          LIMIT 30
        `, params.slice(0, schoolId ? (startDate && endDate ? 3 : 1) : (startDate && endDate ? 2 : 0)))
      ]);

      res.json({
        success: true,
        data: {
          activityBreakdown: activityBreakdown.rows,
          moduleUsage: moduleUsage.rows,
          peakUsageHours: peakUsageHours.rows,
          topActiveSchools: topActiveSchools.rows,
          responseTimeMetrics: responseTimeMetrics.rows
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // =============================================================================
  // REVENUE ANALYTICS
  // =============================================================================

  // Get revenue analytics
  static async getRevenueAnalytics(req, res, next) {
    try {
      const { 
        period = 'monthly',
        startDate, 
        endDate,
        planType,
        regionId 
      } = req.query;

      let dateFilter = '';
      let planFilter = '';
      let regionFilter = '';
      const params = [];

      if (startDate && endDate) {
        dateFilter = ` AND si.invoice_date BETWEEN $${params.length + 1} AND $${params.length + 2}`;
        params.push(startDate, endDate);
      } else {
        dateFilter = ' AND si.invoice_date >= CURRENT_DATE - INTERVAL \'12 months\'';
      }

      if (planType) {
        planFilter = ` AND sp.plan_type = $${params.length + 1}`;
        params.push(planType);
      }

      if (regionId) {
        regionFilter = ` AND pr.id = $${params.length + 1}`;
        params.push(regionId);
      }

      let dateGrouping;
      switch (period) {
        case 'daily':
          dateGrouping = 'DATE_TRUNC(\'day\', si.invoice_date)';
          break;
        case 'weekly':
          dateGrouping = 'DATE_TRUNC(\'week\', si.invoice_date)';
          break;
        case 'monthly':
          dateGrouping = 'DATE_TRUNC(\'month\', si.invoice_date)';
          break;
        case 'quarterly':
          dateGrouping = 'DATE_TRUNC(\'quarter\', si.invoice_date)';
          break;
        case 'yearly':
          dateGrouping = 'DATE_TRUNC(\'year\', si.invoice_date)';
          break;
        default:
          dateGrouping = 'DATE_TRUNC(\'month\', si.invoice_date)';
      }

      const [
        revenueOverTime,
        revenueByPlan,
        revenueByRegion,
        paymentMetrics,
        churnAnalysis
      ] = await Promise.all([
        // Revenue over time
        query(`
          SELECT 
            ${dateGrouping} as period,
            SUM(si.total_amount) as total_revenue,
            SUM(si.amount_paid) as collected_revenue,
            SUM(si.balance_due) as outstanding_revenue,
            COUNT(*) as invoice_count,
            AVG(si.total_amount) as avg_invoice_amount
          FROM subscription_invoices si
          JOIN school_subscriptions ss ON si.subscription_id = ss.id
          JOIN subscription_plans sp ON ss.plan_id = sp.id
          JOIN schools s ON si.school_id = s.id
          LEFT JOIN school_onboarding_requests sor ON s.email = sor.principal_email
          LEFT JOIN platform_regions pr ON sor.region_id = pr.id
          WHERE 1=1 ${dateFilter} ${planFilter} ${regionFilter}
          GROUP BY ${dateGrouping}
          ORDER BY period ASC
        `, params),

        // Revenue by subscription plan
        query(`
          SELECT 
            sp.plan_name,
            sp.plan_type,
            COUNT(DISTINCT ss.id) as active_subscriptions,
            SUM(si.total_amount) as total_revenue,
            SUM(si.amount_paid) as collected_revenue,
            AVG(si.total_amount) as avg_revenue_per_invoice
          FROM subscription_plans sp
          JOIN school_subscriptions ss ON sp.id = ss.plan_id
          JOIN subscription_invoices si ON ss.id = si.subscription_id
          WHERE ss.subscription_status = 'active' ${dateFilter.replace('si.', 'si.')}
          GROUP BY sp.id, sp.plan_name, sp.plan_type
          ORDER BY total_revenue DESC
        `, params.slice(0, startDate && endDate ? 2 : 0)),

        // Revenue by region
        query(`
          SELECT 
            pr.region_name,
            pr.country,
            COUNT(DISTINCT s.id) as schools_count,
            SUM(si.total_amount) as total_revenue,
            SUM(si.amount_paid) as collected_revenue,
            AVG(si.total_amount) as avg_revenue_per_school
          FROM platform_regions pr
          JOIN school_onboarding_requests sor ON pr.id = sor.region_id
          JOIN schools s ON sor.principal_email = s.email
          JOIN subscription_invoices si ON s.id = si.school_id
          WHERE 1=1 ${dateFilter.replace('si.', 'si.')}
          GROUP BY pr.id, pr.region_name, pr.country
          ORDER BY total_revenue DESC
        `, params.slice(0, startDate && endDate ? 2 : 0)),

        // Payment metrics
        query(`
          SELECT 
            si.status,
            COUNT(*) as invoice_count,
            SUM(si.total_amount) as total_amount,
            SUM(si.amount_paid) as amount_paid,
            AVG(CASE WHEN si.paid_at IS NOT NULL AND si.invoice_date IS NOT NULL 
                 THEN EXTRACT(DAYS FROM si.paid_at - si.invoice_date) END) as avg_days_to_payment
          FROM subscription_invoices si
          WHERE 1=1 ${dateFilter.replace('si.', 'si.')}
          GROUP BY si.status
          ORDER BY total_amount DESC
        `, params.slice(0, startDate && endDate ? 2 : 0)),

        // Churn analysis
        query(`
          SELECT 
            DATE_TRUNC('month', cancelled_at) as month,
            COUNT(*) as churned_subscriptions,
            SUM(monthly_cost) as churned_mrr,
            AVG(
              EXTRACT(DAYS FROM cancelled_at - start_date)
            ) as avg_subscription_lifetime_days
          FROM school_subscriptions
          WHERE cancelled_at IS NOT NULL
            AND cancelled_at >= CURRENT_DATE - INTERVAL '12 months'
          GROUP BY DATE_TRUNC('month', cancelled_at)
          ORDER BY month DESC
        `)
      ]);

      res.json({
        success: true,
        data: {
          revenueOverTime: revenueOverTime.rows,
          revenueByPlan: revenueByPlan.rows,
          revenueByRegion: revenueByRegion.rows,
          paymentMetrics: paymentMetrics.rows,
          churnAnalysis: churnAnalysis.rows,
          period: period
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // =============================================================================
  // GEOGRAPHIC ANALYTICS
  // =============================================================================

  // Get geographic distribution analytics
  static async getGeographicAnalytics(req, res, next) {
    try {
      const [
        regionDistribution,
        countryDistribution,
        regionalPerformance,
        regionalGrowth
      ] = await Promise.all([
        // Schools by region
        query(`
          SELECT 
            pr.region_name,
            pr.country,
            pr.currency,
            COUNT(DISTINCT s.id) as schools_count,
            COUNT(DISTINCT u.id) as users_count,
            SUM(COALESCE(si.total_amount, 0)) as total_revenue,
            AVG(sas.performance_score) as avg_performance_score
          FROM platform_regions pr
          LEFT JOIN school_onboarding_requests sor ON pr.id = sor.region_id
          LEFT JOIN schools s ON sor.principal_email = s.email
          LEFT JOIN users u ON s.id = u.school_id
          LEFT JOIN subscription_invoices si ON s.id = si.school_id
          LEFT JOIN school_analytics_summary sas ON s.id = sas.school_id
          GROUP BY pr.id, pr.region_name, pr.country, pr.currency
          ORDER BY schools_count DESC
        `),

        // Schools by country
        query(`
          SELECT 
            pr.country,
            COUNT(DISTINCT pr.id) as regions_count,
            COUNT(DISTINCT s.id) as schools_count,
            COUNT(DISTINCT u.id) as users_count,
            SUM(COALESCE(si.total_amount, 0)) as total_revenue
          FROM platform_regions pr
          LEFT JOIN school_onboarding_requests sor ON pr.id = sor.region_id
          LEFT JOIN schools s ON sor.principal_email = s.email
          LEFT JOIN users u ON s.id = u.school_id
          LEFT JOIN subscription_invoices si ON s.id = si.school_id
          GROUP BY pr.country
          ORDER BY schools_count DESC
        `),

        // Regional performance metrics
        query(`
          SELECT 
            rp.*,
            pr.region_name,
            pr.country
          FROM regional_performance rp
          JOIN platform_regions pr ON rp.region_id = pr.id
          WHERE rp.performance_date >= CURRENT_DATE - INTERVAL '30 days'
          ORDER BY rp.performance_date DESC, pr.region_name
        `),

        // Regional growth trends
        query(`
          SELECT 
            pr.region_name,
            DATE_TRUNC('month', s.created_at) as month,
            COUNT(*) as new_schools,
            SUM(COUNT(*)) OVER (PARTITION BY pr.region_name ORDER BY DATE_TRUNC('month', s.created_at)) as cumulative_schools
          FROM platform_regions pr
          JOIN school_onboarding_requests sor ON pr.id = sor.region_id
          JOIN schools s ON sor.principal_email = s.email
          WHERE s.created_at >= CURRENT_DATE - INTERVAL '12 months'
          GROUP BY pr.region_name, DATE_TRUNC('month', s.created_at)
          ORDER BY pr.region_name, month
        `)
      ]);

      res.json({
        success: true,
        data: {
          regionDistribution: regionDistribution.rows,
          countryDistribution: countryDistribution.rows,
          regionalPerformance: regionalPerformance.rows,
          regionalGrowth: regionalGrowth.rows
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // =============================================================================
  // FEATURE ADOPTION ANALYTICS
  // =============================================================================

  // Get feature adoption analytics
  static async getFeatureAdoptionAnalytics(req, res, next) {
    try {
      const { schoolId, featureName } = req.query;

      let schoolFilter = '';
      let featureFilter = '';
      const params = [];

      if (schoolId) {
        schoolFilter = ` AND school_id = $${params.length + 1}`;
        params.push(schoolId);
      }

      if (featureName) {
        featureFilter = ` AND module_accessed = $${params.length + 1}`;
        params.push(featureName);
      }

      const [
        moduleAdoption,
        featureUsageOverTime,
        schoolFeatureMatrix,
        adoptionFunnels
      ] = await Promise.all([
        // Module adoption rates
        query(`
          SELECT 
            module_accessed,
            COUNT(DISTINCT school_id) as schools_using,
            COUNT(*) as total_usage,
            COUNT(DISTINCT user_id) as unique_users,
            AVG(response_time_ms) as avg_response_time,
            (COUNT(DISTINCT school_id)::float / (SELECT COUNT(*) FROM schools WHERE is_active = true) * 100) as adoption_percentage
          FROM platform_usage_logs
          WHERE module_accessed IS NOT NULL
            AND logged_at >= CURRENT_DATE - INTERVAL '30 days'
            ${featureFilter}
          GROUP BY module_accessed
          ORDER BY adoption_percentage DESC
        `, featureName ? [featureName] : []),

        // Feature usage trends over time
        query(`
          SELECT 
            DATE_TRUNC('week', logged_at) as week,
            module_accessed,
            COUNT(DISTINCT school_id) as schools_using,
            COUNT(*) as usage_count
          FROM platform_usage_logs
          WHERE module_accessed IS NOT NULL
            AND logged_at >= CURRENT_DATE - INTERVAL '12 weeks'
            ${featureFilter}
          GROUP BY DATE_TRUNC('week', logged_at), module_accessed
          ORDER BY week, module_accessed
        `, featureName ? [featureName] : []),

        // School feature adoption matrix
        query(`
          SELECT 
            s.id as school_id,
            s.name as school_name,
            sp.plan_type,
            ARRAY_AGG(DISTINCT pul.module_accessed) FILTER (WHERE pul.module_accessed IS NOT NULL) as adopted_features,
            COUNT(DISTINCT pul.module_accessed) as features_adopted,
            MAX(pul.logged_at) as last_activity
          FROM schools s
          JOIN school_subscriptions ss ON s.id = ss.school_id
          JOIN subscription_plans sp ON ss.plan_id = sp.id
          LEFT JOIN platform_usage_logs pul ON s.id = pul.school_id 
            AND pul.logged_at >= CURRENT_DATE - INTERVAL '30 days'
          WHERE s.is_active = true ${schoolFilter.replace('school_id', 's.id')}
          GROUP BY s.id, s.name, sp.plan_type
          ORDER BY features_adopted DESC
          LIMIT 50
        `, schoolId ? [schoolId] : []),

        // Feature adoption funnels
        query(`
          WITH feature_steps AS (
            SELECT 
              school_id,
              CASE 
                WHEN module_accessed = 'academic' THEN 1
                WHEN module_accessed = 'student' THEN 2
                WHEN module_accessed = 'financial' THEN 3
                WHEN module_accessed = 'communication' THEN 4
                WHEN module_accessed = 'reports' THEN 5
                ELSE 0
              END as step_order,
              module_accessed,
              MIN(logged_at) as first_used
            FROM platform_usage_logs
            WHERE module_accessed IN ('academic', 'student', 'financial', 'communication', 'reports')
              AND logged_at >= CURRENT_DATE - INTERVAL '90 days'
            GROUP BY school_id, module_accessed
          )
          SELECT 
            step_order,
            module_accessed as feature_name,
            COUNT(DISTINCT school_id) as schools_reached,
            AVG(EXTRACT(DAYS FROM first_used - (
              SELECT MIN(created_at) FROM schools WHERE id = fs.school_id
            ))) as avg_days_to_adoption
          FROM feature_steps fs
          WHERE step_order > 0
          GROUP BY step_order, module_accessed
          ORDER BY step_order
        `)
      ]);

      res.json({
        success: true,
        data: {
          moduleAdoption: moduleAdoption.rows,
          featureUsageOverTime: featureUsageOverTime.rows,
          schoolFeatureMatrix: schoolFeatureMatrix.rows,
          adoptionFunnels: adoptionFunnels.rows
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // =============================================================================
  // COMPARATIVE ANALYTICS
  // =============================================================================

  // Get comparative analytics between periods
  static async getComparativeAnalytics(req, res, next) {
    try {
      const { 
        currentPeriodStart,
        currentPeriodEnd,
        comparisonPeriodStart,
        comparisonPeriodEnd,
        metric = 'all' // 'all', 'schools', 'revenue', 'usage'
      } = req.query;

      if (!currentPeriodStart || !currentPeriodEnd || !comparisonPeriodStart || !comparisonPeriodEnd) {
        throw new ValidationError('All period dates are required for comparison');
      }

      const [currentMetrics, comparisonMetrics] = await Promise.all([
        // Current period metrics
        PlatformAnalyticsController.getPeriodMetrics(currentPeriodStart, currentPeriodEnd),
        
        // Comparison period metrics
        PlatformAnalyticsController.getPeriodMetrics(comparisonPeriodStart, comparisonPeriodEnd)
      ]);

      // Calculate percentage changes
      const calculateChange = (current, previous) => {
        if (!previous || previous === 0) return current > 0 ? 100 : 0;
        return ((current - previous) / previous * 100).toFixed(2);
      };

      const comparison = {
        schools: {
          current: currentMetrics.schools,
          previous: comparisonMetrics.schools,
          change: calculateChange(currentMetrics.schools.new_schools, comparisonMetrics.schools.new_schools)
        },
        revenue: {
          current: currentMetrics.revenue,
          previous: comparisonMetrics.revenue,
          change: calculateChange(currentMetrics.revenue.total_revenue, comparisonMetrics.revenue.total_revenue)
        },
        usage: {
          current: currentMetrics.usage,
          previous: comparisonMetrics.usage,
          change: calculateChange(currentMetrics.usage.total_activities, comparisonMetrics.usage.total_activities)
        },
        users: {
          current: currentMetrics.users,
          previous: comparisonMetrics.users,
          change: calculateChange(currentMetrics.users.new_users, comparisonMetrics.users.new_users)
        }
      };

      res.json({
        success: true,
        data: {
          currentPeriod: {
            start: currentPeriodStart,
            end: currentPeriodEnd
          },
          comparisonPeriod: {
            start: comparisonPeriodStart,
            end: comparisonPeriodEnd
          },
          comparison: comparison
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Helper method to get metrics for a specific period
  static async getPeriodMetrics(startDate, endDate) {
    const [schoolsResult, revenueResult, usageResult, usersResult] = await Promise.all([
      query(`
        SELECT 
          COUNT(*) as new_schools,
          COUNT(CASE WHEN is_active = true THEN 1 END) as active_schools
        FROM schools
        WHERE created_at BETWEEN $1 AND $2
      `, [startDate, endDate]),

      query(`
        SELECT 
          COALESCE(SUM(total_amount), 0) as total_revenue,
          COALESCE(SUM(amount_paid), 0) as collected_revenue,
          COUNT(*) as invoice_count
        FROM subscription_invoices
        WHERE invoice_date BETWEEN $1 AND $2
      `, [startDate, endDate]),

      query(`
        SELECT 
          COUNT(*) as total_activities,
          COUNT(DISTINCT school_id) as active_schools,
          COUNT(DISTINCT user_id) as active_users
        FROM platform_usage_logs
        WHERE logged_at BETWEEN $1 AND $2
      `, [startDate, endDate]),

      query(`
        SELECT 
          COUNT(*) as new_users,
          COUNT(CASE WHEN is_active = true THEN 1 END) as active_users
        FROM users
        WHERE user_type = 'school_user' AND created_at BETWEEN $1 AND $2
      `, [startDate, endDate])
    ]);

    return {
      schools: schoolsResult.rows[0],
      revenue: revenueResult.rows[0],
      usage: usageResult.rows[0],
      users: usersResult.rows[0]
    };
  }

  // =============================================================================
  // REAL-TIME METRICS
  // =============================================================================

  // Get real-time platform metrics
  static async getRealTimeMetrics(req, res, next) {
    try {
      const [
        activeUsers,
        currentLoad,
        recentActivity,
        systemHealth
      ] = await Promise.all([
        // Currently active users (last 5 minutes)
        query(`
          SELECT 
            COUNT(DISTINCT user_id) as active_users,
            COUNT(DISTINCT school_id) as active_schools,
            AVG(response_time_ms) as avg_response_time
          FROM platform_usage_logs
          WHERE logged_at >= CURRENT_TIMESTAMP - INTERVAL '5 minutes'
        `),

        // Current system load
        query(`
          SELECT 
            COUNT(*) as requests_last_minute,
            AVG(response_time_ms) as avg_response_time,
            COUNT(CASE WHEN status_code >= 400 THEN 1 END) as error_count
          FROM platform_usage_logs
          WHERE logged_at >= CURRENT_TIMESTAMP - INTERVAL '1 minute'
        `),

        // Recent activity feed
        query(`
          SELECT 
            pul.activity_type,
            pul.module_accessed,
            s.name as school_name,
            pul.logged_at,
            pul.response_time_ms,
            pul.status_code
          FROM platform_usage_logs pul
          JOIN schools s ON pul.school_id = s.id
          WHERE pul.logged_at >= CURRENT_TIMESTAMP - INTERVAL '10 minutes'
          ORDER BY pul.logged_at DESC
          LIMIT 20
        `),

        // System health indicators
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
        `)
      ]);

      res.json({
        success: true,
        data: {
          activeUsers: activeUsers.rows[0],
          currentLoad: currentLoad.rows[0],
          recentActivity: recentActivity.rows,
          systemHealth: systemHealth.rows,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // =============================================================================
  // PLATFORM FINANCE MODULE: SCHOOL FINANCE DASHBOARD
  // =============================================================================

  // Get per-school financial overview including logos and health scoring
  static async getSchoolFinanceDashboard(req, res, next) {
    try {
      const { period = '90d' } = req.query;

      const dateFilter = period === '30d' ? '30 days' :
                        period === '7d' ? '7 days' :
                        period === '90d' ? '90 days' :
                        period === '1y' ? '1 year' : '90 days';

      const [schools, mpesaStats, subscriptionOutstanding, termRevenue] = await Promise.all([
        query(`
          SELECT 
            s.id, s.name, COALESCE(s.logo_url, '') AS logo_url,
            COALESCE(SUM(p.amount), 0) AS total_payments,
            COUNT(p.*) AS payment_count
          FROM schools s
          LEFT JOIN payments p ON p.school_id = s.id 
            AND p.created_at >= CURRENT_DATE - INTERVAL '${dateFilter}'
          WHERE s.is_active = true
          GROUP BY s.id
          ORDER BY total_payments DESC
        `),
        query(`
          SELECT 
            p.school_id,
            COUNT(mt.*) AS tx_count,
            COUNT(CASE WHEN mt.result_code = '0' THEN 1 END) AS success_count,
            COUNT(CASE WHEN mt.result_code <> '0' OR mt.result_code IS NULL THEN 1 END) AS fail_count,
            SUM(p.amount) FILTER (WHERE p.channel = 'mpesa') AS mpesa_amount
          FROM payments p
          LEFT JOIN mpesa_transactions mt ON mt.payment_id = p.id
          WHERE p.created_at >= CURRENT_DATE - INTERVAL '${dateFilter}'
          GROUP BY p.school_id
        `),
        query(`
          SELECT 
            si.school_id,
            SUM(si.balance_due) AS outstanding_balance,
            AVG(CASE WHEN si.paid_at IS NOT NULL AND si.invoice_date IS NOT NULL 
                THEN EXTRACT(DAYS FROM si.paid_at - si.invoice_date) END) AS avg_days_to_pay
          FROM subscription_invoices si
          WHERE si.invoice_date >= CURRENT_DATE - INTERVAL '${dateFilter}'
          GROUP BY si.school_id
        `),
        query(`
          SELECT 
            s.id as school_id,
            t.id as term_id,
            t.name as term_name,
            SUM(p.amount) as term_revenue
          FROM schools s
          JOIN academic_terms t ON t.school_id = s.id
          LEFT JOIN payments p ON p.school_id = s.id 
            AND p.created_at BETWEEN t.start_date AND t.end_date
          WHERE s.is_active = true
          GROUP BY s.id, t.id, t.name
        `)
      ]);

      const mpesaBySchool = new Map(mpesaStats.rows.map(r => [r.school_id, r]));
      const outstandingBySchool = new Map(subscriptionOutstanding.rows.map(r => [r.school_id, r]));
      const termRevenueBySchool = termRevenue.rows.reduce((acc, r) => {
        const list = acc.get(r.school_id) || [];
        list.push({ term_id: r.term_id, term_name: r.term_name, term_revenue: Number(r.term_revenue || 0) });
        acc.set(r.school_id, list);
        return acc;
      }, new Map());

      const data = schools.rows.map(s => {
        const m = mpesaBySchool.get(s.id) || {};
        const o = outstandingBySchool.get(s.id) || {};
        const success = Number(m.success_count || 0);
        const fail = Number(m.fail_count || 0);
        const successRate = (success + fail) > 0 ? (success / (success + fail) * 100) : 0;
        const paymentConsistencyScore = isFinite(o.avg_days_to_pay) && o.avg_days_to_pay != null ? Math.max(0, 100 - Number(o.avg_days_to_pay) * 5) : 70;
        const mpesaUsageScore = successRate;
        const outstandingScore = Number(o.outstanding_balance || 0) === 0 ? 100 : Math.max(0, 100 - Math.log10(Number(o.outstanding_balance || 1)) * 20);
        const disputePenalty = 0; // placeholder (no disputes table reference available)
        const healthScore = Math.round(
          0.35 * paymentConsistencyScore +
          0.35 * mpesaUsageScore +
          0.25 * outstandingScore -
          0.05 * disputePenalty
        );

        return {
          schoolId: s.id,
          name: s.name,
          logoUrl: s.logo_url,
          totalPayments: Number(s.total_payments || 0),
          paymentCount: Number(s.payment_count || 0),
          mpesa: {
            successRate: Number(successRate.toFixed(2)),
            txCount: Number(m.tx_count || 0),
            amount: Number(m.mpesa_amount || 0),
            failedCount: Number(fail || 0)
          },
          outstanding: Number(o.outstanding_balance || 0),
          avgDaysToPay: o.avg_days_to_pay != null ? Number(o.avg_days_to_pay) : null,
          healthScore,
          termRevenue: termRevenueBySchool.get(s.id) || []
        };
      });

      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  // =============================================================================
  // PLATFORM FINANCE MODULE: M-PESA ANALYTICS
  // =============================================================================

  // Real-time M-Pesa transactions and core KPIs
  static async getMpesaOverview(req, res, next) {
    try {
      const { period = '24h' } = req.query;
      const dateFilter = period === '24h' ? '24 hours' : period === '7d' ? '7 days' : '24 hours';

      const [recent, rates, valueDist, peakTimes] = await Promise.all([
        query(`
          SELECT 
            p.id as payment_id,
            p.school_id,
            s.name as school_name,
            p.amount,
            p.status,
            p.created_at,
            mt.result_code,
            mt.result_desc as reason
          FROM payments p
          JOIN schools s ON p.school_id = s.id
          LEFT JOIN mpesa_transactions mt ON mt.payment_id = p.id
          WHERE p.channel = 'mpesa' 
            AND p.created_at >= CURRENT_TIMESTAMP - INTERVAL '${dateFilter}'
          ORDER BY p.created_at DESC
          LIMIT 200
        `),
        query(`
          SELECT 
            COUNT(*) as total,
            COUNT(CASE WHEN mt.result_code = '0' THEN 1 END) as success,
            COUNT(CASE WHEN mt.result_code <> '0' OR mt.result_code IS NULL THEN 1 END) as failed
          FROM payments p
          LEFT JOIN mpesa_transactions mt ON mt.payment_id = p.id
          WHERE p.channel = 'mpesa'
            AND p.created_at >= CURRENT_TIMESTAMP - INTERVAL '${dateFilter}'
        `),
        query(`
          SELECT 
            CASE 
              WHEN p.amount < 500 THEN '<500'
              WHEN p.amount < 2000 THEN '500-1999'
              WHEN p.amount < 5000 THEN '2000-4999'
              WHEN p.amount < 10000 THEN '5000-9999'
              ELSE '10000+'
            END AS bucket,
            COUNT(*) as count,
            SUM(p.amount) as total
          FROM payments p
          WHERE p.channel = 'mpesa'
            AND p.created_at >= CURRENT_TIMESTAMP - INTERVAL '${dateFilter}'
          GROUP BY bucket
          ORDER BY 
            CASE bucket 
              WHEN '<500' THEN 1
              WHEN '500-1999' THEN 2
              WHEN '2000-4999' THEN 3
              WHEN '5000-9999' THEN 4
              ELSE 5 END
        `),
        query(`
          SELECT 
            EXTRACT(HOUR FROM p.created_at) as hour,
            COUNT(*) as tx_count,
            SUM(p.amount) as total_amount
          FROM payments p
          WHERE p.channel = 'mpesa'
            AND p.created_at >= CURRENT_TIMESTAMP - INTERVAL '${dateFilter}'
          GROUP BY EXTRACT(HOUR FROM p.created_at)
          ORDER BY hour
        `)
      ]);

      res.json({
        success: true,
        data: {
          recentTransactions: recent.rows,
          rates: rates.rows[0],
          valueDistribution: valueDist.rows,
          peakTimes: peakTimes.rows
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // School M-Pesa performance and configuration status
  static async getMpesaPerformance(req, res, next) {
    try {
      // Configuration is global in this codebase; approximate per-school status by activity
      const [activity, avgValues, methodPrefs] = await Promise.all([
        query(`
          SELECT 
            s.id as school_id,
            s.name as school_name,
            COUNT(p.*) FILTER (WHERE p.channel = 'mpesa') as mpesa_tx,
            COUNT(p.*) as all_tx,
            COUNT(mt.*) FILTER (WHERE mt.result_code = '0') as success_tx,
            COUNT(mt.*) FILTER (WHERE mt.result_code <> '0' OR mt.result_code IS NULL) as failed_tx
          FROM schools s
          LEFT JOIN payments p ON p.school_id = s.id 
            AND p.created_at >= CURRENT_DATE - INTERVAL '90 days'
          LEFT JOIN mpesa_transactions mt ON mt.payment_id = p.id
          GROUP BY s.id, s.name
          ORDER BY mpesa_tx DESC
        `),
        query(`
          SELECT 
            p.school_id,
            AVG(CASE WHEN p.channel = 'mpesa' THEN p.amount END) as avg_mpesa_amount
          FROM payments p
          WHERE p.created_at >= CURRENT_DATE - INTERVAL '90 days'
          GROUP BY p.school_id
        `),
        query(`
          SELECT 
            p.school_id,
            p.channel,
            COUNT(*) as count
          FROM payments p
          WHERE p.created_at >= CURRENT_DATE - INTERVAL '90 days'
          GROUP BY p.school_id, p.channel
        `)
      ]);

      const avgBySchool = new Map(avgValues.rows.map(r => [r.school_id, r.avg_mpesa_amount]));
      const methodBySchool = methodPrefs.rows.reduce((acc, r) => {
        const list = acc.get(r.school_id) || [];
        list.push({ method: r.channel, count: Number(r.count || 0) });
        acc.set(r.school_id, list);
        return acc;
      }, new Map());

      const MPESA_ENV = process.env.MPESA_ENVIRONMENT || 'sandbox';
      const data = activity.rows.map(r => {
        const mpesaConfigured = Number(r.mpesa_tx || 0) > 0;
        const configStatus = mpesaConfigured ? (MPESA_ENV === 'production' ? 'Live' : 'Sandbox') : 'Not Configured';
        const total = Number(r.mpesa_tx || 0) + Number(r.failed_tx || 0);
        const successRate = (Number(r.success_tx || 0) + Number(r.failed_tx || 0)) > 0
          ? (Number(r.success_tx || 0) / (Number(r.success_tx || 0) + Number(r.failed_tx || 0)) * 100)
          : 0;
        return {
          schoolId: r.school_id,
          schoolName: r.school_name,
          configStatus,
          transactionVolume90d: Number(r.mpesa_tx || 0),
          successRate: Number(successRate.toFixed(2)),
          averageTransactionValue: avgBySchool.get(r.school_id) || 0,
          paymentMethodPreferences: methodBySchool.get(r.school_id) || []
        };
      });

      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  // Reconciliation dashboard
  static async getMpesaReconciliation(req, res, next) {
    try {
      const [autoMatch, unreconciled, discrepancies] = await Promise.all([
        query(`
          SELECT 
            COUNT(*) FILTER (WHERE status = 'reconciled') as reconciled,
            COUNT(*) FILTER (WHERE status = 'pending') as pending,
            COUNT(*) FILTER (WHERE status = 'failed') as failed
          FROM payments
          WHERE channel = 'mpesa'
            AND created_at >= CURRENT_DATE - INTERVAL '30 days'
        `),
        query(`
          SELECT 
            p.id, p.school_id, s.name as school_name, p.amount, p.created_at
          FROM payments p
          JOIN schools s ON p.school_id = s.id
          WHERE p.channel = 'mpesa' AND p.status IN ('pending','failed')
          ORDER BY p.created_at DESC
          LIMIT 100
        `),
        query(`
          SELECT 
            mt.id as mpesa_tx_id,
            p.id as payment_id,
            mt.result_code,
            mt.result_desc,
            p.amount,
            p.created_at
          FROM mpesa_transactions mt
          JOIN payments p ON mt.payment_id = p.id
          WHERE (mt.result_code <> '0' OR mt.result_code IS NULL)
            AND p.created_at >= CURRENT_DATE - INTERVAL '30 days'
          ORDER BY p.created_at DESC
          LIMIT 100
        `)
      ]);

      res.json({
        success: true,
        data: {
          automatedMatching: autoMatch.rows[0],
          unreconciledTransactions: unreconciled.rows,
          discrepancyAlerts: discrepancies.rows
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // =============================================================================
  // PLATFORM FINANCE MODULE: SEGMENTS & COLLECTIONS
  // =============================================================================

  // Financial analytics by school segments and cohorts
  static async getFinanceSegments(req, res, next) {
    try {
      const [byType, termPatterns, cohorts, mpesaAdoption] = await Promise.all([
        query(`
          SELECT 
            s.school_type, -- e.g., 'day', 'boarding', 'private', 'public' combined text or enum
            COUNT(DISTINCT s.id) as schools,
            SUM(si.total_amount) as total_revenue,
            AVG(si.total_amount) as avg_invoice
          FROM schools s
          JOIN subscription_invoices si ON s.id = si.school_id
          GROUP BY s.school_type
        `),
        query(`
          SELECT 
            t.name as term_name,
            DATE_TRUNC('quarter', si.invoice_date) as quarter,
            SUM(si.total_amount) as total_revenue,
            SUM(si.amount_paid) as collected_revenue
          FROM academic_terms t
          JOIN schools s ON t.school_id = s.id
          LEFT JOIN subscription_invoices si ON si.school_id = s.id 
            AND si.invoice_date BETWEEN t.start_date AND t.end_date
          GROUP BY t.name, DATE_TRUNC('quarter', si.invoice_date)
          ORDER BY quarter
        `),
        query(`
          SELECT 
            DATE_TRUNC('month', s.created_at) as cohort_month,
            COUNT(*) as schools_registered,
            SUM(si.total_amount) as revenue
          FROM schools s
          LEFT JOIN subscription_invoices si ON si.school_id = s.id
          GROUP BY DATE_TRUNC('month', s.created_at)
          ORDER BY cohort_month
        `),
        query(`
          SELECT 
            s.id as school_id,
            s.name as school_name,
            COUNT(p.*) FILTER (WHERE p.channel = 'mpesa') as mpesa_payments,
            COUNT(p.*) as total_payments,
            (COUNT(p.*) FILTER (WHERE p.channel = 'mpesa')::float / NULLIF(COUNT(p.*), 0)) * 100 as mpesa_usage_rate
          FROM schools s
          LEFT JOIN payments p ON p.school_id = s.id
          GROUP BY s.id, s.name
          ORDER BY mpesa_usage_rate DESC NULLS LAST
        `)
      ]);

      res.json({
        success: true,
        data: {
          revenueBySchoolType: byType.rows,
          termRevenuePatterns: termPatterns.rows,
          schoolCohorts: cohorts.rows,
          mpesaAdoption: mpesaAdoption.rows
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Collections & credit management overview
  static async getCollectionsOverview(req, res, next) {
    try {
      const [overdue, paymentPlans, suspensions, badDebt] = await Promise.all([
        query(`
          SELECT 
            si.school_id,
            s.name as school_name,
            COUNT(*) as overdue_invoices,
            SUM(si.balance_due) as overdue_amount,
            MIN(si.due_date) as oldest_due
          FROM subscription_invoices si
          JOIN schools s ON si.school_id = s.id
          WHERE si.due_date < CURRENT_DATE AND si.status != 'paid'
          GROUP BY si.school_id, s.name
          ORDER BY overdue_amount DESC
        `),
        query(`
          SELECT 
            p.school_id,
            COUNT(*) as active_payment_plans
          FROM payment_plans p
          WHERE p.status = 'active'
          GROUP BY p.school_id
        `).catch(() => ({ rows: [] })),
        query(`
          SELECT 
            s.id as school_id,
            s.name as school_name,
            CASE WHEN ss.subscription_status = 'suspended' THEN 1 ELSE 0 END as is_suspended
          FROM schools s
          LEFT JOIN school_subscriptions ss ON s.id = ss.school_id
        `),
        query(`
          SELECT 
            si.school_id,
            SUM(si.balance_due) FILTER (WHERE si.status = 'written_off') as written_off_amount
          FROM subscription_invoices si
          GROUP BY si.school_id
        `).catch(() => ({ rows: [] }))
      ]);

      const plansBySchool = new Map(paymentPlans.rows.map(r => [r.school_id, r.active_payment_plans]));
      const suspendedBySchool = new Map(suspensions.rows.map(r => [r.school_id, r.is_suspended]));
      const writtenOffBySchool = new Map(badDebt.rows.map(r => [r.school_id, r.written_off_amount]));

      const items = overdue.rows.map(r => ({
        schoolId: r.school_id,
        schoolName: r.school_name,
        overdueInvoices: Number(r.overdue_invoices || 0),
        overdueAmount: Number(r.overdue_amount || 0),
        oldestDue: r.oldest_due,
        activePaymentPlans: plansBySchool.get(r.school_id) || 0,
        isSuspended: suspendedBySchool.get(r.school_id) === 1,
        writtenOffAmount: Number(writtenOffBySchool.get(r.school_id) || 0)
      }));

      res.json({ success: true, data: { collections: items } });
    } catch (error) {
      next(error);
    }
  }

  // Customer lifetime value by school category
  static async getClvByCategory(req, res, next) {
    try {
      const result = await query(`
        SELECT 
          s.school_type,
          AVG(
            CASE 
              WHEN ss.cancelled_at IS NOT NULL THEN EXTRACT(DAYS FROM ss.cancelled_at - ss.start_date) / 30.0
              ELSE EXTRACT(DAYS FROM CURRENT_DATE - ss.start_date) / 30.0
            END
          ) AS avg_lifetime_months,
          AVG(ss.monthly_cost) AS avg_monthly_cost,
          (AVG(ss.monthly_cost) * AVG(
            CASE 
              WHEN ss.cancelled_at IS NOT NULL THEN EXTRACT(DAYS FROM ss.cancelled_at - ss.start_date) / 30.0
              ELSE EXTRACT(DAYS FROM CURRENT_DATE - ss.start_date) / 30.0
            END
          )) AS clv
        FROM school_subscriptions ss
        JOIN schools s ON ss.school_id = s.id
        WHERE ss.subscription_status IN ('active','trial','suspended','cancelled')
        GROUP BY s.school_type
        ORDER BY clv DESC NULLS LAST
      `);
      res.json({ success: true, data: result.rows });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = PlatformAnalyticsController;