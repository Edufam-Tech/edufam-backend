-- HR Module Database Schema
-- This file contains all tables and indexes for the HR module

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Employees table (detailed employee information)
CREATE TABLE employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Employee details
    employee_number VARCHAR(50) NOT NULL,
    position VARCHAR(100) NOT NULL,
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    
    -- Employment details
    employment_type VARCHAR(20) DEFAULT 'full_time' CHECK (employment_type IN ('full_time', 'part_time', 'contract', 'intern')),
    start_date DATE NOT NULL,
    end_date DATE,
    probation_end_date DATE,
    
    -- Compensation
    salary DECIMAL(12,2),
    hourly_rate DECIMAL(8,2),
    currency VARCHAR(3) DEFAULT 'KES',
    
    -- Benefits and allowances
    benefits JSONB DEFAULT '{}',
    
    -- Contact information
    emergency_contact JSONB DEFAULT '{}',
    
    -- Status
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'terminated', 'suspended')),
    
    -- Metadata
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_school_employee_number UNIQUE (school_id, employee_number),
    CONSTRAINT unique_school_user_employee UNIQUE (school_id, user_id)
);

-- Leave types table
CREATE TABLE leave_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    
    -- Leave type details
    name VARCHAR(100) NOT NULL,
    description TEXT,
    max_days_per_year INTEGER DEFAULT 0,
    carry_forward_days INTEGER DEFAULT 0,
    
    -- Leave type settings
    requires_approval BOOLEAN DEFAULT true,
    requires_documentation BOOLEAN DEFAULT false,
    advance_notice_days INTEGER DEFAULT 7,
    
    -- Gender and role restrictions
    gender_restriction VARCHAR(10) CHECK (gender_restriction IN ('male', 'female', 'both')),
    role_restrictions JSONB DEFAULT '[]',
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    
    -- Metadata
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_school_leave_type_name UNIQUE (school_id, name)
);

-- Leave applications table
CREATE TABLE leave_applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    leave_type_id UUID NOT NULL REFERENCES leave_types(id) ON DELETE CASCADE,
    
    -- Leave details
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    days_requested INTEGER NOT NULL,
    reason TEXT,
    
    -- Documentation
    attachment_url VARCHAR(500),
    
    -- Status and approval
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMP,
    review_comments TEXT,
    
    -- Metadata
    applied_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Leave balances table
CREATE TABLE leave_balances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    leave_type_id UUID NOT NULL REFERENCES leave_types(id) ON DELETE CASCADE,
    
    -- Balance details
    year INTEGER NOT NULL,
    allocated_days INTEGER DEFAULT 0,
    used_days INTEGER DEFAULT 0,
    remaining_days INTEGER DEFAULT 0,
    carried_forward_days INTEGER DEFAULT 0,
    
    -- Metadata
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_employee_leave_year UNIQUE (employee_id, leave_type_id, year)
);

-- Payroll table
CREATE TABLE payroll (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    
    -- Pay period
    pay_period_start DATE NOT NULL,
    pay_period_end DATE NOT NULL,
    
    -- Salary components
    basic_salary DECIMAL(12,2) DEFAULT 0,
    allowances JSONB DEFAULT '{}', -- House, transport, medical, etc.
    deductions JSONB DEFAULT '{}', -- NSSF, NHIF, tax, loans, etc.
    
    -- Overtime
    overtime_hours DECIMAL(6,2) DEFAULT 0,
    overtime_rate DECIMAL(8,2) DEFAULT 0,
    overtime_pay DECIMAL(10,2) DEFAULT 0,
    
    -- Calculated amounts
    gross_pay DECIMAL(12,2) DEFAULT 0,
    total_deductions DECIMAL(12,2) DEFAULT 0,
    net_pay DECIMAL(12,2) DEFAULT 0,
    
    -- Tax details
    tax_deductions JSONB DEFAULT '{}', -- PAYE, etc.
    
    -- Status
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'paid', 'cancelled')),
    
    -- Processing
    processed_by UUID REFERENCES users(id),
    processed_at TIMESTAMP,
    payment_method VARCHAR(20) DEFAULT 'bank_transfer',
    payment_reference VARCHAR(100),
    
    -- Metadata
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Performance reviews table
CREATE TABLE performance_reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    reviewer_id UUID NOT NULL REFERENCES users(id),
    
    -- Review period
    review_period_start DATE NOT NULL,
    review_period_end DATE NOT NULL,
    review_type VARCHAR(20) DEFAULT 'annual' CHECK (review_type IN ('probation', 'quarterly', 'annual', 'special')),
    
    -- Review content
    goals JSONB DEFAULT '[]',
    achievements JSONB DEFAULT '[]',
    ratings JSONB DEFAULT '{}', -- Different criteria ratings
    overall_score DECIMAL(3,2), -- Out of 5.00
    
    -- Comments
    self_assessment TEXT,
    reviewer_comments TEXT,
    employee_comments TEXT,
    development_plan TEXT,
    
    -- Status
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'in_progress', 'completed', 'acknowledged')),
    
    -- Dates
    due_date DATE,
    completed_at TIMESTAMP,
    acknowledged_at TIMESTAMP,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Performance goals table
