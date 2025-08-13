// وظائف مساعدة لحساب الربح

export interface ProfitCalculation {
  subtotal: number;
  discount: number;
  total: number;
  itemPrice: number;
  itemQuantity: number;
  purchasePrice: number;
  expectedProfit: number;
  calculatedProfit: number;
}

/**
 * حساب الربح بناءً على السعر بعد الخصم
 */
export const calculateProfit = (
  itemPrice: number,
  itemQuantity: number,
  purchasePrice: number,
  subtotal: number,
  total: number
): number => {
  // نسبة السعر النهائي بعد الخصم
  const finalPriceRatio = total / subtotal;
  
  // السعر الفعلي للعنصر بعد الخصم
  const actualItemPrice = itemPrice * finalPriceRatio;
  
  // الربح = (السعر الفعلي × الكمية) - (سعر الشراء × الكمية)
  const profit = (actualItemPrice * itemQuantity) - (purchasePrice * itemQuantity);
  
  return profit;
};

/**
 * اختبار حساب الربح
 */
export const testProfitCalculation = (): ProfitCalculation[] => {
  const testCases: ProfitCalculation[] = [
    {
      subtotal: 1200,
      discount: 150,
      total: 1050,
      itemPrice: 1200,
      itemQuantity: 1,
      purchasePrice: 900,
      expectedProfit: 150,
      calculatedProfit: 0
    },
    {
      subtotal: 2000,
      discount: 200,
      total: 1800,
      itemPrice: 2000,
      itemQuantity: 1,
      purchasePrice: 1500,
      expectedProfit: 300,
      calculatedProfit: 0
    },
    {
      subtotal: 1000,
      discount: 0,
      total: 1000,
      itemPrice: 1000,
      itemQuantity: 1,
      purchasePrice: 800,
      expectedProfit: 200,
      calculatedProfit: 0
    }
  ];

  // حساب الربح لكل حالة اختبار
  testCases.forEach(testCase => {
    testCase.calculatedProfit = calculateProfit(
      testCase.itemPrice,
      testCase.itemQuantity,
      testCase.purchasePrice,
      testCase.subtotal,
      testCase.total
    );
  });

  return testCases;
};

/**
 * طباعة نتائج الاختبار
 */
export const printTestResults = () => {
  const results = testProfitCalculation();
  
  console.log('=== اختبار حساب الربح ===');
  results.forEach((test, index) => {
    console.log(`\nاختبار ${index + 1}:`);
    console.log(`- المجموع قبل الخصم: ${test.subtotal}`);
    console.log(`- الخصم: ${test.discount}`);
    console.log(`- المجموع بعد الخصم: ${test.total}`);
    console.log(`- سعر العنصر: ${test.itemPrice}`);
    console.log(`- سعر الشراء: ${test.purchasePrice}`);
    console.log(`- الربح المتوقع: ${test.expectedProfit}`);
    console.log(`- الربح المحسوب: ${test.calculatedProfit}`);
    console.log(`- النتيجة: ${test.expectedProfit === test.calculatedProfit ? '✅ صحيح' : '❌ خطأ'}`);
  });
}; 