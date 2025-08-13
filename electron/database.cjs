const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

class DatabaseService {
  constructor() {
      let dbPath;
      const { app } = require('electron'); // يجب استيرادها هنا لتكون متاحة
      if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
        dbPath = path.join(__dirname, '../data/gym.db');
      } else {
        dbPath = path.join(app.getPath('userData'), 'data', 'gym.db');
      }
    
    // Ensure data directory exists
    const dataDir = path.dirname(dbPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    console.log('Database path:', dbPath);
    
    this.db = new sqlite3.Database(dbPath);
    this.db.serialize(() => {
    this.initializeTables();
    this.seedInitialData();
    });
  }

  initializeTables() {
    // Gyms table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS gyms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type TEXT CHECK(type IN ('male', 'female')) NOT NULL,
        logo TEXT,
        settings TEXT DEFAULT '{}',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Users table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        full_name TEXT NOT NULL,
        role TEXT DEFAULT 'admin',
        gym_id INTEGER,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (gym_id) REFERENCES gyms (id)
      )
    `);

    // Categories table (shared)
    this.db.run(`
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Products table (shared inventory)
    this.db.run(`
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        barcode TEXT UNIQUE,
        name TEXT NOT NULL,
        category_id INTEGER,
        purchase_price DECIMAL(10,2) DEFAULT 0,
        sale_price DECIMAL(10,2) DEFAULT 0,
        male_gym_quantity INTEGER DEFAULT 0,
        female_gym_quantity INTEGER DEFAULT 0,
        image_path TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES categories (id)
      )
    `);

