import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  const config = await prisma.businessCentralConfig.findUnique({ where: { id: 1 } });
  
  const tokenUrl = `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`;
  const params = new URLSearchParams();
  params.append('grant_type', 'client_credentials');
  params.append('client_id', config.clientId);
  params.append('client_secret', config.clientSecret);
  params.append('scope', 'https://api.businesscentral.dynamics.com/.default');

  const tokenRes = await fetch(tokenUrl, { method: 'POST', body: params });
  const tokenData = await tokenRes.json();
  
  const url = `https://api.businesscentral.dynamics.com/v2.0/${config.tenantId}/${config.environment}/api/craze/approvals/v1.0/companies(${config.companyId})/purchInvHeaders`;
  console.log("Fetching", url);
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${tokenData.access_token}` }
  });
  
  const data = await res.json();
  const inv = data.value.find((v:any) => v.no === 'FVR-PI-07-24-099');
  console.log("Raw invoice from API:", inv);
}
run();
