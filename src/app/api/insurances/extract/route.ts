import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow more time for PDF processing

export async function POST(req: Request) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'GEMINI_API_KEY no configurada' }, { status: 500 });
    }

    const { fileBase64, fileName } = await req.json();

    if (!fileBase64 || !fileName.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({ error: 'Archivo no válido. Se requiere un PDF.' }, { status: 400 });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });

    const base64Data = fileBase64.split(',')[1] || fileBase64;

    const prompt = `
Extrae la siguiente información de esta póliza de seguro:
1. Una descripción corta o nombre del seguro (ej: "RC Empresa", "Seguro Coche").
2. La fecha de inicio de la póliza en formato YYYY-MM-DD.
3. La fecha de fin o vencimiento de la póliza en formato YYYY-MM-DD.

Devuelve SOLO un objeto JSON válido con esta estructura exacta y nada más:
{
  "description": "string",
  "startDate": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD"
}
Si alguna fecha no aparece, intenta deducirla o déjala en blanco.
`;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64Data,
          mimeType: 'application/pdf'
        }
      }
    ]);

    let responseText = result.response.text();
    // Clean up potential markdown formatting
    responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    
    const parsedData = JSON.parse(responseText);
    
    return NextResponse.json(parsedData);
  } catch (error: any) {
    console.error('Error extrañendo datos del PDF:', error);
    return NextResponse.json({ error: error.message || 'Error al procesar el PDF' }, { status: 500 });
  }
}
