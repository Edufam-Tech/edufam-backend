-- ====================================
-- TRAINING CENTER WORKSHOP MANAGEMENT SYSTEM
-- ====================================
-- This module handles training center operations, workshop management,
-- instructor coordination, and certification programs

-- Training Centers (Physical or Virtual Locations)
CREATE TABLE training_centers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Center Details
    center_name VARCHAR(255) NOT NULL,
    center_code VARCHAR(20) UNIQUE NOT NULL,
    center_type VARCHAR(30) NOT NULL CHECK (center_type IN ('physical', 'virtual', 'hybrid')),
    description TEXT,
    
    -- Location Information
    address TEXT,
    city VARCHAR(100),
    state_province VARCHAR(100),
    country VARCHAR(100),
    postal_code VARCHAR(20),
    coordinates JSONB, -- {"latitude": -1.2921, "longitude": 36.8219}
    
    -- Contact Information
    phone VARCHAR(20),
    email VARCHAR(255),
    website_url VARCHAR(500),
    
    -- Capacity and Facilities
    max_capacity INTEGER NOT NULL,
    classroom_count INTEGER DEFAULT 1,
    computer_lab_count INTEGER DEFAULT 0,
    has_projector BOOLEAN DEFAULT false,
    has_wifi BOOLEAN DEFAULT true,
    has_parking BOOLEAN DEFAULT false,
    accessibility_features TEXT[],
    
    -- Virtual Center Settings (for online/hybrid)
    virtual_platform VARCHAR(50), -- zoom, teams, meet, webex, etc.
    platform_settings JSONB,
    virtual_room_capacity INTEGER,
    
    -- Operating Information
    operating_hours JSONB, -- {"monday": "08:00-17:00", "tuesday": "08:00-17:00", ...}
    time_zone VARCHAR(50) DEFAULT 'Africa/Nairobi',
    
    -- Management
    center_manager_id UUID REFERENCES users(id) ON DELETE SET NULL,
    backup_manager_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Financial
    hourly_rate DECIMAL(10,2),
    daily_rate DECIMAL(10,2),
    currency VARCHAR(3) DEFAULT 'KES',
    
    -- Status
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'maintenance', 'under_construction')),
    certification_status VARCHAR(30), -- accredited, certified, pending, none
    certifying_body VARCHAR(100),
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES users(id)
);

-- Training Programs and Courses
CREATE TABLE training_programs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Program Details
    program_name VARCHAR(255) NOT NULL,
    program_code VARCHAR(20) UNIQUE NOT NULL,
    program_type VARCHAR(30) NOT NULL CHECK (program_type IN ('certification', 'workshop', 'seminar', 'bootcamp', 'conference')),
    category VARCHAR(50) NOT NULL, -- technology, leadership, education, soft_skills, etc.
    subcategory VARCHAR(50),
    
    -- Content Information
    description TEXT NOT NULL,
    learning_objectives TEXT[],
    prerequisites TEXT[],
    target_audience TEXT[],
    
    -- Duration and Structure
    duration_days INTEGER NOT NULL,
    duration_hours INTEGER NOT NULL,
    session_count INTEGER DEFAULT 1,
    
    -- Difficulty and Requirements
    difficulty_level VARCHAR(20) CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced', 'expert')),
    min_age INTEGER DEFAULT 16,
    max_participants INTEGER DEFAULT 30,
    min_participants INTEGER DEFAULT 5,
    
    -- Certification
    provides_certificate BOOLEAN DEFAULT false,
    certificate_type VARCHAR(50), -- completion, achievement, professional, etc.
    certificate_validity_months INTEGER, -- How long certificate is valid
    continuing_education_credits INTEGER DEFAULT 0,
    
    -- Pricing
    base_price DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'KES',
    early_bird_discount DECIMAL(5,2), -- Percentage discount
    group_discount_threshold INTEGER DEFAULT 5,
    group_discount_rate DECIMAL(5,2),
    
    -- Materials and Resources
    materials_included TEXT[],
    required_materials TEXT[],
    software_requirements TEXT[],
    hardware_requirements TEXT[],
    
    -- Delivery Method
    delivery_method VARCHAR(20) CHECK (delivery_method IN ('in_person', 'virtual', 'hybrid', 'self_paced')),
    platform_requirements TEXT[], -- For virtual/hybrid programs
    
    -- Content Management
    curriculum_outline JSONB,
    assessment_methods TEXT[],
    practical_components BOOLEAN DEFAULT false,
    project_based BOOLEAN DEFAULT false,
    
    -- Marketing
    featured_image_url VARCHAR(500),
    promotional_video_url VARCHAR(500),
    marketing_highlights TEXT[],
    testimonials JSONB,
    
    -- Status and Availability
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'suspended', 'archived')),
    is_featured BOOLEAN DEFAULT false,
    
    -- Quality and Ratings
    average_rating DECIMAL(3,2),
    total_ratings INTEGER DEFAULT 0,
    completion_rate DECIMAL(5,2), -- Percentage of participants who complete
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES users(id)
);

