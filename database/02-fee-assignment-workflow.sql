-- ====================================
-- FEE ASSIGNMENT WORKFLOW SYSTEM
-- ====================================
-- This module handles comprehensive fee assignment with curriculum support,
-- approval workflows, and multi-tenancy for different school types

-- Fee Assignment System
CREATE TABLE fee_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    assignment_name VARCHAR(255) NOT NULL,
    assignment_code VARCHAR(50), -- FA-2024-001
    assignment_type VARCHAR(50) CHECK (assignment_type IN ('class', 'individual', 'bulk', 'grade_level', 'curriculum_specific')),
    
    -- Target Selection
    target_class_id UUID REFERENCES classes(id),
    target_grade_level VARCHAR(20), -- Grade 1, Grade 7, Form 1, etc.
    target_students UUID[], -- Array of student IDs for individual assignments
    target_criteria JSONB, -- Complex targeting: {"curriculum": "CBC", "grade": "7", "stream": "A"}
    
    -- Fee Structure Reference
    fee_structure_id UUID REFERENCES fee_structures(id),
    custom_fees JSONB, -- Override fees: {"tuition": 25000, "transport": 5000, "meals": 8000}
    
    -- Curriculum Support (Kenya-specific)
    curriculum_type VARCHAR(20) CHECK (curriculum_type IN ('CBC', 'IGCSE', '8-4-4', 'CAMBRIDGE', 'IB', 'UNIVERSAL')),
    academic_year VARCHAR(20) NOT NULL, -- 2024, 2024/2025
    academic_term VARCHAR(20), -- Term 1, Term 2, Term 3, Semester 1, etc.
    
    -- Financial Details
    base_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    discount_amount DECIMAL(15,2) DEFAULT 0,
    discount_percentage DECIMAL(5,2) DEFAULT 0, -- For percentage-based discounts
    penalty_amount DECIMAL(15,2) DEFAULT 0,
    tax_amount DECIMAL(15,2) DEFAULT 0,
    total_amount DECIMAL(15,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'KES',
    
    -- Payment Schedule
    payment_schedule JSONB, -- [{"due_date": "2024-02-15", "amount": 10000, "description": "First Installment"}]
    is_installment_based BOOLEAN DEFAULT false,
    installment_count INTEGER DEFAULT 1,
    
    -- Dates
    effective_date DATE NOT NULL,
    due_date DATE NOT NULL,
    grace_period_days INTEGER DEFAULT 0,
    
    -- Assignment Rules
    auto_assign_new_students BOOLEAN DEFAULT false, -- Auto-assign to new students matching criteria
    apply_to_existing_balances BOOLEAN DEFAULT false,
    override_existing_assignments BOOLEAN DEFAULT false,
    
    -- Approval Workflow
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected', 'active', 'completed', 'cancelled')),
    submitted_by UUID REFERENCES users(id),
    submitted_at TIMESTAMP,
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP,
    rejection_reason TEXT,
    rejection_details JSONB,
    
    -- Execution Status
    execution_status VARCHAR(20) DEFAULT 'pending' CHECK (execution_status IN ('pending', 'processing', 'completed', 'failed', 'partial')),
    execution_started_at TIMESTAMP,
    execution_completed_at TIMESTAMP,
    students_processed INTEGER DEFAULT 0,
    students_successful INTEGER DEFAULT 0,
    students_failed INTEGER DEFAULT 0,
    execution_errors JSONB, -- Array of errors during execution
    
    -- Notifications
    notify_parents BOOLEAN DEFAULT true,
    notify_students BOOLEAN DEFAULT true,
    notification_method VARCHAR(20) DEFAULT 'sms' CHECK (notification_method IN ('sms', 'email', 'both', 'none')),
    custom_notification_message TEXT,
    
    -- Audit Trail
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Indexes for performance
    CONSTRAINT fee_assignments_amount_check CHECK (total_amount >= 0),
    CONSTRAINT fee_assignments_dates_check CHECK (due_date >= effective_date)
);

