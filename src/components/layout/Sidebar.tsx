import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  CreditCard,
  Users,
  UserPlus,
  FileText,
  Settings,
  Tag,
  UserCheck
} from 'lucide-react';

const Sidebar: React.FC = () => {
  const location = useLocation();

  const menuItems = [
    {
      path: '/dashboard',
      icon: LayoutDashboard,
      label: 'لوحة التحكم',
      exact: true
    },
    {
      path: '/dashboard/categories',
      icon: Tag,
      label: 'الفئات'
    },
    {
      path: '/dashboard/products',
      icon: Package,
      label: 'المنتجات'
    },
    {
      path: '/dashboard/purchases',
      icon: ShoppingCart,
      label: 'المشتريات'
    },
    {
      path: '/dashboard/sales',
      icon: CreditCard,
      label: 'المبيعات'
    },
    {
      path: '/dashboard/subscriptions',
      icon: FileText,
      label: 'الاشتراكات'
    },
    {
      path: '/dashboard/subscribers',
      icon: Users,
      label: 'المشتركين'
    },
    {
      path: '/dashboard/internal-sales',
      icon: UserPlus,
      label: 'القائمة البيضاء'
    },
    {
      path: '/dashboard/customers',
      icon: UserCheck,
      label: 'الزبائن'
    },
    {
      path: '/dashboard/users',
      icon: Users,
      label: 'المستخدمين'
    },
    {
      path: '/dashboard/settings',
      icon: Settings,
      label: 'الإعدادات'
    }
  ];

  return (
    // الخلفية الرئيسية للشريط الجانبي
    <aside className="w-64 bg-gray-50 shadow-lg border-l border-gray-200">
      {/* قسم الشعار مع الهامش الداخلي */}
      <div className="p-6">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full mx-auto mb-3 flex items-center justify-center">
            <LayoutDashboard className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-lg font-bold text-gray-800 arabic-text">
            GYM DADA
          </h2>
        </div>
      </div>
      
      {/* هذا الـ div الجديد يغلف قسم التنقل بالكامل ويمنحه خلفية بيضاء مستمرة */}
      <div className="bg-white mx-4 p-2 rounded-lg shadow-inner">
        {/* قسم التنقل مع تباعد بين العناصر */}
        <nav className="space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.exact 
              ? location.pathname === item.path
              : location.pathname.startsWith(item.path);

            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={`w-full flex items-center gap-3 px-4 py-2 text-base font-medium rounded-md transition-colors duration-200 ease-in-out
                  ${isActive
                    ? 'bg-blue-600 text-white shadow-md' // فئات الحالة النشطة
                    : 'text-gray-600 hover:bg-gray-100' // فئات الحالة غير النشطة
                  } arabic-text`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>
      </div>
    </aside>
  );
};

export default Sidebar;
