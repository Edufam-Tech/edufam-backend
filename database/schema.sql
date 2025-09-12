-- Enable required PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Schools table with per-student subscription model
CREATE TABLE schools (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(20) UNIQUE NOT NULL,
    address TEXT,
    phone VARCHAR(20),
    email VARCHAR(255),
    website VARCHAR(255),
    logo_url TEXT,
    
    -- Subscription Details (Per-Student Model)
    subscription_type VARCHAR(20) NOT NULL DEFAULT 'monthly' CHECK (subscription_type IN ('monthly', 'termly', 'yearly')),
    price_per_student DECIMAL(10,2) NOT NULL DEFAULT 100.00,
    currency VARCHAR(3) DEFAULT 'KES',
    max_students INTEGER,
    
    -- Billing Information
    billing_cycle_start DATE NOT NULL DEFAULT CURRENT_DATE,
    next_billing_date DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '1 month'),
    auto_billing BOOLEAN DEFAULT true,
    
    -- Account Status
    subscription_status VARCHAR(20) DEFAULT 'active' CHECK (subscription_status IN ('active', 'suspended', 'cancelled', 'trial')),
    trial_end_date DATE,
    
    -- Standard fields
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Users table (unified for school and admin users)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    
    -- User Classification
    user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('school_user', 'admin_user')),
    role VARCHAR(50) NOT NULL CHECK (role IN (
        -- School Users
        'school_director', 'principal', 'teacher', 'parent', 'hr', 'finance',
        -- Admin Users
        'super_admin', 'engineer', 'support_hr', 'sales_marketing', 'admin_finance'
    )),
    
    -- School Association (NULL for admin users)
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    
    -- Personal Information
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    profile_picture_url TEXT,
    
    -- Account Status
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    activation_status VARCHAR(20) DEFAULT 'pending' CHECK (activation_status IN ('pending', 'active', 'suspended', 'deactivated')),
    
    -- Security
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP,
    last_login TIMESTAMP,
    password_changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Tracking
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    
    -- Constraints
    CONSTRAINT check_school_user_has_school CHECK (
        (user_type = 'admin_user' AND school_id IS NULL) OR
        (user_type = 'school_user' AND school_id IS NOT NULL)
    )
);

-- User sessions for JWT refresh token management
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    refresh_token VARCHAR(500) NOT NULL UNIQUE,
    ip_address INET,
    user_agent TEXT,
    device_info JSONB,
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Password reset tokens
CREATE TABLE password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN DEFAULT false,
    ip_address INET,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Students table (with profile pictures for billing accuracy)
CREATE TABLE students (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    student_number VARCHAR(50) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    date_of_birth DATE,
    gender VARCHAR(10) CHECK (gender IN ('male', 'female')),
    phone VARCHAR(20),
    email VARCHAR(255),
    address TEXT,
    profile_picture_url TEXT,
    parent_id UUID REFERENCES users(id),
    curriculum_type VARCHAR(20) DEFAULT 'CBC' CHECK (curriculum_type IN ('CBC', 'IGCSE', '8-4-4')),
    class_level VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(school_id, student_number)
);

-- Staff table (all school staff including non-dashboard users)
CREATE TABLE staff (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    employee_number VARCHAR(50) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    position VARCHAR(100) NOT NULL,
    department VARCHAR(100),
    hire_date DATE,
    phone VARCHAR(20),
    email VARCHAR(255),
    address TEXT,
    profile_picture_url TEXT,
    has_dashboard_access BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(school_id, employee_number)
);

-- Maintenance mode system
CREATE TABLE maintenance_mode (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scope VARCHAR(20) NOT NULL CHECK (scope IN ('platform', 'school_app', 'admin_app', 'specific_schools')),
    is_active BOOLEAN DEFAULT false,
    message TEXT,
    scheduled_start TIMESTAMP,
    scheduled_end TIMESTAMP,
    affected_schools UUID[] DEFAULT '{}',
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Comprehensive audit logs
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    table_name VARCHAR(50),
    record_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- File uploads management
CREATE TABLE file_uploads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    original_filename VARCHAR(255) NOT NULL,
    stored_filename VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_type VARCHAR(20) CHECK (file_type IN ('profile_picture', 'document', 'image', 'other')),
    is_public BOOLEAN DEFAULT false,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- System settings
CREATE TABLE system_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT,
    data_type VARCHAR(20) CHECK (data_type IN ('string', 'number', 'boolean', 'json')),
    description TEXT,
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Data backups (simple queue/records)
CREATE TABLE IF NOT EXISTS data_backups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    status VARCHAR(20) NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','completed','failed')),
    description TEXT,
    file_size BIGINT,
    download_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Subscription plans (for admin efficiency)
CREATE TABLE subscription_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plan_name VARCHAR(100) NOT NULL,
    subscription_type VARCHAR(20) NOT NULL CHECK (subscription_type IN ('monthly', 'termly', 'yearly')),
    price_per_student DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'KES',
    features JSONB,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- School subscriptions (current active subscription)
CREATE TABLE school_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    subscription_plan_id UUID REFERENCES subscription_plans(id),
    
    -- Current Subscription Details
    current_student_count INTEGER NOT NULL DEFAULT 0,
    price_per_student DECIMAL(10,2) NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    subscription_type VARCHAR(20) NOT NULL,
    
    -- Billing Cycle
    cycle_start_date DATE NOT NULL,
    cycle_end_date DATE NOT NULL,
    next_billing_date DATE NOT NULL,
    
    -- Payment Status
    payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'overdue', 'failed')),
    last_payment_date DATE,
    
    -- Usage Tracking
    peak_student_count INTEGER DEFAULT 0,
    average_student_count DECIMAL(5,2) DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create performance indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_type_role ON users(user_type, role);
