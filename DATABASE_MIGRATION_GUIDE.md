# 🗄️ **EDUFAM DATABASE MIGRATION GUIDE**

## **📋 COMPLETE MIGRATION SEQUENCE**

This guide provides the **exact order** and **manual steps** needed to set up the complete Edufam database schema. Execute these migrations in the **specified order** to avoid dependency conflicts.

---

## **⚡ PREREQUISITES**

### **1. Database Setup**

```sql
-- Create database
CREATE DATABASE edufam_production;

-- Connect to database
\c edufam_production;

-- Create database user (optional)
CREATE USER edufam_user WITH PASSWORD 'secure_password_here';
GRANT ALL PRIVILEGES ON DATABASE edufam_production TO edufam_user;
```

### **2. Enable Required Extensions**

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable cryptographic functions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
```

---

## **🚀 MIGRATION SEQUENCE**

### **PHASE 1: CORE FOUNDATION TABLES**

#### **Step 1: Base Schema (Core Tables)**

**File**: `database/schema.sql`
**Description**: Creates core foundation tables (schools, users, sessions, tokens)

```bash
# Execute this file first
psql -d edufam_production -f database/schema.sql
```

**Tables Created**:

- `schools` - School information and subscription details
- `users` - Unified user table for all user types
- `user_sessions` - JWT session management
- `password_reset_tokens` - Password reset functionality

#### **Step 2: Student Management Tables**

**File**: `database/add-student-tables.sql`
**Description**: Student-related tables and parent relationships

```bash
psql -d edufam_production -f database/add-student-tables.sql
```

**Tables Created**:

- `students` - Student information
- `classes` - Class/grade definitions
- `enrollments` - Student class enrollments
- `parent_students` - Parent-student relationships
- `student_documents` - Document management

#### **Step 3: Academic Foundation**

**File**: `database/add-academic-tables.sql`
**Description**: Academic structure tables

```bash
psql -d edufam_production -f database/add-academic-tables.sql
```

**Tables Created**:

- `academic_years` - Academic year definitions
- `academic_terms` - Term/semester management
- `subjects` - Subject definitions
- `curricula` - Curriculum management
- `grading_scales` - Grading system configurations

---

### **PHASE 2: ACADEMIC SYSTEM TABLES**

#### **Step 4: Complete Academic Module**

**File**: `database/add-academic-module.sql`
**Description**: Full academic management system

```bash
psql -d edufam_production -f database/add-academic-module.sql
```

**Tables Created** (27 tables):

- `departments` - School departments
- `teacher_subjects` - Teacher-subject assignments
- `class_subjects` - Class-subject relationships
- `assessments` - Assessment/exam definitions
- `student_grades` - Student grade records
- `grade_submissions` - Grade submission workflow
- `attendance_records` - Daily attendance tracking
- `daily_attendance` - Attendance summaries
- `student_attendance` - Individual student attendance
- `grading_rubrics` - Assessment rubrics
- `academic_terms` - Enhanced term management
- `class_schedules` - Class scheduling
- `examination_schedules` - Exam scheduling
- `academic_reports` - Academic performance reports
- `student_promotions` - Grade progression tracking
- `teacher_classes` - Teacher-class assignments
- `class_timetables` - Class-specific timetables
- `subject_allocations` - Subject time allocations
- `curriculum_subjects` - Curriculum-subject mappings
- `grade_boundaries` - Grade boundary definitions
- `assessment_rubrics` - Detailed assessment criteria
- `student_assessments` - Student-assessment relationships
- `academic_performances` - Performance analytics
- `learning_objectives` - Subject learning objectives
- `competency_assessments` - Skills-based assessments
- `academic_analytics` - Academic data analytics
- `performance_trends` - Performance tracking over time

---

### **PHASE 3: FINANCIAL MANAGEMENT**

#### **Step 5: Financial Module**

**File**: `database/add-financial-module.sql`
**Description**: Complete financial management system

```bash
psql -d edufam_production -f database/add-financial-module.sql
```

**Tables Created** (25 tables):

- `fee_structures` - Fee structure definitions
- `fee_categories` - Fee categorization
- `fee_items` - Individual fee items
- `student_fees` - Student fee assignments
- `payments` - Payment records
- `payment_methods` - Payment method definitions
- `payment_plans` - Installment plans
- `invoices` - Invoice generation
- `invoice_items` - Invoice line items
- `receipts` - Payment receipts
- `fee_waivers` - Fee exemptions/discounts
- `fee_adjustments` - Fee modifications
- `payment_schedules` - Payment due dates
- `outstanding_fees` - Unpaid fee tracking
- `fee_reminders` - Payment reminders
- `financial_reports` - Financial reporting
- `expense_categories` - Expense categorization
- `expenses` - School expense tracking
- `budgets` - Budget management
- `budget_allocations` - Budget line items
- `financial_years` - Financial year management
- `account_balances` - Account balance tracking
- `transaction_logs` - Financial transaction audit
- `mpesa_transactions` - M-Pesa integration
- `payment_analytics` - Payment analytics

---

### **PHASE 4: TRANSPORT MANAGEMENT**

#### **Step 6: Transport Module**

**File**: `database/add-transport-module.sql`
**Description**: Complete transport management system

```bash
psql -d edufam_production -f database/add-transport-module.sql
```

**Tables Created** (15 tables):

- `vehicles` - Vehicle fleet management
- `drivers` - Driver information
- `routes` - Transport route definitions
- `route_stops` - Route stop points
- `transport_assignments` - Student transport assignments
- `transport_schedules` - Transport timetables
- `transport_attendance` - Transport attendance tracking
- `transport_fees` - Transport fee structure
- `vehicle_maintenance` - Vehicle maintenance records
- `fuel_logs` - Fuel consumption tracking
- `transport_incidents` - Incident reporting
- `driver_schedules` - Driver work schedules
- `route_optimization` - Route efficiency tracking
- `transport_analytics` - Transport performance metrics
- `transport_reports` - Transport reporting

---

### **PHASE 5: REPORTS & ANALYTICS**

#### **Step 7: Reports & Analytics Module**

**File**: `database/add-reports-analytics-module.sql`
**Description**: Comprehensive reporting and analytics system

```bash
psql -d edufam_production -f database/add-reports-analytics-module.sql
```

**Tables Created** (12 tables):

- `report_templates` - Report template definitions
- `custom_reports` - User-generated reports
- `scheduled_reports` - Automated report scheduling
- `report_parameters` - Report parameter configurations
- `dashboard_widgets` - Dashboard component definitions
- `user_dashboards` - User-specific dashboards
- `analytics_cache` - Performance analytics caching
- `kpi_definitions` - Key Performance Indicator definitions
- `performance_metrics` - Performance measurement data
- `data_exports` - Data export tracking
- `report_subscriptions` - Report subscription management
- `analytics_logs` - Analytics usage tracking

---

### **PHASE 6: COMMUNICATION SYSTEM**

#### **Step 8: Communication Module**

**File**: `database/add-communication-module.sql`
**Description**: Multi-channel communication system

```bash
psql -d edufam_production -f database/add-communication-module.sql
```

**Tables Created** (14 tables):

- `conversations` - Message conversation threads
- `messages` - Individual messages
- `conversation_participants` - Conversation membership
- `message_attachments` - File attachments
- `announcements` - School announcements
- `notifications` - System notifications
- `notification_preferences` - User notification settings
- `sms_logs` - SMS delivery tracking
- `email_logs` - Email delivery tracking
- `communication_templates` - Message templates
- `broadcast_messages` - Mass communication
- `message_read_status` - Message read tracking
- `communication_settings` - System communication settings
- `notification_queues` - Notification delivery queue

---

### **PHASE 7: HR MANAGEMENT**

#### **Step 9: HR Module**

**File**: `database/add-hr-module.sql`
**Description**: Complete human resources management

```bash
psql -d edufam_production -f database/add-hr-module.sql
```

**Tables Created** (20 tables):

- `employees` - Employee master data
- `employee_contracts` - Employment contracts
- `employee_documents` - HR document management
- `leave_types` - Leave category definitions
- `leave_requests` - Leave application management
- `leave_balances` - Leave entitlement tracking
- `attendance_policies` - Attendance rule definitions
- `employee_attendance` - Staff attendance tracking
- `payroll_components` - Salary component definitions
- `payroll_records` - Salary processing records
- `employee_benefits` - Benefits management
- `performance_reviews` - Performance evaluation
- `disciplinary_actions` - Disciplinary case management
- `training_programs` - Staff development programs
- `employee_training` - Training participation tracking
- `recruitment_posts` - Job posting management
- `job_applications` - Application processing
- `employee_transfers` - Internal transfers
- `exit_interviews` - Employee exit processing
- `hr_analytics` - HR metrics and analytics

---

### **PHASE 8: SPECIALIZED MODULES**

#### **Step 10: Specialized School Modules**

**File**: `database/add-specialized-school-modules.sql`
**Description**: Advanced school-specific features (AI Timetable, Certificates, Invoices, Appraisals, Trips)

```bash
psql -d edufam_production -f database/add-specialized-school-modules.sql
```

**Tables Created** (42 tables):

**AI Timetable Module**:

- `timetable_versions` - Timetable version management
- `timetable_entries` - Individual timetable slots
- `timetable_constraints` - Scheduling constraints
- `timetable_conflicts` - Conflict detection
- `timetable_swaps` - Schedule change requests
- `teacher_availability` - Teacher availability constraints
- `room_bookings` - Room reservation system
- `schedule_changes` - Schedule modification tracking
- `timetable_analytics` - Timetable optimization metrics

**Certificate Module**:

- `certificate_templates` - Certificate template management
- `certificates` - Generated certificates
- `certificate_verifications` - Certificate verification system
- `certificate_batches` - Batch certificate processing
- `certificate_sequences` - Certificate numbering

**Invoice Generation Module**:

- `invoice_templates` - Invoice template system
- `invoice_series` - Invoice numbering series
- `invoice_taxes` - Tax configuration
- `invoice_discounts` - Discount management
- `recurring_invoices` - Automated recurring billing
- `credit_notes` - Credit note management
- `invoice_analytics` - Invoice performance metrics

**Performance Appraisal Module**:

- `appraisal_cycles` - Performance review cycles
- `appraisal_templates` - Evaluation templates
- `appraisals` - Individual appraisals
- `appraisal_responses` - Evaluation responses
- `appraisal_feedback` - 360-degree feedback
- `goal_settings` - Performance goal management
- `development_plans` - Employee development planning
- `appraisal_reports` - Performance reports

**Academic Trips Module**:

- `trip_types` - Trip categorization
- `trips` - Trip management
- `trip_participants` - Trip participation tracking
- `trip_permissions` - Parental consent management
- `trip_itineraries` - Trip schedule management
- `trip_vendors` - Vendor management
- `trip_expenses` - Trip cost tracking
- `trip_feedback` - Trip evaluation
- `safety_protocols` - Safety procedure management
- `emergency_contacts` - Emergency contact management

---

### **PHASE 9: ADMIN PLATFORM**

#### **Step 11: Admin Platform Modules**

**File**: `database/add-admin-platform-modules.sql`
**Description**: Platform administration and multi-school management

```bash
psql -d edufam_production -f database/add-admin-platform-modules.sql
```

**Tables Created** (26 tables):

**Multi-School Management**:

- `school_directors` - School director assignments
- `school_onboarding` - School registration process
- `school_configurations` - School-specific settings
- `school_analytics` - School performance metrics

**Subscription Management**:

- `subscription_plans` - Subscription plan definitions
- `school_subscriptions` - School subscription tracking
- `billing_history` - Billing record management
- `usage_tracking` - Feature usage monitoring

**Platform Analytics**:

- `platform_metrics` - System-wide performance metrics
- `revenue_analytics` - Revenue tracking and analysis
- `user_analytics` - User behavior analytics
- `feature_usage` - Feature adoption tracking

**Admin User Management**:

- `admin_roles` - Administrative role definitions
- `admin_permissions` - Granular permission system
- `admin_audit_logs` - Administrative action logging

**System Configuration**:

- `system_settings` - Global system configurations
- `feature_flags` - Feature toggle management
- `maintenance_schedules` - System maintenance planning

**Regional Management**:

- `regions` - Geographic region definitions
- `districts` - District/county management
- `zones` - Zone-based organization

**Platform Monitoring**:

- `system_health` - Health check monitoring
- `performance_logs` - Performance monitoring
- `error_logs` - Error tracking and analysis

**Data Migration Tools**:

- `migration_batches` - Data migration tracking
- `import_logs` - Data import audit trail

**Integration Management**:

- `external_integrations` - Third-party service management
- `api_keys` - API key management

**Compliance Monitoring**:

- `compliance_rules` - Regulatory compliance tracking
- `audit_trails` - Comprehensive audit logging

---

### **PHASE 10: ROW LEVEL SECURITY (RLS)**

#### **Step 12: Enable Row Level Security**

**File**: `database/enable-rls.sql`
**Description**: Enable multi-tenant security with Row Level Security

```bash
psql -d edufam_production -f database/enable-rls.sql
```

**Security Features**:

- Enable RLS on all school-related tables
- Create security policies for data isolation
- Set up role-based access control
- Configure audit trail policies

---

## **🔧 MANUAL EXECUTION STEPS**

### **Complete Migration Script**

```bash
#!/bin/bash

