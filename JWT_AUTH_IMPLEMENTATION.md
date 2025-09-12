# Edufam JWT Authentication Implementation

## Overview

This document describes the implementation of stateless JWT authentication for the Edufam platform, including dual database connection pools, canonical JWT auth endpoints, and comprehensive monitoring.

## Environment Variables

### Required Environment Variables

```bash
# Database Configuration
DATABASE_URL_SESSION=postgresql://user:password@host:5432/database  # Session pooler (port 5432)
DATABASE_URL_TRANSACTION=postgresql://user:password@host:6453/database  # Transaction pooler (port 6453, optional)

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-here
JWT_REFRESH_SECRET=your-super-secret-refresh-key-here
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Authentication Mode
USE_COOKIE_SESSIONS=false  # Set to true for cookie-based sessions, false for JWT

# CORS Configuration
ALLOWED_ORIGINS=https://www.edufam.org,https://admin.edufam.org,https://school.edufam.org

# Database Pool Configuration
DB_POOL_MAX=10
DB_POOL_MIN=1
DB_IDLE_TIMEOUT_MS=30000
DB_CONN_TIMEOUT_MS=60000
```

### Optional Environment Variables

```bash
# Session Configuration (only used if USE_COOKIE_SESSIONS=true)
SESSION_SECRET=your-session-secret-here

# Application URLs
SCHOOL_APP_URL=https://school.edufam.org
ADMIN_APP_URL=https://admin.edufam.org
BACKEND_URL=https://backend.edufam.org
```

## Database Schema Changes

### New Table: refresh_tokens

The `refresh_tokens` table stores hashed refresh tokens for security:

```sql
CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL, -- Bcrypt hashed refresh token
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    revoked BOOLEAN DEFAULT FALSE,
    revoked_at TIMESTAMP WITH TIME ZONE NULL,
    device_info JSONB,
    ip_address INET,
    user_agent TEXT
);
```

### Migration

Run the migration to create the refresh_tokens table:

```bash
# Apply the migration
psql -d your_database -f database/migrations/20250115_create_refresh_tokens.sql
```

## API Endpoints

### Authentication Endpoints

#### POST /api/auth/login

Login with email and password, returns JWT tokens.

**Request:**

```json
{
  "email": "user@example.com",
  "password": "password123",
  "userType": "school_user"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "role": "teacher",
      "userType": "school_user",
      "schoolId": "uuid"
    },
    "tokens": {
      "accessToken": "jwt-access-token",
      "refreshToken": "jwt-refresh-token",
      "expiresIn": "15m",
      "tokenType": "Bearer"
    }
  },
  "message": "Login successful"
}
```

#### GET /api/auth/me

Get current user information (requires JWT token).

**Headers:**

```
Authorization: Bearer <access-token>
```

**Response:**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "role": "teacher",
      "userType": "school_user",
      "schoolId": "uuid"
    },
    "sessions": [...]
  }
}
```

#### POST /api/auth/refresh-token

Refresh access token using refresh token.

**Request:**

```json
{
  "refreshToken": "jwt-refresh-token"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "tokens": {
      "accessToken": "new-jwt-access-token",
      "refreshToken": "new-jwt-refresh-token",
      "expiresIn": "15m",
      "tokenType": "Bearer"
    }
  },
  "message": "Token refreshed successfully"
}
```

#### POST /api/auth/logout

Logout and revoke refresh token.

**Request:**

```json
{
  "refreshToken": "jwt-refresh-token"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

### Health Check Endpoints

#### GET /health

General health check.

**Response:**

```json
{
  "status": "OK",
  "message": "Edufam Backend Server is running",
  "database": "Connected",
  "security": {
    "maintenance": false,
    "rateLimit": "Active",
    "cors": "Configured",
    "headers": "Secured",
    "tokenCleanup": "Active"
  },
  "timestamp": "2025-01-15T10:30:00.000Z",
  "environment": "production",
  "version": "1.0.0"
}
```

#### GET /api/health/database

Database connection health check.

**Response:**

```json
{
  "status": "OK",
  "message": "Database connection successful",
  "database": {
    "connected": true,
    "current_time": "2025-01-15T10:30:00.000Z",
    "version": "PostgreSQL 15.4",
    "name": "edufam_db"
  },
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

#### GET /api/health/pool-stats

Database pool statistics.

**Response:**

```json
{
  "status": "OK",
  "message": "Pool statistics retrieved successfully",
  "pools": {
    "session": {
      "totalCount": 5,
      "idleCount": 3,
      "waitingCount": 0
    },
    "transaction": {
      "totalCount": 2,
      "idleCount": 2,
      "waitingCount": 0
    }
  },
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

## Testing

### cURL Examples

#### 1. Health Check

```bash
curl -X GET https://backend.edufam.org/health
```

#### 2. Database Health Check

```bash
curl -X GET https://backend.edufam.org/api/health/database
```

#### 3. Pool Statistics

```bash
curl -X GET https://backend.edufam.org/api/health/pool-stats
```

#### 4. Login

```bash
curl -X POST https://backend.edufam.org/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "teacher@school.com",
    "password": "password123",
    "userType": "school_user"
  }'
```

#### 5. Get Current User (with JWT)

```bash
curl -X GET https://backend.edufam.org/api/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

#### 6. Refresh Token

```bash
curl -X POST https://backend.edufam.org/api/auth/refresh-token \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "YOUR_REFRESH_TOKEN"
  }'
```

#### 7. Logout

```bash
curl -X POST https://backend.edufam.org/api/auth/logout \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "YOUR_REFRESH_TOKEN"
  }'
