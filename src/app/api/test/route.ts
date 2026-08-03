import { NextResponse } from 'next/server';
import { getAccessToken } from '@/lib/bcAuth';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const token = await getAccessToken();
    const config = await prisma.businessCentralConfig.findFirst();
    
    if (!config) return NextResponse.json({ error: 'No BC config found' }, { status: 400 });

    const customApiBaseUrl = `https://api.businesscentral.dynamics.com/v2.0/${config.tenantId}/${config.environment}/api/craze/integrations/v1.0`;
    
    const res = await fetch(customApiBaseUrl, {
      headers: { Authorization: `Bearer ${token}`, 'Accept': 'application/json' }
    });
    
    if (res.ok) {
      const data = await res.json();
      return NextResponse.json({ success: true, url: customApiBaseUrl, data });
    } else {
      return NextResponse.json({ error: 'Failed', status: res.status, body: await res.text() }, { status: res.status });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
