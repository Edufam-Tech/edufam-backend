const { query } = require('../config/database');
const { ValidationError } = require('../middleware/errorHandler');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

// Note: In production, you would install and use actual PDF libraries
// For this implementation, we'll simulate the PDF generation process
// Recommended libraries: pdfkit, puppeteer, jsPDF, or @react-pdf/renderer

class CertificateService {
  // =============================================================================
  // PDF GENERATION CORE
  // =============================================================================

  // Generate certificate PDF from template
  static async generateCertificatePDF(certificateId, templateId, certificateData) {
    try {
      console.log(`📄 Starting PDF generation for certificate ${certificateId}`);

      // Get template details
      const template = await CertificateService.getTemplate(templateId);
      if (!template) {
        throw new ValidationError('Certificate template not found');
      }

      // Prepare certificate data
      const processedData = await CertificateService.processCertificateData(certificateData, template);

      // Generate PDF based on template type
      let pdfBuffer;
      switch (template.template_type) {
        case 'academic_certificate':
          pdfBuffer = await CertificateService.generateAcademicCertificate(template, processedData);
          break;
        case 'attendance_certificate':
          pdfBuffer = await CertificateService.generateAttendanceCertificate(template, processedData);
          break;
        case 'completion_certificate':
          pdfBuffer = await CertificateService.generateCompletionCertificate(template, processedData);
          break;
        case 'custom_certificate':
          pdfBuffer = await CertificateService.generateCustomCertificate(template, processedData);
          break;
        default:
          throw new ValidationError(`Unsupported template type: ${template.template_type}`);
      }

      // Add security features
      const securedPDF = await CertificateService.addSecurityFeatures(pdfBuffer, certificateId, template);

      // Save PDF file
      const filePath = await CertificateService.savePDFFile(certificateId, securedPDF);

      console.log(`✅ PDF generated successfully: ${filePath}`);

      return {
        filePath,
        fileSize: securedPDF.length,
        mimeType: 'application/pdf',
        securityHash: CertificateService.calculateSecurityHash(securedPDF),
        generatedAt: new Date().toISOString()
      };

    } catch (error) {
      console.error('❌ PDF generation failed:', error);
      throw error;
    }
  }

  // =============================================================================
  // TEMPLATE MANAGEMENT
  // =============================================================================

  // Get certificate template
  static async getTemplate(templateId) {
    const result = await query(`
      SELECT * FROM certificate_templates WHERE id = $1 AND is_active = true
    `, [templateId]);

    return result.rows[0] || null;
  }

  // Process certificate data with template variables
  static async processCertificateData(data, template) {
    const templateVariables = JSON.parse(template.template_variables || '{}');
    const processedData = { ...data };

    // Add computed fields
    processedData.issueDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    processedData.certificateNumber = data.certificate_number || 
      await CertificateService.generateCertificateNumber(template.school_id);

    // Add school information
    if (data.school_id) {
      const schoolInfo = await CertificateService.getSchoolInfo(data.school_id);
      processedData.school = schoolInfo;
    }

    // Add student information
    if (data.student_id) {
      const studentInfo = await CertificateService.getStudentInfo(data.student_id);
      processedData.student = studentInfo;
    }

    // Process dynamic variables
    for (const [key, variable] of Object.entries(templateVariables)) {
      if (variable.type === 'computed') {
        processedData[key] = await CertificateService.computeVariable(variable, processedData);
      }
    }

    return processedData;
  }

  // Generate unique certificate number
  static async generateCertificateNumber(schoolId) {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    
    // Get next sequence number for this school and month
    const sequence = await query(`
      INSERT INTO certificate_sequences (school_id, year, month, sequence_number)
      VALUES ($1, $2, $3, 1)
      ON CONFLICT (school_id, year, month)
      DO UPDATE SET sequence_number = certificate_sequences.sequence_number + 1
      RETURNING sequence_number
    `, [schoolId, year, month]);

    const sequenceNumber = String(sequence.rows[0].sequence_number).padStart(4, '0');
    return `CERT-${year}${month}-${sequenceNumber}`;
  }

