import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageHeader, Card, Button, Table, Th, Td, Drawer } from '../../components/ui';
import { ArrowLeft, Printer, ShieldCheck } from 'lucide-react';
import * as repo from '../../db/repo';

export default function DispatchDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [dispatch, setDispatch] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const data = await repo.getDispatch(id);
        if (!data) return navigate('/dispatch');
        setDispatch(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  const handlePrint = () => {
    window.print();
  };

  if (loading || !dispatch) return <div className="p-12 text-center text-slate-500">Loading...</div>;

  return (
    <Drawer isOpen={true} onClose={() => navigate('/dispatch')}>
      <div className="space-y-6 max-w-5xl mx-auto print:max-w-none print:m-0 print:p-0">
      <div className="print:hidden">
        <PageHeader 
          title={`Dispatch ${dispatch.dispatch_no}`}
          description={`Sent to ${dispatch.mill_name} on ${new Date(dispatch.date).toLocaleDateString()}`}
        >
          <Button variant="ghost" onClick={() => navigate('/dispatch')}><ArrowLeft className="w-4 h-4 mr-2" /> Back</Button>
          <Button variant="outline" onClick={handlePrint}><Printer className="w-4 h-4 mr-2" /> Print Challan</Button>
        </PageHeader>
      </div>

      <div className="hidden print:block text-center mb-8 border-b-2 border-slate-900 pb-6">
        <h1 className="text-3xl font-bold text-slate-900 uppercase tracking-widest">Vinee Creation</h1>
        <h2 className="text-xl font-medium mt-2">Delivery Challan (Grey to Mill)</h2>
        <div className="flex justify-between items-end mt-8 text-left">
          <div>
            <p className="text-slate-600 font-semibold mb-1">To: Mill</p>
            <p className="text-lg font-bold text-slate-900">{dispatch.mill_name}</p>
          </div>
          <div className="text-right">
            <p className="font-semibold text-slate-900">No: {dispatch.dispatch_no}</p>
            <p className="text-slate-700">Date: {new Date(dispatch.date).toLocaleDateString()}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 print:hidden">
        <Card className="p-6 md:col-span-3">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-sky-100 text-sky-600 rounded-xl flex items-center justify-center">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900">{dispatch.mill_name}</h3>
              <p className="text-slate-500 text-sm">Destination Mill</p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 p-4 rounded-xl">
              <div className="text-sm text-slate-500 mb-1">Total Takas</div>
              <div className="text-2xl font-bold text-slate-900">{dispatch.taka_count}</div>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl">
              <div className="text-sm text-slate-500 mb-1">Total Meters</div>
              <div className="text-2xl font-bold text-slate-900">{dispatch.total_m.toLocaleString()} m</div>
            </div>
            <div className="col-span-2 bg-slate-50 p-4 rounded-xl">
              <div className="text-sm text-slate-500 mb-1">Qualities Included</div>
              <div className="font-medium text-slate-900">{dispatch.qualities || '-'}</div>
            </div>
          </div>
          
          {dispatch.notes && (
            <div className="mt-4 text-sm bg-slate-100 text-slate-700 p-4 rounded-xl border border-slate-200">
              <strong className="block mb-1">Notes</strong>
              {dispatch.notes}
            </div>
          )}
        </Card>
      </div>

      <Card className="print:shadow-none print:border-none print:rounded-none">
        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 rounded-t-xl print:hidden">
          <h3 className="font-semibold text-slate-900">Takas Pick List</h3>
        </div>
        <div className="print:p-0">
          <Table className="print:text-sm">
            <thead>
              <tr className="print:border-b-2 print:border-slate-900">
                <Th className="print:text-slate-900">#</Th>
                <Th className="print:text-slate-900">Taka No</Th>
                <Th className="print:text-slate-900">Quality</Th>
                <Th className="text-right print:text-slate-900">Meters</Th>
              </tr>
            </thead>
            <tbody>
              {dispatch.takas?.map((t, idx) => (
                <tr key={t.id} className="hover:bg-slate-50 print:border-b print:border-slate-300">
                  <Td className="text-slate-500">{idx + 1}</Td>
                  <Td className="font-medium text-slate-900">{t.challan_no}/{t.taka_no}</Td>
                  <Td>{t.nick_name}</Td>
                  <Td className="text-right">{t.grey_meter} m</Td>
                </tr>
              ))}
              <tr className="bg-slate-50 font-bold print:bg-white print:border-t-2 print:border-slate-900">
                <Td colSpan={3} className="text-right py-4">Total</Td>
                <Td className="text-right py-4">{dispatch.total_m.toLocaleString()} m</Td>
              </tr>
            </tbody>
          </Table>
        </div>
      </Card>
      
      <div className="hidden print:flex justify-between mt-24 pt-8">
        <div className="text-center w-48 border-t border-slate-400 pt-2">
          <p className="font-medium">Authorized Signatory</p>
        </div>
        <div className="text-center w-48 border-t border-slate-400 pt-2">
          <p className="font-medium">Receiver's Signature</p>
        </div>
        </div>
      </div>
    </Drawer>
  );
}
