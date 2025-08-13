import React, { useState, useEffect } from 'react';
import { Plus, Search, Eye, ShoppingCart, Package } from 'lucide-react';
import { useGym } from '../../contexts/GymContext';
import { useAuth } from '../../contexts/AuthContext';
import { getQuantityField } from '../../utils/inventory';

interface Purchase {
  id: number;
  supplier_name: string;
  total_amount: number;
  created_at: string;
  items_count: number;
}

interface PurchaseItem {
  id: number;
  product_name: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
}

interface Product {
  id: number;
  name: string;
  purchase_price: number;
}

const PurchasesPage: React.FC = () => {
  const { gymId, gymType } = useGym();
  const { user } = useAuth();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState<{
    purchase: Purchase;
    items: PurchaseItem[];
  } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  
  const [formData, setFormData] = useState({
    supplier_name: '',
    items: [] as Array<{
      product_id: number;
      product_name: string;
      quantity: number;
      unit_cost: number;
      total_cost: number;
    }>
  });

  useEffect(() => {
    loadPurchases();
    loadProducts();
  }, [gymId]);

  const loadPurchases = async () => {
    try {
      const data = await window.electronAPI.query(`
        SELECT p.*, COUNT(pi.id) as items_count
        FROM purchases p
        LEFT JOIN purchase_items pi ON p.id = pi.purchase_id
        WHERE p.gym_id = ?
        GROUP BY p.id
        ORDER BY p.created_at DESC
      `, [gymId]);
      setPurchases(data);
    } catch (error) {
      console.error('Error loading purchases:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async () => {
    try {
      const data = await window.electronAPI.query(`
        SELECT id, name, purchase_price
        FROM products
        ORDER BY name
      `);
      setProducts(data);
    } catch (error) {
      console.error('Error loading products:', error);
    }
  };

  const addItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, {
        product_id: 0,
        product_name: '',
        quantity: 1,
        unit_cost: 0,
        total_cost: 0
      }]
    });
  };

  const removeItem = (index: number) => {
    const newItems = formData.items.filter((_, i) => i !== index);
    setFormData({ ...formData, items: newItems });
  };

  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [field]: value };

    if (field === 'product_id') {
      const product = products.find(p => p.id === parseInt(value));
      if (product) {
        newItems[index].product_name = product.name;
        newItems[index].unit_cost = product.purchase_price;
        newItems[index].total_cost = newItems[index].quantity * product.purchase_price;
      }
    } else if (field === 'quantity' || field === 'unit_cost') {
      newItems[index].total_cost = newItems[index].quantity * newItems[index].unit_cost;
    }

    setFormData({ ...formData, items: newItems });
  };

  const calculateTotal = () => {
    return formData.items.reduce((sum, item) => sum + item.total_cost, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.items.length === 0) {
      alert('يرجى إضافة منتج واحد على الأقل');
      return;
    }

    try {
      const totalAmount = calculateTotal();

      // Create purchase
      const purchaseResult = await window.electronAPI.run(`
        INSERT INTO purchases (supplier_name, total_amount, gym_id, user_id) 
        VALUES (?, ?, ?, ?)
      `, [
        formData.supplier_name,
        totalAmount,
        gymId,
        user?.id
      ]);

      const purchaseId = purchaseResult.lastInsertRowid;

      // Add purchase items and update inventory
      for (const item of formData.items) {
        await window.electronAPI.run(`
          INSERT INTO purchase_items (purchase_id, product_id, quantity, unit_cost, total_cost) 
          VALUES (?, ?, ?, ?, ?)
        `, [purchaseId, item.product_id, item.quantity, item.unit_cost, item.total_cost]);

        // Update product quantity and purchase price - إضافة الكمية إلى الكمية المناسبة حسب نوع الصالة
        await window.electronAPI.run(`
          UPDATE products 
          SET male_gym_quantity = male_gym_quantity + ?, purchase_price = ?
          WHERE id = ?
        `, [item.quantity, item.unit_cost, item.product_id]);
      }

      await loadPurchases();
      setShowModal(false);
      resetForm();
      alert('تم تسجيل المشتريات بنجاح');
    } catch (error) {
      console.error('Error creating purchase:', error);
      alert('حدث خطأ في تسجيل المشتريات');
    }
  };

  const viewPurchase = async (purchase: Purchase) => {
    try {
      const items = await window.electronAPI.query(`
        SELECT pi.*, p.name as product_name
        FROM purchase_items pi
        JOIN products p ON pi.product_id = p.id
        WHERE pi.purchase_id = ?
      `, [purchase.id]);
      
      setSelectedPurchase({ purchase, items });
      setShowViewModal(true);
    } catch (error) {
      console.error('Error loading purchase details:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      supplier_name: '',
      items: []
    });
  };

  const openAddModal = () => {
    resetForm();
    setShowModal(true);
  };

  const filteredPurchases = purchases.filter(purchase => {
    const matchesSearch = purchase.supplier_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDate = !dateFilter || purchase.created_at.startsWith(dateFilter);
    return matchesSearch && matchesDate;
  });

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
            إدارة المشتريات
          </h1>
          <p className="text-gray-600 arabic-text">
            إدارة مشتريات المخزون والموردين
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="btn-primary-ar arabic-text flex items-center"
        >
          <Plus className="w-5 h-5 ml-2" />
          مشتريات جديدة
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
              placeholder="البحث باسم المورد..."
            />
          </div>
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="form-input-ar"
          />
        </div>
      </div>

      {/* Purchases Table */}
      <div className="card-ar">
        {filteredPurchases.length === 0 ? (
          <div className="text-center py-12">
            <ShoppingCart className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 arabic-text">
              {searchTerm || dateFilter ? 'لا توجد نتائج' : 'لا توجد مشتريات'}
            </h3>
            <p className="text-gray-600 arabic-text">
              {searchTerm || dateFilter ? 'جرب تغيير معايير البحث' : 'ابدأ بتسجيل مشتريات جديدة'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-ar">
              <thead>
                <tr>
                  <th>اسم المورد</th>
                  <th>عدد المنتجات</th>
                  <th>المبلغ الإجمالي</th>
                  <th>تاريخ الشراء</th>
                  <th>الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filteredPurchases.map((purchase) => (
                  <tr key={purchase.id}>
                    <td className="font-medium">{purchase.supplier_name || 'غير محدد'}</td>
                    <td>{purchase.items_count} منتج</td>
                    <td className="font-bold">{formatCurrency(purchase.total_amount)}</td>
                    <td>
                      {new Date(purchase.created_at).toLocaleDateString('ar-DZ')}
                    </td>
                    <td>
                      <button
                        onClick={() => viewPurchase(purchase)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Purchase Modal */}
      {showModal && (
        <div className="modal-overlay-ar">
          <div className="modal-content-ar max-w-4xl">
            <h2 className="text-xl font-bold text-gray-900 mb-6 arabic-text">
              تسجيل مشتريات جديدة
            </h2>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Supplier Info */}
              <div className="form-group-ar">
                <label className="form-label-ar arabic-text">
                  اسم المورد
                </label>
                <input
                  type="text"
                  value={formData.supplier_name}
                  onChange={(e) => setFormData({ ...formData, supplier_name: e.target.value })}
                  className="form-input-ar"
                  placeholder="اسم المورد (اختياري)"
                />
              </div>

              {/* Items */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold arabic-text">المنتجات</h3>
                  <button
                    type="button"
                    onClick={addItem}
                    className="btn-secondary-ar arabic-text flex items-center"
                  >
                    <Plus className="w-4 h-4 ml-2" />
                    إضافة منتج
                  </button>
                </div>

                <div className="space-y-4">
                  {formData.items.map((item, index) => (
                    <div key={index} className="grid grid-cols-1 md:grid-cols-5 gap-4 p-4 bg-gray-50 rounded-lg">
                      <div>
                        <label className="form-label-ar arabic-text">المنتج</label>
                        <select
                          value={item.product_id}
                          onChange={(e) => updateItem(index, 'product_id', e.target.value)}
                          className="form-select-ar"
                          required
                        >
                          <option value="">اختر المنتج</option>
                          {products.map((product) => (
                            <option key={product.id} value={product.id}>
                              {product.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="form-label-ar arabic-text">الكمية</label>
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                          className="form-input-ar"
                          required
                        />
                      </div>

                      <div>
                        <label className="form-label-ar arabic-text">سعر الوحدة</label>
                        <input
                          type="number"
                          step="0.01"
                          value={item.unit_cost}
                          onChange={(e) => updateItem(index, 'unit_cost', parseFloat(e.target.value) || 0)}
                          className="form-input-ar"
                          required
                        />
                      </div>

                      <div>
                        <label className="form-label-ar arabic-text">المجموع</label>
                        <input
                          type="text"
                          value={formatCurrency(item.total_cost)}
                          className="form-input-ar"
                          readOnly
                        />
                      </div>

                      <div className="flex items-end">
                        <button
                          type="button"
                          onClick={() => removeItem(index)}
                          className="btn-danger-ar w-full"
                        >
                          حذف
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total */}
              <div className="bg-gray-50 p-4 rounded-lg text-right">
                <div className="text-xl font-bold text-green-600">
                  <span className="arabic-text">المجموع الكلي: </span>
                  <span>{formatCurrency(calculateTotal())}</span>
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
                  تسجيل المشتريات
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Purchase Modal */}
      {showViewModal && selectedPurchase && (
        <div className="modal-overlay-ar">
          <div className="modal-content-ar max-w-2xl">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900 arabic-text">
                تفاصيل المشتريات
              </h2>
              <p className="text-gray-600 arabic-text">
                تاريخ الشراء: {new Date(selectedPurchase.purchase.created_at).toLocaleDateString('ar-DZ')}
              </p>
            </div>

            {/* Supplier Info */}
            {selectedPurchase.purchase.supplier_name && (
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="font-semibold mb-2 arabic-text">بيانات المورد</h3>
                <p className="arabic-text">الاسم: {selectedPurchase.purchase.supplier_name}</p>
              </div>
            )}

            {/* Items */}
            <div className="mb-6">
              <h3 className="font-semibold mb-4 arabic-text">تفاصيل المنتجات</h3>
              <table className="table-ar">
                <thead>
                  <tr>
                    <th>المنتج</th>
                    <th>الكمية</th>
                    <th>سعر الوحدة</th>
                    <th>المجموع</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedPurchase.items.map((item) => (
                    <tr key={item.id}>
                      <td>{item.product_name}</td>
                      <td>{item.quantity}</td>
                      <td>{formatCurrency(item.unit_cost)}</td>
                      <td>{formatCurrency(item.total_cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Total */}
            <div className="bg-gray-50 p-4 rounded-lg mb-6">
              <div className="text-xl font-bold text-green-600 text-right">
                <span className="arabic-text">المجموع الكلي: </span>
                <span>{formatCurrency(selectedPurchase.purchase.total_amount)}</span>
              </div>
            </div>

            <div className="flex items-center justify-end">
              <button
                onClick={() => setShowViewModal(false)}
                className="btn-secondary-ar arabic-text"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PurchasesPage;