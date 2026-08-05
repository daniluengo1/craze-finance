"use client";

import { useState } from 'react';
import * as XLSX from 'xlsx';
import { FileUp, Save, Calculator, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function InventarioPage() {
  const [itemsFile, setItemsFile] = useState<File | null>(null);
  const [ileFile, setIleFile] = useState<File | null>(null);
  const [lwFile, setLwFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [month, setMonth] = useState<string>(new Date().toISOString().substring(0, 7));
  const [saved, setSaved] = useState(false);

  // Constants based on craze-unit-cost logic
  const COL_ITEM_NO = ['No.', 'Nº'];
  const COL_DESC = ['Description', 'Descripción'];
  const COL_UNIT_COST = ['Unit Cost', 'Coste unitario'];
  const COL_VENDOR = ['Vendor No.', 'Nº proveedor'];
  const COL_TYPE = ['Type', 'Tipo'];
  const COL_INVENTORY = ['Inventory', 'Inventario'];

  const COL_ILE_POSTING_DATE = ['Posting Date', 'Fecha registro'];
  const COL_ILE_ENTRY_TYPE = ['Entry Type', 'Tipo mov.'];
  const COL_ILE_ITEM_NO = ['Item No.', 'Nº producto'];
  const COL_ILE_DESC = ['Description', 'Descripción'];
  const COL_ILE_DOC_NO = ['Document No.', 'Nº documento'];
  const COL_ILE_QTY = ['Quantity', 'Cantidad'];
  const COL_ILE_COST = ['Cost Amount (Actual)', 'Importe coste (Real)'];
  
  const VALID_ENTRY_TYPES = ['Purchase', 'Compra', 'Assembly', 'Ensamblado', 'Item Charge', 'Cargo de producto', 'Cargo de prod.'];

  const getVal = (row: any, possibleNames: string[]) => {
    for (const name of possibleNames) {
      if (row[name] !== undefined) return row[name];
    }
    return undefined;
  };

  const readFileAsArrayBuffer = (file: File): Promise<ArrayBuffer> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as ArrayBuffer);
      reader.onerror = (e) => reject(e);
      reader.readAsArrayBuffer(file);
    });
  };

  const processFiles = async () => {
    if (!itemsFile || !ileFile || !lwFile) {
      alert("Por favor, selecciona los 3 archivos Excel.");
      return;
    }
    
    setIsProcessing(true);
    setSaved(false);
    try {
      // 1. Process Items
      console.log("Reading Items...");
      const itemsBuf = await readFileAsArrayBuffer(itemsFile);
      const itemsWb = XLSX.read(itemsBuf, { type: 'array' });
      const itemsData = XLSX.utils.sheet_to_json<any>(itemsWb.Sheets[itemsWb.SheetNames[0]]);
      const itemsMap: Record<string, any> = {};
      itemsData.forEach(item => {
        const itemNo = getVal(item, COL_ITEM_NO);
        if (itemNo) {
          itemsMap[String(itemNo).trim()] = {
            description: getVal(item, COL_DESC) || '',
            systemUnitCost: parseFloat(getVal(item, COL_UNIT_COST) || '0'),
            vendor: getVal(item, COL_VENDOR) || '',
            type: getVal(item, COL_TYPE) || '',
            inventory: parseFloat(getVal(item, COL_INVENTORY) || '0')
          };
        }
      });

      // 2. Process Lagerwert (Inventory Valuation)
      console.log("Reading Inventory Valuation...");
      const lwBuf = await readFileAsArrayBuffer(lwFile);
      const lwWb = XLSX.read(lwBuf, { type: 'array' });
      const hasHoja2 = lwWb.SheetNames.includes('Hoja2');
      const lwMap: Record<string, any> = {};

      if (hasHoja2) {
        const lwData = XLSX.utils.sheet_to_json<any>(lwWb.Sheets['Hoja2']);
        lwData.forEach(row => {
          const itemNo = row['Nº producto'];
          if (!itemNo || typeof itemNo !== 'string') return;
          const itemNoStr = String(itemNo).trim();
          if (['Artikelnr.', 'Total', 'Total für', 'WEITERVERK', 'ROHSTOFFE', 'MERCADERÍA'].includes(itemNoStr) || 
              itemNoStr.toLowerCase().includes('total') || itemNoStr.toLowerCase().includes('artikelnr') || itemNoStr.toLowerCase().includes('nº prod')) {
            return;
          }
          const qty = parseFloat(row['Cantidad_3']) || 0;
          const val = parseFloat(row['Valor_3']) || 0;
          lwMap[itemNoStr] = { qty, val };
        });
      } else {
        const lwSheet = lwWb.Sheets[lwWb.SheetNames[0]];
        const lwRows = XLSX.utils.sheet_to_json<any[]>(lwSheet, { header: 1 });
        lwRows.forEach((row, idx) => {
          if (idx < 5 || !row) return; 
          const itemNo = row[0];
          if (!itemNo || typeof itemNo !== 'string') return;
          const itemNoStr = String(itemNo).trim();
          if (['Artikelnr.', 'Total', 'Total für', 'WEITERVERK', 'ROHSTOFFE', 'WEITERVERK Total', 'ROHSTOFFE Total', 'Total Total', 'Lagerbuchungsgruppe', 'Lagerbuchungsgruppenname'].includes(itemNoStr) || 
              itemNoStr.toLowerCase().includes('total') || itemNoStr.toLowerCase().includes('artikelnr') || itemNoStr.toLowerCase().includes('nº prod')) {
            return;
          }
          const qty = parseFloat(row[15]) || 0;
          const val = parseFloat(row[16]) || 0;
          lwMap[itemNoStr] = { qty, val };
        });
      }

      // 3. Process Item Ledger Entries (Movimientos)
      console.log("Reading Item Ledger Entries...");
      const ileBuf = await readFileAsArrayBuffer(ileFile);
      const ileWb = XLSX.read(ileBuf, { type: 'array' });
      const ileData = XLSX.utils.sheet_to_json<any>(ileWb.Sheets[ileWb.SheetNames[0]]);
      
      const analysis: Record<string, any> = {};

      Object.keys(lwMap).forEach(itemNo => {
        const itemInfo = itemsMap[itemNo];
        const lwData = lwMap[itemNo];
        if (lwData.qty !== 0 || lwData.val !== 0) {
          analysis[itemNo] = {
            itemNo: itemNo,
            description: itemInfo ? itemInfo.description : 'Sin descripción',
            purchases: [],
            totalQuantity: 0,
            totalCost: 0,
            systemUnitCost: itemInfo ? itemInfo.systemUnitCost : 0,
            inventory: lwData.qty,
            systemValuation: lwData.val
          };
        }
      });

      ileData.forEach(entry => {
        const itemNo = getVal(entry, COL_ILE_ITEM_NO);
        if (!itemNo) return;
        const itemNoStr = String(itemNo).trim();
        const itemInfo = itemsMap[itemNoStr];

        if (!itemInfo || (itemInfo.type !== 'Inventory' && itemInfo.type !== 'Inventario')) {
          return;
        }

        const entryType = getVal(entry, COL_ILE_ENTRY_TYPE);
        if (VALID_ENTRY_TYPES.includes(entryType)) {
          const qty = parseFloat(getVal(entry, COL_ILE_QTY) || '0');
          const cost = parseFloat(getVal(entry, COL_ILE_COST) || '0');
          if (qty !== 0) {
            if (!analysis[itemNoStr]) {
              const lwData = lwMap[itemNoStr] || { qty: 0, val: 0 };
              analysis[itemNoStr] = {
                itemNo: itemNoStr,
                description: itemInfo.description || getVal(entry, COL_ILE_DESC) || 'Sin descripción',
                purchases: [],
                totalQuantity: 0,
                totalCost: 0,
                systemUnitCost: itemInfo.systemUnitCost,
                inventory: lwData.qty,
                systemValuation: lwData.val
              };
            }
            analysis[itemNoStr].purchases.push({
              entryType: entryType,
              quantity: qty,
              totalCost: cost,
              unitCost: cost / qty
            });
            analysis[itemNoStr].totalQuantity += qty;
            analysis[itemNoStr].totalCost += cost;
          }
        }
      });

      // 4. Calculate Final Difference
      let totalSystem = 0;
      let totalNew = 0;

      const finalResults = Object.values(analysis).map(item => {
        const calculatedMeanCost = item.totalQuantity !== 0 ? item.totalCost / item.totalQuantity : item.systemUnitCost;
        const invActual = item.systemValuation;
        const invNuevo = item.inventory * calculatedMeanCost;
        
        totalSystem += invActual;
        totalNew += invNuevo;

        return { 
          ...item, 
          calculatedMeanCost, 
          invActual,
          invNuevo,
          invDiff: invNuevo - invActual
        };
      }).sort((a, b) => a.itemNo.localeCompare(b.itemNo));

      setResults(finalResults);
      setSummary({
        totalSystemVal: totalSystem,
        totalNewVal: totalNew,
        difference: totalNew - totalSystem
      });

    } catch (err) {
      console.error("Error processing files", err);
      alert("Hubo un error procesando los archivos Excel. Verifica el formato.");
    } finally {
      setIsProcessing(false);
    }
  };

  const saveToDatabase = async () => {
    if (!summary) return;
    try {
      const selectedDate = new Date(`${month}-01T12:00:00Z`);
      
      const res = await fetch('/api/inventory-valuation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          month: selectedDate.toISOString(),
          totalSystemVal: summary.totalSystemVal,
          totalNewVal: summary.totalNewVal,
          difference: summary.difference,
          // We can omit details to save space in the DB, or send a subset.
          details: null 
        })
      });

      if (!res.ok) throw new Error("API error");
      setSaved(true);
    } catch(err) {
      console.error("Save error", err);
      alert("Error al guardar en la base de datos.");
    }
  };

  return (
    <div className="min-h-screen p-8 pb-32 overflow-y-auto">
      <div className="max-w-7xl mx-auto space-y-12">
        <header>
          <h1 className="text-4xl font-black text-black tracking-tight">Cálculo de Inventario (Coste Medio)</h1>
          <p className="text-gray-500 mt-2 font-medium max-w-3xl">
            Sube los 3 archivos Excel generados desde Business Central para realizar el cálculo del coste medio. El procesamiento se realizará de forma rápida y segura en tu navegador sin límite de tamaño.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Files Upload */}
          <div className="p-6 md:col-span-1 shadow-sm border border-gray-100 flex flex-col gap-6 bg-white rounded-xl">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">1. Productos (Items)</label>
                  <input type="file" accept=".xlsx,.xls" onChange={(e) => setItemsFile(e.target.files?.[0] || null)} className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">2. Valoración Inventario</label>
                  <input type="file" accept=".xlsx,.xls" onChange={(e) => setLwFile(e.target.files?.[0] || null)} className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">3. Mov. Productos (ILE)</label>
                  <input type="file" accept=".xlsx,.xls" onChange={(e) => setIleFile(e.target.files?.[0] || null)} className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
                </div>

                <div className="pt-4 border-t border-gray-100">
                  <button 
                    onClick={processFiles}
                    disabled={isProcessing}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isProcessing ? (
                      <span className="flex items-center gap-2">
                        <Calculator className="w-5 h-5 animate-spin" /> Procesando archivos...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Calculator className="w-5 h-5" /> Calcular Coste Medio
                      </span>
                    )}
                  </button>
                </div>
              </div>

              {/* Summary */}
              {summary && (
                <div className="p-6 md:col-span-2 shadow-sm border border-gray-100 flex flex-col justify-between bg-white rounded-xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                     <AlertCircle className="w-48 h-48" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 mb-6">Resultado del Análisis</h2>
                    <div className="grid grid-cols-3 gap-6">
                      <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                        <p className="text-sm font-medium text-gray-500 mb-1">Valoración Sistema (BC)</p>
                        <p className="text-2xl font-bold text-gray-900">€{summary.totalSystemVal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
                      </div>
                      <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                        <p className="text-sm font-medium text-gray-500 mb-1">Valoración Coste Medio</p>
                        <p className="text-2xl font-bold text-gray-900">€{summary.totalNewVal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
                      </div>
                      <div className={`p-4 rounded-xl border ${summary.difference > 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                        <p className="text-sm font-medium text-gray-700 mb-1">Diferencia Total</p>
                        <p className={`text-2xl font-bold ${summary.difference > 0 ? 'text-green-700' : 'text-red-700'}`}>
                          {summary.difference > 0 ? '+' : ''}€{summary.difference.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 pt-6 border-t border-gray-100 flex items-end justify-between">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Mes de Cierre</label>
                      <input 
                        type="month" 
                        value={month}
                        onChange={(e) => setMonth(e.target.value)}
                        className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500 outline-none shadow-sm" 
                      />
                    </div>
                    <button 
                      onClick={saveToDatabase}
                      disabled={saved}
                      className={`font-medium py-3 px-6 rounded-lg shadow-sm transition-all flex items-center justify-center gap-2 ${
                        saved 
                          ? 'bg-green-100 text-green-700 cursor-not-allowed' 
                          : 'bg-black hover:bg-gray-800 text-white'
                      }`}
                    >
                      {saved ? (
                        <><CheckCircle2 className="w-5 h-5" /> Guardado en Dashboard</>
                      ) : (
                        <><Save className="w-5 h-5" /> Guardar Cierre Mensual</>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Table */}
            {results.length > 0 && (
              <div className="shadow-sm border border-gray-100 bg-white rounded-xl overflow-hidden mt-6">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-gray-600">
                    <thead className="bg-gray-50 text-gray-700 border-b border-gray-200 text-xs uppercase font-semibold">
                      <tr>
                        <th className="px-6 py-4">Nº Producto</th>
                        <th className="px-6 py-4">Descripción</th>
                        <th className="px-6 py-4 text-right">Cantidad (BC)</th>
                        <th className="px-6 py-4 text-right">Coste BC</th>
                        <th className="px-6 py-4 text-right">Nuevo Coste Medio</th>
                        <th className="px-6 py-4 text-right">Val. Sistema</th>
                        <th className="px-6 py-4 text-right">Val. Nueva</th>
                        <th className="px-6 py-4 text-right">Diferencia</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {results.map((item, idx) => (
                        <tr key={idx} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-3 font-medium text-gray-900">{item.itemNo}</td>
                          <td className="px-6 py-3 max-w-xs truncate" title={item.description}>{item.description}</td>
                          <td className="px-6 py-3 text-right">{item.inventory.toLocaleString()}</td>
                          <td className="px-6 py-3 text-right">€{item.systemUnitCost.toFixed(2)}</td>
                          <td className="px-6 py-3 text-right font-medium text-blue-600">€{item.calculatedMeanCost.toFixed(2)}</td>
                          <td className="px-6 py-3 text-right">€{item.invActual.toFixed(2)}</td>
                          <td className="px-6 py-3 text-right">€{item.invNuevo.toFixed(2)}</td>
                          <td className={`px-6 py-3 text-right font-bold ${item.invDiff > 0 ? 'text-green-600' : item.invDiff < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                            {item.invDiff > 0 ? '+' : ''}€{item.invDiff.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

      </div>
    </div>
  );
}
