import { syncBusinessCentral } from '../lib/bcSync';

async function run() {
  console.log('Starting sync...');
  try {
    const res = await syncBusinessCentral();
    console.log('Sync success:', res);
  } catch (error) {
    console.error('Sync failed:', error);
  }
}

run();
