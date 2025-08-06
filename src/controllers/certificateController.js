const { query } = require('../config/database');
const { ValidationError, NotFoundError, ConflictError } = require('../middleware/errorHandler');
const crypto = require('crypto');

class CertificateController {
  // =============================================================================
  // CERTIFICATE TEMPLATE MANAGEMENT
  // =============================================================================

  // Create certificate template
  static async createTemplate(req, res, next) {
    try {
      const {
        name,
        description,
        certificateType,
        templateHtml,
        templateCss = '',
        backgroundImageUrl,
        logoUrl,
        pageSize = 'A4',
        orientation = 'landscape',
        margins = { top: 20, bottom: 20, left: 20, right: 20 }
      } = req.body;

      if (!name || !certificateType || !templateHtml) {
        throw new ValidationError('Name, certificate type, and template HTML are required');
      }

      const result = await query(`
        INSERT INTO certificate_templates (
          school_id, name, description, certificate_type, template_html, template_css,
          background_image_url, logo_url, page_size, orientation,
          margin_top, margin_bottom, margin_left, margin_right, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING *
      `, [
        req.user.schoolId, name, description, certificateType, templateHtml, templateCss,
        backgroundImageUrl, logoUrl, pageSize, orientation,
        margins.top, margins.bottom, margins.left, margins.right, req.user.userId
      ]);

      res.status(201).json({
        success: true,
        message: 'Certificate template created successfully',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }

  // Get certificate templates
  static async getTemplates(req, res, next) {
    try {
      const { certificateType, isActive, limit = 20, offset = 0 } = req.query;

      let whereClause = 'WHERE school_id = $1';
      const params = [req.user.schoolId];

      if (certificateType) {
        whereClause += ` AND certificate_type = $${params.length + 1}`;
        params.push(certificateType);
      }

      if (isActive !== undefined) {
        whereClause += ` AND is_active = $${params.length + 1}`;
        params.push(isActive === 'true');
      }

      const result = await query(`
        SELECT *
        FROM certificate_templates 
        ${whereClause}
        ORDER BY created_at DESC
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

  // Update certificate template
  static async updateTemplate(req, res, next) {
    try {
      const { id } = req.params;
      const updates = req.body;

      const allowedFields = [
        'name', 'description', 'template_html', 'template_css', 'background_image_url',
        'logo_url', 'page_size', 'orientation', 'margin_top', 'margin_bottom',
        'margin_left', 'margin_right', 'is_active'
      ];

      const setClause = [];
      const values = [];
      let paramIndex = 1;

      Object.keys(updates).forEach(key => {
        if (allowedFields.includes(key)) {
          setClause.push(`${key} = $${paramIndex}`);
          values.push(updates[key]);
          paramIndex++;
        }
      });

      if (setClause.length === 0) {
        throw new ValidationError('No valid fields provided for update');
      }

      setClause.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(id, req.user.schoolId);

      const result = await query(`
        UPDATE certificate_templates 
        SET ${setClause.join(', ')}
        WHERE id = $${paramIndex} AND school_id = $${paramIndex + 1}
        RETURNING *
      `, values);

      if (result.rows.length === 0) {
        throw new NotFoundError('Certificate template not found');
      }

      res.json({
        success: true,
        message: 'Certificate template updated successfully',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }

  // Delete certificate template
  static async deleteTemplate(req, res, next) {
    try {
      const { id } = req.params;

      // Check if template is being used
      const usageCheck = await query(`
        SELECT COUNT(*) as usage_count
        FROM certificates_issued 
        WHERE template_id = $1
      `, [id]);

      if (parseInt(usageCheck.rows[0].usage_count) > 0) {
        throw new ConflictError('Cannot delete template that has been used to issue certificates');
      }

      const result = await query(`
        DELETE FROM certificate_templates 
        WHERE id = $1 AND school_id = $2
        RETURNING *
      `, [id, req.user.schoolId]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Certificate template not found');
      }

      res.json({
        success: true,
        message: 'Certificate template deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  // =============================================================================
  // CERTIFICATE TYPE MANAGEMENT
  // =============================================================================

  // Create certificate type
  static async createCertificateType(req, res, next) {
    try {
      const {
        name,
        description,
        code,
        requiresGrade = false,
        minimumGrade,
        requiresAttendance = false,
        minimumAttendancePercentage,
        requiresConduct = false,
        autoGenerate = false,
        generationTrigger = 'manual'
      } = req.body;

      if (!name || !code) {
        throw new ValidationError('Name and code are required');
      }

      const result = await query(`
        INSERT INTO certificate_types (
          school_id, name, description, code, requires_grade, minimum_grade,
          requires_attendance, minimum_attendance_percentage, requires_conduct,
          auto_generate, generation_trigger
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `, [
        req.user.schoolId, name, description, code, requiresGrade, minimumGrade,
        requiresAttendance, minimumAttendancePercentage, requiresConduct,
        autoGenerate, generationTrigger
      ]);

      res.status(201).json({
        success: true,
        message: 'Certificate type created successfully',
        data: result.rows[0]
      });
    } catch (error) {
      if (error.code === '23505') { // Unique violation
        next(new ConflictError('Certificate type code already exists'));
      } else {
        next(error);
      }
    }
  }

  // Get certificate types
  static async getCertificateTypes(req, res, next) {
    try {
      const { isActive } = req.query;

      let whereClause = 'WHERE school_id = $1';
      const params = [req.user.schoolId];

      if (isActive !== undefined) {
        whereClause += ` AND is_active = $${params.length + 1}`;
        params.push(isActive === 'true');
      }

      const result = await query(`
        SELECT *
        FROM certificate_types 
        ${whereClause}
        ORDER BY name
      `, params);

      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      next(error);
    }
  }

  // =============================================================================
  // CERTIFICATE GENERATION
  // =============================================================================

  // Generate single certificate
  static async generateCertificate(req, res, next) {
    try {
      const {
        studentId,
        certificateTypeId,
        templateId,
        academicYear,
        academicTerm,
        gradeAchieved,
        customData = {}
      } = req.body;

      if (!studentId || !certificateTypeId || !templateId) {
        throw new ValidationError('Student ID, certificate type ID, and template ID are required');
      }

      // Verify student belongs to school
      const studentResult = await query(`
        SELECT s.*, CONCAT(s.first_name, ' ', s.last_name) as full_name
        FROM students s 
        WHERE s.id = $1 AND s.school_id = $2
      `, [studentId, req.user.schoolId]);

      if (studentResult.rows.length === 0) {
        throw new NotFoundError('Student not found');
      }

      const student = studentResult.rows[0];

      // Get certificate type and template
      const [typeResult, templateResult] = await Promise.all([
        query('SELECT * FROM certificate_types WHERE id = $1 AND school_id = $2', [certificateTypeId, req.user.schoolId]),
        query('SELECT * FROM certificate_templates WHERE id = $1 AND school_id = $2', [templateId, req.user.schoolId])
      ]);

      if (typeResult.rows.length === 0) {
        throw new NotFoundError('Certificate type not found');
      }

      if (templateResult.rows.length === 0) {
        throw new NotFoundError('Certificate template not found');
      }

      const certificateType = typeResult.rows[0];
      const template = templateResult.rows[0];

      // Validate requirements
      if (certificateType.requires_grade && !gradeAchieved) {
        throw new ValidationError('Grade is required for this certificate type');
      }

      // Generate certificate number
      const certificateNumber = await CertificateController.generateCertificateNumber(req.user.schoolId, certificateType.code);

      // Generate verification code
      const verificationCode = crypto.randomBytes(16).toString('hex');

      // Create certificate record
      const certificateResult = await query(`
        INSERT INTO certificates_issued (
          school_id, certificate_number, student_id, certificate_type_id, template_id,
          student_name, issue_date, academic_year, academic_term, grade_achieved,
          verification_code, status, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *
      `, [
        req.user.schoolId, certificateNumber, studentId, certificateTypeId, templateId,
        student.full_name, new Date().toISOString().split('T')[0], academicYear, academicTerm,
        gradeAchieved, verificationCode, 'generated', req.user.userId
      ]);

      const certificate = certificateResult.rows[0];

      // Create verification record
      await query(`
        INSERT INTO certificate_verifications (
          certificate_id, verification_code, qr_code_data, verification_url
        ) VALUES ($1, $2, $3, $4)
      `, [
        certificate.id,
        verificationCode,
        JSON.stringify({ certificateId: certificate.id, verificationCode }),
        `${process.env.APP_URL}/verify-certificate/${verificationCode}`
      ]);

      // Here you would typically generate the PDF
      // For now, we'll simulate this step
      const pdfUrl = await CertificateController.generatePDF(certificate, template, student, customData);

      // Update certificate with PDF URL
      await query(`
        UPDATE certificates_issued 
        SET pdf_url = $1, pdf_generated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [pdfUrl, certificate.id]);

      res.status(201).json({
        success: true,
        message: 'Certificate generated successfully',
        data: {
          ...certificate,
          pdf_url: pdfUrl,
          verification_url: `${process.env.APP_URL}/verify-certificate/${verificationCode}`
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Bulk certificate generation
  static async bulkGenerateCertificates(req, res, next) {
    try {
      const {
        jobName,
        certificateTypeId,
        templateId,
        filterCriteria = {},
        academicYear,
        academicTerm
      } = req.body;

      if (!jobName || !certificateTypeId || !templateId) {
        throw new ValidationError('Job name, certificate type ID, and template ID are required');
      }

      // Get students based on filter criteria
      let whereClause = 'WHERE s.school_id = $1 AND s.is_active = true';
      const params = [req.user.schoolId];

      if (filterCriteria.classId) {
        whereClause += ` AND s.class_id = $${params.length + 1}`;
        params.push(filterCriteria.classId);
      }

      if (filterCriteria.gradeLevel) {
        whereClause += ` AND s.class_level = $${params.length + 1}`;
        params.push(filterCriteria.gradeLevel);
      }

      const studentsResult = await query(`
        SELECT s.*, CONCAT(s.first_name, ' ', s.last_name) as full_name
        FROM students s 
        ${whereClause}
        ORDER BY s.last_name, s.first_name
      `, params);

      const students = studentsResult.rows;

      // Create bulk job record
      const jobResult = await query(`
        INSERT INTO bulk_certificate_jobs (
          school_id, job_name, certificate_type_id, template_id,
          filter_criteria, total_students, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `, [
        req.user.schoolId, jobName, certificateTypeId, templateId,
        JSON.stringify(filterCriteria), students.length, req.user.userId
      ]);

      const job = jobResult.rows[0];

      // Start processing (in a real implementation, this would be async)
      const results = await CertificateController.processBulkGeneration(
        job.id, students, certificateTypeId, templateId, academicYear, academicTerm, req.user
      );

      res.status(201).json({
        success: true,
        message: 'Bulk certificate generation completed',
        data: {
          job,
          results
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Get student certificates
  static async getStudentCertificates(req, res, next) {
    try {
      const { studentId } = req.params;
      const { status, limit = 20, offset = 0 } = req.query;

      let whereClause = 'WHERE ci.school_id = $1 AND ci.student_id = $2';
      const params = [req.user.schoolId, studentId];

      if (status) {
        whereClause += ` AND ci.status = $${params.length + 1}`;
        params.push(status);
      }

      const result = await query(`
        SELECT 
          ci.*,
          ct.name as certificate_type_name,
          ct.description as certificate_type_description,
          ctemp.name as template_name
        FROM certificates_issued ci
        JOIN certificate_types ct ON ci.certificate_type_id = ct.id
        JOIN certificate_templates ctemp ON ci.template_id = ctemp.id
        ${whereClause}
        ORDER BY ci.issue_date DESC
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

  // Get certificate by ID
  static async getCertificate(req, res, next) {
    try {
      const { id } = req.params;

      const result = await query(`
        SELECT 
          ci.*,
          ct.name as certificate_type_name,
          ctemp.name as template_name,
          s.first_name as student_first_name,
          s.last_name as student_last_name
        FROM certificates_issued ci
        JOIN certificate_types ct ON ci.certificate_type_id = ct.id
        JOIN certificate_templates ctemp ON ci.template_id = ctemp.id
        JOIN students s ON ci.student_id = s.id
        WHERE ci.id = $1 AND ci.school_id = $2
      `, [id, req.user.schoolId]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Certificate not found');
      }

      res.json({
        success: true,
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }

  // =============================================================================
  // CERTIFICATE VERIFICATION
  // =============================================================================

  // Verify certificate (public endpoint)
  static async verifyCertificate(req, res, next) {
    try {
      const { code } = req.params;

      const result = await query(`
        SELECT 
          ci.*,
          ct.name as certificate_type_name,
          s.first_name as student_first_name,
          s.last_name as student_last_name,
          sch.name as school_name
        FROM certificate_verifications cv
        JOIN certificates_issued ci ON cv.certificate_id = ci.id
        JOIN certificate_types ct ON ci.certificate_type_id = ct.id
        JOIN students s ON ci.student_id = s.id
        JOIN schools sch ON ci.school_id = sch.id
        WHERE cv.verification_code = $1 AND cv.is_active = true
      `, [code]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'CERTIFICATE_NOT_FOUND',
            message: 'Invalid verification code or certificate not found'
          }
        });
      }

      const certificate = result.rows[0];

      // Update verification count
      await query(`
        UPDATE certificate_verifications 
        SET verification_count = verification_count + 1,
            last_verified_at = CURRENT_TIMESTAMP,
            last_verified_ip = $1
        WHERE verification_code = $2
      `, [req.ip, code]);

      res.json({
        success: true,
        data: {
          isValid: true,
          certificate: {
            certificateNumber: certificate.certificate_number,
            studentName: `${certificate.student_first_name} ${certificate.student_last_name}`,
            certificateType: certificate.certificate_type_name,
            issueDate: certificate.issue_date,
            academicYear: certificate.academic_year,
            academicTerm: certificate.academic_term,
            gradeAchieved: certificate.grade_achieved,
            schoolName: certificate.school_name,
            status: certificate.status
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // =============================================================================
  // CERTIFICATE MANAGEMENT
  // =============================================================================

  // Download certificate PDF
  static async downloadCertificate(req, res, next) {
    try {
      const { id } = req.params;

      const result = await query(`
        SELECT pdf_url, certificate_number, student_name
        FROM certificates_issued 
        WHERE id = $1 AND school_id = $2
      `, [id, req.user.schoolId]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Certificate not found');
      }

      const certificate = result.rows[0];

      if (!certificate.pdf_url) {
        throw new ValidationError('Certificate PDF not available');
      }

      // In a real implementation, you would serve the actual file
      // For now, we'll just return the URL
      res.json({
        success: true,
        data: {
          downloadUrl: certificate.pdf_url,
          filename: `${certificate.certificate_number}_${certificate.student_name}.pdf`
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Email certificate
  static async emailCertificate(req, res, next) {
    try {
      const { id } = req.params;
      const { recipientEmail, message = '' } = req.body;

      if (!recipientEmail) {
        throw new ValidationError('Recipient email is required');
      }

      const result = await query(`
        SELECT ci.*, s.first_name, s.last_name
        FROM certificates_issued ci
        JOIN students s ON ci.student_id = s.id
        WHERE ci.id = $1 AND ci.school_id = $2
      `, [id, req.user.schoolId]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Certificate not found');
      }

      const certificate = result.rows[0];

      // In a real implementation, you would send the actual email
      // For now, we'll simulate this
      console.log(`Sending certificate ${certificate.certificate_number} to ${recipientEmail}`);

      res.json({
        success: true,
        message: 'Certificate emailed successfully',
        data: {
          recipientEmail,
          certificateNumber: certificate.certificate_number,
          sentAt: new Date().toISOString()
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // =============================================================================
  // HELPER METHODS
  // =============================================================================

  // Generate certificate number
  static async generateCertificateNumber(schoolId, typeCode) {
    const year = new Date().getFullYear();
    const prefix = `${typeCode}-${year}`;

    const result = await query(`
      SELECT COUNT(*) as count
      FROM certificates_issued 
      WHERE school_id = $1 AND certificate_number LIKE $2
    `, [schoolId, `${prefix}-%`]);

    const sequence = parseInt(result.rows[0].count) + 1;
    return `${prefix}-${sequence.toString().padStart(4, '0')}`;
  }

  // Generate PDF (simplified simulation)
  static async generatePDF(certificate, template, student, customData) {
    // In a real implementation, you would use a PDF generation library
    // like Puppeteer, PDFKit, or similar to generate actual PDFs
    
    // Simulate PDF generation
    const pdfUrl = `https://certificates.edufam.com/pdf/${certificate.id}.pdf`;
    
    console.log(`Generated PDF for certificate ${certificate.certificate_number}`);
    console.log(`Template: ${template.name}`);
    console.log(`Student: ${student.full_name}`);
    
    return pdfUrl;
  }

  // Process bulk generation
  static async processBulkGeneration(jobId, students, certificateTypeId, templateId, academicYear, academicTerm, user) {
    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    // Update job status
    await query(`
      UPDATE bulk_certificate_jobs 
      SET status = 'processing', started_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [jobId]);

    for (const student of students) {
      try {
        // Generate certificate for each student
        const certificateNumber = await CertificateController.generateCertificateNumber(user.schoolId, 'BULK');
        const verificationCode = crypto.randomBytes(16).toString('hex');

        await query(`
          INSERT INTO certificates_issued (
            school_id, certificate_number, student_id, certificate_type_id, template_id,
            student_name, issue_date, academic_year, academic_term,
            verification_code, status, created_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, [
          user.schoolId, certificateNumber, student.id, certificateTypeId, templateId,
          student.full_name, new Date().toISOString().split('T')[0], academicYear, academicTerm,
          verificationCode, 'generated', user.userId
        ]);

        successCount++;
      } catch (error) {
        errorCount++;
        errors.push({
          studentId: student.id,
          studentName: student.full_name,
          error: error.message
        });
      }
    }

    // Update job completion
    await query(`
      UPDATE bulk_certificate_jobs 
      SET status = 'completed', completed_at = CURRENT_TIMESTAMP,
          success_count = $1, error_count = $2, error_details = $3
      WHERE id = $4
    `, [successCount, errorCount, JSON.stringify(errors), jobId]);

    return {
      successCount,
      errorCount,
      errors
    };
  }
}

module.exports = CertificateController;