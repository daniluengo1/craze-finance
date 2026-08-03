

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

  console.log('Fetching token from', tokenUrl);
  try {
    const res = await fetch(tokenUrl, {
      method: 'POST',
      body: params,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    const data = await res.json();
    if (data.access_token) {
      console.log('SUCCESS! Token received. Length:', data.access_token.length);
      
      // Try to fetch companies to verify if CRAZE is correct
      const bcUrl = `https://api.businesscentral.dynamics.com/v2.0/${tenantId}/Production/api/v2.0/companies`;
      const bcRes = await fetch(bcUrl, {
        headers: { 'Authorization': `Bearer ${data.access_token}` }
      });
      const bcData = await bcRes.json();
      if (bcData.value) {
        console.log('Companies found:', bcData.value.map(c => c.name));
      } else {
        console.log('BC Data error:', bcData);
      }
      
    } else {
      console.log('FAILED to get token. Response:', data);
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

testBC();
