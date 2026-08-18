import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow more time for PDF processing

export async function POST(req: Request) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'GEMINI_API_KEY no configurada' }, { status: 500 });
    }

    const { attachments } = await req.json();

    if (!attachments || !Array.isArray(attachments) || attachments.length === 0) {
      return NextResponse.json({ error: 'No se encontraron archivos válidos.' }, { status: 400 });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });

    const prompt = `
Extrae la siguiente información de esta póliza de seguro y sus anexos adjuntos:
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

    const parts: any[] = [prompt];
    
    for (const att of attachments) {
      if (att.fileName?.toLowerCase().endsWith('.pdf')) {
        if (att.fileBase64) {
          parts.push({
            inlineData: {
              data: att.fileBase64.split(',')[1] || att.fileBase64,
              mimeType: 'application/pdf'
            }
          });
        } else if (att.fileUrl) {
          try {
            const fileRes = await fetch(att.fileUrl);
            if (fileRes.ok) {
              const arrayBuffer = await fileRes.arrayBuffer();
              const base64 = Buffer.from(arrayBuffer).toString('base64');
              parts.push({
                inlineData: {
                  data: base64,
                  mimeType: 'application/pdf'
                }
              });
            }
          } catch (e) {
            console.error('Error fetching fileUrl:', att.fileUrl, e);
          }
        }
      }
    }

    const result = await model.generateContent(parts);

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
