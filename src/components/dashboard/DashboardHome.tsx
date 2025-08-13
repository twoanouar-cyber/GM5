import React, { useState, useEffect } from 'react';
import { useGym } from '../../contexts/GymContext';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Package,
  ShoppingCart,
  CreditCard,
  TrendingUp,
  Calendar,
  DollarSign,
  BarChart3,
  UserPlus,
  Clock,
  Filter,
  CalendarDays,
  Eye,
  EyeOff,
  Maximize,
  Minimize,
  RotateCcw // أيقونة جديدة للتحديث
} from 'lucide-react';
import { toast } from 'react-toastify';

interface DashboardStats {
  totalSubscribers: number;
  activeSubscribers: number;
  expiringSubscribers: number;
  totalProducts: number;
  lowStockProducts: number;
  totalRevenue: number;
  subscriptionRevenue: number;
  salesRevenue: number;
  salesProfit: number;
  totalSales: number;
  singleSessionRevenue: number;
  singleSessionCount: number;
  internalSalesRevenue: number;
  internalSalesProfit: number;
  customerDebts: number;
}

const DashboardHome: React.FC = () => {
  const { gymId, gymName, gymType } = useGym();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    totalSubscribers: 0,
    activeSubscribers: 0,
    expiringSubscribers: 0,
    totalProducts: 0,
    lowStockProducts: 0,
    totalRevenue: 0,
    subscriptionRevenue: 0,
    salesRevenue: 0,
    salesProfit: 0,
    totalSales: 0,
    singleSessionRevenue: 0,
    singleSessionCount: 0,
    internalSalesRevenue: 0,
    internalSalesProfit: 0,
    customerDebts: 0
  });
  const [loading, setLoading] = useState(true);

  const [showProfit, setShowProfit] = useState(false);
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isFullScreen, setIsFullScreen] = useState(false);

  const [dateRange, setDateRange] = useState<'all' | 'today' | 'week' | 'month' | 'custom'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const SECRET_PASSWORD = '9999999990';

  useEffect(() => {
    loadDashboardStats();
  }, [gymId, dateRange, startDate, endDate]);

  useEffect(() => {
    const handleFullScreenChange = () => {
      setIsFullScreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullScreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullScreenChange);
    };
  }, []);

  const toggleProfit = () => {
    if (showProfit) {
      setShowProfit(false);
      toast.info('تم إخفاء صافي الربح.');
    } else {
      setShowPasswordPrompt(true);
    }
  };

  const handlePasswordSubmit = () => {
    if (passwordInput === SECRET_PASSWORD) {
      setShowProfit(true);
      setShowPasswordPrompt(false);
      setPasswordInput('');
      setPasswordError('');
      toast.success('كلمة المرور صحيحة. تم عرض صافي الربح.');
    } else {
      setPasswordError('كلمة المرور غير صحيحة. يرجى المحاولة مرة أخرى.');
      toast.error('كلمة المرور غير صحيحة.');
    }
  };

  const closePasswordPrompt = () => {
    setShowPasswordPrompt(false);
    setPasswordInput('');
    setPasswordError('');
  };

  const toggleFullScreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.documentElement.requestFullscreen();
    }
  };

  // وظيفة جديدة لتحديث الصفحة
  const handleRefresh = () => {
    window.location.reload();
  };

  const openQuickSale = () => {
    window.dispatchEvent(new CustomEvent('openQuickSale'));
  };

  const getDateRange = () => {
    const today = new Date();
    let start = new Date();
    let end = new Date();

    switch (dateRange) {
      case 'today':
        start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
        break;
      case 'week':
        const weekStart = today.getDate() - today.getDay();
        start = new Date(today.getFullYear(), today.getMonth(), weekStart);
        end = new Date(today.getFullYear(), today.getMonth(), weekStart + 6, 23, 59, 59);
        break;
      case 'month':
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        end = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59);
        break;
      case 'all':
        return { start: null, end: null };
      case 'custom':
        if (startDate && endDate) {
          start = new Date(startDate);
          end = new Date(endDate + ' 23:59:59');
        }
        break;
    }

    return { start, end };
  };

  const loadDashboardStats = async () => {
    try {
      setLoading(true);
      const { start, end } = getDateRange();
      
      let dateCondition = '';
      let dateParams: any[] = [];
      
      if (start && end) {
        dateCondition = "AND datetime(created_at) BETWEEN datetime(?) AND datetime(?)";
        dateParams = [start.toISOString(), end.toISOString()];
      }

      const subscribersData = await window.electronAPI.query(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
          SUM(CASE WHEN status = 'expiring' THEN 1 ELSE 0 END) as expiring
        FROM subscribers 
        WHERE gym_id = ? ${dateCondition}
      `, [gymId, ...dateParams]);

      const productsData = await window.electronAPI.query(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN male_gym_quantity + female_gym_quantity < 5 THEN 1 ELSE 0 END) as low_stock
        FROM products
      `);

      const salesData = await window.electronAPI.query(`
        SELECT 
          COUNT(DISTINCT i.id) as total_sales,
          COALESCE(SUM(i.total), 0) as revenue,
          COALESCE(SUM(i.profit), 0) as profit
        FROM invoices i
        WHERE i.gym_id = ? AND i.is_single_session = 0 ${dateCondition}
      `, [gymId, ...dateParams]);

      const singleSessionData = await window.electronAPI.query(`
        SELECT 
          COUNT(*) as session_count,
          COALESCE(SUM(total), 0) as revenue
        FROM invoices 
        WHERE gym_id = ? AND is_single_session = 1 ${dateCondition}
      `, [gymId, ...dateParams]);

      const subscriptionRevenue = await window.electronAPI.query(`
        SELECT COALESCE(SUM(price_paid), 0) as revenue
        FROM subscribers 
        WHERE gym_id = ? ${dateCondition}
      `, [gymId, ...dateParams]);

      const internalSalesData = await window.electronAPI.query(`
        SELECT 
          COALESCE(SUM(total_price), 0) as revenue,
          COALESCE(SUM(profit), 0) as profit
        FROM internal_sales i
        WHERE i.gym_id = ? ${dateCondition}
      `, [gymId, ...dateParams]);

      const debtsData = await window.electronAPI.query(`
        SELECT COALESCE(SUM(total - paid_amount), 0) as total_debts
        FROM invoices 
        WHERE gym_id = ? AND is_credit = 1 AND total > paid_amount
      `, [gymId]);

      const totalProfit = (salesData[0]?.profit || 0) + (internalSalesData[0]?.profit || 0);
      const totalRevenue = (salesData[0]?.revenue || 0) + (subscriptionRevenue[0]?.revenue || 0) + 
                           (singleSessionData[0]?.revenue || 0) + (internalSalesData[0]?.revenue || 0);

      setStats({
        totalSubscribers: subscribersData[0]?.total || 0,
        activeSubscribers: subscribersData[0]?.active || 0,
        expiringSubscribers: subscribersData[0]?.expiring || 0,
        totalProducts: productsData[0]?.total || 0,
        lowStockProducts: productsData[0]?.low_stock || 0,
        totalRevenue: totalRevenue,
        subscriptionRevenue: subscriptionRevenue[0]?.revenue || 0,
        salesRevenue: salesData[0]?.revenue || 0,
        salesProfit: totalProfit,
        totalSales: salesData[0]?.total_sales || 0,
        singleSessionRevenue: singleSessionData[0]?.revenue || 0,
        singleSessionCount: singleSessionData[0]?.session_count || 0,
        internalSalesRevenue: internalSalesData[0]?.revenue || 0,
        internalSalesProfit: internalSalesData[0]?.profit || 0,
        customerDebts: debtsData[0]?.total_debts || 0
      });
    } catch (error) {
      console.error('Error loading dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ar-DZ', {
      style: 'currency',
      currency: 'DZD',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const StatCard: React.FC<{
    title: string;
    value: string | number;
    icon: React.ReactNode;
    color: string;
    subtitle?: string;
    onClick?: () => void;
  }> = ({ title, value, icon, color, subtitle, onClick }) => (
    <div 
      className={`card-ar ${onClick ? 'cursor-pointer hover:shadow-lg transition-all transform hover:scale-105' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600 arabic-text">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {subtitle && (
            <p className="text-xs text-gray-500 mt-1 arabic-text">{subtitle}</p>
          )}
        </div>
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${color}`}>
          {icon}
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 arabic-text">
            لوحة التحكم - {gymName}
          </h1>
          <p className="text-gray-600 arabic-text">
            الإحصائيات العامة
          </p>
        </div>
        
        <div className="flex items-center space-x-2 space-x-reverse">
          {/* Toggle Profit Button */}
          <button
            onClick={toggleProfit}
            className={`flex items-center px-4 py-2 rounded-lg font-medium transition-all arabic-text ${
              showProfit
                ? 'bg-orange-500 text-white shadow-md hover:bg-orange-600'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {showProfit ? (
              <EyeOff className="w-4 h-4 ml-2" />
            ) : (
              <Eye className="w-4 h-4 ml-2" />
            )}
            {showProfit ? 'إخفاء' : 'عرض'}
          </button>
          {/* Fullscreen Button */}
          <button
            onClick={toggleFullScreen}
            className="flex items-center px-3 py-2 rounded-lg font-medium transition-all bg-gray-100 text-gray-700 hover:bg-gray-200"
            title={isFullScreen ? 'الخروج من ملء الشاشة' : 'ملء الشاشة'}
          >
            {isFullScreen ? (
              <Minimize className="w-4 h-4" />
            ) : (
              <Maximize className="w-4 h-4" />
            )}
          </button>
          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            className="flex items-center px-3 py-2 rounded-lg font-medium transition-all bg-gray-100 text-gray-700 hover:bg-gray-200"
            title="تحديث الصفحة"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Password Prompt Modal */}
      {showPasswordPrompt && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-8 max-w-sm w-full mx-4">
            <h3 className="text-lg font-bold text-gray-900 mb-4 arabic-text">
              كلمة المرور مطلوبة
            </h3>
            <p className="text-sm text-gray-600 mb-4 arabic-text">
              يرجى إدخال كلمة السر.
            </p>
            <input
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2 text-right"
              placeholder="أدخل كلمة المرور"
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handlePasswordSubmit();
                }
              }}
            />
            {passwordError && (
              <p className="text-sm text-red-500 mb-4 arabic-text">{passwordError}</p>
            )}
            <div className="flex justify-end space-x-2 space-x-reverse">
              <button
                onClick={closePasswordPrompt}
                className="btn-secondary-ar arabic-text"
              >
                إلغاء
              </button>
              <button
                onClick={handlePasswordSubmit}
                className="btn-primary-ar arabic-text"
              >
                تأكيد
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modern Date Filter */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center mb-4">
          <Filter className="w-5 h-5 text-blue-600 ml-2" />
          <h3 className="text-lg font-semibold text-gray-900 arabic-text">فلترة الإحصائيات</h3>
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
          {/* Quick Date Buttons */}
          <div className="flex items-center gap-2">
            {[
              { key: 'all', label: 'الكل', icon: BarChart3 },
              { key: 'today', label: 'اليوم', icon: Clock },
              { key: 'week', label: 'هذا الأسبوع', icon: Calendar },
              { key: 'month', label: 'هذا الشهر', icon: CalendarDays },
              { key: 'custom', label: 'فترة مخصصة', icon: Filter }
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setDateRange(key as any)}
                className={`flex items-center px-4 py-2 rounded-lg font-medium transition-all arabic-text ${
                  dateRange === key
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Icon className="w-4 h-4 ml-2" />
                {label}
              </button>
            ))}
          </div>

          {/* Custom Date Range */}
          {dateRange === 'custom' && (
            <div className="flex items-center gap-3 ml-4 pl-4 border-r border-gray-200">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700 arabic-text">من:</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700 arabic-text">إلى:</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="إجمالي الإيرادات"
          value={formatCurrency(stats.totalRevenue)}
          icon={<DollarSign className="w-6 h-6 text-white" />}
          color="bg-green-500"
          subtitle="جميع المصادر"
        />

        {showProfit && (
            <StatCard
                title="صافي الربح"
                value={formatCurrency(stats.salesProfit)}
                icon={<TrendingUp className="w-6 h-6 text-white" />}
                color="bg-orange-500"
                subtitle="من المبيعات"
            />
        )}
        
        <StatCard
          title="إيرادات الاشتراكات"
          value={formatCurrency(stats.subscriptionRevenue)}
          icon={<CreditCard className="w-6 h-6 text-white" />}
          color="bg-blue-500"
          subtitle="اشتراكات شهرية وجلسات"
          onClick={() => navigate('/dashboard/subscribers')}
        />
        
        <StatCard
          title="إيرادات المبيعات"
          value={formatCurrency(stats.salesRevenue)}
          icon={<ShoppingCart className="w-6 h-6 text-white" />}
          color="bg-purple-500"
          subtitle="مبيعات المنتجات"
          onClick={() => navigate('/dashboard/sales')}
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="الحصص المفردة"
          value={formatCurrency(stats.singleSessionRevenue)}
          icon={<Users className="w-6 h-6 text-white" />}
          color="bg-cyan-500"
          subtitle={`${stats.singleSessionCount} حصة`}
        />
        
        <StatCard
          title="القائمة البيضاء"
          value={formatCurrency(stats.internalSalesRevenue)}
          icon={<UserPlus className="w-6 h-6 text-white" />}
          color="bg-indigo-500"
          subtitle={`ربح: ${formatCurrency(stats.internalSalesProfit)}`}
          onClick={() => navigate('/dashboard/internal-sales')}
        />

        <StatCard
          title="ديون الزبائن"
          value={formatCurrency(stats.customerDebts)}
          icon={<CreditCard className="w-6 h-6 text-white" />}
          color="bg-red-500"
          subtitle="مبالغ مستحقة"
          onClick={() => navigate('/dashboard/customers')}
        />
        
        <StatCard
          title="إجمالي المشتركين"
          value={stats.totalSubscribers}
          icon={<Users className="w-6 h-6 text-white" />}
          color="bg-teal-500"
          subtitle={`${stats.activeSubscribers} نشط`}
          onClick={() => navigate('/dashboard/subscribers')}
        />
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 arabic-text">
          إجراءات سريعة
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <button 
            onClick={openQuickSale}
            className="btn-primary-ar arabic-text flex items-center justify-center py-3"
          >
            <CreditCard className="w-5 h-5 ml-2" />
            فاتورة سريعة (Space)
          </button>
          <button 
            onClick={() => navigate('/dashboard/subscribers')}
            className="btn-secondary-ar arabic-text flex items-center justify-center py-3"
          >
            <UserPlus className="w-5 h-5 ml-2" />
            إضافة مشترك
          </button>
          <button 
            onClick={() => navigate('/dashboard/products')}
            className="btn-secondary-ar arabic-text flex items-center justify-center py-3"
          >
            <Package className="w-5 h-5 ml-2" />
            إضافة منتج
          </button>
          <button 
            onClick={() => navigate('/dashboard/customers')}
            className="btn-secondary-ar arabic-text flex items-center justify-center py-3"
          >
            <Users className="w-5 h-5 ml-2" />
            إدارة الزبائن
          </button>
        </div>
      </div>

      {/* Financial Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center mb-4">
            <TrendingUp className="w-5 h-5 text-blue-600 ml-2" />
            <h3 className="text-lg font-semibold text-gray-900 arabic-text">الأداء المالي</h3>
          </div>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600 arabic-text">إجمالي الإيرادات</span>
              <span className="font-semibold text-green-600">
                {formatCurrency(stats.totalRevenue)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600 arabic-text">إيرادات الاشتراكات</span>
              <span className="font-semibold text-blue-600">
                {formatCurrency(stats.subscriptionRevenue)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600 arabic-text">إيرادات المبيعات</span>
              <span className="font-semibold text-purple-600">
                {formatCurrency(stats.salesRevenue)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600 arabic-text">الحصص المفردة</span>
              <span className="font-semibold text-cyan-600">
                {formatCurrency(stats.singleSessionRevenue)}
              </span>
            </div>
            {showProfit && (
                <div className="flex justify-between items-center border-t pt-2">
                    <span className="text-gray-600 arabic-text">صافي الربح</span>
                    <span className="font-semibold text-orange-600">
                        {formatCurrency(stats.salesProfit)}
                    </span>
                </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center mb-4">
            <BarChart3 className="w-5 h-5 text-blue-600 ml-2" />
            <h3 className="text-lg font-semibold text-gray-900 arabic-text">حالة المشتركين</h3>
          </div>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600 arabic-text">مشتركين نشطين</span>
              <span className="status-active">
                {stats.activeSubscribers}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600 arabic-text">اشتراكات منتهية الصلاحية قريباً</span>
              <span className="status-expiring">
                {stats.expiringSubscribers}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600 arabic-text">معدل التجديد</span>
              <span className="font-semibold text-indigo-600">
                {stats.totalSubscribers > 0 
                  ? `${((stats.activeSubscribers / stats.totalSubscribers) * 100).toFixed(1)}%`
                  : '0%'
                }
              </span>
            </div>
            <div className="flex justify-between items-center border-t pt-2">
              <span className="text-gray-600 arabic-text">ديون الزبائن</span>
              <span className="font-semibold text-red-600">
                {formatCurrency(stats.customerDebts)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activities and Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Customer Debts */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center mb-4">
            <CreditCard className="w-5 h-5 text-red-600 ml-2" />
            <h3 className="text-lg font-semibold text-gray-900 arabic-text">الزبائن المدينون</h3>
          </div>
          <CustomerDebts gymId={gymId} />
        </div>

        {/* Low Stock Products */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center mb-4">
            <Package className="w-5 h-5 text-orange-600 ml-2" />
            <h3 className="text-lg font-semibold text-gray-900 arabic-text">منتجات ستنفد قريباً</h3>
          </div>
          <LowStockProducts />
        </div>

        {/* Expiring Subscriptions */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center mb-4">
            <Users className="w-5 h-5 text-yellow-600 ml-2" />
            <h3 className="text-lg font-semibold text-gray-900 arabic-text">اشتراكات تنتهي قريباً</h3>
          </div>
          <ExpiringSubscriptions gymId={gymId} />
        </div>
      </div>
    </div>
  );
};

// Component for Customer Debts
const CustomerDebts: React.FC<{ gymId: number }> = ({ gymId }) => {
  const [debts, setDebts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCustomerDebts();
  }, [gymId]);

  const loadCustomerDebts = async () => {
    try {
      const data = await window.electronAPI.query(`
        SELECT c.name, c.phone, SUM(i.total - i.paid_amount) as total_debt
        FROM customers c
        JOIN invoices i ON c.id = i.customer_id
        WHERE i.gym_id = ? AND i.is_credit = 1 AND i.total > i.paid_amount
        GROUP BY c.id, c.name, c.phone
        ORDER BY total_debt DESC
        LIMIT 5
      `, [gymId]);
      setDebts(data);
    } catch (error) {
      console.error('Error loading customer debts:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ar-DZ', {
      style: 'currency',
      currency: 'DZD',
      minimumFractionDigits: 0
    }).format(amount);
  };

  if (loading) return <div className="text-center py-4"><div className="spinner"></div></div>;

  return (
    <div className="space-y-3">
      {debts.length === 0 ? (
        <p className="text-gray-500 text-center py-4 arabic-text">لا توجد ديون</p>
      ) : (
        debts.map((debt, index) => (
          <div key={index} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
            <div>
              <p className="font-medium text-gray-900 arabic-text">{debt.name}</p>
              <p className="text-sm text-gray-600">{debt.phone}</p>
            </div>
            <span className="font-bold text-red-600">{formatCurrency(debt.total_debt)}</span>
          </div>
        ))
      )}
    </div>
  );
};

// Component for Low Stock Products
const LowStockProducts: React.FC = () => {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLowStockProducts();
  }, []);

  const loadLowStockProducts = async () => {
    try {
      const data = await window.electronAPI.query(`
        SELECT name, (male_gym_quantity + female_gym_quantity) as total_quantity
        FROM products
        WHERE (male_gym_quantity + female_gym_quantity) < 5 AND (male_gym_quantity + female_gym_quantity) > 0
        ORDER BY total_quantity ASC
        LIMIT 5
      `);
      setProducts(data);
    } catch (error) {
      console.error('Error loading low stock products:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-center py-4"><div className="spinner"></div></div>;

  return (
    <div className="space-y-3">
      {products.length === 0 ? (
        <p className="text-gray-500 text-center py-4 arabic-text">جميع المنتجات متوفرة</p>
      ) : (
        products.map((product, index) => (
          <div key={index} className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
            <p className="font-medium text-gray-900 arabic-text">{product.name}</p>
            <span className="font-bold text-orange-600">{product.total_quantity} متبقي</span>
          </div>
        ))
      )}
    </div>
  );
};

// Component for Expiring Subscriptions
const ExpiringSubscriptions: React.FC<{ gymId: number }> = ({ gymId }) => {
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadExpiringSubscriptions();
  }, [gymId]);

  const loadExpiringSubscriptions = async () => {
    try {
      const data = await window.electronAPI.query(`
        SELECT full_name, end_date, status
        FROM subscribers
        WHERE gym_id = ? AND (status = 'expiring' OR status = 'expired')
        ORDER BY end_date ASC
        LIMIT 5
      `, [gymId]);
      setSubscriptions(data);
    } catch (error) {
      console.error('Error loading expiring subscriptions:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-center py-4"><div className="spinner"></div></div>;

  return (
    <div className="space-y-3">
      {subscriptions.length === 0 ? (
        <p className="text-gray-500 text-center py-4 arabic-text">جميع الاشتراكات نشطة</p>
      ) : (
        subscriptions.map((sub, index) => (
          <div key={index} className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
            <div>
              <p className="font-medium text-gray-900 arabic-text">{sub.full_name}</p>
              <p className="text-sm text-gray-600">
                {new Date(sub.end_date).toLocaleDateString('ar-DZ')}
              </p>
            </div>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
              sub.status === 'expired' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
            }`}>
              {sub.status === 'expired' ? 'منتهي' : 'ينتهي قريباً'}
            </span>
          </div>
        ))
      )}
    </div>
  );
};

export default DashboardHome;
