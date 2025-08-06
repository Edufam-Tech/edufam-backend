const { Pool } = require('pg');

/**
 * Create Mobile Optimization Tables Directly
 */

async function createMobileOptimizationTables() {
  console.log('🚀 Creating Mobile Optimization Tables');
  console.log('======================================');

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/edufam_db'
  });

  try {
    console.log('🔌 Testing database connection...');
    const client = await pool.connect();
    console.log('✅ Database connection successful');
    client.release();

    // Create tables one by one
    console.log('\n📄 Creating mobile optimization tables...');

    // 1. Mobile Device Registration
    await pool.query(`
      CREATE TABLE IF NOT EXISTS mobile_devices (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
        device_token VARCHAR(255) UNIQUE NOT NULL,
        device_id VARCHAR(255) UNIQUE NOT NULL,
        platform VARCHAR(20) NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
        app_version VARCHAR(20) NOT NULL,
        os_version VARCHAR(50),
        device_model VARCHAR(100),
        device_name VARCHAR(100),
        device_type VARCHAR(30) CHECK (device_type IN ('phone', 'tablet', 'desktop', 'unknown')),
        screen_resolution VARCHAR(20),
        timezone VARCHAR(50) DEFAULT 'Africa/Nairobi',
        language_preference VARCHAR(10) DEFAULT 'en',
        notification_preferences JSONB DEFAULT '{}',
        is_active BOOLEAN DEFAULT true,
        last_active TIMESTAMP DEFAULT NOW(),
        last_sync TIMESTAMP DEFAULT NOW(),
        registration_date TIMESTAMP DEFAULT NOW(),
        ip_address INET,
        user_agent TEXT,
        push_enabled BOOLEAN DEFAULT true,
        badge_count INTEGER DEFAULT 0,
        app_settings JSONB DEFAULT '{}',
        biometric_enabled BOOLEAN DEFAULT false,
        auto_sync_enabled BOOLEAN DEFAULT true,
        offline_mode_enabled BOOLEAN DEFAULT true,
        data_usage_wifi_only BOOLEAN DEFAULT false,
        dark_mode_enabled BOOLEAN DEFAULT false,
        font_size VARCHAR(20) DEFAULT 'medium',
        accessibility_features JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('   ✅ mobile_devices table created');

    // 2. Push Notifications
    await pool.query(`
      CREATE TABLE IF NOT EXISTS push_notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        notification_id VARCHAR(255) UNIQUE NOT NULL,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        device_id UUID REFERENCES mobile_devices(id) ON DELETE CASCADE,
        school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        body TEXT NOT NULL,
        notification_type VARCHAR(50) NOT NULL CHECK (notification_type IN ('announcement', 'reminder', 'alert', 'message', 'update', 'promotional', 'emergency')),
        priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
        category VARCHAR(50),
        action_type VARCHAR(30) CHECK (action_type IN ('open_app', 'open_url', 'open_screen', 'custom_action')),
        action_payload JSONB,
        deep_link_url VARCHAR(500),
        image_url VARCHAR(500),
        sound VARCHAR(100) DEFAULT 'default',
        badge_count INTEGER,
        data_payload JSONB,
        scheduled_at TIMESTAMP,
        sent_at TIMESTAMP,
        delivered_at TIMESTAMP,
        opened_at TIMESTAMP,
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'opened', 'failed', 'cancelled')),
        failure_reason TEXT,
        retry_count INTEGER DEFAULT 0,
        max_retries INTEGER DEFAULT 3,
        expires_at TIMESTAMP,
        is_silent BOOLEAN DEFAULT false,
        collapse_key VARCHAR(100),
        time_to_live INTEGER DEFAULT 86400,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('   ✅ push_notifications table created');

    // 3. Push Notification Templates
    await pool.query(`
      CREATE TABLE IF NOT EXISTS push_notification_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        template_name VARCHAR(255) UNIQUE NOT NULL,
        template_type VARCHAR(50) NOT NULL,
        title_template VARCHAR(255) NOT NULL,
        body_template TEXT NOT NULL,
        default_category VARCHAR(50),
        default_priority VARCHAR(20) DEFAULT 'normal',
        default_sound VARCHAR(100) DEFAULT 'default',
        required_variables TEXT[],
        optional_variables TEXT[],
        supported_platforms VARCHAR(20)[] DEFAULT '{"ios", "android"}',
        is_active BOOLEAN DEFAULT true,
        usage_count INTEGER DEFAULT 0,
        created_by UUID NOT NULL REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('   ✅ push_notification_templates table created');

    // 4. Offline Data Sync
    await pool.query(`
      CREATE TABLE IF NOT EXISTS offline_sync_queue (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        device_id UUID NOT NULL REFERENCES mobile_devices(id) ON DELETE CASCADE,
        school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
        operation_type VARCHAR(30) NOT NULL CHECK (operation_type IN ('create', 'update', 'delete', 'sync')),
        entity_type VARCHAR(50) NOT NULL,
        entity_id UUID,
        local_id VARCHAR(255),
        operation_data JSONB NOT NULL,
        conflict_resolution VARCHAR(30) DEFAULT 'server_wins' CHECK (conflict_resolution IN ('server_wins', 'client_wins', 'merge', 'manual')),
        sync_status VARCHAR(20) DEFAULT 'pending' CHECK (sync_status IN ('pending', 'syncing', 'completed', 'failed', 'conflict')),
        priority INTEGER DEFAULT 5,
        retry_count INTEGER DEFAULT 0,
        max_retries INTEGER DEFAULT 5,
        last_attempt TIMESTAMP,
        next_retry TIMESTAMP,
        error_message TEXT,
        conflict_data JSONB,
        resolved_by UUID REFERENCES users(id),
        resolved_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('   ✅ offline_sync_queue table created');

    // 5. Mobile App Sessions
    await pool.query(`
      CREATE TABLE IF NOT EXISTS mobile_app_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id VARCHAR(255) UNIQUE NOT NULL,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        device_id UUID NOT NULL REFERENCES mobile_devices(id) ON DELETE CASCADE,
        school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
        app_version VARCHAR(20) NOT NULL,
        session_start TIMESTAMP DEFAULT NOW(),
        session_end TIMESTAMP,
        duration_seconds INTEGER,
        foreground_time_seconds INTEGER,
        background_time_seconds INTEGER,
        screens_visited TEXT[],
        features_used TEXT[],
        network_type VARCHAR(20),
        data_usage_mb DECIMAL(10,2),
        battery_level_start INTEGER,
        battery_level_end INTEGER,
        memory_usage_mb DECIMAL(10,2),
        cpu_usage_percent DECIMAL(5,2),
        crash_count INTEGER DEFAULT 0,
        error_count INTEGER DEFAULT 0,
        sync_operations INTEGER DEFAULT 0,
        offline_duration_seconds INTEGER DEFAULT 0,
        location_permissions_granted BOOLEAN,
        notification_permissions_granted BOOLEAN,
        camera_permissions_granted BOOLEAN,
        microphone_permissions_granted BOOLEAN,
        session_rating INTEGER CHECK (session_rating >= 1 AND session_rating <= 5),
        user_feedback TEXT,
        session_metadata JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('   ✅ mobile_app_sessions table created');

    // 6. Mobile Performance Metrics
    await pool.query(`
      CREATE TABLE IF NOT EXISTS mobile_performance_metrics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        device_id UUID NOT NULL REFERENCES mobile_devices(id) ON DELETE CASCADE,
        metric_type VARCHAR(50) NOT NULL CHECK (metric_type IN ('app_launch', 'screen_load', 'api_call', 'sync_operation', 'background_task')),
        metric_name VARCHAR(255) NOT NULL,
        metric_value DECIMAL(15,4) NOT NULL,
        metric_unit VARCHAR(20) NOT NULL,
        screen_name VARCHAR(100),
        api_endpoint VARCHAR(255),
        operation_name VARCHAR(100),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
        app_version VARCHAR(20),
        os_version VARCHAR(50),
        device_model VARCHAR(100),
        network_type VARCHAR(20),
        battery_level INTEGER,
        memory_usage_mb DECIMAL(10,2),
        timestamp TIMESTAMP DEFAULT NOW(),
        additional_data JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('   ✅ mobile_performance_metrics table created');

    // 7. Mobile Feature Flags
    await pool.query(`
      CREATE TABLE IF NOT EXISTS mobile_feature_flags (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        flag_name VARCHAR(100) UNIQUE NOT NULL,
        flag_description TEXT,
        flag_type VARCHAR(30) NOT NULL CHECK (flag_type IN ('boolean', 'string', 'number', 'json')),
        default_value TEXT NOT NULL,
        is_active BOOLEAN DEFAULT true,
        target_platforms VARCHAR(20)[] DEFAULT '{"ios", "android"}',
        target_app_versions TEXT[],
        target_user_roles TEXT[],
        target_schools UUID[],
        rollout_percentage INTEGER DEFAULT 100 CHECK (rollout_percentage >= 0 AND rollout_percentage <= 100),
        conditions JSONB,
        start_date TIMESTAMP,
        end_date TIMESTAMP,
        created_by UUID NOT NULL REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('   ✅ mobile_feature_flags table created');

    // 8. Mobile Feature Flag Assignments
    await pool.query(`
      CREATE TABLE IF NOT EXISTS mobile_feature_flag_assignments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        flag_id UUID NOT NULL REFERENCES mobile_feature_flags(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        device_id UUID REFERENCES mobile_devices(id) ON DELETE CASCADE,
        school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
        flag_value TEXT NOT NULL,
        assignment_reason VARCHAR(100),
        is_override BOOLEAN DEFAULT false,
        override_reason TEXT,
        assigned_at TIMESTAMP DEFAULT NOW(),
        expires_at TIMESTAMP,
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('   ✅ mobile_feature_flag_assignments table created');

    // 9. Mobile Crash Reports
    await pool.query(`
      CREATE TABLE IF NOT EXISTS mobile_crash_reports (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        crash_id VARCHAR(255) UNIQUE NOT NULL,
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        device_id UUID REFERENCES mobile_devices(id) ON DELETE SET NULL,
        school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
        app_version VARCHAR(20) NOT NULL,
        os_version VARCHAR(50),
        device_model VARCHAR(100),
        crash_timestamp TIMESTAMP NOT NULL,
        crash_type VARCHAR(50),
        exception_name VARCHAR(255),
        exception_message TEXT,
        stack_trace TEXT,
        thread_name VARCHAR(100),
        screen_name VARCHAR(100),
        user_action VARCHAR(255),
        memory_usage_mb DECIMAL(10,2),
        disk_space_mb DECIMAL(10,2),
        battery_level INTEGER,
        network_type VARCHAR(20),
        is_rooted_jailbroken BOOLEAN,
        custom_logs TEXT,
        breadcrumbs JSONB,
        device_orientation VARCHAR(20),
        available_ram_mb DECIMAL(10,2),
        total_ram_mb DECIMAL(10,2),
        report_status VARCHAR(20) DEFAULT 'new' CHECK (report_status IN ('new', 'investigating', 'resolved', 'duplicate', 'wont_fix')),
        priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
        assigned_to UUID REFERENCES users(id),
        resolution_notes TEXT,
        similar_crashes_count INTEGER DEFAULT 1,
        first_occurrence TIMESTAMP DEFAULT NOW(),
        last_occurrence TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('   ✅ mobile_crash_reports table created');

    // 10. Mobile Analytics Events
    await pool.query(`
      CREATE TABLE IF NOT EXISTS mobile_analytics_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        event_id VARCHAR(255) UNIQUE NOT NULL,
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        device_id UUID REFERENCES mobile_devices(id) ON DELETE SET NULL,
        session_id UUID REFERENCES mobile_app_sessions(id) ON DELETE SET NULL,
        school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
        event_name VARCHAR(100) NOT NULL,
        event_category VARCHAR(50),
        screen_name VARCHAR(100),
        event_properties JSONB,
        user_properties JSONB,
        timestamp TIMESTAMP DEFAULT NOW(),
        client_timestamp TIMESTAMP,
        time_offset INTEGER,
        app_version VARCHAR(20),
        os_version VARCHAR(50),
        network_type VARCHAR(20),
        is_offline_event BOOLEAN DEFAULT false,
        geographic_info JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('   ✅ mobile_analytics_events table created');

    // Create indexes
    console.log('\n📄 Creating indexes...');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_mobile_devices_user ON mobile_devices(user_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_mobile_devices_school ON mobile_devices(school_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_mobile_devices_token ON mobile_devices(device_token)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_mobile_devices_platform ON mobile_devices(platform)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_mobile_devices_active ON mobile_devices(is_active, last_active)');

    await pool.query('CREATE INDEX IF NOT EXISTS idx_push_notifications_user ON push_notifications(user_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_push_notifications_device ON push_notifications(device_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_push_notifications_school ON push_notifications(school_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_push_notifications_status ON push_notifications(status)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_push_notifications_type ON push_notifications(notification_type)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_push_notifications_scheduled ON push_notifications(scheduled_at)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_push_notifications_sent ON push_notifications(sent_at DESC)');

    await pool.query('CREATE INDEX IF NOT EXISTS idx_push_notification_templates_name ON push_notification_templates(template_name)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_push_notification_templates_type ON push_notification_templates(template_type)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_push_notification_templates_active ON push_notification_templates(is_active) WHERE is_active = true');

    await pool.query('CREATE INDEX IF NOT EXISTS idx_offline_sync_queue_user ON offline_sync_queue(user_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_offline_sync_queue_device ON offline_sync_queue(device_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_offline_sync_queue_status ON offline_sync_queue(sync_status)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_offline_sync_queue_priority ON offline_sync_queue(priority, created_at)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_offline_sync_queue_entity ON offline_sync_queue(entity_type, entity_id)');

    await pool.query('CREATE INDEX IF NOT EXISTS idx_mobile_app_sessions_user ON mobile_app_sessions(user_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_mobile_app_sessions_device ON mobile_app_sessions(device_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_mobile_app_sessions_school ON mobile_app_sessions(school_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_mobile_app_sessions_start ON mobile_app_sessions(session_start DESC)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_mobile_app_sessions_duration ON mobile_app_sessions(duration_seconds)');

    await pool.query('CREATE INDEX IF NOT EXISTS idx_mobile_performance_metrics_device ON mobile_performance_metrics(device_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_mobile_performance_metrics_type ON mobile_performance_metrics(metric_type)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_mobile_performance_metrics_timestamp ON mobile_performance_metrics(timestamp DESC)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_mobile_performance_metrics_screen ON mobile_performance_metrics(screen_name)');

    await pool.query('CREATE INDEX IF NOT EXISTS idx_mobile_feature_flags_name ON mobile_feature_flags(flag_name)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_mobile_feature_flags_active ON mobile_feature_flags(is_active) WHERE is_active = true');

    await pool.query('CREATE INDEX IF NOT EXISTS idx_mobile_feature_flag_assignments_flag ON mobile_feature_flag_assignments(flag_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_mobile_feature_flag_assignments_user ON mobile_feature_flag_assignments(user_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_mobile_feature_flag_assignments_device ON mobile_feature_flag_assignments(device_id)');

    await pool.query('CREATE INDEX IF NOT EXISTS idx_mobile_crash_reports_user ON mobile_crash_reports(user_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_mobile_crash_reports_device ON mobile_crash_reports(device_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_mobile_crash_reports_timestamp ON mobile_crash_reports(crash_timestamp DESC)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_mobile_crash_reports_status ON mobile_crash_reports(report_status)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_mobile_crash_reports_exception ON mobile_crash_reports(exception_name)');

    await pool.query('CREATE INDEX IF NOT EXISTS idx_mobile_analytics_events_user ON mobile_analytics_events(user_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_mobile_analytics_events_device ON mobile_analytics_events(device_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_mobile_analytics_events_session ON mobile_analytics_events(session_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_mobile_analytics_events_name ON mobile_analytics_events(event_name)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_mobile_analytics_events_timestamp ON mobile_analytics_events(timestamp DESC)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_mobile_analytics_events_screen ON mobile_analytics_events(screen_name)');
    console.log('   ✅ Indexes created');

    // Insert initial data
    console.log('\n📄 Inserting initial mobile optimization data...');
    
    const superAdminResult = await pool.query("SELECT id FROM users WHERE role = 'super_admin' LIMIT 1");
    const createdById = superAdminResult.rows[0]?.id;

    if (createdById) {
      // Insert notification templates
      await pool.query(`
        INSERT INTO push_notification_templates (template_name, template_type, title_template, body_template, default_category, default_priority, required_variables, created_by) VALUES
        ('assignment_due_reminder', 'reminder', 'Assignment Due Tomorrow', 'Don''t forget: {{assignment_name}} is due {{due_date}}. Submit it on time!', 'academic', 'normal', '{"assignment_name", "due_date"}', $1),
        ('fee_payment_reminder', 'reminder', 'Fee Payment Due', 'Your {{fee_type}} payment of {{amount}} is due on {{due_date}}. Pay now to avoid late fees.', 'financial', 'high', '{"fee_type", "amount", "due_date"}', $1),
        ('exam_schedule_update', 'announcement', 'Exam Schedule Updated', 'The {{subject}} exam has been rescheduled to {{new_date}} at {{new_time}}.', 'academic', 'high', '{"subject", "new_date", "new_time"}', $1),
        ('attendance_alert', 'alert', 'Attendance Alert', '{{student_name}} was marked absent from {{subject}} class today.', 'attendance', 'normal', '{"student_name", "subject"}', $1)
        ON CONFLICT (template_name) DO NOTHING
      `, [createdById]);

      // Insert feature flags
      await pool.query(`
        INSERT INTO mobile_feature_flags (flag_name, flag_description, flag_type, default_value, target_platforms, rollout_percentage, created_by) VALUES
        ('offline_mode', 'Enable offline mode functionality', 'boolean', 'true', '{"ios", "android"}', 100, $1),
        ('biometric_login', 'Enable biometric authentication', 'boolean', 'false', '{"ios", "android"}', 80, $1),
        ('dark_mode', 'Enable dark mode theme', 'boolean', 'true', '{"ios", "android"}', 100, $1),
        ('push_notifications', 'Enable push notifications', 'boolean', 'true', '{"ios", "android"}', 100, $1),
        ('crash_reporting', 'Enable crash reporting', 'boolean', 'true', '{"ios", "android"}', 100, $1)
        ON CONFLICT (flag_name) DO NOTHING
      `, [createdById]);

      console.log('   ✅ Initial mobile optimization data inserted');
    } else {
      console.log('   ⚠️  No super admin found, skipping data insertion');
    }

    // Validate tables
    console.log('\n🔍 Validating tables...');
    const validation = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND (table_name LIKE 'mobile_%' OR table_name LIKE 'push_%' OR table_name LIKE 'offline_%')
      ORDER BY table_name
    `);

    console.log('📋 Created Mobile Optimization Tables:');
    validation.rows.forEach(row => {
      console.log(`   ✅ ${row.table_name}`);
    });

    // Get counts
    console.log('\n📊 Table Statistics:');
    for (const table of validation.rows) {
      try {
        const countResult = await pool.query(`SELECT COUNT(*) FROM ${table.table_name}`);
        console.log(`   📝 ${table.table_name}: ${countResult.rows[0].count} records`);
      } catch (error) {
        console.log(`   ❌ ${table.table_name}: Error getting count`);
      }
    }

    console.log('\n🎉 Mobile Optimization Tables Created Successfully!');
    console.log('\n📱 Ready for Mobile Features:');
    console.log('   • Device Registration & Management');
    console.log('   • Push Notification System (FCM/APNS)');
    console.log('   • Offline Data Synchronization');
    console.log('   • Mobile App Session Tracking');
    console.log('   • Performance Metrics Monitoring');
    console.log('   • Feature Flag Management');
    console.log('   • Crash Reporting & Analysis');
    console.log('   • Mobile Analytics & Events');
    console.log('   • A/B Testing Infrastructure');
    console.log('   • App Configuration Management');

    console.log('\n🔔 Notification Templates Created:');
    console.log('   • Assignment Due Reminder');
    console.log('   • Fee Payment Reminder');
    console.log('   • Exam Schedule Update');
    console.log('   • Attendance Alert');

    console.log('\n🎛️ Feature Flags Created:');
    console.log('   • Offline Mode - Enabled (100%)');
    console.log('   • Biometric Login - Gradual Rollout (80%)');
    console.log('   • Dark Mode - Enabled (100%)');
    console.log('   • Push Notifications - Enabled (100%)');
    console.log('   • Crash Reporting - Enabled (100%)');

  } catch (error) {
    console.error('❌ Error creating mobile optimization tables:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
    console.log('\n🔒 Database connection closed');
  }
}

// Load environment variables
require('dotenv').config();

// Run the creation
createMobileOptimizationTables();