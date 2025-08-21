-- ====================================
-- FIX MISSING TABLES AND COLUMNS
-- ====================================
-- This file fixes the database schema issues causing API errors

-- Fix 1: Create expense_requests table (missing table causing error)
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

-- Create indexes for expense_requests
CREATE INDEX IF NOT EXISTS idx_expense_requests_school ON expense_requests(school_id);
CREATE INDEX IF NOT EXISTS idx_expense_requests_status ON expense_requests(status);
CREATE INDEX IF NOT EXISTS idx_expense_requests_category ON expense_requests(category);
CREATE INDEX IF NOT EXISTS idx_expense_requests_requested_by ON expense_requests(requested_by);
CREATE INDEX IF NOT EXISTS idx_expense_requests_created_at ON expense_requests(created_at);

-- Fix 2: Create transport_vehicles table (missing table causing error)
CREATE TABLE IF NOT EXISTS transport_vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    
    -- Vehicle Details
    vehicle_number VARCHAR(20) NOT NULL,
    registration_number VARCHAR(20) NOT NULL,
    vehicle_type VARCHAR(50) NOT NULL CHECK (vehicle_type IN ('bus', 'van', 'car', 'truck')),
    make VARCHAR(100),
    model VARCHAR(100),
    year INTEGER,
    capacity INTEGER NOT NULL,
    color VARCHAR(50),
    
    -- Insurance and Registration
    insurance_number VARCHAR(50),
    insurance_expiry DATE,
    registration_expiry DATE,
    inspection_date DATE,
    next_inspection_date DATE,
    
    -- Driver Assignment
    driver_id UUID REFERENCES users(id),
    assigned_at TIMESTAMP,
    
    -- Status
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'inactive', 'retired')),
    is_available BOOLEAN DEFAULT true,
    
    -- GPS Tracking
    gps_device_id VARCHAR(100),
    last_location_lat DECIMAL(10, 8),
    last_location_lng DECIMAL(11, 8),
    last_location_updated TIMESTAMP,
    
    -- Standard fields
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT unique_school_vehicle_number UNIQUE (school_id, vehicle_number),
    CONSTRAINT unique_registration_number UNIQUE (registration_number)
);

-- Create indexes for transport_vehicles
CREATE INDEX IF NOT EXISTS idx_transport_vehicles_school ON transport_vehicles(school_id);
CREATE INDEX IF NOT EXISTS idx_transport_vehicles_status ON transport_vehicles(status);
CREATE INDEX IF NOT EXISTS idx_transport_vehicles_driver ON transport_vehicles(driver_id);
CREATE INDEX IF NOT EXISTS idx_transport_vehicles_available ON transport_vehicles(is_available);

-- Fix 3: Add missing columns to students table if they don't exist
DO $$ 
BEGIN
    -- Add class_id column if it doesn't exist (some schemas might use different column names)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'students' AND column_name = 'class_id') THEN
        ALTER TABLE students ADD COLUMN class_id UUID REFERENCES classes(id) ON DELETE SET NULL;
    END IF;
    
    -- Add grade_level column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'students' AND column_name = 'grade_level') THEN
        ALTER TABLE students ADD COLUMN grade_level VARCHAR(20);
    END IF;
END $$;

-- Fix 4: Add missing columns to fee_assignments table if they don't exist
DO $$ 
BEGIN
    -- Add execution_status column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'fee_assignments' AND column_name = 'execution_status') THEN
        ALTER TABLE fee_assignments ADD COLUMN execution_status VARCHAR(20) DEFAULT 'pending' 
            CHECK (execution_status IN ('pending', 'processing', 'completed', 'failed', 'partial'));
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
    
    -- Add rejected_by column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'fee_assignments' AND column_name = 'rejected_by') THEN
        ALTER TABLE fee_assignments ADD COLUMN rejected_by UUID REFERENCES users(id);
    END IF;
    
    -- Add rejected_at column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'fee_assignments' AND column_name = 'rejected_at') THEN
        ALTER TABLE fee_assignments ADD COLUMN rejected_at TIMESTAMP;
    END IF;
    
    -- Add rejection_reason column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'fee_assignments' AND column_name = 'rejection_reason') THEN
        ALTER TABLE fee_assignments ADD COLUMN rejection_reason TEXT;
    END IF;
END $$;

-- Fix 5: Create transport_routes table if it doesn't exist
CREATE TABLE IF NOT EXISTS transport_routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    
    -- Route Details
    route_name VARCHAR(100) NOT NULL,
    route_code VARCHAR(20),
    description TEXT,
    
    -- Route Information
    stops JSONB DEFAULT '[]', -- Array of stop locations
    distance_km DECIMAL(8,2),
    estimated_duration_minutes INTEGER,
    
    -- Schedule
    departure_time TIME,
    arrival_time TIME,
    days_of_operation VARCHAR(50), -- "monday,tuesday,wednesday"
    
    -- Pricing
    monthly_fee DECIMAL(10,2),
    term_fee DECIMAL(10,2),
    annual_fee DECIMAL(10,2),
    
    -- Vehicle Assignment
    assigned_vehicle_id UUID REFERENCES transport_vehicles(id),
    assigned_driver_id UUID REFERENCES users(id),
    
    -- Status
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    is_available BOOLEAN DEFAULT true,
    
    -- Standard fields
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT unique_school_route_name UNIQUE (school_id, route_name)
);

