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

  const tokenRes = await fetch(tokenUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params });
  const tokenData = await tokenRes.json();
  const accessToken = tokenData.access_token;
  
  const resolvedCompanyId = config.companyId;

  // Let's fetch all purchInvHeaders and find the one that matches our invoice
  const url = `https://api.businesscentral.dynamics.com/v2.0/fab724f7-6b6d-4e3b-86e3-8c1e05e36b2a/Production/api/craze/approvals/v1.0/companies(2acec35c-7d06-ed11-82f8-0022485ceea3)/purchInvHeaders`;

  console.log('Fetching', url);
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' } });
  
  const data = await res.json();
  const allHeaders = data.value || [];
  
  console.log(`Total headers fetched: ${allHeaders.length}`);
  
  // Find CRZ-PI26-03810
  const match = allHeaders.find((h: any) => h.no === 'CRZ-PI26-03810' || h.vendorInvoiceNumber === 'CRZ-PI26-03810' || String(h.no).includes('3810'));
  
  if (match) {
    console.log('Found match:', match);
  } else {
    console.log('CRZ-PI26-03810 NOT FOUND in purchInvHeaders!');
    // Print a few to see what they look like
    console.log('Sample headers:', allHeaders.slice(0, 3).map((h:any) => h.no));
  }
}

run().finally(() => prisma.$disconnect());
