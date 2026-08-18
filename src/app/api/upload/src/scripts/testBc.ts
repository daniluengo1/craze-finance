import prisma from '../lib/prisma';

async function testConnection() {
  const config = await prisma.businessCentralConfig.findFirst();
  if (!config) {
    console.log("NO BC CONFIG FOUND IN DB");
    return;
  }
  
  console.log("Config retrieved:", {
    tenantId: config.tenantId,
    clientId: config.clientId,
    environment: config.environment,
    companyId: config.companyId
  });

  const url = `https://api.businesscentral.dynamics.com/v2.0/${config.tenantId}/${config.environment}/api/craze/integrations/v1.0/companies(${config.companyId})/custLedgerEntries?$top=1`;
  
  console.log("Testing URL:", url);

  const authHeader = `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`;

  try {
    const res = await fetch(url, {
      headers: {
        'Authorization': authHeader
      }
    });

    console.log("Status Code:", res.status);
    console.log("Status Text:", res.statusText);

    const body = await res.text();
    if (!res.ok) {
      console.log("Error Body:", body);
    } else {
      console.log("Success! Response chunk:", body.substring(0, 150));
    }
  } catch (e) {
    console.log("Exception:", e);
  } finally {
    await prisma.$disconnect();
  }
}

testConnection();
