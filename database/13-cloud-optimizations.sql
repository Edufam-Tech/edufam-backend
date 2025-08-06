-- ====================================
-- CLOUD OPTIMIZATIONS & PERFORMANCE
-- ====================================
-- Redis caching, CDN integration, cloud storage, and performance optimization
-- Advanced caching strategies and distributed computing capabilities

-- Cache Management Configuration
CREATE TABLE cache_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cache_type VARCHAR(50) NOT NULL, -- 'redis', 'memcached', 'application', 'database'
    cache_name VARCHAR(100) UNIQUE NOT NULL, -- Identifier for the cache instance
    description TEXT,
    
    -- Connection settings
    connection_config JSONB NOT NULL, -- Host, port, auth, cluster config
    pool_settings JSONB, -- Connection pool settings
    
    -- Cache behavior
    default_ttl INTEGER DEFAULT 3600, -- Default TTL in seconds
    max_memory_mb INTEGER, -- Maximum memory allocation
    eviction_policy VARCHAR(50) DEFAULT 'allkeys-lru', -- Redis eviction policy
    
    -- Performance settings
    compression_enabled BOOLEAN DEFAULT true,
    compression_algorithm VARCHAR(20) DEFAULT 'gzip',
    pipeline_enabled BOOLEAN DEFAULT true,
    clustering_enabled BOOLEAN DEFAULT false,
    
    -- Monitoring
    monitoring_enabled BOOLEAN DEFAULT true,
    metrics_retention_days INTEGER DEFAULT 30,
    alert_thresholds JSONB, -- Memory, connections, latency thresholds
    
    -- Environment and deployment
    environment VARCHAR(20) DEFAULT 'production' CHECK (environment IN ('development', 'staging', 'production')),
    region VARCHAR(50),
    availability_zone VARCHAR(50),
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Cache Policies and Strategies
CREATE TABLE cache_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_name VARCHAR(100) UNIQUE NOT NULL,
    cache_config_id UUID NOT NULL REFERENCES cache_configurations(id) ON DELETE CASCADE,
    description TEXT,
    
    -- Cache strategy
    strategy VARCHAR(30) NOT NULL CHECK (strategy IN ('write_through', 'write_behind', 'write_around', 'cache_aside', 'refresh_ahead')),
    cache_pattern VARCHAR(30) DEFAULT 'key_value' CHECK (cache_pattern IN ('key_value', 'hash', 'list', 'set', 'sorted_set', 'stream')),
    
    -- Key patterns and namespacing
    key_pattern VARCHAR(255) NOT NULL, -- Pattern for cache keys (e.g., 'user:{user_id}:profile')
    namespace VARCHAR(100), -- Logical namespace for keys
    key_prefix VARCHAR(50), -- Environment/app prefix
    
    -- TTL and expiration
    ttl_seconds INTEGER, -- Specific TTL for this policy
    sliding_expiration BOOLEAN DEFAULT false, -- Extend TTL on access
    absolute_expiration TIMESTAMP, -- Hard expiration time
    
    -- Invalidation rules
    invalidation_events TEXT[], -- Events that trigger cache invalidation
    invalidation_patterns TEXT[], -- Key patterns to invalidate together
    dependency_keys TEXT[], -- Keys this cache depends on
    
    -- Performance optimization
    preload_enabled BOOLEAN DEFAULT false, -- Preload cache on startup
    background_refresh BOOLEAN DEFAULT false, -- Refresh in background before expiry
    compression_threshold INTEGER DEFAULT 1024, -- Compress values larger than this
    
    -- Access control and security
    encryption_enabled BOOLEAN DEFAULT false,
    access_roles TEXT[], -- Roles that can access this cache
    rate_limit_per_minute INTEGER, -- Rate limit for cache operations
    
    -- Monitoring and analytics
    hit_rate_threshold DECIMAL(5,4) DEFAULT 0.8000, -- Minimum expected hit rate
    performance_tracking BOOLEAN DEFAULT true,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- CDN Configuration and Management
