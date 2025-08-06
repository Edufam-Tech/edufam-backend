-- ====================================
-- MARKETPLACE MANAGEMENT SYSTEM
-- ====================================
-- E-commerce capabilities for educational resources, services, and products
-- Supports B2B and B2C transactions within the educational ecosystem

-- Marketplace Categories
CREATE TABLE marketplace_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_name VARCHAR(100) UNIQUE NOT NULL,
    category_code VARCHAR(20) UNIQUE NOT NULL,
    parent_category_id UUID REFERENCES marketplace_categories(id) ON DELETE SET NULL,
    description TEXT,
    category_type VARCHAR(30) NOT NULL CHECK (category_type IN ('physical_products', 'digital_products', 'services', 'subscriptions', 'courses')),
    commission_rate DECIMAL(5,2) DEFAULT 0.00, -- Platform commission percentage
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    icon_url VARCHAR(500),
    banner_url VARCHAR(500),
    seo_keywords TEXT[],
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Marketplace Vendors/Sellers
CREATE TABLE marketplace_vendors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_name VARCHAR(255) NOT NULL,
    vendor_code VARCHAR(20) UNIQUE NOT NULL,
    vendor_type VARCHAR(30) NOT NULL CHECK (vendor_type IN ('school', 'teacher', 'company', 'individual', 'institution')),
    contact_person_id UUID REFERENCES users(id) ON DELETE SET NULL,
    business_name VARCHAR(255),
    business_registration_number VARCHAR(100),
    tax_identification_number VARCHAR(100),
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    website_url VARCHAR(500),
    description TEXT,
    address JSONB, -- Full address structure
    bank_account_details JSONB, -- Payment details
    verification_status VARCHAR(20) DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected', 'suspended')),
    verification_date TIMESTAMP,
    verification_documents JSONB, -- Document URLs and metadata
    rating DECIMAL(3,2) DEFAULT 0.00,
    total_reviews INTEGER DEFAULT 0,
    total_sales INTEGER DEFAULT 0,
    total_revenue DECIMAL(15,2) DEFAULT 0.00,
    commission_rate DECIMAL(5,2) DEFAULT 0.00, -- Custom commission rate if different from category
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended', 'banned')),
    featured_vendor BOOLEAN DEFAULT false,
    vendor_agreement_signed BOOLEAN DEFAULT false,
    vendor_agreement_date TIMESTAMP,
    logo_url VARCHAR(500),
    banner_url VARCHAR(500),
    social_media_links JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES users(id)
);

