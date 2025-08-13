const { Pool } = require('pg');
require('dotenv').config();

async function createHrJobTables() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/edufam_db'
  });

  try {
    console.log('🔌 Connecting to database...');
    const client = await pool.connect();
    client.release();
    console.log('✅ Connected');

    // Ensure pgcrypto for gen_random_uuid
    await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');

    console.log('📦 Creating HR job tables if missing...');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS job_postings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
        description TEXT,
        requirements JSONB,
        salary_range VARCHAR(100),
        application_deadline DATE,
        employment_type VARCHAR(50),
        status VARCHAR(20) DEFAULT 'active',
        posted_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS job_applications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        job_posting_id UUID NOT NULL REFERENCES job_postings(id) ON DELETE CASCADE,
        applicant_name VARCHAR(255) NOT NULL,
        applicant_email VARCHAR(255) NOT NULL,
        applicant_phone VARCHAR(50),
        resume_url VARCHAR(500),
        cover_letter TEXT,
        application_status VARCHAR(30) DEFAULT 'submitted',
        shortlist_notes TEXT,
        applied_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS interviews (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        application_id UUID NOT NULL REFERENCES job_applications(id) ON DELETE CASCADE,
        scheduled_date TIMESTAMP NOT NULL,
        interview_type VARCHAR(50),
        panel_members JSONB,
        status VARCHAR(30) DEFAULT 'scheduled',
        scheduled_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS job_offers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        application_id UUID NOT NULL REFERENCES job_applications(id) ON DELETE CASCADE,
        position VARCHAR(255) NOT NULL,
        salary VARCHAR(100),
        start_date DATE,
        terms JSONB,
        status VARCHAR(30) DEFAULT 'pending',
        generated_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Helpful indexes
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_job_postings_school ON job_postings(school_id)',
      "CREATE INDEX IF NOT EXISTS idx_job_postings_status ON job_postings(status)",
      'CREATE INDEX IF NOT EXISTS idx_job_applications_posting ON job_applications(job_posting_id)',
      'CREATE INDEX IF NOT EXISTS idx_job_applications_school ON job_applications(school_id)',
      'CREATE INDEX IF NOT EXISTS idx_interviews_application ON interviews(application_id)'
    ];
    for (const sql of indexes) {
      await pool.query(sql);
    }

    console.log('🎉 HR job tables ensured.');
  } catch (err) {
    console.error('❌ Failed to create HR job tables:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

createHrJobTables();



