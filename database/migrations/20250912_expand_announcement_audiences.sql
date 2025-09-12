-- Expand announcements.target_audience allowed values to support company targeting
-- Applies safely by dropping and recreating the CHECK constraint if it exists

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage 
    WHERE table_name = 'announcements' AND column_name = 'target_audience'
  ) THEN
    -- Try best-effort drop known constraint names
    BEGIN
      ALTER TABLE announcements DROP CONSTRAINT IF EXISTS announcements_target_audience_check;
    EXCEPTION WHEN undefined_object THEN
      -- ignore
    END;
  END IF;

  ALTER TABLE announcements
  ADD CONSTRAINT announcements_target_audience_check
  CHECK (target_audience IN (
    'all',
    'school_users',
    'staff',
    'administrative_staff',
    'teaching_staff',
    'management',
    'parents',
    'parent',
    'teachers',
    'teacher',
    'principals',
    'principal',
    'school_directors',
    'school_director',
    'hr_staff',
    'hr',
    'finance_staff',
    'finance'
  ));
END $$;


