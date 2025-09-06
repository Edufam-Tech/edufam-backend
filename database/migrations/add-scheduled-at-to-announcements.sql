-- Migration: Add scheduled_at column to announcements table
-- Date: 2024-01-XX
-- Description: Add scheduling capability to announcements

-- Add scheduled_at column to announcements table
ALTER TABLE announcements 
ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP;

-- Add index for scheduled announcements
CREATE INDEX IF NOT EXISTS idx_announcements_scheduled_at ON announcements(scheduled_at);

-- Add comment
COMMENT ON COLUMN announcements.scheduled_at IS 'When the announcement should be published (for scheduled announcements)';

-- Update the check constraint to include new scheduling options
-- Note: This might require dropping and recreating the constraint in some databases
-- ALTER TABLE announcements DROP CONSTRAINT IF EXISTS announcements_target_audience_check;
-- ALTER TABLE announcements ADD CONSTRAINT announcements_target_audience_check 
-- CHECK (target_audience IN ('all', 'students', 'parents', 'teachers', 'staff', 'school_director', 'principal', 'teacher', 'hr', 'finance', 'parent'));
