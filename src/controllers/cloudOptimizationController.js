const cloudOptimizationService = require('../services/cloudOptimizationService');
const { asyncHandler } = require('../middleware/errorHandler');
const { ValidationError } = require('../middleware/errorHandler');

/**
 * Cloud Optimization Controller
 * Handles Redis caching, CDN integration, cloud storage, and performance optimization
 */
class CloudOptimizationController {

  /**
   * Cache Configuration Management
   */

  // Get cache configurations
  getCacheConfigurations = asyncHandler(async (req, res) => {
    const { includeInactive } = req.query;

    const configurations = await cloudOptimizationService.getCacheConfigurations({
      includeInactive: includeInactive === 'true'
    });

    res.json({
      success: true,
      data: { configurations },
      message: 'Cache configurations retrieved successfully'
    });
  });

  // Create cache configuration
  createCacheConfiguration = asyncHandler(async (req, res) => {
    const {
      cacheType,
      cacheName,
      description,
      connectionConfig,
      poolSettings,
      defaultTtl,
      maxMemoryMb,
      evictionPolicy,
      compressionEnabled,
      compressionAlgorithm,
      pipelineEnabled,
      clusteringEnabled,
      monitoringEnabled,
      metricsRetentionDays,
      alertThresholds,
      environment,
      region,
      availabilityZone
    } = req.body;

    // Validate required fields
    if (!cacheType || !cacheName || !connectionConfig) {
      throw new ValidationError('Cache type, cache name, and connection config are required');
    }

    const configuration = await cloudOptimizationService.createCacheConfiguration({
      cacheType,
      cacheName,
      description,
      connectionConfig,
      poolSettings,
      defaultTtl,
      maxMemoryMb,
      evictionPolicy,
      compressionEnabled,
      compressionAlgorithm,
      pipelineEnabled,
      clusteringEnabled,
      monitoringEnabled,
      metricsRetentionDays,
      alertThresholds,
      environment,
      region,
      availabilityZone
    });

    res.status(201).json({
      success: true,
      data: { configuration },
      message: 'Cache configuration created successfully'
    });
  });

  /**
   * Cache Policy Management
   */

  // Get cache policies
  getCachePolicies = asyncHandler(async (req, res) => {
    const { cacheConfigId, strategy } = req.query;

    const policies = await cloudOptimizationService.getCachePolicies({
      cacheConfigId,
      strategy
    });

    res.json({
      success: true,
      data: { policies },
      message: 'Cache policies retrieved successfully'
    });
  });

  // Create cache policy
  createCachePolicy = asyncHandler(async (req, res) => {
    const {
      policyName,
      cacheConfigId,
      description,
      strategy,
      cachePattern,
      keyPattern,
      namespace,
      keyPrefix,
      ttlSeconds,
      slidingExpiration,
      absoluteExpiration,
      invalidationEvents,
      invalidationPatterns,
      dependencyKeys,
      preloadEnabled,
      backgroundRefresh,
      compressionThreshold,
      encryptionEnabled,
      accessRoles,
      rateLimitPerMinute,
      hitRateThreshold,
      performanceTracking
    } = req.body;

    // Validate required fields
    if (!policyName || !cacheConfigId || !strategy || !keyPattern) {
      throw new ValidationError('Policy name, cache config ID, strategy, and key pattern are required');
    }

    const policy = await cloudOptimizationService.createCachePolicy({
      policyName,
      cacheConfigId,
      description,
      strategy,
      cachePattern,
      keyPattern,
      namespace,
      keyPrefix,
      ttlSeconds,
      slidingExpiration,
      absoluteExpiration,
      invalidationEvents,
      invalidationPatterns,
      dependencyKeys,
      preloadEnabled,
      backgroundRefresh,
      compressionThreshold,
      encryptionEnabled,
      accessRoles,
      rateLimitPerMinute,
      hitRateThreshold,
      performanceTracking
    });

    res.status(201).json({
      success: true,
      data: { policy },
      message: 'Cache policy created successfully'
    });
  });

  /**
   * CDN Configuration Management
   */

  // Get CDN configurations
  getCdnConfigurations = asyncHandler(async (req, res) => {
    const { includeInactive } = req.query;

    const configurations = await cloudOptimizationService.getCdnConfigurations({
      includeInactive: includeInactive === 'true'
    });

    res.json({
      success: true,
      data: { configurations },
      message: 'CDN configurations retrieved successfully'
    });
  });

  // Create CDN configuration
  createCdnConfiguration = asyncHandler(async (req, res) => {
    const {
      cdnProvider,
      cdnName,
      description,
      originDomain,
      cdnDomain,
      sslEnabled,
      sslCertificateConfig,
      defaultCacheTtl,
      browserCacheTtl,
      cacheControlHeaders,
      edgeLocations,
      geoRestrictions,
      compressionEnabled,
      compressionTypes,
      minificationEnabled,
      http2Enabled,
      ddosProtection,
      wafEnabled,
      hotlinkProtection,
      secureHeaders,
      staticContentPatterns,
      dynamicContentPatterns,
      bypassPatterns,
      apiCredentials,
      webhookUrl,
      analyticsEnabled,
      realUserMonitoring,
      syntheticMonitoring
    } = req.body;

    // Validate required fields
    if (!cdnProvider || !cdnName || !originDomain) {
      throw new ValidationError('CDN provider, CDN name, and origin domain are required');
    }

    const configuration = await cloudOptimizationService.createCdnConfiguration({
      cdnProvider,
      cdnName,
      description,
      originDomain,
      cdnDomain,
      sslEnabled,
      sslCertificateConfig,
      defaultCacheTtl,
      browserCacheTtl,
      cacheControlHeaders,
      edgeLocations,
      geoRestrictions,
      compressionEnabled,
      compressionTypes,
      minificationEnabled,
      http2Enabled,
      ddosProtection,
      wafEnabled,
      hotlinkProtection,
      secureHeaders,
      staticContentPatterns,
      dynamicContentPatterns,
      bypassPatterns,
      apiCredentials,
      webhookUrl,
      analyticsEnabled,
      realUserMonitoring,
      syntheticMonitoring
    });

    res.status(201).json({
      success: true,
      data: { configuration },
      message: 'CDN configuration created successfully'
    });
  });

  /**
   * Cloud Storage Management
   */

  // Get cloud storage configurations
  getCloudStorageConfigurations = asyncHandler(async (req, res) => {
    const { includeInactive } = req.query;

    const configurations = await cloudOptimizationService.getCloudStorageConfigurations({
      includeInactive: includeInactive === 'true'
    });

    res.json({
      success: true,
      data: { configurations },
      message: 'Cloud storage configurations retrieved successfully'
    });
  });

  // Create cloud storage configuration
  createCloudStorageConfiguration = asyncHandler(async (req, res) => {
    const {
      provider,
      storageName,
      description,
      bucketName,
      region,
      endpoint,
      accessCredentials,
      publicAccessEnabled,
      signedUrlsEnabled,
      signedUrlExpiryHours,
      defaultStorageClass,
      lifecyclePolicies,
      versioningEnabled,
      encryptionEnabled,
      encryptionAlgorithm,
      kmsKeyId,
      cdnIntegrationId,
      customDomain,
      corsConfiguration,
      allowedFileTypes,
      maxFileSizeMb,
      virusScanningEnabled,
      backupEnabled,
      replicationRegions,
      crossRegionReplication,
      intelligentTiering,
      dataTransferOptimization
    } = req.body;

    // Validate required fields
    if (!provider || !storageName || !bucketName || !accessCredentials) {
      throw new ValidationError('Provider, storage name, bucket name, and access credentials are required');
    }

    const configuration = await cloudOptimizationService.createCloudStorageConfiguration({
      provider,
      storageName,
      description,
      bucketName,
      region,
      endpoint,
      accessCredentials,
      publicAccessEnabled,
      signedUrlsEnabled,
      signedUrlExpiryHours,
      defaultStorageClass,
      lifecyclePolicies,
      versioningEnabled,
      encryptionEnabled,
      encryptionAlgorithm,
      kmsKeyId,
      cdnIntegrationId,
      customDomain,
      corsConfiguration,
      allowedFileTypes,
      maxFileSizeMb,
      virusScanningEnabled,
      backupEnabled,
      replicationRegions,
      crossRegionReplication,
      intelligentTiering,
      dataTransferOptimization
    });

    res.status(201).json({
      success: true,
      data: { configuration },
      message: 'Cloud storage configuration created successfully'
    });
  });

  /**
   * Performance Monitoring
   */

  // Record performance metric
  recordPerformanceMetric = asyncHandler(async (req, res) => {
    const {
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
    } = req.body;

    // Validate required fields
    if (!metricType || !serviceType || metricValue === undefined) {
      throw new ValidationError('Metric type, service type, and metric value are required');
    }

    const metric = await cloudOptimizationService.recordPerformanceMetric({
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
    });

    res.status(201).json({
      success: true,
      data: { metric },
      message: 'Performance metric recorded successfully'
    });
  });

  // Get performance metrics
  getPerformanceMetrics = asyncHandler(async (req, res) => {
    const {
      metricType,
      serviceType,
      serviceId,
      startTime,
      endTime,
      aggregation,
      groupBy
    } = req.query;

    const metrics = await cloudOptimizationService.getPerformanceMetrics({
      metricType,
      serviceType,
      serviceId,
      startTime: startTime ? new Date(startTime) : undefined,
      endTime: endTime ? new Date(endTime) : undefined,
      aggregation,
      groupBy
    });

    res.json({
      success: true,
      data: { metrics },
      message: 'Performance metrics retrieved successfully'
    });
  });

  /**
   * Cache Performance Analytics
   */

  // Log cache operation
  logCacheOperation = asyncHandler(async (req, res) => {
    const {
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
      retryCount,
      compressionRatio,
      serializationTimeMs,
      networkTimeMs
    } = req.body;

    // Validate required fields
    if (!cacheConfigId || !operationType || !cacheKey || !resultStatus) {
      throw new ValidationError('Cache config ID, operation type, cache key, and result status are required');
    }

    const log = await cloudOptimizationService.logCacheOperation({
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
      retryCount,
      compressionRatio,
      serializationTimeMs,
      networkTimeMs
    });

    res.status(201).json({
      success: true,
      data: { log },
      message: 'Cache operation logged successfully'
    });
  });

  // Get cache performance analytics
  getCachePerformanceAnalytics = asyncHandler(async (req, res) => {
    const {
      cacheConfigId,
      startTime,
      endTime,
      operationType
    } = req.query;

    const analytics = await cloudOptimizationService.getCachePerformanceAnalytics({
      cacheConfigId,
      startTime: startTime ? new Date(startTime) : undefined,
      endTime: endTime ? new Date(endTime) : undefined,
      operationType
    });

    res.json({
      success: true,
      data: { analytics },
      message: 'Cache performance analytics retrieved successfully'
    });
  });

  /**
   * CDN Analytics
   */

  // Log CDN request
  logCdnRequest = asyncHandler(async (req, res) => {
    const {
      cdnConfigId,
      requestUrl,
      requestMethod,
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
    } = req.body;

    // Validate required fields
    if (!cdnConfigId || !requestUrl || !responseStatus) {
      throw new ValidationError('CDN config ID, request URL, and response status are required');
    }

    const log = await cloudOptimizationService.logCdnRequest({
      cdnConfigId,
      requestUrl,
      requestMethod,
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
    });

    res.status(201).json({
      success: true,
      data: { log },
      message: 'CDN request logged successfully'
    });
  });

  // Get CDN analytics
  getCdnAnalytics = asyncHandler(async (req, res) => {
    const {
      cdnConfigId,
      startTime,
      endTime,
      aggregation
    } = req.query;

    const analytics = await cloudOptimizationService.getCdnAnalytics({
      cdnConfigId,
      startTime: startTime ? new Date(startTime) : undefined,
      endTime: endTime ? new Date(endTime) : undefined,
      aggregation
    });

    res.json({
      success: true,
      data: { analytics },
      message: 'CDN analytics retrieved successfully'
    });
  });

  /**
   * Cloud Cost Management
   */

  // Record cloud cost
  recordCloudCost = asyncHandler(async (req, res) => {
    const {
      serviceType,
      serviceId,
      serviceName,
      billingPeriodStart,
      billingPeriodEnd,
      costAmount,
      currency,
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
    } = req.body;

    // Validate required fields
    if (!serviceType || !billingPeriodStart || !billingPeriodEnd || costAmount === undefined) {
      throw new ValidationError('Service type, billing period dates, and cost amount are required');
    }

    const cost = await cloudOptimizationService.recordCloudCost({
      serviceType,
      serviceId,
      serviceName,
      billingPeriodStart,
      billingPeriodEnd,
      costAmount,
      currency,
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
    });

    res.status(201).json({
      success: true,
      data: { cost },
      message: 'Cloud cost recorded successfully'
    });
  });