    // Subscription types table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS subscription_types (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type TEXT CHECK(type IN ('monthly', 'session')) NOT NULL,
        duration_months INTEGER,
        session_count INTEGER,
        price DECIMAL(10,2) NOT NULL,
        gym_id INTEGER,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (gym_id) REFERENCES gyms (id)
      )
    `);

    // Subscribers table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS subscribers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        full_name TEXT NOT NULL,
        phone TEXT,
        subscription_type_id INTEGER,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        price_paid DECIMAL(10,2) NOT NULL,
        remaining_sessions INTEGER,
        status TEXT DEFAULT 'active',
        gym_id INTEGER,
        created_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (subscription_type_id) REFERENCES subscription_types (id),
        FOREIGN KEY (gym_id) REFERENCES gyms (id),
        FOREIGN KEY (created_by) REFERENCES users (id)
      )
    `);

    // Add created_by column if it doesn't exist
    this.db.run(`
      ALTER TABLE subscribers ADD COLUMN created_by INTEGER
    `, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('Error adding created_by column to subscribers:', err);
      }
    });

    // Invoices table (sales)
    this.db.run(`
      CREATE TABLE IF NOT EXISTS invoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_number TEXT UNIQUE NOT NULL,
        customer_name TEXT,
        customer_phone TEXT,
        subtotal DECIMAL(10,2) NOT NULL,
        discount DECIMAL(10,2) DEFAULT 0,
        total DECIMAL(10,2) NOT NULL,
        paid_amount DECIMAL(10,2) DEFAULT 0,
        is_credit BOOLEAN DEFAULT 0,
        is_single_session BOOLEAN DEFAULT 0,
        gym_id INTEGER,
        user_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (gym_id) REFERENCES gyms (id),
        FOREIGN KEY (user_id) REFERENCES users (id)
      )
    `);

    // Add profit column to invoices if it doesn't exist
    this.db.run(`
      ALTER TABLE invoices ADD COLUMN profit DECIMAL(10,2) DEFAULT 0
    `, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('Error adding profit column to invoices:', err);
      }
    });

    // Invoice items table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS invoice_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_id INTEGER,
        product_id INTEGER,
        quantity INTEGER NOT NULL,
        unit_price DECIMAL(10,2) NOT NULL,
        total_price DECIMAL(10,2) NOT NULL,
        FOREIGN KEY (invoice_id) REFERENCES invoices (id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products (id)
      )
    `);

    // Purchases table (inventory purchases)
    this.db.run(`
      CREATE TABLE IF NOT EXISTS purchases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        supplier_name TEXT,
        total_amount DECIMAL(10,2) NOT NULL,
        gym_id INTEGER,
        user_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (gym_id) REFERENCES gyms (id),
        FOREIGN KEY (user_id) REFERENCES users (id)
      )
    `);

    // Purchase items table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS purchase_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        purchase_id INTEGER,
        product_id INTEGER,
        quantity INTEGER NOT NULL,
        unit_cost DECIMAL(10,2) NOT NULL,
        total_cost DECIMAL(10,2) NOT NULL,
        FOREIGN KEY (purchase_id) REFERENCES purchases (id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products (id)
      )
    `);

    // Internal sales table (white list)
    this.db.run(`
      CREATE TABLE IF NOT EXISTS internal_sales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        admin_name TEXT NOT NULL,
        product_id INTEGER,
        quantity INTEGER NOT NULL,
        price_type TEXT CHECK(price_type IN ('purchase', 'manual')) NOT NULL,
        unit_price DECIMAL(10,2) NOT NULL,
        total_price DECIMAL(10,2) NOT NULL,
        gym_id INTEGER,
        user_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products (id),
        FOREIGN KEY (gym_id) REFERENCES gyms (id),
        FOREIGN KEY (user_id) REFERENCES users (id)
      )
    `);

    // Add profit column to internal_sales if it doesn't exist
    this.db.run(`
      ALTER TABLE internal_sales ADD COLUMN profit DECIMAL(10,2) DEFAULT 0
    `, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('Error adding profit column to internal_sales:', err);
      }
    });

    // Create indexes for better performance
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_subscribers_gym_status ON subscribers(gym_id, status)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_invoices_gym_date ON invoices(gym_id, created_at)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_purchases_gym_date ON purchases(gym_id, created_at)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_internal_sales_gym_date ON internal_sales(gym_id, created_at)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_subscription_types_gym ON subscription_types(gym_id, is_active)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_subscribers_end_date ON subscribers(end_date, status)`);

    // Customers table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        email TEXT,
        address TEXT,
        gym_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (gym_id) REFERENCES gyms (id)
      )
    `);

    // Add customer_id to invoices table if it doesn't exist
    this.db.run(`
      ALTER TABLE invoices ADD COLUMN customer_id INTEGER
    `, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('Error adding customer_id column to invoices:', err);
      }
    });

    // Add foreign key index
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_customers_gym ON customers(gym_id)`);
  }

async seedInitialData() {
  console.log("🔄 بدء فحص البيانات الافتراضية...");

  // دالة مساعدة لتحويل db.run إلى Promise
  const runAsync = (sql, params = []) => {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve(this.lastID); // this.lastID متاح فقط في دوال function عادية، وليس arrow
      });
    });
  };

  // دالة مساعدة لتحويل db.get إلى Promise
  const getAsync = (sql, params = []) => {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  };

  try {
    const row = await getAsync('SELECT COUNT(*) as count FROM gyms');
    console.log(`📊 عدد الصالات الحالي: ${row.count}`);

    if (row.count === 0) {
      console.log("➕ لا توجد صالات، سيتم إنشاء البيانات الافتراضية...");

      // إنشاء نادي الرجال
      const maleGymId = await runAsync(
        `INSERT INTO gyms (name, type, settings) VALUES (?, ?, ?)`,
        ['فرع الرجال', 'male', '{}']
      );
      console.log(`✅ تم إنشاء نادي الرجال (ID: ${maleGymId})`);

      // إنشاء نادي السيدات
      const femaleGymId = await runAsync(
        `INSERT INTO gyms (name, type, settings) VALUES (?, ?, ?)`,
        ['فرع النساء', 'female', '{}']
      );
      console.log(`✅ تم إنشاء نادي السيدات (ID: ${femaleGymId})`);

      // تشفير كلمة المرور
      const hashedPassword = await bcrypt.hash('admin123', 10);
      console.log("🔐 كلمة المرور الافتراضية مشفرة بنجاح");

      // إنشاء حساب مدير نادي الرجال
      await runAsync(
        `INSERT INTO users (username, password_hash, full_name, gym_id) VALUES (?, ?, ?, ?)`,
        ['admin_male', hashedPassword, 'مدير نادي الرجال', maleGymId]
      );
      console.log("✅ تم إنشاء مدير نادي الرجال");

      // إنشاء حساب مديرة نادي السيدات
      await runAsync(
        `INSERT INTO users (username, password_hash, full_name, gym_id) VALUES (?, ?, ?, ?)`,
        ['admin_female', hashedPassword, 'مديرة نادي السيدات', femaleGymId]
      );
      console.log("✅ تم إنشاء مديرة نادي السيدات");

      // إنشاء الفئات
      const categories = [
        ['مكملات غذائية', 'البروتين والفيتامينات'],
        ['معدات رياضية', 'أدوات التمرين والملابس'],
        ['مشروبات', 'مشروبات الطاقة والماء'],
        ['وجبات خفيفة', 'وجبات صحية خفيفة'],
      ];

      for (const [name, desc] of categories) {
        await runAsync(
          `INSERT INTO categories (name, description) VALUES (?, ?)`,
          [name, desc]
        );
        console.log(`✅ تمت إضافة الفئة: ${name}`);
      }

      // إنشاء الاشتراكات الافتراضية
      const subs = [
        ['اشتراك شهري', 'monthly', 1, null, 3000, maleGymId],
        ['اشتراك ثلاثة أشهر', 'monthly', 3, null, 8000, maleGymId],
        ['15 جلسة', 'session', 3, 15, 4500, maleGymId],
        ['اشتراك شهري', 'monthly', 1, null, 2500, femaleGymId],
        ['اشتراك ثلاثة أشهر', 'monthly', 3, null, 7000, femaleGymId],
        ['12 جلسة', 'session', 3, 12, 3600, femaleGymId],
      ];

      for (const [name, type, months, sessions, price, gymId] of subs) {
        await runAsync(
          `INSERT INTO subscription_types (name, type, duration_months, session_count, price, gym_id)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [name, type, months, sessions, price, gymId]
        );
        console.log(`✅ تمت إضافة الاشتراك: ${name} (Gym ID: ${gymId})`);
      }

    } else {
      console.log("ℹ️ توجد بيانات بالفعل، لن يتم إنشاء بيانات جديدة.");
    }
  } catch (err) {
    console.error("❌ خطأ أثناء تهيئة البيانات الافتراضية:", err);
  }
}



  query(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          console.error('Database query error:', err);
          reject(err);
        } else {
          resolve(rows);
    }
      });
    });
  }

  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) {
          console.error('Database run error:', err);
          reject(err);
        } else {
          resolve({ lastInsertRowid: this.lastID, changes: this.changes });
    }
      });
    });
  }

