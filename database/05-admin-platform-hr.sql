-- ====================================
-- ADMIN PLATFORM HR MANAGEMENT SYSTEM
-- ====================================
-- This module handles internal Edufam company operations,
-- employee management, and admin-level trip management

-- Company Departments
CREATE TABLE admin_departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department_name VARCHAR(100) UNIQUE NOT NULL,
    department_code VARCHAR(20) UNIQUE NOT NULL,
    description TEXT,
    
    -- Management
    head_of_department UUID REFERENCES users(id),
    parent_department_id UUID REFERENCES admin_departments(id),
    
    -- Budget and Operations
    annual_budget DECIMAL(15,2),
    current_budget_used DECIMAL(15,2) DEFAULT 0,
    cost_center_code VARCHAR(50),
    
    -- Location and Contact
    office_location VARCHAR(255),
    contact_email VARCHAR(255),
    contact_phone VARCHAR(20),
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    established_date DATE DEFAULT CURRENT_DATE,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES users(id)
);

-- Company Employees (Internal Edufam Staff)
CREATE TABLE admin_employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Employee Details
    employee_id VARCHAR(20) UNIQUE NOT NULL, -- EMP001, EMP002, etc.
    employee_type VARCHAR(30) NOT NULL CHECK (employee_type IN ('permanent', 'contract', 'intern', 'consultant', 'part_time')),
    job_title VARCHAR(100) NOT NULL,
    job_level VARCHAR(20), -- junior, senior, lead, manager, director, executive
    department_id UUID NOT NULL REFERENCES admin_departments(id),
    
    -- Employment Details
    hire_date DATE NOT NULL,
    probation_end_date DATE,
    contract_start_date DATE,
    contract_end_date DATE,
    
    -- Compensation
    base_salary DECIMAL(12,2),
    currency VARCHAR(3) DEFAULT 'KES',
    payment_frequency VARCHAR(20) DEFAULT 'monthly', -- monthly, weekly, hourly
    overtime_rate DECIMAL(8,2), -- Per hour
    
    -- Benefits
    health_insurance BOOLEAN DEFAULT false,
    life_insurance BOOLEAN DEFAULT false,
    pension_contribution DECIMAL(5,2), -- Percentage
    annual_leave_days INTEGER DEFAULT 21,
    sick_leave_days INTEGER DEFAULT 14,
    
    -- Performance and Development
    performance_rating DECIMAL(3,2), -- 1.00 to 5.00
    last_review_date DATE,
    next_review_date DATE,
    training_budget DECIMAL(10,2),
    
    -- Work Arrangement
    work_location VARCHAR(50), -- office, remote, hybrid
    office_location VARCHAR(255),
    reporting_manager_id UUID REFERENCES admin_employees(id),
    
    -- Employment Status
    employment_status VARCHAR(20) DEFAULT 'active' CHECK (employment_status IN ('active', 'on_leave', 'suspended', 'terminated', 'resigned')),
    termination_date DATE,
    termination_reason TEXT,
    
    -- Emergency Contact
    emergency_contact_name VARCHAR(255),
    emergency_contact_phone VARCHAR(20),
    emergency_contact_relationship VARCHAR(50),
    
    -- System Access
    system_access_level VARCHAR(20) DEFAULT 'standard' CHECK (system_access_level IN ('basic', 'standard', 'advanced', 'admin', 'super_admin')),
    access_granted_date DATE DEFAULT CURRENT_DATE,
    access_expires_date DATE,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES users(id)
);

