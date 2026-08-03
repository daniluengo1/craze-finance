import prisma from './prisma';
import { getSession } from './auth';
import { cookies } from 'next/headers';

export async function logAction(
  action: string,
  details?: string
) {
  try {
    const session = await getSession();
    const user = session?.username || 'Sistema';

    const cookieStore = await cookies();
    const companyId = cookieStore.get('craze_selected_company')?.value || 'CRAZE';

    await prisma.actionLog.create({
      data: {
        user,
        action,
        details,
        companyId,
      }
    });
  } catch (error) {
    console.error('Failed to write audit log:', error);
  }
}