-- Fee Assignment Items (Detailed Breakdown)
CREATE TABLE fee_assignment_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fee_assignment_id UUID NOT NULL REFERENCES fee_assignments(id) ON DELETE CASCADE,
    
    -- Fee Category
    fee_category VARCHAR(100) NOT NULL, -- tuition, transport, meals, examination, library, etc.
    fee_subcategory VARCHAR(100), -- Optional subcategory
    category_code VARCHAR(20), -- TUI, TRN, MEL, EXM, etc.
    
    -- Amount Details
    amount DECIMAL(12,2) NOT NULL,
    original_amount DECIMAL(12,2), -- Before any discounts
    discount_amount DECIMAL(12,2) DEFAULT 0,
    tax_rate DECIMAL(5,4) DEFAULT 0, -- 16% VAT = 0.16
    tax_amount DECIMAL(12,2) DEFAULT 0,
    final_amount DECIMAL(12,2) GENERATED ALWAYS AS (amount - discount_amount + tax_amount) STORED,
    
    -- Item Properties
    is_mandatory BOOLEAN DEFAULT true,
    is_refundable BOOLEAN DEFAULT false,
    is_prorated BOOLEAN DEFAULT false, -- Can be prorated based on admission date
    proration_basis VARCHAR(20), -- monthly, daily, term_based
    
    -- Description and Notes
    description TEXT,
    internal_notes TEXT, -- For staff only
    
    -- Curriculum Specific
    applies_to_curriculum VARCHAR(20)[], -- ["CBC", "IGCSE"] - if item applies only to specific curricula
    grade_level_specific VARCHAR(20)[], -- If item is grade-specific
    
    created_at TIMESTAMP DEFAULT NOW()
);

-- Individual Student Fee Assignments (Generated from fee_assignments)
CREATE TABLE student_fee_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fee_assignment_id UUID NOT NULL REFERENCES fee_assignments(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    
    -- Student-Specific Details
    student_class_id UUID REFERENCES classes(id),
    student_grade_level VARCHAR(20),
    admission_date DATE, -- For proration calculations
    
    -- Assignment Amounts (can be different from base assignment due to scholarships, etc.)
    base_amount DECIMAL(15,2) NOT NULL,
    discount_amount DECIMAL(15,2) DEFAULT 0,
    scholarship_amount DECIMAL(15,2) DEFAULT 0,
    penalty_amount DECIMAL(15,2) DEFAULT 0,
    total_amount DECIMAL(15,2) NOT NULL,
    
    -- Payment Status
    payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'partial', 'completed', 'overdue', 'cancelled')),
    amount_paid DECIMAL(15,2) DEFAULT 0,
    balance_due DECIMAL(15,2) GENERATED ALWAYS AS (total_amount - amount_paid) STORED,
    
    -- Dates
    assigned_date DATE DEFAULT CURRENT_DATE,
    due_date DATE NOT NULL,
    last_payment_date DATE,
    overdue_since DATE,
    
    -- Payment Schedule for this student
    payment_schedule JSONB, -- Student-specific schedule (can differ from base assignment)
    next_payment_due_date DATE,
    next_payment_amount DECIMAL(12,2),
    
    -- Status and Processing
    assignment_status VARCHAR(20) DEFAULT 'active' CHECK (assignment_status IN ('active', 'completed', 'cancelled', 'on_hold')),
    processing_status VARCHAR(20) DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processed', 'failed')),
    processing_error TEXT,
    
    -- Notifications
    parent_notified BOOLEAN DEFAULT false,
    student_notified BOOLEAN DEFAULT false,
    notification_sent_at TIMESTAMP,
    notification_method VARCHAR(20),
    
    -- Special Considerations
    has_scholarship BOOLEAN DEFAULT false,
    scholarship_details JSONB,
    has_payment_plan BOOLEAN DEFAULT false,
    payment_plan_id UUID, -- Reference to custom payment plan
    
    -- Audit
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(fee_assignment_id, student_id)
);

