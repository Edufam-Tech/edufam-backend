const { query } = require('../config/database');
const { ValidationError, NotFoundError } = require('../middleware/errorHandler');

/**
 * Cloud Optimization Service
 * Handles Redis caching, CDN integration, cloud storage, and performance optimization
 */
class CloudOptimizationService {

  /**
   * Cache Configuration Management
   */
  async getCacheConfigurations({ includeInactive = false } = {}) {
    let whereClause = '';
    const params = [];

    if (!includeInactive) {
      whereClause = 'WHERE is_active = true';
    }

    const result = await query(`
      SELECT 
        cc.*,
        (SELECT COUNT(*) FROM cache_policies cp WHERE cp.cache_config_id = cc.id) as policy_count,
        (SELECT COUNT(*) FROM cache_performance_logs cpl WHERE cpl.cache_config_id = cc.id AND cpl.created_at > NOW() - INTERVAL '24 hours') as daily_operations
      FROM cache_configurations cc
      ${whereClause}
      ORDER BY cc.cache_type, cc.cache_name
    `, params);

    return result.rows;
  }

  async createCacheConfiguration({
    cacheType,
    cacheName,
    description,
    connectionConfig,
    poolSettings,
    defaultTtl = 3600,
    maxMemoryMb,
    evictionPolicy = 'allkeys-lru',
    compressionEnabled = true,
    compressionAlgorithm = 'gzip',
    pipelineEnabled = true,
    clusteringEnabled = false,
    monitoringEnabled = true,
    metricsRetentionDays = 30,
    alertThresholds,
    environment = 'production',
    region,
    availabilityZone
  }) {
    const result = await query(`
      INSERT INTO cache_configurations (
        cache_type, cache_name, description, connection_config, pool_settings,
        default_ttl, max_memory_mb, eviction_policy, compression_enabled,
        compression_algorithm, pipeline_enabled, clustering_enabled,
        monitoring_enabled, metrics_retention_days, alert_thresholds,
        environment, region, availability_zone
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      RETURNING *
    `, [
      cacheType, cacheName, description,
      JSON.stringify(connectionConfig),
      poolSettings ? JSON.stringify(poolSettings) : null,
      defaultTtl, maxMemoryMb, evictionPolicy, compressionEnabled,
      compressionAlgorithm, pipelineEnabled, clusteringEnabled,
      monitoringEnabled, metricsRetentionDays,
      alertThresholds ? JSON.stringify(alertThresholds) : null,
      environment, region, availabilityZone
    ]);

    return result.rows[0];
  }

  /**
   * Cache Policy Management
   */
  async getCachePolicies({ cacheConfigId, strategy } = {}) {
    let whereConditions = [];
    let params = [];
    let paramCount = 0;

    if (cacheConfigId) {
      whereConditions.push(`cp.cache_config_id = $${++paramCount}`);
      params.push(cacheConfigId);
    }

    if (strategy) {
      whereConditions.push(`cp.strategy = $${++paramCount}`);
      params.push(strategy);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const result = await query(`
      SELECT 
        cp.*,
        cc.cache_name,
        cc.cache_type,
        (SELECT AVG(execution_time_ms) FROM cache_performance_logs cpl 
         WHERE cpl.policy_id = cp.id AND cpl.created_at > NOW() - INTERVAL '1 hour') as avg_response_time,
        (SELECT COUNT(*) FILTER (WHERE result_status = 'hit') * 100.0 / COUNT(*) 
         FROM cache_performance_logs cpl 
         WHERE cpl.policy_id = cp.id AND cpl.created_at > NOW() - INTERVAL '24 hours') as hit_rate_24h
      FROM cache_policies cp
      JOIN cache_configurations cc ON cp.cache_config_id = cc.id
      ${whereClause}
      ORDER BY cp.policy_name
    `, params);

    return result.rows;
  }

  async createCachePolicy({
    policyName,
    cacheConfigId,
    description,
    strategy,
    cachePattern = 'key_value',
    keyPattern,
    namespace,
    keyPrefix,
    ttlSeconds,
    slidingExpiration = false,
    absoluteExpiration,
    invalidationEvents,
    invalidationPatterns,
    dependencyKeys,
    preloadEnabled = false,
    backgroundRefresh = false,
    compressionThreshold = 1024,
    encryptionEnabled = false,
    accessRoles,
    rateLimitPerMinute,
    hitRateThreshold = 0.8,
    performanceTracking = true
  }) {
    const result = await query(`
      INSERT INTO cache_policies (
        policy_name, cache_config_id, description, strategy, cache_pattern,
        key_pattern, namespace, key_prefix, ttl_seconds, sliding_expiration,
        absolute_expiration, invalidation_events, invalidation_patterns,
        dependency_keys, preload_enabled, background_refresh,
        compression_threshold, encryption_enabled, access_roles,
        rate_limit_per_minute, hit_rate_threshold, performance_tracking
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
      RETURNING *
    `, [
      policyName, cacheConfigId, description, strategy, cachePattern,
      keyPattern, namespace, keyPrefix, ttlSeconds, slidingExpiration,
      absoluteExpiration, invalidationEvents, invalidationPatterns,
      dependencyKeys, preloadEnabled, backgroundRefresh,
      compressionThreshold, encryptionEnabled, accessRoles,
      rateLimitPerMinute, hitRateThreshold, performanceTracking
    ]);

    return result.rows[0];
  }

  /**
   * CDN Configuration Management
   */
  async getCdnConfigurations({ includeInactive = false } = {}) {
    let whereClause = '';
    const params = [];

    if (!includeInactive) {
      whereClause = 'WHERE is_active = true';
    }

    const result = await query(`
      SELECT 
        cdn.*,
        (SELECT COUNT(*) FROM cdn_analytics ca WHERE ca.cdn_config_id = cdn.id AND ca.request_timestamp > NOW() - INTERVAL '24 hours') as daily_requests,
        (SELECT AVG(response_time_ms) FROM cdn_analytics ca WHERE ca.cdn_config_id = cdn.id AND ca.request_timestamp > NOW() - INTERVAL '1 hour') as avg_response_time
      FROM cdn_configurations cdn
      ${whereClause}
      ORDER BY cdn.cdn_provider, cdn.cdn_name
    `, params);

    return result.rows;
  }

  async createCdnConfiguration({
    cdnProvider,
    cdnName,
    description,
    originDomain,
    cdnDomain,
    sslEnabled = true,
    sslCertificateConfig,
    defaultCacheTtl = 86400,
    browserCacheTtl = 3600,
    cacheControlHeaders,
    edgeLocations,
    geoRestrictions,
    compressionEnabled = true,
    compressionTypes = ['text/html', 'text/css', 'text/javascript', 'application/json'],
    minificationEnabled = true,
    http2Enabled = true,
    ddosProtection = true,
    wafEnabled = true,
    hotlinkProtection = false,
    secureHeaders,
    staticContentPatterns = ['*.css', '*.js', '*.png', '*.jpg', '*.jpeg', '*.gif', '*.svg', '*.ico', '*.woff', '*.woff2'],
    dynamicContentPatterns,
    bypassPatterns,
    apiCredentials,
    webhookUrl,
    analyticsEnabled = true,
    realUserMonitoring = true,
    syntheticMonitoring = false
  }) {
    const result = await query(`
      INSERT INTO cdn_configurations (
        cdn_provider, cdn_name, description, origin_domain, cdn_domain,
        ssl_enabled, ssl_certificate_config, default_cache_ttl, browser_cache_ttl,
        cache_control_headers, edge_locations, geo_restrictions,
        compression_enabled, compression_types, minification_enabled,
        http2_enabled, ddos_protection, waf_enabled, hotlink_protection,
        secure_headers, static_content_patterns, dynamic_content_patterns,
        bypass_patterns, api_credentials, webhook_url, analytics_enabled,
        real_user_monitoring, synthetic_monitoring
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28)
      RETURNING *
    `, [
      cdnProvider, cdnName, description, originDomain, cdnDomain,
      sslEnabled, sslCertificateConfig ? JSON.stringify(sslCertificateConfig) : null,
      defaultCacheTtl, browserCacheTtl,
      cacheControlHeaders ? JSON.stringify(cacheControlHeaders) : null,
      edgeLocations, geoRestrictions ? JSON.stringify(geoRestrictions) : null,
      compressionEnabled, compressionTypes, minificationEnabled,
      http2Enabled, ddosProtection, wafEnabled, hotlinkProtection,
      secureHeaders ? JSON.stringify(secureHeaders) : null,
      staticContentPatterns, dynamicContentPatterns, bypassPatterns,
      apiCredentials ? JSON.stringify(apiCredentials) : null,
      webhookUrl, analyticsEnabled, realUserMonitoring, syntheticMonitoring
    ]);

    return result.rows[0];
  }

  /**
   * Cloud Storage Management
   */
  async getCloudStorageConfigurations({ includeInactive = false } = {}) {
    let whereClause = '';
    const params = [];

    if (!includeInactive) {
      whereClause = 'WHERE is_active = true';
    }

    const result = await query(`
      SELECT 
        cs.*,
        cdn.cdn_name,
        cdn.cdn_domain
      FROM cloud_storage_configurations cs
      LEFT JOIN cdn_configurations cdn ON cs.cdn_integration_id = cdn.id
      ${whereClause}
      ORDER BY cs.provider, cs.storage_name
    `, params);

    return result.rows;
  }

  async createCloudStorageConfiguration({
    provider,
    storageName,
    description,
    bucketName,
    region,
    endpoint,
    accessCredentials,
    publicAccessEnabled = false,
    signedUrlsEnabled = true,
    signedUrlExpiryHours = 24,
    defaultStorageClass = 'standard',
    lifecyclePolicies,
    versioningEnabled = false,
    encryptionEnabled = true,
    encryptionAlgorithm = 'AES256',
    kmsKeyId,
    cdnIntegrationId,
    customDomain,
    corsConfiguration,
    allowedFileTypes,
    maxFileSizeMb = 100,
    virusScanningEnabled = false,
    backupEnabled = true,
    replicationRegions,
    crossRegionReplication = false,
    intelligentTiering = false,
    dataTransferOptimization = true
  }) {
    const result = await query(`
      INSERT INTO cloud_storage_configurations (
        provider, storage_name, description, bucket_name, region, endpoint,
        access_credentials, public_access_enabled, signed_urls_enabled,
        signed_url_expiry_hours, default_storage_class, lifecycle_policies,
        versioning_enabled, encryption_enabled, encryption_algorithm,
        kms_key_id, cdn_integration_id, custom_domain, cors_configuration,
        allowed_file_types, max_file_size_mb, virus_scanning_enabled,
        backup_enabled, replication_regions, cross_region_replication,
        intelligent_tiering, data_transfer_optimization
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27)
      RETURNING *
    `, [
      provider, storageName, description, bucketName, region, endpoint,
      JSON.stringify(accessCredentials), publicAccessEnabled, signedUrlsEnabled,
      signedUrlExpiryHours, defaultStorageClass,
      lifecyclePolicies ? JSON.stringify(lifecyclePolicies) : null,
      versioningEnabled, encryptionEnabled, encryptionAlgorithm,
      kmsKeyId, cdnIntegrationId, customDomain,
      corsConfiguration ? JSON.stringify(corsConfiguration) : null,
      allowedFileTypes, maxFileSizeMb, virusScanningEnabled,
      backupEnabled, replicationRegions, crossRegionReplication,
      intelligentTiering, dataTransferOptimization
    ]);

    return result.rows[0];
  }

  /**
   * Performance Monitoring
   */
  async recordPerformanceMetric({
    metricType,
    serviceType,
    serviceId,
    metricValue,
    metricUnit,
    endpoint,
    region,
    userAgentCategory,
    requestSource,
    cacheStatus,
    responseSizeBytes,
    processingTimeMs,
    networkLatencyMs,
    tags,
    traceId
  }) {
    const result = await query(`
      INSERT INTO performance_metrics (
        metric_type, service_type, service_id, metric_value, metric_unit,
        endpoint, region, user_agent_category, request_source, cache_status,
        response_size_bytes, processing_time_ms, network_latency_ms,
        tags, trace_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *
    `, [
      metricType, serviceType, serviceId, metricValue, metricUnit,
      endpoint, region, userAgentCategory, requestSource, cacheStatus,
      responseSizeBytes, processingTimeMs, networkLatencyMs,
      tags ? JSON.stringify(tags) : null, traceId
    ]);

    return result.rows[0];
  }

  async getPerformanceMetrics({
    metricType,
    serviceType,
    serviceId,
    startTime,
    endTime,
    aggregation = 'avg',
    groupBy = 'hour'
  } = {}) {
    let whereConditions = [];
    let params = [];
    let paramCount = 0;

    if (metricType) {
      whereConditions.push(`metric_type = $${++paramCount}`);
      params.push(metricType);
    }

    if (serviceType) {
      whereConditions.push(`service_type = $${++paramCount}`);
      params.push(serviceType);
    }

    if (serviceId) {
      whereConditions.push(`service_id = $${++paramCount}`);
      params.push(serviceId);
    }

    if (startTime) {
      whereConditions.push(`metric_timestamp >= $${++paramCount}`);
      params.push(startTime);
    }

    if (endTime) {
      whereConditions.push(`metric_timestamp <= $${++paramCount}`);
      params.push(endTime);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const groupByClause = groupBy === 'day' ? 'date_day' : 'date_hour';
    const aggregationFunc = ['avg', 'sum', 'min', 'max', 'count'].includes(aggregation) ? aggregation : 'avg';

    const result = await query(`
      SELECT 
        ${groupByClause} as time_period,
        metric_type,
        service_type,
        ${aggregationFunc}(metric_value) as metric_value,
        COUNT(*) as sample_count
      FROM performance_metrics
      ${whereClause}
      GROUP BY ${groupByClause}, metric_type, service_type
      ORDER BY time_period DESC
      LIMIT 1000
    `, params);

    return result.rows;
  }

  /**
   * Cache Performance Tracking
   */
  async logCacheOperation({
    cacheConfigId,
    policyId,
    operationType,
    cacheKey,
    executionTimeMs,
    resultStatus,
    dataSizeBytes,
    callingService,
    endpoint,
    userContext,
    errorCode,
    errorMessage,
    retryCount = 0,
    compressionRatio,
    serializationTimeMs,
    networkTimeMs
  }) {
    const result = await query(`
      INSERT INTO cache_performance_logs (
        cache_config_id, policy_id, operation_type, cache_key,
        execution_time_ms, result_status, data_size_bytes, calling_service,
        endpoint, user_context, error_code, error_message, retry_count,
        compression_ratio, serialization_time_ms, network_time_ms
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *
    `, [
      cacheConfigId, policyId, operationType, cacheKey,
      executionTimeMs, resultStatus, dataSizeBytes, callingService,
      endpoint, userContext ? JSON.stringify(userContext) : null,
      errorCode, errorMessage, retryCount,
      compressionRatio, serializationTimeMs, networkTimeMs
    ]);

    return result.rows[0];
  }

  async getCachePerformanceAnalytics({
    cacheConfigId,
    startTime,
    endTime,
    operationType
  } = {}) {
    let whereConditions = ['1=1'];
    let params = [];
    let paramCount = 0;

    if (cacheConfigId) {
      whereConditions.push(`cache_config_id = $${++paramCount}`);
      params.push(cacheConfigId);
    }

    if (startTime) {
      whereConditions.push(`operation_timestamp >= $${++paramCount}`);
      params.push(startTime);
    }

    if (endTime) {
      whereConditions.push(`operation_timestamp <= $${++paramCount}`);
      params.push(endTime);
    }

    if (operationType) {
      whereConditions.push(`operation_type = $${++paramCount}`);
      params.push(operationType);
    }

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

    const result = await query(`
      SELECT 
        operation_type,
        result_status,
        COUNT(*) as operation_count,
        AVG(execution_time_ms) as avg_execution_time,
        MIN(execution_time_ms) as min_execution_time,
        MAX(execution_time_ms) as max_execution_time,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY execution_time_ms) as p95_execution_time,
        AVG(data_size_bytes) as avg_data_size,
        SUM(data_size_bytes) as total_data_size,
        AVG(compression_ratio) as avg_compression_ratio,
        COUNT(*) FILTER (WHERE result_status = 'hit') * 100.0 / COUNT(*) as hit_rate
      FROM cache_performance_logs
      ${whereClause}
      GROUP BY operation_type, result_status
      ORDER BY operation_type, result_status
    `, params);

    return result.rows;
  }

  /**
   * CDN Analytics
   */
  async logCdnRequest({
    cdnConfigId,
    requestUrl,
    requestMethod = 'GET',
    responseStatus,
    responseSizeBytes,
    responseTimeMs,
    cacheStatus,
    edgeLocation,
    originResponseTimeMs,
    clientIp,
    clientCountry,
    clientRegion,
    userAgent,
    referer,
    contentType,
    contentEncoding,
    securityEvents,
    compressionRatio,
    bandwidthSavedBytes
  }) {
    const result = await query(`
      INSERT INTO cdn_analytics (
        cdn_config_id, request_url, request_method, response_status,
        response_size_bytes, response_time_ms, cache_status, edge_location,
        origin_response_time_ms, client_ip, client_country, client_region,
        user_agent, referer, content_type, content_encoding,
        security_events, compression_ratio, bandwidth_saved_bytes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      RETURNING *
    `, [
      cdnConfigId, requestUrl, requestMethod, responseStatus,
      responseSizeBytes, responseTimeMs, cacheStatus, edgeLocation,
      originResponseTimeMs, clientIp, clientCountry, clientRegion,
      userAgent, referer, contentType, contentEncoding,
      securityEvents ? JSON.stringify(securityEvents) : null,
      compressionRatio, bandwidthSavedBytes
    ]);

    return result.rows[0];
  }

  async getCdnAnalytics({
    cdnConfigId,
    startTime,
    endTime,
    aggregation = 'hour'
  } = {}) {
    let whereConditions = ['1=1'];
    let params = [];
    let paramCount = 0;

    if (cdnConfigId) {
      whereConditions.push(`cdn_config_id = $${++paramCount}`);
      params.push(cdnConfigId);
    }

    if (startTime) {
      whereConditions.push(`request_timestamp >= $${++paramCount}`);
      params.push(startTime);
    }

    if (endTime) {
      whereConditions.push(`request_timestamp <= $${++paramCount}`);
      params.push(endTime);
    }

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

    const timeTrunc = aggregation === 'day' ? 'day' : 'hour';

    const result = await query(`
      SELECT 
        DATE_TRUNC($${++paramCount}, request_timestamp) as time_period,
        cache_status,
        COUNT(*) as request_count,
        AVG(response_time_ms) as avg_response_time,
        SUM(response_size_bytes) as total_bytes,
        SUM(bandwidth_saved_bytes) as total_bandwidth_saved,
        AVG(compression_ratio) as avg_compression_ratio,
        COUNT(DISTINCT client_country) as unique_countries,
        COUNT(DISTINCT edge_location) as unique_edge_locations
      FROM cdn_analytics
      ${whereClause}
      GROUP BY time_period, cache_status
      ORDER BY time_period DESC, cache_status
      LIMIT 1000
    `, [...params, timeTrunc]);

    return result.rows;
  }

  /**
   * Optimization Rules Management
   */
  async createOptimizationRule({
    ruleName,
    ruleType,
    description,
    ruleConfig,
    triggerConditions,
    executionSchedule,
    targetServices,
    environmentFilter,
    regionFilter,
    executionTimeoutMinutes = 30,
    maxConcurrentExecutions = 1,
    retryPolicy,
    expectedImpact,
    successMetrics,
    rollbackEnabled = true,
    createdBy
  }) {
    const result = await query(`
      INSERT INTO optimization_rules (
        rule_name, rule_type, description, rule_config, trigger_conditions,
        execution_schedule, target_services, environment_filter, region_filter,
        execution_timeout_minutes, max_concurrent_executions, retry_policy,
        expected_impact, success_metrics, rollback_enabled, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *
    `, [
      ruleName, ruleType, description,
      JSON.stringify(ruleConfig),
      JSON.stringify(triggerConditions),
      executionSchedule, targetServices, environmentFilter, regionFilter,
      executionTimeoutMinutes, maxConcurrentExecutions,
      retryPolicy ? JSON.stringify(retryPolicy) : null,
      expectedImpact ? JSON.stringify(expectedImpact) : null,
      successMetrics, rollbackEnabled, createdBy
    ]);

    return result.rows[0];
  }

  /**
   * Cloud Cost Tracking
   */
  async recordCloudCost({
    serviceType,
    serviceId,
    serviceName,
    billingPeriodStart,
    billingPeriodEnd,
    costAmount,
    currency = 'USD',
    usageQuantity,
    usageUnit,
    tierOrPlan,
    baseCost,
    usageCost,
    additionalFees,
    discountsApplied,
    taxAmount,
    region,
    availabilityZone,
    optimizationSuggestions,
    potentialSavings,
    provider,
    accountId,
    resourceTags
  }) {
    const result = await query(`
      INSERT INTO cloud_cost_tracking (
        service_type, service_id, service_name, billing_period_start,
        billing_period_end, cost_amount, currency, usage_quantity,
        usage_unit, tier_or_plan, base_cost, usage_cost, additional_fees,
        discounts_applied, tax_amount, region, availability_zone,
        optimization_suggestions, potential_savings, provider, account_id,
        resource_tags
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
      RETURNING *
    `, [
      serviceType, serviceId, serviceName, billingPeriodStart,
      billingPeriodEnd, costAmount, currency, usageQuantity,
      usageUnit, tierOrPlan, baseCost, usageCost, additionalFees,
      discountsApplied, taxAmount, region, availabilityZone,
      optimizationSuggestions ? JSON.stringify(optimizationSuggestions) : null,
      potentialSavings, provider, accountId,
      resourceTags ? JSON.stringify(resourceTags) : null
    ]);

    return result.rows[0];
  }

  async getCloudCostAnalytics({
    serviceType,
    startDate,
    endDate,
    groupBy = 'service_type'
  } = {}) {
    let whereConditions = ['1=1'];
    let params = [];
    let paramCount = 0;

    if (serviceType) {
      whereConditions.push(`service_type = $${++paramCount}`);
      params.push(serviceType);
    }

    if (startDate) {
      whereConditions.push(`billing_period_start >= $${++paramCount}`);
      params.push(startDate);
    }

    if (endDate) {
      whereConditions.push(`billing_period_end <= $${++paramCount}`);
      params.push(endDate);
    }

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

    const groupByClause = ['service_type', 'region', 'provider'].includes(groupBy) ? groupBy : 'service_type';

    const result = await query(`
      SELECT 
        ${groupByClause},
        SUM(cost_amount) as total_cost,
        AVG(cost_amount) as avg_cost,
        SUM(usage_quantity) as total_usage,
        SUM(potential_savings) as total_potential_savings,
        COUNT(*) as billing_periods,
        MAX(billing_period_end) as latest_period
      FROM cloud_cost_tracking
      ${whereClause}
      GROUP BY ${groupByClause}
      ORDER BY total_cost DESC
    `, params);

    return result.rows;
  }

  /**
   * System Health Monitoring
   */
  async recordHealthCheck({
    checkType,
    serviceType,
    serviceId,
    checkStatus,
    responseTimeMs,
    availabilityPercentage,
    errorRatePercentage,
    throughputPerSecond,
    warningThreshold,
    criticalThreshold,
    alertTriggered = false,
    alertMessage,
    checkDetails,
    remediationSuggestions
  }) {
    const result = await query(`
      INSERT INTO system_health_checks (
        check_type, service_type, service_id, check_status, response_time_ms,
        availability_percentage, error_rate_percentage, throughput_per_second,
        warning_threshold, critical_threshold, alert_triggered, alert_message,
        check_details, remediation_suggestions
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `, [
      checkType, serviceType, serviceId, checkStatus, responseTimeMs,
      availabilityPercentage, errorRatePercentage, throughputPerSecond,
      warningThreshold, criticalThreshold, alertTriggered, alertMessage,
      checkDetails ? JSON.stringify(checkDetails) : null,
      remediationSuggestions
    ]);

    return result.rows[0];
  }

  async getSystemHealthStatus({
    serviceType,
    checkType,
    timeWindow = '1 hour'
  } = {}) {
    let whereConditions = [`check_timestamp > NOW() - INTERVAL '${timeWindow}'`];
    let params = [];
    let paramCount = 0;

    if (serviceType) {
      whereConditions.push(`service_type = $${++paramCount}`);
      params.push(serviceType);
    }

    if (checkType) {
      whereConditions.push(`check_type = $${++paramCount}`);
      params.push(checkType);
    }

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

    const result = await query(`
      SELECT 
        service_type,
        check_type,
        check_status,
        COUNT(*) as check_count,
        AVG(response_time_ms) as avg_response_time,
        AVG(availability_percentage) as avg_availability,
        AVG(error_rate_percentage) as avg_error_rate,
        MAX(check_timestamp) as latest_check,
        COUNT(*) FILTER (WHERE alert_triggered = true) as alert_count
      FROM system_health_checks
      ${whereClause}
      GROUP BY service_type, check_type, check_status
      ORDER BY service_type, check_type, check_status
    `, params);

    return result.rows;
  }

  /**
   * Utility Functions
   */
  async getCloudOptimizationDashboard() {
    const [
      cacheConfigs,
      cdnConfigs,
      storageConfigs,
      recentPerformance,
      healthStatus,
      costSummary
    ] = await Promise.all([
      this.getCacheConfigurations(),
      this.getCdnConfigurations(),
      this.getCloudStorageConfigurations(),
      this.getPerformanceMetrics({ startTime: new Date(Date.now() - 24*60*60*1000) }),
      this.getSystemHealthStatus(),
      this.getCloudCostAnalytics({ startDate: new Date(Date.now() - 30*24*60*60*1000) })
    ]);

    return {
      cacheConfigurations: cacheConfigs,
      cdnConfigurations: cdnConfigs,
      storageConfigurations: storageConfigs,
      performanceMetrics: recentPerformance,
      healthStatus: healthStatus,
      costAnalytics: costSummary,
      summary: {
        totalCacheConfigs: cacheConfigs.length,
        activeCdnConfigs: cdnConfigs.filter(c => c.is_active).length,
        totalStorageConfigs: storageConfigs.length,
        healthyServices: healthStatus.filter(h => h.check_status === 'healthy').length,
        totalMonthlyCost: costSummary.reduce((sum, cost) => sum + parseFloat(cost.total_cost || 0), 0)
      }
    };
  }
}

module.exports = new CloudOptimizationService();