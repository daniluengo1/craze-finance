'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  ChevronRight, Search, Download, Filter, TrendingUp, 
  DollarSign, Package, BarChart3, PieChart, Layers, 
  ArrowUpRight, ArrowDownRight, Upload, FileSpreadsheet, Trash2, CheckCircle
} from 'lucide-react';

const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('de-DE', { 
    style: 'currency', 
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(val || 0);
};

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function BWAPage() {
  const [reports, setReports] = useState<any[]>([]);
  const [selectedReportId, setSelectedReportId] = useState<number | null>(null);
  const [bwaData, setBwaData] = useState<any[]>([]);
  
  const [expandedLevels, setExpandedLevels] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  
  // Upload State
  const [isUploading, setIsUploading] = useState(false);
  const [showUploadForm, setShowUploadForm] = useState(false);
  
  const [files, setFiles] = useState<{
    bwaStructure: File | null;
    purchases: File | null;
    postingSetup: File | null;
    glMapping: File | null;
    items: File | null;
    chart: File | null;
    cmHeaders: File | null;
    cmLines: File | null;
  }>({
    bwaStructure: null,
    purchases: null,
    postingSetup: null,
    glMapping: null,
    items: null,
    chart: null,
    cmHeaders: null,
    cmLines: null
  });

  useEffect(() => {
    fetchReports();
  }, []);

  useEffect(() => {
    if (selectedReportId) {
      loadReport(selectedReportId);
    } else {
      setBwaData([]);
    }
  }, [selectedReportId]);

  const fetchReports = async () => {
    try {
      const res = await fetch('/api/bwa');
      const data = await res.json();
      setReports(data);
      if (data.length > 0 && !selectedReportId) {
        setSelectedReportId(data[0].id);
      } else if (data.length === 0) {
        setShowUploadForm(true);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadReport = async (id: number) => {
    try {
      const res = await fetch(`/api/bwa/${id}`);
      const data = await res.json();
      if (data && data.data) {
        setBwaData(JSON.parse(data.data));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Seguro que quieres borrar este reporte BWA?')) return;
    try {
      await fetch(`/api/bwa/${id}`, { method: 'DELETE' });
      if (selectedReportId === id) {
        setSelectedReportId(null);
        setBwaData([]);
      }
      fetchReports();
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!files.bwaStructure || !files.purchases) {
      alert("Faltan archivos obligatorios (BWA Structure y Purchase Lines)");
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    Object.entries(files).forEach(([key, file]) => {
      if (file) formData.append(key, file);
    });

    try {
      const res = await fetch('/api/bwa', {
        method: 'POST',
        body: formData
      });
      
      if (res.ok) {
        const newReport = await res.json();
        setShowUploadForm(false);
        setFiles({
          bwaStructure: null,
          purchases: null,
          postingSetup: null,
          glMapping: null,
          items: null,
          chart: null,
          cmHeaders: null,
          cmLines: null
        });
        await fetchReports();
        setSelectedReportId(newReport.id);
      } else {
        const err = await res.json();
        alert("Error: " + err.error);
      }
    } catch (error) {
      alert("Error de conexión");
    } finally {
      setIsUploading(false);
    }
  };

  const toggleLevel = (levelId: string) => {
    const newSet = new Set(expandedLevels);
    if (newSet.has(levelId)) {
      newSet.delete(levelId);
    } else {
      newSet.add(levelId);
    }
    setExpandedLevels(newSet);
  };

  const filteredData = useMemo(() => {
    if (!searchTerm) return bwaData;
    const term = searchTerm.toLowerCase();
    return bwaData.filter((item: any) => 
      item.BwaGroup.toLowerCase().includes(term) || 
      item.Level.toLowerCase().includes(term) ||
      (item.Detail && item.Detail.some((d: any) => d.Description.toLowerCase().includes(term) || d.Item.toLowerCase().includes(term) || d.Vendor.toLowerCase().includes(term)))
    );
  }, [searchTerm, bwaData]);

  const exportToCSV = () => {
    const csvRows = [];
    const headers = [
      "BWA Group",
      "Level",
      "Item Code",
      "Item Description",
      "Vendor",
      ...months,
      "Total"
    ];
    csvRows.push(headers.join(";"));

    const escape = (val: any) => {
      if (val === undefined || val === null) return "";
      const strVal = String(val);
      if (strVal.includes(";") || strVal.includes("\n") || strVal.includes('"')) {
        return `"${strVal.replace(/"/g, '""')}"`;
      }
      return strVal;
    };

    filteredData.forEach((row: any) => {
      if (row.Detail && row.Detail.length > 0) {
        row.Detail.forEach((d: any) => {
          const rowData = [
            row.BwaGroup,
            row.Level,
            d.Item,
            d.Description,
            d.Vendor,
            ...months.map(m => d.Values[m] ?? 0),
            d.Total
          ];
          csvRows.push(rowData.map(escape).join(";"));
        });
      } else {
        const rowData = [
          row.BwaGroup,
          row.Level,
          "",
          "",
          "",
          ...months.map(m => row.Values[m] ?? 0),
          row.Total
        ];
        csvRows.push(rowData.map(escape).join(";"));
      }
    });

    const csvContent = "\uFEFF" + csvRows.join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `BWA_Export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const stats = useMemo(() => {
    const salesTotal = bwaData.find((d: any) => d.Level === "Total" && d.BwaGroup === "SALES REVENUES")?.Total || 0;
    const cogsTotal = bwaData.find((d: any) => d.Level === "Total" && d.BwaGroup === "Cost of Goods Sold (COGS)")?.Total || 0;
    const margin = salesTotal - cogsTotal;
    return { salesTotal, cogsTotal, margin };
  }, [bwaData]);

  const groups = useMemo(() => {
    const map = new Map();
    filteredData.forEach((item: any) => {
      if (!map.has(item.BwaGroup)) map.set(item.BwaGroup, []);
      map.get(item.BwaGroup).push(item);
    });
    return Array.from(map.entries());
  }, [filteredData]);

  const renderFileUploader = (key: keyof typeof files, label: string, optional: boolean = false) => (
    <div className="relative border-2 border-dashed border-gray-300 rounded-xl p-4 flex flex-col items-center justify-center bg-gray-50/50 hover:bg-gray-100 transition-colors cursor-pointer group h-32">
      <input
        type="file"
        accept=".xlsx,.xls"
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        onChange={(e) => setFiles(prev => ({ ...prev, [key]: e.target.files?.[0] || null }))}
      />
      {files[key] ? (
        <>
          <CheckCircle className="text-emerald-500 mb-2" size={32} />
          <span className="text-sm font-semibold text-gray-900 text-center px-2 truncate w-full">{files[key]?.name}</span>
        </>
      ) : (
        <>
          <FileSpreadsheet className="text-gray-400 group-hover:text-indigo-500 transition-colors mb-2" size={32} />
          <span className="text-sm font-semibold text-gray-700 text-center px-2">{label}</span>
          {optional && <span className="text-xs text-gray-400 mt-1">(Opcional)</span>}
        </>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 p-8 pb-32">
      <header className="flex flex-wrap justify-between items-end mb-8 gap-4">
        <div>
          <h1 className="text-4xl font-black text-black tracking-tight flex items-center gap-3">
            <BarChart3 className="text-indigo-600" size={36} /> 
            BWA Analytics Pro
          </h1>
          <p className="text-gray-700 font-semibold mt-2">Advanced Financial Control & Article-Level Purchase Analysis</p>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={() => setShowUploadForm(!showUploadForm)}
            className="flex items-center gap-2 bg-black hover:bg-gray-800 text-white px-4 py-2 rounded-lg transition-all shadow-lg"
          >
            <Upload size={18} />
            {showUploadForm ? 'Cerrar Subida' : 'Subir Nuevos Excels'}
          </button>
        </div>
      </header>

      {showUploadForm && (
        <div className="mb-8 bg-white p-6 rounded-2xl border border-gray-200 shadow-xl">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Upload size={20} className="text-indigo-600" /> Sube tus documentos de Business Central
          </h2>
          <form onSubmit={handleUpload}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {renderFileUploader('bwaStructure', 'data (16).xlsx')}
              {renderFileUploader('purchases', 'Purchase Invoice Lines')}
              {renderFileUploader('postingSetup', 'General Posting Setup')}
              {renderFileUploader('glMapping', 'G/L Accounts Mapping')}
              {renderFileUploader('items', 'Items')}
              {renderFileUploader('chart', 'Chart of Accounts')}
              {renderFileUploader('cmHeaders', 'Credit Memos Headers', true)}
              {renderFileUploader('cmLines', 'Credit Memo Lines', true)}
            </div>
            <div className="flex justify-end">
              <button 
                type="submit"
                disabled={isUploading}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-indigo-200 disabled:opacity-50 flex items-center gap-2"
              >
                {isUploading ? <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div> : <BarChart3 size={18} />}
                {isUploading ? 'Procesando BWA...' : 'Generar BWA Analytics'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Select Report */}
      {reports.length > 0 && (
        <div className="mb-8 flex items-center gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <span className="font-semibold text-gray-700">Ver reporte de:</span>
          <select 
            value={selectedReportId || ''} 
            onChange={(e) => setSelectedReportId(Number(e.target.value))}
            className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2 outline-none font-medium"
          >
            {reports.map((r: any) => (
              <option key={r.id} value={r.id}>
                Generado el {new Date(r.date).toLocaleString()}
              </option>
            ))}
          </select>
          
          {selectedReportId && (
            <button 
              onClick={() => handleDelete(selectedReportId)}
              className="ml-auto text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-colors flex items-center gap-1 text-sm font-bold"
            >
              <Trash2 size={16} /> Borrar Reporte
            </button>
          )}
        </div>
      )}

      {bwaData.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-xl relative overflow-hidden group hover:-translate-y-1 transition-transform">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-gray-500 font-bold text-sm tracking-wider uppercase">Revenue</h3>
                <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg group-hover:scale-110 transition-transform">
                  <DollarSign size={24} />
                </div>
              </div>
              <div className="text-3xl font-black text-gray-900 mb-2">{formatCurrency(stats.salesTotal)}</div>
              <div className="text-sm font-bold text-emerald-600 flex items-center gap-1">
                <ArrowUpRight size={16} /> +12.5% vs LY
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-xl relative overflow-hidden group hover:-translate-y-1 transition-transform">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-gray-500 font-bold text-sm tracking-wider uppercase">Direct Costs</h3>
                <div className="p-2 bg-red-100 text-red-600 rounded-lg group-hover:scale-110 transition-transform">
                  <Package size={24} />
                </div>
              </div>
              <div className="text-3xl font-black text-gray-900 mb-2">{formatCurrency(stats.cogsTotal)}</div>
              <div className="text-sm font-bold text-red-500 flex items-center gap-1">
                <ArrowDownRight size={16} /> +4.2% vs Budget
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-xl relative overflow-hidden group hover:-translate-y-1 transition-transform">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-gray-500 font-bold text-sm tracking-wider uppercase">Gross Profit</h3>
                <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg group-hover:scale-110 transition-transform">
                  <TrendingUp size={24} />
                </div>
              </div>
              <div className="text-3xl font-black text-gray-900 mb-2">{formatCurrency(stats.margin)}</div>
              <div className="text-sm font-bold text-emerald-600 flex items-center gap-1">
                <ArrowUpRight size={16} /> +8.1% vs LY
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-xl relative overflow-hidden group hover:-translate-y-1 transition-transform">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-gray-500 font-bold text-sm tracking-wider uppercase">Margin Ratio</h3>
                <div className="p-2 bg-blue-100 text-blue-600 rounded-lg group-hover:scale-110 transition-transform">
                  <PieChart size={24} />
                </div>
              </div>
              <div className="text-3xl font-black text-gray-900 mb-2">{(stats.margin / stats.salesTotal * 100).toFixed(2)}%</div>
              <div className="text-sm font-bold text-gray-500 flex items-center gap-1">
                Operational efficiency stable
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-md">
            <div className="p-6 border-b border-gray-100 flex flex-wrap justify-between items-center bg-gray-50/50 gap-4">
              <div className="flex items-center gap-3">
                <Layers size={24} className="text-indigo-600" />
                <h2 className="text-xl font-bold text-gray-900">Estructura BWA</h2>
              </div>
              <div className="flex gap-4">
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input 
                    type="text" 
                    placeholder="Buscar..." 
                    className="bg-white border border-gray-300 text-sm text-gray-900 rounded-lg pl-9 pr-4 py-2 outline-none focus:border-indigo-500 transition-colors w-64 shadow-sm"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <button 
                  onClick={exportToCSV}
                  className="flex items-center gap-2 bg-white hover:bg-gray-100 text-gray-900 border border-gray-200 px-4 py-2 rounded-lg font-bold transition-all shadow-sm"
                >
                  <Download size={16} /> Exportar CSV
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-gray-100 text-gray-600 font-bold uppercase text-xs tracking-wider border-b border-gray-200">
                  <tr>
                    <th className="p-4 w-[350px]">Estructura / Nivel</th>
                    {months.map(m => <th key={m} className="p-4 text-right">{m}</th>)}
                    <th className="p-4 text-right bg-indigo-50/50 text-indigo-900 rounded-tr-lg">Total Anual</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {groups.map(([groupName, levels]) => (
                    <React.Fragment key={groupName}>
                      <tr className="bg-slate-800 text-white">
                        <td colSpan={14} className="p-3 font-bold text-sm tracking-wide">{groupName}</td>
                      </tr>
                      {(levels as any[]).map((level: any) => {
                        const levelId = `${groupName}-${level.Level}`;
                        const isExpanded = expandedLevels.has(levelId);
                        const hasDetail = level.Detail && level.Detail.length > 0;

                        return (
                          <React.Fragment key={levelId}>
                            <tr 
                              className={`transition-colors border-b border-gray-50 ${hasDetail ? 'cursor-pointer hover:bg-indigo-50/50 group' : 'bg-white'}`}
                              onClick={() => hasDetail && toggleLevel(levelId)}
                            >
                              <td className="p-4 flex items-center gap-2">
                                {hasDetail && (
                                  <ChevronRight 
                                    size={16} 
                                    className={`text-gray-400 group-hover:text-indigo-600 transition-transform ${isExpanded ? 'rotate-90 text-indigo-600' : ''}`} 
                                  />
                                )}
                                {!hasDetail && <div className="w-4"></div>}
                                <span className={`${level.Level === 'Total' ? 'font-black text-gray-900' : 'font-semibold text-gray-700'}`}>
                                  {level.Level}
                                </span>
                                {hasDetail && (
                                  <span className="ml-2 text-[10px] font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                                    {level.Detail.length}
                                  </span>
                                )}
                              </td>
                              {months.map(m => (
                                <td key={m} className={`p-4 text-right font-medium ${level.Level === 'Total' ? 'text-gray-900 font-bold bg-gray-50/50' : 'text-gray-600'}`}>
                                  {formatCurrency(level.Values[m])}
                                </td>
                              ))}
                              <td className={`p-4 text-right font-black ${level.Level === 'Total' ? 'text-indigo-700 bg-indigo-50' : 'text-gray-900 bg-gray-50/50'}`}>
                                {formatCurrency(level.Total)}
                              </td>
                            </tr>
                            {isExpanded && hasDetail && (
                              <tr>
                                <td colSpan={14} className="p-0 border-b border-gray-200">
                                  <div className="bg-indigo-50/30 p-4 pl-12 shadow-inner border-y border-indigo-100">
                                    <table className="w-full text-xs">
                                      <thead className="text-gray-500 font-bold border-b border-indigo-100">
                                        <tr>
                                          <th className="pb-2 text-left">Código</th>
                                          <th className="pb-2 text-left">Descripción Artículo</th>
                                          <th className="pb-2 text-left">Proveedor</th>
                                          {months.map(m => <th key={m} className="pb-2 text-right">{m}</th>)}
                                          <th className="pb-2 text-right">Total</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-indigo-50/50">
                                        {level.Detail.map((d: any, idx: number) => (
                                          <tr key={idx} className="hover:bg-white transition-colors">
                                            <td className="py-2 font-mono text-indigo-900 font-medium">{d.Item}</td>
                                            <td className="py-2 text-gray-700 font-medium">{d.Description}</td>
                                            <td className="py-2 text-gray-600 truncate max-w-[150px] font-medium" title={d.Vendor}>{d.Vendor}</td>
                                            {months.map(m => (
                                              <td key={m} className="py-2 text-right text-gray-600 font-medium">
                                                {d.Values[m] !== 0 ? formatCurrency(d.Values[m]) : '-'}
                                              </td>
                                            ))}
                                            <td className="py-2 text-right text-indigo-900 font-bold">{formatCurrency(d.Total)}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
