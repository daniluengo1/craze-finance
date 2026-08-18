import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import { logAction } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const cookieStore = await cookies();
    const companyId = cookieStore.get('craze_selected_company')?.value || 'CRAZE';
    
    // Do not return the massive base64 file data or extracted text to the client list view
    const policies = await prisma.insurancePolicy.findMany({
      where: { companyId },
      orderBy: { endDate: 'asc' },
      select: {
        id: true,
        companyId: true,
        description: true,
        startDate: true,
        endDate: true,
        fileName: true,
        createdAt: true,
        updatedAt: true
      }
    });

    return NextResponse.json(policies);
  } catch (error: any) {
    console.error('Error fetching insurances:', error);
    return NextResponse.json({ error: 'Failed to fetch insurances' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const defaultCompany = cookieStore.get('craze_selected_company')?.value || 'CRAZE';
    
    const body = await req.json();
    const { companyId = defaultCompany, description, startDate, endDate, fileName, fileBase64 } = body;

    if (!description || !startDate || !endDate) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    let extractedText = '';

    // If there is a PDF file, try to extract text from it
    if (fileBase64 && fileName?.toLowerCase().endsWith('.pdf')) {
      try {
        const pdfParse = require('pdf-parse');
        const base64Data = fileBase64.split(',')[1] || fileBase64;
        const buffer = Buffer.from(base64Data, 'base64');
        const pdfData = await pdfParse(buffer);
        extractedText = pdfData.text || '';
      } catch (parseError) {
        console.error('Failed to parse PDF text:', parseError);
        // We still save the policy even if text extraction fails
      }
    }

    const policy = await prisma.insurancePolicy.create({
      data: {
        companyId,
        description,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        fileName,
        fileBase64,
        extractedText
      }
    });

    await logAction('Alta Seguro', `Seguro: ${description}`, companyId);

    // Return the policy without the heavy base64 strings
    return NextResponse.json({
      id: policy.id,
      description: policy.description,
      startDate: policy.startDate,
      endDate: policy.endDate,
      fileName: policy.fileName
    });
  } catch (error: any) {
    console.error('Error creating insurance:', error);
    return NextResponse.json({ error: 'Failed to create insurance' }, { status: 500 });
  }
}
