const express = require('express');
const router = express.Router();
const cloudOptimizationController = require('../controllers/cloudOptimizationController');
const { authenticate, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const { body, param, query } = require('express-validator');

/**
 * Cloud Optimization Routes
 * Handles Redis caching, CDN integration, cloud storage, and performance optimization
 */

// ====================================
// AUTHENTICATED ENDPOINTS
// ====================================

// Authentication middleware for all routes
router.use(authenticate);

// ====================================
// CACHE CONFIGURATION MANAGEMENT
// ====================================

/**
 * Get cache configurations
 * GET /api/v1/cloud/cache/configurations
 */
router.get('/cache/configurations', [
  requireRole(['super_admin', 'edufam_admin', 'technical_admin']),
  query('includeInactive').optional().isBoolean().withMessage('Include inactive must be boolean')
], validate, cloudOptimizationController.getCacheConfigurations);

/**
 * Create cache configuration
 * POST /api/v1/cloud/cache/configurations
 */
router.post('/cache/configurations', [
  requireRole(['super_admin', 'edufam_admin', 'technical_admin']),
  body('cacheType').isIn(['redis', 'memcached', 'application', 'database']).withMessage('Invalid cache type'),
  body('cacheName').isString().trim().isLength({ min: 1, max: 100 }).withMessage('Cache name is required (1-100 characters)'),
  body('description').optional().isString().trim().withMessage('Description must be a string'),
  body('connectionConfig').isObject().withMessage('Connection config is required and must be an object'),
  body('poolSettings').optional().isObject().withMessage('Pool settings must be an object'),
  body('defaultTtl').optional().isInt({ min: 1 }).withMessage('Default TTL must be a positive integer'),
  body('maxMemoryMb').optional().isInt({ min: 1 }).withMessage('Max memory must be a positive integer'),
  body('evictionPolicy').optional().isString().trim().withMessage('Eviction policy must be a string'),
  body('compressionEnabled').optional().isBoolean().withMessage('Compression enabled must be boolean'),
  body('compressionAlgorithm').optional().isString().trim().withMessage('Compression algorithm must be a string'),
  body('pipelineEnabled').optional().isBoolean().withMessage('Pipeline enabled must be boolean'),
  body('clusteringEnabled').optional().isBoolean().withMessage('Clustering enabled must be boolean'),
  body('monitoringEnabled').optional().isBoolean().withMessage('Monitoring enabled must be boolean'),
  body('metricsRetentionDays').optional().isInt({ min: 1 }).withMessage('Metrics retention days must be a positive integer'),
  body('alertThresholds').optional().isObject().withMessage('Alert thresholds must be an object'),
  body('environment').optional().isIn(['development', 'staging', 'production']).withMessage('Invalid environment'),
  body('region').optional().isString().trim().withMessage('Region must be a string'),
  body('availabilityZone').optional().isString().trim().withMessage('Availability zone must be a string')
], validate, cloudOptimizationController.createCacheConfiguration);

// ====================================
// CACHE POLICY MANAGEMENT
// ====================================

/**
 * Get cache policies
 * GET /api/v1/cloud/cache/policies
 */
router.get('/cache/policies', [
  requireRole(['super_admin', 'edufam_admin', 'technical_admin']),
  query('cacheConfigId').optional().isUUID().withMessage('Cache config ID must be valid UUID'),
  query('strategy').optional().isIn(['write_through', 'write_behind', 'write_around', 'cache_aside', 'refresh_ahead']).withMessage('Invalid strategy')
], validate, cloudOptimizationController.getCachePolicies);

/**
 * Create cache policy
 * POST /api/v1/cloud/cache/policies
 */
router.post('/cache/policies', [
  requireRole(['super_admin', 'edufam_admin', 'technical_admin']),
  body('policyName').isString().trim().isLength({ min: 1, max: 100 }).withMessage('Policy name is required (1-100 characters)'),
  body('cacheConfigId').isUUID().withMessage('Valid cache config ID is required'),
  body('description').optional().isString().trim().withMessage('Description must be a string'),
  body('strategy').isIn(['write_through', 'write_behind', 'write_around', 'cache_aside', 'refresh_ahead']).withMessage('Valid strategy is required'),
  body('cachePattern').optional().isIn(['key_value', 'hash', 'list', 'set', 'sorted_set', 'stream']).withMessage('Invalid cache pattern'),
  body('keyPattern').isString().trim().isLength({ min: 1, max: 255 }).withMessage('Key pattern is required (1-255 characters)'),
  body('namespace').optional().isString().trim().isLength({ max: 100 }).withMessage('Namespace must be max 100 characters'),
  body('keyPrefix').optional().isString().trim().isLength({ max: 50 }).withMessage('Key prefix must be max 50 characters'),
  body('ttlSeconds').optional().isInt({ min: 1 }).withMessage('TTL seconds must be a positive integer'),
  body('slidingExpiration').optional().isBoolean().withMessage('Sliding expiration must be boolean'),
  body('absoluteExpiration').optional().isISO8601().withMessage('Absolute expiration must be valid ISO date'),
  body('invalidationEvents').optional().isArray().withMessage('Invalidation events must be an array'),
  body('invalidationPatterns').optional().isArray().withMessage('Invalidation patterns must be an array'),
  body('dependencyKeys').optional().isArray().withMessage('Dependency keys must be an array'),
  body('preloadEnabled').optional().isBoolean().withMessage('Preload enabled must be boolean'),
  body('backgroundRefresh').optional().isBoolean().withMessage('Background refresh must be boolean'),
  body('compressionThreshold').optional().isInt({ min: 0 }).withMessage('Compression threshold must be non-negative integer'),
  body('encryptionEnabled').optional().isBoolean().withMessage('Encryption enabled must be boolean'),
  body('accessRoles').optional().isArray().withMessage('Access roles must be an array'),
  body('rateLimitPerMinute').optional().isInt({ min: 1 }).withMessage('Rate limit per minute must be a positive integer'),
  body('hitRateThreshold').optional().isFloat({ min: 0, max: 1 }).withMessage('Hit rate threshold must be between 0 and 1'),
  body('performanceTracking').optional().isBoolean().withMessage('Performance tracking must be boolean')
], validate, cloudOptimizationController.createCachePolicy);

// ====================================
// CDN CONFIGURATION MANAGEMENT
// ====================================

/**
 * Get CDN configurations
 * GET /api/v1/cloud/cdn/configurations
 */
router.get('/cdn/configurations', [
  requireRole(['super_admin', 'edufam_admin', 'technical_admin']),
  query('includeInactive').optional().isBoolean().withMessage('Include inactive must be boolean')
], validate, cloudOptimizationController.getCdnConfigurations);

/**
 * Create CDN configuration
 * POST /api/v1/cloud/cdn/configurations
 */
router.post('/cdn/configurations', [
  requireRole(['super_admin', 'edufam_admin', 'technical_admin']),
  body('cdnProvider').isIn(['cloudflare', 'aws_cloudfront', 'azure_cdn', 'google_cdn', 'custom']).withMessage('Invalid CDN provider'),
  body('cdnName').isString().trim().isLength({ min: 1, max: 100 }).withMessage('CDN name is required (1-100 characters)'),
  body('description').optional().isString().trim().withMessage('Description must be a string'),
  body('originDomain').isString().trim().isLength({ min: 1, max: 255 }).withMessage('Origin domain is required (1-255 characters)'),
  body('cdnDomain').optional().isString().trim().isLength({ max: 255 }).withMessage('CDN domain must be max 255 characters'),
  body('sslEnabled').optional().isBoolean().withMessage('SSL enabled must be boolean'),
  body('sslCertificateConfig').optional().isObject().withMessage('SSL certificate config must be an object'),
  body('defaultCacheTtl').optional().isInt({ min: 1 }).withMessage('Default cache TTL must be a positive integer'),
  body('browserCacheTtl').optional().isInt({ min: 1 }).withMessage('Browser cache TTL must be a positive integer'),
  body('cacheControlHeaders').optional().isObject().withMessage('Cache control headers must be an object'),
  body('edgeLocations').optional().isArray().withMessage('Edge locations must be an array'),
  body('geoRestrictions').optional().isObject().withMessage('Geo restrictions must be an object'),
  body('compressionEnabled').optional().isBoolean().withMessage('Compression enabled must be boolean'),
  body('compressionTypes').optional().isArray().withMessage('Compression types must be an array'),
  body('minificationEnabled').optional().isBoolean().withMessage('Minification enabled must be boolean'),
  body('http2Enabled').optional().isBoolean().withMessage('HTTP2 enabled must be boolean'),
  body('ddosProtection').optional().isBoolean().withMessage('DDoS protection must be boolean'),
  body('wafEnabled').optional().isBoolean().withMessage('WAF enabled must be boolean'),
  body('hotlinkProtection').optional().isBoolean().withMessage('Hotlink protection must be boolean'),
  body('secureHeaders').optional().isObject().withMessage('Secure headers must be an object'),
  body('staticContentPatterns').optional().isArray().withMessage('Static content patterns must be an array'),
  body('dynamicContentPatterns').optional().isArray().withMessage('Dynamic content patterns must be an array'),
  body('bypassPatterns').optional().isArray().withMessage('Bypass patterns must be an array'),
  body('apiCredentials').optional().isObject().withMessage('API credentials must be an object'),
  body('webhookUrl').optional().isURL().withMessage('Webhook URL must be valid URL'),
  body('analyticsEnabled').optional().isBoolean().withMessage('Analytics enabled must be boolean'),
  body('realUserMonitoring').optional().isBoolean().withMessage('Real user monitoring must be boolean'),
  body('syntheticMonitoring').optional().isBoolean().withMessage('Synthetic monitoring must be boolean')
], validate, cloudOptimizationController.createCdnConfiguration);

// ====================================
// CLOUD STORAGE MANAGEMENT
// ====================================

/**
 * Get cloud storage configurations
 * GET /api/v1/cloud/storage/configurations
 */
router.get('/storage/configurations', [
  requireRole(['super_admin', 'edufam_admin', 'technical_admin']),
  query('includeInactive').optional().isBoolean().withMessage('Include inactive must be boolean')
], validate, cloudOptimizationController.getCloudStorageConfigurations);

/**
 * Create cloud storage configuration
 * POST /api/v1/cloud/storage/configurations
 */
router.post('/storage/configurations', [
  requireRole(['super_admin', 'edufam_admin', 'technical_admin']),
  body('provider').isIn(['aws_s3', 'google_cloud', 'azure_blob', 'digitalocean_spaces', 'custom']).withMessage('Invalid storage provider'),
  body('storageName').isString().trim().isLength({ min: 1, max: 100 }).withMessage('Storage name is required (1-100 characters)'),
  body('description').optional().isString().trim().withMessage('Description must be a string'),
  body('bucketName').isString().trim().isLength({ min: 1, max: 255 }).withMessage('Bucket name is required (1-255 characters)'),
  body('region').optional().isString().trim().withMessage('Region must be a string'),
  body('endpoint').optional().isURL().withMessage('Endpoint must be valid URL'),
  body('accessCredentials').isObject().withMessage('Access credentials are required and must be an object'),
  body('publicAccessEnabled').optional().isBoolean().withMessage('Public access enabled must be boolean'),
  body('signedUrlsEnabled').optional().isBoolean().withMessage('Signed URLs enabled must be boolean'),
  body('signedUrlExpiryHours').optional().isInt({ min: 1 }).withMessage('Signed URL expiry hours must be a positive integer'),
  body('defaultStorageClass').optional().isString().trim().withMessage('Default storage class must be a string'),
  body('lifecyclePolicies').optional().isObject().withMessage('Lifecycle policies must be an object'),
  body('versioningEnabled').optional().isBoolean().withMessage('Versioning enabled must be boolean'),
  body('encryptionEnabled').optional().isBoolean().withMessage('Encryption enabled must be boolean'),
  body('encryptionAlgorithm').optional().isString().trim().withMessage('Encryption algorithm must be a string'),
  body('kmsKeyId').optional().isString().trim().withMessage('KMS key ID must be a string'),
  body('cdnIntegrationId').optional().isUUID().withMessage('CDN integration ID must be valid UUID'),
  body('customDomain').optional().isString().trim().withMessage('Custom domain must be a string'),
  body('corsConfiguration').optional().isObject().withMessage('CORS configuration must be an object'),
  body('allowedFileTypes').optional().isArray().withMessage('Allowed file types must be an array'),
  body('maxFileSizeMb').optional().isInt({ min: 1 }).withMessage('Max file size MB must be a positive integer'),
  body('virusScanningEnabled').optional().isBoolean().withMessage('Virus scanning enabled must be boolean'),
  body('backupEnabled').optional().isBoolean().withMessage('Backup enabled must be boolean'),
  body('replicationRegions').optional().isArray().withMessage('Replication regions must be an array'),
  body('crossRegionReplication').optional().isBoolean().withMessage('Cross region replication must be boolean'),
  body('intelligentTiering').optional().isBoolean().withMessage('Intelligent tiering must be boolean'),
  body('dataTransferOptimization').optional().isBoolean().withMessage('Data transfer optimization must be boolean')
], validate, cloudOptimizationController.createCloudStorageConfiguration);

// ====================================
// PERFORMANCE MONITORING
// ====================================

/**
 * Record performance metric
 * POST /api/v1/cloud/performance/metrics
 */
router.post('/performance/metrics', [
  requireRole(['super_admin', 'edufam_admin', 'technical_admin', 'monitoring_user']),
  body('metricType').isString().trim().isLength({ min: 1, max: 50 }).withMessage('Metric type is required (1-50 characters)'),
  body('serviceType').isString().trim().isLength({ min: 1, max: 50 }).withMessage('Service type is required (1-50 characters)'),
  body('serviceId').optional().isUUID().withMessage('Service ID must be valid UUID'),
  body('metricValue').isNumeric().withMessage('Metric value is required and must be numeric'),
  body('metricUnit').optional().isString().trim().withMessage('Metric unit must be a string'),
  body('endpoint').optional().isString().trim().withMessage('Endpoint must be a string'),
  body('region').optional().isString().trim().withMessage('Region must be a string'),
  body('userAgentCategory').optional().isString().trim().withMessage('User agent category must be a string'),
  body('requestSource').optional().isString().trim().withMessage('Request source must be a string'),
  body('cacheStatus').optional().isString().trim().withMessage('Cache status must be a string'),
  body('responseSizeBytes').optional().isInt({ min: 0 }).withMessage('Response size bytes must be non-negative integer'),
  body('processingTimeMs').optional().isInt({ min: 0 }).withMessage('Processing time MS must be non-negative integer'),
  body('networkLatencyMs').optional().isInt({ min: 0 }).withMessage('Network latency MS must be non-negative integer'),
  body('tags').optional().isObject().withMessage('Tags must be an object'),
  body('traceId').optional().isString().trim().withMessage('Trace ID must be a string')
], validate, cloudOptimizationController.recordPerformanceMetric);

/**
 * Get performance metrics
 * GET /api/v1/cloud/performance/metrics
 */
router.get('/performance/metrics', [
  requireRole(['super_admin', 'edufam_admin', 'technical_admin', 'monitoring_user']),
  query('metricType').optional().isString().trim().withMessage('Metric type must be a string'),
  query('serviceType').optional().isString().trim().withMessage('Service type must be a string'),
  query('serviceId').optional().isUUID().withMessage('Service ID must be valid UUID'),
  query('startTime').optional().isISO8601().withMessage('Start time must be valid ISO date'),
  query('endTime').optional().isISO8601().withMessage('End time must be valid ISO date'),
  query('aggregation').optional().isIn(['avg', 'sum', 'min', 'max', 'count']).withMessage('Invalid aggregation'),
  query('groupBy').optional().isIn(['hour', 'day']).withMessage('Invalid group by option')
], validate, cloudOptimizationController.getPerformanceMetrics);

// ====================================
// CACHE PERFORMANCE ANALYTICS
// ====================================

/**
 * Log cache operation
 * POST /api/v1/cloud/cache/operations
 */
router.post('/cache/operations', [
  requireRole(['super_admin', 'edufam_admin', 'technical_admin', 'monitoring_user']),
  body('cacheConfigId').isUUID().withMessage('Valid cache config ID is required'),
  body('policyId').optional().isUUID().withMessage('Policy ID must be valid UUID'),
  body('operationType').isIn(['get', 'set', 'delete', 'flush', 'increment', 'expire']).withMessage('Valid operation type is required'),
  body('cacheKey').isString().trim().isLength({ min: 1, max: 500 }).withMessage('Cache key is required (1-500 characters)'),
  body('executionTimeMs').optional().isFloat({ min: 0 }).withMessage('Execution time MS must be non-negative'),
  body('resultStatus').isIn(['hit', 'miss', 'error', 'timeout']).withMessage('Valid result status is required'),
  body('dataSizeBytes').optional().isInt({ min: 0 }).withMessage('Data size bytes must be non-negative integer'),
  body('callingService').optional().isString().trim().withMessage('Calling service must be a string'),
  body('endpoint').optional().isString().trim().withMessage('Endpoint must be a string'),
  body('userContext').optional().isObject().withMessage('User context must be an object'),
  body('errorCode').optional().isString().trim().withMessage('Error code must be a string'),
  body('errorMessage').optional().isString().trim().withMessage('Error message must be a string'),
  body('retryCount').optional().isInt({ min: 0 }).withMessage('Retry count must be non-negative integer'),
  body('compressionRatio').optional().isFloat({ min: 0, max: 1 }).withMessage('Compression ratio must be between 0 and 1'),
  body('serializationTimeMs').optional().isFloat({ min: 0 }).withMessage('Serialization time MS must be non-negative'),
  body('networkTimeMs').optional().isFloat({ min: 0 }).withMessage('Network time MS must be non-negative')
], validate, cloudOptimizationController.logCacheOperation);

/**
 * Get cache performance analytics
 * GET /api/v1/cloud/cache/analytics
 */
router.get('/cache/analytics', [
  requireRole(['super_admin', 'edufam_admin', 'technical_admin', 'monitoring_user']),
  query('cacheConfigId').optional().isUUID().withMessage('Cache config ID must be valid UUID'),
  query('startTime').optional().isISO8601().withMessage('Start time must be valid ISO date'),
  query('endTime').optional().isISO8601().withMessage('End time must be valid ISO date'),
  query('operationType').optional().isIn(['get', 'set', 'delete', 'flush', 'increment', 'expire']).withMessage('Invalid operation type')
], validate, cloudOptimizationController.getCachePerformanceAnalytics);

// ====================================
// CDN ANALYTICS
// ====================================

/**
 * Log CDN request
 * POST /api/v1/cloud/cdn/requests
 */
router.post('/cdn/requests', [
  requireRole(['super_admin', 'edufam_admin', 'technical_admin', 'monitoring_user']),
  body('cdnConfigId').isUUID().withMessage('Valid CDN config ID is required'),
  body('requestUrl').isURL().withMessage('Valid request URL is required'),
  body('requestMethod').optional().isIn(['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'OPTIONS']).withMessage('Invalid request method'),
  body('responseStatus').isInt({ min: 100, max: 599 }).withMessage('Valid HTTP response status is required'),
  body('responseSizeBytes').optional().isInt({ min: 0 }).withMessage('Response size bytes must be non-negative integer'),
  body('responseTimeMs').optional().isInt({ min: 0 }).withMessage('Response time MS must be non-negative integer'),
  body('cacheStatus').optional().isString().trim().withMessage('Cache status must be a string'),
  body('edgeLocation').optional().isString().trim().withMessage('Edge location must be a string'),
  body('originResponseTimeMs').optional().isInt({ min: 0 }).withMessage('Origin response time MS must be non-negative integer'),
  body('clientIp').optional().isIP().withMessage('Client IP must be valid IP address'),
  body('clientCountry').optional().isLength({ min: 2, max: 2 }).withMessage('Client country must be 2-character ISO code'),
  body('clientRegion').optional().isString().trim().withMessage('Client region must be a string'),
  body('userAgent').optional().isString().trim().withMessage('User agent must be a string'),
  body('referer').optional().isString().trim().withMessage('Referer must be a string'),
  body('contentType').optional().isString().trim().withMessage('Content type must be a string'),
  body('contentEncoding').optional().isString().trim().withMessage('Content encoding must be a string'),
  body('securityEvents').optional().isObject().withMessage('Security events must be an object'),
  body('compressionRatio').optional().isFloat({ min: 0, max: 1 }).withMessage('Compression ratio must be between 0 and 1'),
  body('bandwidthSavedBytes').optional().isInt({ min: 0 }).withMessage('Bandwidth saved bytes must be non-negative integer')
], validate, cloudOptimizationController.logCdnRequest);

/**
 * Get CDN analytics
 * GET /api/v1/cloud/cdn/analytics
 */
router.get('/cdn/analytics', [
  requireRole(['super_admin', 'edufam_admin', 'technical_admin', 'monitoring_user']),
  query('cdnConfigId').optional().isUUID().withMessage('CDN config ID must be valid UUID'),
  query('startTime').optional().isISO8601().withMessage('Start time must be valid ISO date'),
  query('endTime').optional().isISO8601().withMessage('End time must be valid ISO date'),
  query('aggregation').optional().isIn(['hour', 'day']).withMessage('Invalid aggregation option')
], validate, cloudOptimizationController.getCdnAnalytics);

// ====================================
// CLOUD COST MANAGEMENT
// ====================================

/**
 * Record cloud cost
 * POST /api/v1/cloud/costs
 */
router.post('/costs', [
  requireRole(['super_admin', 'edufam_admin', 'financial_admin']),
  body('serviceType').isString().trim().isLength({ min: 1, max: 50 }).withMessage('Service type is required (1-50 characters)'),
  body('serviceId').optional().isUUID().withMessage('Service ID must be valid UUID'),
  body('serviceName').optional().isString().trim().withMessage('Service name must be a string'),
  body('billingPeriodStart').isISO8601().withMessage('Valid billing period start date is required'),
  body('billingPeriodEnd').isISO8601().withMessage('Valid billing period end date is required'),
  body('costAmount').isFloat({ min: 0 }).withMessage('Cost amount is required and must be non-negative'),
  body('currency').optional().isLength({ min: 3, max: 3 }).withMessage('Currency must be 3-character ISO code'),
  body('usageQuantity').optional().isFloat({ min: 0 }).withMessage('Usage quantity must be non-negative'),
  body('usageUnit').optional().isString().trim().withMessage('Usage unit must be a string'),
  body('tierOrPlan').optional().isString().trim().withMessage('Tier or plan must be a string'),
  body('baseCost').optional().isFloat({ min: 0 }).withMessage('Base cost must be non-negative'),
  body('usageCost').optional().isFloat({ min: 0 }).withMessage('Usage cost must be non-negative'),
  body('additionalFees').optional().isFloat({ min: 0 }).withMessage('Additional fees must be non-negative'),
  body('discountsApplied').optional().isFloat({ min: 0 }).withMessage('Discounts applied must be non-negative'),
  body('taxAmount').optional().isFloat({ min: 0 }).withMessage('Tax amount must be non-negative'),
  body('region').optional().isString().trim().withMessage('Region must be a string'),
  body('availabilityZone').optional().isString().trim().withMessage('Availability zone must be a string'),
  body('optimizationSuggestions').optional().isObject().withMessage('Optimization suggestions must be an object'),
  body('potentialSavings').optional().isFloat({ min: 0 }).withMessage('Potential savings must be non-negative'),
  body('provider').optional().isString().trim().withMessage('Provider must be a string'),
  body('accountId').optional().isString().trim().withMessage('Account ID must be a string'),
  body('resourceTags').optional().isObject().withMessage('Resource tags must be an object')
], validate, cloudOptimizationController.recordCloudCost);

/**
 * Get cloud cost analytics
 * GET /api/v1/cloud/costs/analytics
 */
router.get('/costs/analytics', [
  requireRole(['super_admin', 'edufam_admin', 'financial_admin']),
  query('serviceType').optional().isString().trim().withMessage('Service type must be a string'),
  query('startDate').optional().isISO8601().withMessage('Start date must be valid ISO date'),
  query('endDate').optional().isISO8601().withMessage('End date must be valid ISO date'),
  query('groupBy').optional().isIn(['service_type', 'region', 'provider']).withMessage('Invalid group by option')
], validate, cloudOptimizationController.getCloudCostAnalytics);

// ====================================
// SYSTEM HEALTH MONITORING
// ====================================

/**
 * Record health check
 * POST /api/v1/cloud/health/checks
 */
router.post('/health/checks', [
  requireRole(['super_admin', 'edufam_admin', 'technical_admin', 'monitoring_user']),
  body('checkType').isString().trim().isLength({ min: 1, max: 50 }).withMessage('Check type is required (1-50 characters)'),
  body('serviceType').isString().trim().isLength({ min: 1, max: 50 }).withMessage('Service type is required (1-50 characters)'),
  body('serviceId').optional().isUUID().withMessage('Service ID must be valid UUID'),
  body('checkStatus').isIn(['healthy', 'warning', 'critical', 'unknown']).withMessage('Valid check status is required'),
  body('responseTimeMs').optional().isInt({ min: 0 }).withMessage('Response time MS must be non-negative integer'),
  body('availabilityPercentage').optional().isFloat({ min: 0, max: 100 }).withMessage('Availability percentage must be between 0 and 100'),
  body('errorRatePercentage').optional().isFloat({ min: 0, max: 100 }).withMessage('Error rate percentage must be between 0 and 100'),
  body('throughputPerSecond').optional().isFloat({ min: 0 }).withMessage('Throughput per second must be non-negative'),
  body('warningThreshold').optional().isFloat().withMessage('Warning threshold must be numeric'),
  body('criticalThreshold').optional().isFloat().withMessage('Critical threshold must be numeric'),
  body('alertTriggered').optional().isBoolean().withMessage('Alert triggered must be boolean'),
  body('alertMessage').optional().isString().trim().withMessage('Alert message must be a string'),
  body('checkDetails').optional().isObject().withMessage('Check details must be an object'),
  body('remediationSuggestions').optional().isArray().withMessage('Remediation suggestions must be an array')
], validate, cloudOptimizationController.recordHealthCheck);

/**
 * Get system health status
 * GET /api/v1/cloud/health/status
 */
router.get('/health/status', [
  requireRole(['super_admin', 'edufam_admin', 'technical_admin', 'monitoring_user']),
  query('serviceType').optional().isString().trim().withMessage('Service type must be a string'),
  query('checkType').optional().isString().trim().withMessage('Check type must be a string'),
  query('timeWindow').optional().isString().trim().withMessage('Time window must be a string')
], validate, cloudOptimizationController.getSystemHealthStatus);

// ====================================
// DASHBOARD AND OVERVIEW
// ====================================

/**
 * Get cloud optimization dashboard
 * GET /api/v1/cloud/dashboard
 */
router.get('/dashboard', [
  requireRole(['super_admin', 'edufam_admin', 'technical_admin'])
], cloudOptimizationController.getCloudOptimizationDashboard);

// ====================================
// HEALTH CHECK
// ====================================

/**
 * Cloud optimization service health check
 * GET /api/v1/cloud/health
 */
router.get('/health', cloudOptimizationController.getCloudOptimizationHealth);

// ====================================
// ERROR HANDLING
// ====================================

// Global error handler for cloud optimization routes
router.use((error, req, res, next) => {
  console.error('Cloud optimization route error:', error);
  
  res.status(error.statusCode || 500).json({
    success: false,
    error: {
      code: error.code || 'CLOUD_OPTIMIZATION_ERROR',
      message: error.message || 'An error occurred in cloud optimization'
    }
  });
});

module.exports = router;