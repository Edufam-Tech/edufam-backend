-- ====================================
-- FIX DATABASE ERRORS
-- ====================================
-- This file fixes all the database schema issues causing API errors

-- Fix 1: Add missing columns to fee_assignments table (from add-financial-module.sql)
-- The newer schema from 02-fee-assignment-workflow.sql has more columns than the older one

DO $$ 
BEGIN
    -- Add assignment_name column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'fee_assignments' AND column_name = 'assignment_name') THEN
        ALTER TABLE fee_assignments ADD COLUMN assignment_name VARCHAR(255);
        UPDATE fee_assignments SET assignment_name = 'Fee Assignment ' || id::text WHERE assignment_name IS NULL;
        ALTER TABLE fee_assignments ALTER COLUMN assignment_name SET NOT NULL;
    END IF;

    -- Add assignment_code column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'fee_assignments' AND column_name = 'assignment_code') THEN
        ALTER TABLE fee_assignments ADD COLUMN assignment_code VARCHAR(50);
    END IF;

    -- Add assignment_type column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'fee_assignments' AND column_name = 'assignment_type') THEN
        ALTER TABLE fee_assignments ADD COLUMN assignment_type VARCHAR(50);
    END IF;

    -- Add curriculum_type column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'fee_assignments' AND column_name = 'curriculum_type') THEN
        ALTER TABLE fee_assignments ADD COLUMN curriculum_type VARCHAR(20);
    END IF;

    -- Add academic_year column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'fee_assignments' AND column_name = 'academic_year') THEN
        ALTER TABLE fee_assignments ADD COLUMN academic_year VARCHAR(20);
    END IF;

    -- Add academic_term column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'fee_assignments' AND column_name = 'academic_term') THEN
        ALTER TABLE fee_assignments ADD COLUMN academic_term VARCHAR(20);
    END IF;

    -- Add execution_status column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'fee_assignments' AND column_name = 'execution_status') THEN
        ALTER TABLE fee_assignments ADD COLUMN execution_status VARCHAR(20) DEFAULT 'pending';
    END IF;

    -- Add submitted_by column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'fee_assignments' AND column_name = 'submitted_by') THEN
        ALTER TABLE fee_assignments ADD COLUMN submitted_by UUID REFERENCES users(id);
    END IF;

    -- Add submitted_at column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'fee_assignments' AND column_name = 'submitted_at') THEN
        ALTER TABLE fee_assignments ADD COLUMN submitted_at TIMESTAMP;
    END IF;

    -- Add rejection_reason column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'fee_assignments' AND column_name = 'rejection_reason') THEN
        ALTER TABLE fee_assignments ADD COLUMN rejection_reason TEXT;
    END IF;

    -- Add rejection_details column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'fee_assignments' AND column_name = 'rejection_details') THEN
        ALTER TABLE fee_assignments ADD COLUMN rejection_details JSONB;
    END IF;

    -- Add updated_at column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'fee_assignments' AND column_name = 'updated_at') THEN
        ALTER TABLE fee_assignments ADD COLUMN updated_at TIMESTAMP DEFAULT NOW();
    END IF;
END $$;

-- Fix 2: Add missing columns to grades table
DO $$ 
BEGIN
    -- Add submitted_by column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'grades' AND column_name = 'submitted_by') THEN
        ALTER TABLE grades ADD COLUMN submitted_by UUID REFERENCES users(id);
    END IF;

    -- Add submitted_at column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'grades' AND column_name = 'submitted_at') THEN
        ALTER TABLE grades ADD COLUMN submitted_at TIMESTAMP;
    END IF;

    -- Add approved_by column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'grades' AND column_name = 'approved_by') THEN
        ALTER TABLE grades ADD COLUMN approved_by UUID REFERENCES users(id);
    END IF;

    -- Add approved_at column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'grades' AND column_name = 'approved_at') THEN
        ALTER TABLE grades ADD COLUMN approved_at TIMESTAMP;
    END IF;

    -- Add rejection_reason column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'grades' AND column_name = 'rejection_reason') THEN
        ALTER TABLE grades ADD COLUMN rejection_reason TEXT;
    END IF;

    -- Add updated_at column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'grades' AND column_name = 'updated_at') THEN
        ALTER TABLE grades ADD COLUMN updated_at TIMESTAMP DEFAULT NOW();
    END IF;
END $$;

-- Fix 3: Add missing columns to classes table
DO $$ 
BEGIN
    -- Add name column if it doesn't exist (some schemas use class_name)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'classes' AND column_name = 'name') THEN
        ALTER TABLE classes ADD COLUMN name VARCHAR(100);
        -- Copy data from class_name if it exists
        IF EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'classes' AND column_name = 'class_name') THEN
            UPDATE classes SET name = class_name WHERE name IS NULL;
        END IF;
        ALTER TABLE classes ALTER COLUMN name SET NOT NULL;
    END IF;
END $$;

-- Fix 4: Add missing columns to messages table
DO $$ 
BEGIN
    -- Add title column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'messages' AND column_name = 'title') THEN
        ALTER TABLE messages ADD COLUMN title VARCHAR(255);
        -- Set default title for existing messages
        UPDATE messages SET title = 'Message' WHERE title IS NULL;
        ALTER TABLE messages ALTER COLUMN title SET NOT NULL;
    END IF;
END $$;

-- Fix 5: Create missing tables

-- Create expense_requests table if it doesn't exist
CREATE TABLE IF NOT EXISTS expense_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    
    -- Request Details
    category VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    budget_line VARCHAR(100),
    vendor VARCHAR(255),
    justification TEXT,
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    
    -- Status and Approval
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
    requested_by UUID NOT NULL REFERENCES users(id),
    requested_at TIMESTAMP DEFAULT NOW(),
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP,
    rejected_by UUID REFERENCES users(id),
    rejected_at TIMESTAMP,
    rejection_reason TEXT,
    
    -- Expected Date
    expected_date DATE,
    
    -- Standard fields
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create transport_vehicles table if it doesn't exist
CREATE TABLE IF NOT EXISTS transport_vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    
    -- Vehicle Details
    vehicle_number VARCHAR(50) NOT NULL,
    vehicle_type VARCHAR(50) NOT NULL,
    capacity INTEGER NOT NULL,
    driver_id UUID REFERENCES users(id),
    route_id UUID,
    
    -- Status
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'inactive')),
    
    -- Standard fields
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create transport_routes table if it doesn't exist
CREATE TABLE IF NOT EXISTS transport_routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    
    -- Route Details
    route_name VARCHAR(100) NOT NULL,
    description TEXT,
    start_location VARCHAR(255),
    end_location VARCHAR(255),
    
    -- Status
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    
    -- Standard fields
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create teacher_classes table if it doesn't exist
CREATE TABLE IF NOT EXISTS teacher_classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES subjects(id),
    academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
    
    -- Assignment Details
    assignment_type VARCHAR(20) DEFAULT 'primary' CHECK (assignment_type IN ('primary', 'secondary', 'substitute')),
    is_active BOOLEAN DEFAULT true,
    
    -- Standard fields
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(teacher_id, class_id, subject_id, academic_year_id)
);

-- Create transport_vehicle_locations table if it doesn't exist
CREATE TABLE IF NOT EXISTS transport_vehicle_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id UUID NOT NULL REFERENCES transport_vehicles(id) ON DELETE CASCADE,
    
    -- Location Details
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    location_name VARCHAR(255),
    timestamp TIMESTAMP DEFAULT NOW(),
    
    -- Standard fields
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_expense_requests_school ON expense_requests(school_id);
CREATE INDEX IF NOT EXISTS idx_expense_requests_status ON expense_requests(status);
CREATE INDEX IF NOT EXISTS idx_expense_requests_category ON expense_requests(category);
CREATE INDEX IF NOT EXISTS idx_expense_requests_requested_by ON expense_requests(requested_by);
CREATE INDEX IF NOT EXISTS idx_expense_requests_created_at ON expense_requests(created_at);

CREATE INDEX IF NOT EXISTS idx_transport_vehicles_school ON transport_vehicles(school_id);
CREATE INDEX IF NOT EXISTS idx_transport_vehicles_driver ON transport_vehicles(driver_id);
CREATE INDEX IF NOT EXISTS idx_transport_vehicles_status ON transport_vehicles(status);

CREATE INDEX IF NOT EXISTS idx_transport_routes_school ON transport_routes(school_id);
CREATE INDEX IF NOT EXISTS idx_transport_routes_status ON transport_routes(status);