-- Employee Leave Management
CREATE TABLE admin_employee_leaves (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES admin_employees(id) ON DELETE CASCADE,
    
    -- Leave Details
    leave_type VARCHAR(30) NOT NULL CHECK (leave_type IN ('annual', 'sick', 'maternity', 'paternity', 'bereavement', 'study', 'unpaid', 'emergency')),
    leave_reason TEXT,
    
    -- Dates
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    total_days INTEGER NOT NULL,
    
    -- Approval Workflow
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
    requested_by UUID NOT NULL REFERENCES users(id),
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP,
    rejection_reason TEXT,
    
    -- Work Coverage
    coverage_arrangement TEXT,
    handover_completed BOOLEAN DEFAULT false,
    
    -- HR Processing
    payroll_adjustment BOOLEAN DEFAULT false,
    deducted_from_annual BOOLEAN DEFAULT true,
    
    -- Emergency Contact During Leave
    emergency_reachable BOOLEAN DEFAULT true,
    contact_during_leave VARCHAR(20),
    
    -- Documentation
    supporting_documents TEXT[], -- File paths
    medical_certificate_required BOOLEAN DEFAULT false,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Academic Trips Management (Company-Managed)
CREATE TABLE admin_trip_programs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Program Details
    program_name VARCHAR(200) NOT NULL,
    program_code VARCHAR(20) UNIQUE NOT NULL, -- TRIP2024001
    program_type VARCHAR(30) NOT NULL CHECK (program_type IN ('educational', 'cultural', 'adventure', 'leadership', 'skills_development', 'exchange')),
    target_curriculum VARCHAR(20)[], -- CBC, IGCSE, 8-4-4, IB
    
    -- Educational Objectives
    learning_objectives TEXT[],
    skills_developed TEXT[],
    subject_areas VARCHAR(50)[], -- science, history, geography, etc.
    educational_value_score INTEGER CHECK (educational_value_score >= 1 AND educational_value_score <= 10),
    
    -- Trip Details
    destination_country VARCHAR(100) NOT NULL,
    destination_city VARCHAR(100) NOT NULL,
    destinations TEXT[], -- Multiple locations
    duration_days INTEGER NOT NULL,
    max_participants INTEGER NOT NULL,
    min_participants INTEGER DEFAULT 10,
    
    -- Age and Grade Requirements
    min_age INTEGER,
    max_age INTEGER,
    target_grades VARCHAR(10)[], -- Grade 9, Grade 10, etc.
    prerequisite_requirements TEXT,
    
    -- Costs and Pricing
    base_cost DECIMAL(12,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'KES',
    cost_includes TEXT[], -- flights, accommodation, meals, etc.
    cost_excludes TEXT[], -- personal expenses, insurance, etc.
    payment_plan_available BOOLEAN DEFAULT true,
    early_bird_discount DECIMAL(5,2), -- Percentage
    group_discount_threshold INTEGER DEFAULT 20,
    group_discount_rate DECIMAL(5,2),
    
    -- Travel Logistics
    departure_location VARCHAR(255),
    transportation_mode VARCHAR(50)[], -- flight, bus, train
    accommodation_type VARCHAR(50), -- hotel, hostel, homestay, camping
    meal_plan VARCHAR(50), -- full_board, half_board, breakfast_only
    
    -- Safety and Requirements
    safety_rating VARCHAR(20) CHECK (safety_rating IN ('low_risk', 'medium_risk', 'high_risk')),
    insurance_required BOOLEAN DEFAULT true,
    passport_required BOOLEAN DEFAULT true,
    visa_required BOOLEAN DEFAULT false,
    vaccination_requirements TEXT[],
    medical_requirements TEXT,
    
    -- Staffing
    trip_leader_id UUID REFERENCES admin_employees(id),
    required_chaperones INTEGER DEFAULT 2,
    student_to_chaperone_ratio VARCHAR(10) DEFAULT '10:1',
    
    -- Program Status
    program_status VARCHAR(20) DEFAULT 'draft' CHECK (program_status IN ('draft', 'published', 'open_registration', 'closed', 'completed', 'cancelled')),
    registration_opens DATE,
    registration_closes DATE,
    trip_start_date DATE,
    trip_end_date DATE,
    
    -- Marketing and Promotion
    featured_image_url VARCHAR(500),
    gallery_images TEXT[],
    promotional_video_url VARCHAR(500),
    marketing_description TEXT,
    highlights TEXT[],
    
    -- Partner Organizations
    partner_organizations JSONB, -- Travel agencies, educational partners, etc.
    local_contacts JSONB,
    
    -- Reviews and Feedback
    average_rating DECIMAL(3,2),
    total_reviews INTEGER DEFAULT 0,
    recommendation_score INTEGER, -- NPS-style score
    
    -- Compliance and Documentation
    risk_assessment_completed BOOLEAN DEFAULT false,
    risk_assessment_date DATE,
    insurance_coverage_details TEXT,
    emergency_procedures TEXT,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES users(id)
);

-- Trip Registrations and Bookings
CREATE TABLE admin_trip_registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_program_id UUID NOT NULL REFERENCES admin_trip_programs(id) ON DELETE CASCADE,
    
    -- Student Information
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    
    -- Registration Details
    registration_date TIMESTAMP DEFAULT NOW(),
    registration_status VARCHAR(20) DEFAULT 'pending' CHECK (registration_status IN ('pending', 'confirmed', 'waitlisted', 'cancelled', 'completed')),
    
    -- Parent/Guardian Consent
    parent_guardian_id UUID REFERENCES users(id), -- Should be parent role
    consent_given BOOLEAN DEFAULT false,
    consent_date TIMESTAMP,
    medical_consent BOOLEAN DEFAULT false,
    photo_consent BOOLEAN DEFAULT false,
    
    -- Payment Information
    total_amount DECIMAL(12,2) NOT NULL,
    amount_paid DECIMAL(12,2) DEFAULT 0,
    payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'partial', 'completed', 'refunded')),
    payment_method VARCHAR(30),
    payment_plan JSONB, -- Installment details
    
    -- Medical and Special Requirements
    medical_conditions TEXT,
    dietary_restrictions TEXT,
    special_needs TEXT,
    emergency_medication TEXT,
    
    -- Travel Documents
    passport_number VARCHAR(50),
    passport_expiry DATE,
    visa_status VARCHAR(20) DEFAULT 'not_required' CHECK (visa_status IN ('not_required', 'pending', 'approved', 'rejected')),
    insurance_policy_number VARCHAR(100),
    
    -- Communication Preferences
    preferred_contact_method VARCHAR(20) DEFAULT 'email' CHECK (preferred_contact_method IN ('email', 'sms', 'phone', 'whatsapp')),
    emergency_contact_abroad VARCHAR(255),
    
    -- Trip-Specific Information
    room_preference VARCHAR(30), -- single, shared, no_preference
    roommate_request VARCHAR(255),
    special_requests TEXT,
    
    -- Cancellation and Refunds
    cancellation_date TIMESTAMP,
    cancellation_reason TEXT,
    refund_amount DECIMAL(12,2),
    refund_processed BOOLEAN DEFAULT false,
    
    -- Feedback and Reviews
    trip_rating INTEGER CHECK (trip_rating >= 1 AND trip_rating <= 5),
    trip_review TEXT,
    would_recommend BOOLEAN,
    review_date TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Employee Training and Development
