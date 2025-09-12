const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Security headers middleware
// In development, relax CSP and disable HSTS to avoid local HTTP/port issues (e.g., net::ERR_FAILED)
const isProduction = process.env.NODE_ENV === 'production';
const securityHeaders = helmet({
  contentSecurityPolicy: isProduction
    ? {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          imgSrc: ["'self'", "data:", "https:"],
          scriptSrc: ["'self'"],
          connectSrc: ["'self'", 'wss:', 'ws:'],
          frameSrc: ["'none'"],
          objectSrc: ["'none'"],
          upgradeInsecureRequests: [],
        },
      }
    : {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          imgSrc: ["'self'", "data:", "https:"],
          scriptSrc: ["'self'", "'unsafe-eval'"],
          connectSrc: ["'self'", 'wss:', 'ws:'],
          frameSrc: ["'none'"],
          objectSrc: ["'none'"],
        },
      },
  crossOriginEmbedderPolicy: false,
  hsts: isProduction
    ? {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      }
    : false,
});

// CORS configuration for school and admin apps
const corsOptions = {
  origin: function (origin, callback) {
    // Normalize environment-configured origins (comma-separated)
    const envOrigins = (process.env.ALLOWED_ORIGINS || '')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean);

    const allowedOrigins = [
      // Production domains
      'https://edufam.org',
      'https://www.edufam.org',
      'https://backend.edufam.org',
      'https://admin.edufam.org',
      'https://school.edufam.org',
      
      // Environment-specific URLs
      process.env.SCHOOL_APP_URL || 'http://localhost:5173',
      process.env.ADMIN_APP_URL || 'http://localhost:3001',
      process.env.BACKEND_URL || 'http://localhost:5000',
      
      // Local development
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:3001',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001',
      'http://127.0.0.1:5000',
      
      // Legacy domains (if any)
      'https://school.edufam.com',
      'https://admin.edufam.com',
      
      // Additional origins from environment
      ...envOrigins,
    ];

    const allowedPatterns = [
      /^http:\/\/localhost:\d+$/, // any localhost port
      /^http:\/\/127\.0\.0\.1:\d+$/, // any 127.0.0.1 port
      /^https:\/\/.*\.edufam\.org$/, // any edufam.org subdomain
    ];

    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) {
      console.log('✅ CORS: Allowing request with no origin (mobile app/Postman)');
      return callback(null, true);
    }

    const isExplicitlyAllowed = allowedOrigins.includes(origin);
    const matchesPattern = allowedPatterns.some((re) => re.test(origin));

    if (isExplicitlyAllowed || matchesPattern) {
      console.log(`✅ CORS: Allowing origin: ${origin}`);
      callback(null, true);
    } else {
      console.log(`❌ CORS: Blocked origin: ${origin}`);
      console.log('📋 Allowed origins:', allowedOrigins);
      console.log('🔍 Pattern matches:', allowedPatterns.map(p => p.toString()));
      callback(new Error(`Origin ${origin} not allowed by CORS policy`));
    }
  },
  // Only require credentials if using cookie-based sessions
  credentials: process.env.USE_COOKIE_SESSIONS === 'true',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'Cache-Control',
    'X-Access-Token',
  ],
  exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
  optionsSuccessStatus: 200, // Some legacy browsers choke on 204
};

// Rate limiting configurations
const createRateLimit = (windowMs, max, message, skipSuccessfulRequests = true) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: message || 'Too many requests, please try again later'
      }
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests,
    skip: (req) => {
      // Skip rate limiting for health checks
      return req.path === '/health' || req.path === '/api';
    }
  });
};

