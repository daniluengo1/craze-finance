import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const config = await prisma.businessCentralConfig.findUnique({
      where: { id: 1 }
    });
    return NextResponse.json(config || {});
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const config = await prisma.businessCentralConfig.upsert({
      where: { id: 1 },
      update: {
        tenantId: data.tenantId || '',
        clientId: data.clientId || '',
        clientSecret: data.clientSecret || '',
        environment: data.environment || 'Production',
        companyId: data.companyId || ''
      },
      create: {
        id: 1,
        tenantId: data.tenantId || '',
        clientId: data.clientId || '',
        clientSecret: data.clientSecret || '',
        environment: data.environment || 'Production',
        companyId: data.companyId || ''
      }
    });
    return NextResponse.json({ success: true, config });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