  // Get school information
  static async getSchoolInfo(schoolId) {
    const result = await query(`
      SELECT name, address, phone, email, logo_url, principal_name, motto
      FROM schools WHERE id = $1
    `, [schoolId]);

    return result.rows[0] || {};
  }

  // Get student information
  static async getStudentInfo(studentId) {
    const result = await query(`
      SELECT 
        s.*,
        c.name as class_name,
        c.grade_level
      FROM students s
      LEFT JOIN classes c ON s.class_id = c.id
      WHERE s.id = $1
    `, [studentId]);

    return result.rows[0] || {};
  }

  // Compute dynamic variables
  static async computeVariable(variable, data) {
    switch (variable.computation) {
      case 'grade_average':
        return await CertificateService.calculateGradeAverage(data.student_id, data.academic_year);
      
      case 'attendance_percentage':
        return await CertificateService.calculateAttendancePercentage(data.student_id, data.academic_year);
      
      case 'rank_in_class':
        return await CertificateService.calculateClassRank(data.student_id, data.class_id, data.academic_year);
      
      case 'total_students':
        return await CertificateService.getTotalStudents(data.class_id);
      
      default:
        return variable.default_value || '';
    }
  }

  // =============================================================================
  // SPECIFIC CERTIFICATE GENERATORS
  // =============================================================================

  // Generate academic performance certificate
  static async generateAcademicCertificate(template, data) {
    const pdfContent = {
      template: 'academic',
      layout: JSON.parse(template.layout_config || '{}'),
      content: {
        header: {
          schoolName: data.school?.name || 'School Name',
          schoolLogo: data.school?.logo_url,
          schoolAddress: data.school?.address,
          title: 'ACADEMIC PERFORMANCE CERTIFICATE'
        },
        body: {
          studentName: `${data.student?.first_name} ${data.student?.last_name}`,
          className: data.student?.class_name,
          academicYear: data.academic_year,
          gradeAverage: data.grade_average || 'N/A',
          rank: data.rank_in_class || 'N/A',
          totalStudents: data.total_students || 'N/A',
          subjects: data.subjects || [],
          remarks: data.remarks || 'Excellent academic performance'
        },
        footer: {
          issueDate: data.issueDate,
          certificateNumber: data.certificateNumber,
          principalName: data.school?.principal_name || 'Principal',
          principalSignature: data.principal_signature_url
        }
      },
      security: {
        watermark: template.security_features?.watermark || false,
        qrCode: template.security_features?.qr_code || false,
        securityHash: true
      }
    };

    // Simulate PDF generation (in production, use actual PDF library)
    return await CertificateService.generatePDFFromContent(pdfContent);
  }

  // Generate attendance certificate
  static async generateAttendanceCertificate(template, data) {
    const pdfContent = {
      template: 'attendance',
      layout: JSON.parse(template.layout_config || '{}'),
      content: {
        header: {
          schoolName: data.school?.name || 'School Name',
          schoolLogo: data.school?.logo_url,
          title: 'ATTENDANCE CERTIFICATE'
        },
        body: {
          studentName: `${data.student?.first_name} ${data.student?.last_name}`,
          className: data.student?.class_name,
          academicYear: data.academic_year,
          attendancePercentage: data.attendance_percentage || 'N/A',
          totalDays: data.total_school_days || 'N/A',
          presentDays: data.present_days || 'N/A',
          absentDays: data.absent_days || 'N/A',
          remarks: data.remarks || 'Regular attendance maintained'
        },
        footer: {
          issueDate: data.issueDate,
          certificateNumber: data.certificateNumber,
          principalName: data.school?.principal_name || 'Principal'
        }
      }
    };

    return await CertificateService.generatePDFFromContent(pdfContent);
  }

  // Generate course completion certificate
  static async generateCompletionCertificate(template, data) {
    const pdfContent = {
      template: 'completion',
      layout: JSON.parse(template.layout_config || '{}'),
      content: {
        header: {
          schoolName: data.school?.name || 'School Name',
          schoolLogo: data.school?.logo_url,
          title: 'CERTIFICATE OF COMPLETION'
        },
        body: {
          studentName: `${data.student?.first_name} ${data.student?.last_name}`,
          courseName: data.course_name || 'Course',
          completionDate: data.completion_date || data.issueDate,
          duration: data.course_duration || 'N/A',
          grade: data.final_grade || 'N/A',
          instructor: data.instructor_name || 'Instructor',
          achievements: data.achievements || []
        },
        footer: {
          issueDate: data.issueDate,
          certificateNumber: data.certificateNumber,
          authorizedBy: data.authorized_by || 'Principal'
        }
      }
    };

    return await CertificateService.generatePDFFromContent(pdfContent);
  }

  // Generate custom certificate from template
  static async generateCustomCertificate(template, data) {
    const customLayout = JSON.parse(template.layout_config || '{}');
    const customContent = JSON.parse(template.custom_content || '{}');

    // Replace template variables in custom content
    const processedContent = CertificateService.replaceTemplateVariables(customContent, data);

    const pdfContent = {
      template: 'custom',
      layout: customLayout,
      content: processedContent,
      security: {
        watermark: template.security_features?.watermark || false,
        qrCode: template.security_features?.qr_code || false
      }
    };

    return await CertificateService.generatePDFFromContent(pdfContent);
  }

  // =============================================================================
  // PDF GENERATION ENGINE
  // =============================================================================

  // Generate PDF from structured content
  static async generatePDFFromContent(pdfContent) {
    try {
      // In production, this would use a real PDF library like PDFKit, Puppeteer, etc.
      // For this implementation, we'll create a simulated PDF buffer
      
      console.log(`📄 Generating PDF for template: ${pdfContent.template}`);

      // Create PDF document structure
      const pdfDocument = {
        title: pdfContent.content.header?.title || 'Certificate',
        creator: 'Edufam Education Platform',
        subject: 'Academic Certificate',
        keywords: 'certificate, education, academic',
        pages: []
      };

      // Build main page
      const mainPage = await CertificateService.buildCertificatePage(pdfContent);
      pdfDocument.pages.push(mainPage);

      // Add security features if requested
      if (pdfContent.security?.qrCode) {
        mainPage.elements.push(await CertificateService.generateQRCode(pdfContent));
      }

      if (pdfContent.security?.watermark) {
        mainPage.elements.push(CertificateService.generateWatermark());
      }

      // Convert to binary PDF (simulated)
      const pdfBuffer = CertificateService.convertToPDFBuffer(pdfDocument);

      console.log(`✅ PDF generated successfully (${pdfBuffer.length} bytes)`);
      
      return pdfBuffer;

    } catch (error) {
      console.error('❌ PDF generation failed:', error);
      throw error;
    }
  }

  // Build certificate page layout
  static async buildCertificatePage(pdfContent) {
    const { layout, content } = pdfContent;
    
    // Default A4 page dimensions (595 x 842 points)
    const page = {
      width: layout.pageWidth || 595,
      height: layout.pageHeight || 842,
      margin: layout.margin || { top: 50, right: 50, bottom: 50, left: 50 },
      elements: []
    };

    // Add header elements
    if (content.header) {
      page.elements.push(...await CertificateService.buildHeaderElements(content.header, layout));
    }

    // Add body elements
    if (content.body) {
      page.elements.push(...CertificateService.buildBodyElements(content.body, layout));
    }

    // Add footer elements
    if (content.footer) {
      page.elements.push(...CertificateService.buildFooterElements(content.footer, layout));
    }

    // Add decorative elements
    if (layout.decorative) {
      page.elements.push(...CertificateService.buildDecorativeElements(layout.decorative));
    }

    return page;
  }

