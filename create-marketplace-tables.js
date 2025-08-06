const { Pool } = require('pg');

/**
 * Create Marketplace Management Tables Directly
 */

async function createMarketplaceTables() {
  console.log('🚀 Creating Marketplace Management Tables');
  console.log('=========================================');

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/edufam_db'
  });

  try {
    console.log('🔌 Testing database connection...');
    const client = await pool.connect();
    console.log('✅ Database connection successful');
    client.release();

    // Create tables one by one
    console.log('\n📄 Creating marketplace tables...');

    // 1. Marketplace Categories
    await pool.query(`
      CREATE TABLE IF NOT EXISTS marketplace_categories (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        category_name VARCHAR(100) UNIQUE NOT NULL,
        category_code VARCHAR(20) UNIQUE NOT NULL,
        parent_category_id UUID REFERENCES marketplace_categories(id) ON DELETE SET NULL,
        description TEXT,
        category_type VARCHAR(30) NOT NULL CHECK (category_type IN ('physical_products', 'digital_products', 'services', 'subscriptions', 'courses')),
        commission_rate DECIMAL(5,2) DEFAULT 0.00,
        is_active BOOLEAN DEFAULT true,
        display_order INTEGER DEFAULT 0,
        icon_url VARCHAR(500),
        banner_url VARCHAR(500),
        seo_keywords TEXT[],
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('   ✅ marketplace_categories table created');

    // 2. Marketplace Vendors
    await pool.query(`
      CREATE TABLE IF NOT EXISTS marketplace_vendors (
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
        address JSONB,
        bank_account_details JSONB,
        verification_status VARCHAR(20) DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected', 'suspended')),
        verification_date TIMESTAMP,
        verification_documents JSONB,
        rating DECIMAL(3,2) DEFAULT 0.00,
        total_reviews INTEGER DEFAULT 0,
        total_sales INTEGER DEFAULT 0,
        total_revenue DECIMAL(15,2) DEFAULT 0.00,
        commission_rate DECIMAL(5,2) DEFAULT 0.00,
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
      )
    `);
    console.log('   ✅ marketplace_vendors table created');

    // 3. Marketplace Products
    await pool.query(`
      CREATE TABLE IF NOT EXISTS marketplace_products (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        vendor_id UUID NOT NULL REFERENCES marketplace_vendors(id) ON DELETE CASCADE,
        category_id UUID NOT NULL REFERENCES marketplace_categories(id) ON DELETE RESTRICT,
        product_name VARCHAR(255) NOT NULL,
        product_code VARCHAR(50) UNIQUE NOT NULL,
        product_type VARCHAR(30) NOT NULL CHECK (product_type IN ('physical', 'digital', 'service', 'subscription', 'course')),
        short_description VARCHAR(500),
        full_description TEXT,
        specifications JSONB,
        price DECIMAL(12,2) NOT NULL,
        currency VARCHAR(3) DEFAULT 'KES',
        discount_percentage DECIMAL(5,2) DEFAULT 0.00,
        discounted_price DECIMAL(12,2),
        cost_price DECIMAL(12,2),
        minimum_order_quantity INTEGER DEFAULT 1,
        maximum_order_quantity INTEGER,
        stock_quantity INTEGER DEFAULT 0,
        low_stock_threshold INTEGER DEFAULT 10,
        is_digital BOOLEAN DEFAULT false,
        digital_file_url VARCHAR(500),
        digital_file_size_mb DECIMAL(10,2),
        subscription_duration_months INTEGER,
        trial_period_days INTEGER DEFAULT 0,
        weight_kg DECIMAL(8,2),
        dimensions JSONB,
        shipping_required BOOLEAN DEFAULT true,
        shipping_cost DECIMAL(10,2) DEFAULT 0.00,
        free_shipping_threshold DECIMAL(12,2),
        tags TEXT[],
        target_audience TEXT[],
        age_group VARCHAR(50),
        curriculum_compatibility TEXT[],
        grade_levels TEXT[],
        subjects TEXT[],
        product_images JSONB,
        product_videos JSONB,
        product_documents JSONB,
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
      )
    `);
    console.log('   ✅ marketplace_products table created');

    // 4. Marketplace Orders
    await pool.query(`
      CREATE TABLE IF NOT EXISTS marketplace_orders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_number VARCHAR(50) UNIQUE NOT NULL,
        customer_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
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
        digital_delivery_method VARCHAR(30),
        digital_access_granted BOOLEAN DEFAULT false,
        digital_access_expires TIMESTAMP,
        invoice_url VARCHAR(500),
        receipt_url VARCHAR(500),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('   ✅ marketplace_orders table created');

    // 5. Marketplace Order Items
    await pool.query(`
      CREATE TABLE IF NOT EXISTS marketplace_order_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id UUID NOT NULL REFERENCES marketplace_orders(id) ON DELETE CASCADE,
        product_id UUID NOT NULL REFERENCES marketplace_products(id) ON DELETE RESTRICT,
        quantity INTEGER NOT NULL,
        unit_price DECIMAL(12,2) NOT NULL,
        total_price DECIMAL(12,2) NOT NULL,
        product_name VARCHAR(255) NOT NULL,
        product_description TEXT,
        product_specifications JSONB,
        discount_percentage DECIMAL(5,2) DEFAULT 0.00,
        discount_amount DECIMAL(12,2) DEFAULT 0.00,
        item_status VARCHAR(20) DEFAULT 'ordered' CHECK (item_status IN ('ordered', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned')),
        digital_license_key VARCHAR(255),
        digital_download_url VARCHAR(500),
        digital_download_expires TIMESTAMP,
        download_count INTEGER DEFAULT 0,
        max_downloads INTEGER DEFAULT -1,
        subscription_start_date DATE,
        subscription_end_date DATE,
        subscription_auto_renew BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('   ✅ marketplace_order_items table created');

    // 6. Marketplace Reviews
    await pool.query(`
      CREATE TABLE IF NOT EXISTS marketplace_reviews (
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
        images JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('   ✅ marketplace_reviews table created');

    // 7. Marketplace Wishlists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS marketplace_wishlists (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        wishlist_name VARCHAR(100) DEFAULT 'My Wishlist',
        is_public BOOLEAN DEFAULT false,
        is_default BOOLEAN DEFAULT true,
        description TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('   ✅ marketplace_wishlists table created');

    // 8. Marketplace Wishlist Items
    await pool.query(`
      CREATE TABLE IF NOT EXISTS marketplace_wishlist_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        wishlist_id UUID NOT NULL REFERENCES marketplace_wishlists(id) ON DELETE CASCADE,
        product_id UUID NOT NULL REFERENCES marketplace_products(id) ON DELETE CASCADE,
        added_at TIMESTAMP DEFAULT NOW(),
        price_when_added DECIMAL(12,2),
        notes TEXT,
        UNIQUE(wishlist_id, product_id)
      )
    `);
    console.log('   ✅ marketplace_wishlist_items table created');

    // 9. Marketplace Shopping Cart
    await pool.query(`
      CREATE TABLE IF NOT EXISTS marketplace_cart (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        session_id VARCHAR(255),
        product_id UUID NOT NULL REFERENCES marketplace_products(id) ON DELETE CASCADE,
        quantity INTEGER NOT NULL DEFAULT 1,
        unit_price DECIMAL(12,2) NOT NULL,
        added_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, product_id)
      )
    `);
    console.log('   ✅ marketplace_cart table created');

    // 10. Marketplace Coupons
    await pool.query(`
      CREATE TABLE IF NOT EXISTS marketplace_coupons (
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
        max_uses INTEGER DEFAULT -1,
        max_uses_per_user INTEGER DEFAULT 1,
        current_uses INTEGER DEFAULT 0,
        valid_from TIMESTAMP NOT NULL,
        valid_until TIMESTAMP NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_by UUID NOT NULL REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('   ✅ marketplace_coupons table created');

    // Create indexes
    console.log('\n📄 Creating indexes...');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_marketplace_categories_parent ON marketplace_categories(parent_category_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_marketplace_categories_type ON marketplace_categories(category_type)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_marketplace_categories_active ON marketplace_categories(is_active) WHERE is_active = true');

    await pool.query('CREATE INDEX IF NOT EXISTS idx_marketplace_vendors_type ON marketplace_vendors(vendor_type)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_marketplace_vendors_status ON marketplace_vendors(status)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_marketplace_vendors_verification ON marketplace_vendors(verification_status)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_marketplace_vendors_featured ON marketplace_vendors(featured_vendor) WHERE featured_vendor = true');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_marketplace_vendors_contact ON marketplace_vendors(contact_person_id)');

    await pool.query('CREATE INDEX IF NOT EXISTS idx_marketplace_products_vendor ON marketplace_products(vendor_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_marketplace_products_category ON marketplace_products(category_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_marketplace_products_type ON marketplace_products(product_type)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_marketplace_products_status ON marketplace_products(status)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_marketplace_products_approval ON marketplace_products(approval_status)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_marketplace_products_featured ON marketplace_products(featured_product) WHERE featured_product = true');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_marketplace_products_price ON marketplace_products(price)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_marketplace_products_rating ON marketplace_products(rating DESC)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_marketplace_products_published ON marketplace_products(published_at DESC)');

    await pool.query('CREATE INDEX IF NOT EXISTS idx_marketplace_orders_customer ON marketplace_orders(customer_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_marketplace_orders_vendor ON marketplace_orders(vendor_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_marketplace_orders_school ON marketplace_orders(school_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_marketplace_orders_status ON marketplace_orders(order_status)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_marketplace_orders_payment_status ON marketplace_orders(payment_status)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_marketplace_orders_date ON marketplace_orders(order_date DESC)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_marketplace_orders_number ON marketplace_orders(order_number)');

    await pool.query('CREATE INDEX IF NOT EXISTS idx_marketplace_order_items_order ON marketplace_order_items(order_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_marketplace_order_items_product ON marketplace_order_items(product_id)');

    await pool.query('CREATE INDEX IF NOT EXISTS idx_marketplace_reviews_product ON marketplace_reviews(product_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_marketplace_reviews_reviewer ON marketplace_reviews(reviewer_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_marketplace_reviews_vendor ON marketplace_reviews(vendor_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_marketplace_reviews_rating ON marketplace_reviews(rating)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_marketplace_reviews_moderation ON marketplace_reviews(moderation_status)');

    await pool.query('CREATE INDEX IF NOT EXISTS idx_marketplace_wishlists_user ON marketplace_wishlists(user_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_marketplace_wishlist_items_wishlist ON marketplace_wishlist_items(wishlist_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_marketplace_wishlist_items_product ON marketplace_wishlist_items(product_id)');

    await pool.query('CREATE INDEX IF NOT EXISTS idx_marketplace_cart_user ON marketplace_cart(user_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_marketplace_cart_product ON marketplace_cart(product_id)');

    await pool.query('CREATE INDEX IF NOT EXISTS idx_marketplace_coupons_code ON marketplace_coupons(coupon_code)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_marketplace_coupons_active ON marketplace_coupons(is_active) WHERE is_active = true');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_marketplace_coupons_validity ON marketplace_coupons(valid_from, valid_until)');
    console.log('   ✅ Indexes created');

    // Insert initial data
    console.log('\n📄 Inserting initial marketplace data...');
    
    const superAdminResult = await pool.query("SELECT id FROM users WHERE role = 'super_admin' LIMIT 1");
    const createdById = superAdminResult.rows[0]?.id;

    if (createdById) {
      // Insert marketplace categories
      await pool.query(`
        INSERT INTO marketplace_categories (category_name, category_code, category_type, description, commission_rate) VALUES
        ('Educational Books', 'EDU_BOOKS', 'physical_products', 'Textbooks, workbooks, and educational literature', 5.00),
        ('Digital Learning Resources', 'DIGITAL_EDU', 'digital_products', 'Software, apps, and digital learning materials', 10.00),
        ('School Supplies', 'SUPPLIES', 'physical_products', 'Stationery, equipment, and classroom materials', 7.50),
        ('Professional Development', 'PROF_DEV', 'services', 'Training, workshops, and consultation services', 15.00),
        ('Educational Technology', 'EDU_TECH', 'physical_products', 'Hardware, devices, and educational technology', 8.00),
        ('Online Courses', 'COURSES', 'courses', 'Structured learning programs and certifications', 20.00),
        ('School Uniforms', 'UNIFORMS', 'physical_products', 'School uniforms and accessories', 5.00),
        ('Laboratory Equipment', 'LAB_EQUIP', 'physical_products', 'Science lab equipment and materials', 10.00)
        ON CONFLICT (category_code) DO NOTHING
      `);

      // Insert sample vendor
      await pool.query(`
        INSERT INTO marketplace_vendors (
          vendor_name, vendor_code, vendor_type, contact_person_id, business_name,
          email, phone, description, verification_status, status, created_by
        ) VALUES (
          'Edufam Educational Supplies', 'EES001', 'company', $1, 'Edufam Educational Supplies Ltd',
          'vendor@edufam.com', '+254700000000', 'Leading provider of educational materials and resources',
          'verified', 'active', $1
        ) ON CONFLICT (vendor_code) DO NOTHING
      `, [createdById]);

      console.log('   ✅ Initial marketplace data inserted');
    } else {
      console.log('   ⚠️  No super admin found, skipping data insertion');
    }

    // Validate tables
    console.log('\n🔍 Validating tables...');
    const validation = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name LIKE 'marketplace_%'
      ORDER BY table_name
    `);

    console.log('📋 Created Marketplace Tables:');
    validation.rows.forEach(row => {
      console.log(`   ✅ ${row.table_name}`);
    });

    // Get counts
    console.log('\n📊 Table Statistics:');
    for (const table of validation.rows) {
      try {
        const countResult = await pool.query(`SELECT COUNT(*) FROM ${table.table_name}`);
        console.log(`   📝 ${table.table_name}: ${countResult.rows[0].count} records`);
      } catch (error) {
        console.log(`   ❌ ${table.table_name}: Error getting count`);
      }
    }

    console.log('\n🎉 Marketplace Management Tables Created Successfully!');
    console.log('\n🛒 Ready for E-Commerce Features:');
    console.log('   • Multi-Vendor Product Catalog');
    console.log('   • Educational Resource Marketplace');
    console.log('   • Shopping Cart & Order Management');
    console.log('   • Review & Rating System');
    console.log('   • Wishlist & Favorites');
    console.log('   • Coupon & Discount Management');
    console.log('   • Vendor Management & Verification');
    console.log('   • Search & Discovery Engine');
    console.log('   • Analytics & Reporting');
    console.log('   • Public Catalog for Website');

    console.log('\n📚 Sample Categories Created:');
    console.log('   • Educational Books (EDU_BOOKS)');
    console.log('   • Digital Learning Resources (DIGITAL_EDU)');
    console.log('   • School Supplies (SUPPLIES)');
    console.log('   • Professional Development (PROF_DEV)');
    console.log('   • Educational Technology (EDU_TECH)');
    console.log('   • Online Courses (COURSES)');

  } catch (error) {
    console.error('❌ Error creating marketplace tables:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
    console.log('\n🔒 Database connection closed');
  }
}

// Load environment variables
require('dotenv').config();

// Run the creation
createMarketplaceTables();