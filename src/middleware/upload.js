const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const { ValidationError } = require('./errorHandler');

// Ensure uploads directory exists
const ensureUploadDirectory = () => {
  const uploadDir = path.join(__dirname, '../../uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
    console.log('📁 Created uploads directory');
  }
  return uploadDir;
};

// Simple file signature verification for basic types
const verifyFileSignature = (buffer, mimetype) => {
  const signatures = {
    'image/jpeg': [0xFF, 0xD8, 0xFF],
    'image/png': [0x89, 0x50, 0x4E, 0x47],
    'application/pdf': [0x25, 0x50, 0x44, 0x46]
  };
  const signature = signatures[mimetype];
  if (!signature) return true; // If unknown, don't block here; rely on mimetype allowlist
  return signature.every((byte, index) => buffer[index] === byte);
};

// File filter function
const fileFilter = (req, file, cb) => {
  // Allowed file types
  const allowedTypes = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'application/pdf': '.pdf',
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx'
  };
  
  if (!allowedTypes[file.mimetype]) {
    cb(new ValidationError(`File type ${file.mimetype} is not allowed`), false);
    return;
  }

  // Basic signature check for files that provide a buffer (memory storage or multer exposes buffer)
  if (file.buffer) {
    const head = file.buffer.slice(0, 10);
    if (!verifyFileSignature(head, file.mimetype)) {
      return cb(new ValidationError('File signature does not match declared type'), false);
    }
  }

  cb(null, true);
};

// Storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = ensureUploadDirectory();
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2);
    const extension = path.extname(file.originalname).toLowerCase();
    const filename = `${timestamp}-${randomString}${extension}`;
    cb(null, filename);
  }
});

// Multer configuration
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024, // 5MB default
    files: 1 // Only allow single file upload
  }
});

// Image processing middleware
const processImage = async (req, res, next) => {
  if (!req.file) {
    return next();
  }
  
  try {
    const { file } = req;
    
    // Only process image files
    if (!file.mimetype.startsWith('image/')) {
      return next();
    }
    
    const uploadDir = ensureUploadDirectory();
    const originalPath = file.path;
    const processedPath = path.join(uploadDir, `processed-${file.filename}`);
    
    // Process image with Sharp
    await sharp(originalPath)
      .resize(800, 800, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({
        quality: 80,
        progressive: true
      })
      .toFile(processedPath);
    
    // Replace original file with processed version
    fs.unlinkSync(originalPath);
    fs.renameSync(processedPath, originalPath);
    
    // Update file info
    const stats = fs.statSync(originalPath);
    req.file.size = stats.size;
    
    console.log(`📸 Image processed: ${file.filename} (${(file.size / 1024).toFixed(1)}KB)`);
    next();
  } catch (error) {
    console.error('Image processing error:', error);
    // Clean up files on error
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    next(new ValidationError('Image processing failed'));
  }
};

// Profile picture upload middleware
const uploadProfilePicture = [
  upload.single('profilePicture'),
  processImage
];

// Document upload middleware
const uploadDocument = [
  upload.single('document')
];

// File cleanup utility
const cleanupFile = (filePath) => {
  if (filePath && fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    console.log(`🗑️  Cleaned up file: ${path.basename(filePath)}`);
  }
};

// Validate file upload
const validateFileUpload = (req, res, next) => {
  if (!req.file) {
    return next(new ValidationError('No file uploaded'));
  }
  
  // Additional validation can be added here
  console.log(`📁 File uploaded: ${req.file.filename} (${(req.file.size / 1024).toFixed(1)}KB)`);
  next();
};

module.exports = {
  uploadProfilePicture,
  uploadDocument,
  validateFileUpload,
  processImage,
  cleanupFile,
  ensureUploadDirectory
}; 