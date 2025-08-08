const { body, param, query, validationResult } = require('express-validator');

// Handle validation errors
const handleValidationErrors = (req, res, next) => {
  // Skip validation for OPTIONS requests
  if (req.method === 'OPTIONS') {
    return next();
  }
  
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid input data',
        details: errors.array().map(error => ({
          field: error.param,
          message: error.msg,
          value: error.value
        }))
      }
    });
  }
  next();
};

// Common validation rules
const validationRules = {
  // Email validation
  email: body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Must be a valid email address')
    .isLength({ max: 255 })
    .withMessage('Email must be less than 255 characters'),
  
  // Password validation
  password: body('password')
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be between 8 and 128 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
  
  // Name validation
  firstName: body('firstName')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('First name is required and must be less than 100 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('First name can only contain letters, spaces, hyphens, and apostrophes'),
  
  lastName: body('lastName')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Last name is required and must be less than 100 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('Last name can only contain letters, spaces, hyphens, and apostrophes'),
  
  // Phone validation (Kenyan format)
  phone: body('phone')
    .optional()
    .matches(/^(\+254|0)[17]\d{8}$/)
    .withMessage('Phone number must be a valid Kenyan format (+254xxxxxxxxx or 0xxxxxxxxx)'),
  
  // UUID validation
  uuid: (field) => param(field)
    .isUUID(4)
    .withMessage(`${field} must be a valid UUID`),
  
  // User type validation
  userType: body('userType')
    .isIn(['school_user', 'admin_user'])
    .withMessage('User type must be either school_user or admin_user'),
  
  // Role validation
  role: body('role')
    .isIn([
      'school_director', 'principal', 'teacher', 'parent', 'hr', 'finance',
      'super_admin', 'engineer', 'support_hr', 'sales_marketing', 'admin_finance'
    ])
    .withMessage('Invalid role specified'),
  
  // Pagination validation
  page: query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  limit: query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  // File validation (will be used with multer)
  fileType: body('fileType')
    .optional()
    .isIn(['profile_picture', 'document', 'image', 'other'])
    .withMessage('Invalid file type'),
  
  // School validation
  schoolName: body('name')
    .trim()
    .isLength({ min: 2, max: 255 })
    .withMessage('School name must be between 2 and 255 characters'),
  
  // Staff validation
  staffFirstName: body('firstName')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('First name is required and must be less than 100 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('First name can only contain letters, spaces, hyphens, and apostrophes'),
  
  staffLastName: body('lastName')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Last name is required and must be less than 100 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('Last name can only contain letters, spaces, hyphens, and apostrophes'),
  
  staffEmail: body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Must be a valid email address')
    .isLength({ max: 255 })
    .withMessage('Email must be less than 255 characters'),
  
  staffPhone: body('phone')
    .optional()
    .matches(/^(\+254|0)[17]\d{8}$/)
    .withMessage('Phone number must be a valid Kenyan format (+254xxxxxxxxx or 0xxxxxxxxx)'),
  
  staffRole: body('role')
    .isIn(['teacher', 'principal', 'department_head', 'school_admin', 'hr', 'finance', 'librarian', 'counselor', 'nurse', 'security', 'maintenance'])
    .withMessage('Invalid staff role specified'),
  
  staffDepartment: body('departmentId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Department ID must be a positive integer'),
  
  staffSchool: body('schoolId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('School ID must be a positive integer'),
  
  staffStatus: body('status')
    .optional()
    .isIn(['active', 'inactive', 'suspended'])
    .withMessage('Status must be active, inactive, or suspended'),
  
  // Department validation
  departmentName: body('name')
    .trim()
    .isLength({ min: 2, max: 255 })
    .withMessage('Department name must be between 2 and 255 characters')
    .matches(/^[a-zA-Z0-9\s'-]+$/)
    .withMessage('Department name can only contain letters, numbers, spaces, hyphens, and apostrophes'),
  
  departmentCode: body('code')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Department code must be between 2 and 50 characters')
    .matches(/^[A-Z0-9_-]+$/)
    .withMessage('Department code can only contain uppercase letters, numbers, underscores, and hyphens'),
  
  departmentDescription: body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Department description must be less than 1000 characters'),
  
  departmentSchool: body('schoolId')
    .isInt({ min: 1 })
    .withMessage('School ID must be a positive integer'),
  
  departmentHead: body('headId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Head ID must be a positive integer'),
  
  departmentStatus: body('status')
    .optional()
    .isIn(['active', 'inactive', 'deleted'])
    .withMessage('Status must be active, inactive, or deleted'),
  
  schoolCode: body('code')
    .trim()
    .isLength({ min: 3, max: 20 })
    .withMessage('School code must be between 3 and 20 characters')
    .matches(/^[A-Z0-9_-]+$/)
    .withMessage('School code can only contain uppercase letters, numbers, hyphens, and underscores'),
  
  schoolEmail: body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Must be a valid email address'),
  
  schoolPhone: body('phone')
    .optional()
    .matches(/^(\+254|0)[17]\d{8}$/)
    .withMessage('Phone number must be a valid Kenyan format'),
  
  subscriptionType: body('subscriptionType')
    .optional()
    .isIn(['monthly', 'termly', 'yearly'])
    .withMessage('Subscription type must be monthly, termly, or yearly'),
  
  pricePerStudent: body('pricePerStudent')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Price per student must be a positive number'),
  
  maxStudents: body('maxStudents')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Maximum students must be a positive integer'),
  
  // Academic Year validation
  academicYearName: body('name')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Academic year name must be between 2 and 50 characters'),
  
  startDate: body('startDate')
    .isISO8601()
    .withMessage('Start date must be a valid date'),
  
  endDate: body('endDate')
    .isISO8601()
    .withMessage('End date must be a valid date'),
  
  // Academic Term validation
  termName: body('name')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Term name must be between 2 and 50 characters'),
  
  curriculumType: body('curriculumType')
    .optional()
    .isIn(['CBC', 'IGCSE', '8-4-4'])
    .withMessage('Curriculum type must be CBC, IGCSE, or 8-4-4'),
  
  termNumber: body('termNumber')
    .optional()
    .isInt({ min: 1, max: 12 })
    .withMessage('Term number must be between 1 and 12'),
  
  // Student validation
  studentFirstName: body('firstName')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('First name must be between 2 and 100 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('First name can only contain letters, spaces, hyphens, and apostrophes'),
  
  studentLastName: body('lastName')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Last name must be between 2 and 100 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('Last name can only contain letters, spaces, hyphens, and apostrophes'),
  
  admissionNumber: body('admissionNumber')
    .optional()
    .trim()
    .isLength({ min: 3, max: 20 })
    .withMessage('Admission number must be between 3 and 20 characters'),
  
  dateOfBirth: body('dateOfBirth')
    .isISO8601()
    .withMessage('Date of birth must be a valid date'),
  
  gender: body('gender')
    .isIn(['male', 'female', 'other'])
    .withMessage('Gender must be male, female, or other'),
  
  studentEmail: body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Must be a valid email address'),
  
  studentPhone: body('phone')
    .optional()
    .matches(/^(\+254|0)[17]\d{8}$/)
    .withMessage('Phone number must be a valid Kenyan format'),
  
  studentCurriculumType: body('curriculumType')
    .optional()
    .isIn(['CBC', 'IGCSE', '8-4-4'])
    .withMessage('Curriculum type must be CBC, IGCSE, or 8-4-4'),
  
  enrollmentStatus: body('enrollmentStatus')
    .optional()
    .isIn(['active', 'inactive', 'suspended', 'graduated', 'transferred'])
    .withMessage('Invalid enrollment status'),
  
  // Class validation
  className: body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Class name must be between 2 and 100 characters'),
  
  gradeLevel: body('gradeLevel')
    .isInt({ min: 1, max: 12 })
    .withMessage('Grade level must be between 1 and 12'),
  
  classCapacity: body('capacity')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Class capacity must be between 1 and 100'),
  
  classCurriculumType: body('curriculumType')
    .optional()
    .isIn(['CBC', 'IGCSE', '8-4-4'])
    .withMessage('Curriculum type must be CBC, IGCSE, or 8-4-4'),
  
  academicYearId: body('academicYearId')
    .isUUID(4)
    .withMessage('Academic year ID must be a valid UUID'),
  
  // Enrollment validation
  studentId: body('studentId')
    .isUUID(4)
    .withMessage('Student ID must be a valid UUID'),
  
  classId: body('classId')
    .isUUID(4)
    .withMessage('Class ID must be a valid UUID'),
  
  enrollmentType: body('enrollmentType')
    .optional()
    .isIn(['new', 'transfer', 're-enrollment'])
    .withMessage('Enrollment type must be new, transfer, or re-enrollment'),
  
  enrollmentDate: body('enrollmentDate')
    .optional()
    .isISO8601()
    .withMessage('Enrollment date must be a valid date')
};

// Validation chains for common operations
const validationChains = {
  // Login validation
  login: [
    validationRules.email,
    body('password').notEmpty().withMessage('Password is required'),
    body('userType').optional().isIn(['school_user', 'admin_user']).withMessage('User type must be either school_user or admin_user'),
    handleValidationErrors
  ],
  
  // User creation validation
  createUser: [
    validationRules.email,
    validationRules.password,
    validationRules.firstName,
    validationRules.lastName,
    validationRules.phone,
    validationRules.userType,
    validationRules.role,
    handleValidationErrors
  ],
  
  // User update validation
  updateUser: [
    validationRules.firstName,
    validationRules.lastName,
    validationRules.phone,
    handleValidationErrors
  ],
  
  // Password reset validation
  passwordReset: [
    validationRules.email,
    handleValidationErrors
  ],
  
  // Password change validation
  passwordChange: [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    validationRules.password.withMessage('New password does not meet requirements'),
    body('confirmPassword')
      .custom((value, { req }) => {
        if (value !== req.body.password) {
          throw new Error('Password confirmation does not match');
        }
        return true;
      }),
    handleValidationErrors
  ],
  
  // UUID parameter validation
  uuidParam: (paramName = 'id') => [
    validationRules.uuid(paramName),
    handleValidationErrors
  ],
  
  // Pagination validation
  pagination: [
    validationRules.page,
    validationRules.limit,
    handleValidationErrors
  ],
  
  // School validation
  validateSchoolData: [
    validationRules.schoolName,
    validationRules.schoolCode,
    validationRules.schoolEmail,
    validationRules.schoolPhone,
    validationRules.subscriptionType,
    validationRules.pricePerStudent,
    validationRules.maxStudents,
    handleValidationErrors
  ],
  
  // Academic Year validation
  validateAcademicYearData: [
    validationRules.academicYearName,
    validationRules.startDate,
    validationRules.endDate,
    handleValidationErrors
  ],
  
  // Academic Term validation
  validateAcademicTermData: [
    validationRules.termName,
    validationRules.startDate,
    validationRules.endDate,
    validationRules.curriculumType,
    validationRules.termNumber,
    handleValidationErrors
  ],
  
  // Student validation
  validateStudentData: [
    validationRules.studentFirstName,
    validationRules.studentLastName,
    validationRules.admissionNumber,
    validationRules.dateOfBirth,
    validationRules.gender,
    validationRules.studentEmail,
    validationRules.studentPhone,
    validationRules.studentCurriculumType,
    validationRules.enrollmentStatus,
    handleValidationErrors
  ],
  
  // Class validation
  validateClassData: [
    validationRules.className,
    validationRules.gradeLevel,
    validationRules.academicYearId,
    validationRules.classCapacity,
    validationRules.classCurriculumType,
    handleValidationErrors
  ],
  
  // Enrollment validation
  validateEnrollmentData: [
    validationRules.studentId,
    validationRules.academicYearId,
    validationRules.classId,
    validationRules.enrollmentType,
    validationRules.enrollmentDate,
    handleValidationErrors
  ],
  
  // Staff validation
  validateStaffData: [
    validationRules.staffFirstName,
    validationRules.staffLastName,
    validationRules.staffEmail,
    validationRules.staffPhone,
    validationRules.staffRole,
    validationRules.staffDepartment,
    validationRules.staffSchool,
    validationRules.staffStatus,
    handleValidationErrors
  ],
  
  validateStaffUpdate: [
    validationRules.staffFirstName.optional(),
    validationRules.staffLastName.optional(),
    validationRules.staffEmail.optional(),
    validationRules.staffPhone,
    validationRules.staffRole.optional(),
    validationRules.staffDepartment,
    validationRules.staffSchool,
    validationRules.staffStatus,
    handleValidationErrors
  ],
  
  // Department validation
  validateDepartmentData: [
    validationRules.departmentName,
    validationRules.departmentCode,
    validationRules.departmentDescription,
    validationRules.departmentSchool,
    validationRules.departmentHead,
    validationRules.departmentStatus,
    handleValidationErrors
  ],
  
  validateDepartmentUpdate: [
    validationRules.departmentName.optional(),
    validationRules.departmentCode.optional(),
    validationRules.departmentDescription,
    validationRules.departmentSchool.optional(),
    validationRules.departmentHead,
    validationRules.departmentStatus,
    handleValidationErrors
  ]
};

// Validation functions for direct use
const validateSchoolData = (req, res, next) => {
  validationChains.validateSchoolData[validationChains.validateSchoolData.length - 2](req, res, next);
};

const validateAcademicYearData = (req, res, next) => {
  validationChains.validateAcademicYearData[validationChains.validateAcademicYearData.length - 2](req, res, next);
};

const validateAcademicTermData = (req, res, next) => {
  validationChains.validateAcademicTermData[validationChains.validateAcademicTermData.length - 2](req, res, next);
};

const validateStaffData = (req, res, next) => {
  validationChains.validateStaffData[validationChains.validateStaffData.length - 2](req, res, next);
};

const validateStaffUpdate = (req, res, next) => {
  validationChains.validateStaffUpdate[validationChains.validateStaffUpdate.length - 2](req, res, next);
};

const validateDepartmentData = (req, res, next) => {
  validationChains.validateDepartmentData[validationChains.validateDepartmentData.length - 2](req, res, next);
};

const validateDepartmentUpdate = (req, res, next) => {
  validationChains.validateDepartmentUpdate[validationChains.validateDepartmentUpdate.length - 2](req, res, next);
};

const validateStudentData = (req, res, next) => {
  const validationMiddleware = validationChains.validateStudentData;
  let index = 0;
  
  const runNext = (err) => {
    if (err) return next(err);
    if (index >= validationMiddleware.length) return next();
    
    const middleware = validationMiddleware[index++];
    middleware(req, res, runNext);
  };
  
  runNext();
};

const validateClassData = (req, res, next) => {
  const validationMiddleware = validationChains.validateClassData;
  let index = 0;
  
  const runNext = (err) => {
    if (err) return next(err);
    if (index >= validationMiddleware.length) return next();
    
    const middleware = validationMiddleware[index++];
    middleware(req, res, runNext);
  };
  
  runNext();
};

const validateEnrollmentData = (req, res, next) => {
  const validationMiddleware = validationChains.validateEnrollmentData;
  let index = 0;
  
  const runNext = (err) => {
    if (err) return next(err);
    if (index >= validationMiddleware.length) return next();
    
    const middleware = validationMiddleware[index++];
    middleware(req, res, runNext);
  };
  
  runNext();
};

module.exports = {
  validationRules,
  validationChains,
  handleValidationErrors,
  validate: handleValidationErrors, // Add the general validate function
  validateSchoolData,
  validateAcademicYearData,
  validateAcademicTermData,
  validateStaffData,
  validateStaffUpdate,
  validateDepartmentData,
  validateDepartmentUpdate,
  validateStudentData,
  validateClassData,
  validateEnrollmentData
}; 