close() {
    if (this.db) {
      this.db.close();
      this.db = null; 
    }
  }

  // وظيفة النسخ الاحتياطي لقاعدة البيانات
  backup(backupPath) {
    return new Promise((resolve, reject) => {
      const fs = require('fs');
      const path = require('path');
      
      // تأكد من وجود المجلد
      const backupDir = path.dirname(backupPath);
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }
      
      try {
        // الحصول على مسار قاعدة البيانات الحالية
        let currentDbPath;
        const { app } = require('electron');
        
        if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
          currentDbPath = path.join(__dirname, '../data/gym.db');
        } else {
          currentDbPath = path.join(app.getPath('userData'), 'data', 'gym.db');
        }
        
        // نسخ الملف مباشرة
        fs.copyFileSync(currentDbPath, backupPath);
        
        console.log(`Backup created successfully: ${backupPath}`);
        resolve(backupPath);
      } catch (error) {
        console.error('Backup error:', error);
        reject(error);
      }
    });
  }

  // وظيفة استعادة قاعدة البيانات من نسخة احتياطية
  restore(backupPath) {
    return new Promise((resolve, reject) => {
      const fs = require('fs');
      const path = require('path');
      
      if (!fs.existsSync(backupPath)) {
        reject(new Error('ملف النسخة الاحتياطية غير موجود'));
        return;
      }
      
      try {
        // الحصول على مسار قاعدة البيانات الحالية
        let dbPath;
        const { app } = require('electron');
        
        if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
          dbPath = path.join(__dirname, '../data/gym.db');
        } else {
          dbPath = path.join(app.getPath('userData'), 'data', 'gym.db');
        }
        
        // إغلاق الاتصال الحالي مؤقتاً
        if (this.db) {
          this.db.close();
        }
        
        // نسخ ملف النسخة الاحتياطية إلى مسار قاعدة البيانات
        fs.copyFileSync(backupPath, dbPath);
        
        // إعادة فتح الاتصال بقاعدة البيانات
        this.db = new sqlite3.Database(dbPath);
        
        console.log(`Database restored successfully from: ${backupPath}`);
        resolve(true);
      } catch (error) {
        console.error('Restore error:', error);
        reject(error);
      }
    });
  }

  // وظيفة لإصلاح قاعدة البيانات
  repair() {
    return new Promise((resolve, reject) => {
      try {
        // تشغيل عمليات الإصلاح والتحسين
        this.db.run('VACUUM');
        this.db.run('PRAGMA integrity_check');
        this.db.run('PRAGMA optimize');
        resolve(true);
      } catch (error) {
        reject(error);
      }
    });
  }
}

module.exports = { DatabaseService: new DatabaseService() };