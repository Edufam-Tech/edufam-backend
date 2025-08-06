// auth/roleDefinitions.js - Corrected User Roles & Access Control

/**
 * EDUFAM USER ROLES & PERMISSIONS - CORRECTED VERSION
 * 
 * This file defines the exact user roles as specified:
 * - School users with dashboard access: school_director, principal, teacher, parent, hr, finance
 * - School support staff (NO dashboard): driver, cleaner, chef, gardener, watchman, nurse, secretary, lab_technician, librarian
 * - Admin users with dashboard access: super_admin, engineer, admin_finance, support_hr, sales_marketing
 */

// ===========================
// SCHOOL APPLICATION USERS
// ===========================

const SCHOOL_USER_ROLES = {
  // Users with DASHBOARD ACCESS
  DASHBOARD_USERS: {
    SCHOOL_DIRECTOR: {
      role: 'school_director',
      name: 'School Director',
      description: 'Strategic oversight and multi-school management',
      dashboardAccess: true,
      multiSchoolAccess: true,
      permissions: [
        'read:all', 'write:all', 'delete:all',
        'manage:school', 'approve:expenses', 'approve:recruitment',
        'approve:fee_assignments', 'manage:multi_schools',
        'view:financial_reports', 'manage:staff', 'strategic:planning'
      ]
    },

    PRINCIPAL: {
      role: 'principal',
      name: 'Principal',
      description: 'Academic leadership and school operations',
      dashboardAccess: true,
      multiSchoolAccess: false,
      permissions: [
        'read:school_data', 'write:academic', 'approve:grades',
        'manage:students', 'manage:teachers', 'manage:classes',
        'override:grades', 'release:grades', 'manage:examinations',
        'view:school_analytics', 'manage:discipline'
      ]
    },

    TEACHER: {
      role: 'teacher',
      name: 'Teacher',
      description: 'Classroom management and instruction',
      dashboardAccess: true,
      multiSchoolAccess: false,
      permissions: [
        'read:assigned_classes', 'write:grades', 'write:attendance',
        'read:students', 'communicate:parents', 'submit:grades',
        'manage:assignments', 'view:class_analytics'
      ]
    },

    PARENT: {
      role: 'parent',
      name: 'Parent',
      description: 'Student monitoring and school engagement',
      dashboardAccess: true,
      multiSchoolAccess: false,
      permissions: [
        'read:own_children', 'read:grades', 'pay:fees',
        'communicate:teachers', 'view:attendance', 'view:timetable',
        'access:marketplace', 'view:announcements'
      ]
    },

    HR: {
      role: 'hr',
      name: 'HR Manager',
      description: 'Human resource management',
      dashboardAccess: true,
      multiSchoolAccess: false,
      permissions: [
        'manage:all_staff', 'manage:recruitment', 'manage:payroll',
        'manage:performance_appraisals', 'manage:leave', 'manage:contracts',
        'manage:support_staff', 'create:staff_accounts', 'view:hr_analytics'
      ]
    },

    FINANCE: {
      role: 'finance',
      name: 'Finance Manager',
      description: 'Financial operations and reporting',
      dashboardAccess: true,
      multiSchoolAccess: false,
      permissions: [
        'manage:student_accounts', 'create:fee_assignments', 
        'process:payments', 'manage:mpesa', 'generate:invoices',
        'create:expense_requests', 'view:financial_reports', 
        'manage:budgets', 'reconcile:payments'
      ]
    }
  },

  // Support Staff - NO DASHBOARD ACCESS (Managed by HR)
  SUPPORT_STAFF: {
    DRIVER: {
      role: 'driver',
      name: 'Driver',
      description: 'School transport services',
      dashboardAccess: false,
      managedBy: 'hr',
      permissions: []
    },

    CLEANER: {
      role: 'cleaner', 
      name: 'Cleaner',
      description: 'School cleaning and maintenance',
      dashboardAccess: false,
      managedBy: 'hr',
      permissions: []
    },

    CHEF: {
      role: 'chef',
      name: 'Chef',
      description: 'School meals and kitchen management',
      dashboardAccess: false,
      managedBy: 'hr',
      permissions: []
    },

    GARDENER: {
      role: 'gardener',
      name: 'Gardener', 
      description: 'School grounds and landscaping',
      dashboardAccess: false,
      managedBy: 'hr',
      permissions: []
    },

    WATCHMAN: {
      role: 'watchman',
      name: 'Security Guard/Watchman',
      description: 'School security and safety',
      dashboardAccess: false,
      managedBy: 'hr', 
      permissions: []
    },

    NURSE: {
      role: 'nurse',
      name: 'School Nurse',
      description: 'Student health and medical care',
      dashboardAccess: false,
      managedBy: 'hr',
      permissions: []
    },

    SECRETARY: {
      role: 'secretary',
      name: 'Secretary',
      description: 'Administrative support',
      dashboardAccess: false,
      managedBy: 'hr',
      permissions: []
    },

    LAB_TECHNICIAN: {
      role: 'lab_technician',
      name: 'Lab Technician',
      description: 'Laboratory management',
      dashboardAccess: false,
      managedBy: 'hr',
      permissions: []
    },

    LIBRARIAN: {
      role: 'librarian',
      name: 'Librarian',
      description: 'Library management',
      dashboardAccess: false,
      managedBy: 'hr',
      permissions: []
    }
  }
};

// ===========================
// ADMIN APPLICATION USERS  
// ===========================

const ADMIN_USER_ROLES = {
  // Users with DASHBOARD ACCESS ONLY
  DASHBOARD_USERS: {
    SUPER_ADMIN: {
      role: 'super_admin',
      name: 'Super Admin',
      description: 'Platform governance and complete system management',
      dashboardAccess: true,
      permissions: [
        'manage:all_schools', 'manage:all_users', 'manage:system_settings',
        'manage:security', 'manage:platform_finance', 'manage:analytics',
        'manage:compliance', 'manage:backups', 'full:system_access'
      ]
    },

    ENGINEER: {
      role: 'engineer',
      name: 'Engineer',
      description: 'Technical operations and system monitoring',
      dashboardAccess: true,
      permissions: [
        'manage:system_health', 'manage:deployments', 'manage:security',
        'manage:bug_tracking', 'manage:api_monitoring', 'manage:backups',
        'view:system_logs', 'manage:database', 'personal:hr_access'
      ]
    },

    ADMIN_FINANCE: {
      role: 'admin_finance',
      name: 'Admin Finance',
      description: 'Platform financial management and billing',
      dashboardAccess: true,
      permissions: [
        'manage:platform_finance', 'manage:school_billing', 
        'manage:subscription_billing', 'generate:company_invoices',
        'manage:revenue_tracking', 'manage:financial_analytics',
        'manage:payroll', 'personal:hr_access'
      ]
    },

    SUPPORT_HR: {
      role: 'support_hr',
      name: 'Support HR',
      description: 'Customer support and internal HR operations',
      dashboardAccess: true,
      permissions: [
        'manage:support_tickets', 'manage:knowledge_base',
        'manage:school_training', 'manage:customer_communication',
        'manage:internal_hr', 'manage:recruitment', 'manage:performance_appraisals',
        'manage:staff_leave', 'manage:internal_training'
      ]
    },

    SALES_MARKETING: {
      role: 'sales_marketing',
      name: 'Sales & Marketing',
      description: 'Business development and marketing operations',
      dashboardAccess: true,
      permissions: [
        'manage:sales_pipeline', 'manage:marketing_campaigns',
        'manage:crm', 'manage:lead_generation', 'manage:marketplace',
        'manage:business_intelligence', 'manage:customer_acquisition',
        'personal:hr_access'
      ]
    }
  }
};

// ===========================
// ACCESS CONTROL FUNCTIONS
// ===========================

class AccessControl {
  // Get all roles with dashboard access
  static getSchoolDashboardRoles() {
    return Object.keys(SCHOOL_USER_ROLES.DASHBOARD_USERS).map(
      key => SCHOOL_USER_ROLES.DASHBOARD_USERS[key].role
    );
  }

  static getAdminDashboardRoles() {
    return Object.keys(ADMIN_USER_ROLES.DASHBOARD_USERS).map(
      key => ADMIN_USER_ROLES.DASHBOARD_USERS[key].role
    );
  }

  static getSupportStaffRoles() {
    return Object.keys(SCHOOL_USER_ROLES.SUPPORT_STAFF).map(
      key => SCHOOL_USER_ROLES.SUPPORT_STAFF[key].role
    );
  }

  // Check if user has dashboard access
  static hasDashboardAccess(userRole, applicationType = 'school') {
    if (applicationType === 'school') {
      const dashboardRoles = this.getSchoolDashboardRoles();
      return dashboardRoles.includes(userRole);
    } else if (applicationType === 'admin') {
      const dashboardRoles = this.getAdminDashboardRoles();
      return dashboardRoles.includes(userRole);
    }
    return false;
  }

  // Check if user is support staff (no dashboard access)
  static isSupportStaff(userRole) {
    const supportStaffRoles = this.getSupportStaffRoles();
    return supportStaffRoles.includes(userRole);
  }

  // Get user role definition
  static getRoleDefinition(userRole, applicationType = 'school') {
    if (applicationType === 'school') {
      // Check dashboard users
      for (const [, roleData] of Object.entries(SCHOOL_USER_ROLES.DASHBOARD_USERS)) {
        if (roleData.role === userRole) return roleData;
      }
      // Check support staff
      for (const [, roleData] of Object.entries(SCHOOL_USER_ROLES.SUPPORT_STAFF)) {
        if (roleData.role === userRole) return roleData;
      }
    } else if (applicationType === 'admin') {
      for (const [, roleData] of Object.entries(ADMIN_USER_ROLES.DASHBOARD_USERS)) {
        if (roleData.role === userRole) return roleData;
      }
    }
    return null;
  }

  // Check if user has specific permission
  static hasPermission(userRole, permission, applicationType = 'school') {
    const roleDefinition = this.getRoleDefinition(userRole, applicationType);
    if (!roleDefinition) return false;
    return roleDefinition.permissions.includes(permission);
  }

  // Check multi-school access (only for school directors)
  static hasMultiSchoolAccess(userRole) {
    const roleDefinition = this.getRoleDefinition(userRole, 'school');
    return roleDefinition && roleDefinition.multiSchoolAccess === true;
  }
}

// ===========================
// MIDDLEWARE FOR ACCESS CONTROL
// ===========================

// Middleware to check dashboard access
const requireDashboardAccess = (applicationType = 'school') => {
  return (req, res, next) => {
    const userRole = req.user?.role;
    
    if (!userRole) {
      return res.status(401).json({
        success: false,
        error: {
          type: 'AuthenticationError',
          message: 'User role not found'
        }
      });
    }

    if (!AccessControl.hasDashboardAccess(userRole, applicationType)) {
      return res.status(403).json({
        success: false,
        error: {
          type: 'AccessDeniedError',
          message: 'Dashboard access denied for this user role'
        }
      });
    }

    next();
  };
};

// Middleware to block support staff from accessing APIs
const blockSupportStaffAccess = () => {
  return (req, res, next) => {
    const userRole = req.user?.role;
    
    if (AccessControl.isSupportStaff(userRole)) {
      return res.status(403).json({
        success: false,
        error: {
          type: 'AccessDeniedError',
          message: 'Support staff do not have access to this system. Please contact HR for assistance.'
        }
      });
    }

    next();
  };
};

// ===========================
// ROLE VALIDATION
// ===========================

const validateUserRole = (role, applicationType = 'school') => {
  const allValidRoles = [
    ...AccessControl.getSchoolDashboardRoles(),
    ...AccessControl.getSupportStaffRoles(),
    ...AccessControl.getAdminDashboardRoles()
  ];

  if (!allValidRoles.includes(role)) {
    throw new Error(`Invalid user role: ${role}`);
  }

  // Additional validation based on application type
  if (applicationType === 'school') {
    const validSchoolRoles = [
      ...AccessControl.getSchoolDashboardRoles(),
      ...AccessControl.getSupportStaffRoles()
    ];
    
    if (!validSchoolRoles.includes(role)) {
      throw new Error(`Invalid school user role: ${role}`);
    }
  } else if (applicationType === 'admin') {
    const validAdminRoles = AccessControl.getAdminDashboardRoles();
    
    if (!validAdminRoles.includes(role)) {
      throw new Error(`Invalid admin user role: ${role}`);
    }
  }

  return true;
};

// ===========================
// EXPORTS
// ===========================

module.exports = {
  SCHOOL_USER_ROLES,
  ADMIN_USER_ROLES,
  AccessControl,
  requireDashboardAccess,
  blockSupportStaffAccess,
  validateUserRole,
  
  // Quick access arrays - CORRECTED ROLES
  SCHOOL_DASHBOARD_ROLES: [
    'school_director',
    'principal', 
    'teacher',
    'hr',
    'finance',
    'parent'
  ],
  
  SCHOOL_SUPPORT_STAFF_ROLES: [
    'driver',
    'cleaner',
    'chef', 
    'gardener',
    'watchman',
    'nurse',
    'secretary',
    'lab_technician',
    'librarian'
  ],
  
  ADMIN_DASHBOARD_ROLES: [
    'super_admin',
    'support_hr',
    'sales_marketing',
    'engineer',
    'admin_finance'
  ]
};