CREATE TABLE admin_employee_training (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES admin_employees(id) ON DELETE CASCADE,
    
    -- Training Details
    training_title VARCHAR(200) NOT NULL,
    training_type VARCHAR(30) NOT NULL CHECK (training_type IN ('orientation', 'skills', 'compliance', 'leadership', 'technical', 'soft_skills', 'certification')),
    training_provider VARCHAR(255),
    training_mode VARCHAR(20) CHECK (training_mode IN ('online', 'in_person', 'hybrid', 'self_paced')),
    
    -- Scheduling
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    duration_hours INTEGER,
    
    -- Cost and Budget
    training_cost DECIMAL(10,2),
    approved_budget DECIMAL(10,2),
    cost_center VARCHAR(50),
    
    -- Completion and Certification
    completion_status VARCHAR(20) DEFAULT 'enrolled' CHECK (completion_status IN ('enrolled', 'in_progress', 'completed', 'failed', 'cancelled')),
    completion_date DATE,
    certificate_earned BOOLEAN DEFAULT false,
    certificate_url VARCHAR(500),
    expiry_date DATE,
    
    -- Performance
    score_achieved DECIMAL(5,2),
    passing_score DECIMAL(5,2),
    trainer_feedback TEXT,
    
    -- Business Impact
    skills_gained TEXT[],
    competency_improvement TEXT,
    application_deadline DATE, -- When to apply learned skills
    
    -- Approval Workflow
    requested_by UUID NOT NULL REFERENCES users(id),
    approved_by UUID REFERENCES users(id),
    approval_date TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Company Assets and Equipment
CREATE TABLE admin_company_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Asset Details
    asset_name VARCHAR(200) NOT NULL,
    asset_code VARCHAR(50) UNIQUE NOT NULL,
    asset_category VARCHAR(50) NOT NULL, -- IT Equipment, Furniture, Vehicle, etc.
    asset_type VARCHAR(100), -- Laptop, Desk, Car, etc.
    brand VARCHAR(100),
    model VARCHAR(100),
    serial_number VARCHAR(100),
    
    -- Financial Information
    purchase_cost DECIMAL(12,2),
    current_value DECIMAL(12,2),
    depreciation_rate DECIMAL(5,2), -- Annual percentage
    depreciation_method VARCHAR(20) DEFAULT 'straight_line',
    
    -- Acquisition Details
    purchase_date DATE,
    supplier VARCHAR(255),
    warranty_period_months INTEGER,
    warranty_expiry DATE,
    
    -- Assignment and Location
    assigned_to_employee UUID REFERENCES admin_employees(id),
    assignment_date DATE,
    current_location VARCHAR(255),
    department_id UUID REFERENCES admin_departments(id),
    
    -- Condition and Maintenance
    condition_status VARCHAR(20) DEFAULT 'excellent' CHECK (condition_status IN ('excellent', 'good', 'fair', 'poor', 'damaged', 'disposed')),
    last_maintenance_date DATE,
    next_maintenance_due DATE,
    maintenance_notes TEXT,
    
    -- Insurance and Compliance
    insured BOOLEAN DEFAULT false,
    insurance_policy_number VARCHAR(100),
    compliance_certifications TEXT[],
    
    -- Asset Status
    asset_status VARCHAR(20) DEFAULT 'active' CHECK (asset_status IN ('active', 'inactive', 'maintenance', 'disposed', 'lost', 'stolen')),
    disposal_date DATE,
    disposal_reason TEXT,
    disposal_value DECIMAL(12,2),
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES users(id)
);

