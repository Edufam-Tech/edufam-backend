# Database Migration Guide

## Quick Fix for Migration Error

The original migration had a syntax error with `IF NOT EXISTS` in `ALTER TABLE`. Here are three ways to fix it:

## Option 1: Use the Migration Runner Script (Recommended)

```bash
cd edufam-backend
node run-migration.js
```

This script:

- ✅ Handles the constraint issue automatically
- ✅ Drops existing table if it exists (clean migration)
- ✅ Creates all tables, indexes, functions, and policies
- ✅ Tests the migration
- ✅ Provides detailed feedback

## Option 2: Use the Simple Migration File

```bash
psql -d your_database -f database/migrations/20250115_create_refresh_tokens_simple.sql
```

This file:

- ✅ Drops existing table first (clean slate)
- ✅ Creates table with proper constraints
- ✅ No complex `IF NOT EXISTS` logic
- ✅ More reliable for one-time migration

## Option 3: Manual SQL Commands

If you prefer to run commands manually:

```sql
-- 1. Drop existing table if it exists
DROP TABLE IF EXISTS refresh_tokens CASCADE;

-- 2. Create the table
CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    revoked BOOLEAN DEFAULT FALSE,
    revoked_at TIMESTAMP WITH TIME ZONE NULL,
    device_info JSONB,
    ip_address INET,
    user_agent TEXT
);

-- 3. Add foreign key constraint
ALTER TABLE refresh_tokens
ADD CONSTRAINT refresh_tokens_user_id_fkey
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- 4. Create indexes
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);
CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);
CREATE INDEX idx_refresh_tokens_revoked ON refresh_tokens(revoked);
CREATE INDEX idx_refresh_tokens_user_active ON refresh_tokens(user_id, revoked, expires_at);

-- 5. Enable RLS
ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;

-- 6. Create RLS policies
CREATE POLICY refresh_tokens_user_policy ON refresh_tokens
    FOR ALL
    TO authenticated
    USING (user_id = current_setting('app.current_user_id')::UUID);

CREATE POLICY refresh_tokens_system_policy ON refresh_tokens
    FOR ALL
    TO service_role
    USING (true);
```

## Verify Migration Success

After running the migration, test it:

```bash
# Test the migration
node test-migration.js

# Test JWT authentication
node test-jwt-auth.js
```

## What the Migration Creates

### Table: `refresh_tokens`

- Stores hashed refresh tokens for JWT authentication
- Links to users table via foreign key
- Includes device info, IP address, user agent
- Tracks creation, expiration, and revocation

### Indexes

- `idx_refresh_tokens_user_id` - Fast user lookups
- `idx_refresh_tokens_token_hash` - Fast token lookups
- `idx_refresh_tokens_expires_at` - Fast expiration queries
- `idx_refresh_tokens_revoked` - Fast revocation queries
- `idx_refresh_tokens_user_active` - Fast active token queries

### Functions

- `cleanup_expired_refresh_tokens()` - Clean up expired tokens
- `revoke_user_refresh_tokens(user_id)` - Revoke all user tokens
- `revoke_refresh_token(token_hash)` - Revoke specific token

### Security

- Row Level Security (RLS) enabled
- Users can only see their own tokens
- System role can manage all tokens

### Monitoring

- `active_refresh_tokens` view for monitoring active sessions

## Troubleshooting

### If you get "relation does not exist" error:

- Make sure the `users` table exists first
- Check your database connection

### If you get permission errors:

- Make sure you have CREATE privileges
- Check if you're connected as the right user

### If you get constraint errors:

- The migration runner script handles this automatically
- Or use the simple migration file

## Next Steps

1. **Run the migration** using one of the options above
2. **Set environment variables** in Railway:
   ```bash
   DATABASE_URL_SESSION=your_session_pooler_url
   JWT_SECRET=your_jwt_secret
   JWT_REFRESH_SECRET=your_refresh_secret
   USE_COOKIE_SESSIONS=false
   ```
3. **Deploy the backend** with the new JWT authentication
4. **Update frontend apps** with the new configurations
5. **Test the complete flow**

## Files Created

- `database/migrations/20250115_create_refresh_tokens.sql` - Original migration (fixed)
- `database/migrations/20250115_create_refresh_tokens_simple.sql` - Simple version
- `run-migration.js` - Migration runner script
- `test-migration.js` - Migration tester
- `test-jwt-auth.js` - JWT authentication tester
