import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const pool = new pg.Pool({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL });

async function run() {
  const { rows } = await pool.query('SELECT * FROM "BusinessCentralConfig" LIMIT 1');
  const config = rows[0];
  if (!config) { console.log('no config'); return; }
  
  // We need an access token. How to get one?
  const tokenUrl = `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`;
  const params = new URLSearchParams();
  params.append('client_id', config.clientId);
  params.append('client_secret', config.clientSecret);
  params.append('grant_type', 'client_credentials');
  params.append('scope', 'https://api.businesscentral.dynamics.com/.default');
  
  const tokenRes = await fetch(tokenUrl, { method: 'POST', body: params });
  const tokenData = await tokenRes.json();
  const token = tokenData.access_token;
  
  // Test Custom API
  const customUrl = `https://api.businesscentral.dynamics.com/v2.0/${config.tenantId}/${config.environment}/api/craze/integrations/v1.0/companies(${config.companyId})/customers?$top=1`;
  const custRes = await fetch(customUrl, { headers: { Authorization: `Bearer ${token}` } });
  console.log('Custom Customers API:', custRes.status);
  if (custRes.ok) {
    const data = await custRes.json();
    console.log(Object.keys(data.value[0] || {}));
    if (data.value[0]) {
      console.log('salesperson fields:', Object.keys(data.value[0]).filter(k => k.toLowerCase().includes('salesperson')));
    }
  }
  
  // Test Standard API
  const stdUrl = `https://api.businesscentral.dynamics.com/v2.0/${config.tenantId}/${config.environment}/api/v2.0/companies(${config.companyId})/customers?$top=1`;
  const stdRes = await fetch(stdUrl, { headers: { Authorization: `Bearer ${token}` } });
  console.log('Standard Customers API:', stdRes.status);
  if (stdRes.ok) {
    const data = await stdRes.json();
    if (data.value[0]) {
      console.log('salesperson fields std:', Object.keys(data.value[0]).filter(k => k.toLowerCase().includes('salesperson')));
      console.log('salespersonCode in std:', data.value[0].salespersonCode);
    }
  }

  process.exit(0);
}
run();
