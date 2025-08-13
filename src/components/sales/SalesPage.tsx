import React, { useState, useEffect } from 'react';
import { Plus, Search, Eye, Printer, CreditCard, ShoppingCart, Scan } from 'lucide-react';
import { useGym } from '../../contexts/GymContext';
import { useAuth } from '../../contexts/AuthContext';
import { getQuantityField, hasEnoughStock } from '../../utils/inventory';

interface Invoice {
  id: number;
  invoice_number: string;
  customer_name: string;
  customer_phone: string;
  subtotal: number;
  discount: number;
  total: number;
  paid_amount: number;
  is_credit: boolean;
  created_at: string;
  items: InvoiceItem[];
}

interface InvoiceItem {
  id: number;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface Product {
  id: number;
  name: string;
  barcode: string;
  sale_price: number;
  male_gym_quantity: number;
  female_gym_quantity: number;
}

const SalesPage: React.FC = () => {
  const { gymId, gymType } = useGym();
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  
  const [formData, setFormData] = useState({
    customer_name: '',
    customer_phone: '',
    discount: '0',
    paid_amount: '0',
    is_credit: false,
    is_single_session: false,
    single_session_price: '200',
    items: [] as Array<{
      product_id: number;
      product_name: string;
      quantity: number;
      unit_price: number;
      total_price: number;
    }>
  });

  useEffect(() => {
    loadInvoices();
    loadProducts();
  }, [gymId]);

  // Keyboard shortcuts and barcode scanning
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Open new invoice with Space key
      if (e.code === 'Space' && !showModal && (!e.target || (e.target as HTMLElement).tagName !== 'INPUT')) {
        e.preventDefault();
        openAddModal();
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [showModal]);

  // Barcode scanning effect
  useEffect(() => {
    if (barcodeInput && showModal) {
      const product = products.find(p => p.barcode === barcodeInput);
      if (product) {
        // Add product to invoice
        const existingItemIndex = formData.items.findIndex(item => item.product_id === product.id);
        
        if (existingItemIndex >= 0) {
          // Increase quantity if product already exists
          const newItems = [...formData.items];
          newItems[existingItemIndex].quantity += 1;
          newItems[existingItemIndex].total_price = newItems[existingItemIndex].quantity * newItems[existingItemIndex].unit_price;
          setFormData({ ...formData, items: newItems });
        } else {
          // Add new item
          const newItem = {
            product_id: product.id,
            product_name: product.name,
            quantity: 1,
            unit_price: product.sale_price,
            total_price: product.sale_price
          };
          setFormData({ ...formData, items: [...formData.items, newItem] });
        }
        
        setBarcodeInput(''); // Clear barcode input
      }
    }
  }, [barcodeInput, products, formData.items, showModal]);
  const loadInvoices = async () => {
    try {
      const data = await window.electronAPI.query(`
        SELECT i.*, 
               GROUP_CONCAT(p.name || ' x' || ii.quantity) as items_summary
        FROM invoices i
        LEFT JOIN invoice_items ii ON i.id = ii.invoice_id
        LEFT JOIN products p ON ii.product_id = p.id
        WHERE i.gym_id = ?
        GROUP BY i.id
        ORDER BY i.created_at DESC
      `, [gymId]);
      setInvoices(data);
    } catch (error) {
      console.error('Error loading invoices:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async () => {
    try {
      const data = await window.electronAPI.query(`
        SELECT id, name, barcode, sale_price, male_gym_quantity, female_gym_quantity
        FROM products
        WHERE ${gymType === 'male' ? 'male_gym_quantity' : 'female_gym_quantity'} > 0
        ORDER BY name
      `);
      setProducts(data);
    } catch (error) {
      console.error('Error loading products:', error);
    }
  };

  const generateInvoiceNumber = () => {
    const timestamp = Date.now().toString();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `INV-${timestamp.slice(-8)}-${random}`;
  };

  const addItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, {
        product_id: 0,
        product_name: '',
        quantity: 1,
        unit_price: 0,
        total_price: 0
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
        newItems[index].unit_price = product.sale_price;
        newItems[index].total_price = newItems[index].quantity * product.sale_price;
      }
    } else if (field === 'quantity' || field === 'unit_price') {
      newItems[index].total_price = newItems[index].quantity * newItems[index].unit_price;
    }

    setFormData({ ...formData, items: newItems });
  };

  const calculateSubtotal = () => {
    return formData.items.reduce((sum, item) => sum + item.total_price, 0);
  };

  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    const discount = parseFloat(formData.discount) || 0;
    return subtotal - discount;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.items.length === 0 && !formData.is_single_session) {
      alert('يرجى إضافة منتج واحد على الأقل');
      return;
    }

