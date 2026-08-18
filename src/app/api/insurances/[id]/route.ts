import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import { logAction } from '@/lib/logger';

// Needs to be awaited in Next 15
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    
    // We only fetch this when downloading the file to avoid loading big base64 strings in the list view
    const policy = await prisma.insurancePolicy.findUnique({
      where: { id: parseInt(id) },
      select: { fileName: true, fileBase64: true }
    });

    if (!policy) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json(policy);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch policy' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const companyId = cookieStore.get('craze_selected_company')?.value || 'CRAZE';
    
    const policy = await prisma.insurancePolicy.delete({
      where: { id: parseInt(id) }
    });

    await logAction('Eliminar Seguro', `Seguro eliminado: ${policy.description}`, companyId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete policy' }, { status: 500 });
  }
}
