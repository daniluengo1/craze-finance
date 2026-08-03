import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import prisma from '@/lib/prisma';
import puppeteer from 'puppeteer';
import { generateReportHtml } from '@/lib/reportBuilder';

export async function POST(request: Request) {
  try {
    const { customerId, invoiceIds, to, subject, message } = await request.json();

    if (!invoiceIds || !Array.isArray(invoiceIds) || invoiceIds.length === 0 || !to || !subject || !message || !customerId) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 });
    }

    // Generate HTML for the PDF
    const htmlContent = await generateReportHtml(customerId, invoiceIds, message);

    // Generate PDF using Puppeteer
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'domcontentloaded' });
    const pdfBuffer = await page.pdf({ 
      format: 'A4', 
      printBackground: true,
      margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' } 
    });
    await browser.close();

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
      html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
              ${formattedMessage}
              ${signature}
             </div>`, 
      attachments: [
        {
          filename: 'Overdue_Report.pdf',
          content: Buffer.from(pdfBuffer),
          contentType: 'application/pdf'
        },
        {
          filename: 'logo.png',
          path: process.cwd() + '/public/logo.png',
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
