-- Migration: Add Financial Module Tables (Fees & M-Pesa)
-- This script adds comprehensive financial management tables

-- Fee Categories table (tuition, transport, meals, etc.)
CREATE TABLE fee_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    category_type VARCHAR(20) NOT NULL CHECK (category_type IN ('tuition', 'transport', 'meals', 'uniform', 'books', 'activities', 'other')),
    is_mandatory BOOLEAN DEFAULT true,
    is_recurring BOOLEAN DEFAULT true,
    frequency VARCHAR(20) DEFAULT 'monthly' CHECK (frequency IN ('one_time', 'monthly', 'termly', 'yearly')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_school_category_name UNIQUE (school_id, name)
);

-- Fee Structures table (fee definitions)
CREATE TABLE fee_structures (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    
    -- Fee configuration
    currency VARCHAR(3) DEFAULT 'KES',
    is_active BOOLEAN DEFAULT true,
    effective_from DATE NOT NULL,
    effective_to DATE,
    
    -- Metadata
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT check_effective_dates CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

-- Fee Structure Items table (individual fee items)
CREATE TABLE fee_structure_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fee_structure_id UUID NOT NULL REFERENCES fee_structures(id) ON DELETE CASCADE,
    fee_category_id UUID NOT NULL REFERENCES fee_categories(id) ON DELETE CASCADE,
    
    -- Fee details
    amount DECIMAL(10,2) NOT NULL,
    frequency VARCHAR(20) NOT NULL CHECK (frequency IN ('one_time', 'monthly', 'termly', 'yearly')),
    due_day INTEGER CHECK (due_day >= 1 AND due_day <= 31), -- Day of month for recurring fees
    late_fee_percentage DECIMAL(5,2) DEFAULT 0.00,
    late_fee_amount DECIMAL(10,2) DEFAULT 0.00,
    
    -- Class/level specific
    class_level VARCHAR(50), -- NULL for all levels
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Fee Assignments table (student fee assignments)
CREATE TABLE fee_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    fee_structure_id UUID NOT NULL REFERENCES fee_structures(id) ON DELETE CASCADE,
    
    -- Assignment details
    academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
    total_amount DECIMAL(12,2) NOT NULL,
    discount_percentage DECIMAL(5,2) DEFAULT 0.00,
    discount_amount DECIMAL(10,2) DEFAULT 0.00,
    final_amount DECIMAL(12,2) NOT NULL,
    
    -- Status
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'active', 'completed')),
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP,
    rejection_reason TEXT,
    
    -- Metadata
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Payment Methods table (M-Pesa, bank, cash)
CREATE TABLE payment_methods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    description TEXT,
    method_type VARCHAR(20) NOT NULL CHECK (method_type IN ('mpesa', 'bank', 'cash', 'card', 'other')),
    is_active BOOLEAN DEFAULT true,
    requires_reference BOOLEAN DEFAULT false,
    auto_reconcile BOOLEAN DEFAULT false,
    
    -- Configuration
    config JSONB DEFAULT '{}',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_school_method_name UNIQUE (school_id, name)
);

-- Payments table (payment records)
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    fee_assignment_id UUID REFERENCES fee_assignments(id) ON DELETE CASCADE,
    
    -- Payment details
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'KES',
    payment_method_id UUID NOT NULL REFERENCES payment_methods(id),
    reference_number VARCHAR(100),
    transaction_id VARCHAR(100),
    
    -- Payment status
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded')),
    payment_date DATE NOT NULL,
    received_at TIMESTAMP,
    
    -- Reconciliation
    is_reconciled BOOLEAN DEFAULT false,
    reconciled_by UUID REFERENCES users(id),
    reconciled_at TIMESTAMP,
    reconciliation_notes TEXT,
    
    -- Metadata
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- M-Pesa Transactions table (M-Pesa specific data)
CREATE TABLE mpesa_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
    
    -- M-Pesa specific fields
    business_short_code VARCHAR(10) NOT NULL,
    checkout_request_id VARCHAR(100) UNIQUE,
    merchant_request_id VARCHAR(100),
    mpesa_receipt_number VARCHAR(50),
    phone_number VARCHAR(15) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    
    -- Transaction details
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('stk_push', 'c2b', 'b2c', 'b2b')),
    result_code INTEGER,
    result_desc TEXT,
    
    -- Callback data
    callback_metadata JSONB,
    is_callback_received BOOLEAN DEFAULT false,
    callback_received_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- M-Pesa Callbacks table (STK push callbacks)
CREATE TABLE mpesa_callbacks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mpesa_transaction_id UUID NOT NULL REFERENCES mpesa_transactions(id) ON DELETE CASCADE,
    
    -- Callback details
    callback_type VARCHAR(20) NOT NULL CHECK (callback_type IN ('stk_push', 'c2b', 'b2c', 'b2b')),
    callback_data JSONB NOT NULL,
    is_processed BOOLEAN DEFAULT false,
    processed_at TIMESTAMP,
    processing_notes TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Invoices table (generated invoices)
CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    fee_assignment_id UUID REFERENCES fee_assignments(id) ON DELETE CASCADE,
    
    -- Invoice details
    invoice_number VARCHAR(50) NOT NULL,
    invoice_date DATE NOT NULL,
    due_date DATE NOT NULL,
    total_amount DECIMAL(12,2) NOT NULL,
    tax_amount DECIMAL(10,2) DEFAULT 0.00,
    discount_amount DECIMAL(10,2) DEFAULT 0.00,
    final_amount DECIMAL(12,2) NOT NULL,
    
    -- Status
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled')),
    sent_at TIMESTAMP,
    paid_at TIMESTAMP,
    
    -- Metadata
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_school_invoice_number UNIQUE (school_id, invoice_number)
);

-- Invoice Items table (line items)
CREATE TABLE invoice_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    fee_category_id UUID NOT NULL REFERENCES fee_categories(id) ON DELETE CASCADE,
    
    description TEXT NOT NULL,
    quantity DECIMAL(8,2) NOT NULL DEFAULT 1.00,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Receipts table (payment receipts)
CREATE TABLE receipts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
    
    -- Receipt details
    receipt_number VARCHAR(50) NOT NULL,
    receipt_date DATE NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'KES',
    
    -- Status
    status VARCHAR(20) DEFAULT 'generated' CHECK (status IN ('generated', 'sent', 'printed')),
    sent_at TIMESTAMP,
    
    -- Metadata
    generated_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_school_receipt_number UNIQUE (school_id, receipt_number)
);

-- Payment Plans table (installment plans)
CREATE TABLE payment_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    fee_assignment_id UUID NOT NULL REFERENCES fee_assignments(id) ON DELETE CASCADE,
    
    -- Plan details
    plan_name VARCHAR(100) NOT NULL,
    total_amount DECIMAL(12,2) NOT NULL,
    installment_amount DECIMAL(10,2) NOT NULL,
    number_of_installments INTEGER NOT NULL,
    installment_frequency VARCHAR(20) NOT NULL CHECK (installment_frequency IN ('weekly', 'monthly', 'termly')),
    
    -- Status
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'defaulted', 'cancelled')),
    start_date DATE NOT NULL,
    end_date DATE,
    
    -- Metadata
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Fee Discounts table (scholarships, discounts)
CREATE TABLE fee_discounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    student_id UUID REFERENCES students(id) ON DELETE CASCADE, -- NULL for school-wide discounts
    
    -- Discount details
    discount_name VARCHAR(100) NOT NULL,
    description TEXT,
    discount_type VARCHAR(20) NOT NULL CHECK (discount_type IN ('percentage', 'fixed_amount')),
    discount_value DECIMAL(10,2) NOT NULL,
    
    -- Applicability
    applicable_categories JSONB DEFAULT '[]', -- Array of fee category IDs
    start_date DATE NOT NULL,
    end_date DATE,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    
    -- Metadata
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Fee Waivers table (special waivers)
CREATE TABLE fee_waivers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    fee_assignment_id UUID NOT NULL REFERENCES fee_assignments(id) ON DELETE CASCADE,
    
    -- Waiver details
    waiver_reason TEXT NOT NULL,
    waived_amount DECIMAL(10,2) NOT NULL,
    waiver_percentage DECIMAL(5,2),
    
    -- Approval
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP,
    rejection_reason TEXT,
    
    -- Metadata
    requested_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_fee_categories_school ON fee_categories(school_id);
CREATE INDEX idx_fee_categories_active ON fee_categories(is_active);

CREATE INDEX idx_fee_structures_school ON fee_structures(school_id);
CREATE INDEX idx_fee_structures_year ON fee_structures(academic_year_id);
CREATE INDEX idx_fee_structures_active ON fee_structures(is_active);

