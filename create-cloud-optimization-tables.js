const { Pool } = require('pg');

/**
 * Create Cloud Optimization Tables Directly
 */

async function createCloudOptimizationTables() {
  console.log('🚀 Creating Cloud Optimization Tables');
  console.log('====================================');

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/edufam_db'
  });

  try {
    console.log('🔌 Testing database connection...');
    const client = await pool.connect();
    console.log('✅ Database connection successful');
    client.release();

    // Create tables
    console.log('\n📄 Creating cloud optimization tables...');

    // 1. Cache Configurations
    await pool.query(`
      CREATE TABLE IF NOT EXISTS cache_configurations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        cache_type VARCHAR(50) NOT NULL,
        cache_name VARCHAR(100) UNIQUE NOT NULL,
        description TEXT,
        connection_config JSONB NOT NULL,
        pool_settings JSONB,
        default_ttl INTEGER DEFAULT 3600,
        max_memory_mb INTEGER,
        eviction_policy VARCHAR(50) DEFAULT 'allkeys-lru',
        compression_enabled BOOLEAN DEFAULT true,
        compression_algorithm VARCHAR(20) DEFAULT 'gzip',
        pipeline_enabled BOOLEAN DEFAULT true,
        clustering_enabled BOOLEAN DEFAULT false,
        monitoring_enabled BOOLEAN DEFAULT true,
        metrics_retention_days INTEGER DEFAULT 30,
        alert_thresholds JSONB,
        environment VARCHAR(20) DEFAULT 'production' CHECK (environment IN ('development', 'staging', 'production')),
        region VARCHAR(50),
        availability_zone VARCHAR(50),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('   ✅ cache_configurations table created');

    // 2. Cache Policies
    await pool.query(`
      CREATE TABLE IF NOT EXISTS cache_policies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        policy_name VARCHAR(100) UNIQUE NOT NULL,
        cache_config_id UUID NOT NULL REFERENCES cache_configurations(id) ON DELETE CASCADE,
        description TEXT,
        strategy VARCHAR(30) NOT NULL CHECK (strategy IN ('write_through', 'write_behind', 'write_around', 'cache_aside', 'refresh_ahead')),
        cache_pattern VARCHAR(30) DEFAULT 'key_value' CHECK (cache_pattern IN ('key_value', 'hash', 'list', 'set', 'sorted_set', 'stream')),
        key_pattern VARCHAR(255) NOT NULL,
        namespace VARCHAR(100),
        key_prefix VARCHAR(50),
        ttl_seconds INTEGER,
        sliding_expiration BOOLEAN DEFAULT false,
        absolute_expiration TIMESTAMP,
        invalidation_events TEXT[],
        invalidation_patterns TEXT[],
        dependency_keys TEXT[],
        preload_enabled BOOLEAN DEFAULT false,
        background_refresh BOOLEAN DEFAULT false,
        compression_threshold INTEGER DEFAULT 1024,
        encryption_enabled BOOLEAN DEFAULT false,
        access_roles TEXT[],
        rate_limit_per_minute INTEGER,
        hit_rate_threshold DECIMAL(5,4) DEFAULT 0.8000,
        performance_tracking BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('   ✅ cache_policies table created');

    // 3. CDN Configurations
    await pool.query(`
      CREATE TABLE IF NOT EXISTS cdn_configurations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        cdn_provider VARCHAR(50) NOT NULL,
        cdn_name VARCHAR(100) UNIQUE NOT NULL,
        description TEXT,
        origin_domain VARCHAR(255) NOT NULL,
        cdn_domain VARCHAR(255),
        ssl_enabled BOOLEAN DEFAULT true,
        ssl_certificate_config JSONB,
        default_cache_ttl INTEGER DEFAULT 86400,
        browser_cache_ttl INTEGER DEFAULT 3600,
        cache_control_headers JSONB,
        edge_locations TEXT[],
        geo_restrictions JSONB,
        compression_enabled BOOLEAN DEFAULT true,
        compression_types TEXT[] DEFAULT ARRAY['text/html', 'text/css', 'text/javascript', 'application/json'],
        minification_enabled BOOLEAN DEFAULT true,
        http2_enabled BOOLEAN DEFAULT true,
        ddos_protection BOOLEAN DEFAULT true,
        waf_enabled BOOLEAN DEFAULT true,
        hotlink_protection BOOLEAN DEFAULT false,
        secure_headers JSONB,
        static_content_patterns TEXT[] DEFAULT ARRAY['*.css', '*.js', '*.png', '*.jpg', '*.jpeg', '*.gif', '*.svg', '*.ico', '*.woff', '*.woff2'],
        dynamic_content_patterns TEXT[],
        bypass_patterns TEXT[],
        api_credentials JSONB,
        webhook_url VARCHAR(255),
        analytics_enabled BOOLEAN DEFAULT true,
        real_user_monitoring BOOLEAN DEFAULT true,
        synthetic_monitoring BOOLEAN DEFAULT false,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('   ✅ cdn_configurations table created');

    // 4. Cloud Storage Configurations
    await pool.query(`
      CREATE TABLE IF NOT EXISTS cloud_storage_configurations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        provider VARCHAR(50) NOT NULL,
        storage_name VARCHAR(100) UNIQUE NOT NULL,
        description TEXT,
        bucket_name VARCHAR(255) NOT NULL,
        region VARCHAR(50),
        endpoint VARCHAR(255),
        access_credentials JSONB NOT NULL,
        public_access_enabled BOOLEAN DEFAULT false,
        signed_urls_enabled BOOLEAN DEFAULT true,
        signed_url_expiry_hours INTEGER DEFAULT 24,
        default_storage_class VARCHAR(50) DEFAULT 'standard',
        lifecycle_policies JSONB,
        versioning_enabled BOOLEAN DEFAULT false,
        encryption_enabled BOOLEAN DEFAULT true,
        encryption_algorithm VARCHAR(50) DEFAULT 'AES256',
        kms_key_id VARCHAR(255),
        cdn_integration_id UUID REFERENCES cdn_configurations(id),
        custom_domain VARCHAR(255),
        cors_configuration JSONB,
        allowed_file_types TEXT[],
        max_file_size_mb INTEGER DEFAULT 100,
        virus_scanning_enabled BOOLEAN DEFAULT false,
        backup_enabled BOOLEAN DEFAULT true,
        replication_regions TEXT[],
        cross_region_replication BOOLEAN DEFAULT false,
        intelligent_tiering BOOLEAN DEFAULT false,
        data_transfer_optimization BOOLEAN DEFAULT true,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('   ✅ cloud_storage_configurations table created');

    // 5. Performance Metrics
    await pool.query(`
      CREATE TABLE IF NOT EXISTS performance_metrics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        metric_type VARCHAR(50) NOT NULL,
        service_type VARCHAR(50) NOT NULL,
        service_id UUID,
        metric_timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
        metric_value DECIMAL(15,6) NOT NULL,
        metric_unit VARCHAR(20),
        endpoint VARCHAR(255),
        region VARCHAR(50),
        user_agent_category VARCHAR(50),
        request_source VARCHAR(100),
        cache_status VARCHAR(20),
        response_size_bytes BIGINT,
        processing_time_ms INTEGER,
        network_latency_ms INTEGER,
        tags JSONB,
        trace_id VARCHAR(100),
        date_hour TIMESTAMP GENERATED ALWAYS AS (DATE_TRUNC('hour', metric_timestamp)) STORED,
        date_day DATE GENERATED ALWAYS AS (metric_timestamp::date) STORED,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('   ✅ performance_metrics table created');

    // 6. Cache Performance Logs
    await pool.query(`
      CREATE TABLE IF NOT EXISTS cache_performance_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        cache_config_id UUID NOT NULL REFERENCES cache_configurations(id) ON DELETE CASCADE,
        policy_id UUID REFERENCES cache_policies(id) ON DELETE SET NULL,
        operation_type VARCHAR(20) NOT NULL CHECK (operation_type IN ('get', 'set', 'delete', 'flush', 'increment', 'expire')),
        cache_key VARCHAR(500) NOT NULL,
        operation_timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
        execution_time_ms DECIMAL(10,6) NOT NULL,
        result_status VARCHAR(20) NOT NULL,
        data_size_bytes INTEGER,
        calling_service VARCHAR(100),
        endpoint VARCHAR(255),
        user_context JSONB,
        error_code VARCHAR(50),
        error_message TEXT,
        retry_count INTEGER DEFAULT 0,
        compression_ratio DECIMAL(5,4),
        serialization_time_ms DECIMAL(8,4),
        network_time_ms DECIMAL(8,4),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('   ✅ cache_performance_logs table created');

    // 7. CDN Analytics
    await pool.query(`
      CREATE TABLE IF NOT EXISTS cdn_analytics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        cdn_config_id UUID NOT NULL REFERENCES cdn_configurations(id) ON DELETE CASCADE,
        request_timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
        request_url VARCHAR(1000) NOT NULL,
        request_method VARCHAR(10) DEFAULT 'GET',
        response_status INTEGER NOT NULL,
        response_size_bytes BIGINT,
        response_time_ms INTEGER,
        cache_status VARCHAR(20),
        edge_location VARCHAR(100),
        origin_response_time_ms INTEGER,
        client_ip VARCHAR(45),
        client_country VARCHAR(2),
        client_region VARCHAR(100),
        user_agent TEXT,
        referer VARCHAR(1000),
        content_type VARCHAR(100),
        content_encoding VARCHAR(50),
        security_events JSONB,
        compression_ratio DECIMAL(5,4),
        bandwidth_saved_bytes BIGINT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('   ✅ cdn_analytics table created');

    // 8. Cloud Cost Tracking
    await pool.query(`
      CREATE TABLE IF NOT EXISTS cloud_cost_tracking (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        service_type VARCHAR(50) NOT NULL,
        service_id UUID,
        service_name VARCHAR(100),
        billing_period_start DATE NOT NULL,
        billing_period_end DATE NOT NULL,
        cost_amount DECIMAL(12,4) NOT NULL,
        currency VARCHAR(3) DEFAULT 'USD',
        usage_quantity DECIMAL(15,6),
        usage_unit VARCHAR(50),
        tier_or_plan VARCHAR(100),
        base_cost DECIMAL(12,4),
        usage_cost DECIMAL(12,4),
        additional_fees DECIMAL(12,4),
        discounts_applied DECIMAL(12,4),
        tax_amount DECIMAL(12,4),
        region VARCHAR(50),
        availability_zone VARCHAR(50),
        optimization_suggestions JSONB,
        potential_savings DECIMAL(12,4),
        provider VARCHAR(50),
        account_id VARCHAR(100),
        resource_tags JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('   ✅ cloud_cost_tracking table created');

    // 9. System Health Checks
    await pool.query(`
      CREATE TABLE IF NOT EXISTS system_health_checks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        check_type VARCHAR(50) NOT NULL,
        service_type VARCHAR(50) NOT NULL,
        service_id UUID,
        check_timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
        check_status VARCHAR(20) NOT NULL CHECK (check_status IN ('healthy', 'warning', 'critical', 'unknown')),
        response_time_ms INTEGER,
        availability_percentage DECIMAL(5,2),
        error_rate_percentage DECIMAL(5,2),
        throughput_per_second DECIMAL(10,2),
        warning_threshold DECIMAL(10,4),
        critical_threshold DECIMAL(10,4),
        alert_triggered BOOLEAN DEFAULT false,
        alert_message TEXT,
        check_details JSONB,
        remediation_suggestions TEXT[],
        acknowledged_by UUID REFERENCES users(id),
        acknowledged_at TIMESTAMP,
        resolved_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('   ✅ system_health_checks table created');

    // Create indexes
    console.log('\n📄 Creating indexes...');
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_cache_configurations_type ON cache_configurations(cache_type)',
      'CREATE INDEX IF NOT EXISTS idx_cache_configurations_active ON cache_configurations(is_active) WHERE is_active = true',
      'CREATE INDEX IF NOT EXISTS idx_cache_policies_config ON cache_policies(cache_config_id)',
      'CREATE INDEX IF NOT EXISTS idx_cdn_configurations_provider ON cdn_configurations(cdn_provider)',
      'CREATE INDEX IF NOT EXISTS idx_cloud_storage_provider ON cloud_storage_configurations(provider)',
      'CREATE INDEX IF NOT EXISTS idx_performance_metrics_type ON performance_metrics(metric_type)',
      'CREATE INDEX IF NOT EXISTS idx_performance_metrics_timestamp ON performance_metrics(metric_timestamp)',
      'CREATE INDEX IF NOT EXISTS idx_cache_performance_timestamp ON cache_performance_logs(operation_timestamp)',
      'CREATE INDEX IF NOT EXISTS idx_cdn_analytics_timestamp ON cdn_analytics(request_timestamp)',
      'CREATE INDEX IF NOT EXISTS idx_cloud_cost_service ON cloud_cost_tracking(service_type)',
      'CREATE INDEX IF NOT EXISTS idx_system_health_timestamp ON system_health_checks(check_timestamp)'
    ];

    for (const indexSQL of indexes) {
      await pool.query(indexSQL);
    }
    console.log('   ✅ Indexes created');

    // Insert initial data
    console.log('\n📄 Inserting initial data...');
    await pool.query(`
      INSERT INTO cache_configurations (cache_type, cache_name, description, connection_config, default_ttl, max_memory_mb) VALUES
      ('redis', 'primary_redis', 'Primary Redis cache for application data', '{"host": "localhost", "port": 6379, "db": 0}', 3600, 512),
      ('redis', 'session_redis', 'Redis cache for user sessions', '{"host": "localhost", "port": 6379, "db": 1}', 86400, 256),
      ('application', 'in_memory', 'In-memory application cache', '{"type": "node_cache"}', 300, 128)
      ON CONFLICT (cache_name) DO NOTHING
    `);

    await pool.query(`
      INSERT INTO cdn_configurations (cdn_provider, cdn_name, description, origin_domain, default_cache_ttl, compression_enabled) VALUES
      ('cloudflare', 'main_cdn', 'Primary CDN for static assets', 'api.edufam.com', 86400, true),
      ('aws_cloudfront', 'file_cdn', 'CDN for file uploads', 'files.edufam.com', 604800, true)
      ON CONFLICT (cdn_name) DO NOTHING
    `);

    await pool.query(`
      INSERT INTO cloud_storage_configurations (provider, storage_name, description, bucket_name, region, access_credentials, encryption_enabled) VALUES
      ('aws_s3', 'primary_storage', 'Primary storage for uploads', 'edufam-primary-storage', 'us-east-1', '{"encrypted": true}', true),
      ('aws_s3', 'backup_storage', 'Backup storage for critical data', 'edufam-backup-storage', 'us-west-2', '{"encrypted": true}', true)
      ON CONFLICT (storage_name) DO NOTHING
    `);

    console.log('   ✅ Initial data inserted');

    // Validation
    console.log('\n🔍 Validating tables...');
    const validation = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND (table_name LIKE 'cache_%' OR table_name LIKE 'cdn_%' OR table_name LIKE 'cloud_%' OR table_name LIKE 'performance_%' OR table_name LIKE 'system_%')
      ORDER BY table_name
    `);

    console.log('📋 Cloud Optimization Tables:');
    validation.rows.forEach(row => console.log(`   ✅ ${row.table_name}`));

    console.log('\n🎉 Cloud Optimization Tables Created Successfully!');
    console.log('\n☁️ Ready for Cloud Features:');
    console.log('   • Redis Caching & Performance');
    console.log('   • CDN Integration & Analytics');
    console.log('   • Cloud Storage Management');
    console.log('   • Performance Monitoring');
    console.log('   • Cost Tracking & Optimization');
    console.log('   • System Health Monitoring');
    console.log('   • Auto-scaling & Optimization Rules');

  } catch (error) {
    console.error('❌ Error creating cloud optimization tables:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
    console.log('\n🔒 Database connection closed');
  }
}

require('dotenv').config();
createCloudOptimizationTables();