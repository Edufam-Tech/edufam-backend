-- ====================================
-- FIX ADDITIONAL MISSING COLUMNS
-- ====================================
-- This file fixes additional database schema issues causing API errors

-- Fix 1: Add missing columns to employees table if they don't exist
DO $$ 
BEGIN
    -- Add first_name column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'employees' AND column_name = 'first_name') THEN
        ALTER TABLE employees ADD COLUMN first_name VARCHAR(100);
    END IF;
    
    -- Add last_name column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'employees' AND column_name = 'last_name') THEN
        ALTER TABLE employees ADD COLUMN last_name VARCHAR(100);
    END IF;
    
    -- Add hire_date column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'employees' AND column_name = 'hire_date') THEN
        ALTER TABLE employees ADD COLUMN hire_date DATE DEFAULT CURRENT_DATE;
    END IF;
    
    -- Add employment_status column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'employees' AND column_name = 'employment_status') THEN
        ALTER TABLE employees ADD COLUMN employment_status VARCHAR(20) DEFAULT 'active' 
            CHECK (employment_status IN ('active', 'inactive', 'terminated', 'suspended', 'probation'));
    END IF;
    
    -- Add position column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'employees' AND column_name = 'position') THEN
        ALTER TABLE employees ADD COLUMN position VARCHAR(100);
    END IF;
    
    -- Add department_id column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'employees' AND column_name = 'department_id') THEN
        ALTER TABLE employees ADD COLUMN department_id UUID REFERENCES departments(id);
    END IF;
    
    -- Add employee_number column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'employees' AND column_name = 'employee_number') THEN
        ALTER TABLE employees ADD COLUMN employee_number VARCHAR(50);
    END IF;
    
    -- Add qualifications column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'employees' AND column_name = 'qualifications') THEN
        ALTER TABLE employees ADD COLUMN qualifications TEXT;
    END IF;
    
    -- Add experience_years column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'employees' AND column_name = 'experience_years') THEN
        ALTER TABLE employees ADD COLUMN experience_years INTEGER DEFAULT 0;
    END IF;
    
    -- Add additional_info column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'employees' AND column_name = 'additional_info') THEN
        ALTER TABLE employees ADD COLUMN additional_info JSONB DEFAULT '{}';
    END IF;
END $$;

-- Fix 2: Add missing columns to users table if they don't exist
DO $$ 
BEGIN
    -- Add phone_number column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'phone_number') THEN
        ALTER TABLE users ADD COLUMN phone_number VARCHAR(20);
    END IF;
    
    -- Add phone column if it doesn't exist (some schemas use 'phone' instead of 'phone_number')
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'phone') THEN
        ALTER TABLE users ADD COLUMN phone VARCHAR(20);
    END IF;
    
    -- Add activation_status column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'activation_status') THEN
        ALTER TABLE users ADD COLUMN activation_status VARCHAR(20) DEFAULT 'active' 
            CHECK (activation_status IN ('active', 'inactive', 'suspended', 'pending'));
    END IF;
    
    -- Add profile_picture_url column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'profile_picture_url') THEN
        ALTER TABLE users ADD COLUMN profile_picture_url TEXT;
    END IF;
    
    -- Add user_type column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'user_type') THEN
        ALTER TABLE users ADD COLUMN user_type VARCHAR(50) DEFAULT 'school_user';
    END IF;
    
    -- Add status column if it doesn't exist (some schemas use 'status' instead of 'activation_status')
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'status') THEN
        ALTER TABLE users ADD COLUMN status VARCHAR(20) DEFAULT 'active';
    END IF;
END $$;

-- Fix 3: Create departments table if it doesn't exist
CREATE TABLE IF NOT EXISTS departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    
    -- Department Details
    name VARCHAR(100) NOT NULL,
    description TEXT,
    code VARCHAR(20),
    
    -- Department Head
    head_id UUID REFERENCES users(id),
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    
    -- Standard fields
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT unique_school_department_name UNIQUE (school_id, name)
);

-- Create indexes for departments
CREATE INDEX IF NOT EXISTS idx_departments_school ON departments(school_id);
CREATE INDEX IF NOT EXISTS idx_departments_active ON departments(is_active);
CREATE INDEX IF NOT EXISTS idx_departments_head ON departments(head_id);

