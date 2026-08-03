import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seed...');

  const workspaceDir = path.join(process.cwd(), '..');

  // 1. Read Emails
  const emailsFilePath = path.join(workspaceDir, 'Default28_07_2026_11_00_10.xlsx');
  let emailMap = new Map<string, string>();
  try {
    const emailWorkbook = XLSX.readFile(emailsFilePath);
    const emailSheet = emailWorkbook.Sheets[emailWorkbook.SheetNames[0]];
    // range: 2 skips the first 2 rows which are titles in the German export
    const emailData = XLSX.utils.sheet_to_json(emailSheet, { range: 2 });
    
    emailData.forEach((row: any) => {
      const id = row['Nr.'] || row['No.'] || row['Customer No.'];
      const email = row['E-Mail'] || row['Email'] || row['Correo'];
      if (id && email) {
        emailMap.set(String(id), email);
      }
    });
    console.log(`Loaded ${emailMap.size} emails.`);
  } catch (e) {
    console.error('Failed to load emails file:', e);
  }

  // 2. Read Customers
  const customersFilePath = path.join(workspaceDir, 'Customers (4).xlsx');
  let customerIdMap = new Map<string, number>();
  try {
    const custWorkbook = XLSX.readFile(customersFilePath);
    const custSheet = custWorkbook.Sheets[custWorkbook.SheetNames[0]];
    const custData = XLSX.utils.sheet_to_json(custSheet);

    await prisma.customer.deleteMany();

    for (const row of custData as any[]) {
      const bcId = String(row['No.'] || row['ID'] || '');
      const name = row['Name'] || row['Nombre'] || 'Unknown';
      const paymentMethod = row['Payment Method Code'] || row['Forma de pago'] || 'Unknown';
      const riskLimit = parseFloat(row['Credit Limit (LCY)'] || row['Límite riesgo'] || 0) || 0;
      const balance = parseFloat(row['Balance (LCY)'] || row['Saldo'] || 0) || 0;
      const email = emailMap.get(bcId) || null;

      let calculatedRisk = 'Desconocido';
      let suggestedAction = 'Ninguna';

      if (paymentMethod.toLowerCase() !== 'transfer') {
        calculatedRisk = 'Sin riesgo';
        suggestedAction = 'N/A';
      } else {
        if (balance > riskLimit) {
          calculatedRisk = 'Alto Riesgo';
          suggestedAction = 'Solicitar más riesgo o avanzar pago de facturas de la cartera';
        } else {
          calculatedRisk = 'Riesgo Controlado';
          suggestedAction = 'Normal';
        }
      }

      if (bcId) {
        const customer = await prisma.customer.create({
          data: {
            bcId, name, paymentMethod, riskLimit, balance, email, calculatedRisk, suggestedAction
          }
        });
        customerIdMap.set(bcId, customer.id);
      }
    }
    console.log(`Imported ${customerIdMap.size} customers.`);
  } catch (e) {
    console.error('Failed to load customers file:', e);
  }

  // 3. Read Invoices
  const ledgerFilePath = path.join(workspaceDir, 'Customer Ledger Entries (20).xlsx');
  try {
    const ledgerWorkbook = XLSX.readFile(ledgerFilePath);
    const ledgerSheet = ledgerWorkbook.Sheets[ledgerWorkbook.SheetNames[0]];
    const ledgerData = XLSX.utils.sheet_to_json(ledgerSheet);

    await prisma.invoice.deleteMany();

    let importedInvoices = 0;
    for (const row of ledgerData as any[]) {
      const documentType = String(row['Document Type'] || '').toLowerCase();
      const isOpen = row['Open'] === true || row['Open'] === 1 || String(row['Open']).toLowerCase() === 'yes' || String(row['Open']).toLowerCase() === 'sí';
      
      // Often in BC 'Factura' or 'Invoice' or 'Rechnung'
      if ((documentType.includes('invoice') || documentType.includes('factura') || documentType.includes('rechnung') || documentType === '') && isOpen) {
        const bcCustomerId = String(row['Customer No.'] || '');
        const customerId = customerIdMap.get(bcCustomerId);
        
        if (customerId) {
          const amount = parseFloat(row['Remaining Amount'] || row['Amount'] || 0) || 0;
          
          const parseDate = (val: any) => {
            if (!val) return null;
            if (typeof val === 'number') {
              return new Date(Math.round((val - 25569) * 86400 * 1000));
            }
            return new Date(val);
          };

          const dueDate = parseDate(row['Due Date']);
          // There is no Confirmed Payment Date, but Open=Yes implies not confirmed
          const confirmedPaymentDate = null;

          if (dueDate && amount !== 0) {
            await prisma.invoice.create({
              data: {
                bcId: String(row['Document No.'] || Math.random().toString()),
                customerId,
                type: 'invoice',
                status: 'open',
                amount,
                dueDate,
                confirmedPaymentDate
              }
            });
            importedInvoices++;
          }
        }
      }
    }
    console.log(`Imported ${importedInvoices} open invoices.`);
  } catch (e) {
    console.error('Failed to load ledger entries file:', e);
  }

  console.log('Seed completed successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
