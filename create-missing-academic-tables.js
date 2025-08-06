const { query, closePool } = require('./src/config/database');

async function createMissingAcademicTables() {
  try {
    console.log('🚀 Creating missing academic module tables...\n');

    // 1. Create grade_categories table
    console.log('📄 Creating grade_categories table...');
    await query(`
      CREATE TABLE IF NOT EXISTS grade_categories (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
          name VARCHAR(100) NOT NULL,
          description TEXT,
          weight DECIMAL(5,2) DEFAULT 100.00,
          is_active BOOLEAN DEFAULT true,
          created_by UUID NOT NULL REFERENCES users(id),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT unique_school_category_name UNIQUE (school_id, name)
      )
    `);
    console.log('✅ grade_categories table created');

    // 2. Create assessments table
    console.log('📄 Creating assessments table...');
    await query(`
      CREATE TABLE IF NOT EXISTS assessments (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
          title VARCHAR(255) NOT NULL,
          description TEXT,
          class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
          subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
          category_id UUID REFERENCES grade_categories(id) ON DELETE SET NULL,
          academic_year_id UUID REFERENCES academic_years(id) ON DELETE CASCADE,
          academic_term_id UUID REFERENCES academic_terms(id) ON DELETE CASCADE,
          total_marks DECIMAL(6,2) NOT NULL DEFAULT 100,
          pass_marks DECIMAL(6,2) NOT NULL DEFAULT 50,
          assessment_date DATE,
          due_date DATE,
          duration_minutes INTEGER,
          status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'grading', 'completed')),
          is_final BOOLEAN DEFAULT false,
          instructions TEXT,
          created_by UUID NOT NULL REFERENCES users(id),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ assessments table created');

    // 3. Create grades table
    console.log('📄 Creating grades table...');
    await query(`
      CREATE TABLE IF NOT EXISTS grades (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
          student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
          assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
          score DECIMAL(6,2) NOT NULL,
          letter_grade VARCHAR(5),
          percentage DECIMAL(5,2),
          remarks TEXT,
          status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved')),
          is_approved BOOLEAN DEFAULT false,
          graded_by UUID NOT NULL REFERENCES users(id),
          graded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          approved_by UUID REFERENCES users(id),
          approved_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT unique_student_assessment UNIQUE (student_id, assessment_id)
      )
    `);
    console.log('✅ grades table created');

    // 4. Create grade_approvals table
    console.log('📄 Creating grade_approvals table...');
    await query(`
      CREATE TABLE IF NOT EXISTS grade_approvals (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          grade_id UUID NOT NULL REFERENCES grades(id) ON DELETE CASCADE,
          approved_by UUID NOT NULL REFERENCES users(id),
          approval_status VARCHAR(20) DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
          approval_notes TEXT,
          approved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ grade_approvals table created');

    // 5. Create grade_comments table
    console.log('📄 Creating grade_comments table...');
    await query(`
      CREATE TABLE IF NOT EXISTS grade_comments (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          grade_id UUID NOT NULL REFERENCES grades(id) ON DELETE CASCADE,
          comment TEXT NOT NULL,
          comment_type VARCHAR(20) DEFAULT 'general' CHECK (comment_type IN ('general', 'improvement', 'strength', 'concern')),
          created_by UUID NOT NULL REFERENCES users(id),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ grade_comments table created');

    // 6. Create attendance_records table
    console.log('📄 Creating attendance_records table...');
    await query(`
      CREATE TABLE IF NOT EXISTS attendance_records (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
          student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
          class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
          subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
          academic_year_id UUID REFERENCES academic_years(id) ON DELETE CASCADE,
          academic_term_id UUID REFERENCES academic_terms(id) ON DELETE CASCADE,
          date DATE NOT NULL,
          session_type VARCHAR(20) DEFAULT 'full_day' CHECK (session_type IN ('morning', 'afternoon', 'full_day', 'period')),
          status VARCHAR(20) DEFAULT 'present' CHECK (status IN ('present', 'absent', 'late', 'excused', 'sick')),
          arrival_time TIME,
          departure_time TIME,
          notes TEXT,
          marked_by UUID NOT NULL REFERENCES users(id),
          marked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT unique_student_date_session UNIQUE (student_id, date, session_type, subject_id)
      )
    `);
    console.log('✅ attendance_records table created');

    // 7. Create remedial_sessions table
    console.log('📄 Creating remedial_sessions table...');
    await query(`
      CREATE TABLE IF NOT EXISTS remedial_sessions (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
          title VARCHAR(255) NOT NULL,
          description TEXT,
          class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
          subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
          teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          academic_year_id UUID REFERENCES academic_years(id) ON DELETE CASCADE,
          academic_term_id UUID REFERENCES academic_terms(id) ON DELETE CASCADE,
          session_date DATE NOT NULL,
          start_time TIME NOT NULL,
          end_time TIME NOT NULL,
          location VARCHAR(255),
          max_students INTEGER DEFAULT 30,
          status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
          objectives TEXT,
          materials_needed TEXT,
          created_by UUID NOT NULL REFERENCES users(id),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ remedial_sessions table created');

    // Create essential indexes
    console.log('📄 Creating indexes...');
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_grade_categories_school ON grade_categories(school_id)',
      'CREATE INDEX IF NOT EXISTS idx_assessments_school ON assessments(school_id)',
      'CREATE INDEX IF NOT EXISTS idx_assessments_class ON assessments(class_id)',
      'CREATE INDEX IF NOT EXISTS idx_assessments_subject ON assessments(subject_id)',
      'CREATE INDEX IF NOT EXISTS idx_grades_school ON grades(school_id)',
      'CREATE INDEX IF NOT EXISTS idx_grades_student ON grades(student_id)',
      'CREATE INDEX IF NOT EXISTS idx_grades_assessment ON grades(assessment_id)',
      'CREATE INDEX IF NOT EXISTS idx_attendance_records_school ON attendance_records(school_id)',
      'CREATE INDEX IF NOT EXISTS idx_attendance_records_student ON attendance_records(student_id)',
      'CREATE INDEX IF NOT EXISTS idx_attendance_records_date ON attendance_records(date)',
      'CREATE INDEX IF NOT EXISTS idx_remedial_sessions_school ON remedial_sessions(school_id)',
      'CREATE INDEX IF NOT EXISTS idx_remedial_sessions_class ON remedial_sessions(class_id)'
    ];

    for (const indexSQL of indexes) {
      try {
        await query(indexSQL);
      } catch (error) {
        if (!error.message.includes('already exists')) {
          console.log(`⚠️  Index issue: ${error.message.substring(0, 50)}...`);
        }
      }
    }
    console.log('✅ Indexes created');

    // Insert some default grade categories
    console.log('📄 Inserting default grade categories...');
    const adminResult = await query(`
      SELECT s.id as school_id, u.id as user_id
      FROM schools s
      JOIN users u ON s.id = u.school_id
      WHERE u.role IN ('principal', 'school_director', 'admin')
      ORDER BY s.id, u.created_at
    `);

    for (const admin of adminResult.rows) {
      const categories = [
        { name: 'Assignments', description: 'Regular assignments and homework', weight: 20.00 },
        { name: 'Quizzes', description: 'Short quizzes and tests', weight: 30.00 },
        { name: 'Exams', description: 'Major examinations', weight: 50.00 }
      ];

      for (const category of categories) {
        try {
          await query(`
            INSERT INTO grade_categories (school_id, name, description, weight, created_by) 
            VALUES ($1, $2, $3, $4, $5)
          `, [admin.school_id, category.name, category.description, category.weight, admin.user_id]);
        } catch (error) {
          if (!error.message.includes('duplicate key')) {
            console.log(`⚠️  Category insertion issue: ${error.message.substring(0, 50)}...`);
          }
        }
      }
    }
    console.log('✅ Default grade categories inserted');

    // Verify all tables were created
    const result = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN (
        'grade_categories', 'assessments', 'grades', 'grade_approvals', 
        'grade_comments', 'attendance_records', 'remedial_sessions'
      )
      ORDER BY table_name
    `);
    
    console.log('\n📋 Verification:');
    result.rows.forEach(row => {
      console.log(`   ✓ ${row.table_name} table exists`);
    });

    console.log('\n🎉 All missing academic tables created successfully!');
    
  } catch (error) {
    console.error('❌ Error creating academic tables:', error.message);
    throw error;
  } finally {
    await closePool();
  }
}

createMissingAcademicTables().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});