-- Performance Reviews and Evaluations
CREATE TABLE admin_performance_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES admin_employees(id) ON DELETE CASCADE,
    reviewer_id UUID NOT NULL REFERENCES admin_employees(id),
    
    -- Review Period
    review_period_start DATE NOT NULL,
    review_period_end DATE NOT NULL,
    review_type VARCHAR(30) NOT NULL CHECK (review_type IN ('probation', 'quarterly', 'annual', 'promotion', 'disciplinary')),
    
    -- Performance Metrics
    overall_rating DECIMAL(3,2) NOT NULL CHECK (overall_rating >= 1.0 AND overall_rating <= 5.0),
    technical_skills_rating DECIMAL(3,2),
    communication_rating DECIMAL(3,2),
    teamwork_rating DECIMAL(3,2),
    leadership_rating DECIMAL(3,2),
    initiative_rating DECIMAL(3,2),
    
    -- Goals and Achievements
    goals_set_previous_review TEXT[],
    goals_achieved TEXT[],
    key_accomplishments TEXT[],
    areas_for_improvement TEXT[],
    
    -- Development Planning
    training_recommendations TEXT[],
    career_development_goals TEXT[],
    next_review_goals TEXT[],
    
    -- Compensation Review
    salary_recommendation VARCHAR(20), -- increase, maintain, decrease
    promotion_recommendation BOOLEAN DEFAULT false,
    bonus_recommendation DECIMAL(10,2),
    
    -- Comments and Feedback
    reviewer_comments TEXT,
    employee_self_assessment TEXT,
    employee_comments TEXT,
    hr_comments TEXT,
    
    -- Review Status
    review_status VARCHAR(20) DEFAULT 'draft' CHECK (review_status IN ('draft', 'employee_review', 'manager_review', 'hr_review', 'completed')),
    review_date DATE DEFAULT CURRENT_DATE,
    employee_acknowledgment BOOLEAN DEFAULT false,
    acknowledgment_date TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ====================================
-- INDEXES FOR PERFORMANCE
-- ====================================

