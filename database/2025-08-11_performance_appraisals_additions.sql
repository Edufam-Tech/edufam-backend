-- Add missing columns used by PerformanceController on performance_appraisals

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='performance_appraisals' AND column_name='self_assessment_completed'
  ) THEN
    ALTER TABLE performance_appraisals
      ADD COLUMN self_assessment_completed BOOLEAN DEFAULT false,
      ADD COLUMN self_assessment_date TIMESTAMPTZ,
      ADD COLUMN self_assessment_data JSONB,
      ADD COLUMN self_assessment_comments TEXT,
      ADD COLUMN supervisor_review_completed BOOLEAN DEFAULT false,
      ADD COLUMN supervisor_review_date TIMESTAMPTZ,
      ADD COLUMN supervisor_review_data JSONB,
      ADD COLUMN supervisor_rating NUMERIC(4,2),
      ADD COLUMN supervisor_comments TEXT,
      ADD COLUMN supervisor_recommendations TEXT,
      ADD COLUMN peer_feedback_completed BOOLEAN DEFAULT false,
      ADD COLUMN peer_feedback_date TIMESTAMPTZ,
      ADD COLUMN reviewed_by UUID,
      ADD COLUMN finalized_by UUID,
      ADD COLUMN final_comments TEXT,
      ADD COLUMN development_plan JSONB,
      ADD COLUMN next_review_date DATE,
      ADD COLUMN overall_rating NUMERIC(4,2);
  END IF;
END $$;

-- Peer feedback table used by controller
CREATE TABLE IF NOT EXISTS peer_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appraisal_id UUID NOT NULL REFERENCES performance_appraisals(id) ON DELETE CASCADE,
  feedback_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  feedback_data JSONB,
  comments TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (appraisal_id, feedback_by)
);


