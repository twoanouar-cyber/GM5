import React, { useState, useEffect } from 'react';
import { Plus, Search, Eye, UserPlus, Package } from 'lucide-react';
import { useGym } from '../../contexts/GymContext';
import { useAuth } from '../../contexts/AuthContext';
import { getQuantityField } from '../../utils/inventory';

interface InternalSale {
  id: number;
  admin_name: string;
  product_name: string;
  quantity: number;
  price_type: 'purchase' | 'manual';
  unit_price: number;
  total_price: number;
  created_at: string;
}

interface Product {
  id: number;
  name: string;
  purchase_price: number;
  sale_price: number;
  male_gym_quantity: number;
  female_gym_quantity: number;
}

const InternalSalesPage: React.FC = () => {
  const { gymId, gymType } = useGym();
  const { user } = useAuth();
  const [internalSales, setInternalSales] = useState<InternalSale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  
  const [formData, setFormData] = useState({
    admin_name: user?.full_name || '',
    product_id: '',
    quantity: '1',
    price_type: 'purchase' as 'purchase' | 'manual',
    unit_price: '0'
  });

  useEffect(() => {
    loadInternalSales();
    loadProducts();
  }, [gymId]);

  const loadInternalSales = async () => {
    try {
      const data = await window.electronAPI.query(`
        SELECT i.*, p.name as product_name
        FROM internal_sales i
        JOIN products p ON i.product_id = p.id
        WHERE i.gym_id = ?
        ORDER BY i.created_at DESC
      `, [gymId]);
      setInternalSales(data);
    } catch (error) {
      console.error('Error loading internal sales:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async () => {
    try {
      const data = await window.electronAPI.query(`
        SELECT id, name, purchase_price, sale_price, male_gym_quantity, female_gym_quantity
        FROM products
        WHERE ${gymType === 'male' ? 'male_gym_quantity' : 'female_gym_quantity'} > 0
        ORDER BY name
      `);
      setProducts(data);
    } catch (error) {
      console.error('Error loading products:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const selectedProduct = products.find(p => p.id === parseInt(formData.product_id));
      if (!selectedProduct) {
        alert('يرجى اختيار المنتج');
        return;
      }

      const quantity = parseInt(formData.quantity);
      const unitPrice = formData.price_type === 'purchase' 
        ? selectedProduct.purchase_price 
        : parseFloat(formData.unit_price);
      const totalPrice = quantity * unitPrice;

      // حساب الربح - إذا كان السعر يدوي، احسب الربح، وإلا فالربح = 0
      let profit = 0;
      if (formData.price_type === 'manual') {
        profit = totalPrice - (quantity * selectedProduct.purchase_price);
      }

      // Create internal sale with profit
      await window.electronAPI.run(`
        INSERT INTO internal_sales (admin_name, product_id, quantity, price_type, 
                                   unit_price, total_price, profit, gym_id, user_id) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        formData.admin_name,
        parseInt(formData.product_id),
        quantity,
        formData.price_type,
        unitPrice,
        totalPrice,
        profit,
        gymId,
        user?.id
      ]);

      // Update product quantity - خصم الكمية من الكمية المناسبة حسب نوع الصالة
      await window.electronAPI.run(`
        UPDATE products 
        SET male_gym_quantity = male_gym_quantity - ? 
        WHERE id = ?
      `, [quantity, parseInt(formData.product_id)]);

      await loadInternalSales();
      await loadProducts();
      setShowModal(false);
      resetForm();
      alert('تم تسجيل البيع الداخلي بنجاح');
    } catch (error) {
      console.error('Error creating internal sale:', error);
      alert('حدث خطأ في تسجيل البيع الداخلي');
    }
  };

  const resetForm = () => {
    setFormData({
      admin_name: user?.full_name || '',
      product_id: '',
      quantity: '1',
      price_type: 'purchase',
      unit_price: '0'
    });
  };

  const openAddModal = () => {
    resetForm();
    setShowModal(true);
  };

  const handleProductChange = (productId: string) => {
    const product = products.find(p => p.id === parseInt(productId));
    setFormData({
      ...formData,
      product_id: productId,
      unit_price: product ? product.purchase_price.toString() : '0'
    });
  };

  const filteredSales = internalSales.filter(sale => {
    const matchesSearch = sale.admin_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         sale.product_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDate = !dateFilter || sale.created_at.startsWith(dateFilter);
    return matchesSearch && matchesDate;
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ar-DZ', {
      style: 'currency',
      currency: 'DZD',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const getTotalSales = () => {
    return filteredSales.reduce((sum, sale) => sum + sale.total_price, 0);
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
            القائمة البيضاء
          </h1>
          <p className="text-gray-600 arabic-text">
            خاصة بموظفين الصالة
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="btn-primary-ar arabic-text flex items-center"
        >
          <Plus className="w-5 h-5 ml-2" />
          بيع داخلي جديد
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card-ar">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 arabic-text">إجمالي العمليات</p>
              <p className="text-2xl font-bold text-gray-900">{filteredSales.length}</p>
            </div>
            <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center">
              <UserPlus className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        <div className="card-ar">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 arabic-text">إجمالي المبيعات</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(getTotalSales())}</p>
            </div>
            <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center">
              <Package className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        <div className="card-ar">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 arabic-text">متوسط البيع</p>
              <p className="text-2xl font-bold text-gray-900">
                {filteredSales.length > 0 ? formatCurrency(getTotalSales() / filteredSales.length) : formatCurrency(0)}
              </p>
            </div>
            <div className="w-12 h-12 bg-purple-500 rounded-lg flex items-center justify-center">
              <Eye className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>
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
              placeholder="البحث باسم الإداري أو المنتج..."
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

      {/* Sales Table */}
      <div className="card-ar">
        {filteredSales.length === 0 ? (
          <div className="text-center py-12">
            <UserPlus className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 arabic-text">
              {searchTerm || dateFilter ? 'لا توجد نتائج' : 'لا توجد مبيعات داخلية'}
            </h3>
            <p className="text-gray-600 arabic-text">
              {searchTerm || dateFilter ? 'جرب تغيير معايير البحث' : 'ابدأ بتسجيل بيع داخلي جديد'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-ar">
              <thead>
                <tr>
                  <th>اسم الإداري</th>
                  <th>المنتج</th>
                  <th>الكمية</th>
                  <th>نوع السعر</th>
                  <th>سعر الوحدة</th>
                  <th>المجموع</th>
                  <th>التاريخ</th>
                </tr>
              </thead>
              <tbody>
                {filteredSales.map((sale) => (
                  <tr key={sale.id}>
                    <td className="font-medium">{sale.admin_name}</td>
                    <td>{sale.product_name}</td>
                    <td>{sale.quantity}</td>
                    <td>
                      <span className={sale.price_type === 'purchase' ? 'status-active' : 'status-expiring'}>
                        {sale.price_type === 'purchase' ? 'سعر التكلفة' : 'سعر يدوي'}
                      </span>
                    </td>
                    <td>{formatCurrency(sale.unit_price)}</td>
                    <td className="font-bold">{formatCurrency(sale.total_price)}</td>
                    <td>
                      {new Date(sale.created_at).toLocaleDateString('ar-DZ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Sale Modal */}
      {showModal && (
        <div className="modal-overlay-ar">
          <div className="modal-content-ar">
            <h2 className="text-xl font-bold text-gray-900 mb-6 arabic-text">
              تسجيل بيع داخلي جديد
            </h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="form-group-ar">
                <label className="form-label-ar arabic-text">
                  اسم الإداري *
                </label>
                <input
                  type="text"
                  value={formData.admin_name}
                  onChange={(e) => setFormData({ ...formData, admin_name: e.target.value })}
                  className="form-input-ar"
                  placeholder="اسم الإداري أو الموظف"
                  required
                />
              </div>

              <div className="form-group-ar">
                <label className="form-label-ar arabic-text">
                  المنتج *
                </label>
                <select
                  value={formData.product_id}
                  onChange={(e) => handleProductChange(e.target.value)}
                  className="form-select-ar"
                  required
                >
                  <option value="">اختر المنتج</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} - متوفر: {gymType === 'male' ? product.male_gym_quantity : product.female_gym_quantity}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-group-ar">
                  <label className="form-label-ar arabic-text">
                    الكمية *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    className="form-input-ar"
                    required
                  />
                </div>

                <div className="form-group-ar">
                  <label className="form-label-ar arabic-text">
                    نوع السعر *
                  </label>
                  <select
                    value={formData.price_type}
                    onChange={(e) => {
                      const priceType = e.target.value as 'purchase' | 'manual';
                      const product = products.find(p => p.id === parseInt(formData.product_id));
                      setFormData({ 
                        ...formData, 
                        price_type: priceType,
                        unit_price: priceType === 'purchase' && product 
                          ? product.purchase_price.toString() 
                          : '0'
                      });
                    }}
                    className="form-select-ar"
                    required
                  >
                    <option value="purchase">سعر التكلفة</option>
                    <option value="manual">سعر يدوي</option>
                  </select>
                </div>
              </div>

              <div className="form-group-ar">
                <label className="form-label-ar arabic-text">
                  سعر الوحدة (دج) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.unit_price}
                  onChange={(e) => setFormData({ ...formData, unit_price: e.target.value })}
                  className="form-input-ar"
                  disabled={formData.price_type === 'purchase'}
                  required
                />
              </div>

              {/* Total Preview */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="text-lg font-bold text-green-600 text-right">
                  <span className="arabic-text">المجموع: </span>
                  <span>
                    {formatCurrency(
                      parseInt(formData.quantity || '0') * parseFloat(formData.unit_price || '0')
                    )}
                  </span>
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
                  تسجيل البيع
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default InternalSalesPage;