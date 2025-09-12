# Frontend Configuration Update Guide

## Database Migration Fix

The database migration has been fixed. Run this command to apply it:

```bash
psql -d your_database -f database/migrations/20250115_create_refresh_tokens.sql
```

## Frontend Configuration Updates

### 1. School App (edufam-school-app)

#### Environment Variables

Create `.env.production` file:

```bash
VITE_API_BASE_URL=https://backend.edufam.org/api
```

#### Changes Made to `src/lib/api-client.ts`:

- ✅ Removed `withCredentials: true` (set to `false`)
- ✅ Updated token storage keys from `auth_token`/`refresh_token` to `accessToken`/`refreshToken`
- ✅ Updated Authorization header to use `accessToken`

### 2. Admin App (edufam-admin-app)

#### Environment Variables

Create `.env.production` file:

```bash
VITE_API_BASE_URL=https://backend.edufam.org/api
```

#### Changes Made to `src/lib/apiClient.ts`:

- ✅ Added `credentials: 'omit'` to all fetch requests
- ✅ Updated headers to include `Accept: application/json`

### 3. Mobile App (edufam_mobile_app)

#### Update `lib/core/api_config.dart`:

```dart
class ApiConfig {
  static const String baseUrl = 'https://backend.edufam.org/api/';

  // For development
  // static const String baseUrl = 'http://localhost:5000/api/';

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

## Testing the Updates

### 1. Test Backend

```bash
cd edufam-backend
node test-jwt-auth.js
```

### 2. Test Frontend Login

```bash
# Test school app login
curl -X POST https://backend.edufam.org/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"teacher@school.com","password":"password123","userType":"school_user"}'

# Test admin app login
curl -X POST https://backend.edufam.org/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@edufam.org","password":"password123","userType":"admin_user"}'
```

### 3. Test with JWT Token

```bash
# Use the accessToken from login response
curl -X GET https://backend.edufam.org/api/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## Key Changes Summary

### Backend Changes

- ✅ Fixed database migration constraint error
- ✅ Implemented dual connection pools (session + transaction)
- ✅ Added JWT authentication middleware
- ✅ Made sessions optional via `USE_COOKIE_SESSIONS=false`
- ✅ Updated CORS to work with JWT mode

### Frontend Changes

- ✅ Removed `withCredentials: true` from axios configs
- ✅ Updated token storage keys to match JWT format
- ✅ Added proper Authorization headers
- ✅ Implemented token refresh logic
- ✅ Added `credentials: 'omit'` to fetch requests

### Environment Variables Required

```bash
# Backend (Railway)
DATABASE_URL_SESSION=postgresql://user:password@host:5432/database
JWT_SECRET=your-super-secret-jwt-key-here
JWT_REFRESH_SECRET=your-super-secret-refresh-key-here
USE_COOKIE_SESSIONS=false
ALLOWED_ORIGINS=https://www.edufam.org,https://admin.edufam.org,https://school.edufam.org

# Frontend (Vercel)
VITE_API_BASE_URL=https://backend.edufam.org/api
```

## Next Steps

1. **Apply the database migration** (fixed constraint error)
2. **Set environment variables** in Railway and Vercel
3. **Deploy the updated frontend apps** with new configurations
4. **Test the complete authentication flow**
5. **Monitor pool statistics** via `/api/health/pool-stats`

## Troubleshooting

### If you get CORS errors:

- Check `ALLOWED_ORIGINS` includes your frontend URLs
- Ensure `withCredentials: false` is set
- Verify `credentials: 'omit'` is set in fetch requests

### If tokens don't refresh:

- Check token storage keys match (`accessToken`/`refreshToken`)
- Verify refresh token endpoint is working
- Check browser console for errors

### If database connection fails:

- Verify `DATABASE_URL_SESSION` is set correctly
- Check pooler port (5432 for session, 6453 for transaction)
- Monitor via `/api/health/pool-stats`