-- Admin departments indexes
CREATE INDEX idx_admin_departments_head ON admin_departments(head_of_department);
CREATE INDEX idx_admin_departments_parent ON admin_departments(parent_department_id);
CREATE INDEX idx_admin_departments_active ON admin_departments(is_active) WHERE is_active = true;

-- Admin employees indexes
CREATE INDEX idx_admin_employees_user ON admin_employees(user_id);
CREATE INDEX idx_admin_employees_department ON admin_employees(department_id);
CREATE INDEX idx_admin_employees_manager ON admin_employees(reporting_manager_id);
CREATE INDEX idx_admin_employees_status ON admin_employees(employment_status);
CREATE INDEX idx_admin_employees_type ON admin_employees(employee_type);
CREATE INDEX idx_admin_employees_hire_date ON admin_employees(hire_date DESC);

-- Employee leaves indexes
CREATE INDEX idx_admin_employee_leaves_employee ON admin_employee_leaves(employee_id);
CREATE INDEX idx_admin_employee_leaves_dates ON admin_employee_leaves(start_date, end_date);
CREATE INDEX idx_admin_employee_leaves_status ON admin_employee_leaves(status);
CREATE INDEX idx_admin_employee_leaves_type ON admin_employee_leaves(leave_type);

-- Trip programs indexes
CREATE INDEX idx_admin_trip_programs_status ON admin_trip_programs(program_status);
CREATE INDEX idx_admin_trip_programs_dates ON admin_trip_programs(trip_start_date, trip_end_date);
CREATE INDEX idx_admin_trip_programs_type ON admin_trip_programs(program_type);
CREATE INDEX idx_admin_trip_programs_leader ON admin_trip_programs(trip_leader_id);
CREATE INDEX idx_admin_trip_programs_destination ON admin_trip_programs(destination_country, destination_city);

-- Trip registrations indexes
CREATE INDEX idx_admin_trip_registrations_program ON admin_trip_registrations(trip_program_id);
CREATE INDEX idx_admin_trip_registrations_student ON admin_trip_registrations(student_id);
CREATE INDEX idx_admin_trip_registrations_school ON admin_trip_registrations(school_id);
CREATE INDEX idx_admin_trip_registrations_status ON admin_trip_registrations(registration_status);
CREATE INDEX idx_admin_trip_registrations_payment ON admin_trip_registrations(payment_status);

-- Employee training indexes
CREATE INDEX idx_admin_employee_training_employee ON admin_employee_training(employee_id);
CREATE INDEX idx_admin_employee_training_dates ON admin_employee_training(start_date, end_date);
CREATE INDEX idx_admin_employee_training_status ON admin_employee_training(completion_status);
CREATE INDEX idx_admin_employee_training_type ON admin_employee_training(training_type);

-- Company assets indexes
CREATE INDEX idx_admin_company_assets_assigned ON admin_company_assets(assigned_to_employee);
CREATE INDEX idx_admin_company_assets_department ON admin_company_assets(department_id);
CREATE INDEX idx_admin_company_assets_category ON admin_company_assets(asset_category);
CREATE INDEX idx_admin_company_assets_status ON admin_company_assets(asset_status);
CREATE INDEX idx_admin_company_assets_code ON admin_company_assets(asset_code);

-- Performance reviews indexes
CREATE INDEX idx_admin_performance_reviews_employee ON admin_performance_reviews(employee_id);
CREATE INDEX idx_admin_performance_reviews_reviewer ON admin_performance_reviews(reviewer_id);
CREATE INDEX idx_admin_performance_reviews_period ON admin_performance_reviews(review_period_start, review_period_end);
CREATE INDEX idx_admin_performance_reviews_type ON admin_performance_reviews(review_type);
CREATE INDEX idx_admin_performance_reviews_status ON admin_performance_reviews(review_status);

-- ====================================
-- ROW LEVEL SECURITY POLICIES
-- ====================================

-- Enable RLS on all admin tables
ALTER TABLE admin_departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_employee_leaves ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_trip_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_trip_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_employee_training ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_company_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_performance_reviews ENABLE ROW LEVEL SECURITY;

