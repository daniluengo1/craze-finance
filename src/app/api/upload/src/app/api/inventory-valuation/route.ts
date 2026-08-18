import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const cookieStore = await cookies();
    const companyId = cookieStore.get('craze_selected_company')?.value || 'CRAZE';

    const valuations = await prisma.inventoryValuation.findMany({
      where: { companyId },
      orderBy: { month: 'desc' }
    });

    return NextResponse.json(valuations);
  } catch (error: any) {
    console.error('Error fetching inventory valuation:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const companyId = cookieStore.get('craze_selected_company')?.value || 'CRAZE';
    const body = await req.json();
    
    const { month, totalSystemVal, totalNewVal, difference, details } = body;

    // Check if there is already a valuation for this month and company
    const startOfMonth = new Date(month);
    startOfMonth.setDate(1);
    startOfMonth.setHours(0,0,0,0);
    
    const endOfMonth = new Date(startOfMonth);
    endOfMonth.setMonth(endOfMonth.getMonth() + 1);

    const existing = await prisma.inventoryValuation.findFirst({
      where: {
        companyId,
        month: {
          gte: startOfMonth,
          lt: endOfMonth
        }
      }
    });

    let valuation;
    if (existing) {
      valuation = await prisma.inventoryValuation.update({
        where: { id: existing.id },
        data: {
          totalSystemVal: parseFloat(totalSystemVal),
          totalNewVal: parseFloat(totalNewVal),
          difference: parseFloat(difference),
          details: details ? JSON.stringify(details) : null,
          month: new Date(month)
        }
      });
    } else {
      valuation = await prisma.inventoryValuation.create({
        data: {
          companyId,
          month: new Date(month),
          totalSystemVal: parseFloat(totalSystemVal),
          totalNewVal: parseFloat(totalNewVal),
          difference: parseFloat(difference),
          details: details ? JSON.stringify(details) : null
        }
      });
    }

    return NextResponse.json({ success: true, data: valuation });
  } catch (error: any) {
    console.error('Error saving inventory valuation:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