-- Training Sessions (Scheduled Instances of Programs)
CREATE TABLE training_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id UUID NOT NULL REFERENCES training_programs(id) ON DELETE CASCADE,
    center_id UUID NOT NULL REFERENCES training_centers(id) ON DELETE RESTRICT,
    
    -- Session Details
    session_name VARCHAR(255), -- Optional custom name for this session
    session_code VARCHAR(20) UNIQUE NOT NULL,
    cohort_name VARCHAR(100), -- Cohort/batch identifier
    
    -- Scheduling
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    time_zone VARCHAR(50) DEFAULT 'Africa/Nairobi',
    
    -- Daily Schedule
    daily_schedule JSONB, -- Detailed daily agenda
    break_schedule JSONB, -- Break times and durations
    
    -- Capacity Management
    max_participants INTEGER NOT NULL,
    min_participants INTEGER DEFAULT 5,
    current_enrollments INTEGER DEFAULT 0,
    waitlist_capacity INTEGER DEFAULT 10,
    
    -- Pricing (can override program pricing)
    session_price DECIMAL(10,2),
    early_bird_deadline DATE,
    early_bird_discount DECIMAL(5,2),
    
    -- Delivery Settings
    delivery_method VARCHAR(20) NOT NULL,
    virtual_meeting_url VARCHAR(500), -- For virtual/hybrid sessions
    virtual_meeting_id VARCHAR(100),
    virtual_meeting_password VARCHAR(50),
    
    -- Instructors and Staff
    lead_instructor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    co_instructors UUID[], -- Array of instructor user IDs
    teaching_assistants UUID[], -- Array of TA user IDs
    support_staff UUID[], -- Array of support staff user IDs
    
    -- Materials and Resources
    course_materials_url VARCHAR(500),
    resource_links JSONB,
    required_software TEXT[],
    material_distribution_method VARCHAR(30), -- digital, physical, hybrid
    
    -- Assessment and Evaluation
    assessment_schedule JSONB,
    project_deadlines JSONB,
    evaluation_criteria JSONB,
    
    -- Session Status
    status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'postponed')),
    cancellation_reason TEXT,
    postponement_reason TEXT,
    
    -- Registration
    registration_opens TIMESTAMP,
    registration_closes TIMESTAMP,
    registration_status VARCHAR(20) DEFAULT 'open' CHECK (registration_status IN ('open', 'closed', 'waitlist_only', 'full')),
    
    -- Quality Tracking
    session_rating DECIMAL(3,2),
    completion_rate DECIMAL(5,2),
    feedback_summary TEXT,
    
    -- Administrative
    internal_notes TEXT,
    special_requirements TEXT[],
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES users(id)
);

