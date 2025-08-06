-- =====================================================
-- EDUFAM ADMIN PLATFORM SCHEMA
-- Creates tables for admin user management and platform operations
-- =====================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- PLATFORM ADMINS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS platform_admins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    role VARCHAR(50) NOT NULL CHECK (role IN (
        'super_admin', 'regional_admin', 'support_admin', 
        'finance_admin', 'compliance_admin', 'engineer'
    )),
    permissions JSONB DEFAULT '[]',
    regions_access UUID[] DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deactivated')),
    two_factor_enabled BOOLEAN DEFAULT false,
    two_factor_secret VARCHAR(255),
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP,
    last_login_at TIMESTAMP,
    password_changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    require_password_change BOOLEAN DEFAULT false,
    created_by UUID REFERENCES platform_admins(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- PLATFORM REGIONS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS platform_regions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    region_name VARCHAR(100) NOT NULL UNIQUE,
    region_code VARCHAR(10) NOT NULL UNIQUE,
    country VARCHAR(100) NOT NULL,
    timezone VARCHAR(50) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- ADMIN ACTIVITY LOGS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS admin_activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id UUID REFERENCES platform_admins(id) ON DELETE CASCADE,
    activity_type VARCHAR(50) NOT NULL,
    target_type VARCHAR(50),
    target_id UUID,
    action_description TEXT,
    ip_address INET,
    user_agent TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- PLATFORM SETTINGS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS platform_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    setting_key VARCHAR(100) NOT NULL UNIQUE,
    setting_value TEXT,
    setting_type VARCHAR(20) DEFAULT 'string' CHECK (setting_type IN ('string', 'number', 'boolean', 'json')),
    description TEXT,
    is_system_setting BOOLEAN DEFAULT false,
    created_by UUID REFERENCES platform_admins(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- PLATFORM METRICS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS platform_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    metric_name VARCHAR(100) NOT NULL,
    metric_value NUMERIC,
    metric_unit VARCHAR(20),
    metric_category VARCHAR(50),
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}'
);

-- =====================================================
-- SYSTEM HEALTH CHECKS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS system_health_checks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    check_name VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('healthy', 'warning', 'critical', 'unknown')),
    response_time_ms INTEGER,
    error_message TEXT,
    last_check_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    next_check_at TIMESTAMP,
    metadata JSONB DEFAULT '{}'
);

