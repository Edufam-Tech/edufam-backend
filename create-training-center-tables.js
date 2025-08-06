const { Pool } = require('pg');

/**
 * Create Training Center Management Tables Directly
 */

async function createTrainingCenterTables() {
  console.log('🚀 Creating Training Center Management Tables');
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
    console.log('\n📄 Creating training center tables...');

    // 1. Training Centers
    await pool.query(`
      CREATE TABLE IF NOT EXISTS training_centers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        center_name VARCHAR(255) NOT NULL,
        center_code VARCHAR(20) UNIQUE NOT NULL,
        center_type VARCHAR(30) NOT NULL CHECK (center_type IN ('physical', 'virtual', 'hybrid')),
        description TEXT,
        address TEXT,
        city VARCHAR(100),
        state_province VARCHAR(100),
        country VARCHAR(100),
        postal_code VARCHAR(20),
        coordinates JSONB,
        phone VARCHAR(20),
        email VARCHAR(255),
        website_url VARCHAR(500),
        max_capacity INTEGER NOT NULL,
        classroom_count INTEGER DEFAULT 1,
        computer_lab_count INTEGER DEFAULT 0,
        has_projector BOOLEAN DEFAULT false,
        has_wifi BOOLEAN DEFAULT true,
        has_parking BOOLEAN DEFAULT false,
        accessibility_features TEXT[],
        virtual_platform VARCHAR(50),
        platform_settings JSONB,
        virtual_room_capacity INTEGER,
        operating_hours JSONB,
        time_zone VARCHAR(50) DEFAULT 'Africa/Nairobi',
        center_manager_id UUID REFERENCES users(id) ON DELETE SET NULL,
        backup_manager_id UUID REFERENCES users(id) ON DELETE SET NULL,
        hourly_rate DECIMAL(10,2),
        daily_rate DECIMAL(10,2),
        currency VARCHAR(3) DEFAULT 'KES',
        status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'maintenance', 'under_construction')),
        certification_status VARCHAR(30),
        certifying_body VARCHAR(100),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        created_by UUID NOT NULL REFERENCES users(id)
      )
    `);
    console.log('   ✅ training_centers table created');

    // 2. Training Programs
    await pool.query(`
      CREATE TABLE IF NOT EXISTS training_programs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        program_name VARCHAR(255) NOT NULL,
        program_code VARCHAR(20) UNIQUE NOT NULL,
        program_type VARCHAR(30) NOT NULL CHECK (program_type IN ('certification', 'workshop', 'seminar', 'bootcamp', 'conference')),
        category VARCHAR(50) NOT NULL,
        subcategory VARCHAR(50),
        description TEXT NOT NULL,
        learning_objectives TEXT[],
        prerequisites TEXT[],
        target_audience TEXT[],
        duration_days INTEGER NOT NULL,
        duration_hours INTEGER NOT NULL,
        session_count INTEGER DEFAULT 1,
        difficulty_level VARCHAR(20) CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced', 'expert')),
        min_age INTEGER DEFAULT 16,
        max_participants INTEGER DEFAULT 30,
        min_participants INTEGER DEFAULT 5,
        provides_certificate BOOLEAN DEFAULT false,
        certificate_type VARCHAR(50),
        certificate_validity_months INTEGER,
        continuing_education_credits INTEGER DEFAULT 0,
        base_price DECIMAL(10,2) NOT NULL,
        currency VARCHAR(3) DEFAULT 'KES',
        early_bird_discount DECIMAL(5,2),
        group_discount_threshold INTEGER DEFAULT 5,
        group_discount_rate DECIMAL(5,2),
        materials_included TEXT[],
        required_materials TEXT[],
        software_requirements TEXT[],
        hardware_requirements TEXT[],
        delivery_method VARCHAR(20) CHECK (delivery_method IN ('in_person', 'virtual', 'hybrid', 'self_paced')),
        platform_requirements TEXT[],
        curriculum_outline JSONB,
        assessment_methods TEXT[],
        practical_components BOOLEAN DEFAULT false,
        project_based BOOLEAN DEFAULT false,
        featured_image_url VARCHAR(500),
        promotional_video_url VARCHAR(500),
        marketing_highlights TEXT[],
        testimonials JSONB,
        status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'suspended', 'archived')),
        is_featured BOOLEAN DEFAULT false,
        average_rating DECIMAL(3,2),
        total_ratings INTEGER DEFAULT 0,
        completion_rate DECIMAL(5,2),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        created_by UUID NOT NULL REFERENCES users(id)
      )
    `);
    console.log('   ✅ training_programs table created');

    // 3. Training Sessions
    await pool.query(`
      CREATE TABLE IF NOT EXISTS training_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        program_id UUID NOT NULL REFERENCES training_programs(id) ON DELETE CASCADE,
        center_id UUID NOT NULL REFERENCES training_centers(id) ON DELETE RESTRICT,
        session_name VARCHAR(255),
        session_code VARCHAR(20) UNIQUE NOT NULL,
        cohort_name VARCHAR(100),
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        start_time TIME NOT NULL,
        end_time TIME NOT NULL,
        time_zone VARCHAR(50) DEFAULT 'Africa/Nairobi',
        daily_schedule JSONB,
        break_schedule JSONB,
        max_participants INTEGER NOT NULL,
        min_participants INTEGER DEFAULT 5,
        current_enrollments INTEGER DEFAULT 0,
        waitlist_capacity INTEGER DEFAULT 10,
        session_price DECIMAL(10,2),
        early_bird_deadline DATE,
        early_bird_discount DECIMAL(5,2),
        delivery_method VARCHAR(20) NOT NULL,
        virtual_meeting_url VARCHAR(500),
        virtual_meeting_id VARCHAR(100),
        virtual_meeting_password VARCHAR(50),
        lead_instructor_id UUID REFERENCES users(id) ON DELETE SET NULL,
        co_instructors UUID[],
        teaching_assistants UUID[],
        support_staff UUID[],
        course_materials_url VARCHAR(500),
        resource_links JSONB,
        required_software TEXT[],
        material_distribution_method VARCHAR(30),
        assessment_schedule JSONB,
        project_deadlines JSONB,
        evaluation_criteria JSONB,
        status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'postponed')),
        cancellation_reason TEXT,
        postponement_reason TEXT,
        registration_opens TIMESTAMP,
        registration_closes TIMESTAMP,
        registration_status VARCHAR(20) DEFAULT 'open' CHECK (registration_status IN ('open', 'closed', 'waitlist_only', 'full')),
        session_rating DECIMAL(3,2),
        completion_rate DECIMAL(5,2),
        feedback_summary TEXT,
        internal_notes TEXT,
        special_requirements TEXT[],
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        created_by UUID NOT NULL REFERENCES users(id)
      )
    `);
    console.log('   ✅ training_sessions table created');

    // 4. Training Enrollments
    await pool.query(`
      CREATE TABLE IF NOT EXISTS training_enrollments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
        participant_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        enrollment_date TIMESTAMP DEFAULT NOW(),
        enrollment_status VARCHAR(20) DEFAULT 'registered' CHECK (enrollment_status IN ('registered', 'confirmed', 'waitlisted', 'attended', 'completed', 'dropped', 'no_show', 'cancelled')),
        enrollment_type VARCHAR(20) DEFAULT 'individual' CHECK (enrollment_type IN ('individual', 'corporate', 'scholarship', 'free', 'group')),
        participant_type VARCHAR(30) DEFAULT 'external' CHECK (participant_type IN ('student', 'teacher', 'parent', 'external', 'employee')),
        organization VARCHAR(255),
        job_title VARCHAR(100),
        experience_level VARCHAR(20),
        emergency_contact_name VARCHAR(255),
        emergency_contact_phone VARCHAR(20),
        emergency_contact_relationship VARCHAR(50),
        dietary_restrictions TEXT,
        accessibility_needs TEXT,
        special_accommodations TEXT,
        total_amount DECIMAL(10,2) NOT NULL,
        amount_paid DECIMAL(10,2) DEFAULT 0,
        payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'partial', 'completed', 'refunded', 'waived')),
        payment_method VARCHAR(30),
        discount_applied DECIMAL(5,2),
        discount_reason VARCHAR(100),
        attendance_records JSONB,
        total_sessions_attended INTEGER DEFAULT 0,
        attendance_percentage DECIMAL(5,2),
        assignment_scores JSONB,
        project_scores JSONB,
        final_score DECIMAL(5,2),
        grade VARCHAR(10),
        certificate_earned BOOLEAN DEFAULT false,
        certificate_issued_date DATE,
        certificate_number VARCHAR(100),
        certificate_url VARCHAR(500),
        pre_training_assessment JSONB,
        post_training_assessment JSONB,
        feedback_rating DECIMAL(3,2),
        feedback_comments TEXT,
        would_recommend BOOLEAN,
        registration_source VARCHAR(50),
        referral_code VARCHAR(20),
        marketing_source VARCHAR(100),
        internal_notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('   ✅ training_enrollments table created');

    // 5. Training Instructors
    await pool.query(`
      CREATE TABLE IF NOT EXISTS training_instructors (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        instructor_code VARCHAR(20) UNIQUE NOT NULL,
        instructor_type VARCHAR(30) DEFAULT 'freelance' CHECK (instructor_type IN ('employee', 'freelance', 'contractor', 'volunteer', 'guest')),
        specializations TEXT[],
        education_background TEXT[],
        certifications TEXT[],
        years_experience INTEGER,
        industry_experience TEXT[],
        teaching_experience_years INTEGER,
        preferred_subjects TEXT[],
        teaching_methods TEXT[],
        languages_spoken VARCHAR(50)[],
        max_class_size INTEGER DEFAULT 30,
        availability_schedule JSONB,
        time_zone VARCHAR(50) DEFAULT 'Africa/Nairobi',
        travel_willing BOOLEAN DEFAULT false,
        virtual_teaching_capable BOOLEAN DEFAULT true,
        average_rating DECIMAL(3,2),
        total_sessions_taught INTEGER DEFAULT 0,
        total_participants_taught INTEGER DEFAULT 0,
        completion_rate DECIMAL(5,2),
        hourly_rate DECIMAL(10,2),
        daily_rate DECIMAL(10,2),
        currency VARCHAR(3) DEFAULT 'KES',
        payment_terms VARCHAR(50),
        has_own_equipment BOOLEAN DEFAULT false,
        equipment_list TEXT[],
        technical_requirements TEXT[],
        status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended', 'pending_verification')),
        background_check_completed BOOLEAN DEFAULT false,
        background_check_date DATE,
        reference_check_completed BOOLEAN DEFAULT false,
        contract_type VARCHAR(30),
        contract_start_date DATE,
        contract_end_date DATE,
        nda_signed BOOLEAN DEFAULT false,
        bio TEXT,
        profile_image_url VARCHAR(500),
        linkedin_url VARCHAR(500),
        website_url VARCHAR(500),
        portfolio_url VARCHAR(500),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        created_by UUID NOT NULL REFERENCES users(id)
      )
    `);
    console.log('   ✅ training_instructors table created');

    // 6. Training Resources
    await pool.query(`
      CREATE TABLE IF NOT EXISTS training_resources (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        resource_name VARCHAR(255) NOT NULL,
        resource_type VARCHAR(30) NOT NULL CHECK (resource_type IN ('document', 'video', 'audio', 'presentation', 'software', 'dataset', 'template', 'tool')),
        category VARCHAR(50),
        description TEXT,
        file_url VARCHAR(500),
        file_size_mb DECIMAL(10,2),
        file_format VARCHAR(20),
        access_level VARCHAR(20) DEFAULT 'restricted' CHECK (access_level IN ('public', 'restricted', 'instructor_only', 'admin_only')),
        download_allowed BOOLEAN DEFAULT true,
        print_allowed BOOLEAN DEFAULT true,
        program_ids UUID[],
        session_ids UUID[],
        instructor_ids UUID[],
        version VARCHAR(10) DEFAULT '1.0',
        previous_version_id UUID REFERENCES training_resources(id),
        is_current_version BOOLEAN DEFAULT true,
        download_count INTEGER DEFAULT 0,
        view_count INTEGER DEFAULT 0,
        last_accessed TIMESTAMP,
        rating DECIMAL(3,2),
        review_count INTEGER DEFAULT 0,
        status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deprecated')),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        created_by UUID NOT NULL REFERENCES users(id)
      )
    `);
    console.log('   ✅ training_resources table created');

    // 7. Training Analytics
    await pool.query(`
      CREATE TABLE IF NOT EXISTS training_analytics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        analytics_type VARCHAR(30) NOT NULL CHECK (analytics_type IN ('session', 'program', 'instructor', 'center', 'overall')),
        entity_id UUID,
        period_start DATE NOT NULL,
        period_end DATE NOT NULL,
        generated_date TIMESTAMP DEFAULT NOW(),
        total_enrollments INTEGER DEFAULT 0,
        total_completions INTEGER DEFAULT 0,
        completion_rate DECIMAL(5,2),
        dropout_rate DECIMAL(5,2),
        no_show_rate DECIMAL(5,2),
        total_revenue DECIMAL(12,2) DEFAULT 0,
        average_price_per_participant DECIMAL(10,2),
        discount_percentage DECIMAL(5,2),
        refund_amount DECIMAL(12,2) DEFAULT 0,
        average_rating DECIMAL(3,2),
        total_feedback_count INTEGER DEFAULT 0,
        recommendation_rate DECIMAL(5,2),
        utilization_rate DECIMAL(5,2),
        cancellation_rate DECIMAL(5,2),
        postponement_rate DECIMAL(5,2),
        detailed_metrics JSONB,
        previous_period_comparison JSONB,
        is_current BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        created_by UUID REFERENCES users(id)
      )
    `);
    console.log('   ✅ training_analytics table created');

    // Create indexes
    console.log('\n📄 Creating indexes...');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_training_centers_type ON training_centers(center_type)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_training_centers_status ON training_centers(status)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_training_centers_manager ON training_centers(center_manager_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_training_centers_location ON training_centers(city, country)');

    await pool.query('CREATE INDEX IF NOT EXISTS idx_training_programs_type ON training_programs(program_type)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_training_programs_category ON training_programs(category)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_training_programs_status ON training_programs(status)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_training_programs_featured ON training_programs(is_featured) WHERE is_featured = true');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_training_programs_difficulty ON training_programs(difficulty_level)');

    await pool.query('CREATE INDEX IF NOT EXISTS idx_training_sessions_program ON training_sessions(program_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_training_sessions_center ON training_sessions(center_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_training_sessions_dates ON training_sessions(start_date, end_date)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_training_sessions_status ON training_sessions(status)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_training_sessions_lead_instructor ON training_sessions(lead_instructor_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_training_sessions_registration_status ON training_sessions(registration_status)');

    await pool.query('CREATE INDEX IF NOT EXISTS idx_training_enrollments_session ON training_enrollments(session_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_training_enrollments_participant ON training_enrollments(participant_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_training_enrollments_status ON training_enrollments(enrollment_status)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_training_enrollments_payment_status ON training_enrollments(payment_status)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_training_enrollments_date ON training_enrollments(enrollment_date)');

    await pool.query('CREATE INDEX IF NOT EXISTS idx_training_instructors_user ON training_instructors(user_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_training_instructors_type ON training_instructors(instructor_type)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_training_instructors_status ON training_instructors(status)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_training_instructors_rating ON training_instructors(average_rating DESC)');

    await pool.query('CREATE INDEX IF NOT EXISTS idx_training_resources_type ON training_resources(resource_type)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_training_resources_category ON training_resources(category)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_training_resources_access_level ON training_resources(access_level)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_training_resources_status ON training_resources(status)');

    await pool.query('CREATE INDEX IF NOT EXISTS idx_training_analytics_type ON training_analytics(analytics_type)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_training_analytics_entity ON training_analytics(entity_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_training_analytics_period ON training_analytics(period_start, period_end)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_training_analytics_current ON training_analytics(is_current) WHERE is_current = true');
    console.log('   ✅ Indexes created');

    // Insert initial data
    console.log('\n📄 Inserting initial training center data...');
    
    const superAdminResult = await pool.query("SELECT id FROM users WHERE role = 'super_admin' LIMIT 1");
    const createdById = superAdminResult.rows[0]?.id;

    if (createdById) {
      // Insert default training center
      await pool.query(`
        INSERT INTO training_centers (
          center_name, center_code, center_type, description, max_capacity,
          has_wifi, has_projector, status, created_by
        ) VALUES (
          'Edufam Main Training Center', 'ETC001', 'hybrid',
          'Primary training facility for educational workshops and professional development',
          50, true, true, 'active', $1
        ) ON CONFLICT (center_code) DO NOTHING
      `, [createdById]);

      // Insert sample training programs
      await pool.query(`
        INSERT INTO training_programs (
          program_name, program_code, program_type, category, description,
          duration_days, duration_hours, difficulty_level, base_price,
          provides_certificate, status, created_by
        ) VALUES 
        ('Digital Literacy for Educators', 'DLE001', 'workshop', 'technology',
        'Comprehensive training on digital tools and platforms for modern education',
        3, 24, 'beginner', 15000.00, true, 'published', $1),

        ('Leadership in Education', 'LIE001', 'certification', 'leadership',
        'Advanced leadership skills for educational administrators and principals',
        5, 40, 'intermediate', 25000.00, true, 'published', $1),

        ('CBC Implementation Workshop', 'CBC001', 'workshop', 'education',
        'Practical training on implementing Competency Based Curriculum in schools',
        2, 16, 'intermediate', 12000.00, true, 'published', $1)
        ON CONFLICT (program_code) DO NOTHING
      `, [createdById]);

      console.log('   ✅ Initial training center data inserted');
    } else {
      console.log('   ⚠️  No super admin found, skipping data insertion');
    }

    // Validate tables
    console.log('\n🔍 Validating tables...');
    const validation = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name LIKE 'training_%'
      ORDER BY table_name
    `);

    console.log('📋 Created Training Center Tables:');
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

    console.log('\n🎉 Training Center Management Tables Created Successfully!');
    console.log('\n🎓 Ready for Training Features:');
    console.log('   • Multi-Location Training Center Management');
    console.log('   • Comprehensive Workshop & Program Catalog');
    console.log('   • Session Scheduling & Enrollment Management');
    console.log('   • Instructor Profile & Coordination System');
    console.log('   • Virtual & Hybrid Training Support');
    console.log('   • Certification & Assessment Tracking');
    console.log('   • Analytics & Performance Reporting');
    console.log('   • Public Program Catalog for Website');

    console.log('\n📚 Sample Programs Created:');
    console.log('   • Digital Literacy for Educators (DLE001)');
    console.log('   • Leadership in Education (LIE001)');
    console.log('   • CBC Implementation Workshop (CBC001)');

  } catch (error) {
    console.error('❌ Error creating training center tables:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
    console.log('\n🔒 Database connection closed');
  }
}

// Load environment variables
require('dotenv').config();

// Run the creation
createTrainingCenterTables();