-- Training Enrollments and Registrations
CREATE TABLE training_enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
    participant_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Enrollment Details
    enrollment_date TIMESTAMP DEFAULT NOW(),
    enrollment_status VARCHAR(20) DEFAULT 'registered' CHECK (enrollment_status IN ('registered', 'confirmed', 'waitlisted', 'attended', 'completed', 'dropped', 'no_show', 'cancelled')),
    enrollment_type VARCHAR(20) DEFAULT 'individual' CHECK (enrollment_type IN ('individual', 'corporate', 'scholarship', 'free', 'group')),
    
    -- Participant Information
    participant_type VARCHAR(30) DEFAULT 'external' CHECK (participant_type IN ('student', 'teacher', 'parent', 'external', 'employee')),
    organization VARCHAR(255), -- If corporate enrollment
    job_title VARCHAR(100),
    experience_level VARCHAR(20),
    
    -- Contact and Emergency Information
    emergency_contact_name VARCHAR(255),
    emergency_contact_phone VARCHAR(20),
    emergency_contact_relationship VARCHAR(50),
    
    -- Special Needs and Requirements
    dietary_restrictions TEXT,
    accessibility_needs TEXT,
    special_accommodations TEXT,
    
    -- Payment Information
    total_amount DECIMAL(10,2) NOT NULL,
    amount_paid DECIMAL(10,2) DEFAULT 0,
    payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'partial', 'completed', 'refunded', 'waived')),
    payment_method VARCHAR(30),
    discount_applied DECIMAL(5,2), -- Percentage discount applied
    discount_reason VARCHAR(100),
    
    -- Attendance Tracking
    attendance_records JSONB, -- Daily attendance tracking
    total_sessions_attended INTEGER DEFAULT 0,
    attendance_percentage DECIMAL(5,2),
    
    -- Performance and Assessment
    assignment_scores JSONB,
    project_scores JSONB,
    final_score DECIMAL(5,2),
    grade VARCHAR(10),
    
    -- Certification
    certificate_earned BOOLEAN DEFAULT false,
    certificate_issued_date DATE,
    certificate_number VARCHAR(100),
    certificate_url VARCHAR(500),
    
    -- Feedback and Evaluation
    pre_training_assessment JSONB,
    post_training_assessment JSONB,
    feedback_rating DECIMAL(3,2),
    feedback_comments TEXT,
    would_recommend BOOLEAN,
    
    -- Administrative
    registration_source VARCHAR(50), -- website, phone, referral, etc.
    referral_code VARCHAR(20),
    marketing_source VARCHAR(100),
    internal_notes TEXT,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Training Instructors and Staff
CREATE TABLE training_instructors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Instructor Details
    instructor_code VARCHAR(20) UNIQUE NOT NULL,
    instructor_type VARCHAR(30) DEFAULT 'freelance' CHECK (instructor_type IN ('employee', 'freelance', 'contractor', 'volunteer', 'guest')),
    specializations TEXT[],
    
    -- Qualifications and Certifications
    education_background TEXT[],
    certifications TEXT[],
    years_experience INTEGER,
    industry_experience TEXT[],
    
    -- Teaching Information
    teaching_experience_years INTEGER,
    preferred_subjects TEXT[],
    teaching_methods TEXT[],
    languages_spoken VARCHAR(50)[],
    max_class_size INTEGER DEFAULT 30,
    
    -- Availability
    availability_schedule JSONB, -- Weekly availability
    time_zone VARCHAR(50) DEFAULT 'Africa/Nairobi',
    travel_willing BOOLEAN DEFAULT false,
    virtual_teaching_capable BOOLEAN DEFAULT true,
    
    -- Performance Metrics
    average_rating DECIMAL(3,2),
    total_sessions_taught INTEGER DEFAULT 0,
    total_participants_taught INTEGER DEFAULT 0,
    completion_rate DECIMAL(5,2), -- Average completion rate of their sessions
    
    -- Financial
    hourly_rate DECIMAL(10,2),
    daily_rate DECIMAL(10,2),
    currency VARCHAR(3) DEFAULT 'KES',
    payment_terms VARCHAR(50), -- hourly, daily, per_session, monthly
    
    -- Equipment and Setup
    has_own_equipment BOOLEAN DEFAULT false,
    equipment_list TEXT[],
    technical_requirements TEXT[],
    
    -- Status and Verification
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended', 'pending_verification')),
    background_check_completed BOOLEAN DEFAULT false,
    background_check_date DATE,
    reference_check_completed BOOLEAN DEFAULT false,
    
    -- Contract and Legal
    contract_type VARCHAR(30),
    contract_start_date DATE,
    contract_end_date DATE,
    nda_signed BOOLEAN DEFAULT false,
    
    -- Profile and Marketing
    bio TEXT,
    profile_image_url VARCHAR(500),
    linkedin_url VARCHAR(500),
    website_url VARCHAR(500),
    portfolio_url VARCHAR(500),
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES users(id)
);

