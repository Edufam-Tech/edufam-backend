-- Migration: Add Student Management Tables
-- This script adds the students, classes, and enrollments tables to support student management

-- Students table
CREATE TABLE students (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    admission_number VARCHAR(20) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    date_of_birth DATE NOT NULL,
    gender VARCHAR(10) NOT NULL CHECK (gender IN ('male', 'female', 'other')),
    phone VARCHAR(20),
    email VARCHAR(255),
    address TEXT,
    parent_id UUID REFERENCES users(id) ON DELETE SET NULL,
    class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
    curriculum_type VARCHAR(20) DEFAULT '8-4-4' CHECK (curriculum_type IN ('CBC', 'IGCSE', '8-4-4')),
    enrollment_date DATE DEFAULT CURRENT_DATE,
    enrollment_status VARCHAR(20) DEFAULT 'active' CHECK (enrollment_status IN ('active', 'inactive', 'suspended', 'graduated', 'transferred')),
    profile_picture_url TEXT,
    emergency_contact JSONB DEFAULT '{}',
    medical_info JSONB DEFAULT '{}',
    academic_info JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,

    -- Standard fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT unique_school_admission_number UNIQUE (school_id, admission_number)
);

-- Classes table
CREATE TABLE classes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    grade_level INTEGER NOT NULL CHECK (grade_level >= 1 AND grade_level <= 12),
    curriculum_type VARCHAR(20) DEFAULT '8-4-4' CHECK (curriculum_type IN ('CBC', 'IGCSE', '8-4-4')),
    academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
    capacity INTEGER DEFAULT 40 CHECK (capacity >= 1 AND capacity <= 100),
    description TEXT,
    teacher_id UUID REFERENCES users(id) ON DELETE SET NULL,
    room_number VARCHAR(20),
    schedule JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT true,

    -- Standard fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT unique_school_year_class_name UNIQUE (school_id, academic_year_id, name)
);

-- Enrollments table
CREATE TABLE enrollments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    enrollment_date DATE DEFAULT CURRENT_DATE,
    enrollment_status VARCHAR(20) DEFAULT 'active' CHECK (enrollment_status IN ('active', 'inactive', 'suspended', 'graduated', 'transferred')),
    enrollment_type VARCHAR(20) DEFAULT 'new' CHECK (enrollment_type IN ('new', 'transfer', 're-enrollment')),
    previous_school VARCHAR(255),
    previous_class VARCHAR(100),
    documents JSONB DEFAULT '[]',
    notes TEXT,
    is_active BOOLEAN DEFAULT true,

    -- Standard fields
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT unique_student_academic_year UNIQUE (student_id, academic_year_id)
);

-- Create indexes for performance
CREATE INDEX idx_students_school ON students(school_id);
CREATE INDEX idx_students_admission_number ON students(admission_number);
CREATE INDEX idx_students_class ON students(class_id);
CREATE INDEX idx_students_parent ON students(parent_id);
CREATE INDEX idx_students_curriculum ON students(curriculum_type);
CREATE INDEX idx_students_status ON students(enrollment_status);
CREATE INDEX idx_students_active ON students(is_active);
CREATE INDEX idx_students_name ON students(first_name, last_name);

CREATE INDEX idx_classes_school ON classes(school_id);
CREATE INDEX idx_classes_academic_year ON classes(academic_year_id);
CREATE INDEX idx_classes_teacher ON classes(teacher_id);
CREATE INDEX idx_classes_curriculum ON classes(curriculum_type);
CREATE INDEX idx_classes_grade ON classes(grade_level);
CREATE INDEX idx_classes_active ON classes(is_active);

CREATE INDEX idx_enrollments_student ON enrollments(student_id);
CREATE INDEX idx_enrollments_school ON enrollments(school_id);
CREATE INDEX idx_enrollments_academic_year ON enrollments(academic_year_id);
CREATE INDEX idx_enrollments_class ON enrollments(class_id);
CREATE INDEX idx_enrollments_status ON enrollments(enrollment_status);
CREATE INDEX idx_enrollments_type ON enrollments(enrollment_type);
CREATE INDEX idx_enrollments_active ON enrollments(is_active);

