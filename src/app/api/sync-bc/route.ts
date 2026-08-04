import { NextResponse } from 'next/server';
import { syncBusinessCentral } from '@/lib/bcSync';

export const maxDuration = 60; // Max allowed duration on Vercel Hobby

export async function POST() {
  try {
    const stats = await syncBusinessCentral();
    return NextResponse.json({ success: true, stats });
  } catch (error: any) {
    console.error('Error synchronizing with Business Central:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
