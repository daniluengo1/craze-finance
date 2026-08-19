import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      return NextResponse.json({ error: 'No GEMINI_API_KEY found' }, { status: 500 });
    }
    
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
    const data = await res.json();
    
    if (data.error) {
      return NextResponse.json({ error: data.error }, { status: 500 });
    }
    
    const modelNames = data.models.map((m: any) => m.name);
    return NextResponse.json({ models: modelNames });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
