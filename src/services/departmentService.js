const Department = require('../models/department');
const Staff = require('../models/staff');
const { logger } = require('../utils/debugger');

/**
 * Get all departments with pagination and filtering
 */
const getAllDepartments = async (page = 1, limit = 10, filters = {}) => {
  try {
    const offset = (page - 1) * limit;
    let whereClause = 'WHERE 1=1';
    const queryParams = [];
    let paramIndex = 1;

    // Apply filters
    if (filters.schoolId) {
      whereClause += ` AND d.school_id = $${paramIndex}`;
      queryParams.push(filters.schoolId);
      paramIndex++;
    }

    if (filters.status) {
      whereClause += ` AND d.status = $${paramIndex}`;
      queryParams.push(filters.status);
      paramIndex++;
    }

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM departments d
      ${whereClause}
    `;
    
    const countResult = await Department.query(countQuery, queryParams);
    const totalItems = parseInt(countResult[0].total);
    const totalPages = Math.ceil(totalItems / limit);

    // Get departments with school and head information
    const query = `
      SELECT 
        d.*,
        s.name as school_name,
        s.code as school_code,
        h.first_name as head_first_name,
        h.last_name as head_last_name,
        h.email as head_email
      FROM departments d
      LEFT JOIN schools s ON d.school_id = s.id
      LEFT JOIN staff h ON d.head_id = h.id
      ${whereClause}
      ORDER BY d.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    queryParams.push(limit, offset);
    const departments = await Department.query(query, queryParams);

    return {
      departments,
      totalItems,
      totalPages,
      currentPage: page
    };
  } catch (error) {
    logger.error('Error in getAllDepartments:', error);
    throw error;
  }
};

/**
 * Get department by ID
 */
const getDepartmentById = async (id) => {
  try {
    const query = `
      SELECT 
        d.*,
        s.name as school_name,
        s.code as school_code,
        h.first_name as head_first_name,
        h.last_name as head_last_name,
        h.email as head_email
      FROM departments d
      LEFT JOIN schools s ON d.school_id = s.id
      LEFT JOIN staff h ON d.head_id = h.id
      WHERE d.id = $1
    `;
    
    const departments = await Department.query(query, [id]);
    return departments[0] || null;
  } catch (error) {
    logger.error('Error in getDepartmentById:', error);
    throw error;
  }
};

/**
 * Create new department
 */
const createDepartment = async (departmentData) => {
  try {
    const {
      name,
      code,
      description,
      schoolId,
      headId,
      status = 'active',
      createdBy
    } = departmentData;

    const query = `
      INSERT INTO departments (name, code, description, school_id, head_id, status, created_by, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      RETURNING *
    `;
    
    const departments = await Department.query(query, [
      name, code, description, schoolId, headId, status, createdBy
    ]);
    
    return departments[0];
  } catch (error) {
    logger.error('Error in createDepartment:', error);
    throw error;
  }
};

/**
 * Update department
 */
const updateDepartment = async (id, updateData) => {
  try {
    const {
      name,
      code,
      description,
      schoolId,
      headId,
      status,
      updatedBy
    } = updateData;

    const query = `
      UPDATE departments 
      SET 
        name = COALESCE($2, name),
        code = COALESCE($3, code),
        description = COALESCE($4, description),
        school_id = COALESCE($5, school_id),
        head_id = COALESCE($6, head_id),
        status = COALESCE($7, status),
        updated_by = $8,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    
    const departments = await Department.query(query, [
      id, name, code, description, schoolId, headId, status, updatedBy
    ]);
    
    return departments[0] || null;
  } catch (error) {
    logger.error('Error in updateDepartment:', error);
    throw error;
  }
};

/**
 * Delete department
 */
const deleteDepartment = async (id, deletedBy) => {
  try {
    // Check if department has staff members
    const staffQuery = `
      SELECT COUNT(*) as staff_count
      FROM staff
      WHERE department_id = $1
    `;
    
    const staffResult = await Department.query(staffQuery, [id]);
    const staffCount = parseInt(staffResult[0].staff_count);
    
    if (staffCount > 0) {
      throw new Error(`Cannot delete department. It has ${staffCount} staff members assigned.`);
    }

    const query = `
      UPDATE departments 
      SET 
        status = 'deleted',
        updated_by = $2,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    
    const departments = await Department.query(query, [id, deletedBy]);
    return departments[0] || null;
  } catch (error) {
    logger.error('Error in deleteDepartment:', error);
    throw error;
  }
};

