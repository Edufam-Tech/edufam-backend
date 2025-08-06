-- Migration: Add Specialized School Modules Database Tables
-- This script adds tables for: AI Timetable Generator, Certification, Invoice Generation, 
-- Performance Appraisal, and Academic Trips modules

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- PREREQUISITE TABLES (CREATE IF NOT EXISTS)
-- =============================================================================

-- Classrooms table (required for timetable)
CREATE TABLE IF NOT EXISTS classrooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    
    room_name VARCHAR(100) NOT NULL,
    room_number VARCHAR(20),
    building VARCHAR(100),
    floor INTEGER,
    
    capacity INTEGER,
    room_type VARCHAR(30) DEFAULT 'classroom' CHECK (room_type IN ('classroom', 'laboratory', 'library', 'hall', 'office', 'sports', 'computer_lab')),
    
    -- Equipment and facilities
    has_projector BOOLEAN DEFAULT false,
    has_whiteboard BOOLEAN DEFAULT true,
    has_computer BOOLEAN DEFAULT false,
    has_internet BOOLEAN DEFAULT true,
    equipment_notes TEXT,
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(school_id, room_number)
);

-- =============================================================================
-- MODULE 11: AI-POWERED TIMETABLE GENERATOR
-- =============================================================================

-- Timetable configurations (settings and constraints)
CREATE TABLE IF NOT EXISTS timetable_configurations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Configuration settings
    periods_per_day INTEGER NOT NULL DEFAULT 8,
    working_days JSONB DEFAULT '["monday", "tuesday", "wednesday", "thursday", "friday"]',
    period_duration INTEGER NOT NULL DEFAULT 40, -- minutes
    break_periods JSONB DEFAULT '[]', -- array of break period configurations
    
    -- Constraints
    max_periods_per_teacher_per_day INTEGER DEFAULT 6,
    min_break_between_subjects INTEGER DEFAULT 0, -- periods
    allow_double_periods BOOLEAN DEFAULT true,
    prefer_morning_for_core_subjects BOOLEAN DEFAULT true,
    
    -- AI optimization settings
    optimization_weight_conflicts DECIMAL(3,2) DEFAULT 1.0,
    optimization_weight_preferences DECIMAL(3,2) DEFAULT 0.7,
    optimization_weight_distribution DECIMAL(3,2) DEFAULT 0.8,
    optimization_weight_workload DECIMAL(3,2) DEFAULT 0.9,
    
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Timetable periods (time slots)
CREATE TABLE IF NOT EXISTS timetable_periods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    configuration_id UUID REFERENCES timetable_configurations(id) ON DELETE CASCADE,
    
    period_number INTEGER NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    day_of_week VARCHAR(10) NOT NULL CHECK (day_of_week IN ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')),
    is_break BOOLEAN DEFAULT false,
    break_type VARCHAR(20) CHECK (break_type IN ('short', 'lunch', 'assembly')),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(school_id, configuration_id, day_of_week, period_number)
);

-- Timetable versions (version history) - MOVED UP to resolve circular reference
CREATE TABLE IF NOT EXISTS timetable_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    configuration_id UUID REFERENCES timetable_configurations(id) ON DELETE CASCADE,
    
    version_name VARCHAR(255) NOT NULL,
    description TEXT,
    academic_year_id UUID REFERENCES academic_years(id),
    academic_term_id UUID REFERENCES academic_terms(id),
    
    -- Version details
    version_number INTEGER NOT NULL DEFAULT 1,
    is_published BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT false,
    
    -- AI generation metadata
    generation_algorithm VARCHAR(50),
    generation_time_seconds INTEGER,
    total_conflicts INTEGER DEFAULT 0,
    ai_optimization_score DECIMAL(5,2) DEFAULT 0.0,
    
    created_by UUID REFERENCES users(id),
    published_by UUID REFERENCES users(id),
    published_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(school_id, academic_year_id, academic_term_id, version_number)
);

-- Timetable entries (generated schedule)
CREATE TABLE IF NOT EXISTS timetable_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    version_id UUID REFERENCES timetable_versions(id) ON DELETE CASCADE,
    
    period_id UUID REFERENCES timetable_periods(id) ON DELETE CASCADE,
    class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES staff(id) ON DELETE SET NULL,
    room_id UUID REFERENCES classrooms(id) ON DELETE SET NULL,
    
    -- Schedule details
    day_of_week VARCHAR(10) NOT NULL,
    period_number INTEGER NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_double_period BOOLEAN DEFAULT false,
    
    -- AI scoring
    ai_score DECIMAL(5,2) DEFAULT 0.0,
    conflict_count INTEGER DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Teacher availability constraints
CREATE TABLE IF NOT EXISTS teacher_availability (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    
    day_of_week VARCHAR(10) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    availability_type VARCHAR(20) DEFAULT 'available' CHECK (availability_type IN ('available', 'unavailable', 'preferred')),
    reason TEXT,
    
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Room availability constraints
CREATE TABLE IF NOT EXISTS room_availability (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    room_id UUID NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
    
    day_of_week VARCHAR(10) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    availability_type VARCHAR(20) DEFAULT 'available' CHECK (availability_type IN ('available', 'unavailable', 'maintenance')),
    reason TEXT,
    
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Subject requirements (lab needs, double periods)
CREATE TABLE IF NOT EXISTS subject_requirements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    
    requires_lab BOOLEAN DEFAULT false,
    requires_computer_lab BOOLEAN DEFAULT false,
    requires_double_period BOOLEAN DEFAULT false,
    preferred_time_of_day VARCHAR(20) CHECK (preferred_time_of_day IN ('morning', 'afternoon', 'any')),
    max_consecutive_periods INTEGER DEFAULT 1,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Timetable conflicts detection
CREATE TABLE IF NOT EXISTS timetable_conflicts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    version_id UUID REFERENCES timetable_versions(id) ON DELETE CASCADE,
    
    conflict_type VARCHAR(30) NOT NULL CHECK (conflict_type IN ('teacher_double_booking', 'room_double_booking', 'class_double_booking', 'availability_violation', 'requirement_violation')),
    severity VARCHAR(10) DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    description TEXT NOT NULL,
    
    -- Related entities
    entry_id_1 UUID REFERENCES timetable_entries(id),
    entry_id_2 UUID REFERENCES timetable_entries(id),
    teacher_id UUID REFERENCES staff(id),
    room_id UUID REFERENCES classrooms(id),
    class_id UUID REFERENCES classes(id),
    
    is_resolved BOOLEAN DEFAULT false,
    resolution_notes TEXT,
    
    detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- (timetable_versions table moved up above timetable_entries to resolve circular reference)

-- Teacher preferences
CREATE TABLE IF NOT EXISTS timetable_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    
    preference_type VARCHAR(30) NOT NULL CHECK (preference_type IN ('preferred_periods', 'avoid_periods', 'preferred_days', 'avoid_consecutive', 'workload_distribution')),
    day_of_week VARCHAR(10),
    period_number INTEGER,
    preference_strength VARCHAR(10) DEFAULT 'medium' CHECK (preference_strength IN ('low', 'medium', 'high')),
    notes TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- AI optimization logs
CREATE TABLE IF NOT EXISTS ai_optimization_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    version_id UUID REFERENCES timetable_versions(id) ON DELETE CASCADE,
    
    algorithm_used VARCHAR(50) NOT NULL,
    iteration_number INTEGER NOT NULL,
    optimization_score DECIMAL(5,2) NOT NULL,
    conflicts_resolved INTEGER DEFAULT 0,
    preferences_satisfied INTEGER DEFAULT 0,
    
    execution_time_ms INTEGER,
    memory_usage_mb DECIMAL(8,2),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- MODULE 12: CERTIFICATION MODULE
-- =============================================================================

-- Certificate templates (design templates)
CREATE TABLE IF NOT EXISTS certificate_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    description TEXT,
    certificate_type VARCHAR(30) NOT NULL,
    
    -- Template design
    template_html TEXT NOT NULL,
    template_css TEXT,
    background_image_url TEXT,
    logo_url TEXT,
    
    -- Layout settings
    page_size VARCHAR(10) DEFAULT 'A4' CHECK (page_size IN ('A4', 'A3', 'Letter')),
    orientation VARCHAR(10) DEFAULT 'landscape' CHECK (orientation IN ('portrait', 'landscape')),
    margin_top INTEGER DEFAULT 20,
    margin_bottom INTEGER DEFAULT 20,
    margin_left INTEGER DEFAULT 20,
    margin_right INTEGER DEFAULT 20,
    
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Certificate types (merit, graduation, etc.)
CREATE TABLE IF NOT EXISTS certificate_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    description TEXT,
    code VARCHAR(20) NOT NULL,
    
    -- Requirements
    requires_grade BOOLEAN DEFAULT false,
    minimum_grade VARCHAR(10),
    requires_attendance BOOLEAN DEFAULT false,
    minimum_attendance_percentage DECIMAL(5,2),
    requires_conduct BOOLEAN DEFAULT false,
    
    -- Automation settings
    auto_generate BOOLEAN DEFAULT false,
    generation_trigger VARCHAR(30) CHECK (generation_trigger IN ('term_end', 'year_end', 'manual', 'achievement')),
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(school_id, code)
);

-- Certificates issued (generated certificates)
CREATE TABLE IF NOT EXISTS certificates_issued (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    
    certificate_number VARCHAR(50) NOT NULL,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    certificate_type_id UUID NOT NULL REFERENCES certificate_types(id),
    template_id UUID NOT NULL REFERENCES certificate_templates(id),
    
    -- Certificate data
    student_name VARCHAR(255) NOT NULL,
    issue_date DATE NOT NULL,
    academic_year VARCHAR(20),
    academic_term VARCHAR(20),
    grade_achieved VARCHAR(10),
    
    -- File details
    pdf_url TEXT,
    pdf_file_size BIGINT,
    verification_code VARCHAR(50) UNIQUE,
    qr_code_url TEXT,
    
    -- Status
    status VARCHAR(20) DEFAULT 'generated' CHECK (status IN ('draft', 'generated', 'issued', 'revoked')),
    issued_at TIMESTAMP,
    revoked_at TIMESTAMP,
    revocation_reason TEXT,
    
    -- Signatures
    principal_signature_url TEXT,
    teacher_signature_url TEXT,
    
    created_by UUID REFERENCES users(id),
    issued_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(school_id, certificate_number)
);

-- Certificate fields (dynamic fields)
CREATE TABLE IF NOT EXISTS certificate_fields (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_id UUID NOT NULL REFERENCES certificate_templates(id) ON DELETE CASCADE,
    
    field_name VARCHAR(100) NOT NULL,
    field_type VARCHAR(20) NOT NULL CHECK (field_type IN ('text', 'date', 'number', 'image', 'signature')),
    field_label VARCHAR(255),
    
    -- Position on certificate
    x_position INTEGER,
    y_position INTEGER,
    width INTEGER,
    height INTEGER,
    
    -- Styling
    font_family VARCHAR(50),
    font_size INTEGER,
    font_weight VARCHAR(20),
    color VARCHAR(7), -- hex color
    text_align VARCHAR(10) CHECK (text_align IN ('left', 'center', 'right')),
    
    is_required BOOLEAN DEFAULT false,
    default_value TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Certificate signatures (authorized signatures)
CREATE TABLE IF NOT EXISTS certificate_signatures (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    
    signatory_name VARCHAR(255) NOT NULL,
    title VARCHAR(255) NOT NULL,
    signature_image_url TEXT NOT NULL,
    
    -- Usage permissions
    can_sign_graduation BOOLEAN DEFAULT false,
    can_sign_merit BOOLEAN DEFAULT true,
    can_sign_participation BOOLEAN DEFAULT true,
    can_sign_achievement BOOLEAN DEFAULT true,
    
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Certificate verifications (QR/verification codes)
CREATE TABLE IF NOT EXISTS certificate_verifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    certificate_id UUID NOT NULL REFERENCES certificates_issued(id) ON DELETE CASCADE,
    
    verification_code VARCHAR(50) NOT NULL UNIQUE,
    qr_code_data TEXT NOT NULL,
    verification_url TEXT NOT NULL,
    
    -- Verification tracking
    verification_count INTEGER DEFAULT 0,
    last_verified_at TIMESTAMP,
    last_verified_ip INET,
    
    expires_at TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bulk certificate jobs (mass generation)
CREATE TABLE IF NOT EXISTS bulk_certificate_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    
    job_name VARCHAR(255) NOT NULL,
    certificate_type_id UUID NOT NULL REFERENCES certificate_types(id),
    template_id UUID NOT NULL REFERENCES certificate_templates(id),
    
    -- Job configuration
    filter_criteria JSONB DEFAULT '{}',
    total_students INTEGER,
    processed_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    
    -- Status
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    error_details JSONB DEFAULT '[]',
    
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Certificate designs (custom designs)
CREATE TABLE IF NOT EXISTS certificate_designs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    
    design_name VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL,
    preview_image_url TEXT,
    
    -- Design assets
    background_images JSONB DEFAULT '[]',
    border_styles JSONB DEFAULT '[]',
    font_combinations JSONB DEFAULT '[]',
    color_schemes JSONB DEFAULT '[]',
    
    is_premium BOOLEAN DEFAULT false,
    usage_count INTEGER DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- MODULE 13: INVOICE GENERATION MODULE
-- =============================================================================

-- Invoice templates (custom templates)
CREATE TABLE IF NOT EXISTS invoice_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    
    template_name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Template design
    template_html TEXT NOT NULL,
    template_css TEXT,
    header_html TEXT,
    footer_html TEXT,
    
    -- Layout settings
    page_size VARCHAR(10) DEFAULT 'A4',
    margin_top INTEGER DEFAULT 20,
    margin_bottom INTEGER DEFAULT 20,
    margin_left INTEGER DEFAULT 15,
    margin_right INTEGER DEFAULT 15,
    
    -- Company branding
    logo_url TEXT,
    company_address TEXT,
    company_phone VARCHAR(20),
    company_email VARCHAR(255),
    company_website VARCHAR(255),
    
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Invoice series (numbering series)
CREATE TABLE IF NOT EXISTS invoice_series (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    
    series_name VARCHAR(100) NOT NULL,
    prefix VARCHAR(10),
    suffix VARCHAR(10),
    current_number INTEGER NOT NULL DEFAULT 1,
    increment_by INTEGER DEFAULT 1,
    
    -- Formatting
    number_format VARCHAR(50) DEFAULT '{prefix}{number:04d}{suffix}',
    reset_annually BOOLEAN DEFAULT true,
    reset_monthly BOOLEAN DEFAULT false,
    
    -- Academic year context
    academic_year_id UUID REFERENCES academic_years(id),
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(school_id, series_name, academic_year_id)
);

-- Invoices (generated invoices)
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    
    invoice_number VARCHAR(50) NOT NULL,
    series_id UUID REFERENCES invoice_series(id),
    template_id UUID REFERENCES invoice_templates(id),
    
    -- Customer details
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES users(id),
    customer_name VARCHAR(255) NOT NULL,
    customer_email VARCHAR(255),
    customer_phone VARCHAR(20),
    billing_address TEXT,
    
    -- Invoice details
    invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE NOT NULL,
    academic_year_id UUID REFERENCES academic_years(id),
    academic_term_id UUID REFERENCES academic_terms(id),
    
    -- Financial details
    subtotal DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    total_tax DECIMAL(12,2) DEFAULT 0.00,
    total_discount DECIMAL(12,2) DEFAULT 0.00,
    total_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    amount_paid DECIMAL(12,2) DEFAULT 0.00,
    balance_due DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    
    -- Status
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'viewed', 'paid', 'partial', 'overdue', 'cancelled')),
    sent_at TIMESTAMP,
    viewed_at TIMESTAMP,
    paid_at TIMESTAMP,
    
    -- PDF generation
    pdf_url TEXT,
    pdf_generated_at TIMESTAMP,
    
    -- Notes
    notes TEXT,
    terms_and_conditions TEXT,
    
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(school_id, invoice_number)
);

