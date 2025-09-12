-- Migration: Create refresh_tokens table for JWT authentication
-- Date: 2025-01-15
-- Description: Creates a table to store hashed refresh tokens for stateless JWT authentication

-- Create refresh_tokens table
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL, -- Hashed refresh token for security
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    revoked BOOLEAN DEFAULT FALSE,
    revoked_at TIMESTAMP WITH TIME ZONE NULL,
    device_info JSONB, -- Store device information (IP, user agent, etc.)
    ip_address INET,
    user_agent TEXT,
    
    -- Indexes for performance
);

-- Add foreign key constraint (only if it doesn't exist)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'refresh_tokens_user_id_fkey'
    ) THEN
        ALTER TABLE refresh_tokens 
        ADD CONSTRAINT refresh_tokens_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_revoked ON refresh_tokens(revoked);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_active ON refresh_tokens(user_id, revoked, expires_at);

-- Create a function to clean up expired tokens
CREATE OR REPLACE FUNCTION cleanup_expired_refresh_tokens()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM refresh_tokens 
    WHERE expires_at < NOW() OR revoked = TRUE;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Log cleanup activity
    INSERT INTO audit_logs (
        table_name, 
        operation, 
        details, 
        created_at
    ) VALUES (
        'refresh_tokens', 
        'CLEANUP', 
        jsonb_build_object('deleted_count', deleted_count), 
        NOW()
    );
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create a function to revoke all tokens for a user
CREATE OR REPLACE FUNCTION revoke_user_refresh_tokens(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    revoked_count INTEGER;
BEGIN
    UPDATE refresh_tokens 
    SET revoked = TRUE, revoked_at = NOW()
    WHERE user_id = p_user_id AND revoked = FALSE;
    
    GET DIAGNOSTICS revoked_count = ROW_COUNT;
    
    -- Log revocation activity
    INSERT INTO audit_logs (
        table_name, 
        operation, 
        user_id,
        details, 
        created_at
    ) VALUES (
        'refresh_tokens', 
        'REVOKE_ALL', 
        p_user_id,
        jsonb_build_object('revoked_count', revoked_count), 
        NOW()
    );
    
    RETURN revoked_count;
END;
$$ LANGUAGE plpgsql;

-- Create a function to revoke a specific token
CREATE OR REPLACE FUNCTION revoke_refresh_token(p_token_hash VARCHAR(255))
RETURNS BOOLEAN AS $$
DECLARE
    token_exists BOOLEAN;
BEGIN
    UPDATE refresh_tokens 
    SET revoked = TRUE, revoked_at = NOW()
    WHERE token_hash = p_token_hash AND revoked = FALSE;
    
    GET DIAGNOSTICS token_exists = FOUND;
    
    -- Log revocation activity
    IF token_exists THEN
        INSERT INTO audit_logs (
            table_name, 
            operation, 
            details, 
            created_at
        ) VALUES (
            'refresh_tokens', 
            'REVOKE_TOKEN', 
            jsonb_build_object('token_hash', p_token_hash), 
            NOW()
        );
    END IF;
    
    RETURN token_exists;
END;
$$ LANGUAGE plpgsql;

-- Add RLS policies for refresh_tokens table
ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own refresh tokens
CREATE POLICY refresh_tokens_user_policy ON refresh_tokens
    FOR ALL
    TO authenticated
    USING (user_id = current_setting('app.current_user_id')::UUID);

-- Policy: System can manage all refresh tokens (for cleanup, etc.)
CREATE POLICY refresh_tokens_system_policy ON refresh_tokens
    FOR ALL
    TO service_role
    USING (true);

-- Create a view for active refresh tokens (for monitoring)
CREATE OR REPLACE VIEW active_refresh_tokens AS
SELECT 
    rt.id,
    rt.user_id,
    u.email,
    u.role,
    rt.created_at,
    rt.expires_at,
    rt.device_info,
    rt.ip_address,
    rt.user_agent,
    (rt.expires_at - NOW()) AS time_until_expiry
FROM refresh_tokens rt
JOIN users u ON rt.user_id = u.id
WHERE rt.revoked = FALSE 
  AND rt.expires_at > NOW()
ORDER BY rt.created_at DESC;

-- Add comments for documentation
COMMENT ON TABLE refresh_tokens IS 'Stores hashed refresh tokens for JWT authentication';
COMMENT ON COLUMN refresh_tokens.token_hash IS 'Bcrypt hashed refresh token for security';
COMMENT ON COLUMN refresh_tokens.device_info IS 'JSON object containing device information (IP, user agent, etc.)';
COMMENT ON COLUMN refresh_tokens.revoked IS 'Whether the token has been manually revoked';
COMMENT ON COLUMN refresh_tokens.revoked_at IS 'Timestamp when the token was revoked';

COMMENT ON FUNCTION cleanup_expired_refresh_tokens() IS 'Cleans up expired and revoked refresh tokens';
COMMENT ON FUNCTION revoke_user_refresh_tokens(UUID) IS 'Revokes all refresh tokens for a specific user';
COMMENT ON FUNCTION revoke_refresh_token(VARCHAR) IS 'Revokes a specific refresh token by hash';

COMMENT ON VIEW active_refresh_tokens IS 'View showing all active (non-revoked, non-expired) refresh tokens with user information';
