import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  try {
    const config = await prisma.cashflowConfig.findUnique({ where: { id: 1 } });
    console.log('Config:', config);
    
    const markantInvoices = await prisma.invoice.findMany({
      where: {
        paymentMethod: 'MARKANT',
        status: { not: 'Closed' }
      }
    });
    console.log('Markant:', markantInvoices.length);
    
    const transferInvoices = await prisma.invoice.findMany({
      where: {
        paymentMethod: 'TRANSFER',
        status: { not: 'Closed' }
      },
      include: { customer: true }
    });
    console.log('Transfer:', transferInvoices.length);

  } catch (error) {
    console.error('Crash:', error);
  }
}
run();
