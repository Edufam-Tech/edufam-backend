-- School Calendar Events table and indexes
CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  start_at TIMESTAMP WITH TIME ZONE NOT NULL,
  end_at TIMESTAMP WITH TIME ZONE NOT NULL,
  all_day BOOLEAN DEFAULT false,
  type TEXT NOT NULL CHECK (type IN ('academic','exam','holiday','meeting','event')),
  curriculum TEXT,
  class_ids UUID[] DEFAULT '{}',
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_calendar_events_school ON calendar_events(school_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_timerange ON calendar_events(start_at, end_at);
CREATE INDEX IF NOT EXISTS idx_calendar_events_type ON calendar_events(type);

-- RLS
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
-- Only school users can access their school's events
CREATE POLICY calendar_events_select_policy ON calendar_events
  FOR SELECT USING (school_id = current_setting('app.current_school_id')::uuid);
CREATE POLICY calendar_events_insert_policy ON calendar_events
  FOR INSERT WITH CHECK (school_id = current_setting('app.current_school_id')::uuid);
CREATE POLICY calendar_events_update_policy ON calendar_events
  FOR UPDATE USING (school_id = current_setting('app.current_school_id')::uuid);
CREATE POLICY calendar_events_delete_policy ON calendar_events
  FOR DELETE USING (school_id = current_setting('app.current_school_id')::uuid);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_calendar_events_timestamp ON calendar_events;
CREATE TRIGGER set_calendar_events_timestamp
BEFORE UPDATE ON calendar_events
FOR EACH ROW EXECUTE FUNCTION set_timestamp();


