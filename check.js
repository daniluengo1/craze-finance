const XLSX = require('xlsx');
const p1 = '../Default28_07_2026_11_00_10.xlsx';
const p2 = '../Customer Ledger Entries (20).xlsx';
const wb1 = XLSX.readFile(p1);
const d1 = XLSX.utils.sheet_to_json(wb1.Sheets[wb1.SheetNames[0]], {header: 1});
console.log('E:', d1.slice(0, 3));
const wb2 = XLSX.readFile(p2);
const d2 = XLSX.utils.sheet_to_json(wb2.Sheets[wb2.SheetNames[0]], {header: 1});
console.log('I:', d2.slice(0, 3));
