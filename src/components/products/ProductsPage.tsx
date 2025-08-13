import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Package, Search, Barcode } from 'lucide-react';
import { useGym } from '../../contexts/GymContext';
import { getTotalQuantity, formatQuantityDisplay } from '../../utils/inventory';

interface Product {
  id: number;
  barcode: string;
  name: string;
  category_name: string;
  purchase_price: number;
  sale_price: number;
  male_gym_quantity: number;
  female_gym_quantity: number;
  image_path: string;
  notes: string;
  created_at: string;
}

interface Category {
  id: number;
  name: string;
}

const ProductsPage: React.FC = () => {
  const { gymType } = useGym();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    barcodeInput: '',
    barcode: '',
    name: '',
    category_id: '',
    purchase_price: '',
    sale_price: '',
    quantity: '',
    notes: ''
  });

  // Barcode scanning effect
  useEffect(() => {
    if (formData.barcodeInput && showModal) {
      setFormData(prev => ({
        ...prev,
        barcode: prev.barcodeInput,
        barcodeInput: ''
      }));
    }
  }, [formData.barcodeInput, showModal]);

  // Global keyboard listener for barcode scanning in modal
  useEffect(() => {
    if (!showModal) return;

    setTimeout(() => {
      const barcodeInputElement = document.getElementById('product-barcode-input');
      if (barcodeInputElement) {
        barcodeInputElement.focus();
      }
    }, 100);
  }, [showModal]);

  useEffect(() => {
    loadProducts();
    loadCategories();
  }, []);

  const loadProducts = async () => {
    try {
      const data = await window.electronAPI.query(`
        SELECT p.*, c.name as category_name
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        ORDER BY p.created_at DESC
      `);
      setProducts(data);
    } catch (error) {
      console.error('Error loading products:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const data = await window.electronAPI.query('SELECT * FROM categories ORDER BY name');
      setCategories(data);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const generateBarcode = () => {
    const timestamp = Date.now().toString();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `${timestamp.slice(-8)}${random}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const barcode = formData.barcode || generateBarcode();
      const quantity = parseInt(formData.quantity) || 0;
      
      if (editingProduct) {
        // تحديث المنتج الحالي
        const quantityField = gymType === 'male' ? 'male_gym_quantity' : 'female_gym_quantity';
        
        await window.electronAPI.run(`
          UPDATE products 
          SET barcode = ?, name = ?, category_id = ?, purchase_price = ?, 
              sale_price = ?, ${quantityField} = ?, notes = ?
          WHERE id = ?
        `, [
          barcode,
          formData.name,
          formData.category_id || null,
          parseFloat(formData.purchase_price) || 0,
          parseFloat(formData.sale_price) || 0,
          quantity, // يتم استخدام الكمية الجديدة مباشرة
          formData.notes,
          editingProduct.id
        ]);
      } else {
        // إنشاء منتج جديد
        const maleQuantity = gymType === 'male' ? quantity : 0;
        const femaleQuantity = gymType === 'female' ? quantity : 0;
        
        await window.electronAPI.run(`
          INSERT INTO products (barcode, name, category_id, purchase_price, sale_price, 
                                male_gym_quantity, female_gym_quantity, notes) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          barcode,
          formData.name,
          formData.category_id || null,
          parseFloat(formData.purchase_price) || 0,
          parseFloat(formData.sale_price) || 0,
          maleQuantity,
          femaleQuantity,
          formData.notes
        ]);
      }
      
      await loadProducts();
      setShowModal(false);
      setEditingProduct(null);
      resetForm();
    } catch (error) {
      console.error('Error saving product:', error);
      alert('حدث خطأ في حفظ المنتج');
    }
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    const currentQuantity = gymType === 'male' ? product.male_gym_quantity : product.female_gym_quantity;
    setFormData({
      barcodeInput: '',
      barcode: product.barcode || '',
      name: product.name,
      category_id: (product as any).category_id?.toString() || '',
      purchase_price: product.purchase_price.toString(),
      sale_price: product.sale_price.toString(),
      quantity: currentQuantity.toString(), // يتم عرض الكمية في الصالة الحالي
      notes: product.notes || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('هل أنت متأكد من حذف هذا المنتج؟')) {
      try {
        await window.electronAPI.run('DELETE FROM products WHERE id = ?', [id]);
        await loadProducts();
      } catch (error) {
        console.error('Error deleting product:', error);
        alert('لا يمكن حذف هذا المنتج لأنه مرتبط بفواتير');
      }
    }
  };

  const resetForm = () => {
    setFormData({
      barcodeInput: '',
      barcode: '',
      name: '',
      category_id: '',
      purchase_price: '',
      sale_price: '',
      quantity: '',
      notes: ''
    });
  };

  const openAddModal = () => {
    setEditingProduct(null);
    resetForm();
    setShowModal(true);
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.barcode?.includes(searchTerm) ||
    product.category_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getCurrentQuantity = (product: Product) => {
    return getTotalQuantity(product);
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
            إدارة المنتجات
          </h1>
          <p className="text-gray-600 arabic-text">
            إدارة مخزون المنتجات في الصالة
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="btn-primary-ar arabic-text flex items-center"
        >
          <Plus className="w-5 h-5 ml-2" />
          إضافة منتج جديد
        </button>
      </div>

      {/* Search */}
      <div className="card-ar">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="form-input-ar pr-10"
            placeholder="البحث في المنتجات..."
          />
        </div>
      </div>

      {/* Products Table */}
      <div className="card-ar">
        {filteredProducts.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 arabic-text">
              {searchTerm ? 'لا توجد نتائج' : 'لا توجد منتجات'}
            </h3>
            <p className="text-gray-600 arabic-text">
              {searchTerm ? 'جرب البحث بكلمات مختلفة' : 'ابدأ بإضافة منتج جديد'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-ar">
              <thead>
                <tr>
                  <th>الباركود</th>
                  <th>اسم المنتج</th>
                  <th>الفئة</th>
                  <th>سعر الشراء</th>
                  <th>سعر البيع</th>
                  <th>الكمية</th>
                  <th>الحالة</th>
                  <th>الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product) => {
                  const quantityInfo = formatQuantityDisplay(product, gymType);
                  
                  return (
                    <tr key={product.id}>
                      <td>
                        <div className="flex items-center">
                          <Barcode className="w-4 h-4 ml-2 text-gray-400" />
                          {product.barcode || '-'}
                        </div>
                      </td>
                      <td className="font-medium">{product.name}</td>
                      <td>{product.category_name || '-'}</td>
                      <td>{product.purchase_price.toFixed(2)} دج</td>
                      <td>{product.sale_price.toFixed(2)} دج</td>
                      <td>
                        <div className="text-sm">
                          <div className={`font-medium ${quantityInfo.isLowStock ? 'text-red-600' : 'text-green-600'}`}>
                            {quantityInfo.total} (إجمالي)
                          </div>
                          <div className="text-gray-500 text-xs">
                            {quantityInfo.available} متاح
                          </div>
                        </div>
                      </td>
                      <td>
                        {quantityInfo.isLowStock ? (
                          <span className="status-expired">{quantityInfo.status}</span>
                        ) : (
                          <span className="status-active">{quantityInfo.status}</span>
                        )}
                      </td>
                      <td>
                        <div className="flex items-center space-x-reverse space-x-2">
                          <button
                            onClick={() => handleEdit(product)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(product.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
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
              {editingProduct ? 'تعديل المنتج' : 'إضافة منتج جديد'}
            </h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Barcode Scanner Input */}
                <div className="form-group-ar">
                  <label className="form-label-ar arabic-text">
                    مسح الباركود
                  </label>
                  <input
                    id="product-barcode-input"
                    type="text"
                    value={formData.barcodeInput}
                    onChange={(e) => setFormData({ ...formData, barcodeInput: e.target.value })}
                    className="form-input-ar text-center text-lg font-mono"
                    placeholder="امسح الباركود هنا..."
                    autoFocus
                  />
                </div>

                <div className="form-group-ar">
                  <label className="form-label-ar arabic-text">
                    الباركود
                  </label>
                  <input
                    type="text"
                    value={formData.barcode}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                    className="form-input-ar"
                    placeholder="سيتم إنشاؤه من المسح أو يدوياً"
                    readOnly={!!formData.barcodeInput}
                  />
                </div>
              </div>

              <div className="form-group-ar">
                <label className="form-label-ar arabic-text">
                  اسم المنتج *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="form-input-ar"
                  placeholder="أدخل اسم المنتج"
                  required
                />
              </div>

              <div className="form-group-ar">
                <label className="form-label-ar arabic-text">
                  الفئة
                </label>
                <select
                  value={formData.category_id}
                  onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                  className="form-select-ar"
                >
                  <option value="">اختر الفئة</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="form-group-ar">
                  <label className="form-label-ar arabic-text">
                    سعر الشراء (دج)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.purchase_price}
                    onChange={(e) => setFormData({ ...formData, purchase_price: e.target.value })}
                    className="form-input-ar"
                    placeholder="0.00"
                  />
                </div>

                <div className="form-group-ar">
                  <label className="form-label-ar arabic-text">
                    سعر البيع (دج) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.sale_price}
                    onChange={(e) => setFormData({ ...formData, sale_price: e.target.value })}
                    className="form-input-ar"
                    placeholder="0.00"
                    required
                  />
                </div>

                <div className="form-group-ar">
                  <label className="form-label-ar arabic-text">
                    الكمية
                  </label>
                  <input
                    type="number"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    className="form-input-ar"
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="form-group-ar">
                <label className="form-label-ar arabic-text">
                  ملاحظات
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="form-input-ar"
                  placeholder="ملاحظات إضافية (اختياري)"
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
                  {editingProduct ? 'تحديث' : 'إضافة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductsPage;