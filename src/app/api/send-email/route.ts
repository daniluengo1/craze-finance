import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import prisma from '@/lib/prisma';
import { generateReportHtml } from '@/lib/reportBuilder';

export async function POST(request: Request) {
  try {
    const { customerId, invoiceIds, to, subject, message } = await request.json();

    if (!invoiceIds || !Array.isArray(invoiceIds) || invoiceIds.length === 0 || !to || !subject || !message || !customerId) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 });
    }

    // The HTML report will be embedded directly in the email body
    // since Vercel Serverless Functions do not support Puppeteer Chromium instances.
    const htmlContent = await generateReportHtml(customerId, invoiceIds, message);

    // Check if we have DB config, else use ethereal
    let transporter;
    let isEthereal = false;
    
    const emailConfig = await prisma.emailConfig.findUnique({ where: { id: 1 } });
    
    if (emailConfig && emailConfig.host && emailConfig.user && emailConfig.password) {
      transporter = nodemailer.createTransport({
        host: emailConfig.host,
        port: emailConfig.port,
        secure: emailConfig.secure,
        auth: {
          user: emailConfig.user,
          pass: emailConfig.password,
        },
      });
    } else {
      isEthereal = true;
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
      console.log('Using Ethereal account:', testAccount.user);
    }

    const fromAddress = emailConfig?.fromName && emailConfig?.fromEmail 
      ? `"${emailConfig.fromName}" <${emailConfig.fromEmail}>` 
      : process.env.SMTP_FROM || '"Craze Finance" <no-reply@craze.com>';

    const signature = `
      <div style="font-family: Arial, sans-serif; font-size: 14px; color: #333; margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px;">
        <p>Thanks and regards,</p>
        <p style="margin-bottom: 5px;"><b>CRAZE FINANCIAL DEPARTMENT</b></p>
        <p style="margin: 0;">E-Mail <a href="mailto:invoice@craze-group.com" style="color: #3b82f6; text-decoration: none;">invoice@craze-group.com</a></p>
        <p style="margin: 0;">Web <a href="https://www.craze-group.com" style="color: #3b82f6; text-decoration: none;">www.craze-group.com</a></p>
        <br/>
        <img src="cid:crazelogo" alt="Craze Group" width="130" style="margin-top: 10px; display: block;" />
      </div>
    `;

    const formattedMessage = message.split('\n\n').map((p: string) => `<p style="margin-top: 0; margin-bottom: 16px;">${p.replace(/\n/g, '<br/>')}</p>`).join('');

    const info = await transporter.sendMail({
      from: fromAddress,
      to,
      subject,
      text: message, // plain text
      html: `<div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; color: #333;">
              ${formattedMessage}
              <br/><br/>
              <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; margin-top: 20px;">
                <h3 style="margin-top: 0; color: #0f172a;">Detalle de Facturas:</h3>
                ${htmlContent}
              </div>
              ${signature}
             </div>`, 
      attachments: [
        {
          filename: 'logo.png',
          path: 'https://craze-finance.vercel.app/logo.png',
          cid: 'crazelogo'
        }
      ]
    });

    console.log('Message sent: %s', info.messageId);
    
    let previewUrl = null;
    if (isEthereal) {
      previewUrl = nodemailer.getTestMessageUrl(info);
      console.log('Preview URL: %s', previewUrl);
    }

    // Save to database for all selected invoices
    for (const invoiceId of invoiceIds) {
      await prisma.reminder.create({
        data: {
          invoiceId,
          messageContent: message,
        }
      });

      await prisma.invoice.update({
        where: { id: invoiceId },
        data: { lastReminderDate: new Date() }
      });
    }

    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (customer) {
      await prisma.actionLog.create({
        data: {
          user: 'Sistema',
          action: 'Correo a cliente (Recordatorio)',
          details: `Cliente: ${customer.name} | Enviado a ${to} para ${invoiceIds.length} factura(s)`,
          companyId: customer.companyId
        }
      });
    }

    return NextResponse.json({ 
      success: true, 
      messageId: info.messageId, 
      previewUrl: previewUrl || null
    });

  } catch (error: any) {
    console.error('Error sending email:', error);
    return NextResponse.json({ error: 'Failed to send email', details: error.message }, { status: 500 });
  }
}
