import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  const inv = await prisma.purchaseInvoice.findFirst({
    where: { bcId: 'FVR-PI-07-24-099' }
  });
  console.log(inv);
}
run();
