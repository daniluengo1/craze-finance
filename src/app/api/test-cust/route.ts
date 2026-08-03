import { NextResponse } from 'next/server';
import { getAccessToken } from '@/lib/bcAuth';
import prisma from '@/lib/prisma';
import fs from 'fs';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const token = await getAccessToken();
    const config = await prisma.businessCentralConfig.findFirst();
    const customApiBaseUrl = `https://api.businesscentral.dynamics.com/v2.0/${config.tenantId}/${config.environment}/api/craze/approvals/v1.0/companies(${config.companyId})`;
    
    const piRes = await fetch(`${customApiBaseUrl}/purchInvHeaders?$top=1`, {
      headers: { Authorization: `Bearer ${token}`, 'Accept': 'application/json' }
    });
    const data = piRes.ok ? await piRes.json() : await piRes.text();
    fs.writeFileSync('test-purch-inv.json', JSON.stringify(data, null, 2));
    
    return NextResponse.json({ success: true, data: data.value ? data.value[0] : data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message });
  }
}
