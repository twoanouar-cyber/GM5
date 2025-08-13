// وظيفة لتحديث الربح للفواتير الموجودة مسبقاً
// تشغيل هذا الملف مرة واحدة لتحديث الربح للفواتير القديمة

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// إنشاء اتصال قاعدة البيانات
const dbPath = path.join(__dirname, '../../data/gym.db');
const db = new sqlite3.Database(dbPath);

async function updateExistingProfits() {
  try {
    console.log('بدء تحديث الربح للفواتير الموجودة...');
    
    // الحصول على جميع الفواتير بدون ربح
    const invoices = await new Promise((resolve, reject) => {
      db.all(`
        SELECT i.*, ii.*, p.purchase_price
        FROM invoices i
        JOIN invoice_items ii ON i.id = ii.invoice_id
        JOIN products p ON ii.product_id = p.id
        WHERE i.profit = 0 OR i.profit IS NULL
        ORDER BY i.id
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    console.log(`تم العثور على ${invoices.length} فاتورة تحتاج تحديث`);

    // تجميع الفواتير حسب ID
    const invoiceMap = new Map();
    invoices.forEach(item => {
      if (!invoiceMap.has(item.id)) {
        invoiceMap.set(item.id, {
          id: item.id,
          subtotal: item.subtotal,
          total: item.total,
          items: []
        });
      }
      invoiceMap.get(item.id).items.push({
        total_price: item.total_price,
        quantity: item.quantity,
        purchase_price: item.purchase_price
      });
    });

    // تحديث الربح لكل فاتورة
    for (const [invoiceId, invoice] of invoiceMap) {
      let totalProfit = 0;
      
      for (const item of invoice.items) {
        // حساب الربح لهذا العنصر بعد الخصم
        const itemProfit = (item.total_price * (invoice.total / invoice.subtotal)) - (item.quantity * item.purchase_price);
        totalProfit += itemProfit;
      }

      // تحديث الربح في قاعدة البيانات
      await new Promise((resolve, reject) => {
        db.run(`
          UPDATE invoices 
          SET profit = ? 
          WHERE id = ?
        `, [totalProfit, invoiceId], function(err) {
          if (err) reject(err);
          else resolve();
        });
      });

      console.log(`تم تحديث الفاتورة ${invoiceId} - الربح: ${totalProfit}`);
    }

    console.log('تم تحديث جميع الفواتير بنجاح!');
  } catch (error) {
    console.error('خطأ في تحديث الربح:', error);
  } finally {
    db.close();
  }
}

// تشغيل التحديث
updateExistingProfits(); 