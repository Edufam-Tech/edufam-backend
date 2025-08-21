-- ====================================
-- FIX DATABASE ERRORS - SIMPLE VERSION
-- ====================================
-- This file fixes the most critical database schema issues causing API errors

-- Fix 1: Add missing columns to fee_assignments table
ALTER TABLE fee_assignments ADD COLUMN IF NOT EXISTS assignment_name VARCHAR(255);
ALTER TABLE fee_assignments ADD COLUMN IF NOT EXISTS assignment_code VARCHAR(50);
ALTER TABLE fee_assignments ADD COLUMN IF NOT EXISTS assignment_type VARCHAR(50);
ALTER TABLE fee_assignments ADD COLUMN IF NOT EXISTS curriculum_type VARCHAR(20);
ALTER TABLE fee_assignments ADD COLUMN IF NOT EXISTS academic_year VARCHAR(20);
ALTER TABLE fee_assignments ADD COLUMN IF NOT EXISTS academic_term VARCHAR(20);
ALTER TABLE fee_assignments ADD COLUMN IF NOT EXISTS execution_status VARCHAR(20) DEFAULT 'pending';
ALTER TABLE fee_assignments ADD COLUMN IF NOT EXISTS submitted_by UUID REFERENCES users(id);
ALTER TABLE fee_assignments ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP;
ALTER TABLE fee_assignments ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE fee_assignments ADD COLUMN IF NOT EXISTS rejection_details JSONB;
ALTER TABLE fee_assignments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- Fix 2: Add missing columns to grades table
ALTER TABLE grades ADD COLUMN IF NOT EXISTS submitted_by UUID REFERENCES users(id);
ALTER TABLE grades ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP;
ALTER TABLE grades ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id);
ALTER TABLE grades ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP;
ALTER TABLE grades ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE grades ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- Fix 3: Add missing columns to classes table
ALTER TABLE classes ADD COLUMN IF NOT EXISTS name VARCHAR(100);

-- Fix 4: Add missing columns to messages table
ALTER TABLE messages ADD COLUMN IF NOT EXISTS title VARCHAR(255);

-- Fix 5: Create missing tables
CREATE TABLE IF NOT EXISTS expense_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    category VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    budget_line VARCHAR(100),
    vendor VARCHAR(255),
    justification TEXT,
    priority VARCHAR(20) DEFAULT 'medium',
    status VARCHAR(20) DEFAULT 'pending',
    requested_by UUID NOT NULL REFERENCES users(id),
    requested_at TIMESTAMP DEFAULT NOW(),
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP,
    rejected_by UUID REFERENCES users(id),
    rejected_at TIMESTAMP,
    rejection_reason TEXT,
    expected_date DATE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transport_vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    vehicle_number VARCHAR(50) NOT NULL,
    vehicle_type VARCHAR(50) NOT NULL,
    capacity INTEGER NOT NULL,
    driver_id UUID REFERENCES users(id),
    route_id UUID,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transport_routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    route_name VARCHAR(100) NOT NULL,
    description TEXT,
    start_location VARCHAR(255),
    end_location VARCHAR(255),
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS teacher_classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES subjects(id),
    academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
    assignment_type VARCHAR(20) DEFAULT 'primary',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transport_vehicle_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id UUID NOT NULL REFERENCES transport_vehicles(id) ON DELETE CASCADE,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    location_name VARCHAR(255),
    timestamp TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_expense_requests_school ON expense_requests(school_id);
CREATE INDEX IF NOT EXISTS idx_transport_vehicles_school ON transport_vehicles(school_id);
CREATE INDEX IF NOT EXISTS idx_transport_routes_school ON transport_routes(school_id);
CREATE INDEX IF NOT EXISTS idx_teacher_classes_school ON teacher_classes(school_id);
CREATE INDEX IF NOT EXISTS idx_transport_vehicle_locations_vehicle ON transport_vehicle_locations(vehicle_id);

-- Update existing data to fix any NULL values
UPDATE fee_assignments SET assignment_name = 'Fee Assignment ' || id::text WHERE assignment_name IS NULL;
UPDATE messages SET title = 'Message' WHERE title IS NULL;

-- Add RLS policies
ALTER TABLE expense_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE transport_vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE transport_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE transport_vehicle_locations ENABLE ROW LEVEL SECURITY;
