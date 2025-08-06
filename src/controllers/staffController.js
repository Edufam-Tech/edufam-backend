const staffService = require('../services/staffService');
const { logger } = require('../utils/debugger');

/**
 * Get all staff members with pagination and filtering
 */
const getAllStaff = async (req, res) => {
  try {
    const { page = 1, limit = 10, role, schoolId, departmentId, status } = req.query;
    const filters = { role, schoolId, departmentId, status };
    
    const result = await staffService.getAllStaff(parseInt(page), parseInt(limit), filters);
    
    res.json({
      success: true,
      message: 'Staff members retrieved successfully',
      data: result.staff,
      pagination: {
        currentPage: parseInt(page),
        totalPages: result.totalPages,
        totalItems: result.totalItems,
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    logger.error('Error getting all staff:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve staff members',
      error: error.message
    });
  }
};

/**
 * Get staff member by ID
 */
const getStaffById = async (req, res) => {
  try {
    const { id } = req.params;
    const { user } = req;
    
    // Check if user is trying to access their own profile or has admin privileges
    if (user.role !== 'admin' && user.role !== 'school_admin' && user.id !== parseInt(id)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view your own profile.'
      });
    }
    
    const staff = await staffService.getStaffById(parseInt(id));
    
    if (!staff) {
      return res.status(404).json({
        success: false,
        message: 'Staff member not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Staff member retrieved successfully',
      data: staff
    });
  } catch (error) {
    logger.error('Error getting staff by ID:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve staff member',
      error: error.message
    });
  }
};

/**
 * Create new staff member
 */
const createStaff = async (req, res) => {
  try {
    const staffData = req.body;
    const { user } = req;
    
    // Add created by information
    staffData.createdBy = user.id;
    
    const newStaff = await staffService.createStaff(staffData);
    
    res.status(201).json({
      success: true,
      message: 'Staff member created successfully',
      data: newStaff
    });
  } catch (error) {
    logger.error('Error creating staff:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create staff member',
      error: error.message
    });
  }
};

/**
 * Update staff member
 */
const updateStaff = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const { user } = req;
    
    // Check if user is trying to update their own profile or has admin privileges
    if (user.role !== 'admin' && user.role !== 'school_admin' && user.id !== parseInt(id)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only update your own profile.'
      });
    }
    
    updateData.updatedBy = user.id;
    
    const updatedStaff = await staffService.updateStaff(parseInt(id), updateData);
    
    if (!updatedStaff) {
      return res.status(404).json({
        success: false,
        message: 'Staff member not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Staff member updated successfully',
      data: updatedStaff
    });
  } catch (error) {
    logger.error('Error updating staff:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update staff member',
      error: error.message
    });
  }
};

/**
 * Delete staff member
 */
const deleteStaff = async (req, res) => {
  try {
    const { id } = req.params;
    const { user } = req;
    
    const deletedStaff = await staffService.deleteStaff(parseInt(id), user.id);
    
    if (!deletedStaff) {
      return res.status(404).json({
        success: false,
        message: 'Staff member not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Staff member deleted successfully',
      data: deletedStaff
    });
  } catch (error) {
    logger.error('Error deleting staff:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete staff member',
      error: error.message
    });
  }
};

/**
 * Get staff members by school
 */
const getStaffBySchool = async (req, res) => {
  try {
    const { schoolId } = req.params;
    const { page = 1, limit = 10, role, status } = req.query;
    const filters = { role, status };
    
    const result = await staffService.getStaffBySchool(
      parseInt(schoolId), 
      parseInt(page), 
      parseInt(limit), 
      filters
    );
    
    res.json({
      success: true,
      message: 'School staff retrieved successfully',
      data: result.staff,
      pagination: {
        currentPage: parseInt(page),
        totalPages: result.totalPages,
        totalItems: result.totalItems,
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    logger.error('Error getting staff by school:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve school staff',
      error: error.message
    });
  }
};

/**
 * Get staff members by department
 */
const getStaffByDepartment = async (req, res) => {
  try {
    const { departmentId } = req.params;
    const { page = 1, limit = 10, role, status } = req.query;
    const filters = { role, status };
    
    const result = await staffService.getStaffByDepartment(
      parseInt(departmentId), 
      parseInt(page), 
      parseInt(limit), 
      filters
    );
    
    res.json({
      success: true,
      message: 'Department staff retrieved successfully',
      data: result.staff,
      pagination: {
        currentPage: parseInt(page),
        totalPages: result.totalPages,
        totalItems: result.totalItems,
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    logger.error('Error getting staff by department:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve department staff',
      error: error.message
    });
  }
};

/**
 * Get staff members by role
 */
const getStaffByRole = async (req, res) => {
  try {
    const { role } = req.params;
    const { page = 1, limit = 10, schoolId, departmentId, status } = req.query;
    const filters = { schoolId, departmentId, status };
    
    const result = await staffService.getStaffByRole(
      role, 
      parseInt(page), 
      parseInt(limit), 
      filters
    );
    
    res.json({
      success: true,
      message: 'Staff by role retrieved successfully',
      data: result.staff,
      pagination: {
        currentPage: parseInt(page),
        totalPages: result.totalPages,
        totalItems: result.totalItems,
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    logger.error('Error getting staff by role:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve staff by role',
      error: error.message
    });
  }
};

/**
 * Assign staff member to school
 */
const assignStaffToSchool = async (req, res) => {
  try {
    const { id } = req.params;
    const { schoolId } = req.body;
    const { user } = req;
    
    const result = await staffService.assignStaffToSchool(parseInt(id), parseInt(schoolId), user.id);
    
    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Staff member or school not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Staff member assigned to school successfully',
      data: result
    });
  } catch (error) {
    logger.error('Error assigning staff to school:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assign staff to school',
      error: error.message
    });
  }
};

/**
 * Assign staff member to department
 */
const assignStaffToDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const { departmentId } = req.body;
    const { user } = req;
    
    const result = await staffService.assignStaffToDepartment(parseInt(id), parseInt(departmentId), user.id);
    
    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Staff member or department not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Staff member assigned to department successfully',
      data: result
    });
  } catch (error) {
    logger.error('Error assigning staff to department:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assign staff to department',
      error: error.message
    });
  }
};

/**
 * Change staff member role
 */
const changeStaffRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    const { user } = req;
    
    const result = await staffService.changeStaffRole(parseInt(id), role, user.id);
    
    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Staff member not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Staff role changed successfully',
      data: result
    });
  } catch (error) {
    logger.error('Error changing staff role:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to change staff role',
      error: error.message
    });
  }
};

/**
 * Activate staff member
 */
const activateStaff = async (req, res) => {
  try {
    const { id } = req.params;
    const { user } = req;
    
    const result = await staffService.activateStaff(parseInt(id), user.id);
    
    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Staff member not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Staff member activated successfully',
      data: result
    });
  } catch (error) {
    logger.error('Error activating staff:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to activate staff member',
      error: error.message
    });
  }
};

/**
 * Deactivate staff member
 */
const deactivateStaff = async (req, res) => {
  try {
    const { id } = req.params;
    const { user } = req;
    
    const result = await staffService.deactivateStaff(parseInt(id), user.id);
    
    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Staff member not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Staff member deactivated successfully',
      data: result
    });
  } catch (error) {
    logger.error('Error deactivating staff:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to deactivate staff member',
      error: error.message
    });
  }
};

/**
 * Get staff member profile
 */
const getStaffProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const { user } = req;
    
    // Check if user is trying to access their own profile or has admin privileges
    if (user.role !== 'admin' && user.role !== 'school_admin' && user.id !== parseInt(id)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view your own profile.'
      });
    }
    
    const profile = await staffService.getStaffProfile(parseInt(id));
    
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Staff profile not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Staff profile retrieved successfully',
      data: profile
    });
  } catch (error) {
    logger.error('Error getting staff profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve staff profile',
      error: error.message
    });
  }
};

/**
 * Update staff member profile
 */
const updateStaffProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const { user } = req;
    
    // Check if user is trying to update their own profile or has admin privileges
    if (user.role !== 'admin' && user.role !== 'school_admin' && user.id !== parseInt(id)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only update your own profile.'
      });
    }
    
    updateData.updatedBy = user.id;
    
    const updatedProfile = await staffService.updateStaffProfile(parseInt(id), updateData);
    
    if (!updatedProfile) {
      return res.status(404).json({
        success: false,
        message: 'Staff profile not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Staff profile updated successfully',
      data: updatedProfile
    });
  } catch (error) {
    logger.error('Error updating staff profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update staff profile',
      error: error.message
    });
  }
};

/**
 * Search staff members
 */
const searchStaff = async (req, res) => {
  try {
    const { q, page = 1, limit = 10, role, schoolId, departmentId } = req.query;
    const filters = { role, schoolId, departmentId };
    
    if (!q) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }
    
    const result = await staffService.searchStaff(q, parseInt(page), parseInt(limit), filters);
    
    res.json({
      success: true,
      message: 'Staff search completed successfully',
      data: result.staff,
      pagination: {
        currentPage: parseInt(page),
        totalPages: result.totalPages,
        totalItems: result.totalItems,
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    logger.error('Error searching staff:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search staff members',
      error: error.message
    });
  }
};

/**
 * Get staff statistics
 */
const getStaffStatistics = async (req, res) => {
  try {
    const { schoolId, departmentId } = req.query;
    const filters = { schoolId, departmentId };
    
    const statistics = await staffService.getStaffStatistics(filters);
    
    res.json({
      success: true,
      message: 'Staff statistics retrieved successfully',
      data: statistics
    });
  } catch (error) {
    logger.error('Error getting staff statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve staff statistics',
      error: error.message
    });
  }
};

module.exports = {
  getAllStaff,
  getStaffById,
  createStaff,
  updateStaff,
  deleteStaff,
  getStaffBySchool,
  getStaffByDepartment,
  getStaffByRole,
  assignStaffToSchool,
  assignStaffToDepartment,
  changeStaffRole,
  activateStaff,
  deactivateStaff,
  getStaffProfile,
  updateStaffProfile,
  searchStaff,
  getStaffStatistics
}; 