// Different rate limits for different endpoints
const rateLimits = {
  // General API rate limit
  general: createRateLimit(
    15 * 60 * 1000, // 15 minutes
    1000, // 1000 requests per window
    'Too many API requests'
  ),
  
  // Authentication endpoints (more reasonable for development)
  auth: createRateLimit(
    15 * 60 * 1000, // 15 minutes
    50, // 50 attempts per window (increased for development)
    'Too many authentication attempts',
    false // Don't skip successful requests
  ),

  // Login endpoint (stricter for brute force protection)
  login: createRateLimit(
    15 * 60 * 1000, // 15 minutes
    10, // 10 login attempts per window
    'Too many login attempts. Please try again later.',
    false // Don't skip successful requests
  ),

  // Refresh token endpoint (moderate)
  refresh: createRateLimit(
    15 * 60 * 1000, // 15 minutes
    20, // 20 refresh attempts per window
    'Too many token refresh attempts',
    false // Don't skip successful requests
  ),
  
  // Password reset (very strict)
  passwordReset: createRateLimit(
    60 * 60 * 1000, // 1 hour
    3, // 3 attempts per hour
    'Too many password reset attempts',
    false
  ),
  
  // File upload (moderate)
  upload: createRateLimit(
    15 * 60 * 1000, // 15 minutes
    50, // 50 uploads per window
    'Too many file upload requests'
  ),
  
  // User management (moderate)
  userManagement: createRateLimit(
    15 * 60 * 1000, // 15 minutes
    100, // 100 requests per window
    'Too many user management requests'
  )
};

// Input sanitization middleware
const sanitizeInput = (req, res, next) => {
  // Recursively sanitize object properties
  const sanitizeObject = (obj) => {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }
    
    for (const key in obj) {
      if (typeof obj[key] === 'string') {
        // Enhanced XSS prevention
        obj[key] = obj[key]
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
          .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
          .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
          .replace(/javascript:/gi, '')
          .replace(/data:\s*text\/html/gi, '')
          .replace(/on\w+\s*=/gi, '');
      } else if (typeof obj[key] === 'object') {
        sanitizeObject(obj[key]);
      }
    }
  };
  
  sanitizeObject(req.body);
  sanitizeObject(req.query);
  sanitizeObject(req.params);
  
  next();
};

// Request logging middleware
const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  // Log request
  console.log(`📥 ${req.method} ${req.path} - ${req.ip} - ${new Date().toISOString()}`);
  
  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - start;
    const statusEmoji = res.statusCode >= 400 ? '❌' : '✅';
    console.log(`📤 ${statusEmoji} ${res.statusCode} ${req.method} ${req.path} - ${duration}ms`);
  });
  
  next();
};

