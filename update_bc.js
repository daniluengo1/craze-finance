const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.businessCentralConfig.upsert({
    where: { id: 1 },
    update: {
      tenantId: 'fab724f7-6b6d-4e3b-86e3-8c1e05e36b2a',
      clientId: '6f832138-cb48-43e7-8601-efca120b45dc',
      clientSecret: '93dCSk3EKKCKd9gotuGYnG8K9WH21v9AEgdBgRa7KUw=',
      environment: 'Production',
      companyId: 'CRAZE'
    },
    create: {
      id: 1,
      tenantId: 'fab724f7-6b6d-4e3b-86e3-8c1e05e36b2a',
      clientId: '6f832138-cb48-43e7-8601-efca120b45dc',
      clientSecret: '93dCSk3EKKCKd9gotuGYnG8K9WH21v9AEgdBgRa7KUw=',
      environment: 'Production',
      companyId: 'CRAZE'
    }
  });
  console.log('BC config updated successfully');
}
main().catch(console.error).finally(() => prisma.$disconnect());
