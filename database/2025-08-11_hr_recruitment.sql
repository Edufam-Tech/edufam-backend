-- HR Recruitment module minimal schema to satisfy HRController recruitment endpoints

CREATE TABLE IF NOT EXISTS recruitment_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  position_title TEXT NOT NULL,
  department_id UUID,
  description TEXT,
  requirements JSONB DEFAULT '[]',
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  approval_notes TEXT,
  rejection_reason TEXT,
  requested_by UUID,
  approved_by UUID,
  rejected_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recruitment_requests_school ON recruitment_requests(school_id);


