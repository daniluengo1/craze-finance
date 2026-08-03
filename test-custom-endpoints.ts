import { getAccessToken } from './src/lib/bcAuth.ts';
import prisma from './src/lib/prisma.ts';

async function listCustomEndpoints() {
  const token = await getAccessToken();
  const config = await prisma.businessCentralConfig.findFirst();
  
  if (!config) {
    console.log('No BC config found');
    return;
  }
  
  const customApiBaseUrl = `https://api.businesscentral.dynamics.com/v2.0/${config.tenantId}/${config.environment}/api/craze/integrations/v1.0/companies(${config.companyId})`;
  
  console.log('Testing custom API url:', customApiBaseUrl);
  const res = await fetch(customApiBaseUrl, {
    headers: { Authorization: `Bearer ${token}`, 'Accept': 'application/json' }
  });
  
  if (res.ok) {
    const data = await res.json();
    console.log('Published custom endpoints:', data);
  } else {
    console.error('Failed:', res.status, await res.text());
  }
}

listCustomEndpoints().catch(console.error);
