import React, { useState } from 'react';
import { Database, Settings as SettingsIcon, Save, RefreshCw, AlertTriangle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const Settings: React.FC = () => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [appVersion, setAppVersion] = useState<string>('');

  // الحصول على إصدار التطبيق عند تحميل المكون
  React.useEffect(() => {
    const getAppVersion = async () => {
      try {
        const version = await window.electronAPI.appVersion();
        setAppVersion(version);
      } catch (error) {
        console.error('فشل في الحصول على إصدار التطبيق:', error);
      }
    };

    getAppVersion();
  }, []);

  // وظيفة النسخ الاحتياطي لقاعدة البيانات
  const handleBackupDatabase = async () => {
    try {
      setIsLoading(true);
      setMessage(null);

      const result = await window.electronAPI.backupDatabase();
      
      if (result.error) {
        setMessage({ type: 'error', text: `فشل النسخ الاحتياطي: ${result.error}` });
      } else {
        setMessage({ 
          type: 'success', 
          text: `تم إنشاء نسخة احتياطية بنجاح في: ${result.path}` 
        });
      }
    } catch (error) {
      setMessage({ type: 'error', text: `حدث خطأ غير متوقع: ${error.message}` });
    } finally {
      setIsLoading(false);
    }
  };

  // وظيفة استعادة قاعدة البيانات
  const handleRestoreDatabase = async () => {
    try {
      // تأكيد قبل الاستعادة
      const confirmResult = await window.electronAPI.showConfirm({
        title: 'استعادة قاعدة البيانات',
        message: 'هل أنت متأكد من استعادة قاعدة البيانات من نسخة احتياطية؟',
        detail: 'سيتم استبدال جميع البيانات الحالية بالبيانات من النسخة الاحتياطية. هذا الإجراء لا يمكن التراجع عنه.',
        buttons: ['استعادة', 'إلغاء'],
        defaultId: 1,
        cancelId: 1
      });

      if (confirmResult.response === 1) {
        return; // تم الإلغاء
      }

      setIsLoading(true);
      setMessage(null);

      const result = await window.electronAPI.restoreDatabase();
      
      if (result.canceled) {
        setMessage(null);
        return;
      }
      
      if (result.error) {
        setMessage({ type: 'error', text: `فشل استعادة قاعدة البيانات: ${result.error}` });
      } else if (result.success) {
        setMessage({ type: 'success', text: 'تم استعادة قاعدة البيانات بنجاح' });
        
        if (result.needRestart) {
          // إظهار رسالة تأكيد لإعادة تشغيل التطبيق
          const restartResult = await window.electronAPI.showConfirm({
            title: 'إعادة تشغيل التطبيق',
            message: 'يجب إعادة تشغيل التطبيق لتطبيق التغييرات',
            detail: 'هل تريد إعادة تشغيل التطبيق الآن؟',
            buttons: ['إعادة تشغيل', 'لاحقاً'],
            defaultId: 0
          });
          
          if (restartResult.response === 0) {
            window.electronAPI.close(); // إغلاق التطبيق لإعادة تشغيله
          }
        }
      }
    } catch (error) {
      setMessage({ type: 'error', text: `حدث خطأ غير متوقع: ${error.message}` });
    } finally {
      setIsLoading(false);
    }
  };

  // وظيفة إصلاح قاعدة البيانات
  const handleRepairDatabase = async () => {
    try {
      // تأكيد قبل الإصلاح
      const confirmResult = await window.electronAPI.showConfirm({
        title: 'إصلاح قاعدة البيانات',
        message: 'هل تريد إصلاح وتحسين أداء قاعدة البيانات؟',
        detail: 'سيقوم هذا الإجراء بإصلاح وتحسين أداء قاعدة البيانات. قد يستغرق بعض الوقت.',
        buttons: ['إصلاح', 'إلغاء'],
        defaultId: 1,
        cancelId: 1
      });

      if (confirmResult.response === 1) {
        return; // تم الإلغاء
      }

      setIsLoading(true);
      setMessage(null);

      const result = await window.electronAPI.repairDatabase();
      
      if (result.error) {
        setMessage({ type: 'error', text: `فشل إصلاح قاعدة البيانات: ${result.error}` });
      } else {
        setMessage({ type: 'success', text: 'تم إصلاح وتحسين قاعدة البيانات بنجاح' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: `حدث خطأ غير متوقع: ${error.message}` });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6 flex items-center">
        <SettingsIcon className="ml-2" size={24} />
        الإعدادات
      </h1>

      {message && (
        <div className={`p-4 mb-6 rounded-md ${
          message.type === 'success' ? 'bg-green-100 text-green-800' :
          message.type === 'error' ? 'bg-red-100 text-red-800' :
          'bg-blue-100 text-blue-800'
        }`}>
          {message.text}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center">
          <Database className="ml-2" size={20} />
          إدارة قاعدة البيانات
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={handleBackupDatabase}
            disabled={isLoading}
            className="flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md transition-colors disabled:bg-gray-400"
          >
            <Save className="ml-2" size={18} />
            إنشاء نسخة احتياطية
          </button>
          
          <button
            onClick={handleRestoreDatabase}
            disabled={isLoading}
            className="flex items-center justify-center bg-amber-600 hover:bg-amber-700 text-white py-2 px-4 rounded-md transition-colors disabled:bg-gray-400"
          >
            <RefreshCw className="ml-2" size={18} />
            استعادة من نسخة احتياطية
          </button>
          
          <button
            onClick={handleRepairDatabase}
            disabled={isLoading}
            className="flex items-center justify-center bg-purple-600 hover:bg-purple-700 text-white py-2 px-4 rounded-md transition-colors disabled:bg-gray-400"
          >
            <AlertTriangle className="ml-2" size={18} />
            إصلاح وتحسين قاعدة البيانات
          </button>
        </div>
        
        <div className="mt-4 text-sm text-gray-600">
          <p>يُنصح بإنشاء نسخة احتياطية بشكل دوري للحفاظ على بياناتك.</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4">معلومات النظام</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-gray-600">إصدار التطبيق:</p>
            <p className="font-medium">{appVersion || 'غير معروف'}</p>
          </div>
          
          <div>
            <p className="text-gray-600">نظام التشغيل:</p>
            <p className="font-medium">
              {window.electronAPI.platform === 'win32' ? 'Windows' :
               window.electronAPI.platform === 'darwin' ? 'macOS' :
               window.electronAPI.platform === 'linux' ? 'Linux' :
               window.electronAPI.platform}
            </p>
          </div>
        </div>
        
        <div className="mt-6">
          <p className="text-gray-600">المستخدم الحالي:</p>
          <p className="font-medium">{user?.fullName || 'غير معروف'}</p>
        </div>
        
        <div className="mt-6 text-center text-sm text-gray-500">
          <p>© {new Date().getFullYear()} نظام إدارة الصالة الرياضية. جميع الحقوق محفوظة.</p>
        </div>
      </div>
    </div>
  );
};

export default Settings;