-- Training Resources and Materials
CREATE TABLE training_resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Resource Details
    resource_name VARCHAR(255) NOT NULL,
    resource_type VARCHAR(30) NOT NULL CHECK (resource_type IN ('document', 'video', 'audio', 'presentation', 'software', 'dataset', 'template', 'tool')),
    category VARCHAR(50),
    
    -- Content Information
    description TEXT,
    file_url VARCHAR(500),
    file_size_mb DECIMAL(10,2),
    file_format VARCHAR(20),
    
    -- Access and Permissions
    access_level VARCHAR(20) DEFAULT 'restricted' CHECK (access_level IN ('public', 'restricted', 'instructor_only', 'admin_only')),
    download_allowed BOOLEAN DEFAULT true,
    print_allowed BOOLEAN DEFAULT true,
    
    -- Associations
    program_ids UUID[], -- Programs that use this resource
    session_ids UUID[], -- Specific sessions that use this resource
    instructor_ids UUID[], -- Instructors who created/own this resource
    
    -- Version Control
    version VARCHAR(10) DEFAULT '1.0',
    previous_version_id UUID REFERENCES training_resources(id),
    is_current_version BOOLEAN DEFAULT true,
    
    -- Usage Tracking
    download_count INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    last_accessed TIMESTAMP,
    
    -- Quality and Reviews
    rating DECIMAL(3,2),
    review_count INTEGER DEFAULT 0,
    
    -- Status
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deprecated')),
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES users(id)
);

-- Training Analytics and Reports
CREATE TABLE training_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Analytics Scope
    analytics_type VARCHAR(30) NOT NULL CHECK (analytics_type IN ('session', 'program', 'instructor', 'center', 'overall')),
    entity_id UUID, -- ID of the entity being analyzed
    
    -- Time Period
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    generated_date TIMESTAMP DEFAULT NOW(),
    
    -- Enrollment Metrics
    total_enrollments INTEGER DEFAULT 0,
    total_completions INTEGER DEFAULT 0,
    completion_rate DECIMAL(5,2),
    dropout_rate DECIMAL(5,2),
    no_show_rate DECIMAL(5,2),
    
    -- Financial Metrics
    total_revenue DECIMAL(12,2) DEFAULT 0,
    average_price_per_participant DECIMAL(10,2),
    discount_percentage DECIMAL(5,2),
    refund_amount DECIMAL(12,2) DEFAULT 0,
    
    -- Quality Metrics
    average_rating DECIMAL(3,2),
    total_feedback_count INTEGER DEFAULT 0,
    recommendation_rate DECIMAL(5,2),
    
    -- Operational Metrics
    utilization_rate DECIMAL(5,2), -- For centers/instructors
    cancellation_rate DECIMAL(5,2),
    postponement_rate DECIMAL(5,2),
    
    -- Detailed Metrics (JSON)
    detailed_metrics JSONB,
    
    -- Comparison Data
    previous_period_comparison JSONB,
    
    -- Status
    is_current BOOLEAN DEFAULT true,
    
    created_at TIMESTAMP DEFAULT NOW(),
    created_by UUID REFERENCES users(id)
);

-- ====================================
-- INDEXES FOR PERFORMANCE
-- ====================================

-- Training centers indexes
CREATE INDEX idx_training_centers_type ON training_centers(center_type);
CREATE INDEX idx_training_centers_status ON training_centers(status);
CREATE INDEX idx_training_centers_manager ON training_centers(center_manager_id);
CREATE INDEX idx_training_centers_location ON training_centers(city, country);

-- Training programs indexes
CREATE INDEX idx_training_programs_type ON training_programs(program_type);
CREATE INDEX idx_training_programs_category ON training_programs(category);
CREATE INDEX idx_training_programs_status ON training_programs(status);
CREATE INDEX idx_training_programs_featured ON training_programs(is_featured) WHERE is_featured = true;
CREATE INDEX idx_training_programs_difficulty ON training_programs(difficulty_level);

