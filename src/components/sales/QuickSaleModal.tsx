import React, { useState, useEffect } from 'react';
import { X, Plus, Minus, Scan, User, CreditCard, Calculator, ShoppingCart } from 'lucide-react';
import { useGym } from '../../contexts/GymContext';
import { useAuth } from '../../contexts/AuthContext';

interface Product {
  id: number;
  name: string;
  barcode: string;
  sale_price: number;
  purchase_price: number;
  male_gym_quantity: number;
  female_gym_quantity: number;
}

interface Customer {
  id: number;
  name: string;
  phone: string;
}

interface QuickSaleItem {
  product_id: number;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface QuickSaleModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const QuickSaleModal: React.FC<QuickSaleModalProps> = ({ isOpen, onClose }) => {
  const { gymId, gymType } = useGym();
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [items, setItems] = useState<QuickSaleItem[]>([]);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [discount, setDiscount] = useState(0);
  const [paidAmount, setPaidAmount] = useState(0);
  const [isCredit, setIsCredit] = useState(false);
  const [showProductSelector, setShowProductSelector] = useState(false);
  const [isSingleSession, setIsSingleSession] = useState(false);
  const [singleSessionPrice, setSingleSessionPrice] = useState(200);
  const [newCustomer, setNewCustomer] = useState({
    name: '',
    phone: '',
    email: '',
    address: ''
  });

  useEffect(() => {
    if (isOpen) {
      loadProducts();
      loadCustomers();
      // Focus on barcode input when modal opens
      setTimeout(() => {
        const barcodeInputElement = document.getElementById('barcode-input');
        if (barcodeInputElement) {
          barcodeInputElement.focus();
        }
      }, 100);
    }
  }, [isOpen, gymId]);

  // Barcode scanning effect
  useEffect(() => {
    if (barcodeInput && isOpen) {
      const product = products.find(p => p.barcode === barcodeInput);
      if (product) {
        addProductToInvoice(product);
        setBarcodeInput('');
      }
    }
  }, [barcodeInput, products, isOpen]);

  // Global keyboard listener for barcode scanning
  useEffect(() => {
    if (!isOpen) return;

    let barcodeBuffer = '';
    let lastKeyTime = Date.now();

    const handleKeyPress = (e: KeyboardEvent) => {
      const currentTime = Date.now();
      
      // If more than 100ms between keystrokes, reset buffer (new scan)
      if (currentTime - lastKeyTime > 100) {
        barcodeBuffer = '';
      }
      
      lastKeyTime = currentTime;

      // Add character to buffer
      if (e.key.length === 1) {
        barcodeBuffer += e.key;
      }

      // If Enter is pressed or buffer is long enough, process as barcode
      if (e.key === 'Enter' && barcodeBuffer.length > 3) {
        e.preventDefault();
        const product = products.find(p => p.barcode === barcodeBuffer);
        if (product) {
          addProductToInvoice(product);
        }
        barcodeBuffer = '';
      }
    };

    document.addEventListener('keypress', handleKeyPress);
    return () => document.removeEventListener('keypress', handleKeyPress);
  }, [isOpen, products]);

  const loadProducts = async () => {
    try {
      const data = await window.electronAPI.query(`
        SELECT id, name, barcode, sale_price, purchase_price, male_gym_quantity, female_gym_quantity
        FROM products
        WHERE male_gym_quantity + female_gym_quantity > 0
        ORDER BY name
      `);
      setProducts(data);
    } catch (error) {
      console.error('Error loading products:', error);
    }
  };

  const addProductManually = (product: Product) => {
    const existingItemIndex = items.findIndex(item => item.product_id === product.id);
    
    if (existingItemIndex >= 0) {
      // Increase quantity if product already exists
      const newItems = [...items];
      newItems[existingItemIndex].quantity += 1;
      newItems[existingItemIndex].total_price = newItems[existingItemIndex].quantity * newItems[existingItemIndex].unit_price;
      setItems(newItems);
    } else {
      // Add new item
      const newItem: QuickSaleItem = {
        product_id: product.id,
        product_name: product.name,
        quantity: 1,
        unit_price: product.sale_price,
        total_price: product.sale_price
      };
      setItems([...items, newItem]);
    }
  };

  const loadCustomers = async () => {
    try {
      const data = await window.electronAPI.query(`
        SELECT id, name, phone
        FROM customers
        WHERE gym_id = ?
        ORDER BY name
      `, [gymId]);
      setCustomers(data);
    } catch (error) {
      console.error('Error loading customers:', error);
    }
  };

  const addProductToInvoice = (product: Product) => {
    const existingItemIndex = items.findIndex(item => item.product_id === product.id);
    
    if (existingItemIndex >= 0) {
      // Increase quantity if product already exists
      const newItems = [...items];
      newItems[existingItemIndex].quantity += 1;
      newItems[existingItemIndex].total_price = newItems[existingItemIndex].quantity * newItems[existingItemIndex].unit_price;
      setItems(newItems);
    } else {
      // Add new item
      const newItem: QuickSaleItem = {
        product_id: product.id,
        product_name: product.name,
        quantity: 1,
        unit_price: product.sale_price,
        total_price: product.sale_price
      };
      setItems([...items, newItem]);
    }
  };

  const updateItemQuantity = (index: number, quantity: number) => {
    if (quantity <= 0) {
      removeItem(index);
      return;
    }
    
    const newItems = [...items];
    newItems[index].quantity = quantity;
    newItems[index].total_price = quantity * newItems[index].unit_price;
    setItems(newItems);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const calculateSubtotal = () => {
    if (isSingleSession) {
      return singleSessionPrice;
    }
    return items.reduce((sum, item) => sum + item.total_price, 0);
  };

  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    return subtotal - discount;
  };

  const createCustomer = async () => {
    try {
      const result = await window.electronAPI.run(`
        INSERT INTO customers (name, phone, email, address, gym_id) 
        VALUES (?, ?, ?, ?, ?)
      `, [
        newCustomer.name,
        newCustomer.phone,
        newCustomer.email,
        newCustomer.address,
        gymId
      ]);

      const customer: Customer = {
        id: result.lastInsertRowid,
        name: newCustomer.name,
        phone: newCustomer.phone
      };

      setSelectedCustomer(customer);
      setCustomers([...customers, customer]);
      setShowCustomerForm(false);
      setNewCustomer({ name: '', phone: '', email: '', address: '' });
    } catch (error) {
      console.error('Error creating customer:', error);
      alert('حدث خطأ في إضافة الزبون');
    }
  };

  const handleSubmit = async () => {
    if (!isSingleSession && items.length === 0) {
      alert('يرجى إضافة منتج واحد على الأقل');
      return;
    }

    try {
      const invoiceNumber = `INV-${Date.now().toString().slice(-8)}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
      const subtotal = calculateSubtotal();
      const total = calculateTotal();
      const currentTime = new Date().toISOString();

      // Calculate profit
      let totalProfit = 0;
      if (!isSingleSession) {
        for (const item of items) {
          const productData = await window.electronAPI.query(`
            SELECT purchase_price FROM products WHERE id = ?
          `, [item.product_id]);
          
          if (productData.length > 0) {
            const purchasePrice = productData[0].purchase_price;
            const itemProfit = (item.total_price * (total / subtotal)) - (item.quantity * purchasePrice);
            totalProfit += itemProfit;
          }
        }
      }

      // Create invoice
      const invoiceResult = await window.electronAPI.run(`
        INSERT INTO invoices (invoice_number, customer_id, customer_name, customer_phone, 
                             subtotal, discount, total, profit, paid_amount, is_credit, 
                             is_single_session, gym_id, user_id, created_at) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        invoiceNumber,
        selectedCustomer?.id || null,
        selectedCustomer?.name || '',
        selectedCustomer?.phone || '',
        subtotal,
        discount,
        total,
        totalProfit,
        paidAmount,
        isCredit,
        isSingleSession,
        gymId,
        user?.id,
        currentTime
      ]);

      const invoiceId = invoiceResult.lastInsertRowid;

      // Add invoice items and update inventory
      if (!isSingleSession) {
        for (const item of items) {
          await window.electronAPI.run(`
            INSERT INTO invoice_items (invoice_id, product_id, quantity, unit_price, total_price) 
            VALUES (?, ?, ?, ?, ?)
          `, [invoiceId, item.product_id, item.quantity, item.unit_price, item.total_price]);

          // Update product quantity
          await window.electronAPI.run(`
            UPDATE products 
            SET male_gym_quantity = male_gym_quantity - ? 
            WHERE id = ?
          `, [item.quantity, item.product_id]);
        }
      }

      // Reset form and close modal
      resetForm();
      onClose();
      alert('تم إنشاء الفاتورة بنجاح');
    } catch (error) {
      console.error('Error creating invoice:', error);
      alert('حدث خطأ في إنشاء الفاتورة');
    }
  };

  const resetForm = () => {
    setItems([]);
    setBarcodeInput('');
    setCustomerSearch('');
    setSelectedCustomer(null);
    setDiscount(0);
    setPaidAmount(0);
    setIsCredit(false);
    setIsSingleSession(false);
    setSingleSessionPrice(200);
    setShowCustomerForm(false);
    setNewCustomer({ name: '', phone: '', email: '', address: '' });
  };

  const filteredCustomers = customers.filter(customer =>
    customer.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    customer.phone.includes(customerSearch)
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ar-DZ', {
      style: 'currency',
      currency: 'DZD',
      minimumFractionDigits: 0
    }).format(amount);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 flex items-center justify-between">
          <div className="flex items-center">
            <CreditCard className="w-6 h-6 ml-3" />
            <h2 className="text-xl font-bold arabic-text">فاتورة مبيعات سريعة</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex h-full">
          {/* Left Panel - Products and Items */}
          <div className="flex-1 p-6 overflow-y-auto">
            {/* Barcode Scanner */}
            <div className="mb-6">
              <div className="flex items-center mb-3">
                <Scan className="w-5 h-5 text-blue-600 ml-2" />
                <h3 className="text-lg font-semibold arabic-text">مسح الباركود</h3>
              </div>
              <input
                id="barcode-input"
                type="text"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                className="form-input-ar text-center text-lg font-mono"
                placeholder="امسح الباركود أو اكتبه هنا..."
                autoFocus
              />
            </div>

            {/* Session Type Toggle */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={isSingleSession}
                  onChange={(e) => setIsSingleSession(e.target.checked)}
                  className="ml-2"
                />
                <span className="arabic-text font-medium">حصة (غير مشترك)</span>
              </label>
              {isSingleSession && (
                <div className="mt-3">
                  <label className="form-label-ar arabic-text">سعر الحصة (دج)</label>
                  <input
                    type="number"
                    value={singleSessionPrice}
                    onChange={(e) => setSingleSessionPrice(parseFloat(e.target.value) || 200)}
                    className="form-input-ar"
                    min="0"
                  />
                </div>
              )}
            </div>

            {/* Manual Product Selection */}
            {!isSingleSession && (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold arabic-text">المنتجات</h3>
                  <button
                    onClick={() => setShowProductSelector(true)}
                    className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <ShoppingCart className="w-4 h-4 ml-2" />
                    <span className="arabic-text">إضافة منتج</span>
                  </button>
                </div>
              </div>
            )}

            {/* Items List */}
            {!isSingleSession && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-3 arabic-text">المنتجات</h3>
                {items.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Scan className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p className="arabic-text">امسح باركود المنتج لإضافته</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {items.map((item, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex-1">
                          <h4 className="font-medium arabic-text">{item.product_name}</h4>
                          <p className="text-sm text-gray-600">{formatCurrency(item.unit_price)} × {item.quantity}</p>
                        </div>
                        <div className="flex items-center space-x-reverse space-x-2">
                          <button
                            onClick={() => updateItemQuantity(index, item.quantity - 1)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="w-8 text-center font-medium">{item.quantity}</span>
                          <button
                            onClick={() => updateItemQuantity(index, item.quantity + 1)}
                            className="p-1 text-green-600 hover:bg-green-50 rounded"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                          <div className="w-20 text-left font-bold">
                            {formatCurrency(item.total_price)}
                          </div>
                          <button
                            onClick={() => removeItem(index)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Panel - Customer and Payment */}
          <div className="w-96 bg-gray-50 p-6 overflow-y-auto">
            {/* Customer Selection */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center">
                  <User className="w-5 h-5 text-blue-600 ml-2" />
                  <h3 className="text-lg font-semibold arabic-text">الزبون</h3>
                </div>
                <button
                  onClick={() => setShowCustomerForm(true)}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  + جديد
                </button>
              </div>

              {selectedCustomer ? (
                <div className="p-3 bg-white rounded-lg border">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium arabic-text">{selectedCustomer.name}</p>
                      <p className="text-sm text-gray-600">{selectedCustomer.phone}</p>
                    </div>
                    <button
                      onClick={() => setSelectedCustomer(null)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <input
                    type="text"
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    className="form-input-ar mb-2"
                    placeholder="البحث عن عميل..."
                  />
                  {customerSearch && (
                    <div className="max-h-32 overflow-y-auto bg-white border rounded-lg">
                      {filteredCustomers.map((customer) => (
                        <button
                          key={customer.id}
                          onClick={() => {
                            setSelectedCustomer(customer);
                            setCustomerSearch('');
                          }}
                          className="w-full text-right p-2 hover:bg-gray-50 border-b last:border-b-0"
                        >
                          <div className="arabic-text">{customer.name}</div>
                          <div className="text-sm text-gray-600">{customer.phone}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Payment Details */}
            <div className="mb-6">
              <div className="flex items-center mb-3">
                <Calculator className="w-5 h-5 text-blue-600 ml-2" />
                <h3 className="text-lg font-semibold arabic-text">تفاصيل الدفع</h3>
              </div>

              <div className="space-y-3">
                {!isSingleSession && (
                  <div>
                    <label className="form-label-ar arabic-text">الخصم (دج)</label>
                    <input
                      type="number"
                      value={discount}
                      onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                      className="form-input-ar"
                      min="0"
                    />
                  </div>
                )}


                <div>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={isCredit}
                      onChange={(e) => setIsCredit(e.target.checked)}
                      className="ml-2"
                    />
                    <span className="arabic-text">دفع آجل</span>
                  </label>
                </div>

                {isCredit && (
                  <div>
                    <label className="form-label-ar arabic-text">المبلغ المدفوع (دج)</label>
                    <input
                      type="number"
                      value={paidAmount}
                      onChange={(e) => setPaidAmount(parseFloat(e.target.value) || 0)}
                      className="form-input-ar"
                      min="0"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Totals */}
            <div className="mb-6 p-4 bg-white rounded-lg border">
              {/* Digital Display for Total */}
              <div className="text-center mb-4 p-4 bg-gradient-to-r from-green-500 to-blue-600 rounded-lg text-white">
                <div className="text-sm arabic-text opacity-90">المجموع الكلي</div>
                <div className="text-3xl font-bold font-mono">
                  {formatCurrency(calculateTotal())}
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="arabic-text">المجموع الفرعي:</span>
                  <span>{formatCurrency(calculateSubtotal())}</span>
                </div>
                {!isSingleSession && discount > 0 && (
                  <div className="flex justify-between text-red-600">
                    <span className="arabic-text">الخصم:</span>
                    <span>-{formatCurrency(discount)}</span>
                  </div>
                )}
                {calculateTotal() > paidAmount && (
                  <div className="flex justify-between text-red-600 font-medium">
                    <span className="arabic-text">المبلغ المتبقي:</span>
                    <span>{formatCurrency(calculateTotal() - paidAmount)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              <button
                onClick={handleSubmit}
                disabled={!isSingleSession && items.length === 0}
                className="w-full btn-primary-ar arabic-text py-3 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                إنشاء الفاتورة
              </button>
              <button
                onClick={resetForm}
                className="w-full btn-secondary-ar arabic-text py-2"
              >
                مسح الكل
              </button>
            </div>
          </div>
        </div>

        {/* Product Selector Modal */}
        {showProductSelector && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="bg-white rounded-lg p-6 w-96 max-h-96 overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold arabic-text">اختيار المنتجات</h3>
                <button
                  onClick={() => setShowProductSelector(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-2">
                {products.map((product) => (
                  <button
                    key={product.id}
                    onClick={() => {
                      addProductManually(product);
                      setShowProductSelector(false);
                    }}
                    className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-blue-50 rounded-lg transition-colors text-right"
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

        {/* New Customer Modal */}
        {showCustomerForm && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="bg-white rounded-lg p-6 w-96">
              <h3 className="text-lg font-bold mb-4 arabic-text">إضافة عميل جديد</h3>
              <div className="space-y-3">
                <div>
                  <label className="form-label-ar arabic-text">الاسم *</label>
                  <input
                    type="text"
                    value={newCustomer.name}
                    onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                    className="form-input-ar"
                    required
                  />
                </div>
                <div>
                  <label className="form-label-ar arabic-text">الهاتف *</label>
                  <input
                    type="tel"
                    value={newCustomer.phone}
                    onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                    className="form-input-ar"
                    required
                  />
                </div>
                <div>
                  <label className="form-label-ar arabic-text">البريد الإلكتروني</label>
                  <input
                    type="email"
                    value={newCustomer.email}
                    onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                    className="form-input-ar"
                  />
                </div>
                <div>
                  <label className="form-label-ar arabic-text">العنوان</label>
                  <textarea
                    value={newCustomer.address}
                    onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })}
                    className="form-input-ar"
                    rows={2}
                  />
                </div>
              </div>
              <div className="flex space-x-reverse space-x-3 mt-6">
                <button
                  onClick={() => setShowCustomerForm(false)}
                  className="btn-secondary-ar arabic-text flex-1"
                >
                  إلغاء
                </button>
                <button
                  onClick={createCustomer}
                  disabled={!newCustomer.name || !newCustomer.phone}
                  className="btn-primary-ar arabic-text flex-1 disabled:opacity-50"
                >
                  إضافة
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuickSaleModal;