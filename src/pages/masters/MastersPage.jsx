import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageHeader, Card, Button, Input, Select, Modal, Field, Table, Th, Td, Empty, Alert } from '../../components/ui';
import { useDbVersion } from '../../lib/live';
import { SearchToggle } from '../../components/kit';
import { Search, Plus, Edit, Trash2, ChevronDown, ChevronRight, AlertCircle, Palette, Wand2 } from 'lucide-react';
import * as repo from '../../db/repo';

const TABS = [
  { id: 'weavers', label: 'Parties' },
  { id: 'mills', label: 'Mills' },
  { id: 'customers', label: 'Customers' },
  { id: 'qualities', label: 'Qualities' },
  { id: 'branches', label: 'Branches' },
  { id: 'locations', label: 'Racks' },
  { id: 'shades', label: 'Shades' },
  { id: 'items', label: 'Items' },
];

const MODAL_TITLES = {
  weaver_groups: 'party group', weavers: 'party', mills: 'mill', customers: 'customer', qualities: 'quality', branches: 'branch',
  locations: 'rack', shade_charts: 'shade chart', shades: 'shade', items: 'item',
};

export default function MastersPage() {
  const { tab } = useParams();
  const navigate = useNavigate();
  const currentTab = TABS.find(t => t.id === tab) || TABS[0];
  
  const [data, setData] = useState(null);
  const [dataTab, setDataTab] = useState(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  
  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState(null); // 'weaver_group', 'weaver', 'mill', etc.
  const [editItem, setEditItem] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [pageError, setPageError] = useState('');
  const [saving, setSaving] = useState(false);
  
  // Form State
  const [formData, setFormData] = useState({});
  const [opts, setOpts] = useState({ branches: [], qualities: [], charts: [], shades: [] });
  const [genQ, setGenQ] = useState('');
  const [genChart, setGenChart] = useState('');
  const version = useDbVersion();

  const loadData = async () => {
    if (dataTab !== tab) setLoading(true);
    try {
      let res;
      if (tab === 'weavers') res = await repo.listWeaverGroups();
      else if (tab === 'mills') res = await repo.listMills();
      else if (tab === 'customers') res = await repo.listCustomers();
      else if (tab === 'qualities') res = await repo.listQualities();
      else if (tab === 'branches') res = await repo.listBranches();
      else if (tab === 'locations') res = await repo.listLocations();
      else if (tab === 'items') res = await repo.listItems();
      else if (tab === 'shades') {
        const [charts, shades] = await Promise.all([repo.listCharts(), repo.listShades()]);
        res = { charts, shades };
      }
      if (tab === 'locations' || tab === 'items') {
        const [branches, qualities, charts, shades] = await Promise.all([repo.listBranches(), repo.listQualities(), repo.listCharts(), repo.listShades()]);
        setOpts({ branches, qualities, charts, shades });
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

  const handleOpenModal = (type, item = null, extraProps = {}) => {
    setModalType(type);
    setEditItem(item);
    setFormData(item ? { ...item } : { ...extraProps });
    setErrorMsg(null);
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      await repo.saveMaster(modalType, formData);
      setModalOpen(false);
      loadData();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setSaving(false);
    }
  };

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

  const handleFormChange = (k, v) => setFormData(p => ({ ...p, [k]: v }));

  const renderModalContent = () => {
    const isEdit = !!editItem;
    
    if (['mills', 'customers', 'weaver_groups'].includes(modalType)) {
      return (
        <form onSubmit={handleSave} className="space-y-4">
          <Field label="Name"><Input required placeholder="e.g. Ganesh" value={formData.name || ''} onChange={e => handleFormChange('name', e.target.value)} /></Field>
          <Field label="Contact Person"><Input placeholder="e.g. Ramesh Bhai" value={formData.contact || ''} onChange={e => handleFormChange('contact', e.target.value)} /></Field>
          <Field label="Phone"><Input placeholder="e.g. 98250 12345" value={formData.phone || ''} onChange={e => handleFormChange('phone', e.target.value)} /></Field>
          <Field label="City"><Input placeholder="e.g. Surat" value={formData.city || ''} onChange={e => handleFormChange('city', e.target.value)} /></Field>
          <Alert>{errorMsg}</Alert>
          <div className="pt-4 flex justify-end gap-3">
            <Button variant="ghost" type="button" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
          </div>
        </form>
      );
    }

    if (modalType === 'weavers') {
      return (
        <form onSubmit={handleSave} className="space-y-4">
          <Field label="Party (firm) name"><Input required placeholder="e.g. Ganesh Fabrics" value={formData.name || ''} onChange={e => handleFormChange('name', e.target.value)} /></Field>
          <Field label="GSTIN"><Input placeholder="e.g. 24AAACG1234F1Z5" value={formData.gstin || ''} onChange={e => handleFormChange('gstin', e.target.value)} /></Field>
          <Field label="Phone"><Input placeholder="e.g. 98250 11223" value={formData.phone || ''} onChange={e => handleFormChange('phone', e.target.value)} /></Field>
          <Alert>{errorMsg}</Alert>
          <div className="pt-4 flex justify-end gap-3">
            <Button variant="ghost" type="button" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
          </div>
        </form>
      );
    }

    if (modalType === 'qualities') {
      return (
        <form onSubmit={handleSave} className="space-y-4">
          <Field label="Original name (used with weavers)"><Input required placeholder="e.g. 100% Polyester Crape" value={formData.original_name || ''} onChange={e => handleFormChange('original_name', e.target.value)} /></Field>
          <Field label="Nickname (used with mills and customers)"><Input required placeholder="e.g. Gold Lava" value={formData.nick_name || ''} onChange={e => handleFormChange('nick_name', e.target.value)} /></Field>
          <Field label="Default Taka Length (m)"><Input type="number" placeholder="e.g. 100" required value={formData.taka_length || ''} onChange={e => handleFormChange('taka_length', e.target.value)} /></Field>
          <Field label="Notes"><Input placeholder="e.g. Shrinks 5% after dyeing" value={formData.notes || ''} onChange={e => handleFormChange('notes', e.target.value)} /></Field>
          <Alert>{errorMsg}</Alert>
          <div className="pt-4 flex justify-end gap-3">
            <Button variant="ghost" type="button" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
          </div>
        </form>
      );
    }

    if (modalType === 'branches') {
      return (
        <form onSubmit={handleSave} className="space-y-4">
          <Field label="Branch name"><Input required placeholder="e.g. Surat Godown" value={formData.name || ''} onChange={e => handleFormChange('name', e.target.value)} /></Field>
          <Field label="City"><Input placeholder="e.g. Surat" value={formData.city || ''} onChange={e => handleFormChange('city', e.target.value)} /></Field>
          <Field label="Address"><Input placeholder="e.g. Shop 6065, Textile Market" value={formData.address || ''} onChange={e => handleFormChange('address', e.target.value)} /></Field>
          <Field label="Phone"><Input placeholder="e.g. 98250 12345" value={formData.phone || ''} onChange={e => handleFormChange('phone', e.target.value)} /></Field>
          <Alert>{errorMsg}</Alert>
          <div className="pt-4 flex justify-end gap-3">
            <Button variant="ghost" type="button" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
          </div>
        </form>
      );
    }

    if (modalType === 'items') {
      const q = opts.qualities.find(x => String(x.id) === String(formData.quality_id));
      const sh = opts.shades.find(x => String(x.id) === String(formData.shade_id));
      return (
        <form onSubmit={handleSave} className="space-y-4">
          <Field label="Quality (nickname) *">
            <Select required value={formData.quality_id || ''} onChange={e => handleFormChange('quality_id', e.target.value)}>
              <option value="">Select quality...</option>
              {opts.qualities.map(x => <option key={x.id} value={x.id}>{x.nick_name} ({x.original_name})</option>)}
            </Select>
          </Field>
          <Field label="Colour / shade">
            <Select value={formData.shade_id || ''} onChange={e => handleFormChange('shade_id', e.target.value)}>
              <option value="">No colour (grey item)</option>
              {opts.shades.map(x => <option key={x.id} value={x.id}>{x.chart_name} · {x.number}{x.name ? ` ${x.name}` : ''}</option>)}
            </Select>
          </Field>
          <Field label="Unique item code *">
            <div className="flex gap-2">
              <Input required placeholder="e.g. GL-37" value={formData.code || ''} onChange={e => handleFormChange('code', e.target.value)} />
              <Button type="button" variant="outline" disabled={!q} onClick={() => handleFormChange('code', repo.suggestItemCode(q?.nick_name, sh?.number))}>Suggest</Button>
            </div>
          </Field>
          <Field label="Notes"><Input value={formData.notes || ''} onChange={e => handleFormChange('notes', e.target.value)} /></Field>
          <Alert>{errorMsg}</Alert>
          <div className="pt-4 flex justify-end gap-3">
            <Button variant="ghost" type="button" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
          </div>
        </form>
      );
    }

    if (modalType === 'locations') {
      return (
        <form onSubmit={handleSave} className="space-y-4">
          <Field label="Branch *">
            <Select required value={formData.branch_id || ''} onChange={e => handleFormChange('branch_id', e.target.value)}>
              <option value="">Select branch...</option>
              {opts.branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          </Field>
          <Field label="Shop"><Input required placeholder="e.g. Shop 6065" value={formData.shop || ''} onChange={e => handleFormChange('shop', e.target.value)} /></Field>
          <Field label="Rack"><Input required placeholder="e.g. Rack-A" value={formData.rack || ''} onChange={e => handleFormChange('rack', e.target.value)} /></Field>
          <Alert>{errorMsg}</Alert>
          <div className="pt-4 flex justify-end gap-3">
            <Button variant="ghost" type="button" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
          </div>
        </form>
      );
    }

    if (modalType === 'shade_charts') {
      return (
        <form onSubmit={handleSave} className="space-y-4">
          <Field label="Chart Name"><Input required placeholder="e.g. Summer 2026 Collection" value={formData.name || ''} onChange={e => handleFormChange('name', e.target.value)} /></Field>
          <Alert>{errorMsg}</Alert>
          <div className="pt-4 flex justify-end gap-3">
            <Button variant="ghost" type="button" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
          </div>
        </form>
      );
    }

    if (modalType === 'shades') {
      return (
        <form onSubmit={handleSave} className="space-y-4">
          <Field label="Shade Number"><Input required placeholder="e.g. 101" value={formData.number || ''} onChange={e => handleFormChange('number', e.target.value)} /></Field>
          <Field label="Shade Name (Optional)"><Input placeholder="e.g. Crimson Red" value={formData.name || ''} onChange={e => handleFormChange('name', e.target.value)} /></Field>
          <Field label="Color Swatch (Hex)">
            <div className="flex items-center gap-3">
              <input type="color" value={formData.hex || '#000000'} onChange={e => handleFormChange('hex', e.target.value)} className="w-10 h-10 rounded cursor-pointer" />
              <Input required value={formData.hex || ''} onChange={e => handleFormChange('hex', e.target.value)} />
            </div>
          </Field>
          <Alert>{errorMsg}</Alert>
          <div className="pt-4 flex justify-end gap-3">
            <Button variant="ghost" type="button" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
          </div>
        </form>
      );
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
            <WeaverGroupCard 
              key={group.id} 
              group={group} 
              onEdit={() => handleOpenModal('weaver_groups', group)} 
              onDelete={() => handleDelete('weaver_groups', group.id)}
              onAddFirm={() => handleOpenModal('weavers', null, { group_id: group.id })}
              onEditFirm={(f) => handleOpenModal('weavers', f)}
              onDeleteFirm={(id) => handleDelete('weavers', id)}
            />
          ))}
          {filtered.length === 0 && <Empty title="No party groups found" description="Add a party group (one owner) and then its firms." />}
        </div>
      );
    }

    if (['mills', 'customers'].includes(tab)) {
      const filtered = data.filter(i => i.name.toLowerCase().includes(lSearch) || (i.city || '').toLowerCase().includes(lSearch));
      return (
        <Card>
          <Table>
            <thead>
              <tr><Th>Name</Th><Th>Contact</Th><Th>Phone</Th><Th>City</Th><Th className="w-24 text-right">Actions</Th></tr>
            </thead>
            <tbody>
              {filtered.map(row => (
                <tr key={row.id}>
                  <Td className="font-medium">{row.name}</Td><Td>{row.contact || '-'}</Td><Td>{row.phone || '-'}</Td><Td>{row.city || '-'}</Td>
                  <Td className="text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => handleOpenModal(tab, row)} className="p-1.5 text-slate-400 hover:text-primary-600 rounded-md hover:bg-slate-50"><Edit className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(tab, row.id)} className="p-1.5 text-slate-400 hover:text-red-600 rounded-md hover:bg-slate-50"><Trash2 className="w-4 h-4" /></button>
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

    if (tab === 'qualities') {
      const filtered = data.filter(q => (q.nick_name || '').toLowerCase().includes(lSearch) || (q.original_name || '').toLowerCase().includes(lSearch));
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(q => (
            <Card key={q.id} className="p-4 flex flex-col relative group">
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 bg-white shadow-sm rounded-lg p-1">
                <button onClick={() => handleOpenModal('qualities', q)} className="p-1.5 text-slate-400 hover:text-primary-600 rounded"><Edit className="w-4 h-4" /></button>
                <button onClick={() => handleDelete('qualities', q.id)} className="p-1.5 text-slate-400 hover:text-red-600 rounded"><Trash2 className="w-4 h-4" /></button>
              </div>
              <div className="font-bold text-lg text-slate-900">{q.nick_name} <span className="text-xs font-normal text-slate-400">nickname</span></div>
              <div className="text-sm text-slate-500">{q.original_name} <span className="text-xs text-slate-400">original</span></div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-sm">
                <span className="text-slate-500">Taka Length</span>
                <span className="font-medium text-slate-900">{q.taka_length}m</span>
              </div>
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
            <thead><tr><Th>Branch</Th><Th>City</Th><Th>Address</Th><Th>Phone</Th><Th className="w-24 text-right">Actions</Th></tr></thead>
            <tbody>
              {filtered.map(row => (
                <tr key={row.id}>
                  <Td className="font-medium">{row.name}</Td><Td>{row.city || '-'}</Td><Td>{row.address || '-'}</Td><Td>{row.phone || '-'}</Td>
                  <Td className="text-right">
                    <button onClick={() => handleOpenModal('branches', row)} className="p-1.5 text-slate-400 hover:text-primary-600"><Edit className="w-4 h-4" /></button>
                    <button onClick={() => handleDelete('branches', row.id)} className="p-1.5 text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
          {filtered.length === 0 && <div className="p-8 text-center text-slate-500">No branches yet. Add every place where grey is received.</div>}
        </Card>
      );
    }

    if (tab === 'items') {
      const filtered = data.filter(i => i.code.toLowerCase().includes(lSearch) || (i.nick_name || '').toLowerCase().includes(lSearch) || (i.shade_name || '').toLowerCase().includes(lSearch) || String(i.shade_no || '').toLowerCase().includes(lSearch));
      const chartsForGen = opts.charts;
      return (
        <div className="space-y-4">
          <Card className="p-4 flex flex-col sm:flex-row sm:items-end gap-3 bg-slate-50">
            <div className="flex-1 text-sm text-slate-600">
              <div className="font-medium text-slate-800">Create codes for a whole shade chart</div>
              Every colour of the chart becomes an item of the quality, e.g. <span className="font-mono">GL-37</span>. Existing items are kept.
            </div>
            <Select className="sm:w-48 bg-white" value={genQ} onChange={e => setGenQ(e.target.value)}>
              <option value="">Quality...</option>
              {opts.qualities.map(x => <option key={x.id} value={x.id}>{x.nick_name}</option>)}
            </Select>
            <Select className="sm:w-44 bg-white" value={genChart} onChange={e => setGenChart(e.target.value)}>
              <option value="">Shade chart...</option>
              {chartsForGen.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
            <Button type="button" variant="outline" disabled={!genQ || !genChart} onClick={async () => {
              setPageError('');
              try { const n = await repo.generateItems(Number(genQ), Number(genChart)); setPageError(n ? '' : 'Nothing new — every colour already has an item.'); } catch (err) { setPageError(err.message); }
            }}><Wand2 className="w-4 h-4 mr-2" /> Generate</Button>
          </Card>
          <Card>
            <Table>
              <thead><tr><Th>Code</Th><Th>Quality</Th><Th>Colour</Th><Th>Chart</Th><Th className="w-24 text-right">Actions</Th></tr></thead>
              <tbody>
                {filtered.map(row => (
                  <tr key={row.id}>
                    <Td className="font-mono font-semibold text-slate-900">{row.code}</Td>
                    <Td>{row.nick_name}</Td>
                    <Td>{row.shade_id ? (
                      <span className="inline-flex items-center gap-2"><span className="w-4 h-4 rounded border border-slate-200" style={{ backgroundColor: row.hex }} />{row.shade_no}{row.shade_name ? ` · ${row.shade_name}` : ''}</span>
                    ) : <span className="text-slate-400">grey (no colour)</span>}</Td>
                    <Td>{row.chart_name || '-'}</Td>
                    <Td className="text-right">
                      <button onClick={() => handleOpenModal('items', row)} className="p-1.5 text-slate-400 hover:text-primary-600"><Edit className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete('items', row.id)} className="p-1.5 text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            {filtered.length === 0 && <div className="p-8 text-center text-slate-500">No items yet. Add one, or generate them from a shade chart above.</div>}
          </Card>
        </div>
      );
    }

    if (tab === 'locations') {
      const filtered = data.filter(l => (l.shop || '').toLowerCase().includes(lSearch) || (l.rack || '').toLowerCase().includes(lSearch) || (l.branch_name || '').toLowerCase().includes(lSearch));
      return (
        <Card>
          <Table>
            <thead><tr><Th>Branch</Th><Th>Shop</Th><Th>Rack</Th><Th className="w-24 text-right">Actions</Th></tr></thead>
            <tbody>
              {filtered.map(row => (
                <tr key={row.id}>
                  <Td className="font-medium">{row.branch_name || <span className="text-amber-600">no branch</span>}</Td><Td>{row.shop}</Td><Td>{row.rack}</Td>
                  <Td className="text-right">
                    <button onClick={() => handleOpenModal('locations', row)} className="p-1.5 text-slate-400 hover:text-primary-600"><Edit className="w-4 h-4" /></button>
                    <button onClick={() => handleDelete('locations', row.id)} className="p-1.5 text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      );
    }

    if (tab === 'shades') {
      const { charts, shades } = data;
      return (
        <div className="space-y-6">
          <div className="flex gap-4 overflow-x-auto pb-2">
            {charts.map(c => (
              <div key={c.id} className="flex-shrink-0 flex items-center gap-2 bg-white px-4 py-2 rounded-lg shadow-sm border border-slate-200">
                <span className="font-medium text-slate-900">{c.name}</span>
                <button onClick={() => handleOpenModal('shade_charts', c)} className="text-slate-400 hover:text-primary-600"><Edit className="w-3.5 h-3.5" /></button>
                <button onClick={() => handleDelete('shade_charts', c.id)} className="text-slate-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                <div className="w-px h-4 bg-slate-200 mx-1"></div>
                <button onClick={() => handleOpenModal('shades', null, { chart_id: c.id, hex: '#cccccc' })} className="text-primary-600 hover:text-primary-700 text-sm font-medium flex items-center">
                  <Plus className="w-4 h-4 mr-1" /> Add Shade
                </button>
              </div>
            ))}
          </div>

          {charts.map(chart => {
            const chartShades = shades.filter(s => s.chart_id === chart.id && ((s.number || '').toString().toLowerCase().includes(lSearch) || (s.name || '').toLowerCase().includes(lSearch)));
            if (chartShades.length === 0 && lSearch) return null;
            return (
              <div key={chart.id} className="space-y-3">
                <h3 className="font-semibold text-slate-900 text-sm pl-1">{chart.name} Shades</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {chartShades.map(s => (
                    <div key={s.id} className="bg-white rounded-lg border border-slate-200 p-2 flex items-center gap-3 group relative overflow-hidden">
                      <div className="w-8 h-8 rounded border border-slate-200 flex-shrink-0" style={{ backgroundColor: s.hex || '#ccc' }}></div>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-sm text-slate-900 truncate">{s.number}</div>
                        {s.name && <div className="text-xs text-slate-500 truncate">{s.name}</div>}
                      </div>
                      <div className="absolute inset-y-0 right-0 bg-gradient-to-l from-white via-white to-transparent px-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity translate-x-4 group-hover:translate-x-0">
                        <button onClick={() => handleOpenModal('shades', s)} className="p-1 text-slate-400 hover:text-primary-600"><Edit className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleDelete('shades', s.id)} className="p-1 text-slate-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  ))}
                  {chartShades.length === 0 && <div className="col-span-full text-sm text-slate-500 py-4">No shades added to this chart.</div>}
                </div>
              </div>
            );
          })}
        </div>
      );
    }
  };

  const getAddTitle = () => {
    switch (tab) {
      case 'weavers': return 'Add Party Group';
      case 'mills': return 'Add Mill';
      case 'customers': return 'Add Customer';
      case 'qualities': return 'Add Quality';
      case 'branches': return 'Add Branch';
      case 'locations': return 'Add Rack';
      case 'items': return 'Add Item';
      case 'shades': return 'Add Shade Chart';
      default: return 'Add Item';
    }
  };

  const getModalBaseType = () => {
    if (tab === 'weavers') return 'weaver_groups';
    if (tab === 'shades') return 'shade_charts';
    return tab;
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
        <SearchToggle value={search} onChange={setSearch} placeholder={`Search ${currentTab.label.toLowerCase()}...`} />
        <Button onClick={() => handleOpenModal(getModalBaseType())} className="flex-shrink-0">
          <Plus className="w-4 h-4 mr-2" />
          {getAddTitle()}
        </Button>
      </PageHeader>

      <Alert tone="error">{pageError}</Alert>
      {renderContent()}

      <Modal 
        isOpen={modalOpen} 
        onClose={() => setModalOpen(false)} 
        title={modalType ? `${editItem ? 'Edit' : 'Add'} ${MODAL_TITLES[modalType] || modalType}` : ''}
      >
        {renderModalContent()}
      </Modal>
    </div>
  );
}

function WeaverGroupCard({ group, onEdit, onDelete, onAddFirm, onEditFirm, onDeleteFirm }) {
  const [expanded, setExpanded] = useState(true);
  
  return (
    <Card className="overflow-visible">
      <div className="flex items-center justify-between p-4 bg-slate-50 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <button onClick={() => setExpanded(!expanded)} className="p-1 rounded hover:bg-slate-200 text-slate-500">
            <ChevronRight className={`w-5 h-5 transition-transform ${expanded ? 'rotate-90' : ''}`} />
          </button>
          <div>
            <div className="font-semibold text-slate-900 text-base">{group.name}</div>
            <div className="text-xs text-slate-500 flex gap-2">
              <span>{group.city || 'No city'}</span> • <span>{group.firms.length} parties</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onAddFirm}><Plus className="w-4 h-4 mr-1" /> Add Party</Button>
          <div className="w-px h-4 bg-slate-300 mx-1"></div>
          <button onClick={onEdit} className="p-1.5 text-slate-400 hover:text-primary-600 rounded hover:bg-white"><Edit className="w-4 h-4" /></button>
          <button onClick={onDelete} className="p-1.5 text-slate-400 hover:text-red-600 rounded hover:bg-white"><Trash2 className="w-4 h-4" /></button>
        </div>
      </div>
      
      {expanded && (
        <div className="p-0">
          <Table>
            <thead><tr><Th className="pl-14">Party</Th><Th>GSTIN</Th><Th>Phone</Th><Th className="w-24 text-right">Actions</Th></tr></thead>
            <tbody>
              {group.firms.map(f => (
                <tr key={f.id}>
                  <Td className="pl-14 font-medium">{f.name}</Td><Td>{f.gstin || '-'}</Td><Td>{f.phone || '-'}</Td>
                  <Td className="text-right">
                    <button onClick={() => onEditFirm(f)} className="p-1.5 text-slate-400 hover:text-primary-600"><Edit className="w-4 h-4" /></button>
                    <button onClick={() => onDeleteFirm(f.id)} className="p-1.5 text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                  </Td>
                </tr>
              ))}
              {group.firms.length === 0 && (
                <tr>
                  <Td colSpan={4} className="text-center py-6 text-slate-500">No parties added yet.</Td>
                </tr>
              )}
            </tbody>
          </Table>
        </div>
      )}
    </Card>
  );
}
