import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import { logAction } from '@/lib/logger';
import { syncBusinessCentral } from '@/lib/bcSync';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const cookieStore = await cookies();
    const companyId = cookieStore.get('craze_selected_company')?.value || 'CRAZE';
    const { searchParams } = new URL(req.url);
    const showArchived = searchParams.get('archived') === 'true';
    const currency = searchParams.get('currency') || 'EUR';

    // 1. Initial balance
    const config = await prisma.cashflowConfig.findUnique({ 
      where: { companyId_currencyCode: { companyId, currencyCode: currency } } 
    });
    const INITIAL_BALANCE = config ? config.initialBalance : 0;

    // 2. Fetch Markant invoices (Grouped by confirmedPaymentDate)
    const markantInvoices = await prisma.invoice.findMany({
      where: {
        companyId,
        paymentMethod: 'MARKANT',
        status: { not: 'Closed' },
        isArchived: showArchived,
        confirmedPaymentDate: { not: null },
        currencyCode: currency
      }
    });

    const markantGroups = markantInvoices.reduce((acc: any, inv) => {
      const activeDate = inv.cashflowDate || inv.confirmedPaymentDate || inv.dueDate;
      const dateStr = activeDate.toISOString().split('T')[0];

      if (!acc[dateStr]) acc[dateStr] = { amount: 0, invoices: [] };
      acc[dateStr].amount += inv.amount;
      acc[dateStr].invoices.push(inv);
      return acc;
    }, {});

    const markantEntries = Object.keys(markantGroups).map(dateStr => ({
      id: `auto-markant-${dateStr}`,
      date: new Date(dateStr),
      description: 'Markant',
      amount: markantGroups[dateStr].amount,
      isManual: false,
      isGroup: true,
      invoices: markantGroups[dateStr].invoices
    }));

    // 3. Fetch Transfer invoices
    const transferInvoices = await prisma.invoice.findMany({
      where: {
        companyId,
        paymentMethod: 'TRANSFER',
        status: { not: 'Closed' },
        isArchived: showArchived,
        currencyCode: currency
      },
      include: { customer: true }
    });

    const transferGroups = transferInvoices.reduce((acc: any, inv) => {
      const activeDate = inv.cashflowDate || inv.dueDate;
      const dateStr = activeDate.toISOString().split('T')[0];
      const customerName = inv.customer.name;
      const key = `${customerName}|${dateStr}`;

      if (!acc[key]) acc[key] = { amount: 0, date: activeDate, customerName, customer: inv.customer, invoices: [] };
      acc[key].amount += inv.amount;
      acc[key].invoices.push(inv);
      return acc;
    }, {});

    const transferEntries = Object.values(transferGroups).map((group: any) => ({
      id: `auto-transfer-${group.customerName}-${group.date.toISOString()}`,
      date: group.date,
      description: group.customerName,
      amount: group.amount,
      isManual: false,
      isGroup: true,
      customer: group.customer,
      invoices: group.invoices
    }));

    // 4. Fetch Manual Entries
    const manualEntriesFromDb = await prisma.cashflowManualEntry.findMany({
      where: { companyId, currencyCode: currency, isArchived: showArchived }
    });
    const manualEntries = manualEntriesFromDb.map(entry => ({
      id: `manual-${entry.id}`,
      dbId: entry.id,
      date: entry.date,
      description: entry.description,
      amount: entry.amount,
      isManual: true,
      isArchived: entry.isArchived
    }));

    // 5. Combine and sort
    const allEntries = [...markantEntries, ...transferEntries, ...manualEntries];
    
    // Sort oldest to newest
    allEntries.sort((a, b) => a.date.getTime() - b.date.getTime());

    // Filter starting from 29/07/2026? The prompt said: "ha de empezar en 29/07/2026". 
    // We will filter out anything before this date.
    const START_DATE = new Date('2026-07-29T00:00:00Z');
    const filteredEntries = allEntries.filter(e => e.date >= START_DATE);

    // 6. Calculate running balance
    let currentBalance = INITIAL_BALANCE;
    const finalEntries = filteredEntries.map(entry => {
      currentBalance += entry.amount;
      return {
        ...entry,
        balance: currentBalance
      };
    });

    return NextResponse.json({
      initialBalance: INITIAL_BALANCE,
      entries: finalEntries
    });
  } catch (error) {
    console.error('Error in cashflow GET:', error);
    return NextResponse.json({ error: 'Failed to get cashflow' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const companyId = cookieStore.get('craze_selected_company')?.value || 'CRAZE';
    const body = await req.json();

    if (Array.isArray(body)) {
      const currency = body[0]?.currency || 'EUR';
      // It's an import from Excel
      const manualEntries = body.map(row => ({
        companyId,
        currencyCode: currency,
        date: new Date(row.date),
        description: row.description,
        amount: parseFloat(row.amount)
      }));
      await prisma.cashflowManualEntry.createMany({ data: manualEntries });
      return NextResponse.json({ success: true, count: manualEntries.length });
    }

    const { date, description, amount, currency } = body;
    if (!date || !description || amount === undefined) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    const entry = await prisma.cashflowManualEntry.create({
      data: {
        companyId,
        currencyCode: currency || 'EUR',
        date: new Date(date),
        description,
        amount: parseFloat(amount)
      }
    });

    await logAction('Crear Cashflow Manual', `Importe: ${amount}, Desc: ${description}`, companyId);
    return NextResponse.json(entry);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create manual entry' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const cookieStore = await cookies();
    const companyId = cookieStore.get('craze_selected_company')?.value || 'CRAZE';
    const body = await req.json();
    const { id, type, action, date, description, amount, invoiceIds, isArchived } = body;

    if (type === 'config') {
      const currencyCode = body.currency || 'EUR';
      await prisma.cashflowConfig.upsert({
        where: { companyId_currencyCode: { companyId, currencyCode } },
        update: { initialBalance: parseFloat(amount) },
        create: { companyId, currencyCode, initialBalance: parseFloat(amount) }
      });
      return NextResponse.json({ success: true });
    }
    
    // Si la acción es 'archive_multiple', archivamos múltiples registros a la vez
    if (action === 'archive_multiple') {
      const { manualIds, invoiceIds: batchInvoiceIds } = body;
      const targetArchivedState = isArchived !== undefined ? isArchived : true;
      
      if (manualIds && Array.isArray(manualIds) && manualIds.length > 0) {
        await prisma.cashflowManualEntry.updateMany({
          where: { id: { in: manualIds } },
          data: { isArchived: targetArchivedState }
        });
      }
      
      if (batchInvoiceIds && Array.isArray(batchInvoiceIds) && batchInvoiceIds.length > 0) {
        await prisma.invoice.updateMany({
          where: { id: { in: batchInvoiceIds } },
          data: { isArchived: targetArchivedState }
        });
      }
      return NextResponse.json({ success: true });
    }

    // Si la acción es 'archive', archivamos/desarchivamos
    if (action === 'archive') {
      const targetArchivedState = isArchived !== undefined ? isArchived : true;
      if (type === 'manual') {
        const entry = await prisma.cashflowManualEntry.update({
          where: { id: parseInt(id) },
          data: { isArchived: targetArchivedState }
        });
        return NextResponse.json(entry);
      } else {
        // Archivar todo el grupo de facturas
        if (!invoiceIds || !Array.isArray(invoiceIds)) return NextResponse.json({ error: 'Missing invoiceIds' }, { status: 400 });
        await prisma.invoice.updateMany({
          where: { id: { in: invoiceIds } },
          data: { isArchived: targetArchivedState }
        });
        return NextResponse.json({ success: true });
      }
    }

    // Si type = 'invoice-date', actualizamos el cashflowDate de una o varias facturas
    if (type === 'invoice-date') {
      if (!invoiceIds || !Array.isArray(invoiceIds)) return NextResponse.json({ error: 'Missing invoiceIds' }, { status: 400 });
      await prisma.invoice.updateMany({
        where: { id: { in: invoiceIds } },
        data: { cashflowDate: new Date(date) }
      });
      await logAction('Mover Fechas Cashflow', `Se movieron ${invoiceIds.length} facturas a ${date}`, companyId);
      return NextResponse.json({ success: true });
    }
    
    // Si no, es una línea manual
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const entry = await prisma.cashflowManualEntry.update({
      where: { id: parseInt(id) },
      data: {
        date: date ? new Date(date) : undefined,
        description,
        amount: amount !== undefined ? parseFloat(amount) : undefined
      }
    });

    await logAction('Editar Cashflow Manual', `ID: ${id}, Nuevo Importe: ${amount}`, companyId);
    return NextResponse.json(entry);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const cookieStore = await cookies();
    const companyId = cookieStore.get('craze_selected_company')?.value || 'CRAZE';
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const clearAll = searchParams.get('clearAll');
    const idsParam = searchParams.get('ids');
    
    if (clearAll === 'true') {
      await prisma.cashflowManualEntry.deleteMany({
        where: { companyId }
      });
      await logAction('Eliminar Todo Cashflow Manual', `Se eliminaron todos los registros manuales`, companyId);
      return NextResponse.json({ success: true, message: 'All manual entries deleted' });
    }

    if (idsParam) {
      const ids = idsParam.split(',').map(id => parseInt(id)).filter(id => !isNaN(id));
      if (ids.length > 0) {
        await prisma.cashflowManualEntry.deleteMany({
          where: { id: { in: ids } }
        });
        return NextResponse.json({ success: true, count: ids.length });
      }
    }

    if (req.body) {
      try {
        const body = await req.json();
        if (body.ids && Array.isArray(body.ids)) {
          await prisma.cashflowManualEntry.deleteMany({
            where: { id: { in: body.ids } }
          });
          return NextResponse.json({ success: true, count: body.ids.length });
        }
      } catch(e) {
        // body might be empty, fallback to query param
      }
    }

    if (!id) return NextResponse.json({ error: 'Missing id or ids' }, { status: 400 });

    await prisma.cashflowManualEntry.delete({
      where: { id: parseInt(id) }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete manual entry' }, { status: 500 });
  }
}
