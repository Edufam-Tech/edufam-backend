-- Examinations module schema to satisfy controllers/examinationController.js

-- Examinations master table
CREATE TABLE IF NOT EXISTS examinations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  exam_type TEXT NOT NULL CHECK (exam_type IN ('mid_term','end_term','annual','mock','knec')),
  academic_year TEXT,
  term TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_marks NUMERIC(8,2) NOT NULL DEFAULT 100,
  passing_marks NUMERIC(8,2) NOT NULL DEFAULT 40,
  curriculum_id UUID,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','in_progress','completed')),
  created_by UUID,
  published_by UUID,
  results_published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Examination to classes mapping
CREATE TABLE IF NOT EXISTS examination_classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  examination_id UUID NOT NULL REFERENCES examinations(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (examination_id, class_id)
);

-- Examination to subjects mapping
CREATE TABLE IF NOT EXISTS examination_subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  examination_id UUID NOT NULL REFERENCES examinations(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (examination_id, subject_id)
);

-- Examination schedules (high-level schedule details)
CREATE TABLE IF NOT EXISTS examination_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  examination_id UUID NOT NULL REFERENCES examinations(id) ON DELETE CASCADE,
  subjects JSONB NOT NULL DEFAULT '[]',
  duration TEXT,
  instructions TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','published')),
  published_at TIMESTAMPTZ,
  published_by UUID,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Student registrations per exam
CREATE TABLE IF NOT EXISTS examination_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  examination_id UUID NOT NULL REFERENCES examinations(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  subjects JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'registered' CHECK (status IN ('registered','confirmed','cancelled')),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  registered_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (examination_id, student_id)
);

-- Examination results per subject
CREATE TABLE IF NOT EXISTS examination_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  examination_id UUID NOT NULL REFERENCES examinations(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL,
  marks_obtained NUMERIC(8,2) NOT NULL DEFAULT 0,
  grade TEXT,
  remarks TEXT,
  visible_to_parents BOOLEAN DEFAULT false,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  recorded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (examination_id, student_id, subject_id)
);

-- Question bank for exams
CREATE TABLE IF NOT EXISTS question_bank (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL CHECK (question_type IN ('multiple_choice','true_false','short_answer','essay','practical')),
  difficulty_level TEXT DEFAULT 'medium' CHECK (difficulty_level IN ('easy','medium','hard')),
  correct_answer TEXT,
  options JSONB DEFAULT '[]',
  marks INTEGER DEFAULT 1,
  explanation TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- KNEC integration settings placeholder
CREATE TABLE IF NOT EXISTS knec_integration_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  settings JSONB DEFAULT '{}',
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (school_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_examinations_school ON examinations(school_id);
CREATE INDEX IF NOT EXISTS idx_examination_results_exam ON examination_results(examination_id);
CREATE INDEX IF NOT EXISTS idx_examination_results_student ON examination_results(student_id);
CREATE INDEX IF NOT EXISTS idx_examination_registrations_exam ON examination_registrations(examination_id);


