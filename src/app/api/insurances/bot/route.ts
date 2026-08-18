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
    let context = "Eres el asistente inteligente de seguros de la empresa Craze. Tu tarea es responder dudas sobre incidencias basadas ESTRICTAMENTE en las siguientes pólizas de la empresa:\n\n";

    policies.forEach((policy) => {
      const isActive = new Date() >= policy.startDate && new Date() <= policy.endDate;
      context += `--- SEGURO: ${policy.description} ---\n`;
      context += `Empresa titular: ${policy.companyId}\n`;
      context += `Estado: ${isActive ? 'ACTIVO' : 'CADUCADO'} (Válido del ${policy.startDate.toLocaleDateString()} al ${policy.endDate.toLocaleDateString()})\n`;
      if (policy.extractedText) {
        // Limit text length if it's too massive, but usually 50k tokens is fine for GPT-4o
        context += `TEXTO DE LA PÓLIZA:\n${policy.extractedText.substring(0, 30000)}\n`; 
      } else {
        context += `TEXTO DE LA PÓLIZA: No hay documento adjunto o no se pudo extraer el texto.\n`;
      }
      context += `---------------------------------\n\n`;
    });

    context += "Responde de forma clara y directa a la siguiente consulta del usuario. Si un seguro no cubre algo o está caducado, avísalo explícitamente. Si no encuentras la respuesta en las pólizas proporcionadas, di que no lo sabes basándote en la documentación.\n";
    context += "\nCONSULTA DEL USUARIO: " + message;

    const result = await model.generateContent(context);
    const reply = result.response.text();

    return NextResponse.json({ reply });

  } catch (error: any) {
    console.error('Error in Insurance Bot:', error);
    return NextResponse.json({ error: error.message || 'Error interno del bot de seguros' }, { status: 500 });
  }
}