-- =====================================================
-- FEATURE FLAGS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS feature_flags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    flag_name VARCHAR(100) NOT NULL UNIQUE,
    flag_description TEXT,
    is_enabled BOOLEAN DEFAULT false,
    enabled_for_roles TEXT[] DEFAULT '{}',
    enabled_for_schools UUID[] DEFAULT '{}',
    rollout_percentage INTEGER DEFAULT 0 CHECK (rollout_percentage >= 0 AND rollout_percentage <= 100),
    created_by UUID REFERENCES platform_admins(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- MAINTENANCE MODE TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS maintenance_mode (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    is_active BOOLEAN DEFAULT false,
    message TEXT,
    allowed_ips INET[] DEFAULT '{}',
    bypass_roles TEXT[] DEFAULT '{}',
    scheduled_start TIMESTAMP,
    scheduled_end TIMESTAMP,
    created_by UUID REFERENCES platform_admins(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Platform admins indexes
CREATE INDEX IF NOT EXISTS idx_platform_admins_email ON platform_admins(email);
CREATE INDEX IF NOT EXISTS idx_platform_admins_role ON platform_admins(role);
CREATE INDEX IF NOT EXISTS idx_platform_admins_status ON platform_admins(status);
CREATE INDEX IF NOT EXISTS idx_platform_admins_created_by ON platform_admins(created_by);
CREATE INDEX IF NOT EXISTS idx_platform_admins_last_login ON platform_admins(last_login_at);

-- Platform regions indexes
CREATE INDEX IF NOT EXISTS idx_platform_regions_name ON platform_regions(region_name);
CREATE INDEX IF NOT EXISTS idx_platform_regions_code ON platform_regions(region_code);
CREATE INDEX IF NOT EXISTS idx_platform_regions_active ON platform_regions(is_active);

-- Admin activity logs indexes
CREATE INDEX IF NOT EXISTS idx_admin_activity_admin_id ON admin_activity_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_activity_type ON admin_activity_logs(activity_type);
CREATE INDEX IF NOT EXISTS idx_admin_activity_created ON admin_activity_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_admin_activity_target ON admin_activity_logs(target_type, target_id);

-- Platform settings indexes
CREATE INDEX IF NOT EXISTS idx_platform_settings_key ON platform_settings(setting_key);
CREATE INDEX IF NOT EXISTS idx_platform_settings_system ON platform_settings(is_system_setting);

-- Platform metrics indexes
CREATE INDEX IF NOT EXISTS idx_platform_metrics_name ON platform_metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_platform_metrics_category ON platform_metrics(metric_category);
CREATE INDEX IF NOT EXISTS idx_platform_metrics_recorded ON platform_metrics(recorded_at);

-- System health checks indexes
CREATE INDEX IF NOT EXISTS idx_system_health_name ON system_health_checks(check_name);
CREATE INDEX IF NOT EXISTS idx_system_health_status ON system_health_checks(status);
CREATE INDEX IF NOT EXISTS idx_system_health_last_check ON system_health_checks(last_check_at);

-- Feature flags indexes
CREATE INDEX IF NOT EXISTS idx_feature_flags_name ON feature_flags(flag_name);
CREATE INDEX IF NOT EXISTS idx_feature_flags_enabled ON feature_flags(is_enabled);

-- =====================================================
-- TRIGGERS FOR UPDATED_AT
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_platform_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_platform_admins_updated_at 
    BEFORE UPDATE ON platform_admins 
    FOR EACH ROW EXECUTE FUNCTION update_platform_updated_at_column();

CREATE TRIGGER update_platform_regions_updated_at 
    BEFORE UPDATE ON platform_regions 
    FOR EACH ROW EXECUTE FUNCTION update_platform_updated_at_column();

CREATE TRIGGER update_platform_settings_updated_at 
    BEFORE UPDATE ON platform_settings 
    FOR EACH ROW EXECUTE FUNCTION update_platform_updated_at_column();

CREATE TRIGGER update_feature_flags_updated_at 
    BEFORE UPDATE ON feature_flags 
    FOR EACH ROW EXECUTE FUNCTION update_platform_updated_at_column();

CREATE TRIGGER update_maintenance_mode_updated_at 
    BEFORE UPDATE ON maintenance_mode 
    FOR EACH ROW EXECUTE FUNCTION update_platform_updated_at_column();

-- =====================================================
-- SAMPLE DATA INSERTION
-- =====================================================

-- Insert sample regions
INSERT INTO platform_regions (region_name, region_code, country, timezone, currency) VALUES
('East Africa', 'EA', 'Kenya', 'Africa/Nairobi', 'KES'),
('West Africa', 'WA', 'Nigeria', 'Africa/Lagos', 'NGN'),
('Southern Africa', 'SA', 'South Africa', 'Africa/Johannesburg', 'ZAR'),
('North Africa', 'NA', 'Egypt', 'Africa/Cairo', 'EGP')
ON CONFLICT (region_code) DO NOTHING;

-- Insert sample platform settings
INSERT INTO platform_settings (setting_key, setting_value, setting_type, description, is_system_setting) VALUES
('maintenance_mode', 'false', 'boolean', 'Global maintenance mode status', true),
('max_login_attempts', '5', 'number', 'Maximum failed login attempts before lockout', true),
('session_timeout_minutes', '30', 'number', 'Session timeout in minutes', true),
('password_policy_min_length', '8', 'number', 'Minimum password length', true),
('enable_two_factor', 'true', 'boolean', 'Enable two-factor authentication', true),
('default_currency', 'KES', 'string', 'Default platform currency', true),
('support_email', 'support@edufam.com', 'string', 'Platform support email', true)
ON CONFLICT (setting_key) DO NOTHING;

-- Insert sample feature flags
INSERT INTO feature_flags (flag_name, flag_description, is_enabled) VALUES
('advanced_analytics', 'Enable advanced analytics dashboard', true),
('ai_timetable_generation', 'Enable AI-powered timetable generation', true),
('marketplace', 'Enable school marketplace features', false),
('multi_language', 'Enable multi-language support', false),
('mobile_app', 'Enable mobile application features', true)
ON CONFLICT (flag_name) DO NOTHING;

-- Insert sample system health checks
INSERT INTO system_health_checks (check_name, status, response_time_ms) VALUES
('database_connection', 'healthy', 15),
('redis_connection', 'healthy', 8),
('external_api_mpesa', 'healthy', 45),
('file_storage', 'healthy', 22),
('email_service', 'warning', 120)
ON CONFLICT DO NOTHING;

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on admin tables
ALTER TABLE platform_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_health_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_mode ENABLE ROW LEVEL SECURITY;

-- Platform admins policies
CREATE POLICY "admin_platform_admins_access" ON platform_admins
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('super_admin', 'engineer', 'admin_finance', 'support_hr', 'sales_marketing')
            AND users.user_type = 'admin_user'
        )
    );

-- Admin activity logs policies
CREATE POLICY "admin_activity_logs_access" ON admin_activity_logs
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('super_admin', 'engineer', 'admin_finance', 'support_hr', 'sales_marketing')
            AND users.user_type = 'admin_user'
        )
    );

