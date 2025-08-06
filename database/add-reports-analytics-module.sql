-- Reports & Analytics Module Database Schema
-- This file contains all tables needed for the reporting and analytics system

-- Report templates (custom reports)
CREATE TABLE report_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    
    -- Template Information
    template_name VARCHAR(255) NOT NULL,
    template_code VARCHAR(50) NOT NULL,
    description TEXT,
    
    -- Template Configuration
    template_type VARCHAR(50) NOT NULL CHECK (template_type IN ('academic', 'financial', 'attendance', 'staff', 'transport', 'custom')),
    data_source VARCHAR(100) NOT NULL, -- Which table/view to query
    query_template TEXT NOT NULL, -- SQL template with placeholders
    parameters JSONB, -- Template parameters and their types
    
    -- Display Configuration
    display_format VARCHAR(20) DEFAULT 'table' CHECK (display_format IN ('table', 'chart', 'card', 'list')),
    chart_type VARCHAR(20), -- For chart displays
    column_mapping JSONB, -- How to map query results to display columns
    
    -- Access Control
    is_public BOOLEAN DEFAULT false,
    allowed_roles TEXT[], -- Array of roles that can access this template
    
    -- Status
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'draft')),
    
    -- Standard fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    
    -- Constraints
    UNIQUE(school_id, template_code)
);

-- Saved reports (generated reports)
CREATE TABLE saved_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    template_id UUID REFERENCES report_templates(id) ON DELETE SET NULL,
    
    -- Report Information
    report_name VARCHAR(255) NOT NULL,
    report_type VARCHAR(50) NOT NULL,
    
    -- Report Data
    parameters_used JSONB, -- Parameters used to generate this report
    query_executed TEXT, -- Actual SQL query that was executed
    result_summary JSONB, -- Summary of results (counts, totals, etc.)
    
    -- File Storage
    file_path TEXT, -- Path to saved report file
    file_size INTEGER, -- Size in bytes
    file_format VARCHAR(10) CHECK (file_format IN ('pdf', 'excel', 'csv', 'json')),
    
    -- Generation Details
    generation_time INTEGER, -- Time taken to generate in milliseconds
    row_count INTEGER, -- Number of rows in the report
    
    -- Access Control
    is_public BOOLEAN DEFAULT false,
    shared_with UUID[], -- Array of user IDs this report is shared with
    
    -- Standard fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id)
);

-- Analytics dashboards (custom dashboards)
CREATE TABLE analytics_dashboards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    
    -- Dashboard Information
    dashboard_name VARCHAR(255) NOT NULL,
    dashboard_code VARCHAR(50) NOT NULL,
    description TEXT,
    
    -- Layout Configuration
    layout_config JSONB NOT NULL, -- Dashboard layout and widget positions
    theme VARCHAR(20) DEFAULT 'default' CHECK (theme IN ('default', 'dark', 'light', 'custom')),
    
    -- Access Control
    is_public BOOLEAN DEFAULT false,
    allowed_roles TEXT[], -- Array of roles that can access this dashboard
    shared_with UUID[], -- Array of user IDs this dashboard is shared with
    
    -- Status
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'draft')),
    
    -- Standard fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    
    -- Constraints
    UNIQUE(school_id, dashboard_code)
);

-- Dashboard widgets
CREATE TABLE dashboard_widgets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dashboard_id UUID NOT NULL REFERENCES analytics_dashboards(id) ON DELETE CASCADE,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    
    -- Widget Information
    widget_name VARCHAR(255) NOT NULL,
    widget_type VARCHAR(50) NOT NULL CHECK (widget_type IN ('chart', 'table', 'metric', 'list', 'custom')),
    
    -- Data Configuration
    data_source VARCHAR(100) NOT NULL, -- Query or KPI to use
    query_config JSONB, -- Query configuration
    refresh_interval INTEGER, -- Refresh interval in seconds (0 for manual)
    
    -- Display Configuration
    position_config JSONB NOT NULL, -- Position and size in dashboard
    display_config JSONB, -- Display options (colors, formatting, etc.)
    
    -- Standard fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id)
);

