const { contextBridge, ipcRenderer } = require('electron');

// تعريف API متوافق مع واجهة TypeScript الخاصة بك
contextBridge.exposeInMainWorld('electronAPI', {
  // عمليات قاعدة البيانات
  query: (sql, params) => ipcRenderer.invoke('database-query', sql, params),
  run: (sql, params) => ipcRenderer.invoke('database-run', sql, params),

  // المصادقة
  login: (username, password) => ipcRenderer.invoke('login', username, password),

  // إدارة المستخدمين
  createUser: (userData) => ipcRenderer.invoke('create-user', userData),
  updateUser: (userId, userData) => ipcRenderer.invoke('update-user', userId, userData),

  // إدارة قاعدة البيانات
  backupDatabase: () => ipcRenderer.invoke('backup-database'),
  restoreDatabase: () => ipcRenderer.invoke('restore-database'),
  repairDatabase: () => ipcRenderer.invoke('repair-database'),

  // تصحيح الأخطاء (Debug)
  debugUsers: () => ipcRenderer.invoke('debug-users'),
  debugPasswords: () => ipcRenderer.invoke('debug-passwords'),
  debugLogin: (username, password) => ipcRenderer.invoke('debug-login', username, password),

  // معلومات النظام
  platform: process.platform,
  appVersion: () => ipcRenderer.invoke('app-version'),

  // التحكم في النافذة
  minimize: () => ipcRenderer.invoke('window-minimize'),
  maximize: () => ipcRenderer.invoke('window-maximize'),
  close: () => ipcRenderer.invoke('window-close'),
  closeApp: () => ipcRenderer.invoke('window-close'),

  // مربعات الحوار (Dialogs)
  showMessage: (options) => ipcRenderer.invoke('show-message', options),
  showError: (title, message) => ipcRenderer.invoke('show-error', title, message),

  // التعديل المهم: showConfirm ترجع Promise<{ response: number }>
  showConfirm: (options) => ipcRenderer.invoke('show-confirm', options)
});