CREATE INDEX idx_fee_structure_items_structure ON fee_structure_items(fee_structure_id);
CREATE INDEX idx_fee_structure_items_category ON fee_structure_items(fee_category_id);

CREATE INDEX idx_fee_assignments_school ON fee_assignments(school_id);
CREATE INDEX idx_fee_assignments_student ON fee_assignments(student_id);
CREATE INDEX idx_fee_assignments_status ON fee_assignments(status);

CREATE INDEX idx_payment_methods_school ON payment_methods(school_id);
CREATE INDEX idx_payment_methods_active ON payment_methods(is_active);

CREATE INDEX idx_payments_school ON payments(school_id);
CREATE INDEX idx_payments_student ON payments(student_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_date ON payments(payment_date);

CREATE INDEX idx_mpesa_transactions_payment ON mpesa_transactions(payment_id);
CREATE INDEX idx_mpesa_transactions_checkout ON mpesa_transactions(checkout_request_id);
CREATE INDEX idx_mpesa_transactions_receipt ON mpesa_transactions(mpesa_receipt_number);

CREATE INDEX idx_mpesa_callbacks_transaction ON mpesa_callbacks(mpesa_transaction_id);
CREATE INDEX idx_mpesa_callbacks_processed ON mpesa_callbacks(is_processed);

CREATE INDEX idx_invoices_school ON invoices(school_id);
CREATE INDEX idx_invoices_student ON invoices(student_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_date ON invoices(invoice_date);

CREATE INDEX idx_invoice_items_invoice ON invoice_items(invoice_id);

CREATE INDEX idx_receipts_school ON receipts(school_id);
CREATE INDEX idx_receipts_payment ON receipts(payment_id);

CREATE INDEX idx_payment_plans_school ON payment_plans(school_id);
CREATE INDEX idx_payment_plans_student ON payment_plans(student_id);
CREATE INDEX idx_payment_plans_status ON payment_plans(status);

CREATE INDEX idx_fee_discounts_school ON fee_discounts(school_id);
CREATE INDEX idx_fee_discounts_student ON fee_discounts(student_id);
CREATE INDEX idx_fee_discounts_active ON fee_discounts(is_active);

CREATE INDEX idx_fee_waivers_school ON fee_waivers(school_id);
CREATE INDEX idx_fee_waivers_student ON fee_waivers(student_id);
CREATE INDEX idx_fee_waivers_status ON fee_waivers(status);

-- Add triggers for updated_at
CREATE TRIGGER update_fee_categories_updated_at BEFORE UPDATE ON fee_categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_fee_structures_updated_at BEFORE UPDATE ON fee_structures FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_fee_structure_items_updated_at BEFORE UPDATE ON fee_structure_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_fee_assignments_updated_at BEFORE UPDATE ON fee_assignments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_payment_methods_updated_at BEFORE UPDATE ON payment_methods FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_mpesa_transactions_updated_at BEFORE UPDATE ON mpesa_transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_receipts_updated_at BEFORE UPDATE ON receipts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_payment_plans_updated_at BEFORE UPDATE ON payment_plans FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_fee_discounts_updated_at BEFORE UPDATE ON fee_discounts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_fee_waivers_updated_at BEFORE UPDATE ON fee_waivers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add RLS policies
ALTER TABLE fee_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_structure_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE mpesa_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mpesa_callbacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_discounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_waivers ENABLE ROW LEVEL SECURITY;

-- RLS policies for financial tables
CREATE POLICY financial_school_policy ON fee_categories FOR ALL USING (
    school_id IN (
        SELECT school_id FROM users 
        WHERE id = current_setting('app.current_user_id')::UUID
        AND user_type = 'school_user'
    )
    OR EXISTS (
        SELECT 1 FROM users 
        WHERE id = current_setting('app.current_user_id')::UUID
        AND user_type = 'admin_user'
    )
);

CREATE POLICY financial_school_policy ON fee_structures FOR ALL USING (
    school_id IN (
        SELECT school_id FROM users 
        WHERE id = current_setting('app.current_user_id')::UUID
        AND user_type = 'school_user'
    )
    OR EXISTS (
        SELECT 1 FROM users 
        WHERE id = current_setting('app.current_user_id')::UUID
        AND user_type = 'admin_user'
    )
);

CREATE POLICY financial_school_policy ON fee_structure_items FOR ALL USING (
    fee_structure_id IN (
        SELECT fs.id FROM fee_structures fs
        JOIN users u ON fs.school_id = u.school_id
        WHERE u.id = current_setting('app.current_user_id')::UUID
        AND u.user_type = 'school_user'
    )
    OR EXISTS (
        SELECT 1 FROM users 
        WHERE id = current_setting('app.current_user_id')::UUID
        AND user_type = 'admin_user'
    )
);

CREATE POLICY financial_school_policy ON fee_assignments FOR ALL USING (
    school_id IN (
        SELECT school_id FROM users 
        WHERE id = current_setting('app.current_user_id')::UUID
        AND user_type = 'school_user'
    )
    OR EXISTS (
        SELECT 1 FROM users 
        WHERE id = current_setting('app.current_user_id')::UUID
        AND user_type = 'admin_user'
    )
);

CREATE POLICY financial_school_policy ON payment_methods FOR ALL USING (
    school_id IN (
        SELECT school_id FROM users 
        WHERE id = current_setting('app.current_user_id')::UUID
        AND user_type = 'school_user'
    )
    OR EXISTS (
        SELECT 1 FROM users 
        WHERE id = current_setting('app.current_user_id')::UUID
        AND user_type = 'admin_user'
    )
);

CREATE POLICY financial_school_policy ON payments FOR ALL USING (
    school_id IN (
        SELECT school_id FROM users 
        WHERE id = current_setting('app.current_user_id')::UUID
        AND user_type = 'school_user'
    )
    OR EXISTS (
        SELECT 1 FROM users 
        WHERE id = current_setting('app.current_user_id')::UUID
        AND user_type = 'admin_user'
    )
);

CREATE POLICY financial_school_policy ON mpesa_transactions FOR ALL USING (
    payment_id IN (
        SELECT p.id FROM payments p
        JOIN users u ON p.school_id = u.school_id
        WHERE u.id = current_setting('app.current_user_id')::UUID
        AND u.user_type = 'school_user'
    )
    OR EXISTS (
        SELECT 1 FROM users 
        WHERE id = current_setting('app.current_user_id')::UUID
        AND user_type = 'admin_user'
    )
);

CREATE POLICY financial_school_policy ON mpesa_callbacks FOR ALL USING (
    mpesa_transaction_id IN (
        SELECT mt.id FROM mpesa_transactions mt
        JOIN payments p ON mt.payment_id = p.id
        JOIN users u ON p.school_id = u.school_id
        WHERE u.id = current_setting('app.current_user_id')::UUID
        AND u.user_type = 'school_user'
    )
    OR EXISTS (
        SELECT 1 FROM users 
        WHERE id = current_setting('app.current_user_id')::UUID
        AND user_type = 'admin_user'
    )
);

CREATE POLICY financial_school_policy ON invoices FOR ALL USING (
    school_id IN (
        SELECT school_id FROM users 
        WHERE id = current_setting('app.current_user_id')::UUID
        AND user_type = 'school_user'
    )
    OR EXISTS (
        SELECT 1 FROM users 
        WHERE id = current_setting('app.current_user_id')::UUID
        AND user_type = 'admin_user'
    )
);

CREATE POLICY financial_school_policy ON invoice_items FOR ALL USING (
    invoice_id IN (
        SELECT i.id FROM invoices i
        JOIN users u ON i.school_id = u.school_id
        WHERE u.id = current_setting('app.current_user_id')::UUID
        AND u.user_type = 'school_user'
    )
    OR EXISTS (
        SELECT 1 FROM users 
        WHERE id = current_setting('app.current_user_id')::UUID
        AND user_type = 'admin_user'
    )
);

CREATE POLICY financial_school_policy ON receipts FOR ALL USING (
    school_id IN (
        SELECT school_id FROM users 
        WHERE id = current_setting('app.current_user_id')::UUID
        AND user_type = 'school_user'
    )
    OR EXISTS (
        SELECT 1 FROM users 
        WHERE id = current_setting('app.current_user_id')::UUID
        AND user_type = 'admin_user'
    )
);

CREATE POLICY financial_school_policy ON payment_plans FOR ALL USING (
    school_id IN (
        SELECT school_id FROM users 
        WHERE id = current_setting('app.current_user_id')::UUID
        AND user_type = 'school_user'
    )
    OR EXISTS (
        SELECT 1 FROM users 
        WHERE id = current_setting('app.current_user_id')::UUID
        AND user_type = 'admin_user'
    )
);

CREATE POLICY financial_school_policy ON fee_discounts FOR ALL USING (
    school_id IN (
        SELECT school_id FROM users 
        WHERE id = current_setting('app.current_user_id')::UUID
        AND user_type = 'school_user'
    )
    OR EXISTS (
        SELECT 1 FROM users 
        WHERE id = current_setting('app.current_user_id')::UUID
        AND user_type = 'admin_user'
    )
);

CREATE POLICY financial_school_policy ON fee_waivers FOR ALL USING (
    school_id IN (
        SELECT school_id FROM users 
        WHERE id = current_setting('app.current_user_id')::UUID
        AND user_type = 'school_user'
    )
    OR EXISTS (
        SELECT 1 FROM users 
        WHERE id = current_setting('app.current_user_id')::UUID
        AND user_type = 'admin_user'
    )
);

-- Insert default data
INSERT INTO fee_categories (school_id, name, description, category_type, frequency) 
SELECT 
    id as school_id,
    'Tuition Fees' as name,
    'Main tuition fees for academic instruction' as description,
    'tuition' as category_type,
    'monthly' as frequency
FROM schools WHERE is_active = true;

INSERT INTO fee_categories (school_id, name, description, category_type, frequency) 
SELECT 
    id as school_id,
    'Transport Fees' as name,
    'School transport and bus services' as description,
    'transport' as category_type,
    'monthly' as frequency
FROM schools WHERE is_active = true;

INSERT INTO fee_categories (school_id, name, description, category_type, frequency) 
SELECT 
    id as school_id,
    'Meals' as name,
    'School meals and lunch services' as description,
    'meals' as category_type,
    'monthly' as frequency
FROM schools WHERE is_active = true;

INSERT INTO fee_categories (school_id, name, description, category_type, frequency) 
SELECT 
    id as school_id,
    'Uniform' as name,
    'School uniform and dress code items' as description,
    'uniform' as category_type,
    'one_time' as frequency
FROM schools WHERE is_active = true;

INSERT INTO fee_categories (school_id, name, description, category_type, frequency) 
SELECT 
    id as school_id,
    'Books and Stationery' as name,
    'Textbooks and stationery supplies' as description,
    'books' as category_type,
    'termly' as frequency
FROM schools WHERE is_active = true;

-- Insert default payment methods
INSERT INTO payment_methods (school_id, name, description, method_type, config) 
SELECT 
    id as school_id,
    'M-Pesa' as name,
    'Mobile money payment via M-Pesa' as description,
    'mpesa' as method_type,
    '{"shortcode": "", "passkey": "", "environment": "sandbox"}'::jsonb as config
FROM schools WHERE is_active = true;

INSERT INTO payment_methods (school_id, name, description, method_type, config) 
SELECT 
    id as school_id,
    'Bank Transfer' as name,
    'Direct bank transfer payment' as description,
    'bank' as method_type,
    '{"account_number": "", "bank_name": "", "branch": ""}'::jsonb as config
FROM schools WHERE is_active = true;

INSERT INTO payment_methods (school_id, name, description, method_type, config) 
SELECT 
    id as school_id,
    'Cash' as name,
    'Cash payment at school office' as description,
    'cash' as method_type,
    '{}'::jsonb as config
FROM schools WHERE is_active = true;

-- Add comments for documentation
COMMENT ON TABLE fee_categories IS 'Fee categories for different types of school fees';
COMMENT ON TABLE fee_structures IS 'Fee structure definitions for academic years';
COMMENT ON TABLE fee_structure_items IS 'Individual fee items within fee structures';
COMMENT ON TABLE fee_assignments IS 'Student fee assignments and configurations';
COMMENT ON TABLE payment_methods IS 'Available payment methods for each school';
COMMENT ON TABLE payments IS 'Payment records and transactions';
COMMENT ON TABLE mpesa_transactions IS 'M-Pesa specific transaction data';
COMMENT ON TABLE mpesa_callbacks IS 'M-Pesa callback records for transaction updates';
COMMENT ON TABLE invoices IS 'Generated invoices for fee payments';
COMMENT ON TABLE invoice_items IS 'Line items within invoices';
COMMENT ON TABLE receipts IS 'Payment receipts for completed transactions';
COMMENT ON TABLE payment_plans IS 'Installment payment plans for students';
COMMENT ON TABLE fee_discounts IS 'Fee discounts and scholarships';
COMMENT ON TABLE fee_waivers IS 'Special fee waivers and exemptions'; 