    try {
      const invoiceNumber = generateInvoiceNumber();
      const subtotal = formData.is_single_session ? parseFloat(formData.single_session_price) : calculateSubtotal();
      const total = formData.is_single_session ? parseFloat(formData.single_session_price) : calculateTotal();
      const paidAmount = parseFloat(formData.paid_amount) || 0;

      // حساب الربح الإجمالي للفاتورة
      let totalProfit = 0;
      
      // لا نحسب ربح للحصص المفردة
      if (!formData.is_single_session) {
        for (const item of formData.items) {
          // الحصول على سعر الشراء للمنتج
          const productData = await window.electronAPI.query(`
            SELECT purchase_price FROM products WHERE id = ?
          `, [item.product_id]);
          
          if (productData.length > 0) {
            const purchasePrice = productData[0].purchase_price;
            // حساب الربح لهذا العنصر بعد الخصم
            const itemProfit = (item.total_price * (total / subtotal)) - (item.quantity * purchasePrice);
            totalProfit += itemProfit;
          }
        }
      }

      // Get current timestamp
      const now = new Date();
      const timestamp = now.toISOString().slice(0, 19).replace('T', ' ');

      // Create invoice with profit
      const invoiceResult = await window.electronAPI.run(`
        INSERT INTO invoices (invoice_number, customer_name, customer_phone, subtotal, 
                             discount, total, profit, paid_amount, is_credit, is_single_session, gym_id, user_id, created_at) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        invoiceNumber,
        formData.customer_name,
        formData.customer_phone,
        subtotal,
        parseFloat(formData.discount) || 0,
        total,
        totalProfit,
        paidAmount,
        formData.is_credit,
        formData.is_single_session,
        gymId,
        user?.id,
        timestamp
      ]);

      const invoiceId = invoiceResult.lastInsertRowid;

      // Add invoice items and update inventory
      if (!formData.is_single_session) {
        for (const item of formData.items) {
          await window.electronAPI.run(`
            INSERT INTO invoice_items (invoice_id, product_id, quantity, unit_price, total_price) 
            VALUES (?, ?, ?, ?, ?)
          `, [invoiceId, item.product_id, item.quantity, item.unit_price, item.total_price]);

          // Update product quantity - خصم الكمية من الكمية المناسبة حسب نوع الصالة
          await window.electronAPI.run(`
            UPDATE products 
            SET male_gym_quantity = male_gym_quantity - ? 
            WHERE id = ?
          `, [item.quantity, item.product_id]);
        }
      }

      await loadInvoices();
      await loadProducts();
      setShowModal(false);
      resetForm();
      alert('تم إنشاء الفاتورة بنجاح');
    } catch (error) {
      console.error('Error creating invoice:', error);
      alert('حدث خطأ في إنشاء الفاتورة');
    }
  };

  const viewInvoice = async (invoice: Invoice) => {
    try {
      const items = await window.electronAPI.query(`
        SELECT ii.*, p.name as product_name
        FROM invoice_items ii
        JOIN products p ON ii.product_id = p.id
        WHERE ii.invoice_id = ?
      `, [invoice.id]);
      
      setSelectedInvoice({ ...invoice, items });
      setShowViewModal(true);
    } catch (error) {
      console.error('Error loading invoice details:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      customer_name: '',
      customer_phone: '',
      discount: '0',
      paid_amount: '0',
      is_credit: false,
      is_single_session: false,
      single_session_price: '200',
      items: []
    });
  };

  const openAddModal = () => {
    resetForm();
    setShowModal(true);
  };

  const filteredInvoices = invoices.filter(invoice => {
    const matchesSearch = invoice.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         invoice.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         invoice.customer_phone?.includes(searchTerm);
    const matchesDate = !dateFilter || invoice.created_at.startsWith(dateFilter);
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
            إدارة المبيعات
          </h1>
          <p className="text-gray-600 arabic-text">
            إنشاء وإدارة فواتير المبيعات
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="btn-primary-ar arabic-text flex items-center"
        >
          <Plus className="w-5 h-5 ml-2" />
          فاتورة جديدة
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
              placeholder="البحث برقم الفاتورة أو اسم الزبون..."
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

      {/* Invoices Table */}
      <div className="card-ar">
        {filteredInvoices.length === 0 ? (
          <div className="text-center py-12">
            <CreditCard className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 arabic-text">
              {searchTerm || dateFilter ? 'لا توجد نتائج' : 'لا توجد فواتير'}
            </h3>
            <p className="text-gray-600 arabic-text">
              {searchTerm || dateFilter ? 'جرب تغيير معايير البحث' : 'ابدأ بإنشاء فاتورة جديدة'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-ar">
              <thead>
                <tr>
                  <th>رقم الفاتورة</th>
                  <th>اسم الزبون</th>
                  <th>رقم الهاتف</th>
                  <th>المجموع الفرعي</th>
                  <th>الخصم</th>
                  <th>المجموع الكلي</th>
                  <th>المبلغ المدفوع</th>
                  <th>نوع الدفع</th>
                  <th>التاريخ</th>
                  <th>الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td className="font-medium">{invoice.invoice_number}</td>
                    <td>{invoice.customer_name || '-'}</td>
                    <td>{invoice.customer_phone || '-'}</td>
                    <td>{formatCurrency(invoice.subtotal)}</td>
                    <td>{formatCurrency(invoice.discount)}</td>
                    <td className="font-bold">{formatCurrency(invoice.total)}</td>
                    <td>{formatCurrency(invoice.paid_amount)}</td>
                    <td>
                      <span className={invoice.is_credit ? 'status-expiring' : 'status-active'}>
                        {invoice.is_credit ? 'آجل' : 'نقدي'}
                      </span>
                    </td>
                    <td>
                      {new Date(invoice.created_at).toLocaleDateString('ar-DZ')}
                    </td>
                    <td>
                      <div className="flex items-center space-x-reverse space-x-2">
                        <button
                          onClick={() => viewInvoice(invoice)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => viewInvoice(invoice)}
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        >
                          <Printer className="w-4 h-4" />
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

      {/* Create Invoice Modal */}
      {showModal && (
        <div className="modal-overlay-ar">
          <div className="modal-content-ar max-w-4xl">
            <h2 className="text-xl font-bold text-gray-900 mb-6 arabic-text">
              إنشاء فاتورة جديدة
            </h2>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Customer Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-group-ar">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.is_single_session}
                      onChange={(e) => setFormData({ ...formData, is_single_session: e.target.checked })}
                      className="ml-2"
                    />
                    <span className="arabic-text">حصة (غير مشترك)</span>
                  </label>
                </div>

                {formData.is_single_session && (
                  <div className="form-group-ar">
                    <label className="form-label-ar arabic-text">
                      سعر الحصة (دج)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.single_session_price}
                      onChange={(e) => setFormData({ ...formData, single_session_price: e.target.value })}
                      className="form-input-ar"
                      placeholder="200"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-group-ar">
                  <label className="form-label-ar arabic-text">
                    اسم الزبون
                  </label>
                  <input
                    type="text"
                    value={formData.customer_name}
                    onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                    className="form-input-ar"
                    placeholder="اسم الزبون (اختياري)"
                  />
                </div>

                <div className="form-group-ar">
                  <label className="form-label-ar arabic-text">
                    رقم الهاتف
                  </label>
                  <input
                    type="tel"
                    value={formData.customer_phone}
                    onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
                    className="form-input-ar"
                    placeholder="رقم الهاتف (اختياري)"
                  />
                </div>
              </div>

              {/* Manual Product Selection */}
              {!formData.is_single_session && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-3 arabic-text">اختيار المنتجات يدوياً</h3>
                  <div className="max-h-40 overflow-y-auto bg-gray-50 rounded-lg p-3">
                    <div className="grid grid-cols-1 gap-2">
                      {products.map((product) => (
                        <button
                          key={product.id}
                          type="button"
                          onClick={() => {
                            const newItem = {
                              product_id: product.id,
                              product_name: product.name,
                              quantity: 1,
                              unit_price: product.sale_price,
                              total_price: product.sale_price
                            };
                            setFormData({ ...formData, items: [...formData.items, newItem] });
                          }}
                          className="flex items-center justify-between p-2 bg-white rounded border hover:bg-blue-50 transition-colors text-right"
                        >
                          <div className="flex-1">
                            <div className="font-medium arabic-text">{product.name}</div>
                            <div className="text-sm text-gray-600">
                              {formatCurrency(product.sale_price)}
                            </div>
                          </div>
                          <div className="text-blue-600 font-bold">+</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Items */}
              {!formData.is_single_session && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold arabic-text">المنتجات</h3>
                  <div className="flex items-center space-x-reverse space-x-2">
                    <div className="relative">
                      <Scan className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                      <input
                        type="text"
                        value={barcodeInput}
                        onChange={(e) => setBarcodeInput(e.target.value)}
                        className="form-input-ar pr-10"
                        placeholder="مسح الباركود..."
                        style={{ width: '200px' }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={addItem}
                      className="btn-secondary-ar arabic-text flex items-center"
                    >
                      <Plus className="w-4 h-4 ml-2" />
                      إضافة منتج
                    </button>
                  </div>
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
                              {product.name} - {formatCurrency(product.sale_price)}
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
                          value={item.unit_price}
                          onChange={(e) => updateItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                          className="form-input-ar"
                          required
                        />
                      </div>

                      <div>
                        <label className="form-label-ar arabic-text">المجموع</label>
                        <input
                          type="text"
                          value={formatCurrency(item.total_price)}
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
              )}

              {/* Totals */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {!formData.is_single_session && (
                  <div className="form-group-ar">
                    <label className="form-label-ar arabic-text">
                      الخصم (دج)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.discount}
                      onChange={(e) => setFormData({ ...formData, discount: e.target.value })}
                      className="form-input-ar"
                    />
                  </div>
                  )}

                  <div className="form-group-ar">
                    <label className="form-label-ar arabic-text">
                      المبلغ المدفوع (دج)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.paid_amount}
                      onChange={(e) => setFormData({ ...formData, paid_amount: e.target.value })}
                      className="form-input-ar"
                    />
                  </div>

                  <div className="form-group-ar">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.is_credit}
                        onChange={(e) => setFormData({ ...formData, is_credit: e.target.checked })}
                        className="ml-2"
                      />
                      <span className="arabic-text">دفع آجل</span>
                    </label>
                  </div>
                </div>

                <div className="mt-4 text-right">
                  <div className="text-lg">
                    <span className="arabic-text">المجموع الفرعي: </span>
                    <span className="font-bold">
                      {formatCurrency(formData.is_single_session ? parseFloat(formData.single_session_price) : calculateSubtotal())}
                    </span>
                  </div>
                  <div className="text-xl font-bold text-green-600">
                    <span className="arabic-text">المجموع الكلي: </span>
                    <span>
                      {formatCurrency(formData.is_single_session ? parseFloat(formData.single_session_price) : calculateTotal())}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600 mt-2">
                    <span className="arabic-text">الوقت: </span>
                    <span>{new Date().toLocaleString('ar-DZ')}</span>
                  </div>
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
                  إنشاء الفاتورة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Invoice Modal */}
      {showViewModal && selectedInvoice && (
        <div className="modal-overlay-ar">
          <div className="modal-content-ar max-w-2xl">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900 arabic-text">
                فاتورة رقم: {selectedInvoice.invoice_number}
              </h2>
              <p className="text-gray-600 arabic-text">
                تاريخ الإنشاء: {new Date(selectedInvoice.created_at).toLocaleDateString('ar-DZ')} - {new Date(selectedInvoice.created_at).toLocaleTimeString('ar-DZ')}
              </p>
            </div>

            {/* Customer Info */}
            {(selectedInvoice.customer_name || selectedInvoice.customer_phone) && (
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="font-semibold mb-2 arabic-text">بيانات الزبون</h3>
                {selectedInvoice.customer_name && (
                  <p className="arabic-text">الاسم: {selectedInvoice.customer_name}</p>
                )}
                {selectedInvoice.customer_phone && (
                  <p className="arabic-text">الهاتف: {selectedInvoice.customer_phone}</p>
                )}
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
                  {selectedInvoice.items.map((item) => (
                    <tr key={item.id}>
                      <td>{item.product_name}</td>
                      <td>{item.quantity}</td>
                      <td>{formatCurrency(item.unit_price)}</td>
                      <td>{formatCurrency(item.total_price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="bg-gray-50 p-4 rounded-lg mb-6">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="arabic-text">المجموع الفرعي:</span>
                  <span>{formatCurrency(selectedInvoice.subtotal)}</span>
                </div>
                {selectedInvoice.discount > 0 && (
                  <div className="flex justify-between">
                    <span className="arabic-text">الخصم:</span>
                    <span>-{formatCurrency(selectedInvoice.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold">
                  <span className="arabic-text">المجموع الكلي:</span>
                  <span>{formatCurrency(selectedInvoice.total)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="arabic-text">المبلغ المدفوع:</span>
                  <span>{formatCurrency(selectedInvoice.paid_amount)}</span>
                </div>
                {selectedInvoice.total > selectedInvoice.paid_amount && (
                  <div className="flex justify-between text-red-600 font-bold">
                    <span className="arabic-text">المبلغ المتبقي:</span>
                    <span>{formatCurrency(selectedInvoice.total - selectedInvoice.paid_amount)}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end space-x-reverse space-x-4">
              <button
                onClick={() => setShowViewModal(false)}
                className="btn-secondary-ar arabic-text"
              >
                إغلاق
              </button>
              <button
                onClick={() => window.print()}
                className="btn-primary-ar arabic-text flex items-center"
              >
                <Printer className="w-4 h-4 ml-2" />
                طباعة
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesPage;