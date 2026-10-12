import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader, Card, Button, Table, Th, Td } from '../components/ui';
import { Plus, TrendingUp, Package, Scissors, CheckCircle, Truck, ShoppingCart } from 'lucide-react';
import * as repo from '../db/repo';
import { useDbVersion } from '../lib/live';
import { Qty } from '../components/kit';
import { fmtM } from '../lib/format';

export default function DashboardPage() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const dbVersion = useDbVersion();
  useEffect(() => {
    repo.dashboard().then(setData).catch((e) => setError(e.message));
  }, [dbVersion]);

  if (error) return <div className="p-12 text-center text-red-600">{error}</div>;
  if (!data) return <div className="p-12 text-center text-slate-500">Loading...</div>;

  const { status, openPoCount, pendingPoM, wastage, openOrders, activity } = data;
  
  const StatCard = ({ title, value, unit, sub, icon: Icon, colorClass, link }) => (
    <Card className="p-6 cursor-pointer hover:shadow-md transition-shadow group" onClick={() => link && navigate(link)}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <h3 className="text-3xl font-bold text-slate-900 mt-2 tabular-nums">{value}{unit && <span className="ml-1.5 text-sm font-medium text-slate-400">{unit}</span>}</h3>
          {sub && <p className="text-sm text-slate-500 mt-1.5 tabular-nums">{sub}</p>}
        </div>
        <div className={`p-3 rounded-lg ${colorClass}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </Card>
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="Overview of your textile trading operations">
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/po/new')}><Plus className="w-4 h-4 mr-2" /> New PO</Button>
          <Button onClick={() => navigate('/receipts/new')}><Package className="w-4 h-4 mr-2" /> Receive Grey</Button>
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Open POs" 
          value={openPoCount} unit="POs"
          sub={<><b className="text-slate-700">{fmtM(pendingPoM)}</b> meters pending</>} 
          icon={TrendingUp} 
          colorClass="bg-blue-50 text-blue-600" 
          link="/po"
        />
        <StatCard 
          title="Godown Grey" 
          value={status.GODOWN_GREY?.c || 0} unit="taka"
          sub={<><b className="text-slate-700">{fmtM(status.GODOWN_GREY?.m || 0)}</b> meters</>} 
          icon={Package} 
          colorClass="bg-slate-100 text-slate-600" 
          link="/inventory?view=godown"
        />
        <StatCard 
          title="In Dyeing" 
          value={status.IN_DYEING?.c || 0} unit="taka"
          sub={<><b className="text-slate-700">{fmtM(status.IN_DYEING?.m || 0)}</b> meters</>} 
          icon={Scissors} 
          colorClass="bg-violet-50 text-violet-600" 
          link="/inventory?view=dyeing"
        />
        <StatCard 
          title="Folded (ready)" 
          value={status.FOLDED?.c || 0} unit="taka"
          sub={<><b className="text-slate-700">{fmtM(status.FOLDED?.m || 0)}</b> meters</>} 
          icon={CheckCircle} 
          colorClass="bg-emerald-50 text-emerald-600" 
          link="/inventory?view=finished"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Pipeline Breakdown</h3>
            <div className="space-y-3 text-sm">
              {[
                { s: 'GODOWN_GREY', label: 'Godown Grey', color: 'bg-slate-400' },
                { s: 'MILL_GREY', label: 'Mill Grey', color: 'bg-sky-500' },
                { s: 'IN_DYEING', label: 'In Dyeing', color: 'bg-violet-500' },
                { s: 'FINISHED', label: 'Finished (Unfolded)', color: 'bg-amber-500' },
                { s: 'FOLDED', label: 'Ready for Sale', color: 'bg-emerald-500' },
              ].map(stage => {
                const count = status[stage.s]?.c || 0;
                return (
                  <div key={stage.s} className="flex justify-between items-center group cursor-pointer p-2 hover:bg-slate-50 rounded">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${stage.color}`}></div>
                      <span className="text-slate-600">{stage.label}</span>
                    </div>
                    <Qty variant="cell" takas={count} meters={status[stage.s]?.m || 0} />
                  </div>
                );
              })}
            </div>
          </Card>
          
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Wastage Analytics</h3>
            {wastage.count === 0 ? (
              <p className="text-sm text-slate-500">Not enough folded takas for average wastage calculation.</p>
            ) : (
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-500">Weaver (vs nominal length)</span>
                    <span className="font-medium text-slate-900">{wastage.weaver.toFixed(2)}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-red-400 rounded-full" style={{ width: `${Math.min(100, Math.max(0, wastage.weaver * 5))}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-500">Dyeing Loss</span>
                    <span className="font-medium text-slate-900">{wastage.finish.toFixed(2)}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-400 rounded-full" style={{ width: `${Math.min(100, Math.max(0, wastage.finish * 5))}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-500">Total Pipeline Shrinkage</span>
                    <span className="font-bold text-slate-900">{wastage.total.toFixed(2)}%</span>
                  </div>
                </div>
              </div>
            )}
          </Card>
      </div>

      {/* recent activity comes last */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-6">Recent Activity</h3>
          <div className="space-y-4">
            {activity.map((act, i) => (
              <div key={i} className="flex gap-4 items-start p-3 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors" onClick={() => navigate(act.to)}>
                <div className={`p-2 rounded-full ${
                  act.kind === 'receipt' ? 'bg-sky-50 text-sky-600' : 
                  act.kind === 'dispatch' ? 'bg-indigo-50 text-indigo-600' :
                  act.kind === 'program' ? 'bg-violet-50 text-violet-600' :
                  act.kind === 'finished' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'
                }`}>
                  {act.kind === 'receipt' && <Package className="w-4 h-4" />}
                  {act.kind === 'dispatch' && <Truck className="w-4 h-4" />}
                  {act.kind === 'program' && <Scissors className="w-4 h-4" />}
                  {act.kind === 'finished' && <CheckCircle className="w-4 h-4" />}
                  {act.kind === 'order' && <ShoppingCart className="w-4 h-4" />}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <p className="font-medium text-slate-900 text-sm">{act.title}</p>
                    <span className="text-xs text-slate-400">{new Date(act.date).toLocaleDateString()}</span>
                  </div>
                  <p className="text-sm text-slate-500">{act.sub}</p>
                </div>
              </div>
            ))}
            {activity.length === 0 && <p className="text-center text-slate-500 py-4">No recent activity</p>}
          </div>
        </Card>


    </div>
  );
}