# Set database connection details
DB_NAME="edufam_production"
DB_USER="edufam_user"
DB_HOST="localhost"
DB_PORT="5432"

echo "🚀 Starting Edufam Database Migration..."

# Step 1: Base Schema
echo "📊 Step 1: Creating base schema..."
psql -d $DB_NAME -U $DB_USER -h $DB_HOST -p $DB_PORT -f database/schema.sql
if [ $? -eq 0 ]; then
    echo "✅ Base schema created successfully"
else
    echo "❌ Failed to create base schema"
    exit 1
fi

# Step 2: Student Tables
echo "👨‍🎓 Step 2: Creating student management tables..."
psql -d $DB_NAME -U $DB_USER -h $DB_HOST -p $DB_PORT -f database/add-student-tables.sql
if [ $? -eq 0 ]; then
    echo "✅ Student tables created successfully"
else
    echo "❌ Failed to create student tables"
    exit 1
fi

# Step 3: Academic Foundation
echo "📚 Step 3: Creating academic foundation tables..."
psql -d $DB_NAME -U $DB_USER -h $DB_HOST -p $DB_PORT -f database/add-academic-tables.sql
if [ $? -eq 0 ]; then
    echo "✅ Academic foundation created successfully"
else
    echo "❌ Failed to create academic foundation"
    exit 1