CREATE TABLE cdn_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cdn_provider VARCHAR(50) NOT NULL, -- 'cloudflare', 'aws_cloudfront', 'azure_cdn', 'google_cdn', 'custom'
    cdn_name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    
    -- CDN settings
    origin_domain VARCHAR(255) NOT NULL, -- Origin server domain
    cdn_domain VARCHAR(255), -- CDN domain/subdomain
    ssl_enabled BOOLEAN DEFAULT true,
    ssl_certificate_config JSONB, -- SSL certificate configuration
    
    -- Caching behavior
    default_cache_ttl INTEGER DEFAULT 86400, -- 24 hours
    browser_cache_ttl INTEGER DEFAULT 3600, -- 1 hour
    cache_control_headers JSONB, -- Custom cache control headers
    
    -- Geographic distribution
    edge_locations TEXT[], -- Enabled edge locations/regions
    geo_restrictions JSONB, -- Geographic access restrictions
    
    -- Performance optimization
    compression_enabled BOOLEAN DEFAULT true,
    compression_types TEXT[] DEFAULT ARRAY['text/html', 'text/css', 'text/javascript', 'application/json'],
    minification_enabled BOOLEAN DEFAULT true,
    http2_enabled BOOLEAN DEFAULT true,
    
    -- Security features
    ddos_protection BOOLEAN DEFAULT true,
    waf_enabled BOOLEAN DEFAULT true,
    hotlink_protection BOOLEAN DEFAULT false,
    secure_headers JSONB, -- Security headers configuration
    
    -- Content types and rules
    static_content_patterns TEXT[] DEFAULT ARRAY['*.css', '*.js', '*.png', '*.jpg', '*.jpeg', '*.gif', '*.svg', '*.ico', '*.woff', '*.woff2'],
    dynamic_content_patterns TEXT[],
    bypass_patterns TEXT[], -- Patterns to bypass CDN
    
    -- API configuration
    api_credentials JSONB, -- Encrypted API credentials
    webhook_url VARCHAR(255), -- Webhook for CDN events
    
    -- Monitoring and analytics
    analytics_enabled BOOLEAN DEFAULT true,
    real_user_monitoring BOOLEAN DEFAULT true,
    synthetic_monitoring BOOLEAN DEFAULT false,
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Cloud Storage Integration
CREATE TABLE cloud_storage_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider VARCHAR(50) NOT NULL, -- 'aws_s3', 'google_cloud', 'azure_blob', 'digitalocean_spaces', 'custom'
    storage_name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    
    -- Storage configuration
    bucket_name VARCHAR(255) NOT NULL,
    region VARCHAR(50),
    endpoint VARCHAR(255), -- Custom endpoint for S3-compatible services
    
    -- Access configuration
    access_credentials JSONB NOT NULL, -- Encrypted access credentials
    public_access_enabled BOOLEAN DEFAULT false,
    signed_urls_enabled BOOLEAN DEFAULT true,
    signed_url_expiry_hours INTEGER DEFAULT 24,
    
    -- Storage classes and lifecycle
    default_storage_class VARCHAR(50) DEFAULT 'standard',
    lifecycle_policies JSONB, -- Automatic lifecycle management
    versioning_enabled BOOLEAN DEFAULT false,
    
    -- Security and encryption
    encryption_enabled BOOLEAN DEFAULT true,
    encryption_algorithm VARCHAR(50) DEFAULT 'AES256',
    kms_key_id VARCHAR(255), -- KMS key for encryption
    
    -- Content delivery
    cdn_integration_id UUID REFERENCES cdn_configurations(id),
    custom_domain VARCHAR(255),
    cors_configuration JSONB, -- CORS settings
    
    -- File management
    allowed_file_types TEXT[], -- Allowed MIME types
    max_file_size_mb INTEGER DEFAULT 100,
    virus_scanning_enabled BOOLEAN DEFAULT false,
    
    -- Backup and replication
    backup_enabled BOOLEAN DEFAULT true,
    replication_regions TEXT[],
    cross_region_replication BOOLEAN DEFAULT false,
    
    -- Cost optimization
    intelligent_tiering BOOLEAN DEFAULT false,
    data_transfer_optimization BOOLEAN DEFAULT true,
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Performance Monitoring and Analytics
CREATE TABLE performance_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_type VARCHAR(50) NOT NULL, -- 'cache_hit_rate', 'response_time', 'throughput', 'error_rate', 'cdn_bandwidth'
    service_type VARCHAR(50) NOT NULL, -- 'cache', 'cdn', 'storage', 'database', 'application'
    service_id UUID, -- Reference to specific service configuration
    
    -- Metric data
    metric_timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
    metric_value DECIMAL(15,6) NOT NULL,
    metric_unit VARCHAR(20), -- 'ms', 'seconds', 'percentage', 'bytes', 'requests'
    
    -- Context and dimensions
    endpoint VARCHAR(255), -- API endpoint or resource
    region VARCHAR(50),
    user_agent_category VARCHAR(50), -- mobile, desktop, bot
    request_source VARCHAR(100), -- IP or source identifier
    
    -- Performance breakdown
    cache_status VARCHAR(20), -- hit, miss, bypass, expired
    response_size_bytes BIGINT,
    processing_time_ms INTEGER,
    network_latency_ms INTEGER,
    
    -- Additional metadata
    tags JSONB, -- Additional tags and metadata
    trace_id VARCHAR(100), -- Distributed tracing ID
    
    -- Aggregation helpers
    date_hour TIMESTAMP GENERATED ALWAYS AS (DATE_TRUNC('hour', metric_timestamp)) STORED,
    date_day DATE GENERATED ALWAYS AS (metric_timestamp::date) STORED,
    
    created_at TIMESTAMP DEFAULT NOW()
);

-- Cache Performance Tracking
CREATE TABLE cache_performance_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cache_config_id UUID NOT NULL REFERENCES cache_configurations(id) ON DELETE CASCADE,
    policy_id UUID REFERENCES cache_policies(id) ON DELETE SET NULL,
    
    -- Operation details
    operation_type VARCHAR(20) NOT NULL CHECK (operation_type IN ('get', 'set', 'delete', 'flush', 'increment', 'expire')),
    cache_key VARCHAR(500) NOT NULL,
    operation_timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
    
    -- Performance metrics
    execution_time_ms DECIMAL(10,6) NOT NULL,
    result_status VARCHAR(20) NOT NULL, -- hit, miss, error, timeout
    data_size_bytes INTEGER,
    
    -- Context
    calling_service VARCHAR(100),
    endpoint VARCHAR(255),
    user_context JSONB, -- User ID, school ID, etc.
    
    -- Error handling
    error_code VARCHAR(50),
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    
    -- Optimization tracking
    compression_ratio DECIMAL(5,4), -- Compression effectiveness
    serialization_time_ms DECIMAL(8,4),
    network_time_ms DECIMAL(8,4),
    
    created_at TIMESTAMP DEFAULT NOW()
);

-- CDN Analytics and Performance
CREATE TABLE cdn_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cdn_config_id UUID NOT NULL REFERENCES cdn_configurations(id) ON DELETE CASCADE,
    
    -- Request details
    request_timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
    request_url VARCHAR(1000) NOT NULL,
    request_method VARCHAR(10) DEFAULT 'GET',
    
    -- Response details
    response_status INTEGER NOT NULL,
    response_size_bytes BIGINT,
    response_time_ms INTEGER,
    
    -- Cache performance
    cache_status VARCHAR(20), -- hit, miss, bypass, dynamic
    edge_location VARCHAR(100), -- Which edge location served the request
    origin_response_time_ms INTEGER, -- Time to fetch from origin
    
    -- Client information
    client_ip VARCHAR(45), -- IPv4 or IPv6
    client_country VARCHAR(2), -- ISO country code
    client_region VARCHAR(100),
    user_agent TEXT,
    referer VARCHAR(1000),
    
    -- Content details
    content_type VARCHAR(100),
    content_encoding VARCHAR(50),
    
    -- Security events
    security_events JSONB, -- WAF blocks, DDoS mitigation, etc.
    
    -- Optimization metrics
    compression_ratio DECIMAL(5,4),
    bandwidth_saved_bytes BIGINT,
    
    created_at TIMESTAMP DEFAULT NOW()
);

-- Cloud Optimization Configurations
CREATE TABLE optimization_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_name VARCHAR(100) UNIQUE NOT NULL,
    rule_type VARCHAR(50) NOT NULL, -- 'cache_warming', 'preloading', 'cleanup', 'scaling', 'cost_optimization'
    description TEXT,
    
    -- Rule configuration
    rule_config JSONB NOT NULL, -- Rule-specific configuration
    trigger_conditions JSONB, -- When to execute the rule
    execution_schedule VARCHAR(100), -- Cron expression or schedule
    
    -- Scope and targeting
    target_services TEXT[], -- Which services this rule applies to
    environment_filter VARCHAR(20), -- development, staging, production
    region_filter TEXT[], -- Specific regions
    
    -- Execution settings
    execution_timeout_minutes INTEGER DEFAULT 30,
    max_concurrent_executions INTEGER DEFAULT 1,
    retry_policy JSONB, -- Retry configuration
    
    -- Impact and monitoring
    expected_impact JSONB, -- Expected performance/cost impact
    success_metrics TEXT[], -- Metrics to track success
    rollback_enabled BOOLEAN DEFAULT true,
    
    -- Status and control
    is_active BOOLEAN DEFAULT true,
    last_execution TIMESTAMP,
    next_execution TIMESTAMP,
    execution_count INTEGER DEFAULT 0,
    
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Cloud Cost Tracking and Optimization
CREATE TABLE cloud_cost_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_type VARCHAR(50) NOT NULL, -- 'cache', 'cdn', 'storage', 'compute', 'database', 'network'
    service_id UUID, -- Reference to specific service
    service_name VARCHAR(100),
    
    -- Cost details
    billing_period_start DATE NOT NULL,
    billing_period_end DATE NOT NULL,
    cost_amount DECIMAL(12,4) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    
    -- Usage metrics
    usage_quantity DECIMAL(15,6),
    usage_unit VARCHAR(50), -- GB, requests, hours, etc.
    tier_or_plan VARCHAR(100), -- Service tier or pricing plan
    
    -- Cost breakdown
    base_cost DECIMAL(12,4),
    usage_cost DECIMAL(12,4),
    additional_fees DECIMAL(12,4),
    discounts_applied DECIMAL(12,4),
    tax_amount DECIMAL(12,4),
    
    -- Geographic and regional
    region VARCHAR(50),
    availability_zone VARCHAR(50),
    
    -- Optimization opportunities
    optimization_suggestions JSONB, -- Cost optimization recommendations
    potential_savings DECIMAL(12,4),
    
    -- Metadata
    provider VARCHAR(50),
    account_id VARCHAR(100),
    resource_tags JSONB,
    
    created_at TIMESTAMP DEFAULT NOW()
);

-- System Health and Monitoring
CREATE TABLE system_health_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    check_type VARCHAR(50) NOT NULL, -- 'cache_connectivity', 'cdn_status', 'storage_health', 'performance_threshold'
    service_type VARCHAR(50) NOT NULL,
    service_id UUID,
    
    -- Check details
    check_timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
    check_status VARCHAR(20) NOT NULL CHECK (check_status IN ('healthy', 'warning', 'critical', 'unknown')),
    response_time_ms INTEGER,
    
    -- Health metrics
    availability_percentage DECIMAL(5,2),
    error_rate_percentage DECIMAL(5,2),
    throughput_per_second DECIMAL(10,2),
    
    -- Thresholds and alerts
    warning_threshold DECIMAL(10,4),
    critical_threshold DECIMAL(10,4),
    alert_triggered BOOLEAN DEFAULT false,
    alert_message TEXT,
    
    -- Additional details
    check_details JSONB, -- Detailed check results
    remediation_suggestions TEXT[],
    
    -- Follow-up
    acknowledged_by UUID REFERENCES users(id),
    acknowledged_at TIMESTAMP,
    resolved_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance optimization
CREATE INDEX idx_cache_configurations_type ON cache_configurations(cache_type);
CREATE INDEX idx_cache_configurations_active ON cache_configurations(is_active) WHERE is_active = true;
CREATE INDEX idx_cache_configurations_environment ON cache_configurations(environment);

CREATE INDEX idx_cache_policies_config ON cache_policies(cache_config_id);
CREATE INDEX idx_cache_policies_strategy ON cache_policies(strategy);
CREATE INDEX idx_cache_policies_pattern ON cache_policies(key_pattern);

CREATE INDEX idx_cdn_configurations_provider ON cdn_configurations(cdn_provider);
CREATE INDEX idx_cdn_configurations_active ON cdn_configurations(is_active) WHERE is_active = true;
CREATE INDEX idx_cdn_configurations_domain ON cdn_configurations(cdn_domain);

CREATE INDEX idx_cloud_storage_provider ON cloud_storage_configurations(provider);
CREATE INDEX idx_cloud_storage_active ON cloud_storage_configurations(is_active) WHERE is_active = true;
CREATE INDEX idx_cloud_storage_bucket ON cloud_storage_configurations(bucket_name);

CREATE INDEX idx_performance_metrics_type ON performance_metrics(metric_type);
CREATE INDEX idx_performance_metrics_service ON performance_metrics(service_type, service_id);
CREATE INDEX idx_performance_metrics_timestamp ON performance_metrics(metric_timestamp);
CREATE INDEX idx_performance_metrics_hour ON performance_metrics(date_hour);
CREATE INDEX idx_performance_metrics_day ON performance_metrics(date_day);

CREATE INDEX idx_cache_performance_config ON cache_performance_logs(cache_config_id);
CREATE INDEX idx_cache_performance_timestamp ON cache_performance_logs(operation_timestamp);
CREATE INDEX idx_cache_performance_status ON cache_performance_logs(result_status);
CREATE INDEX idx_cache_performance_operation ON cache_performance_logs(operation_type);

CREATE INDEX idx_cdn_analytics_config ON cdn_analytics(cdn_config_id);
CREATE INDEX idx_cdn_analytics_timestamp ON cdn_analytics(request_timestamp);
CREATE INDEX idx_cdn_analytics_status ON cdn_analytics(response_status);
CREATE INDEX idx_cdn_analytics_location ON cdn_analytics(edge_location);

CREATE INDEX idx_optimization_rules_type ON optimization_rules(rule_type);
CREATE INDEX idx_optimization_rules_active ON optimization_rules(is_active) WHERE is_active = true;
CREATE INDEX idx_optimization_rules_next_execution ON optimization_rules(next_execution) WHERE is_active = true;

CREATE INDEX idx_cloud_cost_service ON cloud_cost_tracking(service_type, service_id);
CREATE INDEX idx_cloud_cost_period ON cloud_cost_tracking(billing_period_start, billing_period_end);
CREATE INDEX idx_cloud_cost_amount ON cloud_cost_tracking(cost_amount);

CREATE INDEX idx_system_health_type ON system_health_checks(check_type);
CREATE INDEX idx_system_health_service ON system_health_checks(service_type, service_id);
CREATE INDEX idx_system_health_timestamp ON system_health_checks(check_timestamp);
CREATE INDEX idx_system_health_status ON system_health_checks(check_status);

-- RLS Policies for cloud optimization tables
ALTER TABLE optimization_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY optimization_rules_admin_access ON optimization_rules 
    FOR ALL USING (current_setting('app.current_user_role') IN ('super_admin', 'edufam_admin', 'technical_admin'));

ALTER TABLE cloud_cost_tracking ENABLE ROW LEVEL SECURITY;
CREATE POLICY cloud_cost_tracking_admin_access ON cloud_cost_tracking 
    FOR ALL USING (current_setting('app.current_user_role') IN ('super_admin', 'edufam_admin', 'financial_admin'));

ALTER TABLE system_health_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY system_health_checks_monitoring_access ON system_health_checks 
    FOR ALL USING (current_setting('app.current_user_role') IN ('super_admin', 'edufam_admin', 'technical_admin', 'monitoring_user'));

-- Initial configuration data
INSERT INTO cache_configurations (cache_type, cache_name, description, connection_config, default_ttl, max_memory_mb) VALUES
('redis', 'primary_redis', 'Primary Redis cache for application data', '{"host": "localhost", "port": 6379, "db": 0}', 3600, 512),
('redis', 'session_redis', 'Redis cache for user sessions', '{"host": "localhost", "port": 6379, "db": 1}', 86400, 256),
('application', 'in_memory', 'In-memory application cache', '{"type": "node_cache"}', 300, 128)
ON CONFLICT (cache_name) DO NOTHING;

INSERT INTO cache_policies (policy_name, cache_config_id, strategy, key_pattern, ttl_seconds, namespace, description) VALUES
('user_profiles', (SELECT id FROM cache_configurations WHERE cache_name = 'primary_redis'), 'cache_aside', 'user:{user_id}:profile', 7200, 'users', 'User profile caching'),
('school_data', (SELECT id FROM cache_configurations WHERE cache_name = 'primary_redis'), 'write_through', 'school:{school_id}:data', 14400, 'schools', 'School information caching'),
('session_data', (SELECT id FROM cache_configurations WHERE cache_name = 'session_redis'), 'write_through', 'session:{session_id}', 86400, 'sessions', 'User session data'),
('api_responses', (SELECT id FROM cache_configurations WHERE cache_name = 'primary_redis'), 'cache_aside', 'api:{endpoint}:{params_hash}', 1800, 'api', 'API response caching'),
('static_content', (SELECT id FROM cache_configurations WHERE cache_name = 'in_memory'), 'cache_aside', 'static:{resource_path}', 3600, 'static', 'Static content caching')
ON CONFLICT (policy_name) DO NOTHING;

INSERT INTO cdn_configurations (cdn_provider, cdn_name, description, origin_domain, default_cache_ttl, compression_enabled) VALUES
('cloudflare', 'main_cdn', 'Primary CDN for static assets and API responses', 'api.edufam.com', 86400, true),
('aws_cloudfront', 'file_cdn', 'CDN for file uploads and documents', 'files.edufam.com', 604800, true)
ON CONFLICT (cdn_name) DO NOTHING;

INSERT INTO cloud_storage_configurations (provider, storage_name, description, bucket_name, region, encryption_enabled) VALUES
('aws_s3', 'primary_storage', 'Primary storage for user uploads and documents', 'edufam-primary-storage', 'us-east-1', true),
('aws_s3', 'backup_storage', 'Backup storage for critical data', 'edufam-backup-storage', 'us-west-2', true),
('google_cloud', 'media_storage', 'Storage for media files and images', 'edufam-media-storage', 'us-central1', true)
ON CONFLICT (storage_name) DO NOTHING;