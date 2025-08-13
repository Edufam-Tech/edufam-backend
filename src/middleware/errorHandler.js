// Custom error classes
class AppError extends Error {
  constructor(message, statusCode, code = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message, details = null) {
    super(message, 400, 'VALIDATION_ERROR');
    this.details = details;
  }
}

class AuthenticationError extends AppError {
  constructor(message = 'Authentication failed') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

class AuthorizationError extends AppError {
  constructor(message = 'Insufficient permissions') {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
  }
}

class ConflictError extends AppError {
  constructor(message = 'Resource already exists') {
    super(message, 409, 'CONFLICT');
  }
}

class DatabaseError extends AppError {
  constructor(message = 'Database operation failed') {
    super(message, 500, 'DATABASE_ERROR');
  }
}

class NetworkError extends AppError {
  constructor(message = 'Network operation failed') {
    super(message, 503, 'NETWORK_ERROR');
  }
}

class RateLimitError extends AppError {
  constructor(message = 'Rate limit exceeded') {
    super(message, 429, 'RATE_LIMIT_ERROR');
  }
}

// Error logging function
const logError = (error, req = null) => {
  const timestamp = new Date().toISOString();
  const errorInfo = {
    timestamp,
    message: error.message,
    stack: error.stack,
    code: error.code || 'UNKNOWN_ERROR',
    statusCode: error.statusCode || 500
  };
  
  if (req) {
    errorInfo.request = {
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.user?.userId || null
    };
  }
  
  // Log error (in production, send to monitoring service)
  if (error.statusCode >= 500) {
    console.error('🔥 SERVER ERROR:', errorInfo);
  } else {
    console.warn('⚠️  CLIENT ERROR:', errorInfo);
  }
  
  // TODO: Send to monitoring service (Sentry, etc.) in production
};

// Database error handler
const handleDatabaseError = (error) => {
  // PostgreSQL error codes
  switch (error.code) {
    case '23505': // Unique constraint violation
      return new ConflictError('Resource already exists');
    case '23503': // Foreign key constraint violation
      return new ValidationError('Referenced resource does not exist');
    case '23514': // Check constraint violation
      return new ValidationError('Invalid data provided');
    case '23502': // Not null constraint violation
      return new ValidationError('Required field is missing');
    case '42P01': // Undefined table
      return new DatabaseError('Database table not found');
    case '42703': // Undefined column
      return new DatabaseError('Database column not found');
    case '28P01': // Invalid password
      return new AuthenticationError('Database authentication failed');
    case '3D000': // Invalid database name
      return new DatabaseError('Database not found');
    case '08006': // Connection failure
      return new DatabaseError('Database connection failed');
    default:
      return new DatabaseError('Database operation failed');
  }
};

// JWT error handler
const handleJWTError = (error) => {
  switch (error.name) {
    case 'JsonWebTokenError':
      return new AuthenticationError('Invalid token');
    case 'TokenExpiredError':
      return new AuthenticationError('Token expired');
    case 'NotBeforeError':
      return new AuthenticationError('Token not active');
    default:
      return new AuthenticationError('Token verification failed');
  }
};

// Main error handling middleware
const errorHandler = (error, req, res, next) => {
  let handledError = error;
  
  // Handle different error types
  if (error.name === 'SequelizeError' || error.code) {
    handledError = handleDatabaseError(error);
  } else if (error.name?.startsWith('JsonWebToken')) {
    handledError = handleJWTError(error);
  } else if (error.name === 'MulterError') {
    handledError = new ValidationError('File upload error: ' + error.message);
  } else if (error.name === 'SyntaxError' && error.message.includes('JSON')) {
    handledError = new ValidationError('Invalid JSON in request body');
  } else if (!error.isOperational) {
    // Unknown error - log and return generic error
    handledError = new AppError('Internal server error', 500, 'INTERNAL_ERROR');
  }

  // Normalize common network timeouts to NetworkError
  if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
    handledError = new NetworkError('Database connection timeout');
  }
  
  // Log error
  logError(handledError, req);
  
  // Send error response
  const errorResponse = {
    success: false,
    error: {
      code: handledError.code || 'UNKNOWN_ERROR',
      message: handledError.message
    }
  };
  
  // Add details for validation errors
  if (handledError instanceof ValidationError && handledError.details) {
    errorResponse.error.details = handledError.details;
  }
  
  // Include stack trace in development
  if (process.env.NODE_ENV === 'development') {
    errorResponse.error.stack = handledError.stack;
  }
  
  res.status(handledError.statusCode || 500).json(errorResponse);
};

// 404 handler for unmatched routes
const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`
    }
  });
};

// Async error wrapper
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = {
  // Error classes
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  DatabaseError,
  NetworkError,
  RateLimitError,
  
  // Error handlers
  errorHandler,
  notFoundHandler,
  asyncHandler,
  logError
}; 