import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Users, Search, Phone, CreditCard, Eye } from 'lucide-react';
import { useGym } from '../../contexts/GymContext';

interface Customer {
  id: number;
  name: string;
  phone: string;
  email: string;
  address: string;
  total_purchases: number;
  total_debt: number;
  created_at: string;
}

interface CustomerDebt {
  id: number;
  invoice_number: string;
  total: number;
  paid_amount: number;
  remaining: number;
  created_at: string;
}

const CustomersPage: React.FC = () => {
  const { gymId } = useGym();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDebtModal, setShowDebtModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerDebts, setCustomerDebts] = useState<CustomerDebt[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: ''
  });

  // حالات جديدة لإدارة عملية الدفع
  const [payingDebtId, setPayingDebtId] = useState<number | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>('');

  useEffect(() => {
    loadCustomers();
  }, [gymId]);

  const loadCustomers = async () => {
    try {
      const data = await window.electronAPI.query(`
        SELECT 
          c.*,
          COALESCE(SUM(i.total), 0) as total_purchases,
          COALESCE(SUM(CASE WHEN i.is_credit = 1 THEN i.total - i.paid_amount ELSE 0 END), 0) as total_debt
        FROM customers c
        LEFT JOIN invoices i ON c.id = i.customer_id AND i.gym_id = ?
        WHERE c.gym_id = ?
        GROUP BY c.id
        ORDER BY c.created_at DESC
      `, [gymId, gymId]);
      setCustomers(data);
    } catch (error) {
      console.error('Error loading customers:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCustomerDebts = async (customerId: number) => {
    try {
      const data = await window.electronAPI.query(`
        SELECT 
          id,
          invoice_number,
          total,
          paid_amount,
          (total - paid_amount) as remaining,
          created_at
        FROM invoices
        WHERE customer_id = ? AND is_credit = 1 AND total > paid_amount
        ORDER BY created_at DESC
      `, [customerId]);
      setCustomerDebts(data);
    } catch (error) {
      console.error('Error loading customer debts:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingCustomer) {
        await window.electronAPI.run(`
          UPDATE customers 
          SET name = ?, phone = ?, email = ?, address = ?
          WHERE id = ?
        `, [
          formData.name,
          formData.phone,
          formData.email,
          formData.address,
          editingCustomer.id
        ]);
      } else {
        await window.electronAPI.run(`
          INSERT INTO customers (name, phone, email, address, gym_id) 
          VALUES (?, ?, ?, ?, ?)
        `, [
          formData.name,
          formData.phone,
          formData.email,
          formData.address,
          gymId
        ]);
      }
      
      await loadCustomers();
      setShowModal(false);
      setEditingCustomer(null);
      resetForm();
    } catch (error) {
      console.error('Error saving customer:', error);
      alert('حدث خطأ في حفظ الزبون');
    }
  };

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name,
      phone: customer.phone,
      email: customer.email || '',
      address: customer.address || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('هل أنت متأكد من حذف هذا الزبون؟')) {
      try {
        await window.electronAPI.run('DELETE FROM customers WHERE id = ?', [id]);
        await loadCustomers();
      } catch (error) {
        console.error('Error deleting customer:', error);
        alert('حدث خطأ في حذف الزبون');
      }
    }
  };

  const viewCustomerDebts = async (customer: Customer) => {
    setSelectedCustomer(customer);
    await loadCustomerDebts(customer.id);
    setShowDebtModal(true);
  };
  
  // دالة جديدة لمعالجة عملية الدفع
  const handlePayDebt = async () => {
    if (payingDebtId === null) return;

    const parsedAmount = parseFloat(paymentAmount);
    const debtToPay = customerDebts.find(d => d.id === payingDebtId);

    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      alert('يرجى إدخال مبلغ صحيح وموجب.');
      return;
    }
    
    if (debtToPay && parsedAmount > debtToPay.remaining) {
      alert('المبلغ المدخل أكبر من المبلغ المتبقي!');
      return;
    }

    try {
      await window.electronAPI.run(`
        UPDATE invoices 
        SET paid_amount = paid_amount + ?
        WHERE id = ?
      `, [parsedAmount, payingDebtId]);

      if (selectedCustomer) {
        await loadCustomerDebts(selectedCustomer.id);
        await loadCustomers();
      }
      // إعادة تعيين الحالات لإخفاء مربع الحوار
      setPayingDebtId(null);
      setPaymentAmount('');
    } catch (error) {
      console.error('Error paying debt:', error);
      alert('حدث خطأ في تسجيل الدفع');
    }
  };
  
  const markDebtAsPaid = async (invoiceId: number) => {
    if (window.confirm('هل أنت متأكد من تسديد كامل المبلغ؟')) {
      try {
        const invoice = customerDebts.find(d => d.id === invoiceId);
        if (invoice) {
          await window.electronAPI.run(`
            UPDATE invoices 
            SET paid_amount = total
            WHERE id = ?
          `, [invoiceId]);
          
          if (selectedCustomer) {
            await loadCustomerDebts(selectedCustomer.id);
            await loadCustomers();
          }
        }
      } catch (error) {
        console.error('Error marking debt as paid:', error);
        alert('حدث خطأ في تسجيل الدفع');
      }
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      phone: '',
      email: '',
      address: ''
    });
  };

  const openAddModal = () => {
    setEditingCustomer(null);
    resetForm();
    setShowModal(true);
  };

  const filteredCustomers = customers.filter(customer =>
    customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.phone.includes(searchTerm) ||
    customer.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 arabic-text">
            إدارة الزبائن
          </h1>
          <p className="text-gray-600 arabic-text">
            إدارة بيانات الزبائن والديون
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="btn-primary-ar arabic-text flex items-center"
        >
          <Plus className="w-5 h-5 ml-2" />
          إضافة عميل جديد
        </button>
      </div>
      <div className="card-ar">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="form-input-ar pr-10"
            placeholder="البحث بالاسم أو الهاتف أو البريد الإلكتروني..."
          />
        </div>
      </div>
      <div className="card-ar">
        {filteredCustomers.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 arabic-text">
              {searchTerm ? 'لا توجد نتائج' : 'لا يوجد عملاء'}
            </h3>
            <p className="text-gray-600 arabic-text">
              {searchTerm ? 'جرب البحث بكلمات مختلفة' : 'ابدأ بإضافة عميل جديد'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-ar">
              <thead>
                <tr>
                  <th>اسم الزبون</th>
                  <th>رقم الهاتف</th>
                  <th>البريد الإلكتروني</th>
                  <th>إجمالي المشتريات</th>
                  <th>إجمالي الديون</th>
                  <th>تاريخ التسجيل</th>
                  <th>الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.map((customer) => (
                  <tr key={customer.id}>
                    <td className="font-medium">{customer.name}</td>
                    <td>
                      <div className="flex items-center">
                        <Phone className="w-4 h-4 ml-2 text-gray-400" />
                        {customer.phone}
                      </div>
                    </td>
                    <td>{customer.email || '-'}</td>
                    <td>{formatCurrency(customer.total_purchases)}</td>
                    <td>
                      <span className={customer.total_debt > 0 ? 'text-red-600 font-bold' : 'text-green-600'}>
                        {formatCurrency(customer.total_debt)}
                      </span>
                    </td>
                    <td>
                      {new Date(customer.created_at).toLocaleDateString('ar-DZ')}
                    </td>
                    <td>
                      <div className="flex items-center space-x-reverse space-x-2">
                        <button
                          onClick={() => handleEdit(customer)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        {customer.total_debt > 0 && (
                          <button
                            onClick={() => viewCustomerDebts(customer)}
                            className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                            title="عرض الديون"
                          >
                            <CreditCard className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => viewCustomerDebts(customer)}
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          title="عرض التفاصيل"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(customer.id)}
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

      {showModal && (
        <div className="modal-overlay-ar">
          <div className="modal-content-ar">
            <h2 className="text-xl font-bold text-gray-900 mb-6 arabic-text">
              {editingCustomer ? 'تعديل الزبون' : 'إضافة عميل جديد'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-group-ar">
                  <label className="form-label-ar arabic-text">
                    اسم الزبون *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="form-input-ar"
                    placeholder="أدخل اسم الزبون"
                    required
                  />
                </div>
                <div className="form-group-ar">
                  <label className="form-label-ar arabic-text">
                    رقم الهاتف *
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="form-input-ar"
                    placeholder="مثال: 0555123456"
                    required
                  />
                </div>
              </div>
              <div className="form-group-ar">
                <label className="form-label-ar arabic-text">
                  البريد الإلكتروني
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="form-input-ar"
                  placeholder="example@email.com"
                />
              </div>
              <div className="form-group-ar">
                <label className="form-label-ar arabic-text">
                  العنوان
                </label>
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="form-input-ar"
                  placeholder="عنوان الزبون"
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
                  {editingCustomer ? 'تحديث' : 'إضافة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDebtModal && selectedCustomer && (
        <div className="modal-overlay-ar">
          <div className="modal-content-ar max-w-4xl">
            <h2 className="text-xl font-bold text-gray-900 mb-6 arabic-text">
              ديون الزبون: {selectedCustomer.name}
            </h2>
            
            {customerDebts.length === 0 ? (
              <div className="text-center py-8">
                <CreditCard className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 arabic-text">لا توجد ديون لهذا الزبون</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="table-ar">
                  <thead>
                    <tr>
                      <th>رقم الفاتورة</th>
                      <th>إجمالي الفاتورة</th>
                      <th>المبلغ المدفوع</th>
                      <th>المبلغ المتبقي</th>
                      <th>التاريخ</th>
                      <th>الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customerDebts.map((debt) => (
                      <tr key={debt.id}>
                        <td className="font-medium">{debt.invoice_number}</td>
                        <td>{formatCurrency(debt.total)}</td>
                        <td>{formatCurrency(debt.paid_amount)}</td>
                        <td className="font-bold text-red-600">
                          {formatCurrency(debt.remaining)}
                        </td>
                        <td>
                          {new Date(debt.created_at).toLocaleDateString('ar-DZ')}
                        </td>
                        <td>
                          <div className="flex space-x-2 space-x-reverse">
                            {/* تعديل زر الدفع ليفتح مربع حوار مخصص */}
                            <button
                              onClick={() => {
                                setPayingDebtId(debt.id);
                                setPaymentAmount(debt.remaining.toString());
                              }}
                              className="btn-success-ar text-xs py-1 px-2"
                            >
                              دفع
                            </button>
                            <button
                              onClick={() => markDebtAsPaid(debt.id)}
                              className="btn-primary-ar text-xs py-1 px-2"
                            >
                              تسديد كامل
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {/* مربع حوار الدفع الجديد */}
                {payingDebtId !== null && (
                  <div className="modal-overlay-ar">
                    <div className="modal-content-ar">
                      <h3 className="text-lg font-bold text-gray-900 mb-4 arabic-text">
                        تسجيل دفعة
                      </h3>
                      <p className="text-gray-600 arabic-text mb-4">
                        يرجى إدخال المبلغ المراد دفعه.
                      </p>
                      <div className="form-group-ar mb-4">
                        <label className="form-label-ar arabic-text">المبلغ المدفوع</label>
                        <input
                          type="number"
                          value={paymentAmount}
                          onChange={(e) => setPaymentAmount(e.target.value)}
                          className="form-input-ar"
                          placeholder="أدخل المبلغ"
                          required
                        />
                      </div>
                      <div className="flex justify-end space-x-reverse space-x-4">
                        <button
                          type="button"
                          onClick={() => {
                            setPayingDebtId(null);
                            setPaymentAmount('');
                          }}
                          className="btn-secondary-ar arabic-text"
                        >
                          إلغاء
                        </button>
                        <button
                          type="button"
                          onClick={handlePayDebt}
                          className="btn-primary-ar arabic-text"
                        >
                          تأكيد الدفع
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-end pt-4">
              <button
                onClick={() => setShowDebtModal(false)}
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

export default CustomersPage;