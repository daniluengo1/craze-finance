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

    // Manual Entries up to today
    const manualEntries = await prisma.cashflowManualEntry.findMany({
      where: { companyId, isArchived: false, date: { lte: today } }
    });
    for (const entry of manualEntries) {
      const c = entry.currencyCode || 'EUR';
      cashflowAvailable[c] = (cashflowAvailable[c] || 0) + entry.amount;
    }

    // Auto Invoices up to today (Markant and Transfer)
    const autoInvoices = await prisma.invoice.findMany({
      where: { 
        companyId, 
        isArchived: false, 
        status: { not: 'Closed' },
        paymentMethod: { in: ['MARKANT', 'TRANSFER'] }
      }
    });
    for (const inv of autoInvoices) {
      const activeDate = inv.cashflowDate || inv.confirmedPaymentDate || inv.dueDate;
      if (activeDate <= today) {
        if (inv.paymentMethod === 'MARKANT' && !inv.confirmedPaymentDate) continue; // Skip unconfirmed markant
        const c = inv.currencyCode || 'EUR';
        cashflowAvailable[c] = (cashflowAvailable[c] || 0) + inv.amount;
      }
    }

    return NextResponse.json(cashflowAvailable);
  } catch (error: any) {
    console.error('Error fetching cashflow balances:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