-- Training sessions indexes
CREATE INDEX idx_training_sessions_program ON training_sessions(program_id);
CREATE INDEX idx_training_sessions_center ON training_sessions(center_id);
CREATE INDEX idx_training_sessions_dates ON training_sessions(start_date, end_date);
CREATE INDEX idx_training_sessions_status ON training_sessions(status);
CREATE INDEX idx_training_sessions_lead_instructor ON training_sessions(lead_instructor_id);
CREATE INDEX idx_training_sessions_registration_status ON training_sessions(registration_status);

-- Training enrollments indexes
CREATE INDEX idx_training_enrollments_session ON training_enrollments(session_id);
CREATE INDEX idx_training_enrollments_participant ON training_enrollments(participant_id);
CREATE INDEX idx_training_enrollments_status ON training_enrollments(enrollment_status);
CREATE INDEX idx_training_enrollments_payment_status ON training_enrollments(payment_status);
CREATE INDEX idx_training_enrollments_date ON training_enrollments(enrollment_date);

-- Training instructors indexes
CREATE INDEX idx_training_instructors_user ON training_instructors(user_id);
CREATE INDEX idx_training_instructors_type ON training_instructors(instructor_type);
CREATE INDEX idx_training_instructors_status ON training_instructors(status);
CREATE INDEX idx_training_instructors_rating ON training_instructors(average_rating DESC);

-- Training resources indexes
CREATE INDEX idx_training_resources_type ON training_resources(resource_type);
CREATE INDEX idx_training_resources_category ON training_resources(category);
CREATE INDEX idx_training_resources_access_level ON training_resources(access_level);
CREATE INDEX idx_training_resources_status ON training_resources(status);

-- Training analytics indexes
CREATE INDEX idx_training_analytics_type ON training_analytics(analytics_type);
CREATE INDEX idx_training_analytics_entity ON training_analytics(entity_id);
CREATE INDEX idx_training_analytics_period ON training_analytics(period_start, period_end);
CREATE INDEX idx_training_analytics_current ON training_analytics(is_current) WHERE is_current = true;

-- ====================================
-- INITIAL DATA
-- ====================================

-- Insert default training center
INSERT INTO training_centers (
    center_name, center_code, center_type, description, max_capacity,
    has_wifi, has_projector, status, created_by
) VALUES (
    'Edufam Main Training Center', 'ETC001', 'hybrid',
    'Primary training facility for educational workshops and professional development',
    50, true, true, 'active',
    (SELECT id FROM users WHERE role = 'super_admin' LIMIT 1)
);

-- Insert sample training programs
INSERT INTO training_programs (
    program_name, program_code, program_type, category, description,
    duration_days, duration_hours, difficulty_level, base_price,
    provides_certificate, status, created_by
) VALUES 
('Digital Literacy for Educators', 'DLE001', 'workshop', 'technology',
'Comprehensive training on digital tools and platforms for modern education',
3, 24, 'beginner', 15000.00, true, 'published',
(SELECT id FROM users WHERE role = 'super_admin' LIMIT 1)),

('Leadership in Education', 'LIE001', 'certification', 'leadership',
'Advanced leadership skills for educational administrators and principals',
5, 40, 'intermediate', 25000.00, true, 'published',
(SELECT id FROM users WHERE role = 'super_admin' LIMIT 1)),

('CBC Implementation Workshop', 'CBC001', 'workshop', 'education',
'Practical training on implementing Competency Based Curriculum in schools',
2, 16, 'intermediate', 12000.00, true, 'published',
(SELECT id FROM users WHERE role = 'super_admin' LIMIT 1));

COMMENT ON TABLE training_centers IS 'Training center locations and facilities management';
COMMENT ON TABLE training_programs IS 'Training programs and course definitions';
COMMENT ON TABLE training_sessions IS 'Scheduled training session instances';
COMMENT ON TABLE training_enrollments IS 'Participant enrollments and progress tracking';
COMMENT ON TABLE training_instructors IS 'Training instructor profiles and qualifications';
COMMENT ON TABLE training_resources IS 'Training materials and resource management';
COMMENT ON TABLE training_analytics IS 'Training performance analytics and metrics';