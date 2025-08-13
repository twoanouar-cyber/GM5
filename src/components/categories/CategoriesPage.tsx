import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Tag } from 'lucide-react';

interface Category {
  id: number;
  name: string;
  description: string;
  created_at: string;
}

const CategoriesPage: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: ''
  });

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const data = await window.electronAPI.query(`
        SELECT * FROM categories 
        ORDER BY created_at DESC
      `);
      setCategories(data);
    } catch (error) {
      console.error('Error loading categories:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingCategory) {
        // Update existing category
        await window.electronAPI.run(`
          UPDATE categories 
          SET name = ?, description = ? 
          WHERE id = ?
        `, [formData.name, formData.description, editingCategory.id]);
      } else {
        // Create new category
        await window.electronAPI.run(`
          INSERT INTO categories (name, description) 
          VALUES (?, ?)
        `, [formData.name, formData.description]);
      }
      
      await loadCategories();
      setShowModal(false);
      setEditingCategory(null);
      setFormData({ name: '', description: '' });
    } catch (error) {
      console.error('Error saving category:', error);
    }
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      description: category.description
    });
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('هل أنت متأكد من حذف هذه الفئة؟')) {
      try {
        await window.electronAPI.run('DELETE FROM categories WHERE id = ?', [id]);
        await loadCategories();
      } catch (error) {
        console.error('Error deleting category:', error);
        alert('لا يمكن حذف هذه الفئة لأنها مرتبطة بمنتجات');
      }
    }
  };

  const openAddModal = () => {
    setEditingCategory(null);
    setFormData({ name: '', description: '' });
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
            إدارة الفئات
          </h1>
          <p className="text-gray-600 arabic-text">
            إدارة فئات المنتجات في الصالة
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="btn-primary-ar arabic-text flex items-center"
        >
          <Plus className="w-5 h-5 ml-2" />
          إضافة فئة جديدة
        </button>
      </div>

      {/* Categories Table */}
      <div className="card-ar">
        {categories.length === 0 ? (
          <div className="text-center py-12">
            <Tag className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 arabic-text">
              لا توجد فئات
            </h3>
            <p className="text-gray-600 arabic-text">
              ابدأ بإضافة فئة جديدة لتنظيم منتجاتك
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-ar">
              <thead>
                <tr>
                  <th>اسم الفئة</th>
                  <th>الوصف</th>
                  <th>تاريخ الإنشاء</th>
                  <th>الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((category) => (
                  <tr key={category.id}>
                    <td className="font-medium">{category.name}</td>
                    <td>{category.description || '-'}</td>
                    <td>
                      {new Date(category.created_at).toLocaleDateString('ar-DZ')}
                    </td>
                    <td>
                      <div className="flex items-center space-x-reverse space-x-2">
                        <button
                          onClick={() => handleEdit(category)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(category.id)}
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
              {editingCategory ? 'تعديل الفئة' : 'إضافة فئة جديدة'}
            </h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="form-group-ar">
                <label className="form-label-ar arabic-text">
                  اسم الفئة *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="form-input-ar"
                  placeholder="أدخل اسم الفئة"
                  required
                />
              </div>

              <div className="form-group-ar">
                <label className="form-label-ar arabic-text">
                  الوصف
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="form-input-ar"
                  placeholder="أدخل وصف الفئة (اختياري)"
                  rows={3}
                />
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
                  {editingCategory ? 'تحديث' : 'إضافة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CategoriesPage;