const { Pool } = require('pg');

/**
 * Create Admin HR Tables Directly
 */

async function createAdminHrTables() {
  console.log('🚀 Creating Admin Platform HR Tables Directly');
  console.log('============================================');

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/edufam_db'
  });

  try {
    console.log('🔌 Testing database connection...');
    const client = await pool.connect();
    console.log('✅ Database connection successful');
    client.release();

    // Create tables one by one
    console.log('\n📄 Creating Admin HR tables...');

    // 1. Admin Departments
    await pool.query(`
      CREATE TABLE IF NOT EXISTS admin_departments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        department_name VARCHAR(100) UNIQUE NOT NULL,
        department_code VARCHAR(20) UNIQUE NOT NULL,
        description TEXT,
        head_of_department UUID REFERENCES users(id),
        parent_department_id UUID REFERENCES admin_departments(id),
        annual_budget DECIMAL(15,2),
        current_budget_used DECIMAL(15,2) DEFAULT 0,
        cost_center_code VARCHAR(50),
        office_location VARCHAR(255),
        contact_email VARCHAR(255),
        contact_phone VARCHAR(20),
        is_active BOOLEAN DEFAULT true,
        established_date DATE DEFAULT CURRENT_DATE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        created_by UUID NOT NULL REFERENCES users(id)
      )
    `);
    console.log('   ✅ admin_departments table created');

    // 2. Admin Employees
    await pool.query(`
      CREATE TABLE IF NOT EXISTS admin_employees (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        employee_id VARCHAR(20) UNIQUE NOT NULL,
        employee_type VARCHAR(30) NOT NULL CHECK (employee_type IN ('permanent', 'contract', 'intern', 'consultant', 'part_time')),
        job_title VARCHAR(100) NOT NULL,
        job_level VARCHAR(20),
        department_id UUID NOT NULL REFERENCES admin_departments(id),
        hire_date DATE NOT NULL,
        probation_end_date DATE,
        contract_start_date DATE,
        contract_end_date DATE,
        base_salary DECIMAL(12,2),
        currency VARCHAR(3) DEFAULT 'KES',
        payment_frequency VARCHAR(20) DEFAULT 'monthly',
        overtime_rate DECIMAL(8,2),
        health_insurance BOOLEAN DEFAULT false,
        life_insurance BOOLEAN DEFAULT false,
        pension_contribution DECIMAL(5,2),
        annual_leave_days INTEGER DEFAULT 21,
        sick_leave_days INTEGER DEFAULT 14,
        performance_rating DECIMAL(3,2),
        last_review_date DATE,
        next_review_date DATE,
        training_budget DECIMAL(10,2),
        work_location VARCHAR(50),
        office_location VARCHAR(255),
        reporting_manager_id UUID REFERENCES admin_employees(id),
        employment_status VARCHAR(20) DEFAULT 'active' CHECK (employment_status IN ('active', 'on_leave', 'suspended', 'terminated', 'resigned')),
        termination_date DATE,
        termination_reason TEXT,
        emergency_contact_name VARCHAR(255),
        emergency_contact_phone VARCHAR(20),
        emergency_contact_relationship VARCHAR(50),
        system_access_level VARCHAR(20) DEFAULT 'standard' CHECK (system_access_level IN ('basic', 'standard', 'advanced', 'admin', 'super_admin')),
        access_granted_date DATE DEFAULT CURRENT_DATE,
        access_expires_date DATE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        created_by UUID NOT NULL REFERENCES users(id)
      )
    `);
    console.log('   ✅ admin_employees table created');

    // 3. Employee Leaves
    await pool.query(`
      CREATE TABLE IF NOT EXISTS admin_employee_leaves (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_id UUID NOT NULL REFERENCES admin_employees(id) ON DELETE CASCADE,
        leave_type VARCHAR(30) NOT NULL CHECK (leave_type IN ('annual', 'sick', 'maternity', 'paternity', 'bereavement', 'study', 'unpaid', 'emergency')),
        leave_reason TEXT,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        total_days INTEGER NOT NULL,
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
        requested_by UUID NOT NULL REFERENCES users(id),
        approved_by UUID REFERENCES users(id),
        approved_at TIMESTAMP,
        rejection_reason TEXT,
        coverage_arrangement TEXT,
        handover_completed BOOLEAN DEFAULT false,
        payroll_adjustment BOOLEAN DEFAULT false,
        deducted_from_annual BOOLEAN DEFAULT true,
        emergency_reachable BOOLEAN DEFAULT true,
        contact_during_leave VARCHAR(20),
        supporting_documents TEXT[],
        medical_certificate_required BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('   ✅ admin_employee_leaves table created');

    // 4. Trip Programs
    await pool.query(`
      CREATE TABLE IF NOT EXISTS admin_trip_programs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        program_name VARCHAR(200) NOT NULL,
        program_code VARCHAR(20) UNIQUE NOT NULL,
        program_type VARCHAR(30) NOT NULL CHECK (program_type IN ('educational', 'cultural', 'adventure', 'leadership', 'skills_development', 'exchange')),
        target_curriculum VARCHAR(20)[],
        learning_objectives TEXT[],
        skills_developed TEXT[],
        subject_areas VARCHAR(50)[],
        educational_value_score INTEGER CHECK (educational_value_score >= 1 AND educational_value_score <= 10),
        destination_country VARCHAR(100) NOT NULL,
        destination_city VARCHAR(100) NOT NULL,
        destinations TEXT[],
        duration_days INTEGER NOT NULL,
        max_participants INTEGER NOT NULL,
        min_participants INTEGER DEFAULT 10,
        min_age INTEGER,
        max_age INTEGER,
        target_grades VARCHAR(10)[],
        prerequisite_requirements TEXT,
        base_cost DECIMAL(12,2) NOT NULL,
        currency VARCHAR(3) DEFAULT 'KES',
        cost_includes TEXT[],
        cost_excludes TEXT[],
        payment_plan_available BOOLEAN DEFAULT true,
        early_bird_discount DECIMAL(5,2),
        group_discount_threshold INTEGER DEFAULT 20,
        group_discount_rate DECIMAL(5,2),
        departure_location VARCHAR(255),
        transportation_mode VARCHAR(50)[],
        accommodation_type VARCHAR(50),
        meal_plan VARCHAR(50),
        safety_rating VARCHAR(20) CHECK (safety_rating IN ('low_risk', 'medium_risk', 'high_risk')),
        insurance_required BOOLEAN DEFAULT true,
        passport_required BOOLEAN DEFAULT true,
        visa_required BOOLEAN DEFAULT false,
        vaccination_requirements TEXT[],
        medical_requirements TEXT,
        trip_leader_id UUID REFERENCES admin_employees(id),
        required_chaperones INTEGER DEFAULT 2,
        student_to_chaperone_ratio VARCHAR(10) DEFAULT '10:1',
        program_status VARCHAR(20) DEFAULT 'draft' CHECK (program_status IN ('draft', 'published', 'open_registration', 'closed', 'completed', 'cancelled')),
        registration_opens DATE,
        registration_closes DATE,
        trip_start_date DATE,
        trip_end_date DATE,
        featured_image_url VARCHAR(500),
        gallery_images TEXT[],
        promotional_video_url VARCHAR(500),
        marketing_description TEXT,
        highlights TEXT[],
        partner_organizations JSONB,
        local_contacts JSONB,
        average_rating DECIMAL(3,2),
        total_reviews INTEGER DEFAULT 0,
        recommendation_score INTEGER,
        risk_assessment_completed BOOLEAN DEFAULT false,
        risk_assessment_date DATE,
        insurance_coverage_details TEXT,
        emergency_procedures TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        created_by UUID NOT NULL REFERENCES users(id)
      )
    `);
    console.log('   ✅ admin_trip_programs table created');

    // 5. Trip Registrations
    await pool.query(`
      CREATE TABLE IF NOT EXISTS admin_trip_registrations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        trip_program_id UUID NOT NULL REFERENCES admin_trip_programs(id) ON DELETE CASCADE,
        student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        registration_date TIMESTAMP DEFAULT NOW(),
        registration_status VARCHAR(20) DEFAULT 'pending' CHECK (registration_status IN ('pending', 'confirmed', 'waitlisted', 'cancelled', 'completed')),
        parent_guardian_id UUID REFERENCES users(id),
        consent_given BOOLEAN DEFAULT false,
        consent_date TIMESTAMP,
        medical_consent BOOLEAN DEFAULT false,
        photo_consent BOOLEAN DEFAULT false,
        total_amount DECIMAL(12,2) NOT NULL,
        amount_paid DECIMAL(12,2) DEFAULT 0,
        payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'partial', 'completed', 'refunded')),
        payment_method VARCHAR(30),
        payment_plan JSONB,
        medical_conditions TEXT,
        dietary_restrictions TEXT,
        special_needs TEXT,
        emergency_medication TEXT,
        passport_number VARCHAR(50),
        passport_expiry DATE,
        visa_status VARCHAR(20) DEFAULT 'not_required' CHECK (visa_status IN ('not_required', 'pending', 'approved', 'rejected')),
        insurance_policy_number VARCHAR(100),
        preferred_contact_method VARCHAR(20) DEFAULT 'email' CHECK (preferred_contact_method IN ('email', 'sms', 'phone', 'whatsapp')),
        emergency_contact_abroad VARCHAR(255),
        room_preference VARCHAR(30),
        roommate_request VARCHAR(255),
        special_requests TEXT,
        cancellation_date TIMESTAMP,
        cancellation_reason TEXT,
        refund_amount DECIMAL(12,2),
        refund_processed BOOLEAN DEFAULT false,
        trip_rating INTEGER CHECK (trip_rating >= 1 AND trip_rating <= 5),
        trip_review TEXT,
        would_recommend BOOLEAN,
        review_date TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('   ✅ admin_trip_registrations table created');

    // 6. Employee Training
    await pool.query(`
      CREATE TABLE IF NOT EXISTS admin_employee_training (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_id UUID NOT NULL REFERENCES admin_employees(id) ON DELETE CASCADE,
        training_title VARCHAR(200) NOT NULL,
        training_type VARCHAR(30) NOT NULL CHECK (training_type IN ('orientation', 'skills', 'compliance', 'leadership', 'technical', 'soft_skills', 'certification')),
        training_provider VARCHAR(255),
        training_mode VARCHAR(20) CHECK (training_mode IN ('online', 'in_person', 'hybrid', 'self_paced')),
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        duration_hours INTEGER,
        training_cost DECIMAL(10,2),
        approved_budget DECIMAL(10,2),
        cost_center VARCHAR(50),
        completion_status VARCHAR(20) DEFAULT 'enrolled' CHECK (completion_status IN ('enrolled', 'in_progress', 'completed', 'failed', 'cancelled')),
        completion_date DATE,
        certificate_earned BOOLEAN DEFAULT false,
        certificate_url VARCHAR(500),
        expiry_date DATE,
        score_achieved DECIMAL(5,2),
        passing_score DECIMAL(5,2),
        trainer_feedback TEXT,
        skills_gained TEXT[],
        competency_improvement TEXT,
        application_deadline DATE,
        requested_by UUID NOT NULL REFERENCES users(id),
        approved_by UUID REFERENCES users(id),
        approval_date TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('   ✅ admin_employee_training table created');

    // 7. Company Assets
    await pool.query(`
      CREATE TABLE IF NOT EXISTS admin_company_assets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        asset_name VARCHAR(200) NOT NULL,
        asset_code VARCHAR(50) UNIQUE NOT NULL,
        asset_category VARCHAR(50) NOT NULL,
        asset_type VARCHAR(100),
        brand VARCHAR(100),
        model VARCHAR(100),
        serial_number VARCHAR(100),
        purchase_cost DECIMAL(12,2),
        current_value DECIMAL(12,2),
        depreciation_rate DECIMAL(5,2),
        depreciation_method VARCHAR(20) DEFAULT 'straight_line',
        purchase_date DATE,
        supplier VARCHAR(255),
        warranty_period_months INTEGER,
        warranty_expiry DATE,
        assigned_to_employee UUID REFERENCES admin_employees(id),
        assignment_date DATE,
        current_location VARCHAR(255),
        department_id UUID REFERENCES admin_departments(id),
        condition_status VARCHAR(20) DEFAULT 'excellent' CHECK (condition_status IN ('excellent', 'good', 'fair', 'poor', 'damaged', 'disposed')),
        last_maintenance_date DATE,
        next_maintenance_due DATE,
        maintenance_notes TEXT,
        insured BOOLEAN DEFAULT false,
        insurance_policy_number VARCHAR(100),
        compliance_certifications TEXT[],
        asset_status VARCHAR(20) DEFAULT 'active' CHECK (asset_status IN ('active', 'inactive', 'maintenance', 'disposed', 'lost', 'stolen')),
        disposal_date DATE,
        disposal_reason TEXT,
        disposal_value DECIMAL(12,2),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        created_by UUID NOT NULL REFERENCES users(id)
      )
    `);
    console.log('   ✅ admin_company_assets table created');

    // 8. Performance Reviews
    await pool.query(`
      CREATE TABLE IF NOT EXISTS admin_performance_reviews (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_id UUID NOT NULL REFERENCES admin_employees(id) ON DELETE CASCADE,
        reviewer_id UUID NOT NULL REFERENCES admin_employees(id),
        review_period_start DATE NOT NULL,
        review_period_end DATE NOT NULL,
        review_type VARCHAR(30) NOT NULL CHECK (review_type IN ('probation', 'quarterly', 'annual', 'promotion', 'disciplinary')),
        overall_rating DECIMAL(3,2) NOT NULL CHECK (overall_rating >= 1.0 AND overall_rating <= 5.0),
        technical_skills_rating DECIMAL(3,2),
        communication_rating DECIMAL(3,2),
        teamwork_rating DECIMAL(3,2),
        leadership_rating DECIMAL(3,2),
        initiative_rating DECIMAL(3,2),
        goals_set_previous_review TEXT[],
        goals_achieved TEXT[],
        key_accomplishments TEXT[],
        areas_for_improvement TEXT[],
        training_recommendations TEXT[],
        career_development_goals TEXT[],
        next_review_goals TEXT[],
        salary_recommendation VARCHAR(20),
        promotion_recommendation BOOLEAN DEFAULT false,
        bonus_recommendation DECIMAL(10,2),
        reviewer_comments TEXT,
        employee_self_assessment TEXT,
        employee_comments TEXT,
        hr_comments TEXT,
        review_status VARCHAR(20) DEFAULT 'draft' CHECK (review_status IN ('draft', 'employee_review', 'manager_review', 'hr_review', 'completed')),
        review_date DATE DEFAULT CURRENT_DATE,
        employee_acknowledgment BOOLEAN DEFAULT false,
        acknowledgment_date TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('   ✅ admin_performance_reviews table created');

    // Create basic indexes
    console.log('\n📄 Creating indexes...');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_admin_departments_head ON admin_departments(head_of_department)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_admin_employees_user ON admin_employees(user_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_admin_employees_department ON admin_employees(department_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_admin_employees_manager ON admin_employees(reporting_manager_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_admin_employee_leaves_employee ON admin_employee_leaves(employee_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_admin_trip_programs_status ON admin_trip_programs(program_status)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_admin_trip_registrations_program ON admin_trip_registrations(trip_program_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_admin_trip_registrations_student ON admin_trip_registrations(student_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_admin_trip_registrations_school ON admin_trip_registrations(school_id)');
    console.log('   ✅ Indexes created');

    // Insert initial departments
    console.log('\n📄 Inserting initial departments...');
    
    // Get a super admin user to use as creator
    const superAdminResult = await pool.query("SELECT id FROM users WHERE role = 'super_admin' LIMIT 1");
    const createdById = superAdminResult.rows[0]?.id;

    if (createdById) {
      await pool.query(`
        INSERT INTO admin_departments (department_name, department_code, description, created_by) VALUES
        ('Human Resources', 'HR', 'Employee management and organizational development', $1),
        ('Technology', 'TECH', 'Software development and IT infrastructure', $1),
        ('Operations', 'OPS', 'Business operations and process management', $1),
        ('Sales & Marketing', 'SALES', 'Customer acquisition and marketing', $1),
        ('Finance', 'FIN', 'Financial management and accounting', $1),
        ('Academic Programs', 'ACAD', 'Educational trip programs and curriculum development', $1)
        ON CONFLICT (department_name) DO NOTHING
      `, [createdById]);
      console.log('   ✅ Initial departments inserted');
    } else {
      console.log('   ⚠️  No super admin found, skipping department insertion');
    }

    // Validate tables
    console.log('\n🔍 Validating tables...');
    const validation = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name LIKE 'admin_%'
      ORDER BY table_name
    `);

    console.log('📋 Created Admin HR Tables:');
    validation.rows.forEach(row => {
      console.log(`   ✅ ${row.table_name}`);
    });

    // Get counts
    console.log('\n📊 Table Statistics:');
    for (const table of validation.rows) {
      try {
        const countResult = await pool.query(`SELECT COUNT(*) FROM ${table.table_name}`);
        console.log(`   📝 ${table.table_name}: ${countResult.rows[0].count} records`);
      } catch (error) {
        console.log(`   ❌ ${table.table_name}: Error getting count`);
      }
    }

    console.log('\n🎉 Admin Platform HR Tables Created Successfully!');
    console.log('\n📚 Ready for Admin HR Features:');
    console.log('   • Employee Management & HR Operations');
    console.log('   • Department Structure & Organization');
    console.log('   • Leave Management System');
    console.log('   • Academic Trip Program Management');
    console.log('   • Student Trip Registration System');
    console.log('   • Employee Training & Development');
    console.log('   • Company Asset Management');
    console.log('   • Performance Review System');

  } catch (error) {
    console.error('❌ Error creating Admin HR tables:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
    console.log('\n🔒 Database connection closed');
  }
}

// Load environment variables
require('dotenv').config();

// Run the creation
createAdminHrTables();