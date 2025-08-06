const express = require('express');
const userController = require('../controllers/userController');
const { 
  authenticate, 
  requireUserManagement,
  requireRole 
} = require('../middleware/auth');
const { validationChains } = require('../middleware/validation');

const router = express.Router();

// All user routes require authentication
router.use(authenticate);

// Personal profile routes (all authenticated users)
router.get('/profile', userController.getProfile);
router.put('/profile', 
  validationChains.updateUser,
  userController.updateProfile
);
router.put('/change-password',
  validationChains.passwordChange,
  userController.changePassword
);
router.get('/sessions', userController.getSessions);

// User management routes (admin only)
router.get('/',
  requireUserManagement,
  validationChains.pagination,
  userController.getAllUsers
);

router.get('/stats',
  requireRole(['super_admin', 'support_hr']),
  userController.getUserStats
);

router.get('/:userId',
  requireUserManagement,
  validationChains.uuidParam('userId'),
  userController.getUserById
);

router.post('/',
  requireUserManagement,
  validationChains.createUser,
  userController.createUser
);

router.put('/:userId',
  requireUserManagement,
  validationChains.uuidParam('userId'),
  [
    require('express-validator').body('firstName').optional().trim().isLength({ min: 1, max: 100 }),
    require('express-validator').body('lastName').optional().trim().isLength({ min: 1, max: 100 }),
    require('express-validator').body('phone').optional().matches(/^(\+254|0)[17]\d{8}$/),
    require('express-validator').body('role').optional().isIn([
      'school_director', 'principal', 'teacher', 'parent', 'hr', 'finance',
      'super_admin', 'engineer', 'support_hr', 'sales_marketing', 'admin_finance'
    ]),
    require('express-validator').body('activationStatus').optional().isIn([
      'pending', 'active', 'suspended', 'deactivated'
    ]),
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
  userController.updateUser
);

router.post('/:userId/activate',
  requireUserManagement,
  validationChains.uuidParam('userId'),
  userController.activateUser
);

router.post('/:userId/deactivate',
  requireUserManagement,
  validationChains.uuidParam('userId'),
  userController.deactivateUser
);

router.post('/:userId/reset-password',
  requireUserManagement,
  validationChains.uuidParam('userId'),
  [
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
  userController.resetUserPassword
);

module.exports = router; 