fi

# Step 4: Academic Module
echo "🎓 Step 4: Creating academic module..."
psql -d $DB_NAME -U $DB_USER -h $DB_HOST -p $DB_PORT -f database/add-academic-module.sql
if [ $? -eq 0 ]; then
    echo "✅ Academic module created successfully"
else
    echo "❌ Failed to create academic module"
    exit 1
fi

# Step 5: Financial Module
echo "💰 Step 5: Creating financial module..."
psql -d $DB_NAME -U $DB_USER -h $DB_HOST -p $DB_PORT -f database/add-financial-module.sql
if [ $? -eq 0 ]; then
    echo "✅ Financial module created successfully"
else
    echo "❌ Failed to create financial module"
    exit 1
fi

# Step 6: Transport Module
echo "🚌 Step 6: Creating transport module..."
psql -d $DB_NAME -U $DB_USER -h $DB_HOST -p $DB_PORT -f database/add-transport-module.sql
if [ $? -eq 0 ]; then
    echo "✅ Transport module created successfully"
else
    echo "❌ Failed to create transport module"
    exit 1
fi

# Step 7: Reports & Analytics
echo "📊 Step 7: Creating reports & analytics module..."
psql -d $DB_NAME -U $DB_USER -h $DB_HOST -p $DB_PORT -f database/add-reports-analytics-module.sql
if [ $? -eq 0 ]; then
    echo "✅ Reports & analytics module created successfully"
else
    echo "❌ Failed to create reports & analytics module"
    exit 1
fi

# Step 8: Communication Module
echo "💬 Step 8: Creating communication module..."
psql -d $DB_NAME -U $DB_USER -h $DB_HOST -p $DB_PORT -f database/add-communication-module.sql
if [ $? -eq 0 ]; then
    echo "✅ Communication module created successfully"
else
    echo "❌ Failed to create communication module"
    exit 1
fi

# Step 9: HR Module
echo "👥 Step 9: Creating HR module..."
psql -d $DB_NAME -U $DB_USER -h $DB_HOST -p $DB_PORT -f database/add-hr-module.sql
if [ $? -eq 0 ]; then
    echo "✅ HR module created successfully"
else
    echo "❌ Failed to create HR module"
    exit 1
fi

# Step 10: Specialized Modules
echo "🌟 Step 10: Creating specialized modules..."
psql -d $DB_NAME -U $DB_USER -h $DB_HOST -p $DB_PORT -f database/add-specialized-school-modules.sql
if [ $? -eq 0 ]; then
    echo "✅ Specialized modules created successfully"
else
    echo "❌ Failed to create specialized modules"
    exit 1
fi

# Step 11: Admin Platform
echo "🏛️ Step 11: Creating admin platform modules..."
psql -d $DB_NAME -U $DB_USER -h $DB_HOST -p $DB_PORT -f database/add-admin-platform-modules.sql
if [ $? -eq 0 ]; then
    echo "✅ Admin platform created successfully"
else
    echo "❌ Failed to create admin platform"
    exit 1
fi

# Step 12: Row Level Security
echo "🔒 Step 12: Enabling Row Level Security..."
psql -d $DB_NAME -U $DB_USER -h $DB_HOST -p $DB_PORT -f database/enable-rls.sql
if [ $? -eq 0 ]; then
    echo "✅ Row Level Security enabled successfully"
else
    echo "❌ Failed to enable Row Level Security"
    exit 1
fi

echo "🎉 Database migration completed successfully!"
echo "📊 Total tables created: 150+"
echo "🔧 Total modules: 37"
echo "🚀 System ready for production deployment!"
```

---

## **🔍 VERIFICATION STEPS**

### **Check Table Count**

```sql
-- Count total tables
SELECT COUNT(*) as total_tables
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';

-- Expected result: 150+ tables
```

### **Verify Extensions**

```sql
-- Check enabled extensions
SELECT extname FROM pg_extension WHERE extname IN ('uuid-ossp', 'pgcrypto');

-- Expected result: Both extensions should be listed
```

### **Check RLS Status**

```sql
-- Verify RLS is enabled on key tables
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('students', 'users', 'classes', 'payments')
  AND rowsecurity = true;

-- Expected result: All listed tables should have rowsecurity = true
```

### **Sample Data Validation**

```sql
-- Check if core tables exist and are structured correctly
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'schools'
ORDER BY ordinal_position;

-- Verify school table structure
```

---

## **⚠️ TROUBLESHOOTING**

### **Common Issues**

#### **Issue 1: Extension Already Exists**

```sql
-- Error: extension "uuid-ossp" already exists
-- Solution: This is normal and can be ignored
```

#### **Issue 2: Table Already Exists**

```sql
-- Error: relation "table_name" already exists
-- Solution: Use DROP TABLE IF EXISTS before CREATE TABLE, or skip if table is correct
```

#### **Issue 3: Foreign Key Constraints**

```sql
-- Error: violates foreign key constraint
-- Solution: Ensure tables are created in the correct order as specified
```

#### **Issue 4: Permission Denied**

```sql
-- Error: permission denied for schema public
-- Solution: Grant proper permissions to the database user
GRANT ALL PRIVILEGES ON DATABASE edufam_production TO edufam_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO edufam_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO edufam_user;
```

### **Rollback Procedures**

#### **Complete Database Reset**

```sql
-- WARNING: This will delete all data
DROP DATABASE IF EXISTS edufam_production;
CREATE DATABASE edufam_production;
```

#### **Table-Specific Rollback**

```sql
-- Remove specific module tables (example: transport)
DROP TABLE IF EXISTS transport_analytics CASCADE;
DROP TABLE IF EXISTS transport_reports CASCADE;
-- ... (continue for all module tables)
```

---

## **📊 FINAL VERIFICATION CHECKLIST**

- [ ] **Extensions Enabled**: `uuid-ossp` and `pgcrypto`
- [ ] **Core Tables**: `schools`, `users`, `user_sessions`, `password_reset_tokens`
- [ ] **Student Module**: 8+ tables including `students`, `classes`, `enrollments`
- [ ] **Academic Module**: 27+ tables including `assessments`, `grades`, `attendance`
- [ ] **Financial Module**: 25+ tables including `payments`, `invoices`, `fee_structures`
- [ ] **Transport Module**: 15+ tables including `vehicles`, `routes`, `transport_assignments`
- [ ] **Reports Module**: 12+ tables including `report_templates`, `analytics_cache`
- [ ] **Communication Module**: 14+ tables including `conversations`, `messages`
- [ ] **HR Module**: 20+ tables including `employees`, `leave_requests`, `payroll`
- [ ] **Specialized Modules**: 42+ tables for timetable, certificates, invoices, appraisals, trips
- [ ] **Admin Platform**: 26+ tables for multi-school and platform management
- [ ] **Row Level Security**: Enabled on all multi-tenant tables
- [ ] **Indexes**: Created for optimal performance
- [ ] **Constraints**: Foreign keys and check constraints in place

---

## **🎯 POST-MIGRATION STEPS**

### **1. Create Initial Admin User**

```sql
-- Insert super admin user
INSERT INTO users (
    id, email, password_hash, user_type, role,
    first_name, last_name, is_active, email_verified
) VALUES (
    uuid_generate_v4(),
    'admin@edufam.com',
    crypt('your_secure_password', gen_salt('bf')),
    'admin_user',
    'super_admin',
    'System',
    'Administrator',
    true,
    true
);
```

### **2. Create Sample School (Optional)**

```sql
-- Insert sample school for testing
INSERT INTO schools (
    id, name, code, email, subscription_type,
    price_per_student, max_students, is_active
) VALUES (
    uuid_generate_v4(),
    'Demo School',
    'DEMO001',
    'demo@school.com',
    'trial',
    150.00,
    1000,
    true
);
```

### **3. Set Up Cron Jobs (Optional)**

```sql
-- Create function for scheduled tasks
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
    DELETE FROM user_sessions WHERE expires_at < NOW();
    DELETE FROM password_reset_tokens WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Schedule cleanup (requires pg_cron extension)
-- SELECT cron.schedule('cleanup-sessions', '0 2 * * *', 'SELECT cleanup_expired_sessions();');
```

---

## **📈 PERFORMANCE OPTIMIZATION**

### **Recommended Indexes**

The migration files include essential indexes, but you may want to add additional ones based on usage patterns:

```sql
-- Additional performance indexes (optional)
CREATE INDEX CONCURRENTLY idx_students_school_class_active
ON students(school_id, class_id) WHERE is_active = true;

CREATE INDEX CONCURRENTLY idx_payments_student_date
ON payments(student_id, payment_date DESC);

CREATE INDEX CONCURRENTLY idx_attendance_student_date
ON student_attendance(student_id, date DESC);

CREATE INDEX CONCURRENTLY idx_messages_conversation_created
ON messages(conversation_id, created_at DESC);
```

### **Database Maintenance**

```sql
-- Analyze tables for query optimization
ANALYZE;

-- Update table statistics
VACUUM ANALYZE;

-- Reindex if needed (during maintenance windows)
-- REINDEX DATABASE edufam_production;
```

---

**🎉 Your Edufam database is now ready for production with 150+ tables, 37 modules, and enterprise-grade security!**

_For technical support during migration, contact: tech-support@edufam.com_