```

### Expected Responses

#### Successful Login Response

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "email": "teacher@school.com",
      "role": "teacher",
      "userType": "school_user",
      "schoolId": "123e4567-e89b-12d3-a456-426614174001"
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "expiresIn": "15m",
      "tokenType": "Bearer"
    }
  },
  "message": "Login successful"
}
```

## Troubleshooting

### Database Connection Issues

1. **Check DATABASE_URL_SESSION value:**

   ```bash
   echo $DATABASE_URL_SESSION
   ```

2. **Verify pooler port (5432 for session, 6453 for transaction):**

   ```bash
   # Test session pooler
   psql "postgresql://user:password@host:5432/database" -c "SELECT NOW();"

   # Test transaction pooler (if configured)
   psql "postgresql://user:password@host:6453/database" -c "SELECT NOW();"
   ```

3. **Check firewall and network connectivity:**

   ```bash
   telnet your-db-host 5432
   telnet your-db-host 6453
   ```

4. **Verify service roles and permissions:**
   - Ensure the database user has proper permissions
   - Check if the database is paused/inactive (Supabase)

### JWT Authentication Issues

1. **Check JWT_SECRET is set:**

   ```bash
   echo $JWT_SECRET
   ```

2. **Verify token format:**
   - Access tokens should be in `Authorization: Bearer <token>` format
   - Refresh tokens should be sent in request body

3. **Check token expiration:**
   - Access tokens expire in 15 minutes by default
   - Refresh tokens expire in 7 days by default

### CORS Issues

1. **Check ALLOWED_ORIGINS configuration:**

   ```bash
   echo $ALLOWED_ORIGINS
   ```

2. **Verify frontend is sending requests to correct origin:**
   - Check browser network tab for CORS errors
   - Ensure frontend is using correct API base URL

### Pool Monitoring

1. **Check pool statistics:**

   ```bash
   curl -X GET https://backend.edufam.org/api/health/pool-stats
   ```

2. **Monitor pool usage:**
   - `totalCount`: Total connections in pool
   - `idleCount`: Available connections
   - `waitingCount`: Requests waiting for connection

3. **Recommended pool sizes for Railway:**
   - Start with 6-12 connections
   - Increase only with monitoring
   - Monitor connection usage patterns

## Frontend Configuration

### React/Next.js Configuration

Update your frontend environment variables:

```bash
# .env.local
VITE_API_BASE_URL=https://backend.edufam.org/api
NEXT_PUBLIC_API_URL=https://backend.edufam.org/api
```

### Axios Configuration

```javascript
// Remove withCredentials for JWT mode
const api = axios.create({
  baseURL: process.env.VITE_API_BASE_URL,
  // withCredentials: false, // Remove this line for JWT mode
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor to include JWT token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

### Flutter Mobile Configuration

Update your `api_config.dart`:

```dart
class ApiConfig {
  static const String baseUrl = 'https://backend.edufam.org/api/';

  static Map<String, String> getHeaders(String? accessToken) {
    final headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (accessToken != null) {
      headers['Authorization'] = 'Bearer $accessToken';
    }

    return headers;
  }
}
```

## Security Considerations

1. **Refresh Token Security:**
   - Tokens are hashed with bcrypt before storage
   - Tokens are rotated on each refresh
   - Revoked tokens are immediately invalidated

2. **CORS Configuration:**
   - Credentials only required for cookie-based sessions
   - JWT mode doesn't require credentials
   - Origins are strictly validated

3. **Database Security:**
   - Row Level Security (RLS) enabled
   - User context set for all queries
   - Connection pooling with proper timeouts

## Monitoring and Maintenance

1. **Token Cleanup:**
   - Expired tokens are automatically cleaned up
   - Revoked tokens are immediately invalidated
   - Cleanup runs periodically via cron job

2. **Pool Monitoring:**
   - Monitor pool statistics via `/api/health/pool-stats`
   - Set up alerts for high waiting counts
   - Monitor connection usage patterns

3. **Database Monitoring:**
   - Use `pg_stat_activity` to monitor active sessions
   - Monitor connection pool usage
   - Set up alerts for connection failures

## Migration from Cookie-based Sessions

1. **Set environment variable:**

   ```bash
   USE_COOKIE_SESSIONS=false
   ```

2. **Update frontend to use JWT:**
   - Remove `withCredentials: true` from axios config
   - Add JWT token to Authorization header
   - Implement token refresh logic

3. **Test authentication flow:**
   - Login and verify JWT tokens are returned
   - Test protected endpoints with JWT
   - Verify token refresh works correctly

## Support

For issues or questions:

1. Check the troubleshooting section above
2. Review server logs for error messages
3. Verify environment variables are set correctly
4. Test database connectivity independently
