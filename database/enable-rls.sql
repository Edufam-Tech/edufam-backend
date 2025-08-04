-- Enable Row Level Security on all sensitive tables
-- This ensures multi-tenant data isolation

-- Enable RLS on users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Enable RLS on students table  
ALTER TABLE students ENABLE ROW LEVEL SECURITY;

-- Enable RLS on staff table
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;

-- Enable RLS on user_sessions table
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- Enable RLS on audit_logs table
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Enable RLS on file_uploads table
ALTER TABLE file_uploads ENABLE ROW LEVEL SECURITY;

-- Enable RLS on school_subscriptions table
ALTER TABLE school_subscriptions ENABLE ROW LEVEL SECURITY;

-- Schools table - only accessible by admin users and school directors
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for multi-tenant access control

-- Users table policies
CREATE POLICY "users_isolation_policy" ON users
  FOR ALL 
  USING (
    -- Admin users can see all users
    (EXISTS (SELECT 1 FROM users u WHERE u.id = current_setting('app.current_user_id')::UUID AND u.user_type = 'admin_user')) OR
    -- School users can only see users from their school
    (school_id = (SELECT school_id FROM users WHERE id = current_setting('app.current_user_id')::UUID)) OR
    -- Users can always see their own record
    (id = current_setting('app.current_user_id')::UUID)
  );

-- Students table policies  
CREATE POLICY "students_school_isolation" ON students
  FOR ALL
  USING (
    -- Admin users can see all students
    (EXISTS (SELECT 1 FROM users u WHERE u.id = current_setting('app.current_user_id')::UUID AND u.user_type = 'admin_user')) OR
    -- School users can only see students from their school
    (school_id = (SELECT school_id FROM users WHERE id = current_setting('app.current_user_id')::UUID)) OR
    -- Parents can see their own children
    (parent_id = current_setting('app.current_user_id')::UUID)
  );

-- Staff table policies
CREATE POLICY "staff_school_isolation" ON staff
  FOR ALL
  USING (
    -- Admin users can see all staff
    (EXISTS (SELECT 1 FROM users u WHERE u.id = current_setting('app.current_user_id')::UUID AND u.user_type = 'admin_user')) OR
    -- School users can only see staff from their school
    (school_id = (SELECT school_id FROM users WHERE id = current_setting('app.current_user_id')::UUID)) OR
    -- Staff can see their own record
    (user_id = current_setting('app.current_user_id')::UUID)
  );

-- Schools table policies
CREATE POLICY "schools_access_policy" ON schools
  FOR ALL
  USING (
    -- Admin users can see all schools
    (EXISTS (SELECT 1 FROM users u WHERE u.id = current_setting('app.current_user_id')::UUID AND u.user_type = 'admin_user')) OR
    -- School users can only see their own school
    (id = (SELECT school_id FROM users WHERE id = current_setting('app.current_user_id')::UUID))
  );

-- User sessions policies
CREATE POLICY "user_sessions_isolation" ON user_sessions
  FOR ALL
  USING (
    -- Users can only see their own sessions
    (user_id = current_setting('app.current_user_id')::UUID) OR
    -- Super admin can see all sessions for security monitoring
    (EXISTS (SELECT 1 FROM users u WHERE u.id = current_setting('app.current_user_id')::UUID AND u.role = 'super_admin'))
  );

-- Audit logs policies
CREATE POLICY "audit_logs_policy" ON audit_logs
  FOR SELECT
  USING (
    -- Super admin can see all audit logs
    (EXISTS (SELECT 1 FROM users u WHERE u.id = current_setting('app.current_user_id')::UUID AND u.role = 'super_admin')) OR
    -- Users can see their own activities
    (user_id = current_setting('app.current_user_id')::UUID) OR
    -- School directors can see school-related activities
    (EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = current_setting('app.current_user_id')::UUID
      AND u.role = 'school_director' 
      AND EXISTS (
        SELECT 1 FROM users target_user 
        WHERE target_user.id = audit_logs.user_id 
        AND target_user.school_id = u.school_id
      )
    ))
  );

-- File uploads policies
CREATE POLICY "file_uploads_policy" ON file_uploads
  FOR ALL
  USING (
    -- Users can access their own uploads
    (user_id = current_setting('app.current_user_id')::UUID) OR
    -- Admin users can access all uploads
    (EXISTS (SELECT 1 FROM users u WHERE u.id = current_setting('app.current_user_id')::UUID AND u.user_type = 'admin_user')) OR
    -- School users can access uploads from their school members
    (EXISTS (
      SELECT 1 FROM users uploader, users accessor
      WHERE uploader.id = file_uploads.user_id
      AND accessor.id = current_setting('app.current_user_id')::UUID
      AND uploader.school_id = accessor.school_id
    ))
  );

-- School subscriptions policies
CREATE POLICY "subscription_isolation" ON school_subscriptions
  FOR ALL
  USING (
    -- Admin users can see all subscriptions
    (EXISTS (SELECT 1 FROM users u WHERE u.id = current_setting('app.current_user_id')::UUID AND u.user_type = 'admin_user')) OR
    -- School users can only see their school's subscription
    (school_id = (SELECT school_id FROM users WHERE id = current_setting('app.current_user_id')::UUID))
  );

-- Password reset tokens policies (no RLS needed - handled by application logic)
-- Maintenance mode policies (no RLS needed - system-wide)
-- System settings policies (no RLS needed - global settings)
-- Subscription plans policies (no RLS needed - global templates)

-- Note: These RLS policies use current_setting('app.current_user_id') to get the current user ID
-- When the authentication system is implemented, this should be set by the application
-- For now, RLS is enabled but policies will only work when the user context is properly set

-- Create helper function for current user's school_id
CREATE OR REPLACE FUNCTION public.current_user_school_id()
RETURNS UUID
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT school_id FROM users WHERE id = current_setting('app.current_user_id')::UUID;
$$;

-- Create helper function to check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM users 
    WHERE id = current_setting('app.current_user_id')::UUID
    AND user_type = 'admin_user'
  );
$$;

-- Create helper function to check specific role
CREATE OR REPLACE FUNCTION public.has_role(required_role TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM users 
    WHERE id = current_setting('app.current_user_id')::UUID
    AND role = required_role
  );
$$;

-- Log RLS setup completion
INSERT INTO audit_logs (user_id, action, table_name, new_values) VALUES 
(NULL, 'RLS_ENABLED', 'system', '{"message": "Row Level Security policies created", "tables": ["users", "students", "staff", "schools", "user_sessions", "audit_logs", "file_uploads", "school_subscriptions"]}');

-- Verify RLS is enabled
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('users', 'students', 'staff', 'schools', 'user_sessions', 'audit_logs', 'file_uploads', 'school_subscriptions')
ORDER BY tablename; 