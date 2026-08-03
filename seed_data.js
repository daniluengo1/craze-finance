const XLSX = require('xlsx');

async function upload() {
  try {
    console.log('Reading Salespeople...');
    const spWb = XLSX.readFile('C:/Users/danie/Downloads/Salespeople_Purchasers.xlsx');
    const spData = XLSX.utils.sheet_to_json(spWb.Sheets[spWb.SheetNames[0]]);
    const spMap = {};
    spData.forEach(row => {
      spMap[row['Code']] = row['Name'];
    });

    console.log('Reading Customers (5).xlsx...');
    const cWb = XLSX.readFile('C:/Users/danie/Downloads/Customers (5).xlsx');
    const cData = XLSX.utils.sheet_to_json(cWb.Sheets[cWb.SheetNames[0]]);
    
    const mappedCustomers = cData.map(row => {
      const pm = row['Payment method'] || row['Payment Method Code'] || row['Forma de pago'] || row['PaymentMethod'];
      const spCode = row['Salesperson Code'];
      return {
        bcId: row['No.'] || row['ID'] || '',
        name: row['Name'] || row['Nombre'] || 'Unknown',
        paymentMethod: (typeof pm === 'string' && pm.trim() !== '') ? pm : 'Empty',
        riskLimit: parseFloat(row['Credit Limit (LCY)'] || row['Límite riesgo'] || row['riskLimit'] || 0),
        balance: parseFloat(row['Balance (LCY)'] || row['Saldo'] || row['balance'] || row['Amount'] || 0),
        salespersonCode: spCode || null,
        salespersonName: spCode ? (spMap[spCode] || null) : null
      };
    });
    
    console.log('Uploading Customers to API...');
    const res1 = await fetch('http://localhost:3000/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mappedCustomers)
    });
    console.log('Customers upload result:', await res1.json());
    
    console.log('Reading Customer Ledger Entries (20).xlsx...');
    const iWb = XLSX.readFile('C:/Users/danie/Downloads/Customer Ledger Entries (20).xlsx');
    const iData = XLSX.utils.sheet_to_json(iWb.Sheets[iWb.SheetNames[0]]);
    
    console.log('Uploading Invoices to API...');
    const res2 = await fetch('http://localhost:3000/api/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(iData)
    });
    console.log('Invoices upload result:', await res2.json());
  } catch (error) {
    console.error('Error during upload:', error);
  }
}

upload();