-- Add triggers for updated_at
CREATE TRIGGER update_students_updated_at
    BEFORE UPDATE ON students
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_classes_updated_at
    BEFORE UPDATE ON classes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_enrollments_updated_at
    BEFORE UPDATE ON enrollments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add RLS policies for students
ALTER TABLE students ENABLE ROW LEVEL SECURITY;

CREATE POLICY students_school_policy ON students
    FOR ALL
    USING (
        school_id IN (
            SELECT school_id FROM users
            WHERE id = current_setting('app.current_user_id')::UUID
            AND user_type = 'school_user'
        )
        OR
        EXISTS (
            SELECT 1 FROM users
            WHERE id = current_setting('app.current_user_id')::UUID
            AND user_type = 'admin_user'
        )
    );

-- Add RLS policies for classes
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;

CREATE POLICY classes_school_policy ON classes
    FOR ALL
    USING (
        school_id IN (
            SELECT school_id FROM users
            WHERE id = current_setting('app.current_user_id')::UUID
            AND user_type = 'school_user'
        )
        OR
        EXISTS (
            SELECT 1 FROM users
            WHERE id = current_setting('app.current_user_id')::UUID
            AND user_type = 'admin_user'
        )
    );

-- Add RLS policies for enrollments
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY enrollments_school_policy ON enrollments
    FOR ALL
    USING (
        school_id IN (
            SELECT school_id FROM users
            WHERE id = current_setting('app.current_user_id')::UUID
            AND user_type = 'school_user'
        )
        OR
        EXISTS (
            SELECT 1 FROM users
            WHERE id = current_setting('app.current_user_id')::UUID
            AND user_type = 'admin_user'
        )
    );

-- Add comments for documentation
COMMENT ON TABLE students IS 'Student records for each school';
COMMENT ON TABLE classes IS 'Class records for each school and academic year';
COMMENT ON TABLE enrollments IS 'Student enrollment records linking students to classes and academic years';

COMMENT ON COLUMN students.school_id IS 'Reference to the school this student belongs to';
COMMENT ON COLUMN students.admission_number IS 'Unique admission number within the school';
COMMENT ON COLUMN students.parent_id IS 'Reference to the parent/guardian user account';
COMMENT ON COLUMN students.class_id IS 'Reference to the current class assignment';
COMMENT ON COLUMN students.curriculum_type IS 'Curriculum type: CBC, IGCSE, or 8-4-4';
COMMENT ON COLUMN students.enrollment_status IS 'Current enrollment status of the student';
COMMENT ON COLUMN students.emergency_contact IS 'JSON object containing emergency contact information';
COMMENT ON COLUMN students.medical_info IS 'JSON object containing medical information';
COMMENT ON COLUMN students.academic_info IS 'JSON object containing academic information';

COMMENT ON COLUMN classes.school_id IS 'Reference to the school this class belongs to';
COMMENT ON COLUMN classes.academic_year_id IS 'Reference to the academic year this class belongs to';
COMMENT ON COLUMN classes.teacher_id IS 'Reference to the teacher assigned to this class';
COMMENT ON COLUMN classes.capacity IS 'Maximum number of students allowed in this class';
COMMENT ON COLUMN classes.schedule IS 'JSON array containing class schedule information';

COMMENT ON COLUMN enrollments.student_id IS 'Reference to the student being enrolled';
COMMENT ON COLUMN enrollments.school_id IS 'Reference to the school for this enrollment';
COMMENT ON COLUMN enrollments.academic_year_id IS 'Reference to the academic year for this enrollment';
COMMENT ON COLUMN enrollments.class_id IS 'Reference to the class for this enrollment';
COMMENT ON COLUMN enrollments.enrollment_type IS 'Type of enrollment: new, transfer, or re-enrollment';
COMMENT ON COLUMN enrollments.documents IS 'JSON array containing enrollment documents';
COMMENT ON COLUMN enrollments.created_by IS 'User who created this enrollment record';
COMMENT ON COLUMN enrollments.updated_by IS 'User who last updated this enrollment record'; 