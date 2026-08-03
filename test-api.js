const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const config = await prisma.businessCentralConfig.findUnique({where:{id:1}});
  const {tenantId, clientId, clientSecret, environment, companyId} = config;

  const tokenRes = await fetch('https://login.microsoftonline.com/'+tenantId+'/oauth2/v2.0/token', {
    method: 'POST',
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials',
      scope: 'https://api.businesscentral.dynamics.com/.default'
    })
  });
  const token = (await tokenRes.json()).access_token;
  
  const odataBaseUrl = `https://api.businesscentral.dynamics.com/v2.0/${tenantId}/${environment}/ODataV4`;
  const escapedCompanyName = 'CRAZE'; // From previous log
  const vendorLedgerUrl = `${odataBaseUrl}/Company('${escapedCompanyName}')/VendorLedgerEntries?$filter=(Document_Type eq 'Invoice' or Document_Type eq 'Credit Memo') and Open eq true`;
  
  const vendorLedgerRes = await fetch(vendorLedgerUrl, {
    headers: { Authorization: `Bearer ${token}`, 'Accept': 'application/json' }
  });
  if (!vendorLedgerRes.ok) console.log('VendorLedger error:', await vendorLedgerRes.text());
  else {
    const data = await vendorLedgerRes.json();
    console.log('Vendor Entries:', data.value ? data.value.length : 0);
    if(data.value && data.value.length > 0) {
      console.log('First:', data.value[0]);
    }
  }

  const customApiBaseUrl = `https://api.businesscentral.dynamics.com/v2.0/${tenantId}/${environment}/api/craze/integrations/v1.0/companies(${companyId})`;
  const ledgerUrl = `${customApiBaseUrl}/custLedgerEntries?$filter=documentType eq 'Invoice' and isOpen eq true`;
  
  const ledgerRes = await fetch(ledgerUrl, {
    headers: { Authorization: `Bearer ${token}`, 'Accept': 'application/json' }
  });
  if (!ledgerRes.ok) console.log('Cust error:', await ledgerRes.text());
  else {
    const data = await ledgerRes.json();
    console.log('Cust Entries (isOpen=true):', data.value ? data.value.length : 0);
    if(data.value && data.value.length > 0) {
      console.log('First:', data.value[0]);
    }
  }
}
run();
