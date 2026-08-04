import { NextResponse } from 'next/server';
import { syncBusinessCentral } from '@/lib/bcSync';

export const maxDuration = 60; // Max allowed duration on Vercel Hobby

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const stats = await syncBusinessCentral(body.company);
    return NextResponse.json({ success: true, stats });
  } catch (error: any) {
    console.error('Error synchronizing with Business Central:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