-- Admin departments policies (Admin and HR access only)
CREATE POLICY admin_departments_admin_access ON admin_departments
    FOR ALL USING (
        current_setting('app.current_user_id')::UUID IN (
            SELECT id FROM users WHERE role IN ('super_admin', 'edufam_admin', 'hr_manager')
        )
    );

-- Admin employees policies (Admin, HR, and self-access)
CREATE POLICY admin_employees_admin_hr_access ON admin_employees
    FOR ALL USING (
        current_setting('app.current_user_id')::UUID IN (
            SELECT id FROM users WHERE role IN ('super_admin', 'edufam_admin', 'hr_manager')
        ) OR 
        user_id = current_setting('app.current_user_id')::UUID OR
        reporting_manager_id = (
            SELECT id FROM admin_employees WHERE user_id = current_setting('app.current_user_id')::UUID
        )
    );

-- Employee leaves policies (Employee, manager, HR access)
CREATE POLICY admin_employee_leaves_access ON admin_employee_leaves
    FOR ALL USING (
        current_setting('app.current_user_id')::UUID IN (
            SELECT id FROM users WHERE role IN ('super_admin', 'edufam_admin', 'hr_manager')
        ) OR
        employee_id = (
            SELECT id FROM admin_employees WHERE user_id = current_setting('app.current_user_id')::UUID
        ) OR
        employee_id IN (
            SELECT id FROM admin_employees 
            WHERE reporting_manager_id = (
                SELECT id FROM admin_employees WHERE user_id = current_setting('app.current_user_id')::UUID
            )
        )
    );

-- Trip programs policies (Admin and trip managers)
CREATE POLICY admin_trip_programs_access ON admin_trip_programs
    FOR ALL USING (
        current_setting('app.current_user_id')::UUID IN (
            SELECT id FROM users WHERE role IN ('super_admin', 'edufam_admin', 'trip_manager')
        ) OR
        trip_leader_id = (
            SELECT id FROM admin_employees WHERE user_id = current_setting('app.current_user_id')::UUID
        )
    );

-- Trip registrations policies (School-based access with admin override)
CREATE POLICY admin_trip_registrations_access ON admin_trip_registrations
    FOR ALL USING (
        school_id = current_setting('app.current_school_id')::UUID OR
        current_setting('app.current_user_id')::UUID IN (
            SELECT id FROM users WHERE role IN ('super_admin', 'edufam_admin', 'trip_manager')
        )
    );

-- Similar policies for other tables following the same pattern...

-- ====================================
-- INITIAL DATA
-- ====================================

-- Insert default departments
INSERT INTO admin_departments (department_name, department_code, description, created_by) VALUES
('Human Resources', 'HR', 'Employee management and organizational development', (SELECT id FROM users WHERE role = 'super_admin' LIMIT 1)),
('Technology', 'TECH', 'Software development and IT infrastructure', (SELECT id FROM users WHERE role = 'super_admin' LIMIT 1)),
('Operations', 'OPS', 'Business operations and process management', (SELECT id FROM users WHERE role = 'super_admin' LIMIT 1)),
('Sales & Marketing', 'SALES', 'Customer acquisition and marketing', (SELECT id FROM users WHERE role = 'super_admin' LIMIT 1)),
('Finance', 'FIN', 'Financial management and accounting', (SELECT id FROM users WHERE role = 'super_admin' LIMIT 1)),
('Academic Programs', 'ACAD', 'Educational trip programs and curriculum development', (SELECT id FROM users WHERE role = 'super_admin' LIMIT 1));

COMMENT ON TABLE admin_departments IS 'Company departments for internal Edufam organization';
COMMENT ON TABLE admin_employees IS 'Internal Edufam employees with comprehensive HR information';
COMMENT ON TABLE admin_employee_leaves IS 'Employee leave requests and management';
COMMENT ON TABLE admin_trip_programs IS 'Company-managed academic trip programs for schools';
COMMENT ON TABLE admin_trip_registrations IS 'Student registrations for academic trips';
COMMENT ON TABLE admin_employee_training IS 'Employee training and development tracking';
COMMENT ON TABLE admin_company_assets IS 'Company asset and equipment management';
COMMENT ON TABLE admin_performance_reviews IS 'Employee performance evaluation system';