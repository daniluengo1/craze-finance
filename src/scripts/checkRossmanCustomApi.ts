import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  const config = await prisma.businessCentralConfig.findUnique({ where: { id: 1 } });
  if (!config) throw new Error('No config');

  const tokenUrl = `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`;
  const params = new URLSearchParams();
  params.append('grant_type', 'client_credentials');
  params.append('client_id', config.clientId);
  params.append('client_secret', config.clientSecret);
  params.append('scope', 'https://api.businesscentral.dynamics.com/.default');

  const tokenRes = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params
  });
  
  const tokenData = await tokenRes.json();
  const accessToken = tokenData.access_token;
  
  const customApiBaseUrl = `https://api.businesscentral.dynamics.com/v2.0/${config.tenantId}/${config.environment}/api/craze/integrations/v1.0/companies(2acec35c-7d06-ed11-82f8-0022485ceea3)`;
  const ledgerUrl = `${customApiBaseUrl}/custLedgerEntries`;
  
  console.log("Fetching", ledgerUrl);
  const ledgerRes = await fetch(ledgerUrl, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' }
  });
  
  if (ledgerRes.ok) {
    const data = await ledgerRes.json();
    console.log("Found", data.value.length, "entries");
    // Find Rossman
    const rossman = data.value.find((v:any) => v.customerName && v.customerName.toLowerCase().includes('rossman'));
    if (rossman) {
      console.log("Rossman Entry Keys:");
      console.log(Object.keys(rossman));
      console.log("Rossman sample:", rossman);
    } else {
      console.log("No Rossman found. Printing first entry keys:");
      console.log(Object.keys(data.value[0]));
    }
  } else {
    console.log("Error:", await ledgerRes.text());
  }
}
run();
