// وظائف مساعدة لإدارة المخزون

export interface ProductQuantity {
  male_gym_quantity: number;
  female_gym_quantity: number;
}

/**
 * الحصول على الكمية الإجمالية للمنتج (مخزن مشترك)
 */
export const getTotalQuantity = (product: ProductQuantity): number => {
  return product.male_gym_quantity + product.female_gym_quantity;
};

/**
 * الحصول على الكمية المتاحة (مخزن مشترك)
 */
export const getAvailableQuantity = (product: ProductQuantity, gymType?: 'male' | 'female'): number => {
  // المخزن مشترك - إرجاع الكمية الإجمالية
  return getTotalQuantity(product);
};

/**
 * الحصول على اسم حقل الكمية حسب نوع الصالة (للتحديث)
 */
export const getQuantityField = (gymType: 'male' | 'female'): string => {
  // يمكن تحديث أي من الحقلين، سنستخدم male_gym_quantity كحقل أساسي
  return 'male_gym_quantity';
};

/**
 * التحقق من وجود مخزون كافي
 */
export const hasEnoughStock = (product: ProductQuantity, quantity: number, gymType: 'male' | 'female'): boolean => {
  const availableQuantity = getTotalQuantity(product);
  return availableQuantity >= quantity;
};

/**
 * تنسيق عرض الكمية مع حالة المخزون
 */
export const formatQuantityDisplay = (product: ProductQuantity, gymType: 'male' | 'female') => {
  const totalQuantity = getTotalQuantity(product);
  const availableQuantity = totalQuantity;
  
  return {
    total: totalQuantity,
    available: availableQuantity,
    isLowStock: totalQuantity < 5,
    status: totalQuantity < 5 ? 'مخزون منخفض' : 'متوفر'
  };
}; 