import { syncBusinessCentral } from './src/lib/bcSync.ts';

syncBusinessCentral()
  .then(res => console.log('Sync finished', res))
  .catch(err => console.error('Sync failed', err));