-- Invoice items (line items)
CREATE TABLE IF NOT EXISTS invoice_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    
    item_order INTEGER NOT NULL DEFAULT 1,
    
    -- Item details
    description TEXT NOT NULL,
    item_code VARCHAR(50),
    fee_category_id UUID REFERENCES fee_categories(id),
    
    -- Quantity and pricing
    quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL,
    line_total DECIMAL(12,2) NOT NULL,
    
    -- Tax details
    tax_rate DECIMAL(5,2) DEFAULT 0.00,
    tax_amount DECIMAL(10,2) DEFAULT 0.00,
    
    -- Discount details
    discount_type VARCHAR(10) CHECK (discount_type IN ('percentage', 'fixed')),
    discount_value DECIMAL(10,2) DEFAULT 0.00,
    discount_amount DECIMAL(10,2) DEFAULT 0.00,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Invoice taxes (tax calculations)
CREATE TABLE IF NOT EXISTS invoice_taxes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    
    tax_name VARCHAR(100) NOT NULL,
    tax_type VARCHAR(20) NOT NULL CHECK (tax_type IN ('percentage', 'fixed')),
    tax_rate DECIMAL(5,2),
    tax_amount DECIMAL(10,2) NOT NULL,
    
    taxable_amount DECIMAL(12,2) NOT NULL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Invoice discounts (applied discounts)
CREATE TABLE IF NOT EXISTS invoice_discounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    
    discount_name VARCHAR(100) NOT NULL,
    discount_type VARCHAR(20) NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
    discount_value DECIMAL(10,2) NOT NULL,
    discount_amount DECIMAL(10,2) NOT NULL,
    
    applied_to VARCHAR(20) DEFAULT 'subtotal' CHECK (applied_to IN ('subtotal', 'total', 'specific_items')),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Invoice payments (payment tracking)
CREATE TABLE IF NOT EXISTS invoice_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    payment_id UUID REFERENCES payments(id),
    
    payment_date DATE NOT NULL,
    amount_paid DECIMAL(12,2) NOT NULL,
    payment_method VARCHAR(50),
    transaction_reference VARCHAR(100),
    
    notes TEXT,
    
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Recurring invoices (subscription invoices)
CREATE TABLE IF NOT EXISTS recurring_invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    
    template_invoice_id UUID REFERENCES invoices(id),
    series_id UUID REFERENCES invoice_series(id),
    
    -- Customer details
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    customer_name VARCHAR(255) NOT NULL,
    
    -- Recurrence settings
    frequency VARCHAR(20) NOT NULL CHECK (frequency IN ('monthly', 'quarterly', 'termly', 'annually')),
    interval_count INTEGER DEFAULT 1,
    start_date DATE NOT NULL,
    end_date DATE,
    next_generation_date DATE NOT NULL,
    
    -- Invoice details
    total_amount DECIMAL(12,2) NOT NULL,
    auto_send BOOLEAN DEFAULT false,
    auto_generate BOOLEAN DEFAULT true,
    
    -- Status
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),
    invoices_generated INTEGER DEFAULT 0,
    
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Invoice reminders (follow-up settings)
CREATE TABLE IF NOT EXISTS invoice_reminders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    
    reminder_type VARCHAR(20) NOT NULL CHECK (reminder_type IN ('before_due', 'on_due', 'after_due')),
    days_offset INTEGER NOT NULL, -- negative for before due, positive for after due
    
    reminder_method VARCHAR(20) NOT NULL CHECK (reminder_method IN ('email', 'sms', 'both')),
    subject VARCHAR(255),
    message TEXT,
    
    -- Execution
    scheduled_date DATE,
    sent_at TIMESTAMP,
    delivery_status VARCHAR(20) CHECK (delivery_status IN ('pending', 'sent', 'delivered', 'failed')),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Credit notes (refunds/adjustments)
CREATE TABLE IF NOT EXISTS credit_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    
    credit_note_number VARCHAR(50) NOT NULL,
    invoice_id UUID REFERENCES invoices(id),
    student_id UUID NOT NULL REFERENCES students(id),
    
    -- Credit note details
    issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    reason VARCHAR(100) NOT NULL,
    description TEXT,
    
    -- Financial details
    credit_amount DECIMAL(12,2) NOT NULL,
    applied_amount DECIMAL(12,2) DEFAULT 0.00,
    remaining_balance DECIMAL(12,2) NOT NULL,
    
    -- Status
    status VARCHAR(20) DEFAULT 'issued' CHECK (status IN ('draft', 'issued', 'applied', 'expired')),
    
    -- PDF
    pdf_url TEXT,
    
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(school_id, credit_note_number)
);

-- =============================================================================
-- MODULE 14: PERFORMANCE APPRAISAL MODULE  
-- =============================================================================

-- Appraisal cycles (annual cycles)
CREATE TABLE IF NOT EXISTS appraisal_cycles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    
    cycle_name VARCHAR(255) NOT NULL,
    description TEXT,
    academic_year_id UUID REFERENCES academic_years(id),
    
    -- Cycle timeline
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    self_review_deadline DATE,
    manager_review_deadline DATE,
    final_review_deadline DATE,
    
    -- Status
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'cancelled')),
    is_active BOOLEAN DEFAULT false,
    
    -- Notifications
    send_reminders BOOLEAN DEFAULT true,
    reminder_frequency_days INTEGER DEFAULT 7,
    
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(school_id, cycle_name, academic_year_id)
);

-- Appraisal templates (role-based forms)
CREATE TABLE IF NOT EXISTS appraisal_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    
    template_name VARCHAR(255) NOT NULL,
    description TEXT,
    applicable_roles JSONB DEFAULT '[]', -- array of role names
    
    -- Template configuration
    includes_self_review BOOLEAN DEFAULT true,
    includes_manager_review BOOLEAN DEFAULT true,
    includes_peer_feedback BOOLEAN DEFAULT false,
    includes_360_feedback BOOLEAN DEFAULT false,
    
    -- Scoring configuration
    scoring_method VARCHAR(20) DEFAULT 'numeric' CHECK (scoring_method IN ('numeric', 'rating', 'descriptive')),
    max_score DECIMAL(5,2) DEFAULT 5.0,
    passing_score DECIMAL(5,2) DEFAULT 3.0,
    
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Appraisal categories (evaluation areas)
CREATE TABLE IF NOT EXISTS appraisal_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_id UUID NOT NULL REFERENCES appraisal_templates(id) ON DELETE CASCADE,
    
    category_name VARCHAR(255) NOT NULL,
    description TEXT,
    weight_percentage DECIMAL(5,2) DEFAULT 0.0,
    display_order INTEGER DEFAULT 1,
    
    is_mandatory BOOLEAN DEFAULT true,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Appraisal questions (specific metrics)
CREATE TABLE IF NOT EXISTS appraisal_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID NOT NULL REFERENCES appraisal_categories(id) ON DELETE CASCADE,
    
    question_text TEXT NOT NULL,
    question_type VARCHAR(20) NOT NULL CHECK (question_type IN ('rating', 'scale', 'text', 'multiple_choice', 'yes_no')),
    
    -- Configuration
    is_required BOOLEAN DEFAULT true,
    max_score DECIMAL(5,2) DEFAULT 5.0,
    weight_percentage DECIMAL(5,2) DEFAULT 0.0,
    display_order INTEGER DEFAULT 1,
    
    -- For multiple choice questions
    options JSONB DEFAULT '[]',
    
    -- For rating questions
    rating_labels JSONB DEFAULT '{}', -- {"1": "Poor", "2": "Fair", ...}
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Appraisals (individual appraisals)
CREATE TABLE IF NOT EXISTS appraisals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    
    cycle_id UUID NOT NULL REFERENCES appraisal_cycles(id) ON DELETE CASCADE,
    template_id UUID NOT NULL REFERENCES appraisal_templates(id),
    employee_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    manager_id UUID REFERENCES staff(id),
    
    -- Appraisal details
    appraisal_period_start DATE,
    appraisal_period_end DATE,
    
    -- Status tracking
    status VARCHAR(20) DEFAULT 'not_started' CHECK (status IN ('not_started', 'self_review', 'manager_review', 'completed', 'cancelled')),
    
    -- Review completion tracking
    self_review_completed BOOLEAN DEFAULT false,
    self_review_completed_at TIMESTAMP,
    manager_review_completed BOOLEAN DEFAULT false,
    manager_review_completed_at TIMESTAMP,
    
    -- Final scores
    self_review_score DECIMAL(5,2),
    manager_review_score DECIMAL(5,2),
    final_score DECIMAL(5,2),
    overall_rating VARCHAR(20),
    
    -- Comments
    employee_comments TEXT,
    manager_comments TEXT,
    hr_comments TEXT,
    
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(cycle_id, employee_id)
);

-- Appraisal responses (answers/ratings)
CREATE TABLE IF NOT EXISTS appraisal_responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    appraisal_id UUID NOT NULL REFERENCES appraisals(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES appraisal_questions(id),
    
    -- Response details
    response_type VARCHAR(20) NOT NULL CHECK (response_type IN ('self', 'manager', 'peer', '360')),
    respondent_id UUID REFERENCES users(id),
    
    -- Answer data
    numeric_score DECIMAL(5,2),
    text_response TEXT,
    selected_option VARCHAR(255),
    
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(appraisal_id, question_id, response_type, respondent_id)
);

-- Appraisal goals (SMART goals)
CREATE TABLE IF NOT EXISTS appraisal_goals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    appraisal_id UUID NOT NULL REFERENCES appraisals(id) ON DELETE CASCADE,
    
    goal_title VARCHAR(255) NOT NULL,
    goal_description TEXT,
    goal_type VARCHAR(30) DEFAULT 'performance' CHECK (goal_type IN ('performance', 'development', 'behavioral', 'project')),
    
    -- SMART criteria
    is_specific BOOLEAN DEFAULT false,
    is_measurable BOOLEAN DEFAULT false,
    is_achievable BOOLEAN DEFAULT false,
    is_relevant BOOLEAN DEFAULT false,
    is_timebound BOOLEAN DEFAULT false,
    
    -- Timeline
    target_date DATE,
    review_frequency VARCHAR(20) DEFAULT 'quarterly' CHECK (review_frequency IN ('weekly', 'monthly', 'quarterly', 'annually')),
    
    -- Progress tracking
    progress_percentage DECIMAL(5,2) DEFAULT 0.0,
    status VARCHAR(20) DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed', 'cancelled', 'deferred')),
    
    -- Evaluation
    success_criteria TEXT,
    actual_outcome TEXT,
    lessons_learned TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Appraisal feedback (360-degree feedback)