-- Data exports (export history)
CREATE TABLE data_exports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    
    -- Export Information
    export_name VARCHAR(255) NOT NULL,
    export_type VARCHAR(50) NOT NULL CHECK (export_type IN ('students', 'financial', 'academic', 'attendance', 'staff', 'transport', 'custom')),
    
    -- Export Configuration
    data_source VARCHAR(100) NOT NULL, -- Table or view to export
    filters_applied JSONB, -- Filters used for the export
    columns_included TEXT[], -- Columns included in export
    sort_order JSONB, -- Sort configuration
    
    -- File Information
    file_path TEXT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size INTEGER NOT NULL, -- Size in bytes
    file_format VARCHAR(10) NOT NULL CHECK (file_format IN ('csv', 'excel', 'pdf', 'json')),
    
    -- Export Status
    status VARCHAR(20) DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed', 'cancelled')),
    progress_percentage INTEGER DEFAULT 0,
    error_message TEXT,
    
    -- Generation Details
    row_count INTEGER,
    generation_time INTEGER, -- Time taken in milliseconds
    
    -- Access Control
    is_public BOOLEAN DEFAULT false,
    shared_with UUID[], -- Array of user IDs this export is shared with
    
    -- Standard fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id)
);

-- Scheduled reports (automated reports)
CREATE TABLE scheduled_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    template_id UUID REFERENCES report_templates(id) ON DELETE SET NULL,
    
    -- Schedule Information
    schedule_name VARCHAR(255) NOT NULL,
    schedule_type VARCHAR(20) NOT NULL CHECK (schedule_type IN ('daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'custom')),
    
    -- Schedule Configuration
    cron_expression VARCHAR(100), -- Cron expression for custom schedules
    schedule_config JSONB NOT NULL, -- Schedule configuration (days, times, etc.)
    
    -- Report Configuration
    parameters JSONB, -- Default parameters for the report
    output_format VARCHAR(10) DEFAULT 'pdf' CHECK (output_format IN ('pdf', 'excel', 'csv', 'json')),
    
    -- Delivery Configuration
    delivery_method VARCHAR(20) NOT NULL CHECK (delivery_method IN ('email', 'download', 'dashboard')),
    recipients TEXT[], -- Array of email addresses or user IDs
    email_template TEXT, -- Email template for delivery
    
    -- Status
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'paused', 'cancelled')),
    last_run TIMESTAMP,
    next_run TIMESTAMP,
    
    -- Standard fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id)
);

-- Report permissions (access control)
CREATE TABLE report_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    
    -- Permission Target
    target_type VARCHAR(20) NOT NULL CHECK (target_type IN ('template', 'dashboard', 'export', 'scheduled_report')),
    target_id UUID NOT NULL,
    
    -- Permission Configuration
    permission_type VARCHAR(20) NOT NULL CHECK (permission_type IN ('view', 'edit', 'delete', 'share', 'execute')),
    
    -- Access Control
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50), -- Role-based permission
    user_group VARCHAR(50), -- Group-based permission
    
    -- Standard fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    
    -- Constraints
    UNIQUE(target_type, target_id, user_id, role, user_group)
);

-- KPI definitions (key metrics)
CREATE TABLE kpi_definitions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    
    -- KPI Information
    kpi_name VARCHAR(255) NOT NULL,
    kpi_code VARCHAR(50) NOT NULL,
    description TEXT,
    
    -- KPI Configuration
    kpi_type VARCHAR(50) NOT NULL CHECK (kpi_type IN ('academic', 'financial', 'attendance', 'staff', 'transport', 'custom')),
    calculation_method VARCHAR(20) NOT NULL CHECK (calculation_method IN ('count', 'sum', 'average', 'percentage', 'custom')),
    data_source VARCHAR(100) NOT NULL, -- Table or view to query
    query_template TEXT NOT NULL, -- SQL template for calculation
    
    -- Display Configuration
    display_format VARCHAR(20) DEFAULT 'number' CHECK (display_format IN ('number', 'percentage', 'currency', 'duration')),
    unit VARCHAR(20), -- Unit of measurement
    decimal_places INTEGER DEFAULT 0,
    
    -- Thresholds
    target_value DECIMAL(15,4),
    warning_threshold DECIMAL(15,4),
    critical_threshold DECIMAL(15,4),
    
    -- Status
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'draft')),
    
    -- Standard fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    
    -- Constraints
    UNIQUE(school_id, kpi_code)
);

-- KPI values (tracked values)
CREATE TABLE kpi_values (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    kpi_id UUID NOT NULL REFERENCES kpi_definitions(id) ON DELETE CASCADE,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    
    -- Value Information
    value_date DATE NOT NULL,
    value_time TIME,
    calculated_value DECIMAL(15,4) NOT NULL,
    
    -- Context
    context_data JSONB, -- Additional context for this value
    filters_applied JSONB, -- Filters used in calculation
    
    -- Status
    status VARCHAR(20) DEFAULT 'valid' CHECK (status IN ('valid', 'estimated', 'corrected', 'invalid')),
    
    -- Standard fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    
    -- Constraints
    UNIQUE(kpi_id, value_date, value_time)
);

