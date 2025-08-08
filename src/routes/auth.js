const express = require('express');
const authController = require('../controllers/authController');
const { 
  authenticate, 
  requireSuperAdmin, 
  requireSupportHR,
  hasAnyRole
} = require('../middleware/auth');
const { validationChains } = require('../middleware/validation');
const { rateLimits } = require('../middleware/security');

const router = express.Router();

// Apply authentication rate limiting to all auth routes
router.use(rateLimits.auth);

// Handle OPTIONS requests for CORS preflight
router.options('/login', (req, res) => {
  res.status(200).end();
});

// Public authentication routes (no authentication required)
router.post('/login', 
  validationChains.login,
  authController.login
);

router.post('/refresh-token',
  [
    require('express-validator').body('refreshToken')
      .notEmpty()
      .withMessage('Refresh token is required'),
    require('express-validator').validationResult,
    (req, res, next) => {
      const errors = require('express-validator').validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input data',
            details: errors.array()
          }
        });
      }
      next();
    }
  ],
  authController.refreshToken
);

router.post('/forgot-password',
  rateLimits.passwordReset,
  validationChains.passwordReset,
  authController.forgotPassword
);

router.post('/reset-password',
  rateLimits.passwordReset,
  [
    require('express-validator').body('token')
      .notEmpty()
      .withMessage('Reset token is required'),
    require('express-validator').body('newPassword')
      .isLength({ min: 8, max: 128 })
      .withMessage('Password must be between 8 and 128 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
    require('express-validator').validationResult,
    (req, res, next) => {
      const errors = require('express-validator').validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input data',
            details: errors.array()
          }
        });
      }
      next();
    }
  ],
  authController.resetPassword
);

router.get('/verify-reset-token/:token',
  validationChains.uuidParam('token'),
  authController.verifyResetToken
);

// Protected authentication routes (authentication required)
router.post('/logout',
  authenticate,
  authController.logout
);

router.post('/logout-all',
  authenticate,
  authController.logoutAll
);

router.get('/me',
  authenticate,
  authController.me
);

router.post('/validate-session',
  authenticate,
  authController.validateSession
);

router.delete('/sessions/:sessionId',
  authenticate,
  validationChains.uuidParam('sessionId'),
  authController.terminateSession
);

// Admin only routes - only super_admin and support_hr can access auth stats
router.get('/stats',
  authenticate,
  hasAnyRole(['super_admin', 'support_hr']),
  authController.getAuthStats
);

module.exports = router; 