-- Fix 4: Create appraisal_cycles table if it doesn't exist (MUST BE BEFORE performance_appraisals)
CREATE TABLE IF NOT EXISTS appraisal_cycles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    
    -- Cycle Details
    name VARCHAR(100) NOT NULL,
    year INTEGER NOT NULL,
    description TEXT,
    
    -- Cycle Period
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    
    -- Status
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'completed')),
    
    -- Standard fields
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT unique_school_cycle_year UNIQUE (school_id, year)
);

-- Create indexes for appraisal_cycles
CREATE INDEX IF NOT EXISTS idx_appraisal_cycles_school ON appraisal_cycles(school_id);
CREATE INDEX IF NOT EXISTS idx_appraisal_cycles_status ON appraisal_cycles(status);
CREATE INDEX IF NOT EXISTS idx_appraisal_cycles_year ON appraisal_cycles(year);

-- Fix 5: Create appraisal_templates table if it doesn't exist (MUST BE BEFORE performance_appraisals)
CREATE TABLE IF NOT EXISTS appraisal_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    
    -- Template Details
    name VARCHAR(100) NOT NULL,
    description TEXT,
    template_data JSONB NOT NULL DEFAULT '{}',
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    is_default BOOLEAN DEFAULT false,
    
    -- Standard fields
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT unique_school_template_name UNIQUE (school_id, name)
);

-- Create indexes for appraisal_templates
CREATE INDEX IF NOT EXISTS idx_appraisal_templates_school ON appraisal_templates(school_id);
CREATE INDEX IF NOT EXISTS idx_appraisal_templates_active ON appraisal_templates(is_active);

-- Fix 6: Create performance_appraisals table if it doesn't exist (NOW AFTER appraisal_cycles and appraisal_templates)
CREATE TABLE IF NOT EXISTS performance_appraisals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    
    -- Appraisal Details
    cycle_id UUID NOT NULL REFERENCES appraisal_cycles(id),
    employee_id UUID NOT NULL REFERENCES employees(id),
    template_id UUID REFERENCES appraisal_templates(id),
    
    -- Status and Progress
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    self_assessment_completed BOOLEAN DEFAULT false,
    supervisor_review_completed BOOLEAN DEFAULT false,
    peer_feedback_completed BOOLEAN DEFAULT false,
    
    -- Ratings and Scores
    overall_rating DECIMAL(3,2),
    ratings JSONB DEFAULT '{}',
    
    -- Dates
    due_date DATE,
    completed_date DATE,
    
    -- Initiator
    initiated_by UUID REFERENCES users(id),
    
    -- Standard fields
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT unique_employee_cycle UNIQUE (employee_id, cycle_id)
);

-- Create indexes for performance_appraisals
CREATE INDEX IF NOT EXISTS idx_performance_appraisals_school ON performance_appraisals(school_id);
CREATE INDEX IF NOT EXISTS idx_performance_appraisals_employee ON performance_appraisals(employee_id);
CREATE INDEX IF NOT EXISTS idx_performance_appraisals_cycle ON performance_appraisals(cycle_id);
CREATE INDEX IF NOT EXISTS idx_performance_appraisals_status ON performance_appraisals(status);

-- Fix 7: Create enrollments table if it doesn't exist (for parent-student relationships)
CREATE TABLE IF NOT EXISTS enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    parent_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Enrollment Details
    enrollment_date DATE DEFAULT CURRENT_DATE,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'withdrawn')),
    
    -- Standard fields
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT unique_student_parent UNIQUE (student_id, parent_id)
);

-- Create indexes for enrollments
CREATE INDEX IF NOT EXISTS idx_enrollments_school ON enrollments(school_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_student ON enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_parent ON enrollments(parent_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_status ON enrollments(status);

-- Create indexes for better performance on existing tables
CREATE INDEX IF NOT EXISTS idx_employees_school ON employees(school_id);
CREATE INDEX IF NOT EXISTS idx_employees_user ON employees(user_id);
CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(employment_status);
CREATE INDEX IF NOT EXISTS idx_employees_position ON employees(position);

CREATE INDEX IF NOT EXISTS idx_users_school ON users(school_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(activation_status);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

COMMENT ON TABLE departments IS 'School departments for organizational structure';
COMMENT ON TABLE performance_appraisals IS 'Employee performance appraisal records';
COMMENT ON TABLE appraisal_cycles IS 'Performance appraisal cycles';
COMMENT ON TABLE appraisal_templates IS 'Performance appraisal templates';
COMMENT ON TABLE enrollments IS 'Student-parent enrollment relationships';
