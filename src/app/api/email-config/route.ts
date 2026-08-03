import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const config = await prisma.emailConfig.findUnique({
      where: { id: 1 }
    });
    
    // We shouldn't send the password to the frontend for security reasons,
    // but the user needs to know if one is set. So we mask it if it exists.
    if (config) {
      return NextResponse.json({
        ...config,
        password: config.password ? '********' : ''
      });
    }

    // Default empty config if not found
    return NextResponse.json({
      host: 'smtp.office365.com',
      port: 587,
      secure: false,
      user: '',
      password: '',
      fromName: '',
      fromEmail: ''
    });
  } catch (error: any) {
    console.error('Error fetching email config:', error);
    return NextResponse.json({ error: 'Failed to fetch config' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    
    // If the password comes back as masked (user didn't change it),
    // we need to keep the old one.
    if (data.password === '********') {
      const existing = await prisma.emailConfig.findUnique({ where: { id: 1 } });
      data.password = existing?.password || '';
    }

    const config = await prisma.emailConfig.upsert({
      where: { id: 1 },
      update: {
        host: data.host,
        port: Number(data.port),
        secure: data.secure,
        user: data.user,
        password: data.password,
        fromName: data.fromName,
        fromEmail: data.fromEmail,
      },
      create: {
        id: 1,
        host: data.host,
        port: Number(data.port),
        secure: data.secure,
        user: data.user,
        password: data.password,
        fromName: data.fromName,
        fromEmail: data.fromEmail,
      }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error saving email config:', error);
    return NextResponse.json({ error: 'Failed to save config' }, { status: 500 });
  }
}