  // Build header elements
  static async buildHeaderElements(header, layout) {
    const elements = [];
    const headerStyle = layout.header || {};

    // School logo
    if (header.schoolLogo) {
      elements.push({
        type: 'image',
        src: header.schoolLogo,
        x: headerStyle.logoX || 50,
        y: headerStyle.logoY || 50,
        width: headerStyle.logoWidth || 80,
        height: headerStyle.logoHeight || 80
      });
    }

    // School name
    if (header.schoolName) {
      elements.push({
        type: 'text',
        text: header.schoolName.toUpperCase(),
        x: headerStyle.schoolNameX || 150,
        y: headerStyle.schoolNameY || 60,
        fontSize: headerStyle.schoolNameSize || 24,
        fontWeight: 'bold',
        textAlign: 'center',
        color: headerStyle.primaryColor || '#1a1a1a'
      });
    }

    // School address
    if (header.schoolAddress) {
      elements.push({
        type: 'text',
        text: header.schoolAddress,
        x: headerStyle.addressX || 150,
        y: headerStyle.addressY || 90,
        fontSize: headerStyle.addressSize || 10,
        textAlign: 'center',
        color: '#666666'
      });
    }

    // Certificate title
    if (header.title) {
      elements.push({
        type: 'text',
        text: header.title,
        x: headerStyle.titleX || 297.5, // Center of A4
        y: headerStyle.titleY || 150,
        fontSize: headerStyle.titleSize || 28,
        fontWeight: 'bold',
        textAlign: 'center',
        color: headerStyle.titleColor || '#d4af37', // Gold color
        decoration: 'underline'
      });
    }

    return elements;
  }

  // Build body elements
  static buildBodyElements(body, layout) {
    const elements = [];
    const bodyStyle = layout.body || {};
    let currentY = bodyStyle.startY || 220;
    const lineHeight = bodyStyle.lineHeight || 25;

    // Student name
    if (body.studentName) {
      elements.push({
        type: 'text',
        text: `This is to certify that`,
        x: 297.5,
        y: currentY,
        fontSize: 14,
        textAlign: 'center'
      });
      currentY += lineHeight;

      elements.push({
        type: 'text',
        text: body.studentName.toUpperCase(),
        x: 297.5,
        y: currentY,
        fontSize: 22,
        fontWeight: 'bold',
        textAlign: 'center',
        color: bodyStyle.nameColor || '#1a1a1a',
        decoration: 'underline'
      });
      currentY += lineHeight * 1.5;
    }

    // Academic details
    if (body.className || body.academicYear) {
      let academicText = '';
      if (body.className) academicText += `of class ${body.className}`;
      if (body.academicYear) {
        if (academicText) academicText += ` for the academic year ${body.academicYear}`;
        else academicText += `for the academic year ${body.academicYear}`;
      }

      if (academicText) {
        elements.push({
          type: 'text',
          text: academicText,
          x: 297.5,
          y: currentY,
          fontSize: 14,
          textAlign: 'center'
        });
        currentY += lineHeight;
      }
    }

    // Performance details
    if (body.gradeAverage || body.rank || body.attendancePercentage) {
      currentY += lineHeight * 0.5;

      if (body.gradeAverage) {
        elements.push({
          type: 'text',
          text: `has achieved an overall grade average of ${body.gradeAverage}%`,
          x: 297.5,
          y: currentY,
          fontSize: 14,
          textAlign: 'center'
        });
        currentY += lineHeight;
      }

      if (body.rank && body.totalStudents) {
        elements.push({
          type: 'text',
          text: `securing position ${body.rank} out of ${body.totalStudents} students`,
          x: 297.5,
          y: currentY,
          fontSize: 14,
          textAlign: 'center'
        });
        currentY += lineHeight;
      }

      if (body.attendancePercentage) {
        elements.push({
          type: 'text',
          text: `with an attendance record of ${body.attendancePercentage}%`,
          x: 297.5,
          y: currentY,
          fontSize: 14,
          textAlign: 'center'
        });
        currentY += lineHeight;
      }
    }

    // Subjects table (if applicable)
    if (body.subjects && body.subjects.length > 0) {
      currentY += lineHeight;
      elements.push(...CertificateService.buildSubjectsTable(body.subjects, currentY, bodyStyle));
      currentY += (body.subjects.length + 2) * lineHeight;
    }

    // Remarks
    if (body.remarks) {
      currentY += lineHeight;
      elements.push({
        type: 'text',
        text: body.remarks,
        x: 297.5,
        y: currentY,
        fontSize: 12,
        fontStyle: 'italic',
        textAlign: 'center',
        color: '#666666'
      });
    }

    return elements;
  }

  // Build footer elements
  static buildFooterElements(footer, layout) {
    const elements = [];
    const footerStyle = layout.footer || {};
    const footerY = footerStyle.startY || 700;

    // Issue date
    if (footer.issueDate) {
      elements.push({
        type: 'text',
        text: `Issued on: ${footer.issueDate}`,
        x: 100,
        y: footerY,
        fontSize: 10
      });
    }

    // Certificate number
    if (footer.certificateNumber) {
      elements.push({
        type: 'text',
        text: `Certificate No: ${footer.certificateNumber}`,
        x: 400,
        y: footerY,
        fontSize: 10,
        textAlign: 'right'
      });
    }

    // Principal signature
    if (footer.principalName) {
      elements.push({
        type: 'text',
        text: '______________________',
        x: 400,
        y: footerY + 40,
        fontSize: 12,
        textAlign: 'center'
      });

      elements.push({
        type: 'text',
        text: footer.principalName,
        x: 400,
        y: footerY + 55,
        fontSize: 10,
        textAlign: 'center',
        fontWeight: 'bold'
      });

      elements.push({
        type: 'text',
        text: 'Principal',
        x: 400,
        y: footerY + 70,
        fontSize: 9,
        textAlign: 'center'
      });
    }

    return elements;
  }

  // Build subjects performance table
  static buildSubjectsTable(subjects, startY, style) {
    const elements = [];
    const tableX = 150;
    const tableWidth = 295;
    const rowHeight = 20;
    const colWidths = [150, 70, 75]; // Subject, Grade, Remarks

    // Table header
    elements.push({
      type: 'rect',
      x: tableX,
      y: startY,
      width: tableWidth,
      height: rowHeight,
      fill: '#f0f0f0',
      stroke: '#000000',
      strokeWidth: 1
    });

    const headers = ['Subject', 'Grade', 'Remarks'];
    let headerX = tableX;
    headers.forEach((header, index) => {
      elements.push({
        type: 'text',
        text: header,
        x: headerX + colWidths[index] / 2,
        y: startY + 12,
        fontSize: 10,
        fontWeight: 'bold',
        textAlign: 'center'
      });
      headerX += colWidths[index];
    });

    // Table rows
    subjects.forEach((subject, index) => {
      const rowY = startY + (index + 1) * rowHeight;
      
      // Row background
      elements.push({
        type: 'rect',
        x: tableX,
        y: rowY,
        width: tableWidth,
        height: rowHeight,
        fill: index % 2 === 0 ? '#ffffff' : '#f9f9f9',
        stroke: '#000000',
        strokeWidth: 0.5
      });

      // Row data
      const rowData = [subject.name, subject.grade, subject.remarks || 'Good'];
      let cellX = tableX;
      rowData.forEach((data, cellIndex) => {
        elements.push({
          type: 'text',
          text: data,
          x: cellX + colWidths[cellIndex] / 2,
          y: rowY + 12,
          fontSize: 9,
          textAlign: 'center'
        });
        cellX += colWidths[cellIndex];
      });
    });

    return elements;
  }

