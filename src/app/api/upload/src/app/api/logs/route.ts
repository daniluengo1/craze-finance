import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    // Only admins or people with configuracion or auditoria permission should see logs
    const perms = JSON.parse(session.permissions || '[]');
    if (!perms.includes('admin') && !perms.includes('configuracion') && !perms.includes('auditoria')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const logs = await prisma.actionLog.findMany({
      orderBy: { date: 'desc' },
      take: 100 // Limit to last 100 for performance
    });

    return NextResponse.json(logs);
  } catch (error) {
    console.error('Failed to fetch logs:', error);
    return NextResponse.json({ error: 'Failed to fetch logs' }, { status: 500 });
  }
}
