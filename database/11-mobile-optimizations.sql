-- ====================================
-- MOBILE OPTIMIZATIONS SYSTEM
-- ====================================
-- Push notifications, offline sync, mobile-specific features, and app management
-- Optimized for iOS and Android mobile applications

-- Mobile Device Registration
CREATE TABLE mobile_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    device_token VARCHAR(255) UNIQUE NOT NULL, -- FCM/APNS token
    device_id VARCHAR(255) UNIQUE NOT NULL, -- Unique device identifier
    platform VARCHAR(20) NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
    app_version VARCHAR(20) NOT NULL,
    os_version VARCHAR(50),
    device_model VARCHAR(100),
    device_name VARCHAR(100), -- User-assigned device name
    device_type VARCHAR(30) CHECK (device_type IN ('phone', 'tablet', 'desktop', 'unknown')),
    screen_resolution VARCHAR(20), -- e.g., '1920x1080'
    timezone VARCHAR(50) DEFAULT 'Africa/Nairobi',
    language_preference VARCHAR(10) DEFAULT 'en',
    notification_preferences JSONB DEFAULT '{}', -- Notification settings
    is_active BOOLEAN DEFAULT true,
    last_active TIMESTAMP DEFAULT NOW(),
    last_sync TIMESTAMP DEFAULT NOW(),
    registration_date TIMESTAMP DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT,
    push_enabled BOOLEAN DEFAULT true,
    badge_count INTEGER DEFAULT 0,
    app_settings JSONB DEFAULT '{}', -- App-specific settings
    biometric_enabled BOOLEAN DEFAULT false,
    auto_sync_enabled BOOLEAN DEFAULT true,
    offline_mode_enabled BOOLEAN DEFAULT true,
    data_usage_wifi_only BOOLEAN DEFAULT false,
    dark_mode_enabled BOOLEAN DEFAULT false,
    font_size VARCHAR(20) DEFAULT 'medium',
    accessibility_features JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Push Notifications
CREATE TABLE push_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_id VARCHAR(255) UNIQUE NOT NULL, -- External notification ID
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    device_id UUID REFERENCES mobile_devices(id) ON DELETE CASCADE,
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    notification_type VARCHAR(50) NOT NULL CHECK (notification_type IN ('announcement', 'reminder', 'alert', 'message', 'update', 'promotional', 'emergency')),
    priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    category VARCHAR(50), -- ios: category identifier, android: channel id
    action_type VARCHAR(30) CHECK (action_type IN ('open_app', 'open_url', 'open_screen', 'custom_action')),
    action_payload JSONB, -- Action-specific data
    deep_link_url VARCHAR(500), -- Deep link for navigation
    image_url VARCHAR(500), -- Rich notification image
    sound VARCHAR(100) DEFAULT 'default', -- Custom sound file
    badge_count INTEGER, -- iOS badge count
    data_payload JSONB, -- Additional data
    scheduled_at TIMESTAMP, -- For scheduled notifications
    sent_at TIMESTAMP,
    delivered_at TIMESTAMP,
    opened_at TIMESTAMP,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'opened', 'failed', 'cancelled')),
    failure_reason TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    expires_at TIMESTAMP, -- Notification expiration
    is_silent BOOLEAN DEFAULT false, -- Silent notification for data sync
    collapse_key VARCHAR(100), -- For message grouping
    time_to_live INTEGER DEFAULT 86400, -- TTL in seconds (24 hours default)
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Push Notification Templates
CREATE TABLE push_notification_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_name VARCHAR(255) UNIQUE NOT NULL,
    template_type VARCHAR(50) NOT NULL,
    title_template VARCHAR(255) NOT NULL,
    body_template TEXT NOT NULL,
    default_category VARCHAR(50),
    default_priority VARCHAR(20) DEFAULT 'normal',
    default_sound VARCHAR(100) DEFAULT 'default',
    required_variables TEXT[], -- Variables needed for template
    optional_variables TEXT[],
    supported_platforms VARCHAR(20)[] DEFAULT '{"ios", "android"}',
    is_active BOOLEAN DEFAULT true,
    usage_count INTEGER DEFAULT 0,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Offline Data Sync
CREATE TABLE offline_sync_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id UUID NOT NULL REFERENCES mobile_devices(id) ON DELETE CASCADE,
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    operation_type VARCHAR(30) NOT NULL CHECK (operation_type IN ('create', 'update', 'delete', 'sync')),
    entity_type VARCHAR(50) NOT NULL, -- e.g., 'student', 'assignment', 'attendance'
    entity_id UUID, -- ID of the affected entity
    local_id VARCHAR(255), -- Local identifier for offline-created entities
    operation_data JSONB NOT NULL, -- The actual data/changes
    conflict_resolution VARCHAR(30) DEFAULT 'server_wins' CHECK (conflict_resolution IN ('server_wins', 'client_wins', 'merge', 'manual')),
    sync_status VARCHAR(20) DEFAULT 'pending' CHECK (sync_status IN ('pending', 'syncing', 'completed', 'failed', 'conflict')),
    priority INTEGER DEFAULT 5, -- 1 (highest) to 10 (lowest)
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 5,
    last_attempt TIMESTAMP,
    next_retry TIMESTAMP,
    error_message TEXT,
    conflict_data JSONB, -- Data conflicts for manual resolution
    resolved_by UUID REFERENCES users(id),
    resolved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Mobile App Sessions
CREATE TABLE mobile_app_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id VARCHAR(255) UNIQUE NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id UUID NOT NULL REFERENCES mobile_devices(id) ON DELETE CASCADE,
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    app_version VARCHAR(20) NOT NULL,
    session_start TIMESTAMP DEFAULT NOW(),
    session_end TIMESTAMP,
    duration_seconds INTEGER,
    foreground_time_seconds INTEGER, -- Time app was in foreground
    background_time_seconds INTEGER, -- Time app was in background
    screens_visited TEXT[], -- List of screens/pages visited
    features_used TEXT[], -- List of features/actions used
    network_type VARCHAR(20), -- wifi, cellular, offline
    data_usage_mb DECIMAL(10,2), -- Data consumed during session
    battery_level_start INTEGER, -- Battery level at session start
    battery_level_end INTEGER, -- Battery level at session end
    memory_usage_mb DECIMAL(10,2), -- Peak memory usage
    cpu_usage_percent DECIMAL(5,2), -- Average CPU usage
    crash_count INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    sync_operations INTEGER DEFAULT 0, -- Number of sync operations
    offline_duration_seconds INTEGER DEFAULT 0, -- Time spent offline
    location_permissions_granted BOOLEAN,
    notification_permissions_granted BOOLEAN,
    camera_permissions_granted BOOLEAN,
    microphone_permissions_granted BOOLEAN,
    session_rating INTEGER CHECK (session_rating >= 1 AND session_rating <= 5),
    user_feedback TEXT,
    session_metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Mobile App Performance Metrics
CREATE TABLE mobile_performance_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES mobile_devices(id) ON DELETE CASCADE,
    metric_type VARCHAR(50) NOT NULL CHECK (metric_type IN ('app_launch', 'screen_load', 'api_call', 'sync_operation', 'background_task')),
    metric_name VARCHAR(255) NOT NULL,
    metric_value DECIMAL(15,4) NOT NULL,
    metric_unit VARCHAR(20) NOT NULL, -- ms, seconds, mb, percentage, etc.
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
);

-- Mobile Feature Flags
CREATE TABLE mobile_feature_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flag_name VARCHAR(100) UNIQUE NOT NULL,
    flag_description TEXT,
    flag_type VARCHAR(30) NOT NULL CHECK (flag_type IN ('boolean', 'string', 'number', 'json')),
    default_value TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    target_platforms VARCHAR(20)[] DEFAULT '{"ios", "android"}',
    target_app_versions TEXT[], -- e.g., ['>=1.0.0', '<2.0.0']
    target_user_roles TEXT[], -- Specific user roles
    target_schools UUID[], -- Specific schools
    rollout_percentage INTEGER DEFAULT 100 CHECK (rollout_percentage >= 0 AND rollout_percentage <= 100),
    conditions JSONB, -- Complex conditions for flag activation
    start_date TIMESTAMP,
    end_date TIMESTAMP,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Mobile Feature Flag Assignments
CREATE TABLE mobile_feature_flag_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flag_id UUID NOT NULL REFERENCES mobile_feature_flags(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    device_id UUID REFERENCES mobile_devices(id) ON DELETE CASCADE,
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    flag_value TEXT NOT NULL, -- Actual value for this assignment
    assignment_reason VARCHAR(100), -- Why this value was assigned
    is_override BOOLEAN DEFAULT false, -- Manual override vs automatic
    override_reason TEXT,
    assigned_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Mobile Crash Reports
CREATE TABLE mobile_crash_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    crash_id VARCHAR(255) UNIQUE NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    device_id UUID REFERENCES mobile_devices(id) ON DELETE SET NULL,
    school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
    app_version VARCHAR(20) NOT NULL,
    os_version VARCHAR(50),
    device_model VARCHAR(100),
    crash_timestamp TIMESTAMP NOT NULL,
    crash_type VARCHAR(50), -- fatal, non-fatal, anr (android not responding)
    exception_name VARCHAR(255),
    exception_message TEXT,
    stack_trace TEXT,
    thread_name VARCHAR(100),
    screen_name VARCHAR(100), -- Where crash occurred
    user_action VARCHAR(255), -- What user was doing
    memory_usage_mb DECIMAL(10,2),
    disk_space_mb DECIMAL(10,2),
    battery_level INTEGER,
    network_type VARCHAR(20),
    is_rooted_jailbroken BOOLEAN,
    custom_logs TEXT,
    breadcrumbs JSONB, -- User actions leading to crash
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
);

-- Mobile A/B Testing
CREATE TABLE mobile_ab_tests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_name VARCHAR(255) UNIQUE NOT NULL,
    test_description TEXT,
    test_type VARCHAR(30) NOT NULL CHECK (test_type IN ('feature', 'ui', 'performance', 'content')),
    test_status VARCHAR(20) DEFAULT 'draft' CHECK (test_status IN ('draft', 'active', 'paused', 'completed', 'cancelled')),
    target_platforms VARCHAR(20)[] DEFAULT '{"ios", "android"}',
    target_app_versions TEXT[],
    target_user_segments TEXT[], -- e.g., 'new_users', 'teachers', 'students'
    variants JSONB NOT NULL, -- Test variants with their configurations
    traffic_allocation JSONB NOT NULL, -- Percentage allocation per variant
    success_metrics TEXT[], -- Metrics to track for success
    minimum_sample_size INTEGER DEFAULT 1000,
    confidence_level DECIMAL(3,2) DEFAULT 0.95,
    expected_effect_size DECIMAL(5,4), -- Expected improvement
    start_date TIMESTAMP,
    end_date TIMESTAMP,
    results JSONB, -- Test results and statistics
    winner_variant VARCHAR(100),
    statistical_significance BOOLEAN,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Mobile A/B Test Assignments
CREATE TABLE mobile_ab_test_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_id UUID NOT NULL REFERENCES mobile_ab_tests(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    device_id UUID REFERENCES mobile_devices(id) ON DELETE CASCADE,
    variant_name VARCHAR(100) NOT NULL,
    assignment_timestamp TIMESTAMP DEFAULT NOW(),
    first_interaction TIMESTAMP,
    conversion_events JSONB, -- Tracked conversion events
    session_count INTEGER DEFAULT 0,
    total_time_seconds INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Mobile Analytics Events
CREATE TABLE mobile_analytics_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id VARCHAR(255) UNIQUE NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    device_id UUID REFERENCES mobile_devices(id) ON DELETE SET NULL,
    session_id UUID REFERENCES mobile_app_sessions(id) ON DELETE SET NULL,
    school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
    event_name VARCHAR(100) NOT NULL,
    event_category VARCHAR(50), -- screen_view, user_action, error, performance
    screen_name VARCHAR(100),
    event_properties JSONB, -- Custom event properties
    user_properties JSONB, -- User properties at time of event
    timestamp TIMESTAMP DEFAULT NOW(),
    client_timestamp TIMESTAMP, -- Timestamp from client device
    time_offset INTEGER, -- Offset between client and server time
    app_version VARCHAR(20),
    os_version VARCHAR(50),
    network_type VARCHAR(20),
    is_offline_event BOOLEAN DEFAULT false, -- Event captured while offline
    geographic_info JSONB, -- Country, region, city if available
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_mobile_devices_user ON mobile_devices(user_id);
CREATE INDEX idx_mobile_devices_school ON mobile_devices(school_id);
CREATE INDEX idx_mobile_devices_token ON mobile_devices(device_token);
CREATE INDEX idx_mobile_devices_platform ON mobile_devices(platform);
CREATE INDEX idx_mobile_devices_active ON mobile_devices(is_active, last_active);

CREATE INDEX idx_push_notifications_user ON push_notifications(user_id);
CREATE INDEX idx_push_notifications_device ON push_notifications(device_id);
CREATE INDEX idx_push_notifications_school ON push_notifications(school_id);
CREATE INDEX idx_push_notifications_status ON push_notifications(status);
CREATE INDEX idx_push_notifications_type ON push_notifications(notification_type);
CREATE INDEX idx_push_notifications_scheduled ON push_notifications(scheduled_at);
CREATE INDEX idx_push_notifications_sent ON push_notifications(sent_at DESC);

CREATE INDEX idx_push_notification_templates_name ON push_notification_templates(template_name);
CREATE INDEX idx_push_notification_templates_type ON push_notification_templates(template_type);
CREATE INDEX idx_push_notification_templates_active ON push_notification_templates(is_active) WHERE is_active = true;

CREATE INDEX idx_offline_sync_queue_user ON offline_sync_queue(user_id);
CREATE INDEX idx_offline_sync_queue_device ON offline_sync_queue(device_id);
CREATE INDEX idx_offline_sync_queue_status ON offline_sync_queue(sync_status);
CREATE INDEX idx_offline_sync_queue_priority ON offline_sync_queue(priority, created_at);
CREATE INDEX idx_offline_sync_queue_entity ON offline_sync_queue(entity_type, entity_id);

CREATE INDEX idx_mobile_app_sessions_user ON mobile_app_sessions(user_id);
CREATE INDEX idx_mobile_app_sessions_device ON mobile_app_sessions(device_id);
CREATE INDEX idx_mobile_app_sessions_school ON mobile_app_sessions(school_id);
CREATE INDEX idx_mobile_app_sessions_start ON mobile_app_sessions(session_start DESC);
CREATE INDEX idx_mobile_app_sessions_duration ON mobile_app_sessions(duration_seconds);

CREATE INDEX idx_mobile_performance_metrics_device ON mobile_performance_metrics(device_id);
CREATE INDEX idx_mobile_performance_metrics_type ON mobile_performance_metrics(metric_type);
CREATE INDEX idx_mobile_performance_metrics_timestamp ON mobile_performance_metrics(timestamp DESC);
CREATE INDEX idx_mobile_performance_metrics_screen ON mobile_performance_metrics(screen_name);

CREATE INDEX idx_mobile_feature_flags_name ON mobile_feature_flags(flag_name);
CREATE INDEX idx_mobile_feature_flags_active ON mobile_feature_flags(is_active) WHERE is_active = true;

CREATE INDEX idx_mobile_feature_flag_assignments_flag ON mobile_feature_flag_assignments(flag_id);
CREATE INDEX idx_mobile_feature_flag_assignments_user ON mobile_feature_flag_assignments(user_id);
CREATE INDEX idx_mobile_feature_flag_assignments_device ON mobile_feature_flag_assignments(device_id);

CREATE INDEX idx_mobile_crash_reports_user ON mobile_crash_reports(user_id);
CREATE INDEX idx_mobile_crash_reports_device ON mobile_crash_reports(device_id);
CREATE INDEX idx_mobile_crash_reports_timestamp ON mobile_crash_reports(crash_timestamp DESC);
CREATE INDEX idx_mobile_crash_reports_status ON mobile_crash_reports(report_status);
CREATE INDEX idx_mobile_crash_reports_exception ON mobile_crash_reports(exception_name);

CREATE INDEX idx_mobile_ab_tests_name ON mobile_ab_tests(test_name);
CREATE INDEX idx_mobile_ab_tests_status ON mobile_ab_tests(test_status);
CREATE INDEX idx_mobile_ab_tests_dates ON mobile_ab_tests(start_date, end_date);

CREATE INDEX idx_mobile_ab_test_assignments_test ON mobile_ab_test_assignments(test_id);
CREATE INDEX idx_mobile_ab_test_assignments_user ON mobile_ab_test_assignments(user_id);
CREATE INDEX idx_mobile_ab_test_assignments_device ON mobile_ab_test_assignments(device_id);

CREATE INDEX idx_mobile_analytics_events_user ON mobile_analytics_events(user_id);
CREATE INDEX idx_mobile_analytics_events_device ON mobile_analytics_events(device_id);
CREATE INDEX idx_mobile_analytics_events_session ON mobile_analytics_events(session_id);
CREATE INDEX idx_mobile_analytics_events_name ON mobile_analytics_events(event_name);
CREATE INDEX idx_mobile_analytics_events_timestamp ON mobile_analytics_events(timestamp DESC);
CREATE INDEX idx_mobile_analytics_events_screen ON mobile_analytics_events(screen_name);

-- RLS Policies for mobile tables
ALTER TABLE mobile_devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY mobile_devices_own_access ON mobile_devices 
    FOR ALL USING (user_id = current_setting('app.current_user_id')::UUID);
CREATE POLICY mobile_devices_admin_access ON mobile_devices 
    FOR ALL USING (current_setting('app.current_user_role') IN ('super_admin', 'edufam_admin'));

ALTER TABLE push_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY push_notifications_own_access ON push_notifications 
    FOR ALL USING (user_id = current_setting('app.current_user_id')::UUID);
CREATE POLICY push_notifications_school_admin_access ON push_notifications 
    FOR ALL USING (school_id = current_setting('app.current_school_id')::UUID AND current_setting('app.current_user_role') IN ('school_admin', 'principal'));
CREATE POLICY push_notifications_admin_access ON push_notifications 
    FOR ALL USING (current_setting('app.current_user_role') IN ('super_admin', 'edufam_admin'));

ALTER TABLE offline_sync_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY offline_sync_queue_own_access ON offline_sync_queue 
    FOR ALL USING (user_id = current_setting('app.current_user_id')::UUID);

ALTER TABLE mobile_app_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY mobile_app_sessions_own_access ON mobile_app_sessions 
    FOR ALL USING (user_id = current_setting('app.current_user_id')::UUID);
CREATE POLICY mobile_app_sessions_admin_access ON mobile_app_sessions 
    FOR ALL USING (current_setting('app.current_user_role') IN ('super_admin', 'edufam_admin'));

ALTER TABLE mobile_performance_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY mobile_performance_metrics_own_access ON mobile_performance_metrics 
    FOR ALL USING (user_id = current_setting('app.current_user_id')::UUID);
CREATE POLICY mobile_performance_metrics_admin_access ON mobile_performance_metrics 
    FOR ALL USING (current_setting('app.current_user_role') IN ('super_admin', 'edufam_admin'));

ALTER TABLE mobile_crash_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY mobile_crash_reports_own_access ON mobile_crash_reports 
    FOR ALL USING (user_id = current_setting('app.current_user_id')::UUID);
CREATE POLICY mobile_crash_reports_admin_access ON mobile_crash_reports 
    FOR ALL USING (current_setting('app.current_user_role') IN ('super_admin', 'edufam_admin'));

ALTER TABLE mobile_analytics_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY mobile_analytics_events_own_access ON mobile_analytics_events 
    FOR ALL USING (user_id = current_setting('app.current_user_id')::UUID);
CREATE POLICY mobile_analytics_events_admin_access ON mobile_analytics_events 
    FOR ALL USING (current_setting('app.current_user_role') IN ('super_admin', 'edufam_admin'));

-- Initial notification templates
INSERT INTO push_notification_templates (template_name, template_type, title_template, body_template, default_category, default_priority, required_variables, created_by) 
SELECT 
    'assignment_due_reminder', 'reminder', 'Assignment Due Tomorrow', 
    'Don''t forget: {{assignment_name}} is due {{due_date}}. Submit it on time!',
    'academic', 'normal', '{"assignment_name", "due_date"}', id
FROM users WHERE role = 'super_admin' LIMIT 1
ON CONFLICT (template_name) DO NOTHING;

INSERT INTO push_notification_templates (template_name, template_type, title_template, body_template, default_category, default_priority, required_variables, created_by) 
SELECT 
    'fee_payment_reminder', 'reminder', 'Fee Payment Due', 
    'Your {{fee_type}} payment of {{amount}} is due on {{due_date}}. Pay now to avoid late fees.',
    'financial', 'high', '{"fee_type", "amount", "due_date"}', id
FROM users WHERE role = 'super_admin' LIMIT 1
ON CONFLICT (template_name) DO NOTHING;

INSERT INTO push_notification_templates (template_name, template_type, title_template, body_template, default_category, default_priority, required_variables, created_by) 
SELECT 
    'exam_schedule_update', 'announcement', 'Exam Schedule Updated', 
    'The {{subject}} exam has been rescheduled to {{new_date}} at {{new_time}}.',
    'academic', 'high', '{"subject", "new_date", "new_time"}', id
FROM users WHERE role = 'super_admin' LIMIT 1
ON CONFLICT (template_name) DO NOTHING;

INSERT INTO push_notification_templates (template_name, template_type, title_template, body_template, default_category, default_priority, required_variables, created_by) 
SELECT 
    'attendance_alert', 'alert', 'Attendance Alert', 
    '{{student_name}} was marked absent from {{subject}} class today.',
    'attendance', 'normal', '{"student_name", "subject"}', id
FROM users WHERE role = 'super_admin' LIMIT 1
ON CONFLICT (template_name) DO NOTHING;

-- Initial feature flags
INSERT INTO mobile_feature_flags (flag_name, flag_description, flag_type, default_value, target_platforms, created_by) 
SELECT 
    'offline_mode', 'Enable offline mode functionality', 'boolean', 'true', '{"ios", "android"}', id
FROM users WHERE role = 'super_admin' LIMIT 1
ON CONFLICT (flag_name) DO NOTHING;

INSERT INTO mobile_feature_flags (flag_name, flag_description, flag_type, default_value, target_platforms, rollout_percentage, created_by) 
SELECT 
    'biometric_login', 'Enable biometric authentication', 'boolean', 'false', '{"ios", "android"}', 80, id
FROM users WHERE role = 'super_admin' LIMIT 1
ON CONFLICT (flag_name) DO NOTHING;

INSERT INTO mobile_feature_flags (flag_name, flag_description, flag_type, default_value, target_platforms, created_by) 
SELECT 
    'dark_mode', 'Enable dark mode theme', 'boolean', 'true', '{"ios", "android"}', id
FROM users WHERE role = 'super_admin' LIMIT 1
ON CONFLICT (flag_name) DO NOTHING;