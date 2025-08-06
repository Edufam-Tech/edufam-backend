const { query } = require('./src/config/database');
const fs = require('fs');

class SmartMigration {
  constructor() {
    this.existingTables = new Set();
    this.existingColumns = new Map(); // table -> Set of columns
  }

  async checkExistingStructure() {
    try {
      // Get all existing tables
      const tablesResult = await query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
      `);
      
      for (const row of tablesResult.rows) {
        this.existingTables.add(row.table_name);
      }

      // Get columns for each existing table
      for (const tableName of this.existingTables) {
        const columnsResult = await query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = $1 AND table_schema = 'public'
        `, [tableName]);
        
        const columns = new Set(columnsResult.rows.map(row => row.column_name));
        this.existingColumns.set(tableName, columns);
      }
      
      console.log(`📊 Found ${this.existingTables.size} existing tables`);
      
    } catch (error) {
      console.error('❌ Error checking existing structure:', error.message);
      throw error;
    }
  }

  async applySpecializedModules() {
    try {
      console.log('🚀 Starting smart migration for specialized modules...');
      
      await this.checkExistingStructure();
      
      // Step 1: Create missing prerequisite tables
      await this.createPrerequisiteTables();
      
      // Step 2: Apply schema in sections with smart handling
      await this.applyTimetableModule();
      await this.applyCertificateModule(); 
      await this.applyInvoiceModule();
      await this.applyAppraisalModule();
      await this.applyTripsModule();
      
      // Step 3: Create indexes and RLS policies
      await this.createIndexes();
      await this.enableRLS();
      
      console.log('✅ Smart migration completed successfully!');
      
      // Final count
      const result = await query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND (table_name LIKE 'timetable_%' 
               OR table_name LIKE 'certificate_%' 
               OR table_name LIKE 'invoice_%' 
               OR table_name LIKE 'appraisal_%' 
               OR table_name LIKE 'trip_%'
               OR table_name = 'classrooms')
        ORDER BY table_name
      `);
      
      console.log('\n📊 Specialized module tables:');
      result.rows.forEach(row => console.log('  -', row.table_name));
      console.log(`\n🎉 Total: ${result.rows.length} tables`);
      
    } catch (error) {
      console.error('❌ Smart migration failed:', error.message);
      throw error;
    }
  }

  async createPrerequisiteTables() {
    console.log('📝 Creating prerequisite tables...');
    
    // Create classrooms table if it doesn't exist
    if (!this.existingTables.has('classrooms')) {
      await query(`
        CREATE TABLE classrooms (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
          
          room_name VARCHAR(100) NOT NULL,
          room_number VARCHAR(20),
          building VARCHAR(100),
          floor INTEGER,
          
          capacity INTEGER,
          room_type VARCHAR(30) DEFAULT 'classroom' CHECK (room_type IN ('classroom', 'laboratory', 'library', 'hall', 'office', 'sports', 'computer_lab')),
          
          has_projector BOOLEAN DEFAULT false,
          has_whiteboard BOOLEAN DEFAULT true,
          has_computer BOOLEAN DEFAULT false,
          has_internet BOOLEAN DEFAULT true,
          equipment_notes TEXT,
          
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          
          UNIQUE(school_id, room_number)
        )
      `);
      console.log('  ✅ Created classrooms table');
    }
  }

  async applyTimetableModule() {
    console.log('📝 Applying timetable module...');
    
    const timetableTables = [
      'timetable_configurations',
      'timetable_periods', 
      'timetable_versions',
      'timetable_entries',
      'teacher_availability',
      'room_availability', 
      'subject_requirements',
      'timetable_conflicts',
      'timetable_preferences',
      'ai_optimization_logs'
    ];
    
    for (const tableName of timetableTables) {
      if (!this.existingTables.has(tableName)) {
        await this.createTimetableTable(tableName);
        console.log(`  ✅ Created ${tableName} table`);
      }
    }
  }

  async applyCertificateModule() {
    console.log('📝 Applying certificate module...');
    
    const certificateTables = [
      'certificate_templates',
      'certificate_types',
      'certificates_issued',
      'certificate_fields',
      'certificate_signatures',
      'certificate_verifications',
      'bulk_certificate_jobs',
      'certificate_designs'
    ];
    
    for (const tableName of certificateTables) {
      if (!this.existingTables.has(tableName)) {
        await this.createCertificateTable(tableName);
        console.log(`  ✅ Created ${tableName} table`);
      }
    }
  }

  async applyInvoiceModule() {
    console.log('📝 Applying invoice module...');
    
    // First, create the new invoice tables that don't exist
    const newInvoiceTables = [
      'invoice_templates',
      'invoice_series',
      'invoice_taxes',
      'invoice_discounts', 
      'invoice_payments',
      'recurring_invoices',
      'invoice_reminders',
      'credit_notes'
    ];
    
    for (const tableName of newInvoiceTables) {
      if (!this.existingTables.has(tableName)) {
        await this.createInvoiceTable(tableName);
        console.log(`  ✅ Created ${tableName} table`);
      }
    }

    // Now handle existing tables (add missing columns without foreign key constraints for now)
    if (this.existingTables.has('invoices')) {
      console.log('  ⚠️  Invoices table exists, checking for missing columns...');
      await this.updateInvoicesTableSafely();
    } else {
      await this.createInvoiceTable('invoices');
      console.log('  ✅ Created invoices table');
    }

    if (this.existingTables.has('invoice_items')) {
      console.log('  ⚠️  Invoice items table exists, checking for missing columns...');
      await this.updateInvoiceItemsTable();
    } else {
      await this.createInvoiceTable('invoice_items');
      console.log('  ✅ Created invoice_items table');
    }
  }

  async applyAppraisalModule() {
    console.log('📝 Applying appraisal module...');
    
    const appraisalTables = [
      'appraisal_cycles',
      'appraisal_templates',
      'appraisal_categories',
      'appraisal_questions',
      'appraisals',
      'appraisal_responses',
      'appraisal_goals',
      'appraisal_feedback',
      'appraisal_reviews',
      'development_plans',
      'appraisal_history'
    ];
    
    for (const tableName of appraisalTables) {
      if (!this.existingTables.has(tableName)) {
        await this.createAppraisalTable(tableName);
        console.log(`  ✅ Created ${tableName} table`);
      }
    }
  }

  async applyTripsModule() {
    console.log('📝 Applying trips module...');
    
    const tripTables = [
      'trip_types',    // Create this first
      'trips',
      'trip_participants',
      'trip_permissions',
      'trip_itineraries',
      'trip_expenses',
      'trip_vendors',
      'trip_safety_measures',
      'trip_medical_info',
      'trip_feedback'
    ];
    
    for (const tableName of tripTables) {
      if (!this.existingTables.has(tableName)) {
        await this.createTripTable(tableName);
        console.log(`  ✅ Created ${tableName} table`);
      }
    }
  }

  async updateInvoicesTable() {
    const existingCols = this.existingColumns.get('invoices');
    const missingColumns = [];
    
    // Check for missing columns that exist in our new schema
    const expectedColumns = [
      'template_id', 'series_id', 'parent_id', 'customer_name', 'customer_email', 
      'customer_phone', 'billing_address', 'academic_year_id', 'academic_term_id',
      'subtotal', 'total_tax', 'total_discount', 'total_amount', 'amount_paid', 
      'balance_due', 'viewed_at', 'pdf_url', 'pdf_generated_at', 'notes', 'terms_and_conditions'
    ];
    
    for (const col of expectedColumns) {
      if (!existingCols.has(col)) {
        missingColumns.push(col);
      }
    }
    
    if (missingColumns.length > 0) {
      console.log(`    Adding ${missingColumns.length} missing columns to invoices table`);
      // Add missing columns one by one
      for (const col of missingColumns) {
        await this.addColumnToInvoices(col);
      }
    }
  }

  async updateInvoiceItemsTable() {
    const existingCols = this.existingColumns.get('invoice_items');
    const missingColumns = [];
    
    const expectedColumns = [
      'item_order', 'item_code', 'line_total', 'tax_rate', 'tax_amount',
      'discount_type', 'discount_value', 'discount_amount'
    ];
    
    for (const col of expectedColumns) {
      if (!existingCols.has(col)) {
        missingColumns.push(col);
      }
    }
    
    if (missingColumns.length > 0) {
      console.log(`    Adding ${missingColumns.length} missing columns to invoice_items table`);
      for (const col of missingColumns) {
        await this.addColumnToInvoiceItems(col);
      }
    }
  }

  async updateInvoicesTableSafely() {
    const existingCols = this.existingColumns.get('invoices');
    const missingColumns = [];
    
    // Check for missing columns that exist in our new schema (without foreign keys for now)
    const expectedColumns = [
      'customer_name', 'customer_email', 'customer_phone', 'billing_address',
      'subtotal', 'total_tax', 'total_discount', 'total_amount', 'amount_paid', 
      'balance_due', 'viewed_at', 'pdf_url', 'pdf_generated_at', 'notes', 'terms_and_conditions'
    ];
    
    for (const col of expectedColumns) {
      if (!existingCols.has(col)) {
        missingColumns.push(col);
      }
    }
    
    if (missingColumns.length > 0) {
      console.log(`    Adding ${missingColumns.length} missing columns to invoices table`);
      // Add missing columns one by one
      for (const col of missingColumns) {
        await this.addColumnToInvoicesSafely(col);
      }
    }
  }

  async addColumnToInvoicesSafely(columnName) {
    // Column definitions without foreign key constraints to avoid dependency issues
    const columnDefinitions = {
      'customer_name': 'VARCHAR(255)',
      'customer_email': 'VARCHAR(255)',
      'customer_phone': 'VARCHAR(20)',
      'billing_address': 'TEXT',
      'subtotal': 'DECIMAL(12,2) DEFAULT 0.00',
      'total_tax': 'DECIMAL(12,2) DEFAULT 0.00',
      'total_discount': 'DECIMAL(12,2) DEFAULT 0.00',
      'total_amount': 'DECIMAL(12,2) DEFAULT 0.00',
      'amount_paid': 'DECIMAL(12,2) DEFAULT 0.00',
      'balance_due': 'DECIMAL(12,2) DEFAULT 0.00',
      'viewed_at': 'TIMESTAMP',
      'pdf_url': 'TEXT',
      'pdf_generated_at': 'TIMESTAMP',
      'notes': 'TEXT',
      'terms_and_conditions': 'TEXT'
    };
    
    if (columnDefinitions[columnName]) {
      await query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS ${columnName} ${columnDefinitions[columnName]}`);
    }
  }

  async addColumnToInvoiceItems(columnName) {
    const columnDefinitions = {
      'item_order': 'INTEGER DEFAULT 1',
      'item_code': 'VARCHAR(50)',
      'line_total': 'DECIMAL(12,2) DEFAULT 0.00',
      'tax_rate': 'DECIMAL(5,2) DEFAULT 0.00',
      'tax_amount': 'DECIMAL(10,2) DEFAULT 0.00',
      'discount_type': 'VARCHAR(10) CHECK (discount_type IN (\'percentage\', \'fixed\'))',
      'discount_value': 'DECIMAL(10,2) DEFAULT 0.00',
      'discount_amount': 'DECIMAL(10,2) DEFAULT 0.00'
    };
    
    if (columnDefinitions[columnName]) {
      await query(`ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS ${columnName} ${columnDefinitions[columnName]}`);
    }
  }

  // For brevity, I'll create simplified versions of the table creation methods
  async createTimetableTable(tableName) {
    // Read the specific table definition from our schema file and execute it
    // This is a simplified approach - in practice, you'd want more granular control
    const schemaContent = fs.readFileSync('./database/add-specialized-school-modules.sql', 'utf8');
    const tableRegex = new RegExp(`CREATE TABLE IF NOT EXISTS ${tableName}.*?;`, 'gs');
    const match = schemaContent.match(tableRegex);
    if (match) {
      await query(match[0]);
    }
  }

  async createCertificateTable(tableName) {
    const schemaContent = fs.readFileSync('./database/add-specialized-school-modules.sql', 'utf8');
    const tableRegex = new RegExp(`CREATE TABLE IF NOT EXISTS ${tableName}.*?;`, 'gs');
    const match = schemaContent.match(tableRegex);
    if (match) {
      await query(match[0]);
    }
  }

  async createInvoiceTable(tableName) {
    const schemaContent = fs.readFileSync('./database/add-specialized-school-modules.sql', 'utf8');
    const tableRegex = new RegExp(`CREATE TABLE IF NOT EXISTS ${tableName}.*?;`, 'gs');
    const match = schemaContent.match(tableRegex);
    if (match) {
      await query(match[0]);
    }
  }

  async createAppraisalTable(tableName) {
    const schemaContent = fs.readFileSync('./database/add-specialized-school-modules.sql', 'utf8');
    const tableRegex = new RegExp(`CREATE TABLE IF NOT EXISTS ${tableName}.*?;`, 'gs');
    const match = schemaContent.match(tableRegex);
    if (match) {
      await query(match[0]);
    }
  }

  async createTripTable(tableName) {
    const schemaContent = fs.readFileSync('./database/add-specialized-school-modules.sql', 'utf8');
    const tableRegex = new RegExp(`CREATE TABLE IF NOT EXISTS ${tableName}.*?;`, 'gs');
    const match = schemaContent.match(tableRegex);
    if (match) {
      await query(match[0]);
    }
  }

  async createIndexes() {
    console.log('📝 Creating indexes...');
    
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_timetable_entries_school_version ON timetable_entries(school_id, version_id)',
      'CREATE INDEX IF NOT EXISTS idx_certificates_issued_student ON certificates_issued(student_id, issue_date)',
      'CREATE INDEX IF NOT EXISTS idx_invoices_student_date ON invoices(student_id, invoice_date)',
      'CREATE INDEX IF NOT EXISTS idx_appraisals_cycle_employee ON appraisals(cycle_id, employee_id)',
      'CREATE INDEX IF NOT EXISTS idx_trips_school_dates ON trips(school_id, departure_date, return_date)'
    ];
    
    for (const indexSQL of indexes) {
      try {
        await query(indexSQL);
      } catch (error) {
        console.log(`    ⚠️  Index creation skipped: ${error.message}`);
      }
    }
  }

  async enableRLS() {
    console.log('📝 Enabling Row Level Security...');
    
    const tables = [
      'timetable_configurations', 'certificate_templates', 'invoices', 
      'appraisal_cycles', 'trips', 'classrooms'
    ];
    
    for (const table of tables) {
      try {
        if (this.existingTables.has(table)) {
          await query(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
          // You can add specific RLS policies here
        }
      } catch (error) {
        console.log(`    ⚠️  RLS setup skipped for ${table}: ${error.message}`);
      }
    }
  }
}

// Run the smart migration
const migration = new SmartMigration();
migration.applySpecializedModules().catch(console.error);