import { PrismaClient } from '@prisma/client';

const vercelDb = new PrismaClient({
  datasources: {
    db: {
      url: "postgres://dd26cacd1f1d1e4c4f5f3293547808f26d0d8455d82e1f379039a5aedfdf7e17:sk_L92c_OjN_n9ZGuqjbZ63L@db.prisma.io:5432/postgres?sslmode=require"
    }
  }
});

async function main() {
  const config = await vercelDb.businessCentralConfig.findUnique({ where: { id: 1 } });
  
  const tokenEndpoint = `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`;
  const params = new URLSearchParams();
  params.append('client_id', config.clientId);
  params.append('client_secret', config.clientSecret);
  params.append('grant_type', 'client_credentials');
  params.append('scope', 'https://api.businesscentral.dynamics.com/.default');

  const res = await fetch(tokenEndpoint, { method: 'POST', body: params });
  const data = await res.json();
  const accessToken = data.access_token;

  const customApiBaseUrl = `https://api.businesscentral.dynamics.com/v2.0/${config.tenantId}/${config.environment}/api/craze/integrations/v1.0/companies`;
  const compRes = await fetch(customApiBaseUrl, { headers: { Authorization: `Bearer ${accessToken}` }});
  const compData = await compRes.json();
  const crazeId = compData.value.find((c: any) => c.name === 'CRAZE').id;

  const ledgerUrl = `https://api.businesscentral.dynamics.com/v2.0/${config.tenantId}/${config.environment}/api/craze/integrations/v1.0/companies(${crazeId})/custLedgerEntries?$filter=(documentType eq 'Invoice' or documentType eq 'Credit Memo' or documentType eq 'Refund') and open eq true`;
  
  const ledgerRes = await fetch(ledgerUrl, {
    headers: { Authorization: `Bearer ${accessToken}`, 'Accept': 'application/json' }
  });

  const ledgerData = await ledgerRes.json();
  console.log("Found Invoices:", ledgerData.value?.length);
  if (ledgerData.value?.length > 0) {
    console.log("Sample Invoice:");
    console.log(JSON.stringify(ledgerData.value[0], null, 2));
  } else {
    console.log(ledgerData);
  }
}

main().catch(console.error).finally(() => vercelDb.$disconnect());
