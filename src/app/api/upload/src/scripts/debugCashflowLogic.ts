import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  try {
    const markantInvoices = await prisma.invoice.findMany({
      where: {
        paymentMethod: 'MARKANT',
        status: { not: 'Closed' }
      }
    });
    
    console.log('Testing markant grouping...');
    const markantGroups = markantInvoices.reduce((acc: any, inv) => {
      const activeDate = inv.cashflowDate || inv.confirmedPaymentDate || inv.dueDate;
      if (!activeDate) {
         console.log('NO ACTIVE DATE for', inv);
      }
      const dateStr = activeDate.toISOString().split('T')[0];

      if (!acc[dateStr]) acc[dateStr] = { amount: 0, invoices: [] };
      acc[dateStr].amount += inv.amount;
      acc[dateStr].invoices.push(inv);
      return acc;
    }, {});
    console.log('Markant OK');

    const transferInvoices = await prisma.invoice.findMany({
      where: {
        paymentMethod: 'TRANSFER',
        status: { not: 'Closed' }
      },
      include: { customer: true }
    });

    console.log('Testing transfer grouping...');
    const transferGroups = transferInvoices.reduce((acc: any, inv) => {
      const activeDate = inv.cashflowDate || inv.dueDate;
      const dateStr = activeDate.toISOString().split('T')[0];
      const customerName = inv.customer.name;
      const key = `${customerName}|${dateStr}`;

      if (!acc[key]) acc[key] = { amount: 0, date: activeDate, customerName, invoices: [] };
      acc[key].amount += inv.amount;
      acc[key].invoices.push(inv);
      return acc;
    }, {});
    console.log('Transfer OK');
  } catch (error) {
    console.error('Crash:', error);
  }
}
run();
