const express = require('express');
const uploadController = require('../controllers/uploadController');
const { authenticate, requireRole } = require('../middleware/auth');
const { 
  uploadProfilePicture, 
  uploadDocument, 
  validateFileUpload 
} = require('../middleware/upload');
const { rateLimits } = require('../middleware/security');
const { validationChains } = require('../middleware/validation');

const router = express.Router();

// All upload routes require authentication
router.use(authenticate);

// Apply upload rate limiting
router.use(rateLimits.upload);

// Profile picture upload
router.post('/profile-picture',
  uploadProfilePicture,
  validateFileUpload,
  uploadController.uploadProfilePicture
);

// Document upload
router.post('/document',
  uploadDocument,
  validateFileUpload,
  [
    require('express-validator').body('fileType').optional().isIn(['document', 'image', 'other']),
    require('express-validator').body('isPublic').optional().isBoolean(),
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
  uploadController.uploadDocument
);

// Get private file (authentication required)
router.get('/file/:filename',
  uploadController.getFile
);

// Get user's files
router.get('/files',
  validationChains.pagination,
  [
    require('express-validator').query('fileType').optional().isIn(['profile_picture', 'document', 'image', 'other']),
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
  uploadController.getUserFiles
);

// Delete file
router.delete('/files/:fileId',
  [
    require('express-validator').param('fileId').isUUID().withMessage('Invalid file ID'),
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
  uploadController.deleteFile
);

// Get upload statistics (admin only)
router.get('/stats',
  requireRole(['super_admin', 'support_hr']),
  uploadController.getUploadStats
);

module.exports = router; 