// Script to create installer images
const fs = require('fs');
const path = require('path');

// Create placeholder installer images
console.log('Creating installer image placeholders...');

// Create a simple text file as placeholder for installer images
const imageInfo = `
هذا المجلد يحتوي على صور المثبت:

المطلوب:
- icon.ico (أيقونة التطبيق 256x256)
- installer-header.bmp (رأس المثبت 150x57)
- installer-sidebar.bmp (الشريط الجانبي 164x314)

يمكنك استبدال هذه الملفات بصور مخصصة لتطبيقك.

ملاحظة: إذا لم تتوفر الصور، سيستخدم المثبت الصور الافتراضية.
`;

fs.writeFileSync(path.join(__dirname, 'README.txt'), imageInfo, 'utf8');

// Create a simple icon placeholder (this would normally be a proper .ico file)
const iconPlaceholder = `
هذا ملف نائب لأيقونة التطبيق.
يجب استبداله بملف .ico حقيقي بحجم 256x256 بكسل.
`;

fs.writeFileSync(path.join(__dirname, 'icon-placeholder.txt'), iconPlaceholder, 'utf8');

console.log('تم إنشاء ملفات نائبة للصور. يرجى استبدالها بالصور الفعلية.');
console.log('المجلد: build-resources/');