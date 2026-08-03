'use client';

import { useEffect, useState } from 'react';
import { 
  Banknote, AlertCircle, TrendingDown, ArrowUpRight, 
  ArrowDownRight, CheckCircle2, Clock, Globe2, 
  ShoppingCart, Landmark, Wallet, Undo2
} from 'lucide-react';
import Link from 'next/link';

export default function Dashboard() {
  const [kpis, setKpis] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchKpis = async () => {
      try {
        const res = await fetch('/api/dashboard', { cache: 'no-store' });
        const data = await res.json();
        setKpis(data);
      } catch (error) {
        console.error('Failed to fetch KPIs', error);
      } finally {
        setLoading(false);
      }
    };
    fetchKpis();
  }, []);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(val || 0);
  };

  const KPICard = ({ title, value, icon, trend, link }: any) => (
    <div className="bg-white border border-gray-200 p-6 rounded-xl shadow-sm hover:shadow-md hover:border-gray-300 transition-all group">
      <div className="flex justify-between items-start mb-4">
        <div className="p-3 bg-gray-50 rounded-lg text-gray-700">
          {icon}
        </div>
        {link && (
          <Link href={link} className="text-gray-400 hover:text-black transition-colors">
            <ArrowUpRight size={20} className="group-hover:scale-110 transition-transform" />
          </Link>
        )}
      </div>
      <div>
        <p className="text-xs text-gray-500 font-bold mb-1 uppercase tracking-wider">{title}</p>
        <h3 className="text-2xl font-black text-black tracking-tight">{formatCurrency(value)}</h3>
        {trend && (
          <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
            {trend}
          </p>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen p-8 pb-32 overflow-y-auto">
      <div className="max-w-7xl mx-auto space-y-12">
        
        <header>
          <h1 className="text-4xl font-black text-black tracking-tight">
            Dashboard Contable
          </h1>
          <p className="text-gray-500 mt-2 font-medium">Visión global de cobros, pagos y métricas financieras.</p>
        </header>

        {loading ? (
          <div className="flex justify-center items-center h-64">
             <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-400"></div>
          </div>
        ) : (
          <div className="space-y-10">
            
            {/* COBROS */}
            <div>
              <h2 className="text-xl font-bold text-black mb-4 flex items-center gap-2 border-b border-gray-200 pb-2">
                <ArrowDownRight className="text-gray-700" /> 
                Gestión de Cobros (Clientes)
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <KPICard 
                  title="Cartera de Clientes" 
                  value={kpis?.totalCarteraClientes} 
                  icon={<Banknote size={24} />} 

                  link="/recobros"
                />
                <KPICard 
                  title="Total Vencido" 
                  value={kpis?.totalVencido} 
                  icon={<AlertCircle size={24} />} 

                  link="/recobros"
                />
                <KPICard 
                  title="Total Markant" 
                  value={kpis?.totalEnMarkant} 
                  icon={<ShoppingCart size={24} />} 

                />
                <KPICard 
                  title="Total Amazon" 
                  value={kpis?.totalAmazon} 
                  icon={<ShoppingCart size={24} />} 

                />
                <KPICard 
                  title="Confirmado Markant" 
                  value={kpis?.totalConfirmadoMarkant} 
                  icon={<CheckCircle2 size={24} />} 

                />
              </div>
            </div>

            {/* PAGOS */}
            <div>
              <h2 className="text-xl font-bold text-black mb-4 flex items-center gap-2 border-b border-gray-200 pb-2">
                <ArrowUpRight className="text-gray-700" /> 
                Gestión de Pagos (Proveedores)
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <KPICard 
                  title="Cartera Proveedores" 
                  value={kpis?.totalCarteraProveedores} 
                  icon={<Banknote size={24} />} 
                  link="/pagos"
                />
                <KPICard 
                  title="Vencida Aprobada" 
                  value={kpis?.totalCarteraVencidaAprobada} 
                  icon={<CheckCircle2 size={24} />} 

                  link="/pagos"
                />
                <KPICard 
                  title="Vencida NO Aprobada" 
                  value={kpis?.totalCarteraVencidaNoAprobada} 
                  icon={<Clock size={24} />} 
                  link="/pagos"
                />
              </div>
            </div>

            {/* PAGOS CHINA */}
            <div>
              <h2 className="text-xl font-bold text-black mb-4 flex items-center gap-2 border-b border-gray-200 pb-2">
                <Globe2 className="text-gray-700" /> 
                Pagos Internacionales (China)
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <KPICard 
                  title="Total China" 
                  value={kpis?.totalChina} 
                  icon={<Globe2 size={24} />} 

                />
                <KPICard 
                  title="Confirmado China" 
                  value={kpis?.totalConfirmadoChina} 
                  icon={<CheckCircle2 size={24} />} 

                />
                <KPICard 
                  title="Pendiente China" 
                  value={kpis?.totalPendienteChina} 
                  icon={<Clock size={24} />} 

                />
              </div>
            </div>

            {/* DEVOLUCIONES Y REFUNDS */}
            <div>
              <h2 className="text-xl font-bold text-black mb-4 flex items-center gap-2 border-b border-gray-200 pb-2">
                <Undo2 className="text-gray-700" /> 
                Devoluciones y Refunds
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <KPICard 
                  title="Refunds Abiertos (Cliente)" 
                  value={Math.abs(kpis?.totalRefundsAbiertosCliente || 0)} 
                  icon={<Undo2 size={24} />} 

                />
                <KPICard 
                  title="Refunds Abiertos (Prov.)" 
                  value={Math.abs(kpis?.totalRefundsAbiertoProveedor || 0)} 
                  icon={<Undo2 size={24} />} 

                />
                <KPICard 
                  title="Sales Return Orders" 
                  value={kpis?.salesReturnOrdersAbiertas} 
                  icon={<ShoppingCart size={24} />} 

                />
              </div>
            </div>

            {/* CASHFLOW */}
            <div>
              <h2 className="text-xl font-bold text-black mb-4 flex items-center gap-2 border-b border-gray-200 pb-2">
                <Landmark className="text-gray-700" /> 
                Tesorería
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-1 lg:max-w-sm">
                <KPICard 
                  title="Cashflow" 
                  value={kpis?.cashflow} 
                  icon={<Wallet size={24} />} 

                />
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