CREATE TABLE IF NOT EXISTS appraisal_feedback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    appraisal_id UUID NOT NULL REFERENCES appraisals(id) ON DELETE CASCADE,
    
    feedback_provider_id UUID NOT NULL REFERENCES users(id),
    feedback_type VARCHAR(20) NOT NULL CHECK (feedback_type IN ('peer', 'subordinate', 'customer', 'external')),
    
    -- Feedback content
    strengths TEXT,
    areas_for_improvement TEXT,
    specific_examples TEXT,
    recommendations TEXT,
    
    -- Ratings
    communication_rating DECIMAL(3,1),
    teamwork_rating DECIMAL(3,1),
    leadership_rating DECIMAL(3,1),
    technical_skills_rating DECIMAL(3,1),
    overall_rating DECIMAL(3,1),
    
    -- Status
    is_anonymous BOOLEAN DEFAULT true,
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Appraisal reviews (manager reviews)
CREATE TABLE IF NOT EXISTS appraisal_reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    appraisal_id UUID NOT NULL REFERENCES appraisals(id) ON DELETE CASCADE,
    
    reviewer_id UUID NOT NULL REFERENCES users(id),
    review_type VARCHAR(20) NOT NULL CHECK (review_type IN ('manager', 'hr', 'senior_manager', 'director')),
    
    -- Review content
    performance_summary TEXT,
    key_achievements TEXT,
    areas_of_excellence TEXT,
    development_areas TEXT,
    
    -- Recommendations
    promotion_recommendation BOOLEAN DEFAULT false,
    salary_increase_recommendation BOOLEAN DEFAULT false,
    training_recommendations TEXT,
    role_change_recommendation TEXT,
    
    -- Final decisions
    overall_performance_rating VARCHAR(20),
    meets_expectations BOOLEAN,
    recommended_actions JSONB DEFAULT '[]',
    
    reviewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Development plans (improvement plans)
CREATE TABLE IF NOT EXISTS development_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    appraisal_id UUID NOT NULL REFERENCES appraisals(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES staff(id),
    
    plan_title VARCHAR(255) NOT NULL,
    development_areas JSONB DEFAULT '[]',
    
    -- Plan details
    objectives TEXT,
    action_items JSONB DEFAULT '[]',
    required_resources TEXT,
    support_needed TEXT,
    
    -- Timeline
    start_date DATE DEFAULT CURRENT_DATE,
    target_completion_date DATE,
    review_schedule VARCHAR(50),
    
    -- Progress tracking
    progress_notes TEXT,
    completed_actions JSONB DEFAULT '[]',
    
    -- Status
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('draft', 'active', 'completed', 'cancelled')),
    
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Appraisal history (historical data)
CREATE TABLE IF NOT EXISTS appraisal_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES staff(id),
    
    appraisal_year INTEGER NOT NULL,
    cycle_name VARCHAR(255),
    final_score DECIMAL(5,2),
    overall_rating VARCHAR(20),
    
    -- Key metrics
    goals_achieved INTEGER DEFAULT 0,
    goals_total INTEGER DEFAULT 0,
    goals_achievement_rate DECIMAL(5,2) DEFAULT 0.0,
    
    -- Growth tracking
    score_improvement DECIMAL(5,2) DEFAULT 0.0,
    previous_year_score DECIMAL(5,2),
    
    archived_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- MODULE 15: ACADEMIC TRIPS MODULE
-- =============================================================================

-- Trip types (educational, sports, etc.) - MOVED UP to resolve circular reference
CREATE TABLE IF NOT EXISTS trip_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    
    type_name VARCHAR(100) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL CHECK (category IN ('educational', 'sports', 'cultural', 'adventure', 'service', 'competition')),
    
    -- Default settings
    default_permission_required BOOLEAN DEFAULT true,
    default_medical_info_required BOOLEAN DEFAULT false,
    default_insurance_required BOOLEAN DEFAULT true,
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Trips (trip details)
CREATE TABLE IF NOT EXISTS trips (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    
    trip_name VARCHAR(255) NOT NULL,
    description TEXT,
    trip_type_id UUID REFERENCES trip_types(id),
    
    -- Trip details
    destination VARCHAR(255) NOT NULL,
    departure_date DATE NOT NULL,
    return_date DATE NOT NULL,
    departure_time TIME,
    return_time TIME,
    
    -- Capacity and participants
    max_participants INTEGER,
    current_participants INTEGER DEFAULT 0,
    teacher_supervisors_required INTEGER DEFAULT 2,
    parent_volunteers_allowed BOOLEAN DEFAULT true,
    
    -- Costs
    cost_per_student DECIMAL(10,2) DEFAULT 0.00,
    deposit_required DECIMAL(10,2) DEFAULT 0.00,
    payment_deadline DATE,
    
    -- Safety and requirements
    minimum_age INTEGER,
    maximum_age INTEGER,
    requires_swimming_ability BOOLEAN DEFAULT false,
    requires_medical_clearance BOOLEAN DEFAULT false,
    
    -- Status
    status VARCHAR(20) DEFAULT 'planning' CHECK (status IN ('planning', 'open_registration', 'full', 'confirmed', 'in_progress', 'completed', 'cancelled')),
    
    -- Documentation
    itinerary_document_url TEXT,
    risk_assessment_url TEXT,
    
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- (trip_types table moved up above trips to resolve circular reference)

-- Trip participants (students/staff)
CREATE TABLE IF NOT EXISTS trip_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    
    -- Participant details
    participant_id UUID NOT NULL REFERENCES users(id),
    participant_type VARCHAR(20) NOT NULL CHECK (participant_type IN ('student', 'teacher', 'parent_volunteer', 'external_supervisor')),
    
    -- Registration details
    registration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    registration_status VARCHAR(20) DEFAULT 'registered' CHECK (registration_status IN ('registered', 'confirmed', 'waitlist', 'cancelled')),
    
    -- Payments
    amount_paid DECIMAL(10,2) DEFAULT 0.00,
    deposit_paid BOOLEAN DEFAULT false,
    full_payment_received BOOLEAN DEFAULT false,
    
    -- Special requirements
    dietary_requirements TEXT,
    medical_conditions TEXT,
    emergency_medication TEXT,
    special_needs TEXT,
    
    -- Contact information
    emergency_contact_name VARCHAR(255),
    emergency_contact_phone VARCHAR(20),
    emergency_contact_relationship VARCHAR(50),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(trip_id, participant_id)
);

