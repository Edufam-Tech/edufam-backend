-- Recruitment & ATS Tables
-- Safe-create style: only create if not exists; columns align with controllers

-- Schools table assumed to exist

CREATE TABLE IF NOT EXISTS recruitment_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL,
  position_title TEXT NOT NULL,
  department_id UUID,
  description TEXT,
  requirements JSONB DEFAULT '[]'::jsonb,
  priority TEXT DEFAULT 'normal',
  status TEXT DEFAULT 'pending',
  requested_by UUID,
  approved_by UUID,
  rejected_by UUID,
  approval_notes TEXT,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  approved_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_recruitment_requests_school ON recruitment_requests(school_id);

CREATE TABLE IF NOT EXISTS job_postings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL,
  title TEXT NOT NULL,
  department_id UUID,
  description TEXT,
  requirements JSONB DEFAULT '[]'::jsonb,
  salary_range TEXT,
  application_deadline DATE,
  employment_type TEXT,
  status TEXT DEFAULT 'active',
  posted_by UUID,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_job_postings_school ON job_postings(school_id);
CREATE INDEX IF NOT EXISTS idx_job_postings_status ON job_postings(status);

CREATE TABLE IF NOT EXISTS job_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL,
  job_posting_id UUID NOT NULL,
  applicant_name TEXT NOT NULL,
  applicant_email TEXT NOT NULL,
  applicant_phone TEXT,
  resume_url TEXT,
  cover_letter TEXT,
  application_status TEXT DEFAULT 'submitted',
  shortlist_notes TEXT,
  shortlisted_by UUID,
  applied_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  shortlisted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_job_applications_school ON job_applications(school_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_posting ON job_applications(job_posting_id);

CREATE TABLE IF NOT EXISTS approval_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL,
  request_type TEXT NOT NULL,
  request_category TEXT,
  request_id UUID NOT NULL,
  request_title TEXT,
  request_description TEXT,
  request_data JSONB,
  requested_by UUID,
  priority TEXT DEFAULT 'normal',
  approval_status TEXT DEFAULT 'pending',
  final_approver_id UUID,
  final_approved_at TIMESTAMPTZ,
  final_rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_approval_requests_school ON approval_requests(school_id);
CREATE INDEX IF NOT EXISTS idx_approval_requests_type ON approval_requests(request_type);
CREATE INDEX IF NOT EXISTS idx_approval_requests_status ON approval_requests(approval_status);

CREATE TABLE IF NOT EXISTS interviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL,
  application_id UUID NOT NULL,
  scheduled_date TIMESTAMPTZ NOT NULL,
  interview_type TEXT,
  panel_members JSONB DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'scheduled',
  scheduled_by UUID,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_interviews_school ON interviews(school_id);
CREATE INDEX IF NOT EXISTS idx_interviews_application ON interviews(application_id);

CREATE TABLE IF NOT EXISTS job_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL,
  application_id UUID NOT NULL,
  position TEXT,
  salary NUMERIC,
  start_date DATE,
  terms JSONB,
  status TEXT DEFAULT 'pending',
  generated_by UUID,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_job_offers_school ON job_offers(school_id);
CREATE INDEX IF NOT EXISTS idx_job_offers_application ON job_offers(application_id);

-- Note: For simplicity, explicit foreign keys are omitted to avoid deployment issues if referenced tables vary.

