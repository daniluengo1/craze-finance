import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

// Helper to handle Excel dates
function excelToDate(excelDate: any): string | null {
  if (!excelDate) return null;
  if (typeof excelDate === 'number') {
    // Excel dates are days since 1899-12-30
    const d = new Date(Math.round((excelDate - 25569) * 86400 * 1000));
    return d.toISOString();
  }
  return new Date(excelDate).toISOString();
}

const VALID_DOCUMENT_TYPES = [
  'refund', 'reembolso',
  'credit memo', 'abono',
  'payment', 'pago',
  '', 'empty', undefined, null
];

function isValidType(type: string | null | undefined): boolean {
  if (!type) return true; // empty
  const lower = String(type).trim().toLowerCase();
  return VALID_DOCUMENT_TYPES.includes(lower);
}

import * as fs from 'fs';

function isOpen(val: any): boolean {
  if (val === true || val === 1) return true;
  if (!val) return false;
  const lower = String(val).trim().toLowerCase();
  return lower === 'yes' || lower === 'sí' || lower === 'si' || lower === 'true' || lower === '1' || lower === 'verdadero' || lower === 'open';
}

export async function GET() {
  try {
    const entries: any[] = [];

    // 1. Process Customer Ledger Entries
    try {
      const cPath = 'C:/Users/danie/Downloads/Customer Ledger Entries (20).xlsx';
      const cBuffer = fs.readFileSync(cPath);
      const cWb = XLSX.read(cBuffer, { type: 'buffer' });
      const cData = XLSX.utils.sheet_to_json(cWb.Sheets[cWb.SheetNames[0]]);

      cData.forEach((row: any) => {
        if (!isOpen(row['Open'])) return;
        if (!isValidType(row['Document Type'])) return;

        entries.push({
          type: 'Customer',
          entityNo: row['Customer No.'],
          entityName: row['Customer Name'] || 'Unknown',
          postingDate: excelToDate(row['Posting Date']),
          documentType: row['Document Type'] || 'Empty',
          documentNo: row['Document No.'],
          externalDocumentNo: row['Document No. Received'] || '',
          currencyCode: row['Currency Code'] || '',
          originalAmount: parseFloat(row['Original Amount'] || 0),
          remainingAmount: parseFloat(row['Remaining Amount'] || 0),
          description: row['Description'] || '',
          paymentMethodCode: row['Payment Method Code'] || row['Payment method'] || ''
        });
      });
    } catch (e) {
      console.error('Error reading Customer Ledger Entries:', e);
    }

    // 2. Process Vendor Ledger Entries
    try {
      const vPath = 'C:/Users/danie/Downloads/Vendor Ledger Entries.xlsx';
      const vBuffer = fs.readFileSync(vPath);
      const vWb = XLSX.read(vBuffer, { type: 'buffer' });
      const vData = XLSX.utils.sheet_to_json(vWb.Sheets[vWb.SheetNames[0]]);

      vData.forEach((row: any) => {
        if (!isOpen(row['Open'])) return;
        if (!isValidType(row['Document Type'])) return;

        entries.push({
          type: 'Vendor',
          entityNo: row['Vendor No.'],
          entityName: row['Vendor Name'] || 'Unknown',
          postingDate: excelToDate(row['Posting Date']),
          documentType: row['Document Type'] || 'Empty',
          documentNo: row['Document No.'],
          externalDocumentNo: row['External Document No.'] || '',
          currencyCode: row['Currency Code'] || '',
          originalAmount: parseFloat(row['Original Amount'] || 0),
          remainingAmount: parseFloat(row['Remaining Amount'] || 0),
          description: row['Description'] || '',
          paymentMethodCode: row['Payment Method Code'] || row['Payment method'] || ''
        });
      });
    } catch (e) {
      console.error('Error reading Vendor Ledger Entries:', e);
    }

    return NextResponse.json(entries);
  } catch (error: any) {
    console.error('Error fetching ledger entries:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
