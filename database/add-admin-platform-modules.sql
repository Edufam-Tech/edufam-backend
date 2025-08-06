-- =====================================================================================
-- ADMIN PLATFORM MODULES DATABASE SCHEMA
-- Edufam Platform Administration Tables
-- =====================================================================================

-- Ensure required extensions are available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================================================
-- MODULE 16: MULTI-SCHOOL MANAGEMENT
-- =====================================================================================

-- Platform regions/districts
CREATE TABLE IF NOT EXISTS platform_regions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    region_name VARCHAR(255) NOT NULL,
    region_code VARCHAR(50) UNIQUE NOT NULL,
    country VARCHAR(100) NOT NULL,
    state_province VARCHAR(100),
    timezone VARCHAR(50) DEFAULT 'UTC',
    currency VARCHAR(10) DEFAULT 'USD',
    language VARCHAR(10) DEFAULT 'en',
    regional_manager_id UUID,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- School onboarding requests
CREATE TABLE IF NOT EXISTS school_onboarding_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_number VARCHAR(50) UNIQUE NOT NULL,
    school_name VARCHAR(255) NOT NULL,
    principal_name VARCHAR(255) NOT NULL,
    principal_email VARCHAR(255) NOT NULL,
    principal_phone VARCHAR(20),
    school_address TEXT,
    region_id UUID REFERENCES platform_regions(id),
    school_type VARCHAR(50) CHECK (school_type IN ('primary', 'secondary', 'mixed', 'kindergarten', 'special')),
    curriculum_type VARCHAR(50) CHECK (curriculum_type IN ('CBC', 'IGCSE', '8-4-4', 'IB', 'other')),
    expected_students INTEGER,
    expected_staff INTEGER,
    preferred_plan VARCHAR(50),
    status VARCHAR(20) DEFAULT 'submitted' CHECK (status IN ('submitted', 'under_review', 'approved', 'rejected', 'onboarding', 'completed')),
    rejection_reason TEXT,
    assigned_to UUID, -- Admin user handling the request
    documents_submitted JSONB DEFAULT '[]',
    verification_status VARCHAR(20) DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'failed')),
    onboarding_progress JSONB DEFAULT '{}',
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- School management oversight
CREATE TABLE IF NOT EXISTS school_oversight (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    oversight_type VARCHAR(50) CHECK (oversight_type IN ('compliance', 'performance', 'financial', 'technical')),
    status VARCHAR(20) CHECK (status IN ('good', 'warning', 'critical', 'suspended')),
    last_review_date DATE,
    next_review_date DATE,
    compliance_score DECIMAL(3,2) CHECK (compliance_score >= 0 AND compliance_score <= 100),
    performance_score DECIMAL(3,2) CHECK (performance_score >= 0 AND performance_score <= 100),
    financial_health_score DECIMAL(3,2) CHECK (financial_health_score >= 0 AND financial_health_score <= 100),
    issues_identified JSONB DEFAULT '[]',
    action_items JSONB DEFAULT '[]',
    assigned_admin_id UUID,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================================================
-- MODULE 17: SUBSCRIPTION MANAGEMENT
-- =====================================================================================

-- Subscription plans
CREATE TABLE IF NOT EXISTS subscription_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plan_name VARCHAR(255) NOT NULL UNIQUE,
    plan_code VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    plan_type VARCHAR(20) CHECK (plan_type IN ('basic', 'standard', 'premium', 'enterprise', 'custom')),
    billing_cycle VARCHAR(20) CHECK (billing_cycle IN ('monthly', 'quarterly', 'yearly')),
    base_price DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    price_per_student DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    max_students INTEGER,
    max_staff INTEGER,
    features JSONB DEFAULT '[]',
    module_access JSONB DEFAULT '[]',
    storage_limit_gb INTEGER DEFAULT 10,
    api_rate_limit INTEGER DEFAULT 1000,
    support_level VARCHAR(20) DEFAULT 'standard' CHECK (support_level IN ('basic', 'standard', 'priority', '24/7')),
    trial_period_days INTEGER DEFAULT 30,
    setup_fee DECIMAL(12,2) DEFAULT 0.00,
    is_active BOOLEAN DEFAULT true,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- School subscriptions
CREATE TABLE IF NOT EXISTS school_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    plan_id UUID REFERENCES subscription_plans(id),
    subscription_status VARCHAR(20) DEFAULT 'active' CHECK (subscription_status IN ('trial', 'active', 'suspended', 'cancelled', 'expired')),
    billing_cycle VARCHAR(20) CHECK (billing_cycle IN ('monthly', 'quarterly', 'yearly')),
    start_date DATE NOT NULL,
    end_date DATE,
    trial_end_date DATE,
    current_students INTEGER DEFAULT 0,
    current_staff INTEGER DEFAULT 0,
    monthly_cost DECIMAL(12,2),
    yearly_cost DECIMAL(12,2),
    auto_renew BOOLEAN DEFAULT true,
    payment_method VARCHAR(50),
    billing_contact_email VARCHAR(255),
    billing_address TEXT,
    tax_exempt BOOLEAN DEFAULT false,
    tax_rate DECIMAL(5,4) DEFAULT 0.00,
    discount_percentage DECIMAL(5,2) DEFAULT 0.00,
    custom_pricing JSONB,
    next_billing_date DATE,
    last_billing_date DATE,
    cancellation_reason TEXT,
    cancelled_at TIMESTAMP,
    cancelled_by UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Subscription invoices
CREATE TABLE IF NOT EXISTS subscription_invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES school_subscriptions(id),
    invoice_number VARCHAR(100) UNIQUE NOT NULL,
    invoice_date DATE NOT NULL,
    due_date DATE NOT NULL,
    billing_period_start DATE NOT NULL,
    billing_period_end DATE NOT NULL,
    student_count INTEGER NOT NULL,
    staff_count INTEGER NOT NULL,
    base_amount DECIMAL(12,2) NOT NULL,
    student_charges DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    addon_charges DECIMAL(12,2) DEFAULT 0.00,
    discount_amount DECIMAL(12,2) DEFAULT 0.00,
    tax_amount DECIMAL(12,2) DEFAULT 0.00,
    total_amount DECIMAL(12,2) NOT NULL,
    amount_paid DECIMAL(12,2) DEFAULT 0.00,
    balance_due DECIMAL(12,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'paid', 'overdue', 'cancelled')),
    payment_terms VARCHAR(100) DEFAULT 'Net 30',
    notes TEXT,
    pdf_url TEXT,
    sent_at TIMESTAMP,
    paid_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================================================
