import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const config = await prisma.businessCentralConfig.findUnique({where: {id: 1}});
  if(!config) return;
  const res = await fetch(`https://api.businesscentral.dynamics.com/v2.0/${config.tenantId}/${config.environment}/api/craze/integrations/v1.0/companies(${config.companyId})/custLedgerEntries?$top=1`, {
    headers: { Authorization: `Bearer ${config.accessToken}` }
  });
  console.log(await res.json());
}
main();
