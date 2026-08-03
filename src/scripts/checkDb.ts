import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  console.log(await prisma.purchaseInvoice.findFirst({ where: { bcId: '2173' } }));
  console.log(await prisma.invoice.findFirst({ where: { confirmedPaymentDate: { not: null } } }));
}
main();
