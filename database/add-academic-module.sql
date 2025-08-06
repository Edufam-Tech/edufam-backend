-- Migration: Add Academic Module Tables (Grades & Attendance)
-- This script adds comprehensive academic management tables

-- Grade Categories table (exams, tests, assignments)
CREATE TABLE grade_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    weight DECIMAL(5,2) NOT NULL DEFAULT 0.00 CHECK (weight >= 0 AND weight <= 100),
    color VARCHAR(7) DEFAULT '#3B82F6', -- Hex color for UI
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_school_category_name UNIQUE (school_id, name)
);

-- Assessments table (exam/test definitions)
CREATE TABLE assessments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
    academic_term_id UUID REFERENCES academic_terms(id) ON DELETE CASCADE,
    class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
    
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category_id UUID NOT NULL REFERENCES grade_categories(id) ON DELETE CASCADE,
    
    -- Assessment details
    total_marks DECIMAL(8,2) NOT NULL DEFAULT 100.00,
    pass_marks DECIMAL(8,2) NOT NULL DEFAULT 40.00,
    assessment_date DATE NOT NULL,
    duration_minutes INTEGER,
    
    -- Grading settings
    grading_scale_id UUID REFERENCES grading_scales(id),
    allow_decimal_marks BOOLEAN DEFAULT false,
    allow_negative_marks BOOLEAN DEFAULT false,
    
    -- Status and workflow
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'grading', 'completed', 'archived')),
    is_final BOOLEAN DEFAULT false,
    
    -- Metadata
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT check_assessment_marks CHECK (total_marks > 0 AND pass_marks >= 0 AND pass_marks <= total_marks)
);

-- Grading Scales table (curriculum-specific scales)
CREATE TABLE grading_scales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    curriculum_type VARCHAR(20) NOT NULL CHECK (curriculum_type IN ('CBC', 'IGCSE', '8-4-4')),
    
    -- Scale configuration
    scale_type VARCHAR(20) NOT NULL CHECK (scale_type IN ('percentage', 'letter_grade', 'numerical')),
    min_score DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    max_score DECIMAL(5,2) NOT NULL DEFAULT 100.00,
    
    -- Grade boundaries (JSON format)
    grade_boundaries JSONB NOT NULL DEFAULT '[]',
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    is_default BOOLEAN DEFAULT false,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_school_scale_name UNIQUE (school_id, name)
);

-- Grades table (student grades)
CREATE TABLE grades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    
    -- Grade data
    marks_obtained DECIMAL(8,2) NOT NULL,
    percentage DECIMAL(5,2) GENERATED ALWAYS AS (
        CASE 
            WHEN a.total_marks > 0 THEN (marks_obtained / a.total_marks) * 100
            ELSE 0
        END
    ) STORED,
    letter_grade VARCHAR(5),
    grade_point DECIMAL(3,2),
    
    -- Additional data
    remarks TEXT,
    is_absent BOOLEAN DEFAULT false,
    is_exempted BOOLEAN DEFAULT false,
    
    -- Workflow
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected')),
    submitted_by UUID REFERENCES users(id),
    submitted_at TIMESTAMP,
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP,
    rejection_reason TEXT,
    
    -- Metadata
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_student_assessment UNIQUE (student_id, assessment_id),
    CONSTRAINT check_marks_range CHECK (marks_obtained >= 0)
);

-- Grade Approvals table (approval workflow)
CREATE TABLE grade_approvals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
    
    -- Approval workflow
    submitted_by UUID NOT NULL REFERENCES users(id),
    submitted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP,
    rejected_by UUID REFERENCES users(id),
    rejected_at TIMESTAMP,
    rejection_reason TEXT,
    
    -- Status
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Grade Comments table (teacher remarks)
CREATE TABLE grade_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    grade_id UUID NOT NULL REFERENCES grades(id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES users(id),
    
    comment_text TEXT NOT NULL,
    comment_type VARCHAR(20) DEFAULT 'general' CHECK (comment_type IN ('general', 'improvement', 'achievement', 'behavior')),
    is_private BOOLEAN DEFAULT false, -- Private comments not visible to parents
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Attendance Registers table (daily registers)
CREATE TABLE attendance_registers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
    academic_term_id UUID REFERENCES academic_terms(id) ON DELETE CASCADE,
    
    -- Register details
    register_date DATE NOT NULL,
    session_type VARCHAR(10) NOT NULL CHECK (session_type IN ('morning', 'afternoon', 'full_day')),
    subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE, -- For subject-specific attendance
    
    -- Status
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'closed', 'archived')),
    is_marked BOOLEAN DEFAULT false,
    
    -- Metadata
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_class_date_session UNIQUE (class_id, register_date, session_type, subject_id)
);

-- Attendance Records table (individual records)
CREATE TABLE attendance_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    register_id UUID NOT NULL REFERENCES attendance_registers(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    
    -- Attendance status
    status VARCHAR(20) NOT NULL CHECK (status IN ('present', 'absent', 'late', 'excused', 'sick_leave', 'other')),
    time_in TIME,
    time_out TIME,
    
    -- Additional details
    reason_id UUID REFERENCES attendance_reasons(id),
    custom_reason TEXT,
    remarks TEXT,
    
    -- Metadata
    marked_by UUID NOT NULL REFERENCES users(id),
    marked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_student_register UNIQUE (student_id, register_id)
);

-- Attendance Reasons table (absence reasons)
CREATE TABLE attendance_reasons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_excused BOOLEAN DEFAULT false,
    requires_documentation BOOLEAN DEFAULT false,
    color VARCHAR(7) DEFAULT '#EF4444', -- Hex color for UI
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_school_reason_name UNIQUE (school_id, name)
);

-- Attendance Settings table (rules per school)
CREATE TABLE attendance_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    
    -- General settings
    late_threshold_minutes INTEGER DEFAULT 15,
    absent_threshold_minutes INTEGER DEFAULT 30,
    auto_mark_absent BOOLEAN DEFAULT false,
    
    -- Notification settings
    notify_parents_on_absence BOOLEAN DEFAULT true,
    notify_after_minutes INTEGER DEFAULT 30,
    sms_notifications BOOLEAN DEFAULT true,
    email_notifications BOOLEAN DEFAULT true,
    
    -- Session settings
    morning_start_time TIME DEFAULT '08:00:00',
    morning_end_time TIME DEFAULT '12:00:00',
    afternoon_start_time TIME DEFAULT '13:00:00',
    afternoon_end_time TIME DEFAULT '16:00:00',
    
    -- Academic impact
    affect_grades BOOLEAN DEFAULT false,
    attendance_weight DECIMAL(5,2) DEFAULT 0.00,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_school_settings UNIQUE (school_id)
);

-- Make-up Classes table (extra classes)
CREATE TABLE make_up_classes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
    
    -- Class details
    title VARCHAR(255) NOT NULL,
    description TEXT,
    scheduled_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    venue VARCHAR(255),
    
    -- Purpose and target
    purpose TEXT NOT NULL,
    target_students JSONB DEFAULT '[]', -- Array of student IDs or 'all'
    
    -- Status
    status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
    
    -- Metadata
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Remedial Sessions table (support classes)
CREATE TABLE remedial_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
    
    -- Session details
    title VARCHAR(255) NOT NULL,
    description TEXT,
    scheduled_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    venue VARCHAR(255),
    
    -- Academic focus
    focus_area TEXT NOT NULL,
    target_students JSONB NOT NULL DEFAULT '[]', -- Array of student IDs
    assessment_id UUID REFERENCES assessments(id) ON DELETE CASCADE,
    
    -- Progress tracking
    objectives TEXT,
    outcomes TEXT,
    is_completed BOOLEAN DEFAULT false,
    
    -- Metadata
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_grade_categories_school ON grade_categories(school_id);
CREATE INDEX idx_grade_categories_active ON grade_categories(is_active);

CREATE INDEX idx_assessments_school ON assessments(school_id);
CREATE INDEX idx_assessments_year ON assessments(academic_year_id);
CREATE INDEX idx_assessments_term ON assessments(academic_term_id);
CREATE INDEX idx_assessments_class ON assessments(class_id);
CREATE INDEX idx_assessments_subject ON assessments(subject_id);
CREATE INDEX idx_assessments_category ON assessments(category_id);
CREATE INDEX idx_assessments_status ON assessments(status);
CREATE INDEX idx_assessments_date ON assessments(assessment_date);

CREATE INDEX idx_grading_scales_school ON grading_scales(school_id);
CREATE INDEX idx_grading_scales_curriculum ON grading_scales(curriculum_type);
CREATE INDEX idx_grading_scales_active ON grading_scales(is_active);

CREATE INDEX idx_grades_school ON grades(school_id);
CREATE INDEX idx_grades_assessment ON grades(assessment_id);
CREATE INDEX idx_grades_student ON grades(student_id);
CREATE INDEX idx_grades_status ON grades(status);
CREATE INDEX idx_grades_submitted ON grades(submitted_by);
CREATE INDEX idx_grades_approved ON grades(approved_by);

CREATE INDEX idx_grade_approvals_school ON grade_approvals(school_id);
CREATE INDEX idx_grade_approvals_assessment ON grade_approvals(assessment_id);
CREATE INDEX idx_grade_approvals_status ON grade_approvals(status);

CREATE INDEX idx_grade_comments_grade ON grade_comments(grade_id);
CREATE INDEX idx_grade_comments_teacher ON grade_comments(teacher_id);

CREATE INDEX idx_attendance_registers_school ON attendance_registers(school_id);
CREATE INDEX idx_attendance_registers_class ON attendance_registers(class_id);
CREATE INDEX idx_attendance_registers_date ON attendance_registers(register_date);
CREATE INDEX idx_attendance_registers_status ON attendance_registers(status);

CREATE INDEX idx_attendance_records_register ON attendance_records(register_id);
CREATE INDEX idx_attendance_records_student ON attendance_records(student_id);
CREATE INDEX idx_attendance_records_status ON attendance_records(status);
CREATE INDEX idx_attendance_records_marked ON attendance_records(marked_by);

CREATE INDEX idx_attendance_reasons_school ON attendance_reasons(school_id);
CREATE INDEX idx_attendance_reasons_active ON attendance_reasons(is_active);

CREATE INDEX idx_make_up_classes_school ON make_up_classes(school_id);
CREATE INDEX idx_make_up_classes_class ON make_up_classes(class_id);
CREATE INDEX idx_make_up_classes_date ON make_up_classes(scheduled_date);
CREATE INDEX idx_make_up_classes_status ON make_up_classes(status);

CREATE INDEX idx_remedial_sessions_school ON remedial_sessions(school_id);
CREATE INDEX idx_remedial_sessions_class ON remedial_sessions(class_id);
CREATE INDEX idx_remedial_sessions_date ON remedial_sessions(scheduled_date);

-- Add triggers for updated_at
CREATE TRIGGER update_grade_categories_updated_at BEFORE UPDATE ON grade_categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_assessments_updated_at BEFORE UPDATE ON assessments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_grading_scales_updated_at BEFORE UPDATE ON grading_scales FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_grades_updated_at BEFORE UPDATE ON grades FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_grade_approvals_updated_at BEFORE UPDATE ON grade_approvals FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_grade_comments_updated_at BEFORE UPDATE ON grade_comments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_attendance_registers_updated_at BEFORE UPDATE ON attendance_registers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_attendance_records_updated_at BEFORE UPDATE ON attendance_records FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_attendance_reasons_updated_at BEFORE UPDATE ON attendance_reasons FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_attendance_settings_updated_at BEFORE UPDATE ON attendance_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_make_up_classes_updated_at BEFORE UPDATE ON make_up_classes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_remedial_sessions_updated_at BEFORE UPDATE ON remedial_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add RLS policies
ALTER TABLE grade_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE grading_scales ENABLE ROW LEVEL SECURITY;
ALTER TABLE grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE grade_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE grade_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_registers ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_reasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE make_up_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE remedial_sessions ENABLE ROW LEVEL SECURITY;

-- RLS policies for academic tables
CREATE POLICY academic_school_policy ON grade_categories FOR ALL USING (
    school_id IN (
        SELECT school_id FROM users 
        WHERE id = current_setting('app.current_user_id')::UUID
        AND user_type = 'school_user'
    )
    OR EXISTS (
        SELECT 1 FROM users 
        WHERE id = current_setting('app.current_user_id')::UUID
        AND user_type = 'admin_user'
    )
);

CREATE POLICY academic_school_policy ON assessments FOR ALL USING (
    school_id IN (
        SELECT school_id FROM users 
        WHERE id = current_setting('app.current_user_id')::UUID
        AND user_type = 'school_user'
    )
    OR EXISTS (
        SELECT 1 FROM users 
        WHERE id = current_setting('app.current_user_id')::UUID
        AND user_type = 'admin_user'
    )
);

CREATE POLICY academic_school_policy ON grading_scales FOR ALL USING (
    school_id IN (
        SELECT school_id FROM users 
        WHERE id = current_setting('app.current_user_id')::UUID
        AND user_type = 'school_user'
    )
    OR EXISTS (
        SELECT 1 FROM users 
        WHERE id = current_setting('app.current_user_id')::UUID
        AND user_type = 'admin_user'
    )
);

