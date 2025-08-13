-- Create missing tables used by web director/principal controllers if they don't exist

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

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'academic_reports'
  ) THEN
    CREATE TABLE academic_reports (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
      student_id UUID REFERENCES students(id) ON DELETE SET NULL,
      overall_score NUMERIC(5,2) DEFAULT 0,
      term UUID REFERENCES academic_terms(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_academic_reports_school ON academic_reports(school_id);
    CREATE INDEX IF NOT EXISTS idx_academic_reports_term ON academic_reports(term);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'grade_submissions'
  ) THEN
    CREATE TABLE grade_submissions (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
      class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
      subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
      teacher_id UUID REFERENCES users(id) ON DELETE SET NULL,
      assessment_id UUID REFERENCES assessments(id) ON DELETE SET NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','approved','rejected')),
      approval_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending','approved','rejected')),
      submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      approved_by UUID REFERENCES users(id),
      approved_at TIMESTAMP,
      approval_comments TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_grade_submissions_school ON grade_submissions(school_id);
    CREATE INDEX IF NOT EXISTS idx_grade_submissions_status ON grade_submissions(status);
    CREATE INDEX IF NOT EXISTS idx_grade_submissions_approval ON grade_submissions(approval_status);
  END IF;
END $$;