CREATE TABLE performance_goals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    
    -- Goal details
    title VARCHAR(255) NOT NULL,
    description TEXT,
    target_completion_date DATE,
    actual_completion_date DATE,
    
    -- Goal metrics
    target_value DECIMAL(10,2),
    actual_value DECIMAL(10,2),
    unit_of_measurement VARCHAR(50),
    
    -- Status
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled', 'deferred')),
    progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
    
    -- Comments
    comments TEXT,
    
    -- Metadata
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Training records table
CREATE TABLE training_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    
    -- Training details
    training_title VARCHAR(255) NOT NULL,
    training_provider VARCHAR(255),
    training_type VARCHAR(50) DEFAULT 'external' CHECK (training_type IN ('internal', 'external', 'online', 'conference')),
    
    -- Dates
    start_date DATE NOT NULL,
    end_date DATE,
    duration_hours INTEGER,
    
    -- Certification
    certification_received BOOLEAN DEFAULT false,
    certificate_url VARCHAR(500),
    certificate_expiry_date DATE,
    
    -- Cost
    cost DECIMAL(10,2),
    currency VARCHAR(3) DEFAULT 'KES',
    
    -- Status
    status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
    
    -- Notes
    notes TEXT,
    
    -- Metadata
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Disciplinary actions table
CREATE TABLE disciplinary_actions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    
    -- Incident details
    incident_date DATE NOT NULL,
    incident_description TEXT NOT NULL,
    incident_type VARCHAR(50) NOT NULL,
    
    -- Action details
    action_type VARCHAR(50) NOT NULL CHECK (action_type IN ('verbal_warning', 'written_warning', 'suspension', 'termination', 'counseling')),
    action_description TEXT,
    
    -- Dates
    action_date DATE NOT NULL,
    effective_date DATE,
    end_date DATE, -- For suspensions
    
    -- Documentation
    attachment_urls JSONB DEFAULT '[]',
    
    -- Status
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'appealed', 'overturned')),
    
    -- Appeal process
    appeal_date DATE,
    appeal_outcome VARCHAR(50),
    appeal_comments TEXT,
    
    -- Metadata
    issued_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Employee attendance tracking
CREATE TABLE employee_attendance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    
    -- Attendance details
    date DATE NOT NULL,
    check_in_time TIME,
    check_out_time TIME,
    
    -- Calculated hours
    hours_worked DECIMAL(4,2),
    overtime_hours DECIMAL(4,2) DEFAULT 0,
    
    -- Status
    status VARCHAR(20) DEFAULT 'present' CHECK (status IN ('present', 'absent', 'late', 'half_day', 'on_leave')),
    
    -- Notes
    notes TEXT,
    
    -- Location tracking (optional)
    check_in_location VARCHAR(255),
    check_out_location VARCHAR(255),
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_employee_date UNIQUE (employee_id, date)
);

