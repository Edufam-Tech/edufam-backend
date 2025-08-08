const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');

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
          connectSrc: ["'self'"],
          frameSrc: ["'none'"],
          objectSrc: ["'none'"],
          upgradeInsecureRequests: [],
        },
      }
    : false,
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
      process.env.SCHOOL_APP_URL || 'http://localhost:5173',
      process.env.ADMIN_APP_URL || 'http://localhost:3001',
      'http://localhost:3000',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001',
      'https://school.edufam.com',
      'https://admin.edufam.com',
      ...envOrigins,
    ];

    const allowedPatterns = [
      /^http:\/\/localhost:\d+$/, // any localhost port
      /^http:\/\/127\.0\.0\.1:\d+$/, // any 127.0.0.1 port
    ];

    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);

    const isExplicitlyAllowed = allowedOrigins.includes(origin);
    const matchesPattern = allowedPatterns.some((re) => re.test(origin));

    if (isExplicitlyAllowed || matchesPattern) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS policy'));
    }
  },
  credentials: true,
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
  
  // Authentication endpoints (stricter)
  auth: createRateLimit(
    15 * 60 * 1000, // 15 minutes
    10, // 10 attempts per window
    'Too many authentication attempts',
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
        // Basic XSS prevention
        obj[key] = obj[key]
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
          .replace(/javascript:/gi, '')
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

// Maintenance mode middleware
const checkMaintenanceMode = async (req, res, next) => {
  try {
    // Skip maintenance check for health endpoints
    if (req.path === '/health' || req.path === '/api') {
      return next();
    }
    
    // TODO: This will be implemented when we have database models
    // For now, check environment variable
    const maintenanceMode = process.env.MAINTENANCE_MODE === 'true';
    
    if (maintenanceMode) {
      return res.status(503).json({
        success: false,
        error: {
          code: 'MAINTENANCE_MODE',
          message: 'System is currently under maintenance. Please try again later.'
        },
        maintenance: true
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