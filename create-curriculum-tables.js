const { Pool } = require('pg');

/**
 * Create Curriculum-Specific Tables Directly
 */

async function createCurriculumTables() {
  console.log('🚀 Creating Curriculum-Specific Tables Directly');
  console.log('===============================================');

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/edufam_db'
  });

  try {
    console.log('🔌 Testing database connection...');
    const client = await pool.connect();
    console.log('✅ Database connection successful');
    client.release();

    // Create tables one by one
    console.log('\n📄 Creating curriculum tables...');

    // 1. Curriculum Systems
    await pool.query(`
      CREATE TABLE IF NOT EXISTS curriculum_systems (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        curriculum_code VARCHAR(20) UNIQUE NOT NULL,
        curriculum_name VARCHAR(100) NOT NULL,
        full_name VARCHAR(255),
        description TEXT,
        country_origin VARCHAR(100),
        education_board VARCHAR(100),
        official_website VARCHAR(500),
        curriculum_version VARCHAR(20),
        grade_levels VARCHAR(10)[],
        age_ranges JSONB,
        duration_years INTEGER,
        assessment_system VARCHAR(50),
        grading_scale VARCHAR(20),
        grade_boundaries JSONB,
        competency_based BOOLEAN DEFAULT false,
        skills_based BOOLEAN DEFAULT false,
        exam_based BOOLEAN DEFAULT true,
        continuous_assessment BOOLEAN DEFAULT true,
        primary_language VARCHAR(50) DEFAULT 'English',
        supported_languages VARCHAR(50)[],
        local_adaptations BOOLEAN DEFAULT false,
        international_recognition BOOLEAN DEFAULT false,
        university_admission_support BOOLEAN DEFAULT true,
        professional_certification BOOLEAN DEFAULT false,
        is_active BOOLEAN DEFAULT true,
        implementation_date DATE,
        last_updated DATE DEFAULT CURRENT_DATE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        created_by UUID NOT NULL REFERENCES users(id)
      )
    `);
    console.log('   ✅ curriculum_systems table created');

    // 2. Curriculum Grade Levels
    await pool.query(`
      CREATE TABLE IF NOT EXISTS curriculum_grade_levels (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        curriculum_id UUID NOT NULL REFERENCES curriculum_systems(id) ON DELETE CASCADE,
        grade_code VARCHAR(20) NOT NULL,
        grade_name VARCHAR(50) NOT NULL,
        display_order INTEGER NOT NULL,
        typical_age_min INTEGER,
        typical_age_max INTEGER,
        duration_months INTEGER DEFAULT 12,
        is_examination_grade BOOLEAN DEFAULT false,
        is_transition_grade BOOLEAN DEFAULT false,
        next_level_requirement TEXT,
        key_stage VARCHAR(20),
        phase VARCHAR(30),
        specialization_available BOOLEAN DEFAULT false,
        assessment_frequency VARCHAR(20),
        major_assessments TEXT[],
        core_subjects TEXT[],
        optional_subjects TEXT[],
        minimum_subjects INTEGER,
        maximum_subjects INTEGER,
        promotion_criteria TEXT,
        repeat_conditions TEXT,
        dropout_points TEXT[],
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(curriculum_id, grade_code)
      )
    `);
    console.log('   ✅ curriculum_grade_levels table created');

    // 3. Curriculum Subjects
    await pool.query(`
      CREATE TABLE IF NOT EXISTS curriculum_subjects (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        curriculum_id UUID NOT NULL REFERENCES curriculum_systems(id) ON DELETE CASCADE,
        subject_code VARCHAR(20) NOT NULL,
        subject_name VARCHAR(100) NOT NULL,
        full_name VARCHAR(255),
        subject_category VARCHAR(50),
        subject_type VARCHAR(30) NOT NULL CHECK (subject_type IN ('core', 'optional', 'elective', 'specialization')),
        is_mandatory BOOLEAN DEFAULT false,
        prerequisite_subjects TEXT[],
        available_grades VARCHAR(10)[],
        introduction_grade VARCHAR(10),
        final_grade VARCHAR(10),
        assessment_type VARCHAR(30),
        assessment_components JSONB,
        grading_method VARCHAR(30),
        learning_outcomes TEXT[],
        key_competencies TEXT[],
        skill_areas TEXT[],
        strand_areas TEXT[],
        learning_objectives_by_grade JSONB,
        practical_requirements BOOLEAN DEFAULT false,
        equipment_needed TEXT[],
        textbook_recommendations TEXT[],
        external_exam_available BOOLEAN DEFAULT false,
        exam_board VARCHAR(100),
        exam_fee_currency VARCHAR(3) DEFAULT 'KES',
        exam_fee_amount DECIMAL(10,2),
        is_active BOOLEAN DEFAULT true,
        phase_out_date DATE,
        replacement_subject_id UUID REFERENCES curriculum_subjects(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(curriculum_id, subject_code)
      )
    `);
    console.log('   ✅ curriculum_subjects table created');

    // 4. Assessment Standards
    await pool.query(`
      CREATE TABLE IF NOT EXISTS curriculum_assessment_standards (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        curriculum_id UUID NOT NULL REFERENCES curriculum_systems(id) ON DELETE CASCADE,
        subject_id UUID REFERENCES curriculum_subjects(id) ON DELETE CASCADE,
        grade_level_id UUID REFERENCES curriculum_grade_levels(id) ON DELETE CASCADE,
        standard_code VARCHAR(30) NOT NULL,
        standard_title VARCHAR(200) NOT NULL,
        standard_description TEXT,
        standard_type VARCHAR(30) CHECK (standard_type IN ('learning_outcome', 'competency', 'skill', 'knowledge_area')),
        domain_area VARCHAR(100),
        complexity_level VARCHAR(20) CHECK (complexity_level IN ('basic', 'intermediate', 'advanced', 'mastery')),
        assessment_methods TEXT[],
        evidence_requirements TEXT[],
        performance_descriptors JSONB,
        mastery_criteria TEXT,
        prerequisite_standards TEXT[],
        builds_to_standards TEXT[],
        teaching_strategies TEXT[],
        resources_needed TEXT[],
        time_allocation_hours INTEGER,
        is_active BOOLEAN DEFAULT true,
        effective_date DATE DEFAULT CURRENT_DATE,
        review_date DATE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(curriculum_id, standard_code)
      )
    `);
    console.log('   ✅ curriculum_assessment_standards table created');

    // 5. Curriculum Equivalencies
    await pool.query(`
      CREATE TABLE IF NOT EXISTS curriculum_equivalencies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        source_curriculum_id UUID NOT NULL REFERENCES curriculum_systems(id) ON DELETE CASCADE,
        source_grade_id UUID REFERENCES curriculum_grade_levels(id),
        source_subject_id UUID REFERENCES curriculum_subjects(id),
        target_curriculum_id UUID NOT NULL REFERENCES curriculum_systems(id) ON DELETE CASCADE,
        target_grade_id UUID REFERENCES curriculum_grade_levels(id),
        target_subject_id UUID REFERENCES curriculum_subjects(id),
        equivalency_type VARCHAR(30) CHECK (equivalency_type IN ('grade_level', 'subject', 'assessment', 'qualification')),
        equivalency_strength VARCHAR(20) CHECK (equivalency_strength IN ('exact', 'close', 'partial', 'approximate')),
        notes TEXT,
        grade_conversion_factor DECIMAL(5,2),
        assessment_mapping JSONB,
        officially_recognized BOOLEAN DEFAULT false,
        recognition_body VARCHAR(100),
        recognition_date DATE,
        valid_from DATE DEFAULT CURRENT_DATE,
        valid_until DATE,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        created_by UUID NOT NULL REFERENCES users(id),
        UNIQUE(source_curriculum_id, source_grade_id, source_subject_id, target_curriculum_id, target_grade_id, target_subject_id)
      )
    `);
    console.log('   ✅ curriculum_equivalencies table created');

    // 6. School Implementation
    await pool.query(`
      CREATE TABLE IF NOT EXISTS school_curriculum_implementation (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        curriculum_id UUID NOT NULL REFERENCES curriculum_systems(id) ON DELETE CASCADE,
        implementation_status VARCHAR(20) DEFAULT 'planning' CHECK (implementation_status IN ('planning', 'pilot', 'partial', 'full', 'phasing_out', 'discontinued')),
        implementation_date DATE NOT NULL,
        phase_out_date DATE,
        grade_levels_implemented VARCHAR(10)[],
        subjects_implemented TEXT[],
        percentage_implementation DECIMAL(5,2) DEFAULT 100.00,
        teacher_training_completed BOOLEAN DEFAULT false,
        teacher_training_date DATE,
        resources_acquired BOOLEAN DEFAULT false,
        assessment_tools_ready BOOLEAN DEFAULT false,
        student_performance_baseline JSONB,
        current_performance_metrics JSONB,
        improvement_targets JSONB,
        implementation_challenges TEXT[],
        solutions_implemented TEXT[],
        support_needed TEXT[],
        ministry_support_received BOOLEAN DEFAULT false,
        consultant_support BOOLEAN DEFAULT false,
        peer_school_collaboration BOOLEAN DEFAULT false,
        compliance_status VARCHAR(20) DEFAULT 'compliant' CHECK (compliance_status IN ('compliant', 'partial', 'non_compliant', 'under_review')),
        last_inspection_date DATE,
        next_review_date DATE,
        implementation_cost DECIMAL(12,2),
        annual_maintenance_cost DECIMAL(12,2),
        funding_source VARCHAR(100),
        is_active BOOLEAN DEFAULT true,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        created_by UUID NOT NULL REFERENCES users(id),
        UNIQUE(school_id, curriculum_id)
      )
    `);
    console.log('   ✅ school_curriculum_implementation table created');

    // 7. Student Progress
    await pool.query(`
      CREATE TABLE IF NOT EXISTS student_curriculum_progress (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        curriculum_id UUID NOT NULL REFERENCES curriculum_systems(id) ON DELETE CASCADE,
        current_grade_level_id UUID NOT NULL REFERENCES curriculum_grade_levels(id),
        academic_year VARCHAR(20) NOT NULL,
        term_semester VARCHAR(20),
        subjects_enrolled TEXT[],
        subjects_completed TEXT[],
        subjects_failed TEXT[],
        overall_grade VARCHAR(10),
        gpa_score DECIMAL(4,2),
        class_rank INTEGER,
        total_students_in_class INTEGER,
        competencies_achieved TEXT[],
        competencies_developing TEXT[],
        competencies_needs_support TEXT[],
        subject_performance JSONB,
        assessment_scores JSONB,
        exam_results JSONB,
        promotion_status VARCHAR(20) DEFAULT 'on_track' CHECK (promotion_status IN ('promoted', 'on_track', 'at_risk', 'retained', 'transferred')),
        promotion_date DATE,
        retention_reason TEXT,
        individualized_support_plan BOOLEAN DEFAULT false,
        special_needs_accommodation TEXT[],
        additional_support_provided TEXT[],
        parent_conference_dates DATE[],
        parent_engagement_level VARCHAR(20) DEFAULT 'moderate' CHECK (parent_engagement_level IN ('low', 'moderate', 'high', 'very_high')),
        risk_factors TEXT[],
        intervention_strategies TEXT[],
        predicted_outcomes TEXT[],
        national_exam_eligibility BOOLEAN DEFAULT true,
        external_exam_registrations JSONB,
        is_current BOOLEAN DEFAULT true,
        academic_year_start DATE,
        academic_year_end DATE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        last_updated_by UUID REFERENCES users(id)
      )
    `);
    console.log('   ✅ student_curriculum_progress table created');

    // Create basic indexes
    console.log('\n📄 Creating indexes...');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_curriculum_systems_code ON curriculum_systems(curriculum_code)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_curriculum_systems_country ON curriculum_systems(country_origin)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_curriculum_grade_levels_curriculum ON curriculum_grade_levels(curriculum_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_curriculum_grade_levels_order ON curriculum_grade_levels(display_order)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_curriculum_subjects_curriculum ON curriculum_subjects(curriculum_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_curriculum_subjects_type ON curriculum_subjects(subject_type)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_curriculum_assessment_curriculum ON curriculum_assessment_standards(curriculum_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_school_curriculum_impl_school ON school_curriculum_implementation(school_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_school_curriculum_impl_curriculum ON school_curriculum_implementation(curriculum_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_student_curriculum_progress_student ON student_curriculum_progress(student_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_student_curriculum_progress_school ON student_curriculum_progress(school_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_student_curriculum_progress_curriculum ON student_curriculum_progress(curriculum_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_student_curriculum_progress_current ON student_curriculum_progress(is_current) WHERE is_current = true');
    console.log('   ✅ Indexes created');

    // Insert initial curriculum systems
    console.log('\n📄 Inserting initial curriculum systems...');
    
    // Get a super admin user to use as creator
    const superAdminResult = await pool.query("SELECT id FROM users WHERE role = 'super_admin' LIMIT 1");
    const createdById = superAdminResult.rows[0]?.id;

    if (createdById) {
      await pool.query(`
        INSERT INTO curriculum_systems (
          curriculum_code, curriculum_name, full_name, description, country_origin, 
          education_board, grade_levels, duration_years, assessment_system, 
          grading_scale, competency_based, created_by
        ) VALUES
        ('CBC', 'Competency Based Curriculum', 'Competency Based Curriculum', 
        'Kenya''s current curriculum focusing on competencies and skills development', 'Kenya', 'KICD',
        ARRAY['PP1', 'PP2', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8', 'G9', 'G10', 'G11', 'G12'],
        14, 'continuous_assessment', 'EE-ME-AE-BE', true, $1),

        ('8-4-4', '8-4-4 System', 'Eight-Four-Four Education System',
        'Kenya''s former education system with 8 years primary, 4 years secondary, 4 years university', 'Kenya', 'KNEC',
        ARRAY['Std1', 'Std2', 'Std3', 'Std4', 'Std5', 'Std6', 'Std7', 'Std8', 'F1', 'F2', 'F3', 'F4'],
        12, 'standardized_exams', 'A-E', false, $1),

        ('IGCSE', 'IGCSE', 'International General Certificate of Secondary Education',
        'Cambridge International curriculum for students aged 14-16', 'United Kingdom', 'Cambridge Assessment',
        ARRAY['Y7', 'Y8', 'Y9', 'Y10', 'Y11'],
        5, 'standardized_exams', 'A*-G', false, $1),

        ('IB', 'International Baccalaureate', 'International Baccalaureate Programme',
        'International curriculum promoting intercultural understanding and respect', 'International', 'IB Organization',
        ARRAY['PYP1', 'PYP2', 'PYP3', 'PYP4', 'PYP5', 'PYP6', 'MYP1', 'MYP2', 'MYP3', 'MYP4', 'MYP5', 'DP1', 'DP2'],
        13, 'mixed', '1-7', true, $1),

        ('CAMBRIDGE', 'Cambridge International', 'Cambridge International Education',
        'British curriculum adapted for international schools', 'United Kingdom', 'Cambridge Assessment',
        ARRAY['Y1', 'Y2', 'Y3', 'Y4', 'Y5', 'Y6', 'Y7', 'Y8', 'Y9', 'Y10', 'Y11', 'Y12', 'Y13'],
        13, 'mixed', 'A*-G', false, $1)
        ON CONFLICT (curriculum_code) DO NOTHING
      `, [createdById]);
      console.log('   ✅ Initial curriculum systems inserted');
    } else {
      console.log('   ⚠️  No super admin found, skipping curriculum system insertion');
    }

    // Validate tables
    console.log('\n🔍 Validating tables...');
    const validation = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name LIKE 'curriculum_%' OR table_name LIKE 'school_curriculum_%' OR table_name LIKE 'student_curriculum_%'
      ORDER BY table_name
    `);

    console.log('📋 Created Curriculum Tables:');
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

    console.log('\n🎉 Curriculum-Specific Tables Created Successfully!');
    console.log('\n📚 Ready for Curriculum Features:');
    console.log('   • Multi-Curriculum Support (CBC, IGCSE, 8-4-4, IB, Cambridge)');
    console.log('   • Grade Level Management');
    console.log('   • Subject Tracking & Assessment Standards');
    console.log('   • Student Progress Tracking');
    console.log('   • Curriculum Implementation Monitoring');
    console.log('   • Cross-Curriculum Equivalencies');
    console.log('   • Competency-Based Assessment (CBC)');
    console.log('   • Performance Analytics & Reporting');

    console.log('\n🎯 Curriculum-Specific Features:');
    console.log('   • CBC: Competency tracking and skills-based assessment');
    console.log('   • IGCSE: Cambridge assessment standards and grading');
    console.log('   • 8-4-4: Traditional Kenyan system support');
    console.log('   • IB: International Baccalaureate frameworks');
    console.log('   • Cambridge: British curriculum adaptation');

  } catch (error) {
    console.error('❌ Error creating curriculum tables:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
    console.log('\n🔒 Database connection closed');
  }
}

// Load environment variables
require('dotenv').config();

// Run the creation
createCurriculumTables();