// Maintenance mode middleware - only for school application routes
const checkMaintenanceMode = async (req, res, next) => {
  try {
    // Skip maintenance check for health endpoints, admin routes, and critical operations
    if (req.path === '/health' || 
        req.path === '/api' || 
        req.path.startsWith('/admin/') ||
        req.path.startsWith('/auth/') ||
        req.path.includes('/backup') ||
        req.path.includes('/migration')) {
      return next();
    }
    
    // Allow bypass if explicitly set by bypassMaintenance middleware
    if (req.bypassMaintenance) {
      return next();
    }
    
    // Allow super admin to bypass maintenance mode
    if (req.user && req.user.role === 'super_admin') {
      return next();
    }
    
    // Check DB maintenance table with strict time logic
    let maintenanceMode = false;
    let maintenanceInfo = null;
    
    try {
      const { query } = require('../config/database');
      const now = new Date();
      
      // Get all active maintenance records
      const result = await query(`
        SELECT *
        FROM maintenance_mode
        WHERE is_active = true
        ORDER BY scheduled_start DESC
      `);
      
      if (result.rows.length > 0) {
        // Process each maintenance record to check time validity
        for (const record of result.rows) {
          let shouldBeActive = true;
          let needsUpdate = false;
          
          // Check if maintenance should have started
          if (record.scheduled_start) {
            const startTime = new Date(record.scheduled_start);
            if (now < startTime) {
              shouldBeActive = false;
              needsUpdate = true;
              console.log(`🕐 Maintenance mode not yet started (scheduled for ${startTime.toISOString()})`);
            }
          }
          
          // Check if maintenance has expired
          if (record.scheduled_end) {
            const endTime = new Date(record.scheduled_end);
            if (now > endTime) {
              shouldBeActive = false;
              needsUpdate = true;
              console.log(`🕐 Maintenance mode expired (ended at ${endTime.toISOString()})`);
            }
          }
          
          // Update record if needed
          if (needsUpdate) {
            await query(`
              UPDATE maintenance_mode 
              SET is_active = false, updated_at = CURRENT_TIMESTAMP
              WHERE id = $1
            `, [record.id]);
          }
          
          // If this record should be active, use it
          if (shouldBeActive) {
            maintenanceInfo = record;
            maintenanceMode = true;
            break; // Use the most recent valid maintenance record
          }
        }
        
        // If we found a valid maintenance record
        if (maintenanceMode && maintenanceInfo) {
          // Check for allowed IPs
          const allowedIps = Array.isArray(maintenanceInfo.allowed_ips) ? maintenanceInfo.allowed_ips : [];
          const ip = req.ip || req.connection?.remoteAddress || '';
          if (allowedIps.includes(ip)) {
            return next();
          }
          
          // Attach details for downstream handlers
          req.__maintenance = {
            message: maintenanceInfo.message || null,
            estimated_end_time: maintenanceInfo.scheduled_end || null,
            scheduled_start: maintenanceInfo.scheduled_start || null
          };
        }
      }
      
      // Only fallback to environment variable if no database records exist
      if (!maintenanceMode && result.rows.length === 0) {
        // Don't use environment variable fallback to prevent random popups
        maintenanceMode = false;
      }
      
    } catch (error) {
      console.error('Error checking maintenance mode:', error);
      // Don't fallback to environment variable to prevent random popups
      maintenanceMode = false;
    }

    if (maintenanceMode) {
      return res.status(503).json({
        success: false,
        error: {
          code: 'MAINTENANCE_MODE',
          message: (req.__maintenance?.message) || 'System maintenance in progress. Kindly be patient as we resolve some issues.\nThank you'
        },
        maintenance: true,
        estimated_end_time: req.__maintenance?.estimated_end_time || null,
        scheduled_start: req.__maintenance?.scheduled_start || null
      });
    }
    
    next();
  } catch (error) {
    console.error('Error checking maintenance mode:', error);
    next(); // Continue on error to avoid blocking requests
  }
};

// Security event logging
const logSecurityEvent = (eventType, details, req) => {
  console.warn(`🚨 SECURITY EVENT: ${eventType}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString(),
    details
  });
  
  // TODO: Store in audit_logs table when database models are ready
};

// Suspicious activity detection
const detectSuspiciousActivity = (req, res, next) => {
  const suspiciousPatterns = [
    /\.\.\//g, // Path traversal
    /<script/gi, // XSS attempts
    /union\s+select/gi, // SQL injection
    /\bexec\b/gi, // Command injection
    /\beval\b/gi // Code injection
  ];
  
  const checkValue = (value) => {
    if (typeof value === 'string') {
      return suspiciousPatterns.some(pattern => pattern.test(value));
    }
    return false;
  };
  
  // Check URL, query params, and body
  const urlSuspicious = checkValue(req.url);
  const querySuspicious = Object.values(req.query).some(checkValue);
  const bodySuspicious = req.body && JSON.stringify(req.body) && 
    checkValue(JSON.stringify(req.body));
  
  if (urlSuspicious || querySuspicious || bodySuspicious) {
    logSecurityEvent('SUSPICIOUS_REQUEST', {
      url: req.url,
      query: req.query,
      bodyKeys: req.body ? Object.keys(req.body) : []
    }, req);
    
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_REQUEST',
        message: 'Request contains invalid characters'
      }
    });
  }
  
  next();
};

module.exports = {
  securityHeaders,
  corsOptions,
  rateLimits,
  sanitizeInput,
  requestLogger,
  checkMaintenanceMode,
  detectSuspiciousActivity,
  logSecurityEvent
}; 