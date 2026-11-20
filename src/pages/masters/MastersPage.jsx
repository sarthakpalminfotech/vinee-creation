import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageHeader, Card, Button, Table, Th, Td, Empty, Alert } from '../../components/ui';
import { useDbVersion } from '../../lib/live';
import { SearchToggle } from '../../components/kit';
import { Plus, Edit, Trash2, ChevronRight, Palette } from 'lucide-react';
import * as repo from '../../db/repo';
import { LibraryShadeCard, QualityColoursPanel } from './Colours';
import { MasterFormModal, shadeForEdit } from './MasterForm';
import { TemplateCard, TemplateFormModal } from './Templates';

const TABS = [
  { id: 'weavers', label: 'Weavers' },
  { id: 'mills', label: 'Mills' },
  { id: 'customers', label: 'Customers' },
  { id: 'job_workers', label: 'Job workers' },
  { id: 'qualities', label: 'Qualities' },
  { id: 'branches', label: 'Branches' },
  { id: 'shades', label: 'Shades' },
  { id: 'templates', label: 'Message templates' },
];

/** Details screen of one master entry. */
export const masterPath = (kind, id) => `/masters/view/${kind}/${id}`;
/** Row action icon that never opens the row it sits in. */
const stop = (fn) => (e) => { e.stopPropagation(); fn(); };

export default function MastersPage() {
  const { tab } = useParams();
  const navigate = useNavigate();
  const currentTab = TABS.find(t => t.id === tab) || TABS[0];

  const [data, setData] = useState(null);
  const [dataTab, setDataTab] = useState(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null); // {type, item, extra}
  const [pageError, setPageError] = useState('');
  const [colourQuality, setColourQuality] = useState(null);
  const version = useDbVersion();

  const loadData = async () => {
    if (dataTab !== tab) setLoading(true);
    try {
      let res;
      if (tab === 'weavers') res = await repo.listWeaverGroups();
      else if (tab === 'mills') res = await repo.listMills();
      else if (tab === 'customers') res = await repo.listCustomers();
      else if (tab === 'job_workers') res = await repo.listJobWorkers();
      else if (tab === 'qualities') res = await repo.listQualities();
      else if (tab === 'branches') res = await repo.listBranches();
      else if (tab === 'shades') res = await repo.listShades();
      else if (tab === 'templates') res = await repo.listMessageTemplates();
      if (tab === 'qualities') {
        const counts = await repo.qualityColourCounts();
        res = res.map((q) => ({ ...q, colours: counts[q.id] || { total: 0, active: 0 } }));
      }
      setData(res);
      setDataTab(tab);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setSearch('');
  }, [tab]);
  useEffect(() => {
    loadData();
  }, [tab, version]);

  const openForm = (type, item = null, extra = {}) => setForm({ type, item, extra });
  const open = (kind, id) => navigate(masterPath(kind, id));

  const handleDelete = async (table, id) => {
    if (!confirm('Delete this record? This cannot be undone.')) return;
    setPageError('');
    try {
      await repo.removeMaster(table, id);
      loadData();
    } catch (err) {
      setPageError(err.message);
    }
  };

  const renderContent = () => {
    if (loading || !data || tab !== dataTab) return <div className="py-12 text-center text-slate-500">Loading...</div>;
    const lSearch = search.toLowerCase();

    if (tab === 'weavers') {
      const filtered = data.filter(g =>
        g.name.toLowerCase().includes(lSearch) ||
        g.firms.some(f => f.name.toLowerCase().includes(lSearch))
      );

      return (
        <div className="space-y-4">
          {filtered.map(group => (
            <FirmCard
              key={group.id}
              group={group}
              onOpen={() => open('weaver_groups', group.id)}
              onEdit={() => openForm('weaver_groups', group)}
              onDelete={() => handleDelete('weaver_groups', group.id)}
              onAddParty={() => openForm('weavers', null, { group_id: group.id })}
              onOpenParty={(f) => open('weavers', f.id)}
              onEditParty={(f) => openForm('weavers', f)}
              onDeleteParty={(id) => handleDelete('weavers', id)}
            />
          ))}
          {filtered.length === 0 && <Empty title="No firms found" description="Add a firm (one owner) and then its associated parties." />}
        </div>
      );
    }

    if (['mills', 'customers'].includes(tab)) {
      const filtered = data.filter(i => i.name.toLowerCase().includes(lSearch) || (i.city || '').toLowerCase().includes(lSearch));
      return (
        <Card>
          <Table className="whitespace-normal">
            <thead>
              <tr><Th>Name</Th><Th>Contact</Th><Th>Phone</Th><Th>City</Th><Th className="hidden lg:table-cell">GST no.</Th><Th className="w-28 text-right">Actions</Th></tr>
            </thead>
            <tbody>
              {filtered.map(row => (
                <tr key={row.id} className="cursor-pointer hover:bg-slate-50" onClick={() => open(tab, row.id)}>
                  <Td className="font-medium">{row.name}</Td><Td>{row.contact || '-'}</Td><Td>{row.phone || '-'}</Td><Td>{row.city || '-'}</Td><Td className="hidden lg:table-cell font-mono text-xs">{row.gstin || '-'}</Td>
                  <Td className="text-right">
                    <div className="flex justify-end gap-2">
                      <button aria-label="Edit" onClick={stop(() => openForm(tab, row))} className="w-10 h-10 inline-grid place-items-center rounded-lg text-slate-400 hover:text-primary-600 hover:bg-primary-50"><Edit className="w-4 h-4" /></button>
                      <button aria-label="Delete" onClick={stop(() => handleDelete(tab, row.id))} className="w-10 h-10 inline-grid place-items-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-primary-50"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
          {filtered.length === 0 && <div className="p-8 text-center text-slate-500">No {tab} found.</div>}
        </Card>
      );
    }

    if (tab === 'job_workers') {
      const filtered = data.filter(i => i.name.toLowerCase().includes(lSearch) || (i.city || '').toLowerCase().includes(lSearch));
      return (
        <Card>
          <Table>
            <thead>
              <tr><Th>Name</Th><Th>Phone</Th><Th>City</Th><Th className="hidden lg:table-cell">GST no.</Th><Th className="hidden xl:table-cell">Notes</Th><Th className="w-28 text-right">Actions</Th></tr>
            </thead>
            <tbody>
              {filtered.map(row => (
                <tr key={row.id} className="cursor-pointer hover:bg-slate-50" onClick={() => open('job_workers', row.id)}>
                  <Td className="font-medium">{row.name}</Td><Td>{row.phone || '-'}</Td><Td>{row.city || '-'}</Td><Td className="hidden lg:table-cell font-mono text-xs">{row.gstin || '-'}</Td><Td className="hidden xl:table-cell">{row.notes || '-'}</Td>
                  <Td className="text-right">
                    <div className="flex justify-end gap-2">
                      <button aria-label="Edit" onClick={stop(() => openForm('job_workers', row))} className="w-10 h-10 inline-grid place-items-center rounded-lg text-slate-400 hover:text-primary-600 hover:bg-primary-50"><Edit className="w-4 h-4" /></button>
                      <button aria-label="Delete" onClick={stop(() => handleDelete('job_workers', row.id))} className="w-10 h-10 inline-grid place-items-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-primary-50"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
          {filtered.length === 0 && <div className="p-8 text-center text-slate-500">No job workers yet. Add the people who embroider, print or finish your folded goods.</div>}
        </Card>
      );
    }

    if (tab === 'qualities') {
      const filtered = data.filter(q => (q.nick_name || '').toLowerCase().includes(lSearch) || (q.original_name || '').toLowerCase().includes(lSearch));
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(q => (
            <Card key={q.id} className="p-4 flex flex-col relative group cursor-pointer hover:border-primary-300" onClick={() => open('qualities', q.id)}>
              <div className="absolute top-2 right-2 flex gap-1 bg-white shadow-sm rounded-lg p-1">
                <button aria-label="Edit" onClick={stop(() => openForm('qualities', q))} className="w-10 h-10 inline-grid place-items-center rounded-lg text-slate-400 hover:text-primary-600 hover:bg-primary-50"><Edit className="w-4 h-4" /></button>
                <button aria-label="Delete" onClick={stop(() => handleDelete('qualities', q.id))} className="w-10 h-10 inline-grid place-items-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-primary-50"><Trash2 className="w-4 h-4" /></button>
              </div>
              <div className="font-bold text-lg text-slate-900 pr-20">{q.nick_name} <span className="text-xs font-normal text-slate-400">nickname</span></div>
              <div className="text-sm text-slate-500">{q.original_name} <span className="text-xs text-slate-400">original</span></div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-sm">
                <span className="text-slate-500">Taka Length</span>
                <span className="font-medium text-slate-900">{q.taka_length}m</span>
              </div>
              <Button variant="outline" size="sm" className="mt-3 w-full" onClick={stop(() => setColourQuality(q))}>
                <Palette className="w-4 h-4 mr-2" /> Colours ({q.colours.active}{q.colours.total !== q.colours.active ? ' of ' + q.colours.total : ''})
              </Button>
            </Card>
          ))}
        </div>
      );
    }

    if (tab === 'branches') {
      const filtered = data.filter(b => b.name.toLowerCase().includes(lSearch) || (b.city || '').toLowerCase().includes(lSearch));
      return (
        <Card>
          <Table>
            <thead><tr><Th>Branch</Th><Th>City</Th><Th className="hidden xl:table-cell">Address</Th><Th>Phone</Th><Th className="w-28 text-right">Actions</Th></tr></thead>
            <tbody>
              {filtered.map(row => (
                <tr key={row.id} className="cursor-pointer hover:bg-slate-50" onClick={() => open('branches', row.id)}>
                  <Td className="font-medium">{row.name}</Td><Td>{row.city || '-'}</Td><Td className="hidden xl:table-cell">{row.address || '-'}</Td><Td>{row.phone || '-'}</Td>
                  <Td className="text-right">
                    <button aria-label="Edit" onClick={stop(() => openForm('branches', row))} className="w-10 h-10 inline-grid place-items-center rounded-lg text-slate-400 hover:text-primary-600 hover:bg-primary-50"><Edit className="w-4 h-4" /></button>
                    <button aria-label="Delete" onClick={stop(() => handleDelete('branches', row.id))} className="w-10 h-10 inline-grid place-items-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-primary-50"><Trash2 className="w-4 h-4" /></button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
          {filtered.length === 0 && <div className="p-8 text-center text-slate-500">No branches yet. Add every place where grey is received.</div>}
        </Card>
      );
    }

    if (tab === 'templates') {
      const filtered = data.filter((t) => t.name.toLowerCase().includes(lSearch) || t.body.toLowerCase().includes(lSearch));
      if (filtered.length === 0) return <Empty title="No message templates" description="Add the WhatsApp payment reminder texts here. They appear on an order's payment section when money is pending." />;
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((t) => <TemplateCard key={t.id} t={t} onEdit={() => openForm('templates', t)} onDelete={() => handleDelete('message_templates', t.id)} />)}
        </div>
      );
    }

    if (tab === 'shades') {
      const shown = data.filter(s => `${s.number} ${s.name || ''}`.toLowerCase().includes(lSearch));
      if (shown.length === 0) return <Empty icon={Palette} title={lSearch ? 'No shade matches' : 'No shades yet'} description="The shade library is shared by all qualities. Add a colour with the picker, a photo, or both." />;
      return (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {shown.map(s => (
            <LibraryShadeCard key={s.id} s={s} onOpen={() => open('shades', s.id)} onEdit={() => openForm('shades', shadeForEdit(s))} onDelete={() => handleDelete('shades', s.id)} />
          ))}
        </div>
      );
    }
  };

  const getAddTitle = () => {
    switch (tab) {
      case 'weavers': return 'Add Firm';
      case 'mills': return 'Add Mill';
      case 'customers': return 'Add Customer';
      case 'job_workers': return 'Add Job Worker';
      case 'qualities': return 'Add Quality';
      case 'branches': return 'Add Branch';
      case 'shades': return 'Add Shade';
      case 'templates': return 'Add Template';
      default: return 'Add Item';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex overflow-x-auto no-scrollbar gap-1 border-b border-slate-200">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => navigate(`/masters/${t.id}`)}
            className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
              tab === t.id ? 'border-primary-600 text-primary-700' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <PageHeader title={`${currentTab.label} Master`}>
        <SearchToggle value={search} onChange={setSearch} placeholder={tab === 'weavers' ? 'Search firms and associated parties...' : `Search ${currentTab.label.toLowerCase()}...`} />
        <Button onClick={() => openForm(tab === 'weavers' ? 'weaver_groups' : tab)} className="flex-shrink-0">
          <Plus className="w-4 h-4 mr-2" />
          {getAddTitle()}
        </Button>
      </PageHeader>

      <Alert tone="error">{pageError}</Alert>
      {renderContent()}
      {colourQuality && <QualityColoursPanel quality={colourQuality} onClose={() => { setColourQuality(null); loadData(); }} />}

      <MasterFormModal type={form?.type === 'templates' ? undefined : form?.type} item={form?.item} extra={form?.extra} onClose={() => setForm(null)} onSaved={loadData} />
      <TemplateFormModal open={form?.type === 'templates'} item={form?.item} onClose={() => setForm(null)} onSaved={loadData} />
    </div>
  );
}

function FirmCard({ group, onOpen, onEdit, onDelete, onAddParty, onOpenParty, onEditParty, onDeleteParty }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <Card className="overflow-visible">
      <div className="flex items-center justify-between gap-3 p-4 bg-ivory border-b border-slate-200 rounded-t-xl">
        <div className="flex items-center gap-3 min-w-0">
          <button aria-label={expanded ? 'Collapse' : 'Expand'} onClick={() => setExpanded(!expanded)} className="w-10 h-10 -ml-2 grid place-items-center rounded-lg hover:bg-primary-50 text-slate-500">
            <ChevronRight className={`w-5 h-5 transition-transform ${expanded ? 'rotate-90' : ''}`} />
          </button>
          <button type="button" onClick={onOpen} className="min-w-0 text-left">
            <div className="font-semibold text-slate-900 text-base hover:text-primary-700">{group.name}</div>
            <div className="text-xs text-slate-500 flex flex-wrap gap-x-2">
              <span>{group.city || 'No city'}</span> • <span>{group.firms.length} associated {group.firms.length === 1 ? 'party' : 'parties'}</span>
              {group.gstin && <><span>•</span><span className="font-mono">GST {group.gstin}</span></>}
            </div>
          </button>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="ghost" size="sm" onClick={onAddParty}><Plus className="w-4 h-4 mr-1" /> Add Associated Party</Button>
          <div className="w-px h-4 bg-slate-300 mx-1"></div>
          <button aria-label="Edit firm" onClick={onEdit} className="w-10 h-10 inline-grid place-items-center rounded-lg text-slate-400 hover:text-primary-600 hover:bg-primary-50"><Edit className="w-4 h-4" /></button>
          <button aria-label="Delete firm" onClick={onDelete} className="w-10 h-10 inline-grid place-items-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-primary-50"><Trash2 className="w-4 h-4" /></button>
        </div>
      </div>

      {expanded && (
        <div className="p-0">
          <Table>
            <thead><tr><Th className="pl-14">Associated party</Th><Th>GST no.</Th><Th>Phone</Th><Th className="w-28 text-right">Actions</Th></tr></thead>
            <tbody>
              {group.firms.map(f => (
                <tr key={f.id} className="cursor-pointer hover:bg-slate-50" onClick={() => onOpenParty(f)}>
                  <Td className="pl-14 font-medium">{f.name}</Td><Td className="font-mono text-xs">{f.gstin || '-'}</Td><Td>{f.phone || '-'}</Td>
                  <Td className="text-right">
                    <button aria-label="Edit associated party" onClick={stop(() => onEditParty(f))} className="w-10 h-10 inline-grid place-items-center rounded-lg text-slate-400 hover:text-primary-600 hover:bg-primary-50"><Edit className="w-4 h-4" /></button>
                    <button aria-label="Delete associated party" onClick={stop(() => onDeleteParty(f.id))} className="w-10 h-10 inline-grid place-items-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-primary-50"><Trash2 className="w-4 h-4" /></button>
                  </Td>
                </tr>
              ))}
              {group.firms.length === 0 && (
                <tr>
                  <Td colSpan={4} className="text-center py-6 text-slate-500">No associated parties added yet.</Td>
                </tr>
              )}
            </tbody>
          </Table>
        </div>
      )}
    </Card>
  );
}
