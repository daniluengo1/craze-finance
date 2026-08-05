import { syncBusinessCentral } from '../lib/bcSync';
import prisma from '../lib/prisma';

async function run() {
  console.log('Upserting config...');
  await prisma.businessCentralConfig.upsert({
    where: { id: 1 },
    update: {
      tenantId: 'fab724f7-6b6d-4e3b-86e3-8c1e05e36b2a',
      clientId: '6f832138-cb48-43e7-8601-efca120b45dc',
      clientSecret: '93dCSk3EKKCKd9gotuGYnG8K9WH21v9AEgdBgRa7KUw=',
      environment: 'Production',
      companyId: 'Craze'
    },
    create: {
      id: 1,
      tenantId: 'fab724f7-6b6d-4e3b-86e3-8c1e05e36b2a',
      clientId: '6f832138-cb48-43e7-8601-efca120b45dc',
      clientSecret: '93dCSk3EKKCKd9gotuGYnG8K9WH21v9AEgdBgRa7KUw=',
      environment: 'Production',
      companyId: 'Craze'
    }
  });
  console.log('Config saved. Starting sync...');
  try {
    const res = await syncBusinessCentral();
    console.log('Sync success:', res);
  } catch (error) {
    console.error('Sync failed:', error);
  }
}

run();
