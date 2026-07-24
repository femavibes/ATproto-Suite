const XLSX = require('xlsx');

const workbook = XLSX.readFile('/app/data/SUB-IP-EST2024-POP.xlsx');
console.log('Sheet names:', workbook.SheetNames);

const worksheet = workbook.Sheets[workbook.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(worksheet);

console.log('Total rows:', data.length);
console.log('Columns:', Object.keys(data[0] || {}));
console.log('First 3 rows:');
data.slice(0, 3).forEach((row, i) => {
  console.log(`Row ${i}:`, row);
});