/**
 * Get departments by school
 */
const getDepartmentsBySchool = async (schoolId, page = 1, limit = 10, filters = {}) => {
  try {
    const offset = (page - 1) * limit;
    let whereClause = 'WHERE d.school_id = $1';
    const queryParams = [schoolId];
    let paramIndex = 2;

    // Apply additional filters
    if (filters.status) {
      whereClause += ` AND d.status = $${paramIndex}`;
      queryParams.push(filters.status);
      paramIndex++;
    }

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM departments d
      ${whereClause}
    `;
    
    const countResult = await Department.query(countQuery, queryParams);
    const totalItems = parseInt(countResult[0].total);
    const totalPages = Math.ceil(totalItems / limit);

    // Get departments
    const query = `
      SELECT 
        d.*,
        h.first_name as head_first_name,
        h.last_name as head_last_name,
        h.email as head_email
      FROM departments d
      LEFT JOIN staff h ON d.head_id = h.id
      ${whereClause}
      ORDER BY d.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    queryParams.push(limit, offset);
    const departments = await Department.query(query, queryParams);

    return {
      departments,
      totalItems,
      totalPages,
      currentPage: page
    };
  } catch (error) {
    logger.error('Error in getDepartmentsBySchool:', error);
    throw error;
  }
};

/**
 * Get department staff
 */
const getDepartmentStaff = async (departmentId, page = 1, limit = 10, filters = {}) => {
  try {
    const offset = (page - 1) * limit;
    let whereClause = 'WHERE s.department_id = $1';
    const queryParams = [departmentId];
    let paramIndex = 2;

    // Apply filters
    if (filters.role) {
      whereClause += ` AND s.role = $${paramIndex}`;
      queryParams.push(filters.role);
      paramIndex++;
    }

    if (filters.status) {
      whereClause += ` AND s.status = $${paramIndex}`;
      queryParams.push(filters.status);
      paramIndex++;
    }

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM staff s
      ${whereClause}
    `;
    
    const countResult = await Staff.query(countQuery, queryParams);
    const totalItems = parseInt(countResult[0].total);
    const totalPages = Math.ceil(totalItems / limit);

    // Get staff members
    const query = `
      SELECT 
        s.*,
        d.name as department_name
      FROM staff s
      LEFT JOIN departments d ON s.department_id = d.id
      ${whereClause}
      ORDER BY s.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    queryParams.push(limit, offset);
    const staff = await Staff.query(query, queryParams);

    return {
      staff,
      totalItems,
      totalPages,
      currentPage: page
    };
  } catch (error) {
    logger.error('Error in getDepartmentStaff:', error);
    throw error;
  }
};

/**
 * Assign department head
 */
const assignDepartmentHead = async (departmentId, staffId, assignedBy) => {
  try {
    // Check if staff member exists and belongs to the department
    const staffQuery = `
      SELECT id, department_id, role
      FROM staff
      WHERE id = $1 AND department_id = $2
    `;
    
    const staffResult = await Staff.query(staffQuery, [staffId, departmentId]);
    if (staffResult.length === 0) {
      throw new Error('Staff member not found or does not belong to this department');
    }

    // Update department head
    const query = `
      UPDATE departments 
      SET 
        head_id = $2,
        updated_by = $3,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    
    const departments = await Department.query(query, [departmentId, staffId, assignedBy]);
    return departments[0] || null;
  } catch (error) {
    logger.error('Error in assignDepartmentHead:', error);
    throw error;
  }
};

/**
 * Remove department head
 */
const removeDepartmentHead = async (departmentId, removedBy) => {
  try {
    const query = `
      UPDATE departments 
      SET 
        head_id = NULL,
        updated_by = $2,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    
    const departments = await Department.query(query, [departmentId, removedBy]);
    return departments[0] || null;
  } catch (error) {
    logger.error('Error in removeDepartmentHead:', error);
    throw error;
  }
};

/**
 * Activate department
 */
const activateDepartment = async (id, activatedBy) => {
  try {
    const query = `
      UPDATE departments 
      SET 
        status = 'active',
        updated_by = $2,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    
    const departments = await Department.query(query, [id, activatedBy]);
    return departments[0] || null;
  } catch (error) {
    logger.error('Error in activateDepartment:', error);
    throw error;
  }
};

/**
 * Deactivate department
 */
const deactivateDepartment = async (id, deactivatedBy) => {
  try {
    const query = `
      UPDATE departments 
      SET 
        status = 'inactive',
        updated_by = $2,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    
    const departments = await Department.query(query, [id, deactivatedBy]);
    return departments[0] || null;
  } catch (error) {
    logger.error('Error in deactivateDepartment:', error);
    throw error;
  }
};

/**
 * Get department statistics
 */
const getDepartmentStatistics = async (id) => {
  try {
    const query = `
      SELECT 
        d.*,
        s.name as school_name,
        h.first_name as head_first_name,
        h.last_name as head_last_name,
        (SELECT COUNT(*) FROM staff WHERE department_id = d.id AND status = 'active') as active_staff_count,
        (SELECT COUNT(*) FROM staff WHERE department_id = d.id AND status = 'inactive') as inactive_staff_count,
        (SELECT COUNT(*) FROM staff WHERE department_id = d.id AND role = 'teacher') as teacher_count,
        (SELECT COUNT(*) FROM staff WHERE department_id = d.id AND role = 'department_head') as head_count
      FROM departments d
      LEFT JOIN schools s ON d.school_id = s.id
      LEFT JOIN staff h ON d.head_id = h.id
      WHERE d.id = $1
    `;
    
    const departments = await Department.query(query, [id]);
    return departments[0] || null;
  } catch (error) {
    logger.error('Error in getDepartmentStatistics:', error);
    throw error;
  }
};

/**
 * Search departments
 */
const searchDepartments = async (searchTerm, page = 1, limit = 10, filters = {}) => {
  try {
    const offset = (page - 1) * limit;
    let whereClause = 'WHERE (d.name ILIKE $1 OR d.code ILIKE $1)';
    const queryParams = [`%${searchTerm}%`];
    let paramIndex = 2;

    // Apply filters
    if (filters.schoolId) {
      whereClause += ` AND d.school_id = $${paramIndex}`;
      queryParams.push(filters.schoolId);
      paramIndex++;
    }

    if (filters.status) {
      whereClause += ` AND d.status = $${paramIndex}`;
      queryParams.push(filters.status);
      paramIndex++;
    }

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM departments d
      ${whereClause}
    `;
    
    const countResult = await Department.query(countQuery, queryParams);
    const totalItems = parseInt(countResult[0].total);
    const totalPages = Math.ceil(totalItems / limit);

    // Get departments
    const query = `
      SELECT 
        d.*,
        s.name as school_name,
        s.code as school_code,
        h.first_name as head_first_name,
        h.last_name as head_last_name,
        h.email as head_email
      FROM departments d
      LEFT JOIN schools s ON d.school_id = s.id
      LEFT JOIN staff h ON d.head_id = h.id
      ${whereClause}
      ORDER BY d.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    queryParams.push(limit, offset);
    const departments = await Department.query(query, queryParams);

    return {
      departments,
      totalItems,
      totalPages,
      currentPage: page
    };
  } catch (error) {
    logger.error('Error in searchDepartments:', error);
    throw error;
  }
};

/**
 * Get departments overview statistics
 */
const getDepartmentsOverview = async (filters = {}) => {
  try {
    let whereClause = 'WHERE 1=1';
    const queryParams = [];
    let paramIndex = 1;

    if (filters.schoolId) {
      whereClause += ` AND d.school_id = $${paramIndex}`;
      queryParams.push(filters.schoolId);
      paramIndex++;
    }

    const query = `
      SELECT 
        COUNT(*) as total_departments,
        COUNT(CASE WHEN d.status = 'active' THEN 1 END) as active_departments,
        COUNT(CASE WHEN d.status = 'inactive' THEN 1 END) as inactive_departments,
        COUNT(CASE WHEN d.head_id IS NOT NULL THEN 1 END) as departments_with_heads,
        COUNT(CASE WHEN d.head_id IS NULL THEN 1 END) as departments_without_heads,
        AVG((SELECT COUNT(*) FROM staff WHERE department_id = d.id AND status = 'active')) as avg_staff_per_department
      FROM departments d
      ${whereClause}
    `;
    
    const result = await Department.query(query, queryParams);
    return result[0];
  } catch (error) {
    logger.error('Error in getDepartmentsOverview:', error);
    throw error;
  }
};

module.exports = {
  getAllDepartments,
  getDepartmentById,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  getDepartmentsBySchool,
  getDepartmentStaff,
  assignDepartmentHead,
  removeDepartmentHead,
  activateDepartment,
  deactivateDepartment,
  getDepartmentStatistics,
  searchDepartments,
  getDepartmentsOverview
}; 