  // Build decorative elements
  static buildDecorativeElements(decorative) {
    const elements = [];

    if (decorative.border) {
      elements.push({
        type: 'rect',
        x: 30,
        y: 30,
        width: 535,
        height: 782,
        fill: 'none',
        stroke: decorative.borderColor || '#d4af37',
        strokeWidth: decorative.borderWidth || 3
      });
    }

    if (decorative.cornerElements) {
      // Add decorative corner elements
      const corners = [
        { x: 40, y: 40 },
        { x: 545, y: 40 },
        { x: 40, y: 802 },
        { x: 545, y: 802 }
      ];

      corners.forEach(corner => {
        elements.push({
          type: 'circle',
          x: corner.x,
          y: corner.y,
          radius: 8,
          fill: decorative.cornerColor || '#d4af37'
        });
      });
    }

    return elements;
  }

  // =============================================================================
  // SECURITY FEATURES
  // =============================================================================

  // Add security features to PDF
  static async addSecurityFeatures(pdfBuffer, certificateId, template) {
    const securityFeatures = JSON.parse(template.security_features || '{}');
    let securedBuffer = pdfBuffer;

    // Add digital signature (simulated)
    if (securityFeatures.digital_signature) {
      securedBuffer = await CertificateService.addDigitalSignature(securedBuffer, certificateId);
    }

    // Add password protection (simulated)
    if (securityFeatures.password_protection) {
      securedBuffer = await CertificateService.addPasswordProtection(securedBuffer, certificateId);
    }

    // Add tamper detection
    if (securityFeatures.tamper_detection) {
      securedBuffer = await CertificateService.addTamperDetection(securedBuffer, certificateId);
    }

    return securedBuffer;
  }

  // Generate QR code for verification
  static async generateQRCode(pdfContent) {
    // In production, use a QR code library like 'qrcode'
    const verificationData = {
      certificateNumber: pdfContent.content.footer?.certificateNumber,
      issueDate: pdfContent.content.footer?.issueDate,
      studentName: pdfContent.content.body?.studentName,
      verificationUrl: `${process.env.BASE_URL}/certificates/verify`
    };

    return {
      type: 'qrcode',
      data: JSON.stringify(verificationData),
      x: 450,
      y: 750,
      size: 80
    };
  }

  // Generate watermark
  static generateWatermark() {
    return {
      type: 'text',
      text: 'AUTHENTIC CERTIFICATE',
      x: 297.5,
      y: 421,
      fontSize: 48,
      textAlign: 'center',
      color: '#f0f0f0',
      opacity: 0.3,
      rotation: 45
    };
  }

  // =============================================================================
  // HELPER FUNCTIONS
  // =============================================================================

  // Replace template variables in content
  static replaceTemplateVariables(content, data) {
    const contentString = JSON.stringify(content);
    const replacedString = contentString.replace(/\{\{(\w+)\}\}/g, (match, variable) => {
      return data[variable] || match;
    });
    return JSON.parse(replacedString);
  }

  // Convert document structure to PDF buffer (simulated)
  static convertToPDFBuffer(pdfDocument) {
    // In production, this would use a real PDF library
    // For now, we'll create a simulated PDF buffer
    const pdfHeader = '%PDF-1.4\n';
    const pdfContent = JSON.stringify(pdfDocument);
    const pdfFooter = '\n%%EOF';
    
    const fullContent = pdfHeader + pdfContent + pdfFooter;
    return Buffer.from(fullContent, 'utf8');
  }

  // Save PDF file to storage
  static async savePDFFile(certificateId, pdfBuffer) {
    const fileName = `certificate_${certificateId}_${Date.now()}.pdf`;
    const filePath = path.join(process.env.UPLOAD_PATH || 'uploads', 'certificates', fileName);
    
    // Ensure directory exists
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    
    // Save file
    await fs.writeFile(filePath, pdfBuffer);
    
    return filePath;
  }

  // Calculate security hash
  static calculateSecurityHash(pdfBuffer) {
    return crypto.createHash('sha256').update(pdfBuffer).digest('hex');
  }

  // Add digital signature (simulated)
  static async addDigitalSignature(pdfBuffer, certificateId) {
    // In production, use digital signature libraries
    const signature = crypto.createHash('sha256')
      .update(pdfBuffer + certificateId + process.env.CERTIFICATE_SIGNING_KEY)
      .digest('hex');
    
    // Append signature metadata (simulated)
    const signatureData = `\n/DigitalSignature ${signature}`;
    return Buffer.concat([pdfBuffer, Buffer.from(signatureData)]);
  }

  // Add password protection (simulated)
  static async addPasswordProtection(pdfBuffer, certificateId) {
    // In production, use PDF encryption libraries
    const protectedIndicator = '\n/Encrypted true';
    return Buffer.concat([pdfBuffer, Buffer.from(protectedIndicator)]);
  }

  // Add tamper detection (simulated)
  static async addTamperDetection(pdfBuffer, certificateId) {
    const checksum = crypto.createHash('md5').update(pdfBuffer).digest('hex');
    const tamperData = `\n/TamperDetection ${checksum}`;
    return Buffer.concat([pdfBuffer, Buffer.from(tamperData)]);
  }

  // =============================================================================
  // ANALYTICS AND CALCULATIONS
  // =============================================================================

  // Calculate student's grade average
  static async calculateGradeAverage(studentId, academicYear) {
    const result = await query(`
      SELECT AVG(score) as average
      FROM student_grades sg
      JOIN grade_submissions gs ON sg.grade_submission_id = gs.id
      JOIN assessments a ON sg.assessment_id = a.id
      WHERE sg.student_id = $1 AND a.academic_year = $2
    `, [studentId, academicYear]);

    return result.rows[0]?.average ? Math.round(result.rows[0].average) : null;
  }

  // Calculate attendance percentage
  static async calculateAttendancePercentage(studentId, academicYear) {
    const result = await query(`
      SELECT 
        COUNT(*) as total_days,
        COUNT(CASE WHEN status IN ('present', 'late') THEN 1 END) as present_days
      FROM student_attendance sa
      JOIN academic_terms at ON sa.date BETWEEN at.start_date AND at.end_date
      WHERE sa.student_id = $1 AND at.academic_year = $2
    `, [studentId, academicYear]);

    const data = result.rows[0];
    if (!data || data.total_days === 0) return null;

    return Math.round((data.present_days / data.total_days) * 100);
  }

  // Calculate class rank
  static async calculateClassRank(studentId, classId, academicYear) {
    const result = await query(`
      SELECT student_rank
      FROM (
        SELECT 
          sg.student_id,
          RANK() OVER (ORDER BY AVG(sg.score) DESC) as student_rank
        FROM student_grades sg
        JOIN grade_submissions gs ON sg.grade_submission_id = gs.id
        JOIN assessments a ON sg.assessment_id = a.id
        JOIN students s ON sg.student_id = s.id
        WHERE s.class_id = $1 AND a.academic_year = $2
        GROUP BY sg.student_id
      ) rankings
      WHERE student_id = $3
    `, [classId, academicYear, studentId]);

    return result.rows[0]?.student_rank || null;
  }

  // Get total students in class
  static async getTotalStudents(classId) {
    const result = await query(`
      SELECT COUNT(*) as total
      FROM students
      WHERE class_id = $1 AND is_active = true
    `, [classId]);

    return result.rows[0]?.total || 0;
  }

  // =============================================================================
  // CERTIFICATE VERIFICATION
  // =============================================================================

  // Verify certificate authenticity
  static async verifyCertificate(certificateNumber, verificationCode) {
    try {
      // Get certificate details
      const certificate = await query(`
        SELECT 
          c.*,
          s.first_name || ' ' || s.last_name as student_name,
          sch.name as school_name
        FROM certificates c
        JOIN students s ON c.student_id = s.id
        JOIN schools sch ON c.school_id = sch.id
        WHERE c.certificate_number = $1 AND c.verification_code = $2
      `, [certificateNumber, verificationCode]);

      if (certificate.rows.length === 0) {
        return {
          valid: false,
          message: 'Certificate not found or verification code is invalid'
        };
      }

      const cert = certificate.rows[0];

      // Check if certificate is still valid
      if (cert.status !== 'issued') {
        return {
          valid: false,
          message: 'Certificate has been revoked or is not yet issued'
        };
      }

      // Verify security hash if available
      if (cert.security_hash) {
        const isSecurityValid = await CertificateService.verifySecurityHash(cert);
        if (!isSecurityValid) {
          return {
            valid: false,
            message: 'Certificate security verification failed'
          };
        }
      }

      return {
        valid: true,
        certificate: {
          number: cert.certificate_number,
          studentName: cert.student_name,
          schoolName: cert.school_name,
          type: cert.certificate_type,
          issueDate: cert.issue_date,
          academicYear: cert.academic_year,
          data: JSON.parse(cert.certificate_data || '{}')
        }
      };

    } catch (error) {
      console.error('Certificate verification error:', error);
      return {
        valid: false,
        message: 'Verification system error'
      };
    }
  }

  // Verify security hash
  static async verifySecurityHash(certificate) {
    // In production, this would verify the actual security hash
    // For now, we'll simulate the verification
    return certificate.security_hash && certificate.security_hash.length === 64;
  }

  // =============================================================================
  // BATCH CERTIFICATE GENERATION
  // =============================================================================

  // Generate certificates in batch
  static async generateBatchCertificates(schoolId, templateId, studentsData, generatedBy) {
    try {
      console.log(`📄 Starting batch certificate generation for ${studentsData.length} students`);

      const results = [];
      const errors = [];

      // Process certificates in batches of 10 to avoid overwhelming the system
      const batchSize = 10;
      for (let i = 0; i < studentsData.length; i += batchSize) {
        const batch = studentsData.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async (studentData) => {
          try {
            // Create certificate record
            const certificateResult = await query(`
              INSERT INTO certificates (
                school_id, student_id, template_id, certificate_type,
                certificate_number, certificate_data, status, generated_by
              ) VALUES ($1, $2, $3, $4, $5, $6, 'processing', $7)
              RETURNING *
            `, [
              schoolId,
              studentData.student_id,
              templateId,
              studentData.certificate_type || 'academic',
              await CertificateService.generateCertificateNumber(schoolId),
              JSON.stringify(studentData),
              generatedBy
            ]);

            const certificate = certificateResult.rows[0];

            // Generate PDF
            const pdfResult = await CertificateService.generateCertificatePDF(
              certificate.id,
              templateId,
              studentData
            );

            // Update certificate with PDF information
            await query(`
              UPDATE certificates 
              SET status = 'generated',
                  file_path = $1,
                  file_size = $2,
                  security_hash = $3,
                  generated_at = CURRENT_TIMESTAMP
              WHERE id = $4
            `, [
              pdfResult.filePath,
              pdfResult.fileSize,
              pdfResult.securityHash,
              certificate.id
            ]);

            return {
              success: true,
              certificateId: certificate.id,
              certificateNumber: certificate.certificate_number,
              filePath: pdfResult.filePath
            };

          } catch (error) {
            console.error(`Error generating certificate for student ${studentData.student_id}:`, error);
            return {
              success: false,
              studentId: studentData.student_id,
              error: error.message
            };
          }
        });

        const batchResults = await Promise.all(batchPromises);
        
        // Separate successful and failed results
        batchResults.forEach(result => {
          if (result.success) {
            results.push(result);
          } else {
            errors.push(result);
          }
        });

        // Small delay between batches to prevent overwhelming the system
        if (i + batchSize < studentsData.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      console.log(`✅ Batch generation completed: ${results.length} successful, ${errors.length} failed`);

      return {
        success: true,
        generated: results.length,
        failed: errors.length,
        results,
        errors
      };

    } catch (error) {
      console.error('❌ Batch certificate generation failed:', error);
      throw error;
    }
  }
}

module.exports = CertificateService;