-- Create indexes for transport_routes
CREATE INDEX IF NOT EXISTS idx_transport_routes_school ON transport_routes(school_id);
CREATE INDEX IF NOT EXISTS idx_transport_routes_status ON transport_routes(status);
CREATE INDEX IF NOT EXISTS idx_transport_routes_vehicle ON transport_routes(assigned_vehicle_id);
CREATE INDEX IF NOT EXISTS idx_transport_routes_driver ON transport_routes(assigned_driver_id);

-- Fix 6: Create transport_student_assignments table if it doesn't exist
CREATE TABLE IF NOT EXISTS transport_student_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    route_id UUID NOT NULL REFERENCES transport_routes(id) ON DELETE CASCADE,
    
    -- Assignment Details
    stop_id UUID, -- Reference to a specific stop in the route
    pickup_time TIME,
    drop_time TIME,
    monthly_fee DECIMAL(10,2),
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    effective_date DATE DEFAULT CURRENT_DATE,
    end_date DATE,
    
    -- Standard fields
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT unique_student_route UNIQUE (student_id, route_id, effective_date)
);

-- Create indexes for transport_student_assignments
CREATE INDEX IF NOT EXISTS idx_transport_student_assignments_school ON transport_student_assignments(school_id);
CREATE INDEX IF NOT EXISTS idx_transport_student_assignments_student ON transport_student_assignments(student_id);
CREATE INDEX IF NOT EXISTS idx_transport_student_assignments_route ON transport_student_assignments(route_id);
CREATE INDEX IF NOT EXISTS idx_transport_student_assignments_active ON transport_student_assignments(is_active);

-- Fix 7: Add missing columns to invoices table if they don't exist
DO $$ 
BEGIN
    -- Add academic_year_id column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'invoices' AND column_name = 'academic_year_id') THEN
        ALTER TABLE invoices ADD COLUMN academic_year_id UUID REFERENCES academic_years(id);
    END IF;
    
    -- Add academic_term_id column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'invoices' AND column_name = 'academic_term_id') THEN
        ALTER TABLE invoices ADD COLUMN academic_term_id UUID REFERENCES academic_terms(id);
    END IF;
    
    -- Add balance_due column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'invoices' AND column_name = 'balance_due') THEN
        ALTER TABLE invoices ADD COLUMN balance_due DECIMAL(12,2) NOT NULL DEFAULT 0.00;
    END IF;
    
    -- Add amount_paid column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'invoices' AND column_name = 'amount_paid') THEN
        ALTER TABLE invoices ADD COLUMN amount_paid DECIMAL(12,2) DEFAULT 0.00;
    END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_invoices_school_student ON invoices(school_id, student_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_invoices_academic_year ON invoices(academic_year_id);

-- Fix 8: Ensure fee_assignments has all required columns
DO $$ 
BEGIN
    -- Add approval_status column if it doesn't exist (for backward compatibility)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'fee_assignments' AND column_name = 'approval_status') THEN
        ALTER TABLE fee_assignments ADD COLUMN approval_status VARCHAR(20) DEFAULT 'pending' 
            CHECK (approval_status IN ('pending', 'approved', 'rejected'));
    END IF;
END $$;

-- Create indexes for fee_assignments
CREATE INDEX IF NOT EXISTS idx_fee_assignments_school ON fee_assignments(school_id);
CREATE INDEX IF NOT EXISTS idx_fee_assignments_status ON fee_assignments(status);
CREATE INDEX IF NOT EXISTS idx_fee_assignments_approval_status ON fee_assignments(approval_status);
CREATE INDEX IF NOT EXISTS idx_fee_assignments_created_by ON fee_assignments(created_by);
CREATE INDEX IF NOT EXISTS idx_fee_assignments_created_at ON fee_assignments(created_at);

COMMENT ON TABLE expense_requests IS 'Expense request management for schools';
COMMENT ON TABLE transport_vehicles IS 'School transport vehicle management';
COMMENT ON TABLE transport_routes IS 'School transport route management';
COMMENT ON TABLE transport_student_assignments IS 'Student assignments to transport routes';

-- Fix missing tables that are causing database errors
-- This migration adds tables that are referenced in the code but don't exist

-- Create school_directors table if it doesn't exist
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'school_directors'
  ) THEN
    CREATE TABLE school_directors (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      director_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
      assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_school_directors_unique ON school_directors(director_id, school_id);
    CREATE INDEX IF NOT EXISTS idx_school_directors_school ON school_directors(school_id);
  END IF;
END $$;

-- Create salary_structures table if it doesn't exist
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'salary_structures'
  ) THEN
    CREATE TABLE salary_structures (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
      position_title VARCHAR(100) NOT NULL,
      grade VARCHAR(50) NOT NULL,
      basic_salary DECIMAL(12,2) NOT NULL,
      allowances JSONB DEFAULT '{}',
      deductions JSONB DEFAULT '{}',
      currency_code VARCHAR(3) DEFAULT 'KES',
      effective_date DATE NOT NULL,
      is_active BOOLEAN DEFAULT true,
      created_by UUID NOT NULL REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_salary_structures_school ON salary_structures(school_id);
    CREATE INDEX IF NOT EXISTS idx_salary_structures_active ON salary_structures(is_active);
    CREATE INDEX IF NOT EXISTS idx_salary_structures_position ON salary_structures(position_title);
  END IF;
END $$;

-- Add RLS policies
ALTER TABLE school_directors ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_structures ENABLE ROW LEVEL SECURITY;

-- Create policies for school_directors
CREATE POLICY IF NOT EXISTS school_directors_school_policy ON school_directors
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

-- Create policies for salary_structures
CREATE POLICY IF NOT EXISTS salary_structures_school_policy ON salary_structures
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
