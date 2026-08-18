import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import * as XLSX from 'xlsx';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const companyId = cookieStore.get('craze_selected_company')?.value || 'CRAZE';

    const reports = await prisma.bwaReport.findMany({
      where: { companyId },
      orderBy: { date: 'desc' }
    });

    return NextResponse.json(reports);
  } catch (error: any) {
    console.error('Error fetching BWA reports:', error);
    return NextResponse.json({ error: 'Failed to fetch BWA reports' }, { status: 500 });
  }
}

const parseExcelFile = async (formData: FormData, fieldName: string) => {
  const file = formData.get(fieldName) as File;
  if (!file) return null;
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  return XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
};

const getExcelDate = (val: any) => {
  if (typeof val === 'number') {
    return new Date(Math.round((val - 25569) * 864e5));
  }
  return val ? new Date(val) : new Date();
};

const getMonthStr = (date: Date) => {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  if (isNaN(date.getTime())) return 'Jan';
  return months[date.getMonth()];
};

const safeStr = (val: any) => {
  if (val === null || val === undefined) return '';
  let str = String(val).trim();
  if (str.endsWith('.0')) str = str.slice(0, -2);
  return str;
};

const safeNum = (val: any) => {
  if (typeof val === 'number') return val;
  const num = parseFloat(String(val));
  return isNaN(num) ? 0 : num;
};

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const companyId = cookieStore.get('craze_selected_company')?.value || 'CRAZE';
    const formData = await request.formData();

    const df_bwa = await parseExcelFile(formData, 'bwaStructure') || [];
    const df_purchases = await parseExcelFile(formData, 'purchases') || [];
    const df_posting = await parseExcelFile(formData, 'postingSetup') || [];
    const df_mapping = await parseExcelFile(formData, 'glMapping') || [];
    const df_cm_headers = await parseExcelFile(formData, 'cmHeaders') || [];
    const df_cm_lines = await parseExcelFile(formData, 'cmLines') || [];

    if (df_bwa.length === 0 || df_purchases.length === 0) {
      return NextResponse.json({ error: 'Missing required files (bwaStructure and purchases)' }, { status: 400 });
    }

    // Prepare Mappings
    const postingMap = new Map<string, string>();
    df_posting.forEach((row: any) => {
      const gppg = safeStr(row['Gen. Prod. Posting Group']);
      const acc = safeStr(row['Purch. Account']);
      if (gppg && acc) postingMap.set(gppg, acc);
    });

    const mappingData = new Map<string, { group: string, level: string, description: string }>();
    df_mapping.forEach((row: any) => {
      const no = safeStr(row['No.']);
      const group = safeStr(row['BWA Group']);
      const level = safeStr(row['BWA Level']);
      const description = safeStr(row['Description']);
      if (no) mappingData.set(no, { group, level, description });
    });

    const processedLines: any[] = [];

    // Process Purchases
    df_purchases.forEach((row: any) => {
      const itemNo = safeStr(row['No.']);
      const vendor = safeStr(row['Buy-from Vendor Name']);
      const amount = safeNum(row['Amount']);
      const date = getExcelDate(row['Posting Date']);
      const month = getMonthStr(date);
      
      let bwaGroup = safeStr(row['BWA Group']);
      let bwaLevel = safeStr(row['BWA Level']);

      if (!bwaGroup || bwaGroup === '0' || bwaGroup === 'nan') {
        const account = postingMap.get(itemNo);
        if (account && mappingData.has(account)) {
          const mapEntry = mappingData.get(account)!;
          bwaGroup = mapEntry.group;
          bwaLevel = mapEntry.level;
        }
      }

      if (bwaGroup && bwaGroup !== 'nan') {
        processedLines.push({
          Item: itemNo,
          Description: safeStr(row['Description']),
          Vendor: vendor,
          Amount: amount,
          Month: month,
          BwaGroupID: bwaGroup,
          BwaLevelID: bwaLevel
        });
      }
    });

    // Process Credit Memos
    if (df_cm_headers.length > 0 && df_cm_lines.length > 0) {
      const cmDates = new Map<string, Date>();
      df_cm_headers.forEach((row: any) => {
        const no = safeStr(row['No.']);
        if (no) cmDates.set(no, getExcelDate(row['Posting Date']));
      });

      df_cm_lines.forEach((row: any) => {
        const docNo = safeStr(row['Document No.']);
        if (!docNo || !cmDates.has(docNo)) return;

        const itemNo = safeStr(row['No.'] || row['Nr.']);
        const vendor = safeStr(row['Buy-from Vendor Name']);
        let amount = safeNum(row['Amount']);
        if (amount > 0) amount = -amount; // Credit memo amounts should be negative to offset purchases

        const date = cmDates.get(docNo)!;
        const month = getMonthStr(date);

        let bwaGroup = safeStr(row['BWA Group']);
        let bwaLevel = safeStr(row['BWA Level']);

        if (!bwaGroup || bwaGroup === '0' || bwaGroup === 'nan') {
          const account = postingMap.get(itemNo);
          if (account && mappingData.has(account)) {
            const mapEntry = mappingData.get(account)!;
            bwaGroup = mapEntry.group;
            bwaLevel = mapEntry.level;
          }
        }

        if (bwaGroup && bwaGroup !== 'nan') {
          processedLines.push({
            Item: itemNo,
            Description: safeStr(row['Description']),
            Vendor: vendor,
            Amount: amount,
            Month: month,
            BwaGroupID: bwaGroup,
            BwaLevelID: bwaLevel
          });
        }
      });
    }

    // Build Final Structure
    const finalData: any[] = [];
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    df_bwa.forEach((row: any) => {
      const groupName = safeStr(row['BWA Group']);
      const levelName = safeStr(row['Level']);

      const values: any = {};
      months.forEach(m => {
        values[m] = safeNum(row[m]);
      });

      const entry = {
        BwaGroup: groupName,
        Level: levelName,
        Values: values,
        Total: safeNum(row['#Consolidated']),
        IsPurchase: false,
        Detail: [] as any[]
      };

      // Try to match level by Description in mappingData to get the GID/LID
      let gid = '';
      let lid = '';
      for (const [_, mapEntry] of mappingData.entries()) {
        if (mapEntry.description === levelName) {
          gid = mapEntry.group;
          lid = mapEntry.level;
          break;
        }
      }

      if (gid && lid) {
        entry.IsPurchase = true;
        const levelLines = processedLines.filter(line => line.BwaGroupID === gid && line.BwaLevelID === lid);
        
        if (levelLines.length > 0) {
          // Group by Item, Description, Vendor
          const detailMap = new Map<string, any>();
          
          levelLines.forEach(line => {
            const key = `${line.Item}|||${line.Description}|||${line.Vendor}`;
            if (!detailMap.has(key)) {
              detailMap.set(key, {
                Item: line.Item,
                Description: line.Description,
                Vendor: line.Vendor,
                Values: months.reduce((acc: any, m: string) => ({ ...acc, [m]: 0 }), {}),
                Total: 0
              });
            }
            
            const detailEntry = detailMap.get(key);
            detailEntry.Values[line.Month] += line.Amount;
            detailEntry.Total += line.Amount;
          });

          entry.Detail = Array.from(detailMap.values());
        }
      }

      finalData.push(entry);
    });

    // Save to DB
    const report = await prisma.bwaReport.create({
      data: {
        companyId,
        data: JSON.stringify(finalData)
      }
    });

    return NextResponse.json(report);
  } catch (error: any) {
    console.error('Error processing BWA:', error);
    return NextResponse.json({ error: 'Error processing files', details: error.message }, { status: 500 });
  }
}
