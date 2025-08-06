const { query, closePool } = require('./src/config/database');

async function applyPrerequisites() {
  try {
    console.log('🚀 Applying prerequisite tables and columns...\n');

    // Create subjects table
    console.log('📄 Creating subjects table...');
    await query(`
      CREATE TABLE IF NOT EXISTS subjects (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
          name VARCHAR(100) NOT NULL,
          code VARCHAR(20) NOT NULL,
          description TEXT,
          category VARCHAR(50) DEFAULT 'core' CHECK (category IN ('core', 'elective', 'co_curricular')),
          level VARCHAR(20) DEFAULT 'secondary' CHECK (level IN ('primary', 'secondary', 'tertiary')),
          credit_hours INTEGER DEFAULT 1,
          prerequisites JSONB DEFAULT '[]',
          is_active BOOLEAN DEFAULT true,
          created_by UUID NOT NULL REFERENCES users(id),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT unique_school_subject_code UNIQUE (school_id, code),
          CONSTRAINT unique_school_subject_name UNIQUE (school_id, name)
      )
    `);
    console.log('✅ Subjects table created');

    // Create departments table
    console.log('📄 Creating departments table...');
    await query(`
      CREATE TABLE IF NOT EXISTS departments (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
          name VARCHAR(100) NOT NULL,
          code VARCHAR(20) NOT NULL,
          description TEXT,
          head_id UUID REFERENCES users(id) ON DELETE SET NULL,
          budget DECIMAL(12,2),
          location VARCHAR(255),
          phone VARCHAR(20),
          email VARCHAR(255),
          is_active BOOLEAN DEFAULT true,
          created_by UUID NOT NULL REFERENCES users(id),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT unique_school_department_code UNIQUE (school_id, code),
          CONSTRAINT unique_school_department_name UNIQUE (school_id, name)
      )
    `);
    console.log('✅ Departments table created');

    // Add admission_number to students table
    console.log('📄 Adding admission_number column to students...');
    try {
      await query(`ALTER TABLE students ADD COLUMN admission_number VARCHAR(50) UNIQUE`);
      console.log('✅ admission_number column added');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('⚠️  admission_number column already exists');
      } else {
        throw error;
      }
    }

    // Add department_id to staff table
    console.log('📄 Adding department_id column to staff...');
    try {
      await query(`ALTER TABLE staff ADD COLUMN department_id UUID REFERENCES departments(id) ON DELETE SET NULL`);
      console.log('✅ department_id column added');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('⚠️  department_id column already exists');
      } else {
        throw error;
      }
    }

    // Create indexes
    console.log('📄 Creating indexes...');
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_subjects_school ON subjects(school_id)',
      'CREATE INDEX IF NOT EXISTS idx_departments_school ON departments(school_id)',
      'CREATE INDEX IF NOT EXISTS idx_students_admission_number ON students(admission_number)',
      'CREATE INDEX IF NOT EXISTS idx_staff_department ON staff(department_id)'
    ];

    for (const indexSQL of indexes) {
      try {
        await query(indexSQL);
      } catch (error) {
        if (!error.message.includes('already exists')) {
          console.log(`⚠️  Index creation issue: ${error.message}`);
        }
      }
    }
    console.log('✅ Indexes created');

    // Insert default data
    console.log('📄 Inserting default subjects and departments...');
    
    // Get first admin user from each school
    const adminResult = await query(`
      SELECT s.id as school_id, u.id as user_id
      FROM schools s
      JOIN users u ON s.id = u.school_id
      WHERE u.role IN ('principal', 'school_director', 'admin')
      ORDER BY s.id, u.created_at
    `);

    for (const admin of adminResult.rows) {
      // Insert default subjects
      const subjects = [
        { name: 'Mathematics', code: 'MATH' },
        { name: 'English', code: 'ENG' },
        { name: 'Science', code: 'SCI' }
      ];

      for (const subject of subjects) {
        try {
          await query(`
            INSERT INTO subjects (school_id, name, code, category, level, created_by) 
            VALUES ($1, $2, $3, 'core', 'secondary', $4)
          `, [admin.school_id, subject.name, subject.code, admin.user_id]);
        } catch (error) {
          if (!error.message.includes('duplicate key')) {
            console.log(`⚠️  Subject insertion issue: ${error.message}`);
          }
        }
      }

      // Insert default departments
      const departments = [
        { name: 'Academic Department', code: 'ACAD', description: 'Main academic department for teaching staff' },
        { name: 'Administration', code: 'ADMIN', description: 'Administrative and support staff' }
      ];

      for (const dept of departments) {
        try {
          await query(`
            INSERT INTO departments (school_id, name, code, description, created_by) 
            VALUES ($1, $2, $3, $4, $5)
          `, [admin.school_id, dept.name, dept.code, dept.description, admin.user_id]);
        } catch (error) {
          if (!error.message.includes('duplicate key')) {
            console.log(`⚠️  Department insertion issue: ${error.message}`);
          }
        }
      }
    }

    console.log('✅ Default data inserted');
    
    // Verify tables were created
    const result = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('subjects', 'departments')
      ORDER BY table_name
    `);
    
    console.log('\n📋 Verification:');
    result.rows.forEach(row => {
      console.log(`   ✓ ${row.table_name} table exists`);
    });

    console.log('\n🎉 Prerequisites applied successfully!');
    
  } catch (error) {
    console.error('❌ Error applying prerequisites:', error.message);
    throw error;
  } finally {
    await closePool();
  }
}

applyPrerequisites().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});