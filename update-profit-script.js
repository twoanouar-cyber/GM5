// ملف لتحديث الربح للفواتير الموجودة
// تشغيل هذا الملف من خلال التطبيق

const { app, BrowserWindow } = require('electron');
const path = require('path');

// إنشاء نافذة مخفية للتطبيق
function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    show: false, // إخفاء النافذة
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // تحميل التطبيق
  win.loadFile('index.html');

  // تشغيل تحديث الربح بعد تحميل التطبيق
  win.webContents.on('did-finish-load', async () => {
    try {
      console.log('بدء تحديث الربح للفواتير الموجودة...');
      
      // الحصول على جميع الفواتير بدون ربح
      const invoices = await win.webContents.executeJavaScript(`
        window.electronAPI.query(\`
          SELECT i.*, ii.*, p.purchase_price
          FROM invoices i
          JOIN invoice_items ii ON i.id = ii.invoice_id
          JOIN products p ON ii.product_id = p.id
          WHERE i.profit = 0 OR i.profit IS NULL
          ORDER BY i.id
        \`)
      `);

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
        await win.webContents.executeJavaScript(`
          window.electronAPI.run(\`
            UPDATE invoices 
            SET profit = ? 
            WHERE id = ?
          \`, [${totalProfit}, ${invoiceId}])
        `);

        console.log(`تم تحديث الفاتورة ${invoiceId} - الربح: ${totalProfit}`);
      }

      console.log('تم تحديث جميع الفواتير بنجاح!');
      app.quit();
    } catch (error) {
      console.error('خطأ في تحديث الربح:', error);
      app.quit();
    }
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
}); 