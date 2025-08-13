import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Users, Search, Phone, Calendar, AlertTriangle } from 'lucide-react';
import { useGym } from '../../contexts/GymContext';
import { useAuth } from '../../contexts/AuthContext';

interface Subscriber {
  id: number;
  full_name: string;
  phone: string;
  subscription_type_name: string;
  subscription_type: 'monthly' | 'session';
  start_date: string;
  end_date: string;
  price_paid: number;
  remaining_sessions: number | null;
  status: 'active' | 'expired' | 'expiring';
  gym_id: number;
  subscription_type_id: number;
  created_at: string;
  created_by_user: string;
}

interface SubscriptionType {
  id: number;
  name: string;
  type: 'monthly' | 'session';
  duration_months: number | null;
  session_count: number | null;
  price: number;
}

const SubscribersPage: React.FC = () => {
  const { gymId } = useGym();
  const { user } = useAuth();
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [subscriptionTypes, setSubscriptionTypes] = useState<SubscriptionType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingSubscriber, setEditingSubscriber] = useState<Subscriber | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    subscription_type_id: '',
    start_date: new Date().toISOString().split('T')[0],
    price_paid: ''
  });

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !showModal) {
        e.preventDefault();
        openAddModal();
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [showModal]);

  useEffect(() => {
    loadSubscribers();
    loadSubscriptionTypes();
  }, [gymId]);

  const loadSubscribers = async () => {
    try {
      const data = await window.electronAPI.query(`
        SELECT s.*, st.name as subscription_type_name, st.type as subscription_type,
               COALESCE(u.full_name, 'غير محدد') as created_by_user
        FROM subscribers s
        JOIN subscription_types st ON s.subscription_type_id = st.id
        LEFT JOIN users u ON s.created_by = u.id
        WHERE s.gym_id = ?
        ORDER BY s.created_at DESC
      `, [gymId]);
      
      // Update status based on dates and sessions
      const updatedData = data.map((subscriber: any) => {
        const endDate = new Date(subscriber.end_date);
        const today = new Date();
        const daysUntilExpiry = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        
        let status = 'active';
        if (subscriber.subscription_type === 'session' && subscriber.remaining_sessions !== null && subscriber.remaining_sessions <= 0) {
          status = 'expired';
        } else if (subscriber.subscription_type === 'monthly' && daysUntilExpiry < 0) {
          status = 'expired';
        } else if (daysUntilExpiry <= 7 && daysUntilExpiry >= 0) {
          status = 'expiring';
        }
        
        return { ...subscriber, status };
      });
      
      setSubscribers(updatedData);
      
      // Update status in database
      for (const subscriber of updatedData) {
        if (subscriber.status !== subscriber.original_status) {
          await window.electronAPI.run(
            'UPDATE subscribers SET status = ? WHERE id = ?',
            [subscriber.status, subscriber.id]
          );
        }
      }
    } catch (error) {
      console.error('Error loading subscribers:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSubscriptionTypes = async () => {
    try {
      const data = await window.electronAPI.query(`
        SELECT * FROM subscription_types 
        WHERE gym_id = ? AND is_active = 1
        ORDER BY name
      `, [gymId]);
      setSubscriptionTypes(data);
    } catch (error) {
      console.error('Error loading subscription types:', error);
    }
  };

  const calculateEndDate = (startDate: string, subscriptionType: SubscriptionType) => {
    const start = new Date(startDate);
    if (subscriptionType.type === 'monthly' && subscriptionType.duration_months) {
      start.setMonth(start.getMonth() + subscriptionType.duration_months);
    } else if (subscriptionType.type === 'session') {
      // For session-based, set end date to 3 months from start
      start.setMonth(start.getMonth() + 3);
    }
    return start.toISOString().split('T')[0];
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const selectedSubscription = subscriptionTypes.find(
        st => st.id === parseInt(formData.subscription_type_id)
      );
      
      if (!selectedSubscription) {
        alert('يرجى اختيار نوع الاشتراك');
        return;
      }

      const endDate = calculateEndDate(formData.start_date, selectedSubscription);
      const remainingSessions = selectedSubscription.type === 'session' 
        ? selectedSubscription.session_count 
        : null;

      if (editingSubscriber) {
        // Update existing subscriber
        await window.electronAPI.run(`
          UPDATE subscribers 
          SET full_name = ?, phone = ?, subscription_type_id = ?, 
              start_date = ?, end_date = ?, price_paid = ?, remaining_sessions = ?
          WHERE id = ?
        `, [
          formData.full_name,
          formData.phone,
          parseInt(formData.subscription_type_id),
          formData.start_date,
          endDate,
          parseFloat(formData.price_paid),
          remainingSessions,
          editingSubscriber.id
        ]);
      } else {
        // Create new subscriber
        await window.electronAPI.run(`
          INSERT INTO subscribers (full_name, phone, subscription_type_id, start_date, 
                                 end_date, price_paid, remaining_sessions, gym_id, status, created_by) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)
        `, [
          formData.full_name,
          formData.phone,
          parseInt(formData.subscription_type_id),
          formData.start_date,
          endDate,
          parseFloat(formData.price_paid),
          remainingSessions,
          gymId,
          user?.id
        ]);
      }
      
      await loadSubscribers();
      setShowModal(false);
      setEditingSubscriber(null);
      resetForm();
    } catch (error) {
      console.error('Error saving subscriber:', error);
      alert('حدث خطأ في حفظ المشترك');
    }
  };

  const handleEdit = (subscriber: Subscriber) => {
    setEditingSubscriber(subscriber);
    setFormData({
      full_name: subscriber.full_name,
      phone: subscriber.phone,
      subscription_type_id: subscriber.subscription_type_id.toString(),
      start_date: subscriber.start_date,
      price_paid: subscriber.price_paid.toString()
    });
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('هل أنت متأكد من حذف هذا المشترك؟')) {
      try {
        await window.electronAPI.run('DELETE FROM subscribers WHERE id = ?', [id]);
        await loadSubscribers();
      } catch (error) {
        console.error('Error deleting subscriber:', error);
        alert('حدث خطأ في حذف المشترك');
      }
    }
  };

  const useSession = async (subscriberId: number) => {
    try {
      // Show confirmation dialog using electron API
      const result = await window.electronAPI.showConfirm({
        title: 'تأكيد استخدام الجلسة',
        message: 'هل أنت متأكد من استخدام جلسة من هذا الاشتراك؟',
        detail: 'سيتم خصم جلسة واحدة من الجلسات المتبقية.',
        buttons: ['نعم، استخدم الجلسة', 'إلغاء'],
        defaultId: 1,
        cancelId: 1
      });
    
      if (result.response === 0) {
        await window.electronAPI.run(`
          UPDATE subscribers 
          SET remaining_sessions = remaining_sessions - 1 
          WHERE id = ? AND remaining_sessions > 0
        `, [subscriberId]);
        await loadSubscribers();
      }
    } catch (error) {
      console.error('Error using session:', error);
    }
  };

  const renewSubscription = async (subscriber: Subscriber) => {
    const selectedSubscription = subscriptionTypes.find(
      st => st.id === subscriber.subscription_type_id
    );
    
    if (!selectedSubscription) return;

    try {
      const newStartDate = new Date().toISOString().split('T')[0];
      const newEndDate = calculateEndDate(newStartDate, selectedSubscription);
      const newRemainingSessions = selectedSubscription.type === 'session' 
        ? selectedSubscription.session_count 
        : null;

      await window.electronAPI.run(`
        UPDATE subscribers 
        SET start_date = ?, end_date = ?, remaining_sessions = ?, status = 'active'
        WHERE id = ?
      `, [newStartDate, newEndDate, newRemainingSessions, subscriber.id]);
      
      await loadSubscribers();
    } catch (error) {
      console.error('Error renewing subscription:', error);
      alert('حدث خطأ في تجديد الاشتراك');
    }
  };

  const resetForm = () => {
    setFormData({
      full_name: '',
      phone: '',
      subscription_type_id: '',
      start_date: new Date().toISOString().split('T')[0],
      price_paid: ''
    });
  };

  const openAddModal = () => {
    setEditingSubscriber(null);
    resetForm();
    setShowModal(true);
  };

  const filteredSubscribers = subscribers.filter(subscriber => {
    const matchesSearch = subscriber.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         subscriber.phone.includes(searchTerm);
    const matchesStatus = statusFilter === 'all' || subscriber.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ar-DZ', {
      style: 'currency',
      currency: 'DZD',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'status-active';
      case 'expired': return 'status-expired';
      case 'expiring': return 'status-expiring';
      default: return 'status-active';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active': return 'نشط';
      case 'expired': return 'منتهي';
      case 'expiring': return 'ينتهي قريباً';
      default: return 'نشط';
    }
  };

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
            إدارة المشتركين
          </h1>
          <p className="text-gray-600 arabic-text">
            إدارة المشتركين واشتراكاتهم
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="btn-primary-ar arabic-text flex items-center"
        >
          <Plus className="w-5 h-5 ml-2" />
          إضافة مشترك جديد
        </button>
      </div>

      {/* Filters */}
      <div className="card-ar">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="form-input-ar pr-10"
              placeholder="البحث بالاسم أو رقم الهاتف..."
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="form-select-ar"
          >
            <option value="all">جميع الحالات</option>
            <option value="active">نشط</option>
            <option value="expiring">ينتهي قريباً</option>
            <option value="expired">منتهي</option>
          </select>
        </div>
      </div>

      {/* Subscribers Table */}
      <div className="card-ar">
        {filteredSubscribers.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 arabic-text">
              {searchTerm || statusFilter !== 'all' ? 'لا توجد نتائج' : 'لا يوجد مشتركين'}
            </h3>
            <p className="text-gray-600 arabic-text">
              {searchTerm || statusFilter !== 'all' ? 'جرب تغيير معايير البحث' : 'ابدأ بإضافة مشترك جديد'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-ar">
              <thead>
                <tr>
                  <th>الاسم الكامل</th>
                  <th>رقم الهاتف</th>
                  <th>نوع الاشتراك</th>
                  <th>تاريخ البداية</th>
                  <th>تاريخ الانتهاء</th>
                  <th>المبلغ المدفوع</th>
                  <th>الجلسات المتبقية</th>
                  <th>الحالة</th>
                  <th>أنشئ بواسطة</th>
                  <th>الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filteredSubscribers.map((subscriber) => (
                  <tr key={subscriber.id}>
                    <td className="font-medium">{subscriber.full_name}</td>
                    <td>
                      <div className="flex items-center">
                        <Phone className="w-4 h-4 ml-2 text-gray-400" />
                        {subscriber.phone}
                      </div>
                    </td>
                    <td>{subscriber.subscription_type_name}</td>
                    <td>
                      {new Date(subscriber.start_date).toLocaleDateString('ar-DZ')}
                    </td>
                    <td>
                      <div className="flex items-center">
                        <Calendar className="w-4 h-4 ml-2 text-gray-400" />
                        {new Date(subscriber.end_date).toLocaleDateString('ar-DZ')}
                      </div>
                    </td>
                    <td>{formatCurrency(subscriber.price_paid)}</td>
                    <td>
                      {subscriber.subscription_type === 'session' ? (
                        <div className="flex items-center space-x-reverse space-x-2">
                          <span className={subscriber.remaining_sessions !== null && subscriber.remaining_sessions <= 2 ? 'text-red-600 font-bold' : ''}>
                            {subscriber.remaining_sessions}
                          </span>
                          {subscriber.remaining_sessions !== null && subscriber.remaining_sessions > 0 && (
                            <button
                              onClick={() => useSession(subscriber.id)}
                              className="btn-secondary-ar text-xs py-1 px-2"
                            >
                              استخدام جلسة
                            </button>
                          )}
                        </div>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td>
                      <span className={getStatusColor(subscriber.status)}>
                        {getStatusText(subscriber.status)}
                      </span>
                    </td>
                    <td>{subscriber.created_by_user || '-'}</td>
                    <td>
                      <div className="flex items-center space-x-reverse space-x-2">
                        <button
                          onClick={() => handleEdit(subscriber)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        {subscriber.status === 'expired' && (
                          <button
                            onClick={() => renewSubscription(subscriber)}
                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title="تجديد الاشتراك"
                          >
                            <Calendar className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(subscriber.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay-ar">
          <div className="modal-content-ar">
            <h2 className="text-xl font-bold text-gray-900 mb-6 arabic-text">
              {editingSubscriber ? 'تعديل المشترك' : 'إضافة مشترك جديد'}
            </h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-group-ar">
                  <label className="form-label-ar arabic-text">
                    الاسم الكامل *
                  </label>
                  <input
                    type="text"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    className="form-input-ar"
                    placeholder="أدخل الاسم الكامل"
                    required
                  />
                </div>

                <div className="form-group-ar">
                  <label className="form-label-ar arabic-text">
                    رقم الهاتف
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="form-input-ar"
                    placeholder="مثال: 0555123456"
                  />
                </div>
              </div>

              <div className="form-group-ar">
                <label className="form-label-ar arabic-text">
                  نوع الاشتراك *
                </label>
                <select
                  value={formData.subscription_type_id}
                  onChange={(e) => {
                    const selectedType = subscriptionTypes.find(st => st.id === parseInt(e.target.value));
                    setFormData({ 
                      ...formData, 
                      subscription_type_id: e.target.value,
                      price_paid: selectedType ? selectedType.price.toString() : ''
                    });
                  }}
                  className="form-select-ar"
                  required
                >
                  <option value="">اختر نوع الاشتراك</option>
                  {subscriptionTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name} - {formatCurrency(type.price)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-group-ar">
                  <label className="form-label-ar arabic-text">
                    تاريخ بداية الاشتراك *
                  </label>
                  <input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    className="form-input-ar"
                    required
                  />
                </div>

                <div className="form-group-ar">
                  <label className="form-label-ar arabic-text">
                    المبلغ المدفوع (دج) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.price_paid}
                    onChange={(e) => setFormData({ ...formData, price_paid: e.target.value })}
                    className="form-input-ar"
                    placeholder="0.00"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-reverse space-x-4 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn-secondary-ar arabic-text"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="btn-primary-ar arabic-text"
                >
                  {editingSubscriber ? 'تحديث' : 'إضافة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubscribersPage;