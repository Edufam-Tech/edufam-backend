-- Minimal performance appraisals schema to satisfy controller queries
-- Appraisal cycles
CREATE TABLE IF NOT EXISTS appraisal_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Appraisals (summary per employee)
CREATE TABLE IF NOT EXISTS appraisals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  cycle_id UUID NOT NULL REFERENCES appraisal_cycles(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'in_progress',
  overall_score NUMERIC(5,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Detailed performance_appraisals (as referenced by performanceController)
CREATE TABLE IF NOT EXISTS performance_appraisals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  cycle_id UUID NOT NULL REFERENCES appraisal_cycles(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  manager_id UUID REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  goals JSONB DEFAULT '[]',
  ratings JSONB DEFAULT '[]',
  comments TEXT,
  submitted_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_appraisal_cycles_school ON appraisal_cycles(school_id);
CREATE INDEX IF NOT EXISTS idx_appraisals_school ON appraisals(school_id);
CREATE INDEX IF NOT EXISTS idx_performance_appraisals_school ON performance_appraisals(school_id);
CREATE INDEX IF NOT EXISTS idx_performance_appraisals_cycle ON performance_appraisals(cycle_id);
CREATE INDEX IF NOT EXISTS idx_performance_appraisals_employee ON performance_appraisals(employee_id);

-- RLS baseline
ALTER TABLE appraisal_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE appraisals ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_appraisals ENABLE ROW LEVEL SECURITY;

-- Simple policies by school_id using app.current_school_id
CREATE POLICY appraisal_cycles_select_policy ON appraisal_cycles
  FOR SELECT USING (school_id = current_setting('app.current_school_id')::uuid);
CREATE POLICY appraisals_select_policy ON appraisals
  FOR SELECT USING (school_id = current_setting('app.current_school_id')::uuid);
CREATE POLICY performance_appraisals_select_policy ON performance_appraisals
  FOR SELECT USING (school_id = current_setting('app.current_school_id')::uuid);

-- Triggers to maintain updated_at
CREATE OR REPLACE FUNCTION set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_appraisal_cycles_timestamp ON appraisal_cycles;
CREATE TRIGGER set_appraisal_cycles_timestamp BEFORE UPDATE ON appraisal_cycles
FOR EACH ROW EXECUTE FUNCTION set_timestamp();

DROP TRIGGER IF EXISTS set_appraisals_timestamp ON appraisals;
CREATE TRIGGER set_appraisals_timestamp BEFORE UPDATE ON appraisals
FOR EACH ROW EXECUTE FUNCTION set_timestamp();

DROP TRIGGER IF EXISTS set_performance_appraisals_timestamp ON performance_appraisals;
CREATE TRIGGER set_performance_appraisals_timestamp BEFORE UPDATE ON performance_appraisals
FOR EACH ROW EXECUTE FUNCTION set_timestamp();


