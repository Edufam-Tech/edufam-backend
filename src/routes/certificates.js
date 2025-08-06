const express = require('express');
const router = express.Router();
const { authenticate, requireRole, requireUserType } = require('../middleware/auth');
const CertificateController = require('../controllers/certificateController');

// Apply authentication to all routes
router.use(authenticate);
router.use(requireUserType('school_user'));

// =============================================================================
// CERTIFICATE TEMPLATE ROUTES
// =============================================================================

/**
 * @route   POST /api/certificates/templates
 * @desc    Create a new certificate template
 * @access  Private (Principal, School Director)
 */
router.post('/templates',
  requireRole(['principal', 'school_director']),
  CertificateController.createTemplate
);

/**
 * @route   GET /api/certificates/templates
 * @desc    Get all certificate templates
 * @access  Private (All school staff)
 */
router.get('/templates',
  CertificateController.getTemplates
);

/**
 * @route   PUT /api/certificates/templates/:id
 * @desc    Update a certificate template
 * @access  Private (Principal, School Director)
 */
router.put('/templates/:id',
  requireRole(['principal', 'school_director']),
  CertificateController.updateTemplate
);

/**
 * @route   DELETE /api/certificates/templates/:id
 * @desc    Delete a certificate template
 * @access  Private (Principal, School Director)
 */
router.delete('/templates/:id',
  requireRole(['principal', 'school_director']),
  CertificateController.deleteTemplate
);

// =============================================================================
// CERTIFICATE TYPE ROUTES
// =============================================================================

/**
 * @route   POST /api/certificates/types
 * @desc    Create a new certificate type
 * @access  Private (Principal, School Director)
 */
router.post('/types',
  requireRole(['principal', 'school_director']),
  CertificateController.createCertificateType
);

/**
 * @route   GET /api/certificates/types
 * @desc    Get all certificate types
 * @access  Private (All school staff)
 */
router.get('/types',
  CertificateController.getCertificateTypes
);

// =============================================================================
// CERTIFICATE GENERATION ROUTES
// =============================================================================

/**
 * @route   POST /api/certificates/generate
 * @desc    Generate a single certificate
 * @access  Private (Principal, School Director, Teacher)
 */
router.post('/generate',
  requireRole(['principal', 'school_director', 'teacher', 'academic_coordinator']),
  CertificateController.generateCertificate
);

/**
 * @route   POST /api/certificates/bulk-generate
 * @desc    Generate certificates in bulk
 * @access  Private (Principal, School Director)
 */
router.post('/bulk-generate',
  requireRole(['principal', 'school_director']),
  CertificateController.bulkGenerateCertificates
);

/**
 * @route   GET /api/certificates/student/:studentId
 * @desc    Get all certificates for a student
 * @access  Private (All school users, Parents for their children)
 */
router.get('/student/:studentId',
  CertificateController.getStudentCertificates
);

/**
 * @route   GET /api/certificates/:id
 * @desc    Get a specific certificate
 * @access  Private (All school users)
 */
router.get('/:id',
  CertificateController.getCertificate
);

// =============================================================================
// CERTIFICATE MANAGEMENT ROUTES
// =============================================================================

/**
 * @route   GET /api/certificates/:id/download
 * @desc    Download certificate PDF
 * @access  Private (All school users)
 */
router.get('/:id/download',
  CertificateController.downloadCertificate
);

/**
 * @route   POST /api/certificates/:id/email
 * @desc    Email certificate to recipient
 * @access  Private (Principal, School Director, Teacher)
 */
router.post('/:id/email',
  requireRole(['principal', 'school_director', 'teacher', 'academic_coordinator']),
  CertificateController.emailCertificate
);

// =============================================================================
// SIGNATURE MANAGEMENT ROUTES
// =============================================================================

/**
 * @route   POST /api/certificates/signatures
 * @desc    Add authorized signature
 * @access  Private (Principal, School Director)
 */
router.post('/signatures',
  requireRole(['principal', 'school_director']),
  async (req, res, next) => {
    try {
      const { query } = require('../config/database');
      const { ValidationError } = require('../middleware/errorHandler');

      const {
        signatoryName,
        title,
        signatureImageUrl,
        canSignGraduation = false,
        canSignMerit = true,
        canSignParticipation = true,
        canSignAchievement = true
      } = req.body;

      if (!signatoryName || !title || !signatureImageUrl) {
        throw new ValidationError('Signatory name, title, and signature image are required');
      }

      const result = await query(`
        INSERT INTO certificate_signatures (
          school_id, signatory_name, title, signature_image_url,
          can_sign_graduation, can_sign_merit, can_sign_participation,
          can_sign_achievement, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `, [
        req.user.schoolId, signatoryName, title, signatureImageUrl,
        canSignGraduation, canSignMerit, canSignParticipation,
        canSignAchievement, req.user.userId
      ]);

      res.status(201).json({
        success: true,
        message: 'Certificate signature added successfully',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/certificates/signatures
 * @desc    Get all authorized signatures
 * @access  Private (All school staff)
 */
router.get('/signatures',
  async (req, res, next) => {
    try {
      const { query } = require('../config/database');
      const { isActive } = req.query;

      let whereClause = 'WHERE school_id = $1';
      const params = [req.user.schoolId];

      if (isActive !== undefined) {
        whereClause += ` AND is_active = $${params.length + 1}`;
        params.push(isActive === 'true');
      }

      const result = await query(`
        SELECT *
        FROM certificate_signatures 
        ${whereClause}
        ORDER BY signatory_name
      `, params);

      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   DELETE /api/certificates/signatures/:id
 * @desc    Remove authorized signature
 * @access  Private (Principal, School Director)
 */
router.delete('/signatures/:id',
  requireRole(['principal', 'school_director']),
  async (req, res, next) => {
    try {
      const { query } = require('../config/database');
      const { NotFoundError } = require('../middleware/errorHandler');
      const { id } = req.params;

      const result = await query(`
        DELETE FROM certificate_signatures 
        WHERE id = $1 AND school_id = $2
        RETURNING *
      `, [id, req.user.schoolId]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Certificate signature not found');
      }

      res.json({
        success: true,
        message: 'Certificate signature removed successfully'
      });
    } catch (error) {
      next(error);
    }
  }
);

// =============================================================================
// BULK OPERATIONS ROUTES
// =============================================================================

/**
 * @route   GET /api/certificates/bulk-jobs
 * @desc    Get bulk certificate generation jobs
 * @access  Private (Principal, School Director)
 */
router.get('/bulk-jobs',
  requireRole(['principal', 'school_director']),
  async (req, res, next) => {
    try {
      const { query } = require('../config/database');
      const { status, limit = 20, offset = 0 } = req.query;

      let whereClause = 'WHERE school_id = $1';
      const params = [req.user.schoolId];

      if (status) {
        whereClause += ` AND status = $${params.length + 1}`;
        params.push(status);
      }

      const result = await query(`
        SELECT 
          bcj.*,
          ct.name as certificate_type_name,
          ctemp.name as template_name
        FROM bulk_certificate_jobs bcj
        JOIN certificate_types ct ON bcj.certificate_type_id = ct.id
        JOIN certificate_templates ctemp ON bcj.template_id = ctemp.id
        ${whereClause}
        ORDER BY bcj.created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `, [...params, limit, offset]);

      res.json({
        success: true,
        data: result.rows,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: result.rows.length
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/certificates/bulk-jobs/:id
 * @desc    Get specific bulk job details
 * @access  Private (Principal, School Director)
 */
router.get('/bulk-jobs/:id',
  requireRole(['principal', 'school_director']),
  async (req, res, next) => {
    try {
      const { query } = require('../config/database');
      const { NotFoundError } = require('../middleware/errorHandler');
      const { id } = req.params;

      const result = await query(`
        SELECT 
          bcj.*,
          ct.name as certificate_type_name,
          ctemp.name as template_name
        FROM bulk_certificate_jobs bcj
        JOIN certificate_types ct ON bcj.certificate_type_id = ct.id
        JOIN certificate_templates ctemp ON bcj.template_id = ctemp.id
        WHERE bcj.id = $1 AND bcj.school_id = $2
      `, [id, req.user.schoolId]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Bulk job not found');
      }

      res.json({
        success: true,
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }
);

// =============================================================================
// ANALYTICS ROUTES
// =============================================================================

/**
 * @route   GET /api/certificates/analytics
 * @desc    Get certificate analytics
 * @access  Private (Principal, School Director)
 */
router.get('/analytics',
  requireRole(['principal', 'school_director']),
  async (req, res, next) => {
    try {
      const { query } = require('../config/database');
      const { startDate, endDate, certificateType } = req.query;

      let whereClause = 'WHERE school_id = $1';
      const params = [req.user.schoolId];

      if (startDate) {
        whereClause += ` AND issue_date >= $${params.length + 1}`;
        params.push(startDate);
      }

      if (endDate) {
        whereClause += ` AND issue_date <= $${params.length + 1}`;
        params.push(endDate);
      }

      if (certificateType) {
        whereClause += ` AND certificate_type_id = $${params.length + 1}`;
        params.push(certificateType);
      }

      // Get basic statistics
      const [overviewResult, typeBreakdownResult, monthlyTrendsResult] = await Promise.all([
        query(`
          SELECT 
            COUNT(*) as total_certificates,
            COUNT(DISTINCT student_id) as unique_students,
            COUNT(CASE WHEN status = 'issued' THEN 1 END) as issued_certificates,
            COUNT(CASE WHEN status = 'generated' THEN 1 END) as generated_certificates
          FROM certificates_issued 
          ${whereClause}
        `, params),

        query(`
          SELECT 
            ct.name as certificate_type,
            COUNT(*) as count
          FROM certificates_issued ci
          JOIN certificate_types ct ON ci.certificate_type_id = ct.id
          ${whereClause}
          GROUP BY ct.id, ct.name
          ORDER BY count DESC
        `, params),

        query(`
          SELECT 
            DATE_TRUNC('month', issue_date) as month,
            COUNT(*) as certificates_issued
          FROM certificates_issued 
          ${whereClause}
          GROUP BY DATE_TRUNC('month', issue_date)
          ORDER BY month DESC
          LIMIT 12
        `, params)
      ]);

      const analytics = {
        overview: overviewResult.rows[0],
        typeBreakdown: typeBreakdownResult.rows,
        monthlyTrends: monthlyTrendsResult.rows
      };

      res.json({
        success: true,
        data: analytics
      });
    } catch (error) {
      next(error);
    }
  }
);

// =============================================================================
// PUBLIC VERIFICATION ROUTE (no authentication required)
// =============================================================================

const publicVerificationRouter = express.Router();

/**
 * @route   GET /api/verify-certificate/:code
 * @desc    Verify certificate using verification code (PUBLIC)
 * @access  Public
 */
publicVerificationRouter.get('/:code', CertificateController.verifyCertificate);

module.exports = router;

// Export public router separately for mounting at different path
module.exports.publicVerificationRouter = publicVerificationRouter;