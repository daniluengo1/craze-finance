'use client';

import { useState, useEffect, useRef } from 'react';
import { ShieldCheck, Plus, FileText, Download, Trash2, Send, Bot, User as UserIcon, Loader2, Save } from 'lucide-react';
import { useCompany } from '@/contexts/CompanyContext';

interface Insurance {
  id: number;
  description: string;
  startDate: string;
  endDate: string;
  fileName: string | null;
}

interface ChatMessage {
  role: 'user' | 'bot';
  content: string;
}

export default function InsurancesPage() {
  const { selectedCompany } = useCompany();
  const [insurances, setInsurances] = useState<Insurance[]>([]);
  const [loading, setLoading] = useState(true);

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'bot', content: '¡Hola! Soy tu asistente de seguros. Pregúntame sobre coberturas, condiciones o cualquier duda que tengas sobre tus pólizas activas.' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [formData, setFormData] = useState({
    description: '',
    startDate: '',
    endDate: '',
    fileName: '',
    fileBase64: ''
  });

  useEffect(() => {
    if (selectedCompany) fetchInsurances();
  }, [selectedCompany]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchInsurances = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/insurances');
      const data = await res.json();
      setInsurances(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      alert('Solo se permiten archivos PDF');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setFormData({
        ...formData,
        fileName: file.name,
        fileBase64: event.target?.result as string
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.description || !formData.startDate || !formData.endDate) {
      return alert('Rellena los campos obligatorios');
    }

    setIsUploading(true);
    try {
      const res = await fetch('/api/insurances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        setIsModalOpen(false);
        setFormData({ description: '', startDate: '', endDate: '', fileName: '', fileBase64: '' });
        fetchInsurances();
      } else {
        const err = await res.json();
        alert(err.error || 'Error al guardar');
      }
    } catch (e) {
      alert('Error de conexión');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Estás seguro de eliminar este seguro?')) return;
    try {
      const res = await fetch(`/api/insurances/${id}`, { method: 'DELETE' });
      if (res.ok) fetchInsurances();
    } catch (e) {
      alert('Error de conexión');
    }
  };

  const handleDownload = async (id: number, fileName: string) => {
    try {
      const res = await fetch(`/api/insurances/${id}`);
      const data = await res.json();
      
      if (data.fileBase64) {
        const a = document.createElement('a');
        a.href = data.fileBase64;
        a.download = fileName;
        a.click();
      } else {
        alert('Este seguro no tiene archivo adjunto');
      }
    } catch (e) {
      alert('Error al descargar');
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || chatLoading) return;

    const userMessage = chatInput;
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setChatInput('');
    setChatLoading(true);

    try {
      const res = await fetch('/api/insurances/bot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage })
      });
      
      const data = await res.json();
      
      if (data.error) {
        setMessages(prev => [...prev, { role: 'bot', content: `❌ Error: ${data.error}` }]);
      } else {
        setMessages(prev => [...prev, { role: 'bot', content: data.reply }]);
      }
    } catch (e) {
      setMessages(prev => [...prev, { role: 'bot', content: '❌ Error de conexión al consultar al bot.' }]);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto h-[calc(100vh-2rem)] flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <ShieldCheck className="text-black w-8 h-8" /> 
            Gestión de Seguros
          </h1>
          <p className="text-gray-500 mt-1">Controla las pólizas de {selectedCompany} y consulta dudas con la IA</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-black hover:bg-gray-800 text-white rounded-lg shadow-lg font-medium transition-colors"
        >
          <Plus size={18} /> Añadir Seguro
        </button>
      </div>

      <div className="flex gap-6 flex-1 min-h-0">
        
        {/* Lado Izquierdo: Lista de Seguros */}
        <div className="w-1/2 flex flex-col bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 bg-gray-50">
            <h2 className="font-bold text-gray-800 flex items-center gap-2">
              <FileText size={18} className="text-blue-600" />
              Pólizas Activas
            </h2>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4">
            {loading ? (
              <div className="text-center py-10 text-gray-400">Cargando pólizas...</div>
            ) : insurances.length === 0 ? (
              <div className="text-center py-10 text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
                No hay seguros registrados para {selectedCompany}.
              </div>
            ) : (
              <div className="space-y-3">
                {insurances.map(policy => {
                  const isActive = new Date() >= new Date(policy.startDate) && new Date() <= new Date(policy.endDate);
                  return (
                    <div key={policy.id} className="p-4 border border-gray-100 rounded-xl hover:shadow-md transition-shadow bg-white flex items-center justify-between group">
                      <div>
                        <h3 className="font-bold text-gray-900">{policy.description}</h3>
                        <p className="text-sm text-gray-500 mt-1">
                          {new Date(policy.startDate).toLocaleDateString()} - {new Date(policy.endDate).toLocaleDateString()}
                        </p>
                        <span className={`inline-block mt-2 px-2 py-0.5 rounded text-xs font-bold ${isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {isActive ? 'ACTIVO' : 'CADUCADO'}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        {policy.fileName && (
                          <button 
                            onClick={() => handleDownload(policy.id, policy.fileName!)}
                            className="p-2 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
                            title="Descargar Póliza"
                          >
                            <Download size={18} />
                          </button>
                        )}
                        <button 
                          onClick={() => handleDelete(policy.id)}
                          className="p-2 text-red-500 bg-red-50 hover:bg-red-100 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                          title="Eliminar Seguro"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Lado Derecho: Chatbot de IA */}
        <div className="w-1/2 flex flex-col bg-gray-50 border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-white flex items-center justify-between">
            <h2 className="font-bold text-gray-800 flex items-center gap-2">
              <Bot size={20} className="text-purple-600" />
              Asistente de Seguros (IA)
            </h2>
            <span className="text-xs font-medium px-2 py-1 bg-purple-100 text-purple-700 rounded-full">Lee tus pólizas (PDF)</span>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-3 max-w-[85%] ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : ''}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-indigo-100 text-indigo-600' : 'bg-purple-100 text-purple-600'}`}>
                  {msg.role === 'user' ? <UserIcon size={16} /> : <Bot size={16} />}
                </div>
                <div className={`p-3 rounded-2xl text-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-sm' : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm shadow-sm whitespace-pre-wrap'}`}>
                  {msg.content}
                </div>
              </div>
            ))}
            {chatLoading && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center shrink-0">
                  <Bot size={16} />
                </div>
                <div className="p-4 bg-white border border-gray-200 rounded-2xl rounded-tl-sm shadow-sm flex items-center gap-2 text-sm text-gray-500">
                  <Loader2 size={14} className="animate-spin" /> Consultando pólizas...
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="p-4 bg-white border-t border-gray-200">
            <form onSubmit={handleSendMessage} className="flex gap-2">
              <input 
                type="text" 
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                placeholder="Ej: ¿El seguro cubre robo en los almacenes?"
                className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 text-sm"
              />
              <button 
                type="submit" 
                disabled={chatLoading || !chatInput.trim()}
                className="px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center"
              >
                <Send size={18} />
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Modal de Nuevo Seguro */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-center items-center">
          <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Plus className="text-indigo-600" /> Añadir Póliza de Seguro
              </h3>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Descripción / Nombre</label>
                <input 
                  type="text" 
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                  className="w-full bg-white border border-gray-200 rounded-lg px-4 py-2"
                  placeholder="Ej: Seguro de RC Plus"
                  required
                />
              </div>
              <div className="flex gap-4">
                <div className="w-1/2">
                  <label className="block text-sm font-medium text-gray-600 mb-1">Fecha de Inicio</label>
                  <input 
                    type="date" 
                    value={formData.startDate}
                    onChange={e => setFormData({...formData, startDate: e.target.value})}
                    className="w-full bg-white border border-gray-200 rounded-lg px-4 py-2"
                    required
                  />
                </div>
                <div className="w-1/2">
                  <label className="block text-sm font-medium text-gray-600 mb-1">Fecha de Fin</label>
                  <input 
                    type="date" 
                    value={formData.endDate}
                    onChange={e => setFormData({...formData, endDate: e.target.value})}
                    className="w-full bg-white border border-gray-200 rounded-lg px-4 py-2"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Documento de Póliza (PDF)</label>
                <input 
                  type="file" 
                  accept="application/pdf"
                  onChange={handleFileChange}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">Sube el PDF para que el asistente pueda leerlo.</p>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-gray-100">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-50 rounded-lg font-medium"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={isUploading}
                  className="px-4 py-2 bg-black hover:bg-gray-800 text-white rounded-lg font-medium flex items-center gap-2 disabled:opacity-50"
                >
                  {isUploading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  {isUploading ? 'Guardando...' : 'Guardar Seguro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
