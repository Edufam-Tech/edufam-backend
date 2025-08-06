-- Transport Module Database Schema
-- This file contains all tables needed for the transport management system

-- Vehicles table (fleet management)
CREATE TABLE vehicles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    
    -- Vehicle Information
    registration_number VARCHAR(20) NOT NULL,
    make VARCHAR(100) NOT NULL,
    model VARCHAR(100) NOT NULL,
    year INTEGER NOT NULL,
    color VARCHAR(50),
    capacity INTEGER NOT NULL,
    vehicle_type VARCHAR(50) NOT NULL CHECK (vehicle_type IN ('bus', 'minibus', 'van', 'car')),
    
    -- Technical Details
    engine_number VARCHAR(50),
    chassis_number VARCHAR(50),
    fuel_type VARCHAR(20) CHECK (fuel_type IN ('petrol', 'diesel', 'electric', 'hybrid')),
    transmission VARCHAR(20) CHECK (transmission IN ('manual', 'automatic')),
    
    -- Status and Condition
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'retired', 'accident')),
    condition_rating INTEGER CHECK (condition_rating >= 1 AND condition_rating <= 5),
    
    -- Purchase Information
    purchase_date DATE,
    purchase_price DECIMAL(12,2),
    current_value DECIMAL(12,2),
    
    -- Standard fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    
    -- Constraints
    UNIQUE(school_id, registration_number)
);

-- Vehicle maintenance records
CREATE TABLE vehicle_maintenance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    
    -- Maintenance Details
    maintenance_type VARCHAR(50) NOT NULL CHECK (maintenance_type IN ('routine', 'repair', 'inspection', 'emergency')),
    service_provider VARCHAR(255),
    description TEXT NOT NULL,
    cost DECIMAL(10,2),
    
    -- Dates
    scheduled_date DATE,
    completed_date DATE,
    next_service_date DATE,
    
    -- Status
    status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
    
    -- Mileage
    mileage_at_service INTEGER,
    
    -- Standard fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id)
);

-- Vehicle insurance tracking
CREATE TABLE vehicle_insurance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    
    -- Insurance Details
    insurance_company VARCHAR(255) NOT NULL,
    policy_number VARCHAR(100) NOT NULL,
    policy_type VARCHAR(50) NOT NULL CHECK (policy_type IN ('comprehensive', 'third_party', 'commercial')),
    
    -- Coverage
    coverage_amount DECIMAL(12,2),
    premium_amount DECIMAL(10,2),
    
    -- Dates
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    renewal_date DATE,
    
    -- Status
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled', 'pending_renewal')),
    
    -- Standard fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id)
);

-- Drivers table
CREATE TABLE drivers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Personal Information
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(255),
    date_of_birth DATE,
    address TEXT,
    
    -- Employment Details
    employee_id VARCHAR(50),
    hire_date DATE,
    employment_status VARCHAR(20) DEFAULT 'active' CHECK (employment_status IN ('active', 'suspended', 'terminated', 'resigned')),
    
    -- Driving Information
    experience_years INTEGER,
    preferred_vehicle_types TEXT[], -- Array of vehicle types they can drive
    
    -- Standard fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id)
);

-- Driver licenses
CREATE TABLE driver_licenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    
    -- License Details
    license_number VARCHAR(50) NOT NULL,
    license_type VARCHAR(20) NOT NULL CHECK (license_type IN ('A', 'B', 'C', 'D', 'E', 'F')),
    issuing_authority VARCHAR(255),
    
    -- Dates
    issue_date DATE NOT NULL,
    expiry_date DATE NOT NULL,
    renewal_date DATE,
    
    -- Status
    status VARCHAR(20) DEFAULT 'valid' CHECK (status IN ('valid', 'expired', 'suspended', 'revoked')),
    
    -- Standard fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id)
);

-- Transport routes
CREATE TABLE routes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    
    -- Route Information
    route_name VARCHAR(255) NOT NULL,
    route_code VARCHAR(20) NOT NULL,
    description TEXT,
    
    -- Route Details
    total_distance DECIMAL(8,2), -- in kilometers
    estimated_duration INTEGER, -- in minutes
    capacity INTEGER NOT NULL,
    
    -- Timing
    departure_time TIME NOT NULL,
    arrival_time TIME NOT NULL,
    
    -- Status
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    
    -- Standard fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    
    -- Constraints
    UNIQUE(school_id, route_code)
);

-- Route stops (pickup points)
CREATE TABLE route_stops (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    route_id UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    
    -- Stop Information
    stop_name VARCHAR(255) NOT NULL,
    stop_code VARCHAR(20),
    address TEXT,
    coordinates POINT, -- GPS coordinates
    
    -- Stop Details
    stop_order INTEGER NOT NULL, -- Order in the route
    pickup_time TIME,
    dropoff_time TIME,
    
    -- Standard fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id)
);

-- Student transport assignments
CREATE TABLE student_transport (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    route_id UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    
    -- Assignment Details
    pickup_stop_id UUID REFERENCES route_stops(id),
    dropoff_stop_id UUID REFERENCES route_stops(id),
    
    -- Status
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'cancelled')),
    
    -- Dates
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE,
    
    -- Standard fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    
    -- Constraints
    UNIQUE(student_id, route_id, start_date)
);

-- Transport fees
CREATE TABLE transport_fees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    
    -- Fee Structure
    fee_name VARCHAR(255) NOT NULL,
    route_id UUID REFERENCES routes(id) ON DELETE CASCADE, -- NULL for general fees
    fee_type VARCHAR(20) NOT NULL CHECK (fee_type IN ('monthly', 'termly', 'yearly', 'one_time')),
    
    -- Amount
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'KES',
    
    -- Applicability
    is_mandatory BOOLEAN DEFAULT false,
    applies_to_all_routes BOOLEAN DEFAULT false,
    
    -- Status
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    
    -- Standard fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id)
);

-- Transport attendance
CREATE TABLE transport_attendance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    route_id UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    
    -- Attendance Details
    attendance_date DATE NOT NULL,
    attendance_status VARCHAR(20) NOT NULL CHECK (attendance_status IN ('present', 'absent', 'late', 'excused')),
    
    -- Timing
    pickup_time TIME,
    dropoff_time TIME,
    
    -- Notes
    notes TEXT,
    
    -- Standard fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    
    -- Constraints
    UNIQUE(student_id, route_id, attendance_date)
);

-- Fuel records
CREATE TABLE fuel_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    
    -- Fuel Details
    fuel_date DATE NOT NULL,
    fuel_type VARCHAR(20) NOT NULL CHECK (fuel_type IN ('petrol', 'diesel', 'electric')),
    quantity DECIMAL(8,2) NOT NULL, -- in liters or kWh
    unit_price DECIMAL(8,2) NOT NULL,
    total_cost DECIMAL(10,2) NOT NULL,
    
    -- Station Information
    station_name VARCHAR(255),
    station_location TEXT,
    
    -- Vehicle Information
    mileage_before INTEGER,
    mileage_after INTEGER,
    
    -- Standard fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id)
);

-- Transport incidents
CREATE TABLE transport_incidents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    
    -- Incident Details
    incident_date DATE NOT NULL,
    incident_time TIME,
    incident_type VARCHAR(50) NOT NULL CHECK (incident_type IN ('accident', 'breakdown', 'delay', 'discipline', 'medical', 'other')),
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    
    -- Location
    location TEXT,
    coordinates POINT,
    
    -- Involved Parties
    vehicle_id UUID REFERENCES vehicles(id),
    driver_id UUID REFERENCES drivers(id),
    student_ids UUID[], -- Array of student IDs involved
    
    -- Description
    description TEXT NOT NULL,
    actions_taken TEXT,
    
    -- Reporting
    reported_by UUID REFERENCES users(id),
    reported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Follow-up
    investigation_status VARCHAR(20) DEFAULT 'pending' CHECK (investigation_status IN ('pending', 'investigating', 'resolved', 'closed')),
    resolution TEXT,
    
    -- Standard fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id)
);

-- Create indexes for better performance
CREATE INDEX idx_vehicles_school ON vehicles(school_id);
CREATE INDEX idx_vehicles_status ON vehicles(status);
CREATE INDEX idx_vehicles_registration ON vehicles(registration_number);

CREATE INDEX idx_vehicle_maintenance_vehicle ON vehicle_maintenance(vehicle_id);
CREATE INDEX idx_vehicle_maintenance_school ON vehicle_maintenance(school_id);
CREATE INDEX idx_vehicle_maintenance_status ON vehicle_maintenance(status);
CREATE INDEX idx_vehicle_maintenance_date ON vehicle_maintenance(scheduled_date);

CREATE INDEX idx_vehicle_insurance_vehicle ON vehicle_insurance(vehicle_id);
CREATE INDEX idx_vehicle_insurance_school ON vehicle_insurance(school_id);
CREATE INDEX idx_vehicle_insurance_status ON vehicle_insurance(status);
CREATE INDEX idx_vehicle_insurance_dates ON vehicle_insurance(start_date, end_date);

CREATE INDEX idx_drivers_school ON drivers(school_id);
CREATE INDEX idx_drivers_user ON drivers(user_id);
CREATE INDEX idx_drivers_status ON drivers(employment_status);

CREATE INDEX idx_driver_licenses_driver ON driver_licenses(driver_id);
CREATE INDEX idx_driver_licenses_school ON driver_licenses(school_id);
CREATE INDEX idx_driver_licenses_status ON driver_licenses(status);
CREATE INDEX idx_driver_licenses_expiry ON driver_licenses(expiry_date);

CREATE INDEX idx_routes_school ON routes(school_id);
CREATE INDEX idx_routes_status ON routes(status);
CREATE INDEX idx_routes_code ON routes(route_code);

CREATE INDEX idx_route_stops_route ON route_stops(route_id);
CREATE INDEX idx_route_stops_school ON route_stops(school_id);
CREATE INDEX idx_route_stops_order ON route_stops(stop_order);

CREATE INDEX idx_student_transport_student ON student_transport(student_id);
CREATE INDEX idx_student_transport_route ON student_transport(route_id);
CREATE INDEX idx_student_transport_school ON student_transport(school_id);
CREATE INDEX idx_student_transport_status ON student_transport(status);

CREATE INDEX idx_transport_fees_school ON transport_fees(school_id);
CREATE INDEX idx_transport_fees_route ON transport_fees(route_id);
CREATE INDEX idx_transport_fees_status ON transport_fees(status);

CREATE INDEX idx_transport_attendance_student ON transport_attendance(student_id);
CREATE INDEX idx_transport_attendance_route ON transport_attendance(route_id);
CREATE INDEX idx_transport_attendance_school ON transport_attendance(school_id);
CREATE INDEX idx_transport_attendance_date ON transport_attendance(attendance_date);

CREATE INDEX idx_fuel_records_vehicle ON fuel_records(vehicle_id);
CREATE INDEX idx_fuel_records_school ON fuel_records(school_id);
CREATE INDEX idx_fuel_records_date ON fuel_records(fuel_date);

CREATE INDEX idx_transport_incidents_school ON transport_incidents(school_id);
CREATE INDEX idx_transport_incidents_date ON transport_incidents(incident_date);
CREATE INDEX idx_transport_incidents_type ON transport_incidents(incident_type);
CREATE INDEX idx_transport_incidents_severity ON transport_incidents(severity);

-- Add triggers for updated_at
CREATE TRIGGER update_vehicles_updated_at BEFORE UPDATE ON vehicles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_vehicle_maintenance_updated_at BEFORE UPDATE ON vehicle_maintenance FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_vehicle_insurance_updated_at BEFORE UPDATE ON vehicle_insurance FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_drivers_updated_at BEFORE UPDATE ON drivers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_driver_licenses_updated_at BEFORE UPDATE ON driver_licenses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_routes_updated_at BEFORE UPDATE ON routes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_route_stops_updated_at BEFORE UPDATE ON route_stops FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_student_transport_updated_at BEFORE UPDATE ON student_transport FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_transport_fees_updated_at BEFORE UPDATE ON transport_fees FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_transport_attendance_updated_at BEFORE UPDATE ON transport_attendance FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_fuel_records_updated_at BEFORE UPDATE ON fuel_records FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_transport_incidents_updated_at BEFORE UPDATE ON transport_incidents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column(); 