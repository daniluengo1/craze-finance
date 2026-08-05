import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const companyId = cookieStore.get('craze_selected_company')?.value || 'CRAZE';
    const today = new Date();
    
    // -- CASHFLOW AVAILABLE CALCULATION --
    const cashflowConfigs = await prisma.cashflowConfig.findMany({ where: { companyId } });
    
    const cashflowAvailable: Record<string, number> = {};
    for (const conf of cashflowConfigs) {
      cashflowAvailable[conf.currencyCode] = conf.initialBalance;
    }

    return NextResponse.json(cashflowAvailable);
  } catch (error: any) {
    console.error('Error fetching cashflow balances:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
