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
}

module.exports = PlatformAnalyticsController;