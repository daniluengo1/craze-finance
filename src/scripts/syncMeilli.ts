import { syncBusinessCentral } from '../lib/bcSync';
import prisma from '../lib/prisma';

async function run() {
  console.log('Forcing sync for CRAZE Group AG...');
  
  try {
    const res = await syncBusinessCentral('CRAZE Group AG');
    console.log('Sync success:', res);
  } catch (error) {
    console.error('Sync failed:', error);
  }
}

run();