  // Get cloud cost analytics
  getCloudCostAnalytics = asyncHandler(async (req, res) => {
    const {
      serviceType,
      startDate,
      endDate,
      groupBy
    } = req.query;

    const analytics = await cloudOptimizationService.getCloudCostAnalytics({
      serviceType,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      groupBy
    });

    res.json({
      success: true,
      data: { analytics },
      message: 'Cloud cost analytics retrieved successfully'
    });
  });

  /**
   * System Health Monitoring
   */

  // Record health check
  recordHealthCheck = asyncHandler(async (req, res) => {
    const {
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
      alertTriggered,
      alertMessage,
      checkDetails,
      remediationSuggestions
    } = req.body;

    // Validate required fields
    if (!checkType || !serviceType || !checkStatus) {
      throw new ValidationError('Check type, service type, and check status are required');
    }

    const healthCheck = await cloudOptimizationService.recordHealthCheck({
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
      alertTriggered,
      alertMessage,
      checkDetails,
      remediationSuggestions
    });

    res.status(201).json({
      success: true,
      data: { healthCheck },
      message: 'Health check recorded successfully'
    });
  });

  // Get system health status
  getSystemHealthStatus = asyncHandler(async (req, res) => {
    const {
      serviceType,
      checkType,
      timeWindow
    } = req.query;

    const healthStatus = await cloudOptimizationService.getSystemHealthStatus({
      serviceType,
      checkType,
      timeWindow
    });

    res.json({
      success: true,
      data: { healthStatus },
      message: 'System health status retrieved successfully'
    });
  });

  /**
   * Dashboard and Overview
   */

  // Get cloud optimization dashboard
  getCloudOptimizationDashboard = asyncHandler(async (req, res) => {
    const dashboard = await cloudOptimizationService.getCloudOptimizationDashboard();

    res.json({
      success: true,
      data: { dashboard },
      message: 'Cloud optimization dashboard retrieved successfully'
    });
  });

  /**
   * Health Check
   */

  // Get cloud optimization service health
  getCloudOptimizationHealth = asyncHandler(async (req, res) => {
    const [
      cacheConfigs,
      cdnConfigs,
      storageConfigs,
      healthStatus
    ] = await Promise.all([
      cloudOptimizationService.getCacheConfigurations(),
      cloudOptimizationService.getCdnConfigurations(),
      cloudOptimizationService.getCloudStorageConfigurations(),
      cloudOptimizationService.getSystemHealthStatus()
    ]);

    res.json({
      success: true,
      data: {
        service: 'Cloud Optimization Service',
        status: 'healthy',
        features: [
          'redis_caching',
          'cdn_integration',
          'cloud_storage_management',
          'performance_monitoring',
          'cache_analytics',
          'cost_tracking',
          'health_monitoring',
          'optimization_rules',
          'auto_scaling',
          'geo_distribution'
        ],
        metrics: {
          totalCacheConfigurations: cacheConfigs.length,
          activeCacheConfigurations: cacheConfigs.filter(c => c.is_active).length,
          totalCdnConfigurations: cdnConfigs.length,
          activeCdnConfigurations: cdnConfigs.filter(c => c.is_active).length,
          totalStorageConfigurations: storageConfigs.length,
          activeStorageConfigurations: storageConfigs.filter(c => c.is_active).length,
          healthyServices: healthStatus.filter(h => h.check_status === 'healthy').length,
          totalHealthChecks: healthStatus.length
        },
        cacheTypes: ['redis', 'memcached', 'application', 'database'],
        cdnProviders: ['cloudflare', 'aws_cloudfront', 'azure_cdn', 'google_cdn'],
        storageProviders: ['aws_s3', 'google_cloud', 'azure_blob', 'digitalocean_spaces'],
        cacheStrategies: ['write_through', 'write_behind', 'write_around', 'cache_aside', 'refresh_ahead'],
        timestamp: new Date().toISOString()
      },
      message: 'Cloud optimization service health check completed'
    });
  });
}

module.exports = new CloudOptimizationController();