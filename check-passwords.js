const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

(async () => {
  try {
    const db = await open({
      filename: 'data/gym.db',
      driver: sqlite3.Database
    });
    
    const users = await db.all('SELECT id, username, password_hash FROM users');
    console.log('Users:', users);
    
    const testPassword = 'admin123';
    for (const user of users) {
      const isValid = await bcrypt.compare(testPassword, user.password_hash);
      console.log(`User ${user.username} password verification: ${isValid}`);
    }
    
    await db.close();
  } catch (err) {
    console.error('Error:', err);
  }
})();