// اختبار حساب الربح
// تشغيل هذا الملف في المتصفح لاختبار حساب الربح

function calculateProfit(itemPrice, itemQuantity, purchasePrice, subtotal, total) {
  // نسبة السعر النهائي بعد الخصم
  const finalPriceRatio = total / subtotal;
  
  // السعر الفعلي للعنصر بعد الخصم
  const actualItemPrice = itemPrice * finalPriceRatio;
  
  // الربح = (السعر الفعلي × الكمية) - (سعر الشراء × الكمية)
  const profit = (actualItemPrice * itemQuantity) - (purchasePrice * itemQuantity);
  
  return profit;
}

// اختبار الحالات
const testCases = [
  {
    name: "مثال المستخدم - منتج سعره 1200، خصم 150، سعر الشراء 900",
    itemPrice: 1200,
    itemQuantity: 1,
    purchasePrice: 900,
    subtotal: 1200,
    total: 1050,
    expectedProfit: 150
  },
  {
    name: "مثال آخر - منتج سعره 2000، خصم 200، سعر الشراء 1500",
    itemPrice: 2000,
    itemQuantity: 1,
    purchasePrice: 1500,
    subtotal: 2000,
    total: 1800,
    expectedProfit: 300
  },
  {
    name: "بدون خصم - منتج سعره 1000، سعر الشراء 800",
    itemPrice: 1000,
    itemQuantity: 1,
    purchasePrice: 800,
    subtotal: 1000,
    total: 1000,
    expectedProfit: 200
  }
];

console.log("=== اختبار حساب الربح ===");

testCases.forEach((test, index) => {
  const calculatedProfit = calculateProfit(
    test.itemPrice,
    test.itemQuantity,
    test.purchasePrice,
    test.subtotal,
    test.total
  );
  
  console.log(`\n${index + 1}. ${test.name}`);
  console.log(`   - سعر المنتج: ${test.itemPrice}`);
  console.log(`   - سعر الشراء: ${test.purchasePrice}`);
  console.log(`   - المجموع قبل الخصم: ${test.subtotal}`);
  console.log(`   - المجموع بعد الخصم: ${test.total}`);
  console.log(`   - الربح المتوقع: ${test.expectedProfit}`);
  console.log(`   - الربح المحسوب: ${calculatedProfit}`);
  console.log(`   - النتيجة: ${test.expectedProfit === calculatedProfit ? '✅ صحيح' : '❌ خطأ'}`);
  
  if (test.expectedProfit !== calculatedProfit) {
    console.log(`   - التفاصيل: نسبة السعر النهائي = ${test.total / test.subtotal}`);
    console.log(`   - السعر الفعلي بعد الخصم = ${test.itemPrice * (test.total / test.subtotal)}`);
  }
});

console.log("\n=== انتهى الاختبار ==="); 