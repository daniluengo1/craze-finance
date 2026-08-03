async function testBC() {
  const tenantId = 'fab724f7-6b6d-4e3b-86e3-8c1e05e36b2a';
  const clientId = '6f832138-cb48-43e7-8601-efca120b45dc';
  const clientSecret = '93dCSk3EKKCKd9gotuGYnG8K9WH21v9AEgdBgRa7KUw=';

  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const params = new URLSearchParams();
  params.append('grant_type', 'client_credentials');
  params.append('client_id', clientId);
  params.append('client_secret', clientSecret);
  params.append('scope', 'https://api.businesscentral.dynamics.com/.default');

  try {
    const res = await fetch(tokenUrl, { method: 'POST', body: params });
    const data = await res.json();
    const token = data.access_token;
    
    // First, let's get the company ID for CRAZE
    const companiesUrl = `https://api.businesscentral.dynamics.com/v2.0/${tenantId}/Production/api/v2.0/companies`;
    const compRes = await fetch(companiesUrl, { headers: { 'Authorization': `Bearer ${token}` } });
    const compData = await compRes.json();
    const craze = compData.value.find(c => c.name === 'CRAZE');
    
    if (!craze) throw new Error("CRAZE company not found");

    const customApiBaseUrl = `https://api.businesscentral.dynamics.com/v2.0/${tenantId}/Production/api/craze/integrations/v1.0/companies(${craze.id})/custLedgerEntries?$top=1`;
    const entriesRes = await fetch(customApiBaseUrl, {
      headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
    });
    
    if (entriesRes.ok) {
      const entriesData = await entriesRes.json();
      console.log('Keys:', Object.keys(entriesData.value[0]));
      console.log('JSON:', JSON.stringify(entriesData.value[0], null, 2));
    } else {
      console.log('Error custom API:', entriesRes.status, await entriesRes.text());
    }
  } catch (err) {
    console.error('Error:', err);
  }
}
testBC();
