import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageHeader, Card, Button, Badge, Table, Th, Td, Drawer } from '../../components/ui';
import { ArrowLeft, Printer, Scissors, Palette, CheckCircle } from 'lucide-react';
import { fmtM, fmtPct, fmtDate } from '../../lib/format';
import * as repo from '../../db/repo';
import { useDbVersion } from '../../lib/live';
import { DetailList, Progress } from '../../components/kit';

export default function ProgramDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [program, setProgram] = useState(null);

  const dbVersion = useDbVersion();
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
  }, [id, dbVersion]);

  const handlePrint = () => window.print();

  if (loading || !program) return <div className="p-12 text-center text-slate-500">Loading...</div>;

  return (
    <Drawer isOpen={true} onClose={() => navigate('/programs')}>
      <div className="space-y-6 max-w-5xl mx-auto print:max-w-none print:m-0 print:p-0">
        <div className="print:hidden">
        <PageHeader 
          title={`Program ${program.program_no}`}
          description={`Issued on ${fmtDate(program.date)}`}
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
            <p className="text-slate-700">Date: {fmtDate(program.date)}</p>
          </div>
        </div>
      </div>

      <Card className="p-6 space-y-6 print:hidden">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-slate-900">{program.mill_name}</h2>
            <div className="text-sm text-slate-500">{program.nick_name}</div>
          </div>
          {program.status === 'DONE' ? <Badge variant="success">Done</Badge> : (program.status === 'PARTIAL' ? <Badge variant="warning">Partial</Badge> : <Badge variant="primary">In Dyeing</Badge>)}
        </div>
        <DetailList items={[
          { label: 'Issued on', value: fmtDate(program.date) },
          { label: 'Shade chart', value: program.chart_name },
          { label: 'Takas sent', value: program.total_takas },
          { label: 'Grey meters', value: `${fmtM(program.grey_m)} m` },
          { label: 'Finished takas', value: program.received_takas },
          { label: 'Pending takas', value: program.total_takas - program.received_takas },
          { label: 'Notes', value: program.notes, wide: true },
        ]} />
        <Progress label="Received" pct={(program.received_takas / program.total_takas) * 100 || 0} tone="emerald" />
      </Card>

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
          <h3 className="font-semibold text-slate-900">Item Lines</h3>
        </div>
        <div className="print:p-0">
          <Table className="print:text-lg">
            <thead>
              <tr className="print:border-b-2 print:border-slate-900">
                <Th className="print:text-slate-900 w-24 text-center">Swatch</Th>
                <Th className="print:text-slate-900">Item code</Th>
                <Th className="print:text-slate-900">Shade No</Th>
                <Th className="print:text-slate-900">Name</Th>
                <Th className="text-right print:text-slate-900">Takas to Dye</Th>
                <Th className="text-right print:text-slate-900">Grey Meters</Th>
                <Th className="text-right print:hidden">Received / Pending</Th>
              </tr>
            </thead>
            <tbody>
              {program.lines?.map((l) => (
                <tr key={l.id} className="hover:bg-slate-50 print:border-b print:border-slate-300">
                  <Td className="text-center print:py-4">
                    <div className="w-12 h-12 mx-auto rounded-md shadow-inner border border-slate-200" style={{ backgroundColor: l.hex || '#ccc', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }} />
                  </Td>
                  <Td className="font-mono font-bold text-slate-900 text-lg print:text-2xl">{l.item_code || '—'}</Td>
                  <Td className="font-bold text-slate-900 text-lg print:text-2xl">{l.shade_no}</Td>
                  <Td className="text-slate-600 font-medium">{l.shade_name || '-'}</Td>
                  <Td className="text-right font-bold text-lg print:text-2xl">{l.taka_count}</Td>
                  <Td className="text-right print:text-xl">{fmtM(l.grey_m)}</Td>
                  <Td className="text-right print:hidden">
                    <span className={`font-medium ${l.received >= l.taka_count ? 'text-emerald-600' : 'text-slate-500'}`}>
                      {l.received} / {l.taka_count} <span className="text-slate-400">· {l.taka_count - l.received} pending</span>
                    </span>
                  </Td>
                </tr>
              ))}
              <tr className="bg-slate-50 font-bold print:bg-white print:border-t-2 print:border-slate-900 print:text-xl">
                <Td colSpan={4} className="text-right py-4">Total</Td>
                <Td className="text-right py-4 text-xl">{program.total_takas}</Td>
                <Td className="text-right py-4">{fmtM(program.grey_m)}</Td>
                <Td className="print:hidden"></Td>
              </tr>
            </tbody>
          </Table>
        </div>
      </Card>

      {program.takas?.some(t => t.finished_receipt_id) && (
        <Card className="print:hidden">
          <div className="p-5 border-b border-slate-100 bg-slate-50/50 rounded-t-xl">
            <h3 className="font-semibold text-slate-900">Received from mill — finishing shrinkage</h3>
          </div>
          <div className="max-h-96 overflow-y-auto">
            <Table>
              <thead><tr><Th>Shade</Th><Th>Taka</Th><Th className="text-right">Grey m</Th><Th className="text-right">Finished m</Th><Th className="text-right">Loss m</Th><Th className="text-right">Loss %</Th><Th>Mill challan</Th></tr></thead>
              <tbody>
                {program.takas.filter(t => t.finished_receipt_id).map(t => (
                  <tr key={t.id}>
                    <Td>{t.shade_no}</Td><Td>{t.label}</Td><Td className="text-right">{fmtM(t.millGrey)}</Td><Td className="text-right">{fmtM(t.finished_meter)}</Td>
                    <Td className="text-right">{fmtM(t.finishLoss)}</Td><Td className="text-right">{fmtPct(t.finishPct)}</Td><Td>{t.finished_challan}</Td>
                  </tr>
                ))}
                {(() => {
                  const r = program.takas.filter(t => t.finished_receipt_id);
                  const g = r.reduce((s, t) => s + t.millGrey, 0), f = r.reduce((s, t) => s + Number(t.finished_meter), 0);
                  return (
                    <tr className="bg-slate-50 font-bold">
                      <Td colSpan={2}>Total ({r.length} takas)</Td><Td className="text-right">{fmtM(g)}</Td><Td className="text-right">{fmtM(f)}</Td>
                      <Td className="text-right">{fmtM(g - f)}</Td><Td className="text-right">{fmtPct(g ? ((g - f) / g) * 100 : null)}</Td><Td></Td>
                    </tr>
                  );
                })()}
              </tbody>
            </Table>
          </div>
        </Card>
      )}

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
