import { getAccessToken, odataBaseUrl } from './src/lib/bcAuth';

async function testVendorLedger() {
  const token = await getAccessToken();
  const company = 'CRAZE';
  const url = `${odataBaseUrl}/Company('${company}')/Vendor_LedgerEntries`;
  
  console.log('Testing url:', url);
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, 'Accept': 'application/json' }
  });
  
  console.log('Status:', res.status, res.statusText);
  console.log('Body:', await res.text());
}

testVendorLedger().catch(console.error);
