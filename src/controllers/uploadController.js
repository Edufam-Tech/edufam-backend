const path = require('path');
const fs = require('fs');
const userService = require('../services/userService');
const { asyncHandler } = require('../middleware/errorHandler');
const { ValidationError, NotFoundError } = require('../middleware/errorHandler');
const { query } = require('../config/database');

class UploadController {
  // Upload profile picture
  uploadProfilePicture = asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new ValidationError('No file uploaded');
    }

    const userId = req.user.userId;
    const file = req.file;

    // Set user context for RLS before database operations
    const authService = require('../services/authService');
    await authService.setUserContext(userId, req.user.schoolId);

    // Generate public URL for the file
    const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
    const fileUrl = `${baseUrl}/uploads/${file.filename}`;

    // Store file info in database
    const fileRecord = await query(`
      INSERT INTO file_uploads (
        user_id, original_filename, stored_filename, file_path, 
        file_size, mime_type, file_type, is_public
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, stored_filename, file_size, mime_type, created_at
    `, [
      userId,
      file.originalname,
      file.filename,
      file.path,
      file.size,
      file.mimetype,
      'profile_picture',
      true // Profile pictures are public
    ]);

    // Update user's profile picture URL
    await userService.updateProfilePicture(userId, fileUrl);

    // Log file upload
    await userService.logUserActivity(
      userId,
      'PROFILE_PICTURE_UPLOADED',
      {
        filename: file.filename,
        size: file.size,
        mimetype: file.mimetype
      },
      req.ip,
      req.get('User-Agent')
    );

    res.json({
      success: true,
      data: {
        file: {
          id: fileRecord.rows[0].id,
          filename: fileRecord.rows[0].stored_filename,
          originalName: file.originalname,
          size: fileRecord.rows[0].file_size,
          mimeType: fileRecord.rows[0].mime_type,
          url: fileUrl,
          uploadedAt: fileRecord.rows[0].created_at
        }
      },
      message: 'Profile picture uploaded successfully'
    });
  });

      // Upload document
  uploadDocument = asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new ValidationError('No file uploaded');
    }

    const userId = req.user.userId;
    const file = req.file;
    const { fileType = 'document', isPublic = false } = req.body;

    // Set user context for RLS before database operations
    const authService = require('../services/authService');
    await authService.setUserContext(userId, req.user.schoolId);

    // Generate URL based on public/private access
    const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
    const fileUrl = isPublic 
      ? `${baseUrl}/uploads/${file.filename}`
      : `${baseUrl}/api/upload/file/${file.filename}`;

    // Store file info in database
    const fileRecord = await query(`
      INSERT INTO file_uploads (
        user_id, original_filename, stored_filename, file_path, 
        file_size, mime_type, file_type, is_public
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, stored_filename, file_size, mime_type, created_at
    `, [
      userId,
      file.originalname,
      file.filename,
      file.path,
      file.size,
      file.mimetype,
      fileType,
      isPublic
    ]);

    // Log file upload
    await userService.logUserActivity(
      userId,
      'DOCUMENT_UPLOADED',
      {
        filename: file.filename,
        fileType,
        size: file.size,
        mimetype: file.mimetype,
        isPublic
      },
      req.ip,
      req.get('User-Agent')
    );

    res.json({
      success: true,
      data: {
        file: {
          id: fileRecord.rows[0].id,
          filename: fileRecord.rows[0].stored_filename,
          originalName: file.originalname,
          size: fileRecord.rows[0].file_size,
          mimeType: fileRecord.rows[0].mime_type,
          fileType,
          isPublic,
          url: fileUrl,
          uploadedAt: fileRecord.rows[0].created_at
        }
      },
      message: 'Document uploaded successfully'
    });
  });

  // Get file (for private files)
  getFile = asyncHandler(async (req, res) => {
    const { filename } = req.params;
    const userId = req.user.userId;

    // Get file info from database
    const fileResult = await query(`
      SELECT fu.*, u.user_type, u.school_id, u.role
      FROM file_uploads fu
      JOIN users u ON fu.user_id = u.id
      WHERE fu.stored_filename = $1
    `, [filename]);

    if (fileResult.rows.length === 0) {
      throw new NotFoundError('File not found');
    }

    const file = fileResult.rows[0];

    // Check access permissions
    const canAccess = 
      file.is_public || // Public files
      file.user_id === userId || // Owner
      req.user.userType === 'admin_user' || // Admin users
      (req.user.userType === 'school_user' && file.school_id === req.user.schoolId); // Same school

    if (!canAccess) {
      throw new NotFoundError('File not found');
    }

    // Check if file exists on disk
    if (!fs.existsSync(file.file_path)) {
      throw new NotFoundError('File not found on server');
    }

    // Set appropriate headers
    res.setHeader('Content-Type', file.mime_type);
    res.setHeader('Content-Disposition', `inline; filename="${file.original_filename}"`);
    res.setHeader('Content-Length', file.file_size);

    // Stream the file
    const fileStream = fs.createReadStream(file.file_path);
    fileStream.pipe(res);

    // Log file access
    await userService.logUserActivity(
      userId,
      'FILE_ACCESSED',
      {
        filename: file.stored_filename,
        originalName: file.original_filename,
        fileOwner: file.user_id
      },
      req.ip,
      req.get('User-Agent')
    );
  });

  // Get user's uploaded files
  getUserFiles = asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const { fileType, page = 1, limit = 20 } = req.query;

    let whereClause = 'WHERE user_id = $1';
    const params = [userId];

    if (fileType) {
      whereClause += ' AND file_type = $2';
      params.push(fileType);
    }

    // Get total count
    const countResult = await query(`
      SELECT COUNT(*) as total
      FROM file_uploads
      ${whereClause}
    `, params);

    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;

    // Get files with pagination
    const filesResult = await query(`
      SELECT id, original_filename, stored_filename, file_size, 
             mime_type, file_type, is_public, uploaded_at as created_at
      FROM file_uploads
      ${whereClause}
      ORDER BY uploaded_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `, [...params, limit, offset]);

    const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
    
    const files = filesResult.rows.map(file => ({
      id: file.id,
      filename: file.stored_filename,
      originalName: file.original_filename,
      size: file.file_size,
      mimeType: file.mime_type,
      fileType: file.file_type,
      isPublic: file.is_public,
      url: file.is_public 
        ? `${baseUrl}/uploads/${file.stored_filename}`
        : `${baseUrl}/api/upload/file/${file.stored_filename}`,
      uploadedAt: file.created_at
    }));

    res.json({
      success: true,
      data: {
        files,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      }
    });
  });

  // Delete file
  deleteFile = asyncHandler(async (req, res) => {
    const { fileId } = req.params;
    const userId = req.user.userId;

    // Get file info
    const fileResult = await query(`
      SELECT * FROM file_uploads 
      WHERE id = $1 AND user_id = $2
    `, [fileId, userId]);

    if (fileResult.rows.length === 0) {
      throw new NotFoundError('File not found');
    }

    const file = fileResult.rows[0];

    // Delete file from disk
    if (fs.existsSync(file.file_path)) {
      fs.unlinkSync(file.file_path);
    }

    // Delete record from database
    await query(`
      DELETE FROM file_uploads 
      WHERE id = $1
    `, [fileId]);

    // If this was a profile picture, update user's profile
    if (file.file_type === 'profile_picture') {
      await userService.updateProfilePicture(userId, null);
    }

    // Log file deletion
    await userService.logUserActivity(
      userId,
      'FILE_DELETED',
      {
        filename: file.stored_filename,
        originalName: file.original_filename,
        fileType: file.file_type
      },
      req.ip,
      req.get('User-Agent')
    );

    res.json({
      success: true,
      message: 'File deleted successfully'
    });
  });

  // Get file upload statistics
  getUploadStats = asyncHandler(async (req, res) => {
    const stats = await query(`
      SELECT 
        COUNT(*) as total_files,
        COUNT(*) FILTER (WHERE file_type = 'profile_picture') as profile_pictures,
        COUNT(*) FILTER (WHERE file_type = 'document') as documents,
        COUNT(*) FILTER (WHERE is_public = true) as public_files,
        SUM(file_size) as total_size,
        AVG(file_size) as average_size
      FROM file_uploads
    `);

    res.json({
      success: true,
      data: stats.rows[0]
    });
  });
}

module.exports = new UploadController(); 