CREATE POLICY academic_school_policy ON grades FOR ALL USING (
    school_id IN (
        SELECT school_id FROM users 
        WHERE id = current_setting('app.current_user_id')::UUID
        AND user_type = 'school_user'
    )
    OR EXISTS (
        SELECT 1 FROM users 
        WHERE id = current_setting('app.current_user_id')::UUID
        AND user_type = 'admin_user'
    )
);

CREATE POLICY academic_school_policy ON grade_approvals FOR ALL USING (
    school_id IN (
        SELECT school_id FROM users 
        WHERE id = current_setting('app.current_user_id')::UUID
        AND user_type = 'school_user'
    )
    OR EXISTS (
        SELECT 1 FROM users 
        WHERE id = current_setting('app.current_user_id')::UUID
        AND user_type = 'admin_user'
    )
);

CREATE POLICY academic_school_policy ON grade_comments FOR ALL USING (
    grade_id IN (
        SELECT g.id FROM grades g
        JOIN users u ON g.school_id = u.school_id
        WHERE u.id = current_setting('app.current_user_id')::UUID
        AND u.user_type = 'school_user'
    )
    OR EXISTS (
        SELECT 1 FROM users 
        WHERE id = current_setting('app.current_user_id')::UUID
        AND user_type = 'admin_user'
    )
);

CREATE POLICY academic_school_policy ON attendance_registers FOR ALL USING (
    school_id IN (
        SELECT school_id FROM users 
        WHERE id = current_setting('app.current_user_id')::UUID
        AND user_type = 'school_user'
    )
    OR EXISTS (
        SELECT 1 FROM users 
        WHERE id = current_setting('app.current_user_id')::UUID
        AND user_type = 'admin_user'
    )
);

CREATE POLICY academic_school_policy ON attendance_records FOR ALL USING (
    register_id IN (
        SELECT ar.id FROM attendance_registers ar
        JOIN users u ON ar.school_id = u.school_id
        WHERE u.id = current_setting('app.current_user_id')::UUID
        AND u.user_type = 'school_user'
    )
    OR EXISTS (
        SELECT 1 FROM users 
        WHERE id = current_setting('app.current_user_id')::UUID
        AND user_type = 'admin_user'
    )
);

CREATE POLICY academic_school_policy ON attendance_reasons FOR ALL USING (
    school_id IN (
        SELECT school_id FROM users 
        WHERE id = current_setting('app.current_user_id')::UUID
        AND user_type = 'school_user'
    )
    OR EXISTS (
        SELECT 1 FROM users 
        WHERE id = current_setting('app.current_user_id')::UUID
        AND user_type = 'admin_user'
    )
);

CREATE POLICY academic_school_policy ON attendance_settings FOR ALL USING (
    school_id IN (
        SELECT school_id FROM users 
        WHERE id = current_setting('app.current_user_id')::UUID
        AND user_type = 'school_user'
    )
    OR EXISTS (
        SELECT 1 FROM users 
        WHERE id = current_setting('app.current_user_id')::UUID
        AND user_type = 'admin_user'
    )
);

CREATE POLICY academic_school_policy ON make_up_classes FOR ALL USING (
    school_id IN (
        SELECT school_id FROM users 
        WHERE id = current_setting('app.current_user_id')::UUID
        AND user_type = 'school_user'
    )
    OR EXISTS (
        SELECT 1 FROM users 
        WHERE id = current_setting('app.current_user_id')::UUID
        AND user_type = 'admin_user'
    )
);

CREATE POLICY academic_school_policy ON remedial_sessions FOR ALL USING (
    school_id IN (
        SELECT school_id FROM users 
        WHERE id = current_setting('app.current_user_id')::UUID
        AND user_type = 'school_user'
    )
    OR EXISTS (
        SELECT 1 FROM users 
        WHERE id = current_setting('app.current_user_id')::UUID
        AND user_type = 'admin_user'
    )
);

-- Insert default data
INSERT INTO grade_categories (school_id, name, description, weight, color) 
SELECT 
    id as school_id,
    'Exams' as name,
    'Major examinations and tests' as description,
    40.00 as weight,
    '#EF4444' as color
FROM schools WHERE is_active = true;

INSERT INTO grade_categories (school_id, name, description, weight, color) 
SELECT 
    id as school_id,
    'Tests' as name,
    'Regular tests and quizzes' as description,
    30.00 as weight,
    '#F59E0B' as color
