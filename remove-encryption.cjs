const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

// فتح قاعدة البيانات
const dbPath = path.join(__dirname, 'data/gym.db');
const db = new sqlite3.Database(dbPath);

async function resetPasswords() {
  try {
    console.log('🔄 بدء إعادة تعيين كلمات المرور...');
    
    // تشفير كلمة المرور الافتراضية
    const hashedPassword = await bcrypt.hash('admin123', 10);
    console.log('🔐 تم تشفير كلمة المرور الجديدة');
    
    // تحديث كلمات المرور لجميع المستخدمين
    db.run(`UPDATE users SET password_hash = ? WHERE username IN ('admin_male', 'admin_female')`, [hashedPassword], function(err) {
      if (err) {
        console.error('❌ خطأ في تحديث كلمات المرور:', err);
      } else {
        console.log(`✅ تم تحديث ${this.changes} كلمة مرور بنجاح`);
      }
      
      // استعلام للتحقق من التحديث
      db.all(`SELECT id, username, full_name FROM users`, [], (err, rows) => {
        if (err) {
          console.error('❌ خطأ في استعلام المستخدمين:', err);
        } else {
          console.log('📋 المستخدمون المحدثون:');
          rows.forEach(user => {
            console.log(`   - ${user.username}: ${user.full_name}`);
          });
          console.log('\n🎉 تم إعادة تعيين كلمات المرور بنجاح!');
          console.log('🔑 كلمة المرور الجديدة لجميع الحسابات: admin123');
        }
        
        // إغلاق قاعدة البيانات
        db.close();
      });
    });
  } catch (error) {
    console.error('❌ خطأ عام:', error);
    db.close();
  }
}

// تشغيل إعادة التعيين
resetPasswords();