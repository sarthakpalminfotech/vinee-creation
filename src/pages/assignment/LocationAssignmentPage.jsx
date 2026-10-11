import React, { useState, useEffect, useMemo } from 'react';
import { PageHeader, Card, Button, Table, Th, Td, Select, Badge, Empty } from '../../components/ui';
import { MapPin, Search, CheckCircle } from 'lucide-react';
import * as repo from '../../db/repo';

export default function LocationAssignmentPage() {
  const [loading, setLoading] = useState(true);
  const [takas, setTakas] = useState([]);
  const [locations, setLocations] = useState([]);
  
  const [qualityFilter, setQualityFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('UNASSIGNED'); // 'ALL', 'UNASSIGNED', or specific location ID
  
  const [targetLocationId, setTargetLocationId] = useState('');
  
  async function load() {
    try {
      const [allTakas, allLocs] = await Promise.all([
        repo.listTakas("WHERE t.status='FOLDED'"),
        repo.listLocations()
      ]);
      setLocations(allLocs);
      
      // Sort takas by quality, shade, then ID
      allTakas.sort((a, b) => {
        const q = (a.quality_name || '').localeCompare(b.quality_name || '');
        if (q !== 0) return q;
        const s = (a.shade_no || '').localeCompare(b.shade_no || '');
        if (s !== 0) return s;
        return (a.id || '').toString().localeCompare((b.id || '').toString());
      });

      setTakas(allTakas.map(t => ({ ...t, selected: false })));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const qualities = useMemo(() => {
    const qs = new Map();
    takas.forEach(t => qs.set(t.quality_id, t.quality_name));
    return Array.from(qs.entries()).map(([id, name]) => ({ id, name }));
  }, [takas]);

  const filteredTakas = useMemo(() => {
    return takas.filter(t => {
      if (qualityFilter && t.quality_id.toString() !== qualityFilter) return false;
      if (locationFilter === 'UNASSIGNED') {
        if (t.location_id) return false;
      } else if (locationFilter !== 'ALL') {
        if (t.location_id?.toString() !== locationFilter) return false;
      }
      return true;
    });
  }, [takas, qualityFilter, locationFilter]);

  const toggleRow = (id) => {
    setTakas(takas.map(t => t.id === id ? { ...t, selected: !t.selected } : t));
  };

  const selectAll = () => {
    const ids = new Set(filteredTakas.map(t => t.id));
    setTakas(takas.map(t => ids.has(t.id) ? { ...t, selected: true } : t));
  };

  const clearSelection = () => {
    setTakas(takas.map(t => ({ ...t, selected: false })));
  };

  const selectedCount = takas.filter(t => t.selected).length;

  const handleAssign = async () => {
    if (!targetLocationId) return alert('Please select a target location');
    const selectedIds = takas.filter(t => t.selected).map(t => t.id);
    if (!selectedIds.length) return alert('Please select at least one taka');

    try {
      await repo.assignLocation(selectedIds, targetLocationId);
      setTargetLocationId('');
      await load();
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading) return <div className="p-12 text-center text-slate-500">Loading...</div>;

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Location Assignment" 
        description="Assign Folded (Ready) Takas to specific Godowns or Racks."
      >
        <div className="flex gap-4 items-center bg-white p-2 pl-4 rounded-xl shadow-sm border border-slate-200">
          <span className="text-sm font-medium text-slate-500 whitespace-nowrap">Assign Selected To:</span>
          <div className="w-64">
            <Select value={targetLocationId} onChange={e => setTargetLocationId(e.target.value)}>
              <option value="">Select Rack/Godown...</option>
              {locations.map(l => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </Select>
          </div>
          <Button onClick={handleAssign} disabled={!targetLocationId || selectedCount === 0} className="shadow-md">
            <CheckCircle className="w-4 h-4 mr-2" />
            Apply ({selectedCount})
          </Button>
        </div>
      </PageHeader>

      <Card>
        <div className="p-4 border-b border-slate-100 flex flex-wrap gap-4 items-center bg-slate-50/50 rounded-t-xl">
          <div className="flex items-center gap-2">
            <Search className="w-5 h-5 text-slate-400" />
            <Select 
              className="w-48"
              value={qualityFilter} onChange={e => setQualityFilter(e.target.value)}
            >
              <option value="">All Qualities</option>
              {qualities.map(q => <option key={q.id} value={q.id}>{q.name}</option>)}
            </Select>
          </div>
          
          <div className="h-4 w-px bg-slate-200" />
          
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-slate-400" />
            <Select 
              className="w-48"
              value={locationFilter} onChange={e => setLocationFilter(e.target.value)}
            >
              <option value="ALL">All Locations</option>
              <option value="UNASSIGNED">Unassigned Only</option>
              {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </Select>
          </div>

          <div className="flex-1 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={selectAll}>Select All Shown</Button>
            <Button variant="ghost" size="sm" onClick={clearSelection}>Clear Selection</Button>
          </div>
        </div>

        {filteredTakas.length === 0 ? (
          <Empty title="No Takas Found" subtitle="No folded takas match your current filters." icon={MapPin} />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <thead>
                <tr>
                  <Th className="w-12">
                    <input 
                      type="checkbox" 
                      className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                      checked={filteredTakas.length > 0 && filteredTakas.every(t => t.selected)}
                      onChange={(e) => e.target.checked ? selectAll() : clearSelection()}
                    />
                  </Th>
                  <Th>Taka Details</Th>
                  <Th>Quality / Shade</Th>
                  <Th className="text-right">Meters</Th>
                  <Th>Current Location</Th>
                </tr>
              </thead>
              <tbody>
                {filteredTakas.map(t => (
                  <tr key={t.id} className={`hover:bg-slate-50 cursor-pointer transition-colors ${t.selected ? 'bg-primary-50/50 hover:bg-primary-50/80' : ''}`} onClick={() => toggleRow(t.id)}>
                    <Td onClick={e => e.stopPropagation()}>
                      <input 
                        type="checkbox" 
                        className="rounded border-slate-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
                        checked={t.selected}
                        onChange={() => toggleRow(t.id)}
                      />
                    </Td>
                    <Td>
                      <div className="font-medium text-slate-900">{t.taka_no || t.id}</div>
                    </Td>
                    <Td>
                      <div className="font-medium text-slate-900">{t.quality_name}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="w-3 h-3 rounded-full shadow-sm border border-slate-200" style={{ backgroundColor: t.shade_hex || '#e2e8f0' }} />
                        <span className="text-sm text-slate-600">{t.shade_no || 'Unshaded'}</span>
                      </div>
                    </Td>
                    <Td className="text-right">
                      <div className="font-medium text-slate-900">{t.folded_meter || t.finished_meter}</div>
                      <div className="text-xs text-slate-500 mt-1">Folded</div>
                    </Td>
                    <Td>
                      {t.location_name ? (
                        <Badge variant="outline" className="bg-white">
                          <MapPin className="w-3 h-3 mr-1 text-slate-400" />
                          {t.location_name}
                        </Badge>
                      ) : (
                        <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded-full border border-amber-200">
                          Unassigned
                        </span>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}