FROM schools WHERE is_active = true;

INSERT INTO grade_categories (school_id, name, description, weight, color) 
SELECT 
    id as school_id,
    'Assignments' as name,
    'Homework and assignments' as description,
    20.00 as weight,
    '#10B981' as color
FROM schools WHERE is_active = true;

INSERT INTO grade_categories (school_id, name, description, weight, color) 
SELECT 
    id as school_id,
    'Participation' as name,
    'Class participation and engagement' as description,
    10.00 as weight,
    '#3B82F6' as color
FROM schools WHERE is_active = true;

-- Insert default grading scales
INSERT INTO grading_scales (school_id, name, description, curriculum_type, scale_type, grade_boundaries) 
SELECT 
    id as school_id,
    'Standard 8-4-4' as name,
    'Standard grading scale for 8-4-4 curriculum' as description,
    '8-4-4' as curriculum_type,
    'letter_grade' as scale_type,
    '[
        {"min": 80, "max": 100, "grade": "A", "points": 12.0, "description": "Excellent"},
        {"min": 70, "max": 79, "grade": "A-", "points": 11.0, "description": "Very Good"},
        {"min": 60, "max": 69, "grade": "B+", "points": 10.0, "description": "Good"},
        {"min": 50, "max": 59, "grade": "B", "points": 9.0, "description": "Above Average"},
        {"min": 40, "max": 49, "grade": "B-", "points": 8.0, "description": "Average"},
        {"min": 30, "max": 39, "grade": "C+", "points": 7.0, "description": "Below Average"},
        {"min": 20, "max": 29, "grade": "C", "points": 6.0, "description": "Poor"},
        {"min": 0, "max": 19, "grade": "E", "points": 0.0, "description": "Fail"}
    ]'::jsonb as grade_boundaries
FROM schools WHERE is_active = true;

-- Insert default attendance reasons
INSERT INTO attendance_reasons (school_id, name, description, is_excused, requires_documentation) 
SELECT 
    id as school_id,
    'Sick Leave' as name,
    'Student is sick and unable to attend' as description,
    true as is_excused,
    true as requires_documentation
FROM schools WHERE is_active = true;

INSERT INTO attendance_reasons (school_id, name, description, is_excused, requires_documentation) 
SELECT 
    id as school_id,
    'Medical Appointment' as name,
    'Student has a medical appointment' as description,
    true as is_excused,
    true as requires_documentation
FROM schools WHERE is_active = true;

INSERT INTO attendance_reasons (school_id, name, description, is_excused, requires_documentation) 
SELECT 
    id as school_id,
    'Family Emergency' as name,
    'Family emergency requiring absence' as description,
    true as is_excused,
    false as requires_documentation
FROM schools WHERE is_active = true;

INSERT INTO attendance_reasons (school_id, name, description, is_excused, requires_documentation) 
SELECT 
    id as school_id,
    'Religious Holiday' as name,
    'Religious holiday or observance' as description,
    true as is_excused,
    false as requires_documentation
FROM schools WHERE is_active = true;

INSERT INTO attendance_reasons (school_id, name, description, is_excused, requires_documentation) 
SELECT 
    id as school_id,
    'Unexcused Absence' as name,
    'Absence without valid reason' as description,
    false as is_excused,
    false as requires_documentation
FROM schools WHERE is_active = true;

-- Insert default attendance settings
INSERT INTO attendance_settings (school_id) 
SELECT id as school_id FROM schools WHERE is_active = true;

-- Add comments for documentation
COMMENT ON TABLE grade_categories IS 'Grade categories for different types of assessments';
COMMENT ON TABLE assessments IS 'Assessment definitions and configurations';
COMMENT ON TABLE grading_scales IS 'Grading scales for different curricula';
COMMENT ON TABLE grades IS 'Individual student grades for assessments';
COMMENT ON TABLE grade_approvals IS 'Grade approval workflow tracking';
COMMENT ON TABLE grade_comments IS 'Teacher comments on student grades';
COMMENT ON TABLE attendance_registers IS 'Daily attendance registers for classes';
COMMENT ON TABLE attendance_records IS 'Individual student attendance records';
COMMENT ON TABLE attendance_reasons IS 'Predefined reasons for absences';
COMMENT ON TABLE attendance_settings IS 'School-specific attendance rules and settings';
COMMENT ON TABLE make_up_classes IS 'Extra classes to make up for missed sessions';
COMMENT ON TABLE remedial_sessions IS 'Support classes for struggling students'; 