-- Platform settings policies
CREATE POLICY "admin_platform_settings_access" ON platform_settings
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('super_admin', 'engineer', 'admin_finance', 'support_hr', 'sales_marketing')
            AND users.user_type = 'admin_user'
        )
    );

-- Platform metrics policies
CREATE POLICY "admin_platform_metrics_access" ON platform_metrics
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('super_admin', 'engineer', 'admin_finance', 'support_hr', 'sales_marketing')
            AND users.user_type = 'admin_user'
        )
    );

-- System health checks policies
CREATE POLICY "admin_system_health_access" ON system_health_checks
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('super_admin', 'engineer')
            AND users.user_type = 'admin_user'
        )
    );

-- Feature flags policies
CREATE POLICY "admin_feature_flags_access" ON feature_flags
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('super_admin', 'engineer', 'admin_finance', 'support_hr', 'sales_marketing')
            AND users.user_type = 'admin_user'
        )
    );

-- Maintenance mode policies
CREATE POLICY "admin_maintenance_mode_access" ON maintenance_mode
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('super_admin', 'engineer')
            AND users.user_type = 'admin_user'
        )
    );

-- =====================================================
-- COMPLETION MESSAGE
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '================================================';
    RAISE NOTICE '✅ EDUFAM ADMIN PLATFORM SCHEMA CREATED!';
    RAISE NOTICE '================================================';
    RAISE NOTICE 'Created tables:';
    RAISE NOTICE '  ✅ platform_admins';
    RAISE NOTICE '  ✅ platform_regions';
    RAISE NOTICE '  ✅ admin_activity_logs';
    RAISE NOTICE '  ✅ platform_settings';
    RAISE NOTICE '  ✅ platform_metrics';
    RAISE NOTICE '  ✅ system_health_checks';
    RAISE NOTICE '  ✅ feature_flags';
    RAISE NOTICE '  ✅ maintenance_mode';
    RAISE NOTICE '';
    RAISE NOTICE 'Created indexes for performance optimization';
    RAISE NOTICE 'Applied Row Level Security (RLS) policies';
    RAISE NOTICE 'Inserted sample data for testing';
    RAISE NOTICE '';
    RAISE NOTICE '🚀 Admin platform is now ready for use!';
    RAISE NOTICE '================================================';
END $$; 