-- Analytics cache (for performance optimization)
CREATE TABLE analytics_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    
    -- Cache Information
    cache_key VARCHAR(255) NOT NULL,
    cache_type VARCHAR(50) NOT NULL CHECK (cache_type IN ('report', 'dashboard', 'kpi', 'export')),
    
    -- Cached Data
    cached_data JSONB NOT NULL,
    data_hash VARCHAR(64) NOT NULL, -- Hash of the data for validation
    
    -- Cache Configuration
    ttl_seconds INTEGER NOT NULL, -- Time to live in seconds
    refresh_interval INTEGER, -- Auto-refresh interval
    
    -- Status
    is_valid BOOLEAN DEFAULT true,
    last_accessed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Standard fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    UNIQUE(school_id, cache_key)
);

-- Create indexes for better performance
CREATE INDEX idx_report_templates_school ON report_templates(school_id);
CREATE INDEX idx_report_templates_type ON report_templates(template_type);
CREATE INDEX idx_report_templates_status ON report_templates(status);

CREATE INDEX idx_saved_reports_school ON saved_reports(school_id);
CREATE INDEX idx_saved_reports_template ON saved_reports(template_id);
CREATE INDEX idx_saved_reports_type ON saved_reports(report_type);
CREATE INDEX idx_saved_reports_created ON saved_reports(created_at);

CREATE INDEX idx_analytics_dashboards_school ON analytics_dashboards(school_id);
CREATE INDEX idx_analytics_dashboards_status ON analytics_dashboards(status);

CREATE INDEX idx_dashboard_widgets_dashboard ON dashboard_widgets(dashboard_id);
CREATE INDEX idx_dashboard_widgets_school ON dashboard_widgets(school_id);
CREATE INDEX idx_dashboard_widgets_type ON dashboard_widgets(widget_type);

CREATE INDEX idx_data_exports_school ON data_exports(school_id);
CREATE INDEX idx_data_exports_type ON data_exports(export_type);
CREATE INDEX idx_data_exports_status ON data_exports(status);
CREATE INDEX idx_data_exports_created ON data_exports(created_at);

CREATE INDEX idx_scheduled_reports_school ON scheduled_reports(school_id);
CREATE INDEX idx_scheduled_reports_template ON scheduled_reports(template_id);
CREATE INDEX idx_scheduled_reports_status ON scheduled_reports(status);
CREATE INDEX idx_scheduled_reports_next_run ON scheduled_reports(next_run);

CREATE INDEX idx_report_permissions_school ON report_permissions(school_id);
CREATE INDEX idx_report_permissions_target ON report_permissions(target_type, target_id);
CREATE INDEX idx_report_permissions_user ON report_permissions(user_id);

CREATE INDEX idx_kpi_definitions_school ON kpi_definitions(school_id);
CREATE INDEX idx_kpi_definitions_type ON kpi_definitions(kpi_type);
CREATE INDEX idx_kpi_definitions_status ON kpi_definitions(status);

CREATE INDEX idx_kpi_values_kpi ON kpi_values(kpi_id);
CREATE INDEX idx_kpi_values_school ON kpi_values(school_id);
CREATE INDEX idx_kpi_values_date ON kpi_values(value_date);
CREATE INDEX idx_kpi_values_date_time ON kpi_values(value_date, value_time);

CREATE INDEX idx_analytics_cache_school ON analytics_cache(school_id);
CREATE INDEX idx_analytics_cache_key ON analytics_cache(cache_key);
CREATE INDEX idx_analytics_cache_type ON analytics_cache(cache_type);
CREATE INDEX idx_analytics_cache_valid ON analytics_cache(is_valid);
CREATE INDEX idx_analytics_cache_last_accessed ON analytics_cache(last_accessed);

-- Add triggers for updated_at
CREATE TRIGGER update_report_templates_updated_at BEFORE UPDATE ON report_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_saved_reports_updated_at BEFORE UPDATE ON saved_reports FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_analytics_dashboards_updated_at BEFORE UPDATE ON analytics_dashboards FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_dashboard_widgets_updated_at BEFORE UPDATE ON dashboard_widgets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_data_exports_updated_at BEFORE UPDATE ON data_exports FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_scheduled_reports_updated_at BEFORE UPDATE ON scheduled_reports FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_report_permissions_updated_at BEFORE UPDATE ON report_permissions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_kpi_definitions_updated_at BEFORE UPDATE ON kpi_definitions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_kpi_values_updated_at BEFORE UPDATE ON kpi_values FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_analytics_cache_updated_at BEFORE UPDATE ON analytics_cache FOR EACH ROW EXECUTE FUNCTION update_updated_at_column(); 