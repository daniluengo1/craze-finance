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
    // -- END CASHFLOW CALCULATION --

    // 1. CARTERA CLIENTES (Cobros)
    const openInvoices = await prisma.invoice.findMany({
      where: {
        companyId,
        status: { in: ['open', 'Open', 'Overdue', 'overdue'] },
      },
      include: {
        customer: true
      }
    });

    let totalCarteraClientes = 0;
    let totalVencido = 0;
    let totalMarkant = 0;
    let totalConfirmadoMarkant = 0;
    let totalAmazon = 0;
    let totalRefundsCliente = 0;

    for (const inv of openInvoices) {
      const amt = inv.amount || 0;
      totalCarteraClientes += amt;

      const isOverdue = inv.dueDate < today;
      if (isOverdue) totalVencido += amt;

      if (inv.type === 'Refund') {
        totalRefundsCliente += amt;
      }

      // Check for Markant
      const cName = (inv.customer.name || '').toLowerCase();
      const pMethod = (inv.paymentMethod || '').toLowerCase();
      if (cName.includes('markant') || pMethod.includes('markant')) {
        totalMarkant += amt;
        if (inv.confirmedPaymentDate) {
          totalConfirmadoMarkant += amt;
        }
      }

      // Check for Amazon
      if (cName.includes('amazon') || pMethod.includes('amazon')) {
        totalAmazon += amt;
      }
    }

    // 2. CARTERA PROVEEDORES (Pagos)
    const openPurchases = await prisma.purchaseInvoice.findMany({
      where: {
        companyId,
        status: { in: ['open', 'Open', 'Overdue', 'overdue'] },
      },
      include: {
        approvals: true
      }
    });

    let totalCarteraProveedores = 0;
    let totalCarteraVencidaNoAprobada = 0;
    let totalCarteraVencidaAprobada = 0;
    let totalRefundsProveedor = 0;

    // We'll leave China empty for now until user clarification
    let totalChina = 0;
    let totalConfirmadoChina = 0;
    let totalPendienteChina = 0;

    for (const pinv of openPurchases) {
      const amt = pinv.amount || 0;
      totalCarteraProveedores += amt;

      if (pinv.type === 'Credit Memo') {
        totalRefundsProveedor += amt;
      }

      const isOverdue = pinv.dueDate < today;
      
      // Evaluate approvals
      const totalApps = pinv.approvals ? pinv.approvals.length : 0;
      const approvedCount = pinv.approvals ? pinv.approvals.filter(a => a.status === 'Approved').length : 0;
      const rejectedCount = pinv.approvals ? pinv.approvals.filter(a => a.status === 'Rejected').length : 0;
      const isFullyApproved = totalApps > 0 && approvedCount === totalApps && rejectedCount === 0;

      if (isOverdue) {
        if (isFullyApproved) {
          totalCarteraVencidaAprobada += amt;
        } else {
          totalCarteraVencidaNoAprobada += amt;
        }
      }

      // Check for China TRF
      if ((pinv.paymentMethod || '').toLowerCase() === 'china trf') {
        totalChina += amt;
        if (pinv.schedulePaymentDate) {
          totalConfirmadoChina += amt;
        } else {
          totalPendienteChina += amt;
        }
      }
    }

    return NextResponse.json({
      // Cobros
      totalCarteraClientes,
      totalEnMarkant: totalMarkant,
      totalConfirmadoMarkant,
      totalVencido,
      totalAmazon,

      // Pagos
      totalCarteraProveedores,
      totalCarteraVencidaNoAprobada,
      totalCarteraVencidaAprobada,

      // China
      totalChina,
      totalConfirmadoChina,
      totalPendienteChina,

      // Refunds & Returns
      totalRefundsAbiertosCliente: totalRefundsCliente,
      totalRefundsAbiertoProveedor: totalRefundsProveedor,
      salesReturnOrdersAbiertas: 0, // Placeholder

      // Cashflow (Total per currency)
      cashflowAvailable
    });

  } catch (error: any) {
    console.error('Error fetching dashboard KPIs:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
