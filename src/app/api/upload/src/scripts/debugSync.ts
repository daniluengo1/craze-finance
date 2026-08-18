import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const config = await prisma.businessCentralConfig.findUnique({ where: { id: 1 } });
  if (!config) return;

  console.log("=== PURCHASE INVOICE ===");
  const pRes = await fetch(`https://api.businesscentral.dynamics.com/v2.0/${config.tenantId}/${config.environment}/api/craze/approvals/v1.0/companies(${config.companyId})/purchInvHeaders?$top=3`, {
    headers: { Authorization: `Bearer ${config.accessToken}` }
  });
  if(pRes.ok) {
    const pData = await pRes.json();
    console.log("Purch keys:", pData.value && pData.value[0] ? Object.keys(pData.value[0]) : "No data");
    console.log("Purch sample:", pData.value[0]);
  } else {
    console.log("Purch error:", await pRes.text());
  }

  console.log("=== SALES INVOICE (Cust Ledger) ===");
  const sRes = await fetch(`https://api.businesscentral.dynamics.com/v2.0/${config.tenantId}/${config.environment}/api/craze/integrations/v1.0/companies(${config.companyId})/custLedgerEntries?$filter=(documentType eq 'Invoice' or documentType eq 'Credit Memo') and open eq true&$top=3`, {
    headers: { Authorization: `Bearer ${config.accessToken}` }
  });
  if(sRes.ok) {
    const sData = await sRes.json();
    console.log("Sales keys:", sData.value && sData.value[0] ? Object.keys(sData.value[0]) : "No data");
    console.log("Sales sample:", sData.value[0]);
  } else {
    console.log("Sales error:", await sRes.text());
  }
}

main();