-- MODULE 18: PLATFORM ANALYTICS
-- =====================================================================================

-- Platform metrics tracking
CREATE TABLE IF NOT EXISTS platform_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    metric_date DATE NOT NULL,
    metric_type VARCHAR(50) NOT NULL CHECK (metric_type IN ('schools', 'users', 'revenue', 'usage', 'performance')),
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(15,2) NOT NULL,
    metric_unit VARCHAR(20),
    dimension_1 VARCHAR(100), -- e.g., region, plan_type
    dimension_2 VARCHAR(100), -- e.g., school_type, feature
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- School analytics summary
CREATE TABLE IF NOT EXISTS school_analytics_summary (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    summary_date DATE NOT NULL,
    active_students INTEGER DEFAULT 0,
    active_staff INTEGER DEFAULT 0,
    total_classes INTEGER DEFAULT 0,
    monthly_logins INTEGER DEFAULT 0,
    feature_usage JSONB DEFAULT '{}',
    storage_used_gb DECIMAL(10,2) DEFAULT 0.00,
    api_calls INTEGER DEFAULT 0,
    support_tickets INTEGER DEFAULT 0,
    revenue_generated DECIMAL(12,2) DEFAULT 0.00,
    performance_score DECIMAL(3,2),
    satisfaction_score DECIMAL(3,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Platform usage logs
CREATE TABLE IF NOT EXISTS platform_usage_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    user_id UUID,
    session_id VARCHAR(255),
    activity_type VARCHAR(50) CHECK (activity_type IN ('login', 'logout', 'api_call', 'feature_access', 'data_export')),
    module_accessed VARCHAR(100),
    endpoint_accessed VARCHAR(255),
    ip_address INET,
    user_agent TEXT,
    response_time_ms INTEGER,
    status_code INTEGER,
    error_message TEXT,
    metadata JSONB,
    logged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================================================
-- MODULE 19: ADMIN USER MANAGEMENT
-- =====================================================================================

-- Platform admin users
CREATE TABLE IF NOT EXISTS platform_admins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    role VARCHAR(50) NOT NULL CHECK (role IN ('super_admin', 'regional_admin', 'support_admin', 'finance_admin', 'compliance_admin')),
    permissions JSONB DEFAULT '[]',
    regions_access JSONB DEFAULT '[]', -- Array of region IDs the admin can access
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    last_login_at TIMESTAMP,
    password_hash VARCHAR(255) NOT NULL,
    password_changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    two_factor_enabled BOOLEAN DEFAULT false,
    two_factor_secret VARCHAR(255),
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP,
    created_by UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Admin activity logs
CREATE TABLE IF NOT EXISTS admin_activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id UUID REFERENCES platform_admins(id) ON DELETE CASCADE,
    activity_type VARCHAR(50) NOT NULL,
    target_type VARCHAR(50), -- 'school', 'user', 'subscription', etc.
    target_id UUID,
    action_description TEXT NOT NULL,
    ip_address INET,
    user_agent TEXT,
    before_state JSONB,
    after_state JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================================================
-- MODULE 20: SYSTEM CONFIGURATION
-- =====================================================================================

-- Platform settings
CREATE TABLE IF NOT EXISTS platform_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    setting_category VARCHAR(100) NOT NULL,
    setting_key VARCHAR(150) NOT NULL,
    setting_value TEXT,
    setting_type VARCHAR(20) DEFAULT 'string' CHECK (setting_type IN ('string', 'number', 'boolean', 'json', 'encrypted')),
    description TEXT,
    is_global BOOLEAN DEFAULT true,
    region_id UUID REFERENCES platform_regions(id),
    school_id UUID REFERENCES schools(id),
    is_encrypted BOOLEAN DEFAULT false,
    validation_rules JSONB,
    last_modified_by UUID REFERENCES platform_admins(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(setting_category, setting_key, region_id, school_id)
);

-- Feature flags
CREATE TABLE IF NOT EXISTS feature_flags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    flag_name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    flag_type VARCHAR(20) DEFAULT 'boolean' CHECK (flag_type IN ('boolean', 'percentage', 'string', 'json')),
    default_value TEXT,
    is_active BOOLEAN DEFAULT false,
    rollout_percentage INTEGER DEFAULT 0 CHECK (rollout_percentage >= 0 AND rollout_percentage <= 100),
    target_criteria JSONB, -- conditions for targeting specific schools/users
    start_date TIMESTAMP,
    end_date TIMESTAMP,
    created_by UUID REFERENCES platform_admins(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Feature flag assignments
CREATE TABLE IF NOT EXISTS feature_flag_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    flag_id UUID REFERENCES feature_flags(id) ON DELETE CASCADE,
    assignment_type VARCHAR(20) CHECK (assignment_type IN ('school', 'region', 'user')),
    target_id UUID NOT NULL,
    flag_value TEXT,
    is_enabled BOOLEAN DEFAULT false,
    assigned_by UUID REFERENCES platform_admins(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(flag_id, assignment_type, target_id)
);

-- =====================================================================================
-- MODULE 21: REGIONAL MANAGEMENT
-- =====================================================================================

-- Regional performance metrics
CREATE TABLE IF NOT EXISTS regional_performance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    region_id UUID REFERENCES platform_regions(id) ON DELETE CASCADE,
    performance_date DATE NOT NULL,
    total_schools INTEGER DEFAULT 0,
    active_schools INTEGER DEFAULT 0,
    total_students INTEGER DEFAULT 0,
    total_staff INTEGER DEFAULT 0,
    new_schools_count INTEGER DEFAULT 0,
    churned_schools_count INTEGER DEFAULT 0,
    revenue_generated DECIMAL(15,2) DEFAULT 0.00,
    average_satisfaction_score DECIMAL(3,2),
    support_tickets_count INTEGER DEFAULT 0,
    resolution_time_avg_hours DECIMAL(8,2),
    uptime_percentage DECIMAL(5,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Regional targets and KPIs
CREATE TABLE IF NOT EXISTS regional_targets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    region_id UUID REFERENCES platform_regions(id) ON DELETE CASCADE,
    target_year INTEGER NOT NULL,
    target_quarter INTEGER CHECK (target_quarter BETWEEN 1 AND 4),
    target_type VARCHAR(50) CHECK (target_type IN ('schools', 'students', 'revenue', 'satisfaction')),
    target_value DECIMAL(15,2) NOT NULL,
    current_value DECIMAL(15,2) DEFAULT 0.00,
    achievement_percentage DECIMAL(5,2) DEFAULT 0.00,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'achieved', 'missed', 'cancelled')),
    notes TEXT,
    created_by UUID REFERENCES platform_admins(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(region_id, target_year, target_quarter, target_type)
);

-- =====================================================================================
-- MODULE 22: PLATFORM MONITORING
-- =====================================================================================

-- System health checks
CREATE TABLE IF NOT EXISTS system_health_checks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    check_name VARCHAR(100) NOT NULL,
    check_type VARCHAR(50) CHECK (check_type IN ('database', 'api', 'external_service', 'storage', 'memory', 'cpu')),
    status VARCHAR(20) CHECK (status IN ('healthy', 'warning', 'critical', 'unknown')),
    response_time_ms INTEGER,
    error_message TEXT,
    details JSONB,
    check_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Performance metrics
CREATE TABLE IF NOT EXISTS performance_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    metric_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metric_type VARCHAR(50) CHECK (metric_type IN ('response_time', 'throughput', 'error_rate', 'cpu_usage', 'memory_usage', 'disk_usage')),
    service_name VARCHAR(100),
    metric_value DECIMAL(15,4) NOT NULL,
    metric_unit VARCHAR(20),
    threshold_warning DECIMAL(15,4),
    threshold_critical DECIMAL(15,4),
    tags JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Alert configurations
CREATE TABLE IF NOT EXISTS alert_configurations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alert_name VARCHAR(150) NOT NULL UNIQUE,
    alert_type VARCHAR(50) CHECK (alert_type IN ('threshold', 'anomaly', 'availability', 'security')),
    metric_type VARCHAR(50),
    condition_operator VARCHAR(10) CHECK (condition_operator IN ('>', '<', '>=', '<=', '==', '!=')),
    threshold_value DECIMAL(15,4),
    severity VARCHAR(20) CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    notification_channels JSONB DEFAULT '[]',
    is_enabled BOOLEAN DEFAULT true,
    escalation_policy JSONB,
    created_by UUID REFERENCES platform_admins(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================================================
-- MODULE 23: DATA MIGRATION TOOLS
-- =====================================================================================

-- Migration jobs
CREATE TABLE IF NOT EXISTS migration_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_name VARCHAR(255) NOT NULL,
    job_type VARCHAR(50) CHECK (job_type IN ('school_import', 'student_import', 'staff_import', 'data_export', 'school_migration')),
    school_id UUID REFERENCES schools(id),
    source_system VARCHAR(100),
    source_format VARCHAR(50) CHECK (source_format IN ('csv', 'excel', 'json', 'xml', 'database')),
    file_path TEXT,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    progress_percentage INTEGER DEFAULT 0,
    total_records INTEGER DEFAULT 0,
    processed_records INTEGER DEFAULT 0,
    success_records INTEGER DEFAULT 0,
    failed_records INTEGER DEFAULT 0,
    validation_errors JSONB DEFAULT '[]',
    processing_errors JSONB DEFAULT '[]',
    mapping_configuration JSONB,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    started_by UUID REFERENCES platform_admins(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Data mapping templates
CREATE TABLE IF NOT EXISTS data_mapping_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_name VARCHAR(255) NOT NULL,
    template_type VARCHAR(50) CHECK (template_type IN ('student', 'staff', 'class', 'subject', 'assessment')),
    source_system VARCHAR(100),
    field_mappings JSONB NOT NULL,
    validation_rules JSONB DEFAULT '[]',
    transformation_rules JSONB DEFAULT '[]',
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    usage_count INTEGER DEFAULT 0,
    created_by UUID REFERENCES platform_admins(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================================================
-- MODULE 24: INTEGRATION MANAGEMENT
-- =====================================================================================

-- External integrations
CREATE TABLE IF NOT EXISTS external_integrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    integration_name VARCHAR(255) NOT NULL,
    integration_type VARCHAR(50) CHECK (integration_type IN ('payment', 'sms', 'email', 'storage', 'analytics', 'lms', 'sis')),
    provider_name VARCHAR(100) NOT NULL,
    status VARCHAR(20) DEFAULT 'inactive' CHECK (status IN ('active', 'inactive', 'error', 'maintenance')),
    configuration JSONB NOT NULL,
    credentials JSONB, -- Encrypted
    api_endpoints JSONB,
    webhook_url TEXT,
    rate_limits JSONB,
    last_sync_at TIMESTAMP,
    sync_frequency VARCHAR(50) CHECK (sync_frequency IN ('realtime', 'hourly', 'daily', 'weekly', 'manual')),
    error_count INTEGER DEFAULT 0,
    last_error TEXT,
    is_global BOOLEAN DEFAULT false,
    allowed_schools JSONB DEFAULT '[]',
    created_by UUID REFERENCES platform_admins(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Integration logs
CREATE TABLE IF NOT EXISTS integration_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    integration_id UUID REFERENCES external_integrations(id) ON DELETE CASCADE,
    school_id UUID REFERENCES schools(id),
    operation_type VARCHAR(50) CHECK (operation_type IN ('sync', 'webhook', 'api_call', 'authentication')),
    operation_status VARCHAR(20) CHECK (operation_status IN ('success', 'failure', 'warning')),
    request_data JSONB,
    response_data JSONB,
    error_message TEXT,
    processing_time_ms INTEGER,
    logged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================================================
-- MODULE 25: COMPLIANCE MONITORING
-- =====================================================================================

-- Compliance rules
CREATE TABLE IF NOT EXISTS compliance_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rule_name VARCHAR(255) NOT NULL,
    rule_category VARCHAR(100) CHECK (rule_category IN ('data_protection', 'financial', 'educational', 'security', 'operational')),
    regulation_reference VARCHAR(100), -- e.g., 'GDPR Article 25', 'FERPA Section 99.31'
    description TEXT NOT NULL,
    severity VARCHAR(20) CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    check_frequency VARCHAR(50) CHECK (check_frequency IN ('daily', 'weekly', 'monthly', 'quarterly', 'annually')),
    automated_check BOOLEAN DEFAULT false,
    check_query TEXT, -- SQL query for automated checks
    validation_criteria JSONB,
    remediation_steps TEXT,
    responsible_role VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    effective_date DATE,
    expiry_date DATE,
    created_by UUID REFERENCES platform_admins(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Compliance assessments
CREATE TABLE IF NOT EXISTS compliance_assessments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    rule_id UUID REFERENCES compliance_rules(id),
    assessment_date DATE NOT NULL,
    compliance_status VARCHAR(20) CHECK (compliance_status IN ('compliant', 'non_compliant', 'partial', 'not_applicable')),
    score DECIMAL(5,2) CHECK (score >= 0 AND score <= 100),
    findings TEXT,
    evidence_links JSONB DEFAULT '[]',
    corrective_actions JSONB DEFAULT '[]',
    next_assessment_date DATE,
    assessed_by UUID REFERENCES platform_admins(id),
    reviewed_by UUID REFERENCES platform_admins(id),
    review_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Audit trails
CREATE TABLE IF NOT EXISTS audit_trails (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id),
    user_id UUID,
    admin_id UUID REFERENCES platform_admins(id),
    table_name VARCHAR(100) NOT NULL,
    record_id UUID NOT NULL,
    action_type VARCHAR(20) CHECK (action_type IN ('CREATE', 'UPDATE', 'DELETE', 'READ')),
    old_values JSONB,
    new_values JSONB,
    changed_fields JSONB DEFAULT '[]',
    ip_address INET,
    user_agent TEXT,
    session_id VARCHAR(255),
    compliance_relevant BOOLEAN DEFAULT false,
    retention_until DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================================================
-- INDEXES FOR PERFORMANCE (Created after all tables)
-- =====================================================================================

-- Platform regions indexes
CREATE INDEX IF NOT EXISTS idx_platform_regions_active ON platform_regions(is_active);
CREATE INDEX IF NOT EXISTS idx_platform_regions_country ON platform_regions(country);

-- School onboarding indexes
CREATE INDEX IF NOT EXISTS idx_school_onboarding_status ON school_onboarding_requests(status);
CREATE INDEX IF NOT EXISTS idx_school_onboarding_region ON school_onboarding_requests(region_id);
CREATE INDEX IF NOT EXISTS idx_school_onboarding_submitted ON school_onboarding_requests(submitted_at);

-- School oversight indexes
CREATE INDEX IF NOT EXISTS idx_school_oversight_school ON school_oversight(school_id);
CREATE INDEX IF NOT EXISTS idx_school_oversight_type ON school_oversight(oversight_type);
CREATE INDEX IF NOT EXISTS idx_school_oversight_status ON school_oversight(status);

-- Subscription indexes
CREATE INDEX IF NOT EXISTS idx_school_subscriptions_school_id ON school_subscriptions(school_id);
CREATE INDEX IF NOT EXISTS idx_school_subscriptions_status_new ON school_subscriptions(subscription_status);
CREATE INDEX IF NOT EXISTS idx_school_subscriptions_billing_date ON school_subscriptions(next_billing_date);
CREATE INDEX IF NOT EXISTS idx_subscription_invoices_school_id ON subscription_invoices(school_id);
CREATE INDEX IF NOT EXISTS idx_subscription_invoices_status_new ON subscription_invoices(status);
CREATE INDEX IF NOT EXISTS idx_subscription_invoices_due_date ON subscription_invoices(due_date);

-- Analytics indexes
CREATE INDEX IF NOT EXISTS idx_platform_metrics_date_type ON platform_metrics(metric_date, metric_type);
CREATE INDEX IF NOT EXISTS idx_school_analytics_date ON school_analytics_summary(summary_date);
CREATE INDEX IF NOT EXISTS idx_school_analytics_school_id ON school_analytics_summary(school_id);
CREATE INDEX IF NOT EXISTS idx_platform_usage_school_activity ON platform_usage_logs(school_id, activity_type);
CREATE INDEX IF NOT EXISTS idx_platform_usage_logged_at ON platform_usage_logs(logged_at);

-- Admin management indexes
CREATE INDEX IF NOT EXISTS idx_platform_admins_role ON platform_admins(role);
CREATE INDEX IF NOT EXISTS idx_platform_admins_status ON platform_admins(status);
CREATE INDEX IF NOT EXISTS idx_admin_activity_admin ON admin_activity_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_activity_created ON admin_activity_logs(created_at);

-- Configuration indexes
CREATE INDEX IF NOT EXISTS idx_platform_settings_category_key ON platform_settings(setting_category, setting_key);
CREATE INDEX IF NOT EXISTS idx_feature_flags_active ON feature_flags(is_active);
CREATE INDEX IF NOT EXISTS idx_feature_flag_assignments_flag ON feature_flag_assignments(flag_id);

-- Regional management indexes
CREATE INDEX IF NOT EXISTS idx_regional_performance_region ON regional_performance(region_id);
CREATE INDEX IF NOT EXISTS idx_regional_performance_date ON regional_performance(performance_date);
CREATE INDEX IF NOT EXISTS idx_regional_targets_region ON regional_targets(region_id);

-- Monitoring indexes
CREATE INDEX IF NOT EXISTS idx_system_health_checks_timestamp ON system_health_checks(check_timestamp);
CREATE INDEX IF NOT EXISTS idx_system_health_checks_status ON system_health_checks(status);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_timestamp ON performance_metrics(metric_timestamp);
CREATE INDEX IF NOT EXISTS idx_alert_configurations_enabled ON alert_configurations(is_enabled);

-- Migration indexes
CREATE INDEX IF NOT EXISTS idx_migration_jobs_status ON migration_jobs(status);
CREATE INDEX IF NOT EXISTS idx_migration_jobs_school_id ON migration_jobs(school_id);
CREATE INDEX IF NOT EXISTS idx_migration_jobs_type ON migration_jobs(job_type);

-- Integration indexes
CREATE INDEX IF NOT EXISTS idx_external_integrations_type ON external_integrations(integration_type);
CREATE INDEX IF NOT EXISTS idx_external_integrations_status ON external_integrations(status);
CREATE INDEX IF NOT EXISTS idx_integration_logs_integration ON integration_logs(integration_id);
CREATE INDEX IF NOT EXISTS idx_integration_logs_logged_at ON integration_logs(logged_at);

-- Compliance indexes
CREATE INDEX IF NOT EXISTS idx_compliance_rules_category ON compliance_rules(rule_category);
CREATE INDEX IF NOT EXISTS idx_compliance_rules_active ON compliance_rules(is_active);
CREATE INDEX IF NOT EXISTS idx_compliance_assessments_school_id ON compliance_assessments(school_id);
CREATE INDEX IF NOT EXISTS idx_compliance_assessments_date ON compliance_assessments(assessment_date);
CREATE INDEX IF NOT EXISTS idx_audit_trails_school_table ON audit_trails(school_id, table_name);
CREATE INDEX IF NOT EXISTS idx_audit_trails_created_at ON audit_trails(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_trails_compliance ON audit_trails(compliance_relevant) WHERE compliance_relevant = true;

