import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageHeader, Card, Button, Badge, Table, Th, Td, Drawer } from '../../components/ui';
import { ArrowLeft, Printer, Scissors, Palette, CheckCircle } from 'lucide-react';
import * as repo from '../../db/repo';

export default function ProgramDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [program, setProgram] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const data = await repo.getProgram(id);
        if (!data) return navigate('/programs');
        setProgram(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  const handlePrint = () => window.print();

  if (loading || !program) return <div className="p-12 text-center text-slate-500">Loading...</div>;

  return (
    <Drawer isOpen={true} onClose={() => navigate('/programs')}>
      <div className="space-y-6 max-w-5xl mx-auto print:max-w-none print:m-0 print:p-0">
        <div className="print:hidden">
        <PageHeader 
          title={`Program ${program.program_no}`}
          description={`Issued on ${new Date(program.date).toLocaleDateString()}`}
        >
          <Button variant="ghost" onClick={() => navigate('/programs')}><ArrowLeft className="w-4 h-4 mr-2" /> Back</Button>
          <Button variant="outline" onClick={handlePrint}><Printer className="w-4 h-4 mr-2" /> Print PDF</Button>
          <Button onClick={() => navigate(`/programs/${id}/receive`)} disabled={program.status === 'DONE'}>
            <CheckCircle className="w-4 h-4 mr-2" /> Receive Finished
          </Button>
        </PageHeader>
      </div>

      <div className="hidden print:block text-center mb-8 border-b-2 border-slate-900 pb-6">
        <h1 className="text-3xl font-bold text-slate-900 uppercase tracking-widest">Vinee Creation</h1>
        <h2 className="text-xl font-medium mt-2">Dyeing Program</h2>
        <div className="flex justify-between items-end mt-8 text-left">
          <div>
            <p className="text-slate-600 font-semibold mb-1">To: Mill</p>
            <p className="text-lg font-bold text-slate-900">{program.mill_name}</p>
          </div>
          <div className="text-right">
            <p className="font-semibold text-slate-900">No: {program.program_no}</p>
            <p className="text-slate-700">Date: {new Date(program.date).toLocaleDateString()}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 print:hidden">
        <Card className="p-6 md:col-span-3">
          <div className="flex justify-between items-start mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-violet-100 text-violet-600 rounded-xl flex items-center justify-center">
                <Scissors className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900">{program.mill_name}</h3>
                <p className="text-slate-500 text-sm">{program.nick_name} <span className="text-xs">({program.original_name})</span></p>
              </div>
            </div>
            {program.status === 'DONE' ? <Badge variant="success">Done</Badge> : (program.status === 'PARTIAL' ? <Badge variant="warning">Partial</Badge> : <Badge variant="primary">In Dyeing</Badge>)}
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 p-4 rounded-xl">
              <div className="text-sm text-slate-500 mb-1">Total Takas Sent</div>
              <div className="text-2xl font-bold text-slate-900">{program.total_takas}</div>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl">
              <div className="text-sm text-slate-500 mb-1">Grey Meters</div>
              <div className="text-2xl font-bold text-slate-900">{program.grey_m.toLocaleString()} m</div>
            </div>
            <div className="col-span-2 bg-slate-50 p-4 rounded-xl">
              <div className="text-sm text-slate-500 mb-1">Shade Chart</div>
              <div className="font-medium text-slate-900 flex items-center gap-2"><Palette className="w-4 h-4 text-slate-400" /> {program.chart_name}</div>
            </div>
          </div>
          
          {program.notes && (
            <div className="mt-4 text-sm bg-slate-100 text-slate-700 p-4 rounded-xl border border-slate-200">
              <strong className="block mb-1">Notes</strong>
              {program.notes}
            </div>
          )}
        </Card>

        <Card className="p-6 flex flex-col items-center justify-center text-center">
          <div className="relative w-32 h-32 flex items-center justify-center mb-4">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
              <path className="text-slate-100" strokeWidth="3" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
              <path className="text-emerald-500 transition-all duration-1000 ease-out" strokeDasharray={`${Math.min(100, (program.received_takas / program.total_takas) * 100 || 0)}, 100`} strokeWidth="3" strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-slate-900">{Math.round((program.received_takas / program.total_takas) * 100) || 0}%</span>
              <span className="text-xs text-slate-500">received</span>
            </div>
          </div>
          
          <div className="w-full space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Finished Takas</span>
              <span className="font-medium text-slate-900">{program.received_takas}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Pending Takas</span>
              <span className="font-medium text-slate-900">{program.total_takas - program.received_takas}</span>
            </div>
          </div>
        </Card>
      </div>

      <div className="hidden print:flex mb-6 text-lg">
        <div className="w-1/2">
          <strong>Quality:</strong> {program.nick_name}
        </div>
        <div className="w-1/2 text-right">
          <strong>Chart:</strong> {program.chart_name}
        </div>
      </div>

      <Card className="print:shadow-none print:border-none print:rounded-none">
        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 rounded-t-xl print:hidden">
          <h3 className="font-semibold text-slate-900">Shade Lines</h3>
        </div>
        <div className="print:p-0">
          <Table className="print:text-lg">
            <thead>
              <tr className="print:border-b-2 print:border-slate-900">
                <Th className="print:text-slate-900 w-24 text-center">Swatch</Th>
                <Th className="print:text-slate-900">Shade No</Th>
                <Th className="print:text-slate-900">Name</Th>
                <Th className="text-right print:text-slate-900">Takas to Dye</Th>
                <Th className="text-right print:hidden">Received</Th>
              </tr>
            </thead>
            <tbody>
              {program.lines?.map((l) => (
                <tr key={l.id} className="hover:bg-slate-50 print:border-b print:border-slate-300">
                  <Td className="text-center print:py-4">
                    <div className="w-12 h-12 mx-auto rounded-md shadow-inner border border-slate-200" style={{ backgroundColor: l.hex || '#ccc', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }} />
                  </Td>
                  <Td className="font-bold text-slate-900 text-lg print:text-2xl">{l.shade_no}</Td>
                  <Td className="text-slate-600 font-medium">{l.shade_name || '-'}</Td>
                  <Td className="text-right font-bold text-lg print:text-2xl">{l.taka_count}</Td>
                  <Td className="text-right print:hidden">
                    <span className={`font-medium ${l.received >= l.taka_count ? 'text-emerald-600' : 'text-slate-500'}`}>
                      {l.received} / {l.taka_count}
                    </span>
                  </Td>
                </tr>
              ))}
              <tr className="bg-slate-50 font-bold print:bg-white print:border-t-2 print:border-slate-900 print:text-xl">
                <Td colSpan={3} className="text-right py-4">Total Takas Sent</Td>
                <Td className="text-right py-4 text-xl">{program.total_takas}</Td>
                <Td className="print:hidden"></Td>
              </tr>
            </tbody>
          </Table>
        </div>
      </Card>

      <div className="hidden print:flex justify-between mt-24 pt-8">
        <div className="text-center w-64 border-t border-slate-400 pt-2">
          <p className="font-medium">Authorized Signatory (Vinee Creation)</p>
        </div>
        <div className="text-center w-64 border-t border-slate-400 pt-2">
          <p className="font-medium">Mill Acceptance Signature & Stamp</p>
        </div>
        </div>
      </div>
    </Drawer>
  );
}
