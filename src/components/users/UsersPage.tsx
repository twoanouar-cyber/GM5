import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Users, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface User {
  id: number;
  username: string;
  full_name: string;
  role: string;
  gym_id: number;
  gym_name: string;
  gym_type: 'male' | 'female';
  is_active: boolean;
  created_at: string;
}

interface Gym {
  id: number;
  name: string;
  type: 'male' | 'female';
}

const UsersPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    full_name: '',
    role: 'admin',
    gym_id: '',
    is_active: true
  });

  useEffect(() => {
    loadUsers();
    loadGyms();
  }, []);

  const loadUsers = async () => {
    try {
      const data = await window.electronAPI.query(`
        SELECT u.*, g.name as gym_name, g.type as gym_type
        FROM users u
        JOIN gyms g ON u.gym_id = g.id
        ORDER BY u.created_at DESC
      `);
      setUsers(data);
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadGyms = async () => {
    try {
      const data = await window.electronAPI.query('SELECT * FROM gyms ORDER BY name');
      setGyms(data);
    } catch (error) {
      console.error('Error loading gyms:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (!formData.username || !formData.full_name || !formData.gym_id) {
        alert('يرجى ملء جميع الحقول المطلوبة');
        return;
      }

      if (!editingUser && !formData.password) {
        alert('يرجى إدخال كلمة المرور للمستخدم الجديد');
        return;
      }
      
      console.log('Submitting user data:', {
        username: formData.username,
        hasPassword: !!formData.password,
        isEditing: !!editingUser
      });
      
      if (editingUser) {
        // Update existing user using the electron API
        const result = await window.electronAPI.updateUser(editingUser.id, {
          username: formData.username,
          password: formData.password || undefined,
          full_name: formData.full_name,
          role: formData.role,
          gym_id: parseInt(formData.gym_id),
          is_active: formData.is_active
        });
        
        if (!result.success) {
          throw new Error(result.message || result.error || 'فشل في تحديث المستخدم');
        }
      } else {
        // Create new user using the electron API
        const result = await window.electronAPI.createUser({
          username: formData.username,
          password: formData.password,
          full_name: formData.full_name,
          role: formData.role,
          gym_id: parseInt(formData.gym_id),
          is_active: formData.is_active
        });
        
        if (!result.success) {
          throw new Error(result.message || result.error || 'فشل في إنشاء المستخدم');
        }
      }
      
      await loadUsers();
      setShowModal(false);
      setEditingUser(null);
      resetForm();
      alert(editingUser ? 'تم تحديث المستخدم بنجاح' : 'تم إنشاء المستخدم بنجاح');
    } catch (error) {
      console.error('Error saving user:', error);
      alert(`حدث خطأ في حفظ المستخدم: ${error.message}`);
    }
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setFormData({
      username: user.username,
      password: '',
      full_name: user.full_name,
      role: user.role,
      gym_id: user.gym_id?.toString() || '',
      is_active: user.is_active
    });
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (id === currentUser?.id) {
      alert('لا يمكنك حذف حسابك الخاص');
      return;
    }

    if (window.confirm('هل أنت متأكد من حذف هذا المستخدم؟')) {
      try {
        await window.electronAPI.run('DELETE FROM users WHERE id = ?', [id]);
        await loadUsers();
      } catch (error) {
        console.error('Error deleting user:', error);
        alert('حدث خطأ في حذف المستخدم');
      }
    }
  };

  const toggleActive = async (id: number, currentStatus: boolean) => {
    if (id === currentUser?.id) {
      alert('لا يمكنك تعطيل حسابك الخاص');
      return;
    }

    try {
      await window.electronAPI.run(
        'UPDATE users SET is_active = ? WHERE id = ?',
        [!currentStatus, id]
      );
      await loadUsers();
    } catch (error) {
      console.error('Error toggling user status:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      username: '',
      password: '',
      full_name: '',
      role: 'admin',
      gym_id: '',
      is_active: true
    });
    setShowPassword(false);
  };

  const openAddModal = () => {
    setEditingUser(null);
    resetForm();
    setShowModal(true);
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
            إدارة المستخدمين
          </h1>
          <p className="text-gray-600 arabic-text">
            إدارة حسابات المستخدمين والصلاحيات
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="btn-primary-ar arabic-text flex items-center"
        >
          <Plus className="w-5 h-5 ml-2" />
          إضافة مستخدم جديد
        </button>
      </div>

      {/* Users Table */}
      <div className="card-ar">
        {users.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 arabic-text">
              لا يوجد مستخدمين
            </h3>
            <p className="text-gray-600 arabic-text">
              ابدأ بإضافة مستخدم جديد
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-ar">
              <thead>
                <tr>
                  <th>اسم المستخدم</th>
                  <th>الاسم الكامل</th>
                  <th>الدور</th>
                  <th>الصالة</th>
                  <th>نوع الصالة</th>
                  <th>الحالة</th>
                  <th>تاريخ الإنشاء</th>
                  <th>الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td className="font-medium">{user.username}</td>
                    <td>{user.full_name}</td>
                    <td>
                      <span className="status-active">
                        {user.role === 'admin' ? 'مدير' : user.role}
                      </span>
                    </td>
                    <td>{user.gym_name}</td>
                    <td>
                      <span className={user.gym_type === 'male' ? 'status-active' : 'status-expiring'}>
                        {user.gym_type === 'male' ? 'رجال' : 'سيدات'}
                      </span>
                    </td>
                    <td>
                      <button
                        onClick={() => toggleActive(user.id, user.is_active)}
                        className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                          user.is_active
                            ? 'bg-green-100 text-green-800 hover:bg-green-200'
                            : 'bg-red-100 text-red-800 hover:bg-red-200'
                        }`}
                        disabled={user.id === currentUser?.id}
                      >
                        {user.is_active ? 'نشط' : 'معطل'}
                      </button>
                    </td>
                    <td>
                      {new Date(user.created_at).toLocaleDateString('ar-DZ')}
                    </td>
                    <td>
                      <div className="flex items-center space-x-reverse space-x-2">
                        <button
                          onClick={() => handleEdit(user)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        {user.id !== currentUser?.id && (
                          <button
                            onClick={() => handleDelete(user.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
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
              {editingUser ? 'تعديل المستخدم' : 'إضافة مستخدم جديد'}
            </h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-group-ar">
                  <label className="form-label-ar arabic-text">
                    اسم المستخدم *
                  </label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="form-input-ar"
                    placeholder="اسم المستخدم"
                    required
                  />
                </div>

                <div className="form-group-ar">
                  <label className="form-label-ar arabic-text">
                    كلمة المرور {editingUser ? '(اتركها فارغة لعدم التغيير)' : '*'}
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="form-input-ar pl-10"
                      placeholder="كلمة المرور"
                      required={!editingUser}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="form-group-ar">
                <label className="form-label-ar arabic-text">
                  الاسم الكامل *
                </label>
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="form-input-ar"
                  placeholder="الاسم الكامل"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-group-ar">
                  <label className="form-label-ar arabic-text">
                    الدور *
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="form-select-ar"
                    required
                  >
                    <option value="admin">مدير</option>
                    <option value="employee">موظف</option>
                  </select>
                </div>

                <div className="form-group-ar">
                  <label className="form-label-ar arabic-text">
                    الصالة *
                  </label>
                  <select
                    value={formData.gym_id}
                    onChange={(e) => setFormData({ ...formData, gym_id: e.target.value })}
                    className="form-select-ar"
                    required
                  >
                    <option value="">اختر الصالة</option>
                    {gyms.map((gym) => (
                      <option key={gym.id} value={gym.id}>
                        {gym.name} ({gym.type === 'male' ? 'رجال' : 'سيدات'})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group-ar">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="ml-2"
                  />
                  <span className="arabic-text">حساب نشط</span>
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
                  {editingUser ? 'تحديث' : 'إضافة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersPage;