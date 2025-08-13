const { app, BrowserWindow, Menu, ipcMain, dialog, shell, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const { DatabaseService } = require('./database.cjs');

let mainWindow;
let isDev;

// تأكد من وجود مجلد البيانات
const ensureDataDirectory = () => {
  let dataDir;
  if (app.isPackaged) {
    // في التطبيق المثبت، استخدم مجلد userData
    dataDir = path.join(app.getPath('userData'), 'data');
  } else {
    // في التطوير، استخدم مجلد data في المشروع
    dataDir = path.join(__dirname, '../data');
  }
  
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  return dataDir;
};

// تأكد من وجود مجلد النسخ الاحتياطية
const ensureBackupDirectory = () => {
  const backupDir = path.join(app.getPath('userData'), 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  return backupDir;
};

// إعداد قاعدة البيانات للتطبيق المثبت
const setupDatabase = () => {
  if (app.isPackaged) {
    const dataDir = ensureDataDirectory();
    const dbPath = path.join(dataDir, 'gym.db');
    
    // إذا لم تكن قاعدة البيانات موجودة، أنشئها
    if (!fs.existsSync(dbPath)) {
      console.log('Creating new database for packaged app...');
      // سيتم إنشاء قاعدة البيانات تلقائياً عند أول استخدام
    }
  }
};

function createWindow() {
  isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  
  // تأكد من وجود المجلدات الضرورية
  ensureDataDirectory();
  ensureBackupDirectory();
  
  // إعداد قاعدة البيانات
  setupDatabase();
  
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.cjs'),
      spellcheck: true
    },
    icon: path.join(__dirname, '../public/icon.png'),
    titleBarStyle: 'default',
    show: false,
    autoHideMenuBar: false,
    backgroundColor: '#f8f9fa'
  });

  const startUrl = isDev 
    ? 'http://localhost:5173' 
    : `file://${path.join(__dirname, '../dist/index.html')}`;

  mainWindow.loadURL(startUrl);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
    
    // تأكد من تهيئة قاعدة البيانات
    setTimeout(() => {
      console.log('Database should be initialized now');
    }, 1000);
  });

  // منع فتح الروابط الخارجية في التطبيق
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }
  
  // التعامل مع إغلاق النافذة
  mainWindow.on('close', (e) => {
    if (process.platform !== 'darwin') {
      const choice = dialog.showMessageBoxSync(mainWindow, {
        type: 'question',
        buttons: ['نعم', 'لا'],
        title: 'تأكيد الخروج',
        message: 'هل أنت متأكد من رغبتك في إغلاق التطبيق؟',
        defaultId: 1,
        cancelId: 1
      });
      
      if (choice === 1) {
        e.preventDefault();
      }
    }
  });

  // Set Arabic RTL menu
  const template = [
    {
      label: 'GYM DADA',
      submenu: [
        {
          label: 'حول التطبيق',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'حول التطبيق',
              message: 'GYM DADA',
              detail: 'الإصدار: 1.0.0\nتصميم وتطوير : ANOUAR KEHILI\nجميع الحقوق محفوظة © 2025',
              buttons: ['موافق']
            });
          }
        },
        {
          type: 'separator'
        },
        {
          label: 'إخفاء التطبيق',
          accelerator: process.platform === 'darwin' ? 'Command+H' : 'Ctrl+H',
          role: 'hide'
        },
        {
          label: 'إخفاء الآخرين',
          accelerator: process.platform === 'darwin' ? 'Command+Shift+H' : 'Ctrl+Shift+H',
          role: 'hideothers'
        },
        {
          label: 'إظهار الكل',
          role: 'unhide'
        },
        {
          type: 'separator'
        },
        {
          label: 'إنهاء',
          accelerator: process.platform === 'darwin' ? 'Command+Q' : 'Ctrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'ملف',
      submenu: [
        {
          label: 'نسخ احتياطي لقاعدة البيانات',
          click: async () => {
            try {
              const backupDir = ensureBackupDirectory();
              const date = new Date().toISOString().replace(/[:.]/g, '-');
              const backupPath = path.join(backupDir, `gym-backup-${date}.db`);
              
              const result = await DatabaseService.backup(backupPath);
              
              dialog.showMessageBox(mainWindow, {
                type: 'info',
                title: 'نسخ احتياطي',
                message: 'تم إنشاء نسخة احتياطية بنجاح',
                detail: `تم حفظ النسخة الاحتياطية في: ${backupPath}`,
                buttons: ['موافق']
              });
            } catch (error) {
              console.error('Backup error:', error);
              dialog.showErrorBox('خطأ في النسخ الاحتياطي', error.message);
            }
          }
        },
        {
          label: 'استعادة من نسخة احتياطية',
          click: async () => {
            try {
              const backupDir = ensureBackupDirectory();
              
              const { filePaths } = await dialog.showOpenDialog(mainWindow, {
                title: 'اختر ملف النسخة الاحتياطية',
                defaultPath: backupDir,
                filters: [{ name: 'قاعدة بيانات SQLite', extensions: ['db'] }],
                properties: ['openFile']
              });
              
              if (filePaths && filePaths.length > 0) {
                await DatabaseService.restore(filePaths[0]);
                
                dialog.showMessageBox(mainWindow, {
                  type: 'info',
                  title: 'استعادة النسخة الاحتياطية',
                  message: 'تم استعادة النسخة الاحتياطية بنجاح',
                  detail: 'يرجى إعادة تشغيل التطبيق لتطبيق التغييرات',
                  buttons: ['إعادة تشغيل الآن', 'لاحقاً'],
                }).then(({ response }) => {
                  if (response === 0) {
                    app.relaunch();
                    app.exit();
                  }
                });
              }
            } catch (error) {
              console.error('Restore error:', error);
              dialog.showErrorBox('خطأ في استعادة النسخة الاحتياطية', error.message);
            }
          }
        }
      ]
    },
    {
      label: 'عرض',
      submenu: [
        {
          label: 'تحديث',
          click: () => {
            mainWindow.reload();
          }
        },
        {
          label: 'تكبير',
          accelerator: 'Ctrl+Plus',
          role: 'zoomIn'
        },
        {
          label: 'تصغير',
          accelerator: 'Ctrl+-',
          role: 'zoomOut'
        },
        {
          label: 'الحجم الافتراضي',
          accelerator: 'Ctrl+0',
          role: 'resetZoom'
        },
        {
          type: 'separator'
        },
        {
          label: 'أدوات المطور',
          accelerator: 'F12',
          click: () => {
            mainWindow.webContents.toggleDevTools();
          }
        }
      ]
    },
    {
      label: 'مساعدة',
      submenu: [
        {
          label: 'دليل المستخدم',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'دليل المستخدم',
              message: 'نظام إدارة الصالة الرياضية',
              detail: 'لمزيد من المعلومات حول استخدام النظام، يرجى الاتصال بالدعم الفني.',
              buttons: ['موافق']
            });
          }
        },
        {
          label: 'حول التطبيق',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'حول التطبيق',
              message: 'GYM DADA',
              detail: 'الإصدار 1.0.0\nجميع الحقوق محفوظة © 2025',
              buttons: ['موافق']
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);

  // Register a global shortcut for F11 to toggle fullscreen
  globalShortcut.register('F11', () => {
    if (mainWindow.isFullScreen()) {
      mainWindow.setFullScreen(false);
    } else {
      mainWindow.setFullScreen(true);
    }
  });

  // Register a global shortcut for F5 to reload the window
  globalShortcut.register('F5', () => {
    mainWindow.reload();
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC handlers for database operations
ipcMain.handle('database-query', async (event, query, params) => {
  try {
    const result = await DatabaseService.query(query, params);
    return result;
  } catch (error) {
    console.error('Database query error:', error);
    return { error: error.message };
  }
});

ipcMain.handle('database-run', async (event, query, params) => {
  try {
    const result = await DatabaseService.run(query, params);
    return result;
  } catch (error) {
    console.error('Database run error:', error);
    return { error: error.message };
  }
});

// IPC handlers for database management
ipcMain.handle('backup-database', async () => {
  try {
    const backupDir = ensureBackupDirectory();
    const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
    const backupPath = path.join(backupDir, `gym-backup-${timestamp}.db`);
    
    const result = await DatabaseService.backup(backupPath);
    return { success: true, path: result };
  } catch (error) {
    console.error('Database backup error:', error);
    return { error: error.message };
  }
});

ipcMain.handle('restore-database', async () => {
  try {
    const backupDir = ensureBackupDirectory();
    const result = await dialog.showOpenDialog({
      title: 'استعادة قاعدة البيانات',
      defaultPath: backupDir,
      filters: [{ name: 'ملفات قاعدة البيانات', extensions: ['db'] }],
      properties: ['openFile']
    });
    
    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true };
    }
    
    const backupPath = result.filePaths[0];
    await DatabaseService.restore(backupPath);
    
    return { success: true, needRestart: true };
  } catch (error) {
    console.error('Database restore error:', error);
    return { error: error.message };
  }
});

ipcMain.handle('repair-database', async () => {
  try {
    await DatabaseService.repair();
    return { success: true };
  } catch (error) {
    console.error('Database repair error:', error);
    return { error: error.message };
  }
});

// Login handler
ipcMain.handle('login', async (event, username, password) => {
  try {
    // الاستعلام في سطر واحد لتجنب مشاكل الأحرف المخفية
    const query = 'SELECT u.*, g.name as gym_name, g.type as gym_type FROM users u JOIN gyms g ON u.gym_id = g.id WHERE u.username = ? AND u.is_active = 1';
    const users = await DatabaseService.query(query, [username]);

    if (users.length === 0) {
      return { success: false, message: 'اسم المستخدم أو كلمة المرور غير صحيحة.' };
    }

    const userData = users[0];
    const isValidPassword = await bcrypt.compare(password, userData.password_hash);
    
    if (!isValidPassword) {
      return { success: false, message: 'اسم المستخدم أو كلمة المرور غير صحيحة.' };
    }

    // إزالة الهاش من البيانات قبل إرسالها إلى الواجهة
    delete userData.password_hash;
    
    return { success: true, user: userData };
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, message: 'حدث خطأ أثناء تسجيل الدخول.' };
  }
});

// Window control handlers
ipcMain.handle('window-minimize', () => {
  if (mainWindow) {
    mainWindow.minimize();
  }
  return true;
});

ipcMain.handle('window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
  return mainWindow.isMaximized();
});

ipcMain.handle('window-close', () => {
  if (mainWindow) {
    mainWindow.close();
  }
  return true;
});

// IPC handlers for dialogs
ipcMain.handle('show-message', async (event, options) => {
  const response = await dialog.showMessageBox(mainWindow, {
    type: options.type || 'info',
    title: options.title || 'رسالة',
    message: options.message || '',
    detail: options.detail || '',
    buttons: options.buttons || ['موافق'],
    defaultId: options.defaultId || 0,
    cancelId: options.cancelId || 0
  });
  return response;
});

ipcMain.handle('show-error', async (event, title, message) => {
  const response = await dialog.showMessageBox(mainWindow, {
    type: 'error',
    title: title || 'خطأ',
    message: message || 'حدث خطأ غير متوقع',
    buttons: ['موافق']
  });
  return response;
});

ipcMain.handle('show-confirm', async (event, options) => {
  const response = await dialog.showMessageBox(mainWindow, {
    type: 'question',
    title: options.title || 'تأكيد',
    message: options.message || 'هل أنت متأكد؟',
    detail: options.detail || '',
    buttons: options.buttons || ['نعم', 'لا'],
    defaultId: options.defaultId || 0,
    cancelId: options.cancelId || 1
  });
  return response;
});