-- Marketplace Products/Services
CREATE TABLE marketplace_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES marketplace_vendors(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES marketplace_categories(id) ON DELETE RESTRICT,
    product_name VARCHAR(255) NOT NULL,
    product_code VARCHAR(50) UNIQUE NOT NULL,
    product_type VARCHAR(30) NOT NULL CHECK (product_type IN ('physical', 'digital', 'service', 'subscription', 'course')),
    short_description VARCHAR(500),
    full_description TEXT,
    specifications JSONB, -- Technical specs, features, etc.
    price DECIMAL(12,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'KES',
    discount_percentage DECIMAL(5,2) DEFAULT 0.00,
    discounted_price DECIMAL(12,2),
    cost_price DECIMAL(12,2), -- For profit margin calculation
    minimum_order_quantity INTEGER DEFAULT 1,
    maximum_order_quantity INTEGER,
    stock_quantity INTEGER DEFAULT 0,
    low_stock_threshold INTEGER DEFAULT 10,
    is_digital BOOLEAN DEFAULT false,
    digital_file_url VARCHAR(500), -- For digital products
    digital_file_size_mb DECIMAL(10,2),
    subscription_duration_months INTEGER, -- For subscription products
    trial_period_days INTEGER DEFAULT 0,
    weight_kg DECIMAL(8,2), -- For shipping calculation
    dimensions JSONB, -- length, width, height for shipping
    shipping_required BOOLEAN DEFAULT true,
    shipping_cost DECIMAL(10,2) DEFAULT 0.00,
    free_shipping_threshold DECIMAL(12,2),
    tags TEXT[], -- For search and filtering
    target_audience TEXT[], -- e.g., 'primary_school', 'secondary_school', 'teachers'
    age_group VARCHAR(50), -- Target age group
    curriculum_compatibility TEXT[], -- CBC, IGCSE, etc.
    grade_levels TEXT[], -- Applicable grade levels
    subjects TEXT[], -- Related subjects
    product_images JSONB, -- Array of image URLs with metadata
    product_videos JSONB, -- Product demonstration videos
    product_documents JSONB, -- Manuals, guides, etc.
    seo_keywords TEXT[],
    meta_description VARCHAR(160),
    featured_product BOOLEAN DEFAULT false,
    promotion_text VARCHAR(100),
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'inactive', 'out_of_stock', 'discontinued')),
    approval_status VARCHAR(20) DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
    approval_notes TEXT,
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMP,
    published_at TIMESTAMP,
    view_count INTEGER DEFAULT 0,
    like_count INTEGER DEFAULT 0,
    rating DECIMAL(3,2) DEFAULT 0.00,
    review_count INTEGER DEFAULT 0,
    sales_count INTEGER DEFAULT 0,
    revenue DECIMAL(15,2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Marketplace Orders
CREATE TABLE marketplace_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number VARCHAR(50) UNIQUE NOT NULL,
    customer_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    school_id UUID REFERENCES schools(id) ON DELETE SET NULL, -- If ordered by school
    vendor_id UUID NOT NULL REFERENCES marketplace_vendors(id) ON DELETE RESTRICT,
    order_type VARCHAR(20) DEFAULT 'purchase' CHECK (order_type IN ('purchase', 'subscription', 'rental', 'trial')),
    order_status VARCHAR(20) DEFAULT 'pending' CHECK (order_status IN ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'completed', 'cancelled', 'refunded')),
    payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'partial', 'failed', 'refunded')),
    shipping_status VARCHAR(20) DEFAULT 'not_shipped' CHECK (shipping_status IN ('not_shipped', 'preparing', 'shipped', 'in_transit', 'delivered', 'returned')),
    order_date TIMESTAMP DEFAULT NOW(),
    required_delivery_date DATE,
    estimated_delivery_date DATE,
    actual_delivery_date TIMESTAMP,
    subtotal DECIMAL(12,2) NOT NULL,
    discount_amount DECIMAL(12,2) DEFAULT 0.00,
    shipping_cost DECIMAL(10,2) DEFAULT 0.00,
    tax_amount DECIMAL(10,2) DEFAULT 0.00,
    platform_commission DECIMAL(10,2) DEFAULT 0.00,
    total_amount DECIMAL(12,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'KES',
    payment_method VARCHAR(30),
    payment_reference VARCHAR(100),
    payment_date TIMESTAMP,
    customer_notes TEXT,
    vendor_notes TEXT,
    admin_notes TEXT,
    shipping_address JSONB,
    billing_address JSONB,
    tracking_number VARCHAR(100),
    shipping_carrier VARCHAR(50),
    digital_delivery_method VARCHAR(30), -- email, download_link, etc.
    digital_access_granted BOOLEAN DEFAULT false,
    digital_access_expires TIMESTAMP,
    invoice_url VARCHAR(500),
    receipt_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Marketplace Order Items
CREATE TABLE marketplace_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES marketplace_orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES marketplace_products(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(12,2) NOT NULL,
    total_price DECIMAL(12,2) NOT NULL,
    product_name VARCHAR(255) NOT NULL, -- Snapshot at time of order
    product_description TEXT,
    product_specifications JSONB,
    discount_percentage DECIMAL(5,2) DEFAULT 0.00,
    discount_amount DECIMAL(12,2) DEFAULT 0.00,
    item_status VARCHAR(20) DEFAULT 'ordered' CHECK (item_status IN ('ordered', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned')),
    digital_license_key VARCHAR(255), -- For software/digital products
    digital_download_url VARCHAR(500),
    digital_download_expires TIMESTAMP,
    download_count INTEGER DEFAULT 0,
    max_downloads INTEGER DEFAULT -1, -- -1 for unlimited
    subscription_start_date DATE,
    subscription_end_date DATE,
    subscription_auto_renew BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Marketplace Reviews and Ratings
CREATE TABLE marketplace_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES marketplace_products(id) ON DELETE CASCADE,
    order_item_id UUID REFERENCES marketplace_order_items(id) ON DELETE SET NULL,
    reviewer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vendor_id UUID NOT NULL REFERENCES marketplace_vendors(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    review_title VARCHAR(255),
    review_text TEXT,
    pros TEXT,
    cons TEXT,
    would_recommend BOOLEAN,
    verified_purchase BOOLEAN DEFAULT false,
    helpful_votes INTEGER DEFAULT 0,
    unhelpful_votes INTEGER DEFAULT 0,
    vendor_response TEXT,
    vendor_response_date TIMESTAMP,
    is_featured BOOLEAN DEFAULT false,
    moderation_status VARCHAR(20) DEFAULT 'pending' CHECK (moderation_status IN ('pending', 'approved', 'rejected', 'hidden')),
    moderation_notes TEXT,
    moderated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    moderated_at TIMESTAMP,
    images JSONB, -- Review images
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Marketplace Wishlists
CREATE TABLE marketplace_wishlists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    wishlist_name VARCHAR(100) DEFAULT 'My Wishlist',
    is_public BOOLEAN DEFAULT false,
    is_default BOOLEAN DEFAULT true,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Marketplace Wishlist Items
CREATE TABLE marketplace_wishlist_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wishlist_id UUID NOT NULL REFERENCES marketplace_wishlists(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES marketplace_products(id) ON DELETE CASCADE,
    added_at TIMESTAMP DEFAULT NOW(),
    price_when_added DECIMAL(12,2),
    notes TEXT,
    UNIQUE(wishlist_id, product_id)
);

-- Marketplace Coupons and Discounts
CREATE TABLE marketplace_coupons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coupon_code VARCHAR(50) UNIQUE NOT NULL,
    coupon_name VARCHAR(255) NOT NULL,
    description TEXT,
    coupon_type VARCHAR(20) NOT NULL CHECK (coupon_type IN ('percentage', 'fixed_amount', 'free_shipping', 'buy_x_get_y')),
    discount_percentage DECIMAL(5,2),
    discount_amount DECIMAL(10,2),
    minimum_order_amount DECIMAL(12,2),
    maximum_discount_amount DECIMAL(10,2),
    applicable_to VARCHAR(20) DEFAULT 'all' CHECK (applicable_to IN ('all', 'category', 'vendor', 'product')),
    applicable_categories UUID[],
    applicable_vendors UUID[],
    applicable_products UUID[],
    user_restrictions VARCHAR(20) DEFAULT 'all' CHECK (user_restrictions IN ('all', 'new_users', 'existing_users', 'specific_users')),
    applicable_users UUID[],
    max_uses INTEGER DEFAULT -1, -- -1 for unlimited
    max_uses_per_user INTEGER DEFAULT 1,
    current_uses INTEGER DEFAULT 0,
    valid_from TIMESTAMP NOT NULL,
    valid_until TIMESTAMP NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Marketplace Coupon Usage Tracking
CREATE TABLE marketplace_coupon_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coupon_id UUID NOT NULL REFERENCES marketplace_coupons(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES marketplace_orders(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    discount_applied DECIMAL(10,2) NOT NULL,
    used_at TIMESTAMP DEFAULT NOW()
);

-- Marketplace Shopping Cart
CREATE TABLE marketplace_cart (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id VARCHAR(255), -- For guest users
    product_id UUID NOT NULL REFERENCES marketplace_products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price DECIMAL(12,2) NOT NULL,
    added_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, product_id)
);

-- Marketplace Analytics
CREATE TABLE marketplace_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    analytics_type VARCHAR(30) NOT NULL CHECK (analytics_type IN ('product', 'vendor', 'category', 'overall', 'customer')),
    entity_id UUID, -- Product, vendor, or category ID
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    page_views INTEGER DEFAULT 0,
    unique_visitors INTEGER DEFAULT 0,
    product_views INTEGER DEFAULT 0,
    add_to_cart INTEGER DEFAULT 0,
    purchases INTEGER DEFAULT 0,
    revenue DECIMAL(15,2) DEFAULT 0.00,
    commission_earned DECIMAL(15,2) DEFAULT 0.00,
    average_order_value DECIMAL(12,2) DEFAULT 0.00,
    conversion_rate DECIMAL(5,2) DEFAULT 0.00,
    cart_abandonment_rate DECIMAL(5,2) DEFAULT 0.00,
    return_rate DECIMAL(5,2) DEFAULT 0.00,
    customer_satisfaction DECIMAL(3,2) DEFAULT 0.00,
    top_selling_products JSONB,
    detailed_metrics JSONB,
    generated_at TIMESTAMP DEFAULT NOW()
);

-- Marketplace Payments
CREATE TABLE marketplace_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES marketplace_orders(id) ON DELETE CASCADE,
    payment_method VARCHAR(30) NOT NULL,
    payment_provider VARCHAR(50), -- M-Pesa, Stripe, PayPal, etc.
    payment_amount DECIMAL(12,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'KES',
    payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded')),
    transaction_id VARCHAR(255) UNIQUE,
    external_transaction_id VARCHAR(255), -- Provider transaction ID
    payment_date TIMESTAMP,
    failure_reason TEXT,
    refund_amount DECIMAL(12,2) DEFAULT 0.00,
    refund_date TIMESTAMP,
    refund_reason TEXT,
    platform_fee DECIMAL(10,2) DEFAULT 0.00,
    vendor_payout DECIMAL(12,2) DEFAULT 0.00,
    payout_status VARCHAR(20) DEFAULT 'pending' CHECK (payout_status IN ('pending', 'processing', 'paid', 'failed', 'cancelled')),
    payout_date TIMESTAMP,
    payout_reference VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_marketplace_categories_parent ON marketplace_categories(parent_category_id);
CREATE INDEX idx_marketplace_categories_type ON marketplace_categories(category_type);
CREATE INDEX idx_marketplace_categories_active ON marketplace_categories(is_active) WHERE is_active = true;

CREATE INDEX idx_marketplace_vendors_type ON marketplace_vendors(vendor_type);
CREATE INDEX idx_marketplace_vendors_status ON marketplace_vendors(status);
CREATE INDEX idx_marketplace_vendors_verification ON marketplace_vendors(verification_status);
CREATE INDEX idx_marketplace_vendors_featured ON marketplace_vendors(featured_vendor) WHERE featured_vendor = true;
CREATE INDEX idx_marketplace_vendors_contact ON marketplace_vendors(contact_person_id);

CREATE INDEX idx_marketplace_products_vendor ON marketplace_products(vendor_id);
CREATE INDEX idx_marketplace_products_category ON marketplace_products(category_id);
CREATE INDEX idx_marketplace_products_type ON marketplace_products(product_type);
CREATE INDEX idx_marketplace_products_status ON marketplace_products(status);
CREATE INDEX idx_marketplace_products_approval ON marketplace_products(approval_status);
CREATE INDEX idx_marketplace_products_featured ON marketplace_products(featured_product) WHERE featured_product = true;
CREATE INDEX idx_marketplace_products_price ON marketplace_products(price);
CREATE INDEX idx_marketplace_products_rating ON marketplace_products(rating DESC);
CREATE INDEX idx_marketplace_products_published ON marketplace_products(published_at DESC);
CREATE INDEX idx_marketplace_products_search ON marketplace_products USING gin(to_tsvector('english', product_name || ' ' || COALESCE(short_description, '')));

CREATE INDEX idx_marketplace_orders_customer ON marketplace_orders(customer_id);
CREATE INDEX idx_marketplace_orders_vendor ON marketplace_orders(vendor_id);
CREATE INDEX idx_marketplace_orders_school ON marketplace_orders(school_id);
CREATE INDEX idx_marketplace_orders_status ON marketplace_orders(order_status);
CREATE INDEX idx_marketplace_orders_payment_status ON marketplace_orders(payment_status);
CREATE INDEX idx_marketplace_orders_date ON marketplace_orders(order_date DESC);
CREATE INDEX idx_marketplace_orders_number ON marketplace_orders(order_number);

CREATE INDEX idx_marketplace_order_items_order ON marketplace_order_items(order_id);
CREATE INDEX idx_marketplace_order_items_product ON marketplace_order_items(product_id);

CREATE INDEX idx_marketplace_reviews_product ON marketplace_reviews(product_id);
CREATE INDEX idx_marketplace_reviews_reviewer ON marketplace_reviews(reviewer_id);
CREATE INDEX idx_marketplace_reviews_vendor ON marketplace_reviews(vendor_id);
CREATE INDEX idx_marketplace_reviews_rating ON marketplace_reviews(rating);
CREATE INDEX idx_marketplace_reviews_moderation ON marketplace_reviews(moderation_status);

CREATE INDEX idx_marketplace_wishlists_user ON marketplace_wishlists(user_id);
CREATE INDEX idx_marketplace_wishlist_items_wishlist ON marketplace_wishlist_items(wishlist_id);
CREATE INDEX idx_marketplace_wishlist_items_product ON marketplace_wishlist_items(product_id);

CREATE INDEX idx_marketplace_coupons_code ON marketplace_coupons(coupon_code);
CREATE INDEX idx_marketplace_coupons_active ON marketplace_coupons(is_active) WHERE is_active = true;
CREATE INDEX idx_marketplace_coupons_validity ON marketplace_coupons(valid_from, valid_until);

CREATE INDEX idx_marketplace_cart_user ON marketplace_cart(user_id);
CREATE INDEX idx_marketplace_cart_session ON marketplace_cart(session_id);
CREATE INDEX idx_marketplace_cart_product ON marketplace_cart(product_id);

CREATE INDEX idx_marketplace_analytics_type ON marketplace_analytics(analytics_type);
CREATE INDEX idx_marketplace_analytics_entity ON marketplace_analytics(entity_id);
CREATE INDEX idx_marketplace_analytics_period ON marketplace_analytics(period_start, period_end);

CREATE INDEX idx_marketplace_payments_order ON marketplace_payments(order_id);
CREATE INDEX idx_marketplace_payments_status ON marketplace_payments(payment_status);
CREATE INDEX idx_marketplace_payments_date ON marketplace_payments(payment_date DESC);

-- RLS Policies for marketplace tables (assuming multi-tenant setup)
-- Note: Marketplace might have different access patterns, so policies should be carefully designed

-- Most marketplace data should be visible across schools for discovery, but orders/carts should be private
ALTER TABLE marketplace_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY marketplace_categories_view_all ON marketplace_categories FOR SELECT USING (true);

ALTER TABLE marketplace_vendors ENABLE ROW LEVEL SECURITY;
CREATE POLICY marketplace_vendors_view_all ON marketplace_vendors FOR SELECT USING (true);
CREATE POLICY marketplace_vendors_manage_own ON marketplace_vendors 
    FOR ALL USING (contact_person_id = current_setting('app.current_user_id')::UUID OR current_setting('app.current_user_role') IN ('super_admin', 'edufam_admin'));

ALTER TABLE marketplace_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY marketplace_products_view_all ON marketplace_products FOR SELECT USING (status = 'active' AND approval_status = 'approved');
CREATE POLICY marketplace_products_manage_own ON marketplace_products 
    FOR ALL USING (vendor_id IN (SELECT id FROM marketplace_vendors WHERE contact_person_id = current_setting('app.current_user_id')::UUID) OR current_setting('app.current_user_role') IN ('super_admin', 'edufam_admin'));

ALTER TABLE marketplace_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY marketplace_orders_customer_access ON marketplace_orders 
    FOR ALL USING (customer_id = current_setting('app.current_user_id')::UUID);
CREATE POLICY marketplace_orders_vendor_access ON marketplace_orders 
    FOR SELECT USING (vendor_id IN (SELECT id FROM marketplace_vendors WHERE contact_person_id = current_setting('app.current_user_id')::UUID));
CREATE POLICY marketplace_orders_admin_access ON marketplace_orders 
    FOR ALL USING (current_setting('app.current_user_role') IN ('super_admin', 'edufam_admin'));

ALTER TABLE marketplace_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY marketplace_order_items_access ON marketplace_order_items 
    FOR ALL USING (order_id IN (SELECT id FROM marketplace_orders));

ALTER TABLE marketplace_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY marketplace_reviews_view_approved ON marketplace_reviews FOR SELECT USING (moderation_status = 'approved');
CREATE POLICY marketplace_reviews_manage_own ON marketplace_reviews 
    FOR ALL USING (reviewer_id = current_setting('app.current_user_id')::UUID OR current_setting('app.current_user_role') IN ('super_admin', 'edufam_admin'));

ALTER TABLE marketplace_wishlists ENABLE ROW LEVEL SECURITY;
CREATE POLICY marketplace_wishlists_own_access ON marketplace_wishlists 
    FOR ALL USING (user_id = current_setting('app.current_user_id')::UUID);

ALTER TABLE marketplace_wishlist_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY marketplace_wishlist_items_access ON marketplace_wishlist_items 
    FOR ALL USING (wishlist_id IN (SELECT id FROM marketplace_wishlists WHERE user_id = current_setting('app.current_user_id')::UUID));

ALTER TABLE marketplace_cart ENABLE ROW LEVEL SECURITY;
CREATE POLICY marketplace_cart_own_access ON marketplace_cart 
    FOR ALL USING (user_id = current_setting('app.current_user_id')::UUID);

ALTER TABLE marketplace_coupons ENABLE ROW LEVEL SECURITY;
CREATE POLICY marketplace_coupons_view_active ON marketplace_coupons FOR SELECT USING (is_active = true);
CREATE POLICY marketplace_coupons_admin_manage ON marketplace_coupons 
    FOR ALL USING (current_setting('app.current_user_role') IN ('super_admin', 'edufam_admin'));

ALTER TABLE marketplace_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY marketplace_payments_order_access ON marketplace_payments 
    FOR ALL USING (order_id IN (SELECT id FROM marketplace_orders));

-- Initial marketplace data
INSERT INTO marketplace_categories (category_name, category_code, category_type, description, commission_rate) VALUES
('Educational Books', 'EDU_BOOKS', 'physical_products', 'Textbooks, workbooks, and educational literature', 5.00),
('Digital Learning Resources', 'DIGITAL_EDU', 'digital_products', 'Software, apps, and digital learning materials', 10.00),
('School Supplies', 'SUPPLIES', 'physical_products', 'Stationery, equipment, and classroom materials', 7.50),
('Professional Development', 'PROF_DEV', 'services', 'Training, workshops, and consultation services', 15.00),
('Educational Technology', 'EDU_TECH', 'physical_products', 'Hardware, devices, and educational technology', 8.00),
('Online Courses', 'COURSES', 'courses', 'Structured learning programs and certifications', 20.00),
('School Uniforms', 'UNIFORMS', 'physical_products', 'School uniforms and accessories', 5.00),
('Laboratory Equipment', 'LAB_EQUIP', 'physical_products', 'Science lab equipment and materials', 10.00)
ON CONFLICT (category_code) DO NOTHING;