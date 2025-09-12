# Frontend Configuration Examples

## React/Next.js Configuration

### Environment Variables

Create `.env.local` file:

```bash
# API Configuration
VITE_API_BASE_URL=https://backend.edufam.org/api
NEXT_PUBLIC_API_URL=https://backend.edufam.org/api

# For development
# VITE_API_BASE_URL=http://localhost:5000/api
# NEXT_PUBLIC_API_URL=http://localhost:5000/api
```

### Axios Configuration

Create `src/lib/api.js`:

```javascript
import axios from 'axios';

const API_BASE_URL =
  process.env.VITE_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL;

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  // Remove withCredentials for JWT mode
  // withCredentials: false,
});

// Request interceptor to add JWT token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (refreshToken) {
          const response = await axios.post(
            `${API_BASE_URL}/auth/refresh-token`,
            {
              refreshToken: refreshToken,
            }
          );

          const { accessToken, refreshToken: newRefreshToken } =
            response.data.data.tokens;
          localStorage.setItem('accessToken', accessToken);
          localStorage.setItem('refreshToken', newRefreshToken);

          // Retry original request with new token
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed, redirect to login
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

export default api;
```

### Authentication Hook

Create `src/hooks/useAuth.js`:

```javascript
import { useState, useEffect } from 'react';
import api from '../lib/api';

export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      fetchUser();
    } else {
      setLoading(false);
    }
  }, []);

  const fetchUser = async () => {
    try {
      const response = await api.get('/auth/me');
      setUser(response.data.data.user);
    } catch (error) {
      console.error('Failed to fetch user:', error);
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password, userType) => {
    try {
      const response = await api.post('/auth/login', {
        email,
        password,
        userType,
      });

      const { user, tokens } = response.data.data;
      localStorage.setItem('accessToken', tokens.accessToken);
      localStorage.setItem('refreshToken', tokens.refreshToken);
      setUser(user);

      return { success: true, user };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error?.message || 'Login failed',
      };
    }
  };

  const logout = async () => {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        await api.post('/auth/logout', { refreshToken });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      setUser(null);
    }
  };

  return { user, loading, login, logout, fetchUser };
};
```

## Flutter Mobile Configuration

### API Configuration

Create `lib/config/api_config.dart`:

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

### API Service

Create `lib/services/api_service.dart`:

```dart
import 'dart:convert';
import 'package:http/http.dart' as http;
import '../config/api_config.dart';
import '../models/auth_models.dart';

class ApiService {
  static final ApiService _instance = ApiService._internal();
  factory ApiService() => _instance;
  ApiService._internal();

  String? _accessToken;
  String? _refreshToken;

  void setTokens(String accessToken, String refreshToken) {
    _accessToken = accessToken;
    _refreshToken = refreshToken;
  }

  void clearTokens() {
    _accessToken = null;
    _refreshToken = null;
  }

  Future<Map<String, dynamic>> _makeRequest(
    String method,
    String endpoint, {
    Map<String, dynamic>? body,
    bool requiresAuth = true,
  }) async {
    final url = Uri.parse('${ApiConfig.baseUrl}$endpoint');

    final headers = ApiConfig.getHeaders(requiresAuth ? _accessToken : null);

    http.Response response;

    switch (method.toUpperCase()) {
      case 'GET':
        response = await http.get(url, headers: headers);
        break;
      case 'POST':
        response = await http.post(
          url,
          headers: headers,
          body: body != null ? json.encode(body) : null,
        );
        break;
      case 'PUT':
        response = await http.put(
          url,
          headers: headers,
          body: body != null ? json.encode(body) : null,
        );
        break;
      case 'DELETE':
        response = await http.delete(url, headers: headers);
        break;
      default:
        throw Exception('Unsupported HTTP method: $method');
    }

    if (response.statusCode == 401 && requiresAuth && _refreshToken != null) {
      // Try to refresh token
      final refreshResult = await refreshToken();
      if (refreshResult['success']) {
        // Retry original request with new token
        headers['Authorization'] = 'Bearer $_accessToken';
        response = await http.get(url, headers: headers);
      }
    }

    final responseData = json.decode(response.body);

    if (response.statusCode >= 200 && response.statusCode < 300) {
      return responseData;
    } else {
      throw Exception(responseData['error']?['message'] ?? 'Request failed');
    }
  }

  Future<Map<String, dynamic>> login(String email, String password, String userType) async {
    final result = await _makeRequest('POST', 'auth/login', body: {
      'email': email,
      'password': password,
      'userType': userType,
    }, requiresAuth: false);

    if (result['success']) {
      final tokens = result['data']['tokens'];
      setTokens(tokens['accessToken'], tokens['refreshToken']);
    }

    return result;
  }

  Future<Map<String, dynamic>> getCurrentUser() async {
    return await _makeRequest('GET', 'auth/me');
  }

  Future<Map<String, dynamic>> refreshToken() async {
    if (_refreshToken == null) {
      throw Exception('No refresh token available');
    }

    final result = await _makeRequest('POST', 'auth/refresh-token', body: {
      'refreshToken': _refreshToken,
    }, requiresAuth: false);

    if (result['success']) {
      final tokens = result['data']['tokens'];
      setTokens(tokens['accessToken'], tokens['refreshToken']);
    }

    return result;
  }

  Future<Map<String, dynamic>> logout() async {
    if (_refreshToken != null) {
      try {
        await _makeRequest('POST', 'auth/logout', body: {
          'refreshToken': _refreshToken,
        });
      } catch (e) {
        // Logout even if API call fails
        print('Logout API call failed: $e');
      }
    }

    clearTokens();
    return {'success': true, 'message': 'Logged out successfully'};
  }
}
```

### Auth Models

Create `lib/models/auth_models.dart`:

```dart
class User {
  final String id;
  final String email;
  final String role;
  final String userType;
  final String? schoolId;
  final String? firstName;
  final String? lastName;
  final String? profilePictureUrl;

  User({
    required this.id,
    required this.email,
    required this.role,
    required this.userType,
    this.schoolId,
    this.firstName,
    this.lastName,
    this.profilePictureUrl,
  });

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id'],
      email: json['email'],
      role: json['role'],
      userType: json['userType'],
      schoolId: json['schoolId'],
      firstName: json['firstName'],
      lastName: json['lastName'],
      profilePictureUrl: json['profilePictureUrl'],
    );
  }
}

class AuthResponse {
  final bool success;
  final User? user;
  final String? accessToken;
  final String? refreshToken;
  final String? message;
  final String? error;

  AuthResponse({
    required this.success,
    this.user,
    this.accessToken,
    this.refreshToken,
    this.message,
    this.error,
  });

  factory AuthResponse.fromJson(Map<String, dynamic> json) {
    return AuthResponse(
      success: json['success'],
      user: json['data']?['user'] != null ? User.fromJson(json['data']['user']) : null,
      accessToken: json['data']?['tokens']?['accessToken'],
      refreshToken: json['data']?['tokens']?['refreshToken'],
      message: json['message'],
      error: json['error']?['message'],
    );
  }
}
```

## Vercel Environment Variables

### Admin App (.env.production)

```bash
VITE_API_BASE_URL=https://backend.edufam.org/api
```

### School App (.env.production)

```bash
VITE_API_BASE_URL=https://backend.edufam.org/api
```

### Railway Environment Variables

```bash
# Database
DATABASE_URL_SESSION=postgresql://user:password@host:5432/database
DATABASE_URL_TRANSACTION=postgresql://user:password@host:6453/database

# JWT
JWT_SECRET=your-super-secret-jwt-key-here
JWT_REFRESH_SECRET=your-super-secret-refresh-key-here
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Auth Mode
USE_COOKIE_SESSIONS=false

# CORS
ALLOWED_ORIGINS=https://www.edufam.org,https://admin.edufam.org,https://school.edufam.org

# Pool Settings
DB_POOL_MAX=10
DB_POOL_MIN=1
DB_IDLE_TIMEOUT_MS=30000
DB_CONN_TIMEOUT_MS=60000
```

## Testing the Configuration

### 1. Test Backend

```bash
cd edufam-backend
node test-jwt-auth.js
```

### 2. Test Frontend

```bash
# Test login
curl -X POST https://backend.edufam.org/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123","userType":"school_user"}'

# Test with token
curl -X GET https://backend.edufam.org/api/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### 3. Monitor Pool Statistics

```bash
curl -X GET https://backend.edufam.org/api/health/pool-stats
```

## Common Issues and Solutions

### 1. CORS Errors

**Problem:** Frontend getting CORS errors
**Solution:**

- Check `ALLOWED_ORIGINS` environment variable
- Ensure frontend URL is included in allowed origins
- Remove `withCredentials: true` from axios config for JWT mode

### 2. Token Refresh Issues

**Problem:** Tokens not refreshing automatically
**Solution:**

- Implement axios response interceptor
- Handle 401 responses by refreshing token
- Store tokens securely (localStorage for web, secure storage for mobile)

### 3. Database Connection Issues

**Problem:** Database connection failures
**Solution:**

- Check `DATABASE_URL_SESSION` is set correctly
- Verify pooler port (5432 for session, 6453 for transaction)
- Monitor pool statistics via `/api/health/pool-stats`

### 4. Mobile App Issues

**Problem:** Mobile app can't authenticate
**Solution:**

- Ensure mobile app sends requests with no origin (allowed by CORS)
- Use proper Authorization header format
- Handle token refresh in mobile app