CREATE INDEX IF NOT EXISTS idx_teacher_classes_school ON teacher_classes(school_id);
CREATE INDEX IF NOT EXISTS idx_teacher_classes_teacher ON teacher_classes(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_classes_class ON teacher_classes(class_id);
CREATE INDEX IF NOT EXISTS idx_teacher_classes_subject ON teacher_classes(subject_id);
CREATE INDEX IF NOT EXISTS idx_teacher_classes_academic_year ON teacher_classes(academic_year_id);

CREATE INDEX IF NOT EXISTS idx_transport_vehicle_locations_vehicle ON transport_vehicle_locations(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_transport_vehicle_locations_timestamp ON transport_vehicle_locations(timestamp);

-- Add RLS policies
ALTER TABLE expense_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE transport_vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE transport_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE transport_vehicle_locations ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for expense_requests
CREATE POLICY IF NOT EXISTS expense_requests_school_policy ON expense_requests
    FOR ALL USING (school_id IN (
        SELECT school_id FROM users 
        WHERE id = current_setting('app.current_user_id')::UUID
    ));

-- Create RLS policies for transport_vehicles
CREATE POLICY IF NOT EXISTS transport_vehicles_school_policy ON transport_vehicles
    FOR ALL USING (school_id IN (
        SELECT school_id FROM users 
        WHERE id = current_setting('app.current_user_id')::UUID
    ));

-- Create RLS policies for transport_routes
CREATE POLICY IF NOT EXISTS transport_routes_school_policy ON transport_routes
    FOR ALL USING (school_id IN (
        SELECT school_id FROM users 
        WHERE id = current_setting('app.current_user_id')::UUID
    ));

-- Create RLS policies for teacher_classes
CREATE POLICY IF NOT EXISTS teacher_classes_school_policy ON teacher_classes
    FOR ALL USING (school_id IN (
        SELECT school_id FROM users 
        WHERE id = current_setting('app.current_user_id')::UUID
    ));

-- Create RLS policies for transport_vehicle_locations
CREATE POLICY IF NOT EXISTS transport_vehicle_locations_school_policy ON transport_vehicle_locations
    FOR ALL USING (vehicle_id IN (
        SELECT tv.id FROM transport_vehicles tv
        JOIN users u ON tv.school_id = u.school_id
        WHERE u.id = current_setting('app.current_user_id')::UUID
    ));

-- Add triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER IF NOT EXISTS update_expense_requests_updated_at
    BEFORE UPDATE ON expense_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER IF NOT EXISTS update_transport_vehicles_updated_at
    BEFORE UPDATE ON transport_vehicles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER IF NOT EXISTS update_transport_routes_updated_at
    BEFORE UPDATE ON transport_routes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER IF NOT EXISTS update_teacher_classes_updated_at
    BEFORE UPDATE ON teacher_classes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Update existing data to fix any NULL values
UPDATE fee_assignments SET assignment_name = 'Fee Assignment ' || id::text WHERE assignment_name IS NULL;
UPDATE messages SET title = 'Message' WHERE title IS NULL;

-- Add constraints if they don't exist
DO $$ 
BEGIN
    -- Add constraint for fee_assignments status if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints 
                   WHERE constraint_name = 'fee_assignments_status_check') THEN
        ALTER TABLE fee_assignments ADD CONSTRAINT fee_assignments_status_check 
        CHECK (status IN ('draft', 'submitted', 'approved', 'rejected', 'active', 'completed', 'cancelled'));
    END IF;

    -- Add constraint for grades status if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints 
                   WHERE constraint_name = 'grades_status_check') THEN
        ALTER TABLE grades ADD CONSTRAINT grades_status_check 
        CHECK (status IN ('draft', 'submitted', 'approved', 'rejected'));
    END IF;
END $$;

COMMENT ON TABLE expense_requests IS 'Expense request management for schools';
COMMENT ON TABLE transport_vehicles IS 'School transport vehicle management';
COMMENT ON TABLE transport_routes IS 'School transport route management';
COMMENT ON TABLE teacher_classes IS 'Teacher class assignments';
COMMENT ON TABLE transport_vehicle_locations IS 'Real-time vehicle location tracking';
