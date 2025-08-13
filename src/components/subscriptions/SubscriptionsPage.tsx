import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, FileText, Calendar, DollarSign } from 'lucide-react';
import { useGym } from '../../contexts/GymContext';

interface SubscriptionType {
  id: number;
  name: string;
  type: 'monthly' | 'session';
  duration_months: number | null;
  session_count: number | null;
  price: number;
  gym_id: number;
  is_active: boolean;
  created_at: string;
}

const SubscriptionsPage: React.FC = () => {
  const { gymId } = useGym();
  const [subscriptions, setSubscriptions] = useState<SubscriptionType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingSubscription, setEditingSubscription] = useState<SubscriptionType | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    type: 'monthly' as 'monthly' | 'session',
    duration_months: '',
    session_count: '',
    price: '',
    is_active: true
  });

  useEffect(() => {
    loadSubscriptions();
  }, [gymId]);

  const loadSubscriptions = async () => {
    try {
      const data = await window.electronAPI.query(`
        SELECT * FROM subscription_types 
        WHERE gym_id = ? 
        ORDER BY created_at DESC
      `, [gymId]);
      setSubscriptions(data);
    } catch (error) {
      console.error('Error loading subscriptions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingSubscription) {
        // Update existing subscription
        await window.electronAPI.run(`
          UPDATE subscription_types 
          SET name = ?, type = ?, duration_months = ?, session_count = ?, 
              price = ?, is_active = ?
          WHERE id = ?
        `, [
          formData.name,
          formData.type,
          formData.type === 'monthly' ? parseInt(formData.duration_months) || null : null,
          formData.type === 'session' ? parseInt(formData.session_count) || null : null,
          parseFloat(formData.price),
          formData.is_active,
          editingSubscription.id
        ]);
      } else {
        // Create new subscription
        await window.electronAPI.run(`
          INSERT INTO subscription_types (name, type, duration_months, session_count, price, gym_id, is_active) 
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
          formData.name,
          formData.type,
          formData.type === 'monthly' ? parseInt(formData.duration_months) || null : null,
          formData.type === 'session' ? parseInt(formData.session_count) || null : null,
          parseFloat(formData.price),
          gymId,
          formData.is_active
        ]);
      }
      
      await loadSubscriptions();
      setShowModal(false);
      setEditingSubscription(null);
      resetForm();
    } catch (error) {
      console.error('Error saving subscription:', error);
      alert('حدث خطأ في حفظ الاشتراك');
    }
  };

  const handleEdit = (subscription: SubscriptionType) => {
    setEditingSubscription(subscription);
    setFormData({
      name: subscription.name,
      type: subscription.type,
      duration_months: subscription.duration_months?.toString() || '',
      session_count: subscription.session_count?.toString() || '',
      price: subscription.price.toString(),
      is_active: subscription.is_active
    });
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('هل أنت متأكد من حذف هذا الاشتراك؟')) {
      try {
        await window.electronAPI.run('DELETE FROM subscription_types WHERE id = ?', [id]);
        await loadSubscriptions();
      } catch (error) {
        console.error('Error deleting subscription:', error);
        alert('لا يمكن حذف هذا الاشتراك لأنه مرتبط بمشتركين');
      }
    }
  };

  const toggleActive = async (id: number, currentStatus: boolean) => {
    try {
      await window.electronAPI.run(
        'UPDATE subscription_types SET is_active = ? WHERE id = ?',
        [!currentStatus, id]
      );
      await loadSubscriptions();
    } catch (error) {
      console.error('Error toggling subscription status:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'monthly',
      duration_months: '',
      session_count: '',
      price: '',
      is_active: true
    });
  };

  const openAddModal = () => {
    setEditingSubscription(null);
    resetForm();
    setShowModal(true);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ar-DZ', {
      style: 'currency',
      currency: 'DZD',
      minimumFractionDigits: 0
    }).format(amount);
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
            إدارة الاشتراكات
          </h1>
          <p className="text-gray-600 arabic-text">
            إدارة أنواع الاشتراكات والأسعار
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="btn-primary-ar arabic-text flex items-center"
        >
          <Plus className="w-5 h-5 ml-2" />
          إضافة اشتراك جديد
        </button>
      </div>

      {/* Subscriptions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {subscriptions.length === 0 ? (
          <div className="col-span-full">
            <div className="card-ar text-center py-12">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 arabic-text">
                لا توجد اشتراكات
              </h3>
              <p className="text-gray-600 arabic-text">
                ابدأ بإضافة نوع اشتراك جديد
              </p>
            </div>
          </div>
        ) : (
          subscriptions.map((subscription) => (
            <div key={subscription.id} className="card-ar">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 arabic-text">
                    {subscription.name}
                  </h3>
                  <div className="flex items-center mt-2">
                    {subscription.type === 'monthly' ? (
                      <div className="flex items-center text-blue-600">
                        <Calendar className="w-4 h-4 ml-1" />
                        <span className="text-sm arabic-text">
                          {subscription.duration_months} شهر
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center text-green-600">
                        <FileText className="w-4 h-4 ml-1" />
                        <span className="text-sm arabic-text">
                          {subscription.session_count} جلسة
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-reverse space-x-2">
                  <button
                    onClick={() => handleEdit(subscription)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(subscription.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center text-green-600">
                  <DollarSign className="w-5 h-5 ml-1" />
                  <span className="text-xl font-bold">
                    {formatCurrency(subscription.price)}
                  </span>
                </div>
                <button
                  onClick={() => toggleActive(subscription.id, subscription.is_active)}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                    subscription.is_active
                      ? 'bg-green-100 text-green-800 hover:bg-green-200'
                      : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                  }`}
                >
                  {subscription.is_active ? 'نشط' : 'غير نشط'}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay-ar">
          <div className="modal-content-ar">
            <h2 className="text-xl font-bold text-gray-900 mb-6 arabic-text">
              {editingSubscription ? 'تعديل الاشتراك' : 'إضافة اشتراك جديد'}
            </h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="form-group-ar">
                <label className="form-label-ar arabic-text">
                  اسم الاشتراك *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="form-input-ar"
                  placeholder="مثال: اشتراك شهري"
                  required
                />
              </div>

              <div className="form-group-ar">
                <label className="form-label-ar arabic-text">
                  نوع الاشتراك *
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    type: e.target.value as 'monthly' | 'session',
                    duration_months: e.target.value === 'session' ? '' : formData.duration_months,
                    session_count: e.target.value === 'monthly' ? '' : formData.session_count
                  })}
                  className="form-select-ar"
                  required
                >
                  <option value="monthly">اشتراك شهري</option>
                  <option value="session">اشتراك بالجلسات</option>
                </select>
              </div>

              {formData.type === 'monthly' && (
                <div className="form-group-ar">
                  <label className="form-label-ar arabic-text">
                    مدة الاشتراك (بالأشهر) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.duration_months}
                    onChange={(e) => setFormData({ ...formData, duration_months: e.target.value })}
                    className="form-input-ar"
                    placeholder="مثال: 1"
                    required
                  />
                </div>
              )}

              {formData.type === 'session' && (
                <div className="form-group-ar">
                  <label className="form-label-ar arabic-text">
                    عدد الجلسات *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.session_count}
                    onChange={(e) => setFormData({ ...formData, session_count: e.target.value })}
                    className="form-input-ar"
                    placeholder="مثال: 10"
                    required
                  />
                </div>
              )}

              <div className="form-group-ar">
                <label className="form-label-ar arabic-text">
                  السعر (دج) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  className="form-input-ar"
                  placeholder="مثال: 3000"
                  required
                />
              </div>

              <div className="form-group-ar">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="ml-2"
                  />
                  <span className="arabic-text">اشتراك نشط</span>
                </label>
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
                  {editingSubscription ? 'تحديث' : 'إضافة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubscriptionsPage;