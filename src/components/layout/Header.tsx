import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useGym } from '../../contexts/GymContext';
import { LogOut, User, Calendar } from 'lucide-react';

const Header: React.FC = () => {
  const { user, logout } = useAuth();
  const { gymName, gymType } = useGym();

  const getCurrentDate = () => {
    const now = new Date();
    return now.toLocaleDateString('ar-DZ', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        {/* Gym Name and Date */}
        <div className="flex items-center space-x-reverse space-x-6">
          <div>
            <h1 className="text-xl font-bold text-gray-800 arabic-text">
              {gymName}
            </h1>
            <div className="flex items-center text-sm text-gray-600 mt-1">
              <Calendar className="w-4 h-4 ml-2" />
              <span className="arabic-text">{getCurrentDate()}</span>
            </div>
          </div>
        </div>

        {/* User Info and Actions */}
        <div className="flex items-center space-x-reverse space-x-4">
          <div className="flex items-center space-x-reverse space-x-3">
            <div className="text-right">
              <div className="text-sm font-medium text-gray-800 arabic-text">
                {user?.full_name}
              </div>
              <div className="text-xs text-gray-600 arabic-text">
                {gymType === 'male' ? 'فرع الرجال' : 'فرع النساء'}
              </div>
            </div>
            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
              <User className="w-5 h-5 text-white" />
            </div>
          </div>

          <button
            onClick={logout}
            className="flex items-center space-x-reverse space-x-2 px-4 py-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors arabic-text"
          >
            <LogOut className="w-4 h-4" />
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;