-- Fee Assignment History (Audit Trail)
CREATE TABLE fee_assignment_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fee_assignment_id UUID NOT NULL REFERENCES fee_assignments(id) ON DELETE CASCADE,
    
    -- Action Details
    action VARCHAR(50) NOT NULL, -- created, submitted, approved, rejected, modified, executed, cancelled
    action_category VARCHAR(30), -- workflow, execution, notification, modification
    performed_by UUID NOT NULL REFERENCES users(id),
    performed_at TIMESTAMP DEFAULT NOW(),
    
    -- Change Details
    previous_data JSONB, -- Previous state
    new_data JSONB, -- New state
    changes_summary TEXT, -- Human-readable summary of changes
    
    -- Context
    ip_address INET,
    user_agent TEXT,
    session_id VARCHAR(255),
    comments TEXT, -- User-provided comments
    
    -- Approval Workflow
    approval_level INTEGER, -- For multi-level approvals
    approval_stage VARCHAR(50), -- initial_review, final_approval, etc.
    
    created_at TIMESTAMP DEFAULT NOW()
);

-- Fee Assignment Templates (Reusable Templates)
CREATE TABLE fee_assignment_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    
    -- Template Details
    template_name VARCHAR(255) NOT NULL,
    template_description TEXT,
    template_category VARCHAR(50), -- admission, annual, term, examination, etc.
    
    -- Template Configuration
    curriculum_type VARCHAR(20) CHECK (curriculum_type IN ('CBC', 'IGCSE', '8-4-4', 'CAMBRIDGE', 'IB', 'UNIVERSAL')),
    grade_levels VARCHAR(20)[], -- Applicable grade levels
    target_type VARCHAR(50) DEFAULT 'class', -- class, grade_level, individual, all
    
    -- Fee Structure
    fee_items JSONB NOT NULL, -- Template fee items structure
    default_amounts JSONB, -- Default amounts for each category
    
    -- Template Settings
    is_active BOOLEAN DEFAULT true,
    is_default BOOLEAN DEFAULT false, -- Default template for this category
    auto_apply BOOLEAN DEFAULT false, -- Auto-apply to new students
    
    -- Usage Tracking
    usage_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMP,
    
    -- Audit
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Fee Assignment Approvals (Multi-level approval support)
CREATE TABLE fee_assignment_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fee_assignment_id UUID NOT NULL REFERENCES fee_assignments(id) ON DELETE CASCADE,
    
    -- Approval Details
    approval_level INTEGER NOT NULL DEFAULT 1, -- 1, 2, 3 for multi-level
    approver_role VARCHAR(50) NOT NULL, -- finance_manager, principal, director
    required_approver_id UUID REFERENCES users(id), -- Specific approver if required
    
    -- Status
    approval_status VARCHAR(20) DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected', 'delegated', 'skipped')),
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP,
    rejection_reason TEXT,
    approval_comments TEXT,
    
    -- Delegation
    delegated_to UUID REFERENCES users(id),
    delegated_at TIMESTAMP,
    delegation_reason TEXT,
    
    -- Conditions
    approval_conditions JSONB, -- Conditions that must be met for approval
    conditions_met BOOLEAN DEFAULT false,
    
    created_at TIMESTAMP DEFAULT NOW()
);

-- ====================================
-- INDEXES FOR PERFORMANCE
-- ====================================

-- Primary indexes for fee_assignments
CREATE INDEX idx_fee_assignments_school ON fee_assignments(school_id);
CREATE INDEX idx_fee_assignments_status ON fee_assignments(status);
CREATE INDEX idx_fee_assignments_execution_status ON fee_assignments(execution_status);
CREATE INDEX idx_fee_assignments_curriculum ON fee_assignments(curriculum_type);
CREATE INDEX idx_fee_assignments_academic_year ON fee_assignments(academic_year);
CREATE INDEX idx_fee_assignments_due_date ON fee_assignments(due_date);
CREATE INDEX idx_fee_assignments_created_by ON fee_assignments(created_by);
CREATE INDEX idx_fee_assignments_approved_by ON fee_assignments(approved_by);

-- Composite indexes
CREATE INDEX idx_fee_assignments_school_status ON fee_assignments(school_id, status);
CREATE INDEX idx_fee_assignments_school_curriculum ON fee_assignments(school_id, curriculum_type);
CREATE INDEX idx_fee_assignments_year_term ON fee_assignments(academic_year, academic_term);

