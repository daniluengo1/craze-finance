'use client';
import React, { useState, useEffect, useRef } from 'react';
import { Plus, Edit2, Trash2, RefreshCw, AlertCircle, Save, X, ChevronRight, ChevronDown, Download, Upload, Archive, Send, Briefcase } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function CashflowPage() {
  const [entries, setEntries] = useState<any[]>([]);
  const [initialBalance, setInitialBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  
  const [formData, setFormData] = useState({ id: '', type: '', date: '', description: '', amount: '', invoiceIds: [] as number[] });
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingBalance, setIsEditingBalance] = useState(false);
  const [newBalance, setNewBalance] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'AUTO' | 'MANUAL'>('ALL');
  const [showArchived, setShowArchived] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  
  // Email states
  const [selectedInvoices, setSelectedInvoices] = useState<Record<number, boolean>>({});
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailDraft, setEmailDraft] = useState({
    customerId: 0,
    to: '',
    subject: '',
    message: '',
    invoices: [] as any[]
  });
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  const [spEmailModalOpen, setSpEmailModalOpen] = useState(false);
  const [spEmailDraft, setSpEmailDraft] = useState({
    customerId: 0,
    to: '',
    subject: '',
    message: '',
    invoices: [] as any[]
  });
  const [isSendingSpEmail, setIsSendingSpEmail] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchCashflow = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/cashflow${showArchived ? '?archived=true' : ''}`);
      if (res.ok) {
        const data = await res.json();
        setEntries(data.entries || []);
        setInitialBalance(data.initialBalance || 0);
      }
    } catch (error) {
      console.error('Failed to fetch cashflow:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCashflow();
  }, [showArchived]);

  const handleSync = async () => {
    try {
      setSyncing(true);
      // Trigger a BC sync to get the latest invoices
      await fetch('/api/sync-bc', { method: 'POST' });
      // Then refetch the cashflow
      await fetchCashflow();
    } catch (error) {
      console.error('Failed to sync:', error);
    } finally {
      setSyncing(false);
    }
  };

  const openAddModal = () => {
    setFormData({ id: '', type: 'manual', date: new Date().toISOString().split('T')[0], description: '', amount: '', invoiceIds: [] });
    setIsEditing(false);
    setIsModalOpen(true);
  };

  const openEditModal = (entry: any) => {
    if (entry.isManual) {
      setFormData({
        id: entry.dbId,
        type: 'manual',
        date: new Date(entry.date).toISOString().split('T')[0],
        description: entry.description,
        amount: entry.amount.toString(),
        invoiceIds: []
      });
    } else {
      // Auto entry: only date is editable
      setFormData({
        id: '',
        type: 'invoice-date',
        date: new Date(entry.date).toISOString().split('T')[0],
        description: entry.description,
        amount: entry.amount.toString(),
        invoiceIds: entry.invoices ? entry.invoices.map((i: any) => i.id) : (entry.id ? [entry.id] : [])
      });
    }
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const toggleGroup = (id: string) => {
    setExpandedGroups(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const saveInitialBalance = async () => {
    try {
      await fetch('/api/cashflow', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'config', amount: newBalance })
      });
      setIsEditingBalance(false);
      fetchCashflow();
    } catch (e) { console.error(e); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar esta línea manual?')) return;
    try {
      await fetch(`/api/cashflow?id=${id}`, { method: 'DELETE' });
      setSelectedIds(prev => prev.filter(selectedId => selectedId !== parseInt(id)));
      fetchCashflow();
    } catch (error) {
      console.error('Failed to delete:', error);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) {
      if (confirm('No has seleccionado ninguna línea. ¿Quieres borrar TODAS las líneas manuales?')) {
        try {
          await fetch(`/api/cashflow?clearAll=true`, { method: 'DELETE' });
          setSelectedIds([]);
          fetchCashflow();
        } catch(e) {
          console.error(e);
        }
      }
      return;
    }
    
    if (!confirm(`¿Borrar las ${selectedIds.length} líneas seleccionadas?`)) return;
    try {
      await fetch(`/api/cashflow?ids=${selectedIds.join(',')}`, {
        method: 'DELETE'
      });
      setSelectedIds([]);
      fetchCashflow();
    } catch(e) {
      console.error(e);
    }
  };

  const handleArchive = async (entry: any) => {
    if (!confirm(entry.isArchived ? '¿Restaurar esta línea al Cashflow activo?' : '¿Estás seguro de que quieres archivar esta línea y sacarla del Cashflow?')) return;
    try {
      await fetch(`/api/cashflow`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'archive',
          type: entry.isManual ? 'manual' : 'auto',
          isArchived: !entry.isArchived,
          id: entry.isManual ? entry.dbId : undefined,
          invoiceIds: entry.isManual ? undefined : (entry.invoices ? entry.invoices.map((i:any)=>i.id) : [entry.id])
        })
      });
      fetchCashflow();
    } catch(e) {
      console.error(e);
    }
  };

  const toggleInvoiceSelect = (invoiceId: number) => {
    setSelectedInvoices(prev => ({ ...prev, [invoiceId]: !prev[invoiceId] }));
  };

  const openEmailModal = (entry: any) => {
    if (!entry.customer) return;
    const selectedList = entry.invoices?.filter((inv: any) => selectedInvoices[inv.id]) || [];
    if (selectedList.length === 0) {
      alert("Selecciona al menos una factura para este cliente.");
      return;
    }

    const invoiceDetails = selectedList.map((i: any) => `- Factura ${i.bcId}: €${i.amount.toLocaleString(undefined, {minimumFractionDigits: 2})} (Vence el ${new Date(i.dueDate).toLocaleDateString()})`).join('\n');
    
    setEmailDraft({
      customerId: entry.customer.id,
      to: entry.customer.email || '',
      subject: `Recordatorio de facturas pendientes - ${entry.customer.name}`,
      message: `Estimado ${entry.customer.name},\n\nNos ponemos en contacto con usted para recordarle que existen facturas pendientes de pago en su cuenta.\nLe agradeceríamos que las liquidara lo antes posible.\n\n${invoiceDetails}`,
      invoices: selectedList
    });
    setEmailModalOpen(true);
  };

  const openSpEmailModal = (entry: any) => {
    if (!entry.customer) return;
    const selectedList = entry.invoices?.filter((inv: any) => selectedInvoices[inv.id]) || [];
    if (selectedList.length === 0) {
      alert("Selecciona al menos una factura para notificar al comercial.");
      return;
    }
    if (!entry.customer.salespersonName) {
      alert("Este cliente no tiene un comercial asignado.");
      return;
    }
    const totalAmount = selectedList.reduce((acc: number, inv: any) => acc + inv.amount, 0);
    setSpEmailDraft({
      customerId: entry.customer.id,
      to: 'prueba.comercial@craze.local', // Placeholder
      subject: `[Acción Requerida] Cliente ${entry.customer.name} - Facturas Pendientes`,
      message: `Hola ${entry.customer.salespersonName},\n\nNecesitamos tu asistencia urgente respecto a la cuenta de ${entry.customer.name} (${entry.customer.bcId}). Tienen facturas pendientes por un total de €${totalAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}.\n\nPor favor, contacta con ellos para asegurar una fecha de pago.\n\nGracias,\nEquipo de Finanzas`,
      invoices: selectedList
    });
    setSpEmailModalOpen(true);
  };

  const confirmSendEmail = async () => {
    setIsSendingEmail(true);
    try {
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: emailDraft.customerId,
          invoiceIds: emailDraft.invoices.map((i: any) => i.id),
          to: emailDraft.to,
          subject: emailDraft.subject,
          message: emailDraft.message
        })
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.previewUrl ? `Correo simulado enviado al cliente.\nMíralo aquí: ${data.previewUrl}` : 'Correo enviado correctamente.');
        const newSelected = { ...selectedInvoices };
        emailDraft.invoices.forEach((i: any) => delete newSelected[i.id]);
        setSelectedInvoices(newSelected);
        await fetchCashflow();
        setEmailModalOpen(false);
      } else {
        alert('Error al enviar correo: ' + data.error);
      }
    } catch (e) {
      alert('Error en el sistema de correos.');
    } finally {
      setIsSendingEmail(false);
    }
  };

  const confirmSendSpEmail = async () => {
    setIsSendingSpEmail(true);
    try {
      const res = await fetch('/api/send-salesperson-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: spEmailDraft.customerId,
          invoiceIds: spEmailDraft.invoices.map((i: any) => i.id),
          to: spEmailDraft.to,
          subject: spEmailDraft.subject,
          message: spEmailDraft.message
        })
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.previewUrl ? `Correo simulado enviado al comercial.\nMíralo aquí: ${data.previewUrl}` : 'Correo enviado al comercial correctamente.');
        const newSelected = { ...selectedInvoices };
        spEmailDraft.invoices.forEach((i: any) => delete newSelected[i.id]);
        setSelectedInvoices(newSelected);
        await fetchCashflow();
        setSpEmailModalOpen(false);
      } else {
        alert('Error al enviar correo: ' + data.error);
      }
    } catch (e) {
      alert('Error en el sistema de correos.');
    } finally {
      setIsSendingSpEmail(false);
    }
  };

  const handleExportTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
      { fecha: '2026-08-01', supplier: 'Ejemplo Pago Alquiler', amount: -1500.50 }
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, 'Cashflow_Template.xlsx');
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = event.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json<any>(sheet);

        const newEntries = json.map(row => {
          // Si Excel convierte la fecha a número de serie (ej. 45000), habría que parsearla, pero asumiendo YYYY-MM-DD:
          let dateStr = row.fecha;
          if (typeof dateStr === 'number') {
             // Excel date to JS date
             dateStr = new Date(Math.round((dateStr - 25569)*86400*1000)).toISOString().split('T')[0];
          }
          return {
            date: dateStr,
            description: row.supplier,
            amount: parseFloat(row.amount)
          };
        }).filter(r => r.date && r.description && !isNaN(r.amount));

        if (newEntries.length === 0) {
          alert('El archivo no tiene el formato correcto o está vacío. Asegúrate de tener las columnas: fecha, supplier, amount.');
          return;
        }

        setSyncing(true);
        await fetch('/api/cashflow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newEntries)
        });
        
        alert(`¡Se han importado ${newEntries.length} registros!`);
        fetchCashflow();
      } catch (err) {
        console.error('Failed to import Excel:', err);
        alert('Error importando el archivo.');
      } finally {
        setSyncing(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isEditing) {
        await fetch('/api/cashflow', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
      } else {
        await fetch('/api/cashflow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
      }
      setIsModalOpen(false);
      fetchCashflow();
    } catch (error) {
      console.error('Failed to save:', error);
    }
  };

  return (
    <div className="flex-1 p-8 max-w-[1600px] overflow-hidden">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-black text-black mb-2">
              Previsión de Tesorería (Cashflow)
            </h1>
            <div className="flex items-center gap-4">
              <p className="text-gray-900 font-bold text-sm">Flujo de caja basado en cobros y entradas manuales.</p>
              <div className="flex bg-white rounded-lg p-1 border border-gray-200 items-center">
                <button onClick={() => setFilterType('ALL')} className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${filterType === 'ALL' ? 'bg-gray-200 text-gray-900' : 'text-gray-900 font-bold hover:text-gray-900 hover:bg-gray-50'}`}>Todos</button>
                <button onClick={() => setFilterType('AUTO')} className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${filterType === 'AUTO' ? 'bg-teal-500/30 text-teal-700 font-bold' : 'text-gray-900 font-bold hover:text-gray-900 hover:bg-gray-50'}`}>Automáticos</button>
                <button onClick={() => setFilterType('MANUAL')} className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${filterType === 'MANUAL' ? 'bg-blue-500/30 text-blue-700 font-bold' : 'text-gray-900 font-bold hover:text-gray-900 hover:bg-gray-50'}`}>Manuales</button>
                <div className="w-px h-4 bg-white/10 mx-2"></div>
                <button onClick={() => setShowArchived(!showArchived)} className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${showArchived ? 'bg-purple-500/30 text-purple-700 font-bold border border-purple-500/50' : 'text-gray-900 font-bold hover:text-purple-700 font-bold hover:bg-purple-500/10'}`}>
                  {showArchived ? 'Ocultar Archivadas' : 'Ver Archivadas'}
                </button>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <input 
              type="file" 
              accept=".xlsx, .xls, .csv" 
              className="hidden" 
              ref={fileInputRef}
              onChange={handleImport}
            />
            <button 
              onClick={handleBulkDelete}
              className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-gray-700 font-semibold font-bold rounded-lg border border-red-500/20 transition-colors text-sm"
              title={selectedIds.length > 0 ? "Borrar Selección" : "Borrar Todo (Manuales)"}
            >
              <Trash2 size={16} /> {selectedIds.length > 0 ? `Borrar (${selectedIds.length})` : 'Borrar Todas'}
            </button>
            <button 
              onClick={handleExportTemplate}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-gray-900 font-bold rounded-lg border border-emerald-500/20 transition-colors text-sm"
              title="Descargar Plantilla Excel"
            >
              <Download size={16} /> Plantilla
            </button>
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={syncing}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-black rounded-lg border border-blue-500/20 transition-colors text-sm"
              title="Importar Excel"
            >
              <Upload size={16} className={syncing ? "animate-pulse" : ""} /> Importar Excel
            </button>
            
            <button 
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center gap-2 px-4 py-2 bg-gray-50 hover:bg-gray-200 text-gray-900 rounded-lg border border-gray-200 transition-colors ml-4 text-sm"
            >
              <RefreshCw size={16} className={syncing ? "animate-spin text-black" : "text-gray-900 font-bold"} />
              {syncing ? 'Sincronizando...' : 'Actualizar Local'}
            </button>
            <button 
              onClick={openAddModal}
              className="flex items-center gap-2 px-4 py-2 bg-black hover:bg-gray-800 text-white text-gray-900 rounded-lg shadow-lg font-medium transition-all text-sm"
            >
              <Plus size={16} /> Añadir Línea
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-gray-50 backdrop-blur-md shadow-2xl overflow-hidden">
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-teal-400"></div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 text-sm font-medium text-gray-700 font-semibold bg-gray-50">
                    <th className="p-4 w-10 text-center">
                      <input 
                        type="checkbox" 
                        className="rounded border-gray-300 bg-white text-blue-500 focus:ring-blue-500"
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedIds(entries.filter(e => e.isManual).map(e => e.dbId));
                          } else {
                            setSelectedIds([]);
                          }
                        }}
                        checked={entries.filter(e => e.isManual).length > 0 && selectedIds.length === entries.filter(e => e.isManual).length}
                      />
                    </th>
                    <th className="p-4">Fecha</th>
                    <th className="p-4">Supplier o Description</th>
                    <th className="p-4 text-right">Amount</th>
                    <th className="p-4 text-right">Balance</th>
                    <th className="p-4 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  <tr className="bg-gray-50/50 border-b-2 border-gray-200 font-medium">
                    <td className="p-4 text-center text-slate-500">-</td>
                    <td className="p-4 text-gray-700 font-semibold">-</td>
                    <td className="p-4 font-medium text-gray-700 font-semibold">Saldo Inicial (29/07/2026)</td>
                    <td className="p-4 text-right text-gray-700 font-semibold">-</td>
                    <td className={`p-4 text-right group relative flex justify-end items-center gap-2 ${initialBalance <= -1000000 ? 'text-purple-600 font-black text-lg' : initialBalance < 0 ? 'text-red-600 font-bold' : 'text-emerald-600 font-bold'}`}>
                      {isEditingBalance ? (
                        <div className="flex items-center gap-2">
                           <input type="number" step="0.01" value={newBalance} onChange={e => setNewBalance(e.target.value)} className="bg-white border border-gray-200 rounded px-2 py-1 text-sm text-gray-900 w-28 text-right" />
                           <button onClick={saveInitialBalance} className="text-gray-900 font-bold hover:text-emerald-700 font-bold"><Save size={14}/></button>
                           <button onClick={() => setIsEditingBalance(false)} className="text-gray-900 font-bold hover:text-gray-800 font-medium"><X size={14}/></button>
                        </div>
                      ) : (
                        <>
                          €{initialBalance.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                          <button onClick={() => { setIsEditingBalance(true); setNewBalance(initialBalance.toString()); }} className="opacity-0 group-hover:opacity-100 p-1 text-black hover:bg-blue-400/20 rounded transition-all"><Edit2 size={12}/></button>
                        </>
                      )}
                    </td>
                    <td className="p-4 text-center text-slate-600">-</td>
                  </tr>

                  {entries
                    .filter(e => filterType === 'ALL' || (filterType === 'AUTO' && !e.isManual) || (filterType === 'MANUAL' && e.isManual))
                    .length === 0 ? (
                     <tr><td colSpan={6} className="p-8 text-center text-gray-700 font-semibold">No hay movimientos a partir del 29/07/2026</td></tr>
                  ) : (
                    entries
                      .filter(e => filterType === 'ALL' || (filterType === 'AUTO' && !e.isManual) || (filterType === 'MANUAL' && e.isManual))
                      .map((entry, idx) => (
                      <React.Fragment key={entry.id}>
                        <tr className="hover:bg-gray-50 transition-colors group cursor-pointer" onClick={() => entry.isGroup && toggleGroup(entry.id)}>
                          <td className="p-4 text-center" onClick={e => e.stopPropagation()}>
                            {entry.isManual ? (
                              <input 
                                type="checkbox"
                                className="rounded border-gray-300 bg-white text-blue-500 focus:ring-blue-500"
                                checked={selectedIds.includes(entry.dbId)}
                                onChange={(e) => {
                                  if (e.target.checked) setSelectedIds([...selectedIds, entry.dbId]);
                                  else setSelectedIds(selectedIds.filter(id => id !== entry.dbId));
                                }}
                              />
                            ) : null}
                          </td>
                          <td className="p-4 font-medium text-gray-600">
                            {new Date(entry.date).toLocaleDateString('es-ES')}
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              {entry.isGroup && (
                                <span className="text-gray-700 font-semibold">
                                  {expandedGroups[entry.id] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                </span>
                              )}
                              {entry.isManual ? (
                                <span className="bg-blue-500/20 text-blue-700 font-bold px-1.5 py-0.5 rounded text-[10px] uppercase border border-blue-500/30">Manual</span>
                              ) : (
                                <span className="bg-teal-500/20 text-teal-700 font-bold px-1.5 py-0.5 rounded text-[10px] uppercase border border-gray-200">Auto</span>
                              )}
                              <span className="text-gray-900">{entry.description}</span>
                              {entry.isGroup && <span className="text-xs text-slate-500">({entry.invoices?.length} facturas)</span>}
                            </div>
                          </td>
                          <td className="p-4 text-right font-medium">
                            <span className={entry.amount > 0 ? "text-emerald-600 font-bold" : entry.amount < 0 ? "text-red-600 font-bold" : "text-gray-700 font-semibold font-bold"}>
                              {entry.amount > 0 ? '+' : ''}€{entry.amount.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                            </span>
                          </td>
                          <td className="p-4 text-right">
                            <span className={entry.balance <= -1000000 ? 'text-purple-600 font-black text-lg' : entry.balance < 0 ? 'text-red-600 font-bold text-base' : 'text-emerald-600 font-bold text-base'}>
                              €{entry.balance.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                            </span>
                          </td>
                          <td className="p-4 text-center">
                            <div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={(e) => { e.stopPropagation(); openEditModal(entry); }} className="p-1.5 text-black hover:bg-blue-400/20 rounded-md transition-colors" title="Editar Fecha/Registro">
                                <Edit2 size={14} />
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); handleArchive(entry); }} className="p-1.5 text-black hover:bg-purple-400/20 rounded-md transition-colors" title={entry.isArchived ? "Restaurar al cashflow" : "Archivar (ocultar del cashflow)"}>
                                {entry.isArchived ? <RefreshCw size={14} /> : <Archive size={14} />}
                              </button>
                              {entry.isGroup && entry.customer && (
                                <>
                                  <button onClick={(e) => { e.stopPropagation(); openEmailModal(entry); }} className="p-1.5 text-gray-900 font-bold hover:bg-emerald-400/20 rounded-md transition-colors" title="Enviar Recordatorio al Cliente">
                                    <Send size={14} />
                                  </button>
                                  <button onClick={(e) => { e.stopPropagation(); openSpEmailModal(entry); }} className="p-1.5 text-orange-400 hover:bg-orange-400/20 rounded-md transition-colors" title="Avisar al Comercial">
                                    <Briefcase size={14} />
                                  </button>
                                </>
                              )}
                              {entry.isManual && (
                                <button onClick={(e) => { e.stopPropagation(); handleDelete(entry.dbId); }} className="p-1.5 text-gray-700 font-semibold font-bold hover:bg-red-400/20 rounded-md transition-colors" title="Eliminar">
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                        {/* Sub-rows para grupos expandidos */}
                        {entry.isGroup && expandedGroups[entry.id] && entry.invoices?.map((inv: any) => (
                          <tr key={`sub-${inv.id}`} className="bg-gray-50/50 border-t border-gray-100 group">
                            <td className="p-3 text-center">
                              <input 
                                type="checkbox" 
                                className="rounded border-gray-300 bg-white text-blue-500 focus:ring-blue-500"
                                checked={!!selectedInvoices[inv.id]}
                                onChange={() => toggleInvoiceSelect(inv.id)}
                                onClick={e => e.stopPropagation()}
                              />
                            </td>
                            <td className="p-3 pl-4 text-sm text-gray-700 font-semibold border-l-2 border-l-teal-500/30">
                              {new Date(inv.cashflowDate || inv.confirmedPaymentDate || inv.dueDate).toLocaleDateString('es-ES')}
                            </td>
                            <td className="p-3 text-sm text-gray-600">
                              {inv.bcId} <span className="text-slate-500 text-xs ml-2">({inv.status})</span>
                            </td>
                            <td className="p-3 text-sm text-right text-gray-600">
                              €{inv.amount.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="p-3 text-right text-slate-500">-</td>
                            <td className="p-3 text-center">
                              <div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={(e) => { e.stopPropagation(); openEditModal({ isManual: false, id: inv.id, date: inv.cashflowDate || inv.dueDate, description: inv.bcId, amount: inv.amount }); }} className="p-1 text-black/70 hover:text-black hover:bg-blue-400/20 rounded transition-colors" title="Editar fecha individual">
                                  <Edit2 size={12} />
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); handleArchive({ isManual: false, id: inv.id, isArchived: inv.isArchived, invoices: [inv] }); }} className="p-1 text-black/70 hover:text-black hover:bg-purple-400/20 rounded transition-colors" title={inv.isArchived ? "Restaurar individualmente" : "Archivar individualmente"}>
                                  {inv.isArchived ? <RefreshCw size={12} /> : <Archive size={12} />}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </React.Fragment>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal CRUD */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-center items-center">
            <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden transform transition-all">
              <div className="flex justify-between items-center p-6 border-b border-gray-200 bg-gray-50">
                <h3 className="text-xl font-bold text-gray-900">
                  {isEditing ? (formData.type === 'manual' ? 'Editar Línea Manual' : 'Cambiar Fecha de Factura(s)') : 'Nueva Línea Manual'}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="text-gray-900 font-bold hover:text-gray-900 transition-colors">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleSave} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-900 font-bold mb-1">Fecha</label>
                  <input 
                    type="date" 
                    required
                    value={formData.date}
                    onChange={e => setFormData({...formData, date: e.target.value})}
                    className="w-full bg-white border border-gray-200 rounded-lg px-4 py-2.5 text-gray-900 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 font-bold mb-1">Descripción</label>
                  <input 
                    type="text" 
                    required
                    disabled={formData.type === 'invoice-date'}
                    placeholder="Ej. Pago de impuestos, Nóminas..."
                    value={formData.description}
                    onChange={e => setFormData({...formData, description: e.target.value})}
                    className="w-full bg-white border border-gray-200 rounded-lg px-4 py-2.5 text-gray-900 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 font-bold mb-1">Importe (€)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    required
                    disabled={formData.type === 'invoice-date'}
                    placeholder="Ej. -1500.50 (negativo para pagos)"
                    value={formData.amount}
                    onChange={e => setFormData({...formData, amount: e.target.value})}
                    className="w-full bg-white border border-gray-200 rounded-lg px-4 py-2.5 text-gray-900 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all disabled:opacity-50"
                  />
                </div>
                <div className="pt-4 flex gap-3">
                  <button 
                    type="button" 
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-2.5 px-4 rounded-lg font-medium text-gray-800 font-medium bg-gray-50 hover:bg-gray-200 border border-gray-200 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 py-2.5 px-4 rounded-lg font-medium text-gray-900 bg-black hover:bg-gray-800 text-white shadow-lg shadow-gray-500/20 transition-all flex justify-center items-center gap-2"
                  >
                    <Save size={16} /> Guardar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Email Customer Modal */}
        {emailModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-center items-center">
            <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden transform transition-all">
              <div className="flex justify-between items-center p-6 border-b border-gray-200 bg-gray-50">
                <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <Send className="text-gray-900 font-bold" />
                  Enviar Recordatorio a {emailDraft.to}
                </h3>
                <button onClick={() => setEmailModalOpen(false)} className="text-gray-900 font-bold hover:text-gray-900 transition-colors">
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-900 font-bold mb-1">Asunto</label>
                  <input 
                    type="text" 
                    value={emailDraft.subject}
                    onChange={e => setEmailDraft({...emailDraft, subject: e.target.value})}
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 font-bold mb-1">Mensaje</label>
                  <textarea 
                    rows={8}
                    value={emailDraft.message}
                    onChange={e => setEmailDraft({...emailDraft, message: e.target.value})}
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-none font-mono text-sm"
                  />
                </div>
                <div className="flex justify-end gap-3 mt-6">
                  <button onClick={() => setEmailModalOpen(false)} className="px-5 py-2.5 text-sm font-medium text-gray-900 font-bold hover:text-gray-900 transition-colors">
                    Cancelar
                  </button>
                  <button 
                    onClick={confirmSendEmail}
                    disabled={isSendingEmail}
                    className="px-5 py-2.5 bg-gray-800 hover:bg-gray-700 text-white text-gray-900 text-sm font-medium rounded-xl shadow-lg transition-all disabled:opacity-50 flex items-center gap-2"
                  >
                    {isSendingEmail ? <RefreshCw className="animate-spin" size={16} /> : <Send size={16} />}
                    {isSendingEmail ? 'Enviando...' : 'Enviar Correo'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Email Salesperson Modal */}
        {spEmailModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-center items-center">
            <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden transform transition-all">
              <div className="flex justify-between items-center p-6 border-b border-gray-200 bg-gray-50">
                <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <Briefcase className="text-orange-400" />
                  Avisar al Comercial
                </h3>
                <button onClick={() => setSpEmailModalOpen(false)} className="text-gray-900 font-bold hover:text-gray-900 transition-colors">
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-900 font-bold mb-1">Para</label>
                  <input 
                    type="text" 
                    value={spEmailDraft.to}
                    onChange={e => setSpEmailDraft({...spEmailDraft, to: e.target.value})}
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 font-bold mb-1">Asunto</label>
                  <input 
                    type="text" 
                    value={spEmailDraft.subject}
                    onChange={e => setSpEmailDraft({...spEmailDraft, subject: e.target.value})}
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 font-bold mb-1">Mensaje</label>
                  <textarea 
                    rows={8}
                    value={spEmailDraft.message}
                    onChange={e => setSpEmailDraft({...spEmailDraft, message: e.target.value})}
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500/50 resize-none font-mono text-sm"
                  />
                </div>
                <div className="flex justify-end gap-3 mt-6">
                  <button onClick={() => setSpEmailModalOpen(false)} className="px-5 py-2.5 text-sm font-medium text-gray-900 font-bold hover:text-gray-900 transition-colors">
                    Cancelar
                  </button>
                  <button 
                    onClick={confirmSendSpEmail}
                    disabled={isSendingSpEmail}
                    className="px-5 py-2.5 bg-gray-600 hover:bg-gray-500 text-white text-gray-900 text-sm font-medium rounded-xl shadow-lg transition-all disabled:opacity-50 flex items-center gap-2"
                  >
                    {isSendingSpEmail ? <RefreshCw className="animate-spin" size={16} /> : <Briefcase size={16} />}
                    {isSendingSpEmail ? 'Enviando...' : 'Enviar al Comercial'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
  );
}