-- HR settings table
CREATE TABLE hr_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    
    -- Working hours
    standard_work_hours DECIMAL(4,2) DEFAULT 8.0,
    work_days_per_week INTEGER DEFAULT 5,
    overtime_threshold DECIMAL(4,2) DEFAULT 8.0,
    overtime_multiplier DECIMAL(3,2) DEFAULT 1.5,
    
    -- Leave policies
    annual_leave_days INTEGER DEFAULT 21,
    sick_leave_days INTEGER DEFAULT 14,
    maternity_leave_days INTEGER DEFAULT 90,
    paternity_leave_days INTEGER DEFAULT 14,
    
    -- Payroll settings
    payroll_frequency VARCHAR(20) DEFAULT 'monthly' CHECK (payroll_frequency IN ('weekly', 'biweekly', 'monthly')),
    pay_day INTEGER DEFAULT 30, -- Day of month for monthly payroll
    
    -- Performance review settings
    review_frequency VARCHAR(20) DEFAULT 'annual' CHECK (review_frequency IN ('quarterly', 'biannual', 'annual')),
    probation_period_months INTEGER DEFAULT 6,
    
    -- Notifications
    leave_approval_notifications BOOLEAN DEFAULT true,
    payroll_notifications BOOLEAN DEFAULT true,
    review_due_notifications BOOLEAN DEFAULT true,
    
    -- Metadata
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_school_hr_settings UNIQUE (school_id)
);

-- Create indexes for better performance
CREATE INDEX idx_employees_school ON employees(school_id);
CREATE INDEX idx_employees_user ON employees(user_id);
CREATE INDEX idx_employees_department ON employees(department_id);
CREATE INDEX idx_employees_status ON employees(status);
CREATE INDEX idx_employees_employment_type ON employees(employment_type);

CREATE INDEX idx_leave_applications_school ON leave_applications(school_id);
CREATE INDEX idx_leave_applications_employee ON leave_applications(employee_id);
CREATE INDEX idx_leave_applications_leave_type ON leave_applications(leave_type_id);
CREATE INDEX idx_leave_applications_status ON leave_applications(status);
CREATE INDEX idx_leave_applications_dates ON leave_applications(start_date, end_date);

CREATE INDEX idx_payroll_school ON payroll(school_id);
CREATE INDEX idx_payroll_employee ON payroll(employee_id);
CREATE INDEX idx_payroll_period ON payroll(pay_period_start, pay_period_end);
CREATE INDEX idx_payroll_status ON payroll(status);

CREATE INDEX idx_performance_reviews_school ON performance_reviews(school_id);
CREATE INDEX idx_performance_reviews_employee ON performance_reviews(employee_id);
CREATE INDEX idx_performance_reviews_reviewer ON performance_reviews(reviewer_id);
CREATE INDEX idx_performance_reviews_period ON performance_reviews(review_period_start, review_period_end);
CREATE INDEX idx_performance_reviews_status ON performance_reviews(status);

CREATE INDEX idx_employee_attendance_school ON employee_attendance(school_id);
CREATE INDEX idx_employee_attendance_employee ON employee_attendance(employee_id);
CREATE INDEX idx_employee_attendance_date ON employee_attendance(date);

-- Create triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON employees FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_leave_types_updated_at BEFORE UPDATE ON leave_types FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_leave_applications_updated_at BEFORE UPDATE ON leave_applications FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_leave_balances_updated_at BEFORE UPDATE ON leave_balances FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_payroll_updated_at BEFORE UPDATE ON payroll FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_performance_reviews_updated_at BEFORE UPDATE ON performance_reviews FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_performance_goals_updated_at BEFORE UPDATE ON performance_goals FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_training_records_updated_at BEFORE UPDATE ON training_records FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_disciplinary_actions_updated_at BEFORE UPDATE ON disciplinary_actions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_employee_attendance_updated_at BEFORE UPDATE ON employee_attendance FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_hr_settings_updated_at BEFORE UPDATE ON hr_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE disciplinary_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_settings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for school-based access
CREATE POLICY hr_school_policy ON employees FOR ALL USING (
    school_id IN (
        SELECT s.id FROM schools s
        JOIN users u ON s.id = u.school_id
        WHERE u.id = auth.uid()
    )
);

CREATE POLICY hr_school_policy ON leave_types FOR ALL USING (
    school_id IN (
        SELECT s.id FROM schools s
        JOIN users u ON s.id = u.school_id
        WHERE u.id = auth.uid()
    )
);

CREATE POLICY hr_school_policy ON leave_applications FOR ALL USING (
    school_id IN (
        SELECT s.id FROM schools s
        JOIN users u ON s.id = u.school_id
        WHERE u.id = auth.uid()
    )
);

