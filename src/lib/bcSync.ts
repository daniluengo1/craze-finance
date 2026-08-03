import prisma from '@/lib/prisma';

// Helper to get OAuth token via Entra ID for Business Central
async function getAccessToken(tenantId: string, clientId: string, clientSecret: string) {
  const tokenEndpoint = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  
  const params = new URLSearchParams();
  params.append('client_id', clientId);
  params.append('client_secret', clientSecret);
  params.append('grant_type', 'client_credentials');
  params.append('scope', 'https://api.businesscentral.dynamics.com/.default');

  const res = await fetch(tokenEndpoint, {
    method: 'POST',
    body: params,
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to obtain access token: ${errorText}`);
  }

  const data = await res.json();
  return data.access_token;
}

export async function syncBusinessCentral() {
  const config = await prisma.businessCentralConfig.findUnique({ where: { id: 1 } });
  if (!config || !config.tenantId || !config.clientId || !config.clientSecret) {
    throw new Error('La configuración de Business Central está incompleta. Por favor, rellena todos los campos en Ajustes.');
  }

  const accessToken = await getAccessToken(config.tenantId, config.clientId, config.clientSecret);
  const baseUrl = `https://api.businesscentral.dynamics.com/v2.0/${config.tenantId}/${config.environment}/api/v2.0`;
  const odataBaseUrl = `https://api.businesscentral.dynamics.com/v2.0/${config.tenantId}/${config.environment}/ODataV4`;

  // Fetch all companies from BC to get their IDs
  const companiesUrl = `${baseUrl}/companies`;
  const compRes = await fetch(companiesUrl, {
    headers: { Authorization: `Bearer ${accessToken}`, 'Accept': 'application/json' }
  });
  if (!compRes.ok) throw new Error(`Failed to fetch companies: ${await compRes.text()}`);
  const compData = await compRes.json();

  const targetCompanyNames = [
    'CRAZE', 
    'Craze Iberia SL', 
    'Craze UK', 
    'CRAZE Group AG', 
    'Craze Entertainment'
  ];

  let totalStats = {
    customers: 0,
    invoices: 0,
    vendors: 0,
    purchaseInvoices: 0
  };

  const salespeopleMap = new Map<string, string>();
  try {
    const excelPath = require('path').join(process.cwd(), 'Salespeople_Purchasers.xlsx');
    const xlsx = require('xlsx');
    if (require('fs').existsSync(excelPath)) {
      const wb = xlsx.readFile(excelPath);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = xlsx.utils.sheet_to_json(ws) as any[];
      for (const row of data) {
        if (row.Code !== undefined && row.Name !== undefined) {
          salespeopleMap.set(row.Code.toString(), row.Name.toString());
        }
      }
      console.log(`[bcSync] Loaded ${salespeopleMap.size} salespeople mappings from Excel.`);
    }
  } catch (e) {
    console.warn('[bcSync] Could not load Salespeople Excel:', e);
  }

  for (const companyName of targetCompanyNames) {
    console.log(`\n--- Sincronizando empresa: ${companyName} ---`);
    
    // Attempt to match company name exactly as returned by BC
    const matchedCompany = compData.value.find((c: any) => c.name.toLowerCase() === companyName.toLowerCase());
    if (!matchedCompany) {
      console.warn(`Empresa "${companyName}" no encontrada en este entorno de BC. Saltando...`);
      continue;
    }

    const companyId = matchedCompany.id;
    const exactCompanyName = matchedCompany.name; // Keep exact casing from BC
    const escapedCompanyName = exactCompanyName.replace(/'/g, "''");
    const companySegment = `/companies(${companyId})`;

    // Ensure CashflowConfig exists for this company
    await prisma.cashflowConfig.upsert({
      where: { companyId: exactCompanyName },
      update: {},
      create: { companyId: exactCompanyName }
    });

    try {
      // 1. Fetch Payment Methods mapping
      const paymentMethodsUrl = `${baseUrl}${companySegment}/paymentMethods`;
      const pmRes = await fetch(paymentMethodsUrl, {
        headers: { Authorization: `Bearer ${accessToken}`, 'Accept': 'application/json' }
      });
      let pmMap: Record<string, string> = {};
      if (pmRes.ok) {
        const pmData = await pmRes.json();
        for (const pm of pmData.value) {
          pmMap[pm.id] = pm.code;
        }
      } else {
        console.warn(`[${exactCompanyName}] Failed to fetch payment methods: ${await pmRes.text()}`);
      }

      // 2. Fetch Customers
      console.log(`[${exactCompanyName}] Sincronizando Customers...`);
      // Use Custom API instead of standard API to get salesperson details
      const customApiBaseUrl = `https://api.businesscentral.dynamics.com/v2.0/${config.tenantId}/${config.environment}/api/craze/integrations/v1.0/companies(${companyId})`;
      const customersUrl = `${customApiBaseUrl}/customers`;
      const custRes = await fetch(customersUrl, {
        headers: { Authorization: `Bearer ${accessToken}`, 'Accept': 'application/json' }
      });
      
      if (!custRes.ok) throw new Error(`Failed to fetch customers from custom API: ${await custRes.text()}`);
      const customersData = await custRes.json();
      
      if (customersData.value && customersData.value.length > 0) {
        console.log('Sample custom customer:', JSON.stringify(customersData.value[0]));
      }

      for (const c of customersData.value) {
        // Handle both standard and custom API field names
        const customerNumber = c.number || c.no;
        if (!customerNumber) continue;

        const pmCode = c.paymentMethodId && pmMap[c.paymentMethodId] ? pmMap[c.paymentMethodId] : 'Standard';

        const existingCustomer = await prisma.customer.findUnique({
          where: { bcId_companyId: { bcId: customerNumber, companyId: exactCompanyName } }
        });

        const custData = {
          name: c.displayName || c.name || c.number,
          email: c.email || null,
          paymentMethod: pmCode,
          riskLimit: c.creditLimitLCY !== undefined ? c.creditLimitLCY : (c.creditLimit || 0),
          balance: c.balance || c.balanceLCY || 0,
          salespersonCode: c.salespersonCode || c.salesPersonCode || null,
          salespersonName: c.salespersonName || c.salesPersonName || (c.salespersonCode ? salespeopleMap.get(c.salespersonCode) : null) || (c.salesPersonCode ? salespeopleMap.get(c.salesPersonCode) : null) || c.salespersonCode || c.salesPersonCode || null,
        };

        if (existingCustomer) {
          await prisma.customer.update({
            where: { id: existingCustomer.id },
            data: custData
          });
        } else {
          await prisma.customer.create({
            data: {
              bcId: customerNumber,
              companyId: exactCompanyName,
              ...custData
            }
          });
        }
        totalStats.customers++;
      }

      // 3. Fetch Customer Ledger Entries (Invoices/Recobros)
      console.log(`[${exactCompanyName}] Sincronizando Customer Ledger Entries...`);
      try {
        const customApiBaseUrl = `https://api.businesscentral.dynamics.com/v2.0/${config.tenantId}/${config.environment}/api/craze/integrations/v1.0/companies(${companyId})`;
        const ledgerUrl = `${customApiBaseUrl}/custLedgerEntries?$filter=(documentType eq 'Invoice' or documentType eq 'Credit Memo' or documentType eq 'Refund') and open eq true`;
        
        const ledgerRes = await fetch(ledgerUrl, {
          headers: { Authorization: `Bearer ${accessToken}`, 'Accept': 'application/json' }
        });

        if (!ledgerRes.ok) throw new Error(`Custom API failed: ${await ledgerRes.text()}`);
        const ledgerData = await ledgerRes.json();
        const syncedCustomerInvoiceIds: string[] = [];

        for (const entry of ledgerData.value) {
          const customer = await prisma.customer.findUnique({ where: { bcId_companyId: { bcId: entry.customerNo, companyId: exactCompanyName } } });
          if (!customer) continue;

          const remainingAmount = entry.remainingAmount !== undefined ? entry.remainingAmount : 0;
          const originalAmount = entry.amount !== undefined ? entry.amount : 0;
          const dueDate = entry.dueDate ? new Date(entry.dueDate) : new Date();
          const paymentMethodToSave = entry.paymentMethodCode ? entry.paymentMethodCode : customer.paymentMethod;
          
          // Use promisedPayDate as the fallback for confirmedPaymentDate since it wasn't added to API
          const confirmedDateStr = entry.confirmedPaymentDate || entry.crazeConfirmedPaymentDate || entry.craze_ConfirmedPaymentDate || entry.promisedPayDate;
          // Note: In BC, an empty date is often "0001-01-01" or similar. We should ignore invalid dates.
          const confirmedPaymentDate = (confirmedDateStr && !confirmedDateStr.startsWith('0001-01-01')) ? new Date(confirmedDateStr) : null;

          syncedCustomerInvoiceIds.push(entry.documentNo);

          const existingInvoice = await prisma.invoice.findUnique({
            where: { bcId_companyId: { bcId: entry.documentNo, companyId: exactCompanyName } }
          });

          const invData = {
            customerId: customer.id,
            type: entry.documentType === 'Credit Memo' ? 'Credit Memo' : entry.documentType === 'Refund' ? 'Refund' : 'invoice',
            status: dueDate < new Date() ? 'Overdue' : 'Open',
            amount: entry.remainingAmount,
            originalAmount: entry.originalAmount,
            currencyCode: entry.currencyCode || 'EUR',
            paymentMethod: paymentMethodToSave,
            dueDate,
            confirmedPaymentDate,
          };

          if (existingInvoice) {
            await prisma.invoice.update({
              where: { id: existingInvoice.id },
              data: invData
            });
          } else {
            await prisma.invoice.create({
              data: {
                bcId: entry.documentNo,
                companyId: exactCompanyName,
                ...invData
              }
            });
          }
          totalStats.invoices++;
        }

        if (syncedCustomerInvoiceIds.length > 0) {
          await prisma.invoice.updateMany({
            where: { 
              companyId: exactCompanyName,
              bcId: { notIn: syncedCustomerInvoiceIds } 
            },
            data: { status: 'Closed' }
          });
        }
      } catch (error) {
        console.warn(`[${exactCompanyName}] Custom API failed, falling back to ODataV4:`, error);
        
        const fallbackLedgerUrl = `${odataBaseUrl}/Company('${escapedCompanyName}')/Cust_LedgerEntries?$filter=Document_Type eq 'Invoice' and Open eq true`;
        const fallbackRes = await fetch(fallbackLedgerUrl, {
          headers: { Authorization: `Bearer ${accessToken}`, 'Accept': 'application/json' }
        });
        
        if (fallbackRes.ok) {
          const fallbackData = await fallbackRes.json();
          const syncedCustomerInvoiceIds: string[] = [];

          for (const entry of fallbackData.value) {
            const customer = await prisma.customer.findUnique({ where: { bcId_companyId: { bcId: entry.Customer_No, companyId: exactCompanyName } } });
            if (!customer) continue;

            const remainingAmount = entry.Remaining_Amount !== undefined ? entry.Remaining_Amount : 0;
            const originalAmount = entry.Amount !== undefined ? entry.Amount : 0;
            const dueDate = entry.Due_Date ? new Date(entry.Due_Date) : new Date();
            
            // Map Promised_Pay_Date as requested by user
            const confirmedDateStr = entry.Promised_Pay_Date;
            const confirmedPaymentDate = (confirmedDateStr && !confirmedDateStr.startsWith('0001-01-01')) ? new Date(confirmedDateStr) : null;

            syncedCustomerInvoiceIds.push(entry.Document_No);

            const existingFallbackInvoice = await prisma.invoice.findUnique({
              where: { bcId_companyId: { bcId: entry.Document_No, companyId: exactCompanyName } }
            });

            const fallbackInvData = {
              amount: remainingAmount,
              originalAmount: originalAmount,
              dueDate: dueDate,
              status: dueDate < new Date() ? 'Overdue' : 'Open',
              paymentMethod: customer.paymentMethod,
              confirmedPaymentDate: confirmedPaymentDate
            };

            if (existingFallbackInvoice) {
              await prisma.invoice.update({
                where: { id: existingFallbackInvoice.id },
                data: fallbackInvData
              });
            } else {
              await prisma.invoice.create({
                data: {
                  bcId: entry.Document_No,
                  companyId: exactCompanyName,
                  customerId: customer.id,
                  type: 'Invoice',
                  ...fallbackInvData
                }
              });
            }
            totalStats.invoices++;
          }

          if (syncedCustomerInvoiceIds.length > 0) {
            await prisma.invoice.updateMany({
              where: { 
                companyId: exactCompanyName,
                bcId: { notIn: syncedCustomerInvoiceIds } 
              },
              data: { status: 'Closed' }
            });
          }
        } else {
          console.error(`[${exactCompanyName}] Fallback Cust_LedgerEntries also failed:`, await fallbackRes.text());
        }
      }

      // 4. Fetch Vendors
      console.log(`[${exactCompanyName}] Sincronizando Vendors...`);
      const vendorsUrl = `${baseUrl}${companySegment}/vendors`;
      const venRes = await fetch(vendorsUrl, {
        headers: { Authorization: `Bearer ${accessToken}`, 'Accept': 'application/json' }
      });
      
      if (!venRes.ok) throw new Error(`Failed to fetch vendors: ${await venRes.text()}`);
      const vendorsData = await venRes.json();
      
      for (const v of vendorsData.value) {
        const pmCode = v.paymentMethodId && pmMap[v.paymentMethodId] ? pmMap[v.paymentMethodId] : 'Standard';

        const existingVendor = await prisma.vendor.findUnique({
          where: { bcId_companyId: { bcId: v.number, companyId: exactCompanyName } }
        });

        const venData = {
          name: v.displayName || v.number,
          email: v.email || null,
          paymentMethod: pmCode,
          balance: v.balance || 0,
        };

        if (existingVendor) {
          await prisma.vendor.update({
            where: { id: existingVendor.id },
            data: venData
          });
        } else {
          await prisma.vendor.create({
            data: {
              bcId: v.number,
              companyId: exactCompanyName,
              ...venData
            }
          });
        }
        totalStats.vendors++;
      }

      // 5. Fetch Vendor Ledger Entries (Pagos a proveedores)
      console.log(`[${exactCompanyName}] Sincronizando Vendor Ledger Entries...`);
      const vendorLedgerUrl = `${customApiBaseUrl}/vendorLedgerEntries?$filter=(documentType eq 'Invoice' or documentType eq 'Credit Memo') and open eq true`;
      
      const vendorLedgerRes = await fetch(vendorLedgerUrl, {
        headers: { Authorization: `Bearer ${accessToken}`, 'Accept': 'application/json' }
      });

      if (!vendorLedgerRes.ok) {
        console.warn(`[${exactCompanyName}] Failed to fetch VendorLedgerEntries: ${await vendorLedgerRes.text()}`);
        continue;
      }

      const vendorLedgerData = await vendorLedgerRes.json();

      const syncedVendorInvoiceIds: string[] = [];

      for (const entry of vendorLedgerData.value) {
        const vendorNo = entry.vendorNo;
        if (!vendorNo) continue;

        const vendor = await prisma.vendor.findUnique({ where: { bcId_companyId: { bcId: vendorNo, companyId: exactCompanyName } } });
        if (!vendor) continue;

        const documentNo = entry.documentNo;
        if (!documentNo) continue;

        syncedVendorInvoiceIds.push(documentNo);

        const existingPurchaseInvoice = await prisma.purchaseInvoice.findFirst({
          where: { bcId: documentNo, companyId: exactCompanyName }
        });

        const entryStatus = entry.open ? 'Open' : 'Closed';
        const dueDate = new Date(entry.dueDate || new Date());
        
        // Fechas de pago
        const schedulePaymentDateStr = entry.scheduledPaymentDateBCT || entry.paymentProvisionDateBCT || entry.dueDate;
        const schedulePaymentDate = schedulePaymentDateStr && !schedulePaymentDateStr.startsWith('0001-01-01') ? new Date(schedulePaymentDateStr) : null;
        
        const noPaymentVal = entry.noPaymentBCT || entry.onHold === 'NO PAGAR';

        const pInvData = {
          amount: parseFloat(entry.remainingAmount !== undefined ? entry.remainingAmount : entry.amount || 0),
          originalAmount: parseFloat(entry.originalAmount !== undefined ? entry.originalAmount : entry.amount || 0),
          dueDate: dueDate,
          schedulePaymentDate: schedulePaymentDate,
          status: entryStatus === 'Open' && dueDate < new Date() ? 'Overdue' : entryStatus,
          paymentMethod: vendor.paymentMethod,
          percentagePaymentApproval: entry.paymentApprovalCRZ !== undefined && entry.paymentApprovalCRZ !== null ? parseFloat(entry.paymentApprovalCRZ) : null,
          approvalUsers: entry.approvedUsersBCT || null,
          approvedUsers: entry.approvedUsersBCT || null,
          rejectedUsers: entry.rejectedUsersBCT || null,
          noPayment: noPaymentVal,
          noPaymentReason: entry.responsibleNoPaymentBCT || entry.onHold || null,
        };

        if (existingPurchaseInvoice) {
          await prisma.purchaseInvoice.update({
            where: { id: existingPurchaseInvoice.id },
            data: pInvData
          });
        } else {
          await prisma.purchaseInvoice.create({
            data: {
              bcId: documentNo,
              companyId: exactCompanyName,
              vendorId: vendor.id,
              type: entry.Document_Type || 'Invoice',
              ...pInvData
            }
          });
        }
        totalStats.purchaseInvoices++;
      }

      if (syncedVendorInvoiceIds.length > 0) {
        await prisma.purchaseInvoice.updateMany({
          where: { 
            companyId: exactCompanyName,
            bcId: { notIn: syncedVendorInvoiceIds } 
          },
          data: { status: 'Closed' }
        });
      }
      
    } catch (companyError) {
      console.error(`[${exactCompanyName}] Error during sync:`, companyError);
    }
  }

  return totalStats;
}
