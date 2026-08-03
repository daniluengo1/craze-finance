import { getAccessToken, odataBaseUrl } from './src/lib/bcAuth.ts';

async function listEndpoints() {
  const token = await getAccessToken();
  console.log('Testing url:', odataBaseUrl);
  const res = await fetch(odataBaseUrl, {
    headers: { Authorization: `Bearer ${token}`, 'Accept': 'application/json' }
  });
  
  const data = await res.json();
  const services = data.value.map((v: any) => v.name);
  console.log('Published services:', services.join(', '));
}

listEndpoints().catch(console.error);
