/// <reference types="vite/client" />

interface Window {
  electronAPI: {
    query: (sql: string, params?: any[]) => Promise<any[]>;
    run: (sql: string, params?: any[]) => Promise<any>;
    login: (username: string, password: string) => Promise<{
      success: boolean;
      user?: {
        id: number;
        username: string;
        full_name: string;
        role: string;
        gym_id: number;
        gym_name: string;
        gym_type: 'male' | 'female';
      };
      message?: string;
    }>;
    createUser: (userData: {
      username: string;
      password: string;
      full_name: string;
      role: string;
      gym_id: number;
      is_active: boolean;
    }) => Promise<{
      success: boolean;
      result?: any;
      message?: string;
      error?: string;
    }>;
    updateUser: (userId: number, userData: {
      username: string;
      password?: string;
      full_name: string;
      role: string;
      gym_id: number;
      is_active: boolean;
    }) => Promise<{
      success: boolean;
      result?: any;
      message?: string;
      error?: string;
    }>;
    // Database management
    backupDatabase: () => Promise<{ success: boolean; path?: string; error?: string; }>;
    backupDatabaseEnhanced: (options?: {
      customPath?: string;
      uploadToDrive?: boolean;
      driveCredentials?: any;
    }) => Promise<{ success: boolean; path?: string; driveFileId?: string; error?: string; }>;
    chooseBackupPath: () => Promise<{ success?: boolean; filePath?: string; canceled?: boolean; error?: string; }>;
    setupAutoBackup: (schedule: string, driveCredentials?: any) => Promise<{ success: boolean; error?: string; }>;
    googleDriveAuth: () => Promise<{ success: boolean; authUrl?: string; error?: string; }>;
    restoreDatabase: () => Promise<{ success: boolean; needRestart?: boolean; canceled?: boolean; error?: string; }>;
    repairDatabase: () => Promise<{ success: boolean; error?: string; }>;
    // Debug
    debugUsers: () => Promise<{
      users?: any[];
      gyms?: any[];
      error?: string;
    }>;
    debugPasswords: () => Promise<{
      users?: any[];
      error?: string;
    }>;
    debugLogin: (username: string, password: string) => Promise<{
      success: boolean;
      user?: any;
      message?: string;
      error?: string;
    }>;
    // System info
    platform: string;
    appVersion: () => Promise<string>;
    // Window controls
    minimize: () => Promise<void>;
    maximize: () => Promise<void>;
    close: () => Promise<void>;
    closeApp: () => Promise<void>;
    // Dialog
    showMessage: (options: { title: string; message: string; }) => Promise<void>;
    showError: (title: string, message: string) => Promise<void>;
    showConfirm: (options: {
    title: string;
    message: string;
    detail?: string;
    buttons: string[];
    defaultId?: number;
    cancelId?: number;
  }) => Promise<{ response: number }>;
  };
}