CREATE INDEX idx_users_school ON users(school_id) WHERE school_id IS NOT NULL;
CREATE INDEX idx_users_active ON users(is_active);
CREATE INDEX idx_users_activation_status ON users(activation_status);
CREATE INDEX idx_sessions_user_active ON user_sessions(user_id, is_active);
CREATE INDEX idx_sessions_token ON user_sessions(refresh_token);
CREATE INDEX idx_sessions_expires ON user_sessions(expires_at);
CREATE INDEX idx_password_reset_token ON password_reset_tokens(token);
CREATE INDEX idx_password_reset_expires ON password_reset_tokens(expires_at);
CREATE INDEX idx_students_school ON students(school_id);
CREATE INDEX idx_students_parent ON students(parent_id);
CREATE INDEX idx_staff_school ON staff(school_id);
CREATE INDEX idx_staff_user ON staff(user_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_table_record ON audit_logs(table_name, record_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);
CREATE INDEX idx_file_uploads_user ON file_uploads(user_id);
CREATE INDEX idx_school_subscriptions_school ON school_subscriptions(school_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers to relevant tables
CREATE TRIGGER update_schools_updated_at BEFORE UPDATE ON schools FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_students_updated_at BEFORE UPDATE ON students FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_staff_updated_at BEFORE UPDATE ON staff FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_maintenance_mode_updated_at BEFORE UPDATE ON maintenance_mode FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_system_settings_updated_at BEFORE UPDATE ON system_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_data_backups_updated_at BEFORE UPDATE ON data_backups FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_school_subscriptions_updated_at BEFORE UPDATE ON school_subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger to update subscription total amount
CREATE OR REPLACE FUNCTION update_subscription_total()
RETURNS TRIGGER AS $$
BEGIN
    NEW.total_amount = NEW.current_student_count * NEW.price_per_student;
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_school_subscriptions_total 
BEFORE INSERT OR UPDATE ON school_subscriptions 
FOR EACH ROW EXECUTE FUNCTION update_subscription_total();

-- Insert default data
INSERT INTO system_settings (setting_key, setting_value, data_type, description, is_public) VALUES
('platform_name', 'Edufam', 'string', 'Platform name', true),
('platform_version', '1.0.0', 'string', 'Current platform version', true),
('maintenance_mode', 'false', 'boolean', 'Global maintenance mode status', true),
('max_file_size', '5242880', 'number', 'Maximum file upload size in bytes', false),
('allowed_file_types', '["jpg","jpeg","png","pdf","doc","docx"]', 'json', 'Allowed file upload types', false);

-- Insert default subscription plans
INSERT INTO subscription_plans (plan_name, subscription_type, price_per_student, features) VALUES
('Basic Monthly', 'monthly', 100.00, '{"features": ["basic_management", "attendance_tracking", "grade_management"]}'),
('Standard Monthly', 'monthly', 150.00, '{"features": ["basic_management", "attendance_tracking", "grade_management", "parent_communication", "reports"]}'),
('Premium Monthly', 'monthly', 200.00, '{"features": ["all_features", "advanced_analytics", "custom_reports", "priority_support"]}'),
('Basic Yearly', 'yearly', 1000.00, '{"features": ["basic_management", "attendance_tracking", "grade_management"], "discount": "17%"}'),
('Standard Yearly', 'yearly', 1500.00, '{"features": ["basic_management", "attendance_tracking", "grade_management", "parent_communication", "reports"], "discount": "17%"}'),
('Premium Yearly', 'yearly', 2000.00, '{"features": ["all_features", "advanced_analytics", "custom_reports", "priority_support"], "discount": "17%"}');

-- Create default super admin school (for admin users)
INSERT INTO schools (id, name, code, email, subscription_type, price_per_student) VALUES 
(uuid_generate_v4(), 'Edufam Administration', 'EDUFAM_ADMIN', 'admin@edufam.com', 'yearly', 0.00)
ON CONFLICT (code) DO NOTHING;

-- Create default super admin user (password: 'TempAdmin123!' - MUST BE CHANGED)
INSERT INTO users (
    email, 
    password_hash, 
    user_type, 
    role, 
    first_name, 
    last_name, 
    is_active, 
    email_verified,
    activation_status
) VALUES (
    'admin@edufam.com',
    '$2b$12$LQv3c1yqBwEHFl.QK.1N8uCdcB3N3aBgL1LHlqL1s1KwQ.v8H2YdW', -- TempAdmin123!
    'admin_user',
    'super_admin',
    'Super',
    'Admin',
    true,
    true,
    'active'
) ON CONFLICT (email) DO NOTHING;

-- Log schema creation
INSERT INTO audit_logs (user_id, action, table_name, new_values) VALUES 
(NULL, 'SCHEMA_CREATED', 'system', '{"message": "Database schema created successfully", "version": "1.0.0"}'); 