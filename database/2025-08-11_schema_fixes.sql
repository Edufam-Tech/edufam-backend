-- Compatibility fixes to align DB schema with controllers/models

-- Ensure students.user_id exists for joins to users
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name = 'students' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE students ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_students_user ON students(user_id);
  END IF;
END $$;

-- Ensure grades.created_by exists for audit joins
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name = 'grades' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE grades ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_grades_created_by ON grades(created_by);
  END IF;
END $$;

-- Provide a lightweight view to satisfy LEFT JOIN curriculums in ExaminationController
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_views WHERE viewname = 'curriculums'
  ) THEN
    CREATE VIEW curriculums AS
      SELECT id, curriculum_name AS name
      FROM curriculum_systems;
  END IF;
END $$;