// IPC handler for app version
ipcMain.handle('app-version', () => {
  return app.getVersion();
});

// Debug handler to check database content
ipcMain.handle('debug-users', async () => {
  try {
    const users = await DatabaseService.query('SELECT * FROM users');
    const gyms = await DatabaseService.query('SELECT * FROM gyms');
    return { users, gyms };
  } catch (error) {
    console.error('Debug error:', error);
    return { error: error.message };
  }
});

// Debug handler to check password hashes
ipcMain.handle('debug-passwords', async () => {
  try {
    const users = await DatabaseService.query('SELECT username, password_hash FROM users');
    return { users };
  } catch (error) {
    console.error('Debug passwords error:', error);
    return { error: error.message };
  }
});

// Debug handler to test login directly
ipcMain.handle('debug-login', async (event, username, password) => {
  try {
    console.log('Testing login for:', username, password);
    
    const query = 'SELECT u.*, g.name as gym_name, g.type as gym_type FROM users u JOIN gyms g ON u.gym_id = g.id WHERE u.username = ? AND u.is_active = 1';
    const users = await DatabaseService.query(query, [username]);
    console.log('Found users:', users);

    if (users.length === 0) {
      return { success: false, message: 'User not found' };
    }

    const userData = users[0];
    console.log('User data:', userData);
    
    const isValidPassword = await bcrypt.compare(password, userData.password_hash);
    console.log('Password valid:', isValidPassword);
    
    if (!isValidPassword) {
      return { success: false, message: 'Invalid password' };
    }

    const userSession = {
      id: userData.id,
      username: userData.username,
      full_name: userData.full_name,
      role: userData.role,
      gym_id: userData.gym_id,
      gym_name: userData.gym_name,
      gym_type: userData.gym_type
    };

    return { success: true, user: userSession };
  } catch (error) {
    console.error('Debug login error:', error);
    return { success: false, message: 'Login failed', error: error.message };
  }
});

// User management handlers
ipcMain.handle('create-user', async (event, userData) => {
  try {
    const hashedPassword = await bcrypt.hash(userData.password, 10);
    
    const result = await DatabaseService.run(`
      INSERT INTO users (username, password_hash, full_name, role, gym_id, is_active)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      userData.username,
      hashedPassword,
      userData.full_name,
      userData.role,
      userData.gym_id,
      userData.is_active
    ]);
    
    return { success: true, result };
  } catch (error) {
    console.error('Create user error:', error);
    return { success: false, message: 'Failed to create user', error: error.message };
  }
});

ipcMain.handle('update-user', async (event, userId, userData) => {
  try {
    let result;
    if (userData.password) {
      // Update with new password
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      result = await DatabaseService.run(`
        UPDATE users
        SET username = ?, password_hash = ?, full_name = ?, role = ?,
            gym_id = ?, is_active = ?
        WHERE id = ?
      `, [
        userData.username,
        hashedPassword,
        userData.full_name,
        userData.role,
        userData.gym_id,
        userData.is_active,
        userId
      ]);
    } else {
      // Update without changing password
      result = await DatabaseService.run(`
        UPDATE users
        SET username = ?, full_name = ?, role = ?, gym_id = ?, is_active = ?
        WHERE id = ?
      `, [
        userData.username,
        userData.full_name,
        userData.role,
        userData.gym_id,
        userData.is_active,
        userId
      ]);
    }
    
    return { success: true, result };
  } catch (error) {
    console.error('Update user error:', error);
    return { success: false, message: 'Failed to update user', error: error.message };
  }
});

// إغلاق قاعدة البيانات عند إغلاق التطبيق
app.on('will-quit', () => {
  DatabaseService.close();
});
