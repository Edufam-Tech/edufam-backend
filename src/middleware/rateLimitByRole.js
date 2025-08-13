const rateLimit = require('express-rate-limit');
const { ADMIN_DASHBOARD_ROLES } = require('../auth/roleDefinitions');

// Dynamic per-role rate limits
const limitsByRole = {
  super_admin: { windowMs: 15 * 60 * 1000, max: 2000 },
  edufam_admin: { windowMs: 15 * 60 * 1000, max: 2000 },
  engineer: { windowMs: 15 * 60 * 1000, max: 1500 },
  admin_finance: { windowMs: 15 * 60 * 1000, max: 1200 },
  support_hr: { windowMs: 15 * 60 * 1000, max: 800 },
  sales_marketing: { windowMs: 15 * 60 * 1000, max: 800 },
  default: { windowMs: 15 * 60 * 1000, max: 600 }
};

const rateLimitByRole = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${req.user?.role || 'guest'}:${req.ip}`,
  skip: (req) => {
    // Allow admins higher thresholds but still apply
    return false;
  },
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests' }
    });
  }
});

module.exports = { rateLimitByRole, limitsByRole };


