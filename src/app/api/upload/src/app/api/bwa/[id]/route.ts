import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const companyId = cookieStore.get('craze_selected_company')?.value || 'CRAZE';

    const report = await prisma.bwaReport.findFirst({
      where: { 
        id: parseInt(id),
        companyId 
      }
    });

    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    return NextResponse.json(report);
  } catch (error) {
    console.error('Error fetching BWA report:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const companyId = cookieStore.get('craze_selected_company')?.value || 'CRAZE';

    await prisma.bwaReport.deleteMany({
      where: { 
        id: parseInt(id),
        companyId 
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting BWA report:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
