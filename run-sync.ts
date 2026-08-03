import { syncBusinessCentral } from './src/lib/bcSync';
async function run() {
  console.log('START SYNC');
  try {
    await syncBusinessCentral();
    console.log('SYNC SUCCESS');
  } catch(e) {
    console.error('SYNC ERROR', e);
  }
  process.exit(0);
}
run();
