const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const config = await prisma.businessCentralConfig.findFirst();
  const token = await require('./src/lib/bcAuth.ts').getAccessToken(); // Wait, this is TS. We can't require it in Node.
}
run();
