const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// فتح قاعدة البيانات
const dbPath = path.join(__dirname, 'data/gym.db');
const db = new sqlite3.Database(dbPath);

// تحديث كلمات المرور لجميع المستخدمين بكلمة مرور بسيطة غير مشفرة
db.run(`UPDATE users SET password_hash = ? WHERE username IN ('admin_male', 'admin_female')`, ['admin123'], function(err) {
  if (err) {
    console.error('Error updating passwords:', err);
  } else {
    console.log(`Updated ${this.changes} user passwords to plain text 'admin123'`);
  }
  
  // استعلام للتحقق من التحديث
  db.all(`SELECT id, username, password_hash FROM users`, [], (err, rows) => {
    if (err) {
      console.error('Error querying users:', err);
    } else {
      console.log('Updated users:');
      console.log(rows);
    }
    
    // إغلاق قاعدة البيانات
    db.close();
  });
});