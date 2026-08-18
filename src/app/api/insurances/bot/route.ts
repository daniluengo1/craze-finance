import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const maxDuration = 60; // Allow 60s for OpenAI

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const companyId = cookieStore.get('craze_selected_company')?.value || 'CRAZE';
    
    const { message } = await req.json();

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'No se ha configurado GEMINI_API_KEY en el servidor (.env)' }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

    // Fetch all insurances for this company to provide context
    const policies = await prisma.insurancePolicy.findMany({
      where: { companyId },
    });

    if (policies.length === 0) {
      return NextResponse.json({ 
        reply: "No tienes ninguna póliza de seguro registrada para esta empresa, por lo que no puedo consultar incidencias." 
      });
    }

    // Build Context
    const parts: any[] = [];
    let contextText = `Eres un asistente inteligente especializado en seguros de la empresa ${policies.length > 0 ? policies[0].companyId : 'CRAZE'}.
A continuación se adjuntan los documentos PDF de las pólizas activas de esta empresa, así como sus datos básicos.
Utiliza esta información para responder a la pregunta del usuario.

DATOS BÁSICOS DE LAS PÓLIZAS:
`;

    policies.forEach((policy, index) => {
      contextText += `\n--- PÓLIZA ${index + 1} ---
Nombre: ${policy.description}
Válida desde: ${policy.startDate.toLocaleDateString()} hasta ${policy.endDate.toLocaleDateString()}
Archivo adjunto: ${policy.fileBase64 ? 'SÍ (ver documento PDF adjunto)' : 'NO HAY DOCUMENTO ADJUNTO'}
`;
      // Attach PDF to Gemini vision
      if (policy.fileBase64 && policy.fileName?.toLowerCase().endsWith('.pdf')) {
        parts.push({
          inlineData: {
            data: policy.fileBase64.split(',')[1] || policy.fileBase64,
            mimeType: 'application/pdf'
          }
        });
      }
    });

    contextText += `\nPREGUNTA DEL USUARIO: ${message}`;
    
    // The prompt text goes first
    parts.unshift(contextText);

    const result = await model.generateContent(parts);
    const reply = result.response.text();

    return NextResponse.json({ reply });

  } catch (error: any) {
    console.error('Error in Insurance Bot:', error);
    return NextResponse.json({ error: error.message || 'Error interno del bot de seguros' }, { status: 500 });
  }
}