-- Student fee assignments indexes
CREATE INDEX idx_student_fee_assignments_student ON student_fee_assignments(student_id);
CREATE INDEX idx_student_fee_assignments_school ON student_fee_assignments(school_id);
CREATE INDEX idx_student_fee_assignments_payment_status ON student_fee_assignments(payment_status);
CREATE INDEX idx_student_fee_assignments_due_date ON student_fee_assignments(due_date);
CREATE INDEX idx_student_fee_assignments_overdue ON student_fee_assignments(overdue_since) WHERE overdue_since IS NOT NULL;
CREATE INDEX idx_student_fee_assignments_balance ON student_fee_assignments(balance_due) WHERE balance_due > 0;

-- Composite indexes for student assignments
CREATE INDEX idx_student_fee_assignments_school_status ON student_fee_assignments(school_id, payment_status);
CREATE INDEX idx_student_fee_assignments_student_status ON student_fee_assignments(student_id, assignment_status);

-- History and audit indexes
CREATE INDEX idx_fee_assignment_history_assignment ON fee_assignment_history(fee_assignment_id);
CREATE INDEX idx_fee_assignment_history_performed_by ON fee_assignment_history(performed_by);
CREATE INDEX idx_fee_assignment_history_performed_at ON fee_assignment_history(performed_at DESC);
CREATE INDEX idx_fee_assignment_history_action ON fee_assignment_history(action);

-- Template indexes
CREATE INDEX idx_fee_assignment_templates_school ON fee_assignment_templates(school_id);
CREATE INDEX idx_fee_assignment_templates_curriculum ON fee_assignment_templates(curriculum_type);
CREATE INDEX idx_fee_assignment_templates_active ON fee_assignment_templates(is_active) WHERE is_active = true;

-- Approval indexes
CREATE INDEX idx_fee_assignment_approvals_assignment ON fee_assignment_approvals(fee_assignment_id);
CREATE INDEX idx_fee_assignment_approvals_status ON fee_assignment_approvals(approval_status);
CREATE INDEX idx_fee_assignment_approvals_approver ON fee_assignment_approvals(approved_by);

-- ====================================
-- ROW LEVEL SECURITY POLICIES
-- ====================================

-- Enable RLS on all tables
ALTER TABLE fee_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_assignment_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_fee_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_assignment_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_assignment_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_assignment_approvals ENABLE ROW LEVEL SECURITY;

-- Fee assignments policies
CREATE POLICY fee_assignments_school_isolation ON fee_assignments
    FOR ALL USING (
        school_id = current_setting('app.current_school_id')::UUID OR
        current_setting('app.current_user_id')::UUID IN (
            SELECT id FROM users WHERE role IN ('super_admin', 'edufam_admin')
        ) OR
        current_setting('app.current_user_id')::UUID IN (
            SELECT director_id FROM director_school_access 
            WHERE school_id = fee_assignments.school_id AND is_active = true
        )
    );

-- Fee assignment items policies  
CREATE POLICY fee_assignment_items_school_isolation ON fee_assignment_items
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM fee_assignments fa 
            WHERE fa.id = fee_assignment_items.fee_assignment_id 
            AND (
                fa.school_id = current_setting('app.current_school_id')::UUID OR
                current_setting('app.current_user_id')::UUID IN (
                    SELECT id FROM users WHERE role IN ('super_admin', 'edufam_admin')
                ) OR
                current_setting('app.current_user_id')::UUID IN (
                    SELECT director_id FROM director_school_access 
                    WHERE school_id = fa.school_id AND is_active = true
                )
            )
        )
    );

-- Student fee assignments policies
CREATE POLICY student_fee_assignments_school_isolation ON student_fee_assignments
    FOR ALL USING (
        school_id = current_setting('app.current_school_id')::UUID OR
        current_setting('app.current_user_id')::UUID IN (
            SELECT id FROM users WHERE role IN ('super_admin', 'edufam_admin')
        ) OR
        current_setting('app.current_user_id')::UUID IN (
            SELECT director_id FROM director_school_access 
            WHERE school_id = student_fee_assignments.school_id AND is_active = true
        )
    );

-- History policies
CREATE POLICY fee_assignment_history_school_isolation ON fee_assignment_history
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM fee_assignments fa 
            WHERE fa.id = fee_assignment_history.fee_assignment_id 
            AND (
                fa.school_id = current_setting('app.current_school_id')::UUID OR
                current_setting('app.current_user_id')::UUID IN (
                    SELECT id FROM users WHERE role IN ('super_admin', 'edufam_admin')
                ) OR
                current_setting('app.current_user_id')::UUID IN (
                    SELECT director_id FROM director_school_access 
                    WHERE school_id = fa.school_id AND is_active = true
                )
            )
        )
    );

-- Templates policies
CREATE POLICY fee_assignment_templates_school_isolation ON fee_assignment_templates
    FOR ALL USING (
        school_id = current_setting('app.current_school_id')::UUID OR
        current_setting('app.current_user_id')::UUID IN (
            SELECT id FROM users WHERE role IN ('super_admin', 'edufam_admin')
        ) OR
        current_setting('app.current_user_id')::UUID IN (
            SELECT director_id FROM director_school_access 
            WHERE school_id = fee_assignment_templates.school_id AND is_active = true
        )
    );

-- Approvals policies
CREATE POLICY fee_assignment_approvals_school_isolation ON fee_assignment_approvals
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM fee_assignments fa 
            WHERE fa.id = fee_assignment_approvals.fee_assignment_id 
            AND (
                fa.school_id = current_setting('app.current_school_id')::UUID OR
                current_setting('app.current_user_id')::UUID IN (
                    SELECT id FROM users WHERE role IN ('super_admin', 'edufam_admin')
                ) OR
                current_setting('app.current_user_id')::UUID IN (
                    SELECT director_id FROM director_school_access 
                    WHERE school_id = fa.school_id AND is_active = true
                )
            )
        )
    );

-- ====================================
-- HELPER FUNCTIONS
-- ====================================

-- Function to generate fee assignment code
CREATE OR REPLACE FUNCTION generate_fee_assignment_code(school_id UUID, assignment_type VARCHAR)
RETURNS VARCHAR AS $$
DECLARE
    year_part VARCHAR := EXTRACT(YEAR FROM NOW())::VARCHAR;
    type_prefix VARCHAR;
    sequence_num INTEGER;
    code VARCHAR;
BEGIN
    -- Determine prefix based on assignment type
    type_prefix := CASE assignment_type
        WHEN 'class' THEN 'CL'
        WHEN 'individual' THEN 'IN'
        WHEN 'bulk' THEN 'BK'
        WHEN 'grade_level' THEN 'GL'
        WHEN 'curriculum_specific' THEN 'CS'
        ELSE 'FA'
    END;
    
    -- Get next sequence number for this school and year
    SELECT COALESCE(MAX(
        CASE 
            WHEN assignment_code ~ '^' || type_prefix || '-' || year_part || '-[0-9]+$' 
            THEN CAST(SPLIT_PART(assignment_code, '-', 3) AS INTEGER)
            ELSE 0
        END
    ), 0) + 1 INTO sequence_num
    FROM fee_assignments
    WHERE fee_assignments.school_id = generate_fee_assignment_code.school_id;
    
    -- Format: CL-2024-001
    code := type_prefix || '-' || year_part || '-' || LPAD(sequence_num::VARCHAR, 3, '0');
    
    RETURN code;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate fee assignment total
CREATE OR REPLACE FUNCTION calculate_fee_assignment_total(assignment_id UUID)
RETURNS DECIMAL AS $$
DECLARE
    total_amount DECIMAL := 0;
BEGIN
    SELECT COALESCE(SUM(final_amount), 0) INTO total_amount
    FROM fee_assignment_items
    WHERE fee_assignment_id = assignment_id;
    
    RETURN total_amount;
END;
$$ LANGUAGE plpgsql;

-- Function to process fee assignment (create student assignments)
CREATE OR REPLACE FUNCTION process_fee_assignment(assignment_id UUID)
RETURNS JSONB AS $$
DECLARE
    assignment_record fee_assignments%ROWTYPE;
    target_students UUID[];
    student_record RECORD;
    student_count INTEGER := 0;
    success_count INTEGER := 0;
    error_count INTEGER := 0;
    result JSONB;
BEGIN
    -- Get assignment details
    SELECT * INTO assignment_record FROM fee_assignments WHERE id = assignment_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'Assignment not found');
    END IF;
    
    -- Update status to processing
    UPDATE fee_assignments 
    SET execution_status = 'processing', execution_started_at = NOW()
    WHERE id = assignment_id;
    
    -- Determine target students based on assignment type
    CASE assignment_record.assignment_type
        WHEN 'individual' THEN
            target_students := assignment_record.target_students;
        WHEN 'class' THEN
            SELECT array_agg(id) INTO target_students 
            FROM students 
            WHERE class_id = assignment_record.target_class_id AND is_active = true;
        WHEN 'grade_level' THEN
            SELECT array_agg(id) INTO target_students 
            FROM students 
            WHERE grade_level = assignment_record.target_grade_level 
            AND school_id = assignment_record.school_id 
            AND is_active = true;
        WHEN 'curriculum_specific' THEN
            SELECT array_agg(id) INTO target_students 
            FROM students s
            JOIN classes c ON c.id = s.class_id
            WHERE c.curriculum_type = assignment_record.curriculum_type
            AND s.school_id = assignment_record.school_id 
            AND s.is_active = true;
        ELSE
            -- Default to all active students in school
            SELECT array_agg(id) INTO target_students 
            FROM students 
            WHERE school_id = assignment_record.school_id AND is_active = true;
    END CASE;
    
    student_count := array_length(target_students, 1);
    
    -- Process each student
    FOR i IN 1..student_count LOOP
        BEGIN
            SELECT s.*, c.grade_level as current_grade_level
            INTO student_record
            FROM students s
            LEFT JOIN classes c ON c.id = s.class_id
            WHERE s.id = target_students[i];
            
            -- Insert student fee assignment
            INSERT INTO student_fee_assignments (
                fee_assignment_id,
                student_id,
                school_id,
                student_class_id,
                student_grade_level,
                admission_date,
                base_amount,
                total_amount,
                due_date,
                payment_schedule
            ) VALUES (
                assignment_id,
                student_record.id,
                assignment_record.school_id,
                student_record.class_id,
                student_record.current_grade_level,
                student_record.admission_date,
                assignment_record.total_amount,
                assignment_record.total_amount,
                assignment_record.due_date,
                assignment_record.payment_schedule
            );
            
            success_count := success_count + 1;
            
        EXCEPTION WHEN OTHERS THEN
            error_count := error_count + 1;
        END;
    END LOOP;
    
    -- Update assignment with results
    UPDATE fee_assignments 
    SET 
        execution_status = CASE 
            WHEN error_count = 0 THEN 'completed'
            WHEN success_count = 0 THEN 'failed'
            ELSE 'partial'
        END,
        execution_completed_at = NOW(),
        students_processed = student_count,
        students_successful = success_count,
        students_failed = error_count
    WHERE id = assignment_id;
    
    result := jsonb_build_object(
        'assignment_id', assignment_id,
        'students_processed', student_count,
        'students_successful', success_count,
        'students_failed', error_count,
        'status', CASE 
            WHEN error_count = 0 THEN 'completed'
            WHEN success_count = 0 THEN 'failed'
            ELSE 'partial'
        END
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE fee_assignments IS 'Main fee assignment records with approval workflow support';
COMMENT ON TABLE fee_assignment_items IS 'Detailed breakdown of fee categories for each assignment';
COMMENT ON TABLE student_fee_assignments IS 'Individual student fee assignments generated from fee_assignments';
COMMENT ON TABLE fee_assignment_history IS 'Complete audit trail of all fee assignment changes';
COMMENT ON TABLE fee_assignment_templates IS 'Reusable fee assignment templates for different scenarios';
COMMENT ON TABLE fee_assignment_approvals IS 'Multi-level approval workflow for fee assignments';