CREATE POLICY hr_school_policy ON leave_balances FOR ALL USING (
    school_id IN (
        SELECT s.id FROM schools s
        JOIN users u ON s.id = u.school_id
        WHERE u.id = auth.uid()
    )
);

CREATE POLICY hr_school_policy ON payroll FOR ALL USING (
    school_id IN (
        SELECT s.id FROM schools s
        JOIN users u ON s.id = u.school_id
        WHERE u.id = auth.uid()
    )
);

CREATE POLICY hr_school_policy ON performance_reviews FOR ALL USING (
    school_id IN (
        SELECT s.id FROM schools s
        JOIN users u ON s.id = u.school_id
        WHERE u.id = auth.uid()
    )
);

CREATE POLICY hr_school_policy ON performance_goals FOR ALL USING (
    school_id IN (
        SELECT s.id FROM schools s
        JOIN users u ON s.id = u.school_id
        WHERE u.id = auth.uid()
    )
);

CREATE POLICY hr_school_policy ON training_records FOR ALL USING (
    school_id IN (
        SELECT s.id FROM schools s
        JOIN users u ON s.id = u.school_id
        WHERE u.id = auth.uid()
    )
);

CREATE POLICY hr_school_policy ON disciplinary_actions FOR ALL USING (
    school_id IN (
        SELECT s.id FROM schools s
        JOIN users u ON s.id = u.school_id
        WHERE u.id = auth.uid()
    )
);

CREATE POLICY hr_school_policy ON employee_attendance FOR ALL USING (
    school_id IN (
        SELECT s.id FROM schools s
        JOIN users u ON s.id = u.school_id
        WHERE u.id = auth.uid()
    )
);

CREATE POLICY hr_school_policy ON hr_settings FOR ALL USING (
    school_id IN (
        SELECT s.id FROM schools s
        JOIN users u ON s.id = u.school_id
        WHERE u.id = auth.uid()
    )
);

-- Insert default leave types
INSERT INTO leave_types (school_id, name, description, max_days_per_year, created_by) 
SELECT 
    s.id,
    'Annual Leave',
    'Yearly vacation leave',
    21,
    u.id
FROM schools s
JOIN users u ON s.id = u.school_id
WHERE u.role IN ('principal', 'school_director', 'admin')
ON CONFLICT DO NOTHING;

INSERT INTO leave_types (school_id, name, description, max_days_per_year, created_by) 
SELECT 
    s.id,
    'Sick Leave',
    'Medical leave for illness',
    14,
    u.id
FROM schools s
JOIN users u ON s.id = u.school_id
WHERE u.role IN ('principal', 'school_director', 'admin')
ON CONFLICT DO NOTHING;

INSERT INTO leave_types (school_id, name, description, max_days_per_year, created_by, gender_restriction) 
SELECT 
    s.id,
    'Maternity Leave',
    'Leave for childbirth and bonding',
    90,
    u.id,
    'female'
FROM schools s
JOIN users u ON s.id = u.school_id
WHERE u.role IN ('principal', 'school_director', 'admin')
ON CONFLICT DO NOTHING;

INSERT INTO leave_types (school_id, name, description, max_days_per_year, created_by, gender_restriction) 
SELECT 
    s.id,
    'Paternity Leave',
    'Leave for fathers after childbirth',
    14,
    u.id,
    'male'
FROM schools s
JOIN users u ON s.id = u.school_id
WHERE u.role IN ('principal', 'school_director', 'admin')
ON CONFLICT DO NOTHING;

-- Add comments for documentation
COMMENT ON TABLE employees IS 'Detailed employee information and employment records';
COMMENT ON TABLE leave_types IS 'Types of leave available to employees';
COMMENT ON TABLE leave_applications IS 'Employee leave applications and approvals';
COMMENT ON TABLE leave_balances IS 'Leave balances per employee per year';
COMMENT ON TABLE payroll IS 'Payroll records and salary calculations';
COMMENT ON TABLE performance_reviews IS 'Employee performance reviews and evaluations';
COMMENT ON TABLE performance_goals IS 'Employee performance goals and targets';
COMMENT ON TABLE training_records IS 'Employee training and development records';
COMMENT ON TABLE disciplinary_actions IS 'Disciplinary actions and incidents';
COMMENT ON TABLE employee_attendance IS 'Daily attendance tracking for employees';
COMMENT ON TABLE hr_settings IS 'HR module configuration and settings';