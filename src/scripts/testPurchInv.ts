import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  const config = await prisma.businessCentralConfig.findUnique({ where: { id: 1 } });
  if (!config) throw new Error('No BC config found');

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
  
  if (!accessToken) throw new Error('Failed to get access token');
  
  const resolvedCompanyId = config.companyId;

  const url = `https://api.businesscentral.dynamics.com/v2.0/fab724f7-6b6d-4e3b-86e3-8c1e05e36b2a/Production/api/craze/approvals/v1.0/companies(2acec35c-7d06-ed11-82f8-0022485ceea3)/purchInvHeaders`;

  console.log('Fetching', url);
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' }
  });
  
  if (res.ok) {
    const data = await res.json();
    console.log("PURCHASE INVOICE KEYS:");
    console.log(data.value[0] ? Object.keys(data.value[0]) : "No data");
    console.log(data.value.find((v:any) => v.noPayment === true));
  }
  
  const customApiBaseUrl = `https://api.businesscentral.dynamics.com/v2.0/${config.tenantId}/${config.environment}/api/craze/integrations/v1.0/companies(${resolvedCompanyId})`;
  const ledgerUrl = `${customApiBaseUrl}/custLedgerEntries?$filter=(documentType eq 'Invoice' or documentType eq 'Credit Memo') and open eq true&$top=3`;
  console.log('Fetching', ledgerUrl);
  const ledgerRes = await fetch(ledgerUrl, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' }
  });
  if (ledgerRes.ok) {
    const data = await ledgerRes.json();
    console.log("SALES INVOICE KEYS:");
    console.log(data.value[0] ? Object.keys(data.value[0]) : "No data");
    console.log(data.value.find((v:any) => Object.keys(v).some(k => k.toLowerCase().includes('confirm'))));
  }
}

run().catch(console.error).finally(() => prisma.$disconnect());
