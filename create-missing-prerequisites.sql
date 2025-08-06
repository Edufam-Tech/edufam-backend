-- Create missing prerequisite tables for modules

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create subjects table (required by academic module)
CREATE TABLE IF NOT EXISTS subjects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    
    -- Subject details
    name VARCHAR(100) NOT NULL,
    code VARCHAR(20) NOT NULL,
    description TEXT,
    
    -- Classification
    category VARCHAR(50) DEFAULT 'core' CHECK (category IN ('core', 'elective', 'co_curricular')),
    level VARCHAR(20) DEFAULT 'secondary' CHECK (level IN ('primary', 'secondary', 'tertiary')),
    
    -- Academic details
    credit_hours INTEGER DEFAULT 1,
    prerequisites JSONB DEFAULT '[]',
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    
    -- Metadata
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_school_subject_code UNIQUE (school_id, code),
    CONSTRAINT unique_school_subject_name UNIQUE (school_id, name)
);

-- Create departments table (required by HR module)
CREATE TABLE IF NOT EXISTS departments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    
    -- Department details
    name VARCHAR(100) NOT NULL,
    code VARCHAR(20) NOT NULL,
    description TEXT,
    
    -- Management
    head_id UUID REFERENCES users(id) ON DELETE SET NULL,
    budget DECIMAL(12,2),
    location VARCHAR(255),
    
    -- Contact information
    phone VARCHAR(20),
    email VARCHAR(255),
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    
    -- Metadata
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_school_department_code UNIQUE (school_id, code),
    CONSTRAINT unique_school_department_name UNIQUE (school_id, name)
);

-- Create class_subjects table (for subject assignments to classes)
CREATE TABLE IF NOT EXISTS class_subjects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Schedule
    periods_per_week INTEGER DEFAULT 1,
    duration_minutes INTEGER DEFAULT 40,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_class_subject UNIQUE (class_id, subject_id)
);

-- Add missing columns to existing tables

-- Add admission_number to students table if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'students' AND column_name = 'admission_number'
    ) THEN
        ALTER TABLE students ADD COLUMN admission_number VARCHAR(50) UNIQUE;
    END IF;
END $$;

-- Add department_id to staff table if it doesn't exist  
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'staff' AND column_name = 'department_id'
    ) THEN
        ALTER TABLE staff ADD COLUMN department_id UUID REFERENCES departments(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_subjects_school ON subjects(school_id);
CREATE INDEX IF NOT EXISTS idx_subjects_category ON subjects(category);
CREATE INDEX IF NOT EXISTS idx_subjects_level ON subjects(level);
CREATE INDEX IF NOT EXISTS idx_subjects_active ON subjects(is_active);

CREATE INDEX IF NOT EXISTS idx_departments_school ON departments(school_id);
CREATE INDEX IF NOT EXISTS idx_departments_head ON departments(head_id);
CREATE INDEX IF NOT EXISTS idx_departments_active ON departments(is_active);

CREATE INDEX IF NOT EXISTS idx_class_subjects_class ON class_subjects(class_id);
CREATE INDEX IF NOT EXISTS idx_class_subjects_subject ON class_subjects(subject_id);
CREATE INDEX IF NOT EXISTS idx_class_subjects_teacher ON class_subjects(teacher_id);

CREATE INDEX IF NOT EXISTS idx_students_admission_number ON students(admission_number);
CREATE INDEX IF NOT EXISTS idx_staff_department ON staff(department_id);

-- Create triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER IF NOT EXISTS update_subjects_updated_at 
    BEFORE UPDATE ON subjects 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER IF NOT EXISTS update_departments_updated_at 
    BEFORE UPDATE ON departments 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER IF NOT EXISTS update_class_subjects_updated_at 
    BEFORE UPDATE ON class_subjects 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_subjects ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for school-based access
CREATE POLICY IF NOT EXISTS subjects_school_policy ON subjects FOR ALL USING (
    school_id IN (
        SELECT s.id FROM schools s
        JOIN users u ON s.id = u.school_id
        WHERE u.id = auth.uid()
    )
);

CREATE POLICY IF NOT EXISTS departments_school_policy ON departments FOR ALL USING (
    school_id IN (
        SELECT s.id FROM schools s
        JOIN users u ON s.id = u.school_id
        WHERE u.id = auth.uid()
    )
);

CREATE POLICY IF NOT EXISTS class_subjects_school_policy ON class_subjects FOR ALL USING (
    class_id IN (
        SELECT c.id FROM classes c
        JOIN schools s ON c.school_id = s.id
        JOIN users u ON s.id = u.school_id
        WHERE u.id = auth.uid()
    )
);

-- Insert some default subjects for testing
INSERT INTO subjects (school_id, name, code, category, level, created_by) 
SELECT 
    s.id,
    'Mathematics',
    'MATH',
    'core',
    'secondary',
    u.id
FROM schools s
JOIN users u ON s.id = u.school_id
WHERE u.role IN ('principal', 'school_director', 'admin')
ON CONFLICT (school_id, code) DO NOTHING;

INSERT INTO subjects (school_id, name, code, category, level, created_by) 
SELECT 
    s.id,
    'English',
    'ENG',
    'core',
    'secondary',
    u.id
FROM schools s
JOIN users u ON s.id = u.school_id
WHERE u.role IN ('principal', 'school_director', 'admin')
ON CONFLICT (school_id, code) DO NOTHING;

INSERT INTO subjects (school_id, name, code, category, level, created_by) 
SELECT 
    s.id,
    'Science',
    'SCI',
    'core',
    'secondary',
    u.id
FROM schools s
JOIN users u ON s.id = u.school_id
WHERE u.role IN ('principal', 'school_director', 'admin')
ON CONFLICT (school_id, code) DO NOTHING;

-- Insert some default departments
INSERT INTO departments (school_id, name, code, description, created_by) 
SELECT 
    s.id,
    'Academic Department',
    'ACAD',
    'Main academic department for teaching staff',
    u.id
FROM schools s
JOIN users u ON s.id = u.school_id
WHERE u.role IN ('principal', 'school_director', 'admin')
ON CONFLICT (school_id, code) DO NOTHING;

INSERT INTO departments (school_id, name, code, description, created_by) 
SELECT 
    s.id,
    'Administration',
    'ADMIN',
    'Administrative and support staff',
    u.id
FROM schools s
JOIN users u ON s.id = u.school_id
WHERE u.role IN ('principal', 'school_director', 'admin')
ON CONFLICT (school_id, code) DO NOTHING;

-- Add comments for documentation
COMMENT ON TABLE subjects IS 'Academic subjects offered by the school';
COMMENT ON TABLE departments IS 'School departments for organizing staff';
COMMENT ON TABLE class_subjects IS 'Assignment of subjects to classes with teachers';