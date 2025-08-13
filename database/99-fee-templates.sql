-- Create fee_templates table if it doesn't exist
CREATE TABLE IF NOT EXISTS fee_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL,
  name TEXT NOT NULL,
  curriculum_type TEXT NOT NULL,
  grade_level TEXT NOT NULL,
  fees JSONB NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

-- Helpful index
CREATE INDEX IF NOT EXISTS idx_fee_templates_school_curriculum_grade
  ON fee_templates (school_id, curriculum_type, grade_level);