-- Trip permissions (parent consent)
CREATE TABLE IF NOT EXISTS trip_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    parent_id UUID NOT NULL REFERENCES users(id),
    
    -- Permission details
    permission_granted BOOLEAN DEFAULT false,
    permission_date TIMESTAMP,
    
    -- Digital signature
    parent_signature_data TEXT, -- base64 signature image
    parent_name VARCHAR(255),
    parent_relationship VARCHAR(50),
    
    -- Consent details
    medical_treatment_consent BOOLEAN DEFAULT false,
    photography_consent BOOLEAN DEFAULT false,
    emergency_contact_consent BOOLEAN DEFAULT false,
    
    -- Additional information
    special_instructions TEXT,
    medical_information TEXT,
    
    -- Administrative
    permission_form_url TEXT,
    submitted_via VARCHAR(20) DEFAULT 'online' CHECK (submitted_via IN ('online', 'paper', 'email')),
    ip_address INET,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(trip_id, student_id)
);

-- Trip itineraries (detailed schedule)
CREATE TABLE IF NOT EXISTS trip_itineraries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    
    day_number INTEGER NOT NULL,
    activity_date DATE NOT NULL,
    
    -- Activity details
    start_time TIME,
    end_time TIME,
    activity_title VARCHAR(255) NOT NULL,
    activity_description TEXT,
    location VARCHAR(255),
    
    -- Activity type
    activity_type VARCHAR(30) CHECK (activity_type IN ('transport', 'meal', 'educational', 'recreational', 'accommodation', 'safety_briefing', 'free_time')),
    
    -- Requirements
    supervisor_required BOOLEAN DEFAULT true,
    headcount_required BOOLEAN DEFAULT true,
    special_equipment TEXT,
    
    -- Safety
    risk_level VARCHAR(10) DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high')),
    safety_notes TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(trip_id, day_number, start_time)
);

-- Trip expenses (cost breakdown)
CREATE TABLE IF NOT EXISTS trip_expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    
    expense_category VARCHAR(50) NOT NULL CHECK (expense_category IN ('transport', 'accommodation', 'meals', 'activities', 'insurance', 'equipment', 'miscellaneous')),
    description TEXT NOT NULL,
    
    -- Cost details
    estimated_cost DECIMAL(10,2),
    actual_cost DECIMAL(10,2),
    cost_per_participant DECIMAL(10,2),
    
    -- Vendor details
    vendor_name VARCHAR(255),
    vendor_contact VARCHAR(100),
    invoice_reference VARCHAR(100),
    
    -- Payment status
    payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'refunded')),
    payment_date DATE,
    
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Trip vendors (transport, accommodation)
CREATE TABLE IF NOT EXISTS trip_vendors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    
    vendor_name VARCHAR(255) NOT NULL,
    vendor_type VARCHAR(30) NOT NULL CHECK (vendor_type IN ('transport', 'accommodation', 'activity_provider', 'catering', 'insurance', 'equipment_rental')),
    
    -- Contact details
    contact_person VARCHAR(255),
    phone VARCHAR(20),
    email VARCHAR(255),
    address TEXT,
    website VARCHAR(255),
    
    -- Service details
    services_offered JSONB DEFAULT '[]',
    coverage_areas JSONB DEFAULT '[]',
    
    -- Ratings and reviews
    rating DECIMAL(3,2),
    total_reviews INTEGER DEFAULT 0,
    
    -- Administrative
    license_number VARCHAR(100),
    insurance_valid_until DATE,
    certifications JSONB DEFAULT '[]',
    
    is_preferred BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Trip safety measures (protocols)
CREATE TABLE IF NOT EXISTS trip_safety_measures (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    
    safety_category VARCHAR(30) NOT NULL CHECK (safety_category IN ('medical', 'transport', 'accommodation', 'activity', 'emergency', 'communication')),
    measure_title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    
    -- Implementation details
    responsible_person VARCHAR(255),
    implementation_notes TEXT,
    required_equipment JSONB DEFAULT '[]',
    
    -- Verification
    is_implemented BOOLEAN DEFAULT false,
    implementation_date DATE,
    verified_by UUID REFERENCES users(id),
    verification_date DATE,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Trip medical info (special needs)
CREATE TABLE IF NOT EXISTS trip_medical_info (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    participant_id UUID NOT NULL REFERENCES users(id),
    
    -- Medical conditions
    medical_conditions TEXT,
    allergies TEXT,
    medications TEXT,
    
    -- Emergency information
    medical_emergency_contacts JSONB DEFAULT '[]',
    doctor_name VARCHAR(255),
    doctor_phone VARCHAR(20),
    insurance_provider VARCHAR(255),
    insurance_policy_number VARCHAR(100),
    
    -- Special requirements
    mobility_requirements TEXT,
    dietary_restrictions TEXT,
    other_requirements TEXT,
    
    -- Medical clearance
    medical_clearance_required BOOLEAN DEFAULT false,
    medical_clearance_received BOOLEAN DEFAULT false,
    medical_clearance_date DATE,
    medical_clearance_document_url TEXT,
    
    last_updated_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(trip_id, participant_id)
);

-- Trip feedback (post-trip reviews)
CREATE TABLE IF NOT EXISTS trip_feedback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    
    feedback_provider_id UUID NOT NULL REFERENCES users(id),
    feedback_type VARCHAR(20) NOT NULL CHECK (feedback_type IN ('student', 'parent', 'teacher', 'supervisor')),
    
    -- Ratings (1-5 scale)
    overall_rating DECIMAL(3,2),
    organization_rating DECIMAL(3,2),
    safety_rating DECIMAL(3,2),
    educational_value_rating DECIMAL(3,2),
    cost_value_rating DECIMAL(3,2),
    
    -- Text feedback
    highlights TEXT,
    areas_for_improvement TEXT,
    would_recommend BOOLEAN,
    additional_comments TEXT,
    
    -- Suggestions
    suggested_improvements JSONB DEFAULT '[]',
    future_trip_suggestions TEXT,
    
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(trip_id, feedback_provider_id)
);

-- =============================================================================
-- INDEXES FOR PERFORMANCE
-- =============================================================================

-- Timetable module indexes
CREATE INDEX idx_timetable_entries_school_version ON timetable_entries(school_id, version_id);
CREATE INDEX idx_timetable_entries_class_period ON timetable_entries(class_id, period_id);
CREATE INDEX idx_timetable_entries_teacher_day ON timetable_entries(teacher_id, day_of_week);
CREATE INDEX idx_teacher_availability_teacher_day ON teacher_availability(teacher_id, day_of_week);

-- Certificate module indexes
CREATE INDEX idx_certificates_issued_student ON certificates_issued(student_id, issue_date);
CREATE INDEX idx_certificates_issued_school_type ON certificates_issued(school_id, certificate_type_id);
CREATE INDEX idx_certificate_verifications_code ON certificate_verifications(verification_code);

-- Invoice module indexes
CREATE INDEX idx_invoices_student_date ON invoices(student_id, invoice_date);
CREATE INDEX idx_invoices_school_status ON invoices(school_id, status);
CREATE INDEX idx_invoices_due_date ON invoices(due_date) WHERE status NOT IN ('paid', 'cancelled');
CREATE INDEX idx_invoice_items_invoice ON invoice_items(invoice_id, item_order);

-- Appraisal module indexes
CREATE INDEX idx_appraisals_cycle_employee ON appraisals(cycle_id, employee_id);
CREATE INDEX idx_appraisals_school_status ON appraisals(school_id, status);
CREATE INDEX idx_appraisal_responses_appraisal_type ON appraisal_responses(appraisal_id, response_type);

-- Trip module indexes
CREATE INDEX idx_trips_school_dates ON trips(school_id, departure_date, return_date);
CREATE INDEX idx_trip_participants_trip_type ON trip_participants(trip_id, participant_type);
CREATE INDEX idx_trip_permissions_student ON trip_permissions(student_id, permission_granted);

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE timetable_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE timetable_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE timetable_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE subject_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE timetable_conflicts ENABLE ROW LEVEL SECURITY;
ALTER TABLE timetable_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE timetable_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_optimization_logs ENABLE ROW LEVEL SECURITY;

ALTER TABLE certificate_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificate_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificates_issued ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificate_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificate_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificate_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE bulk_certificate_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificate_designs ENABLE ROW LEVEL SECURITY;

ALTER TABLE invoice_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_taxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_discounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_notes ENABLE ROW LEVEL SECURITY;

ALTER TABLE appraisal_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE appraisal_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE appraisal_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE appraisal_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE appraisals ENABLE ROW LEVEL SECURITY;
ALTER TABLE appraisal_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE appraisal_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE appraisal_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE appraisal_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE development_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE appraisal_history ENABLE ROW LEVEL SECURITY;

ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_itineraries ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_safety_measures ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_medical_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_feedback ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for school-based isolation
-- (Policies will be created separately for each table following the same pattern)

-- Example policy for one table (similar policies needed for all tables)
CREATE POLICY school_isolation_timetable_configurations ON timetable_configurations
    FOR ALL
    TO authenticated_users
    USING (school_id = current_setting('app.current_school_id')::UUID);