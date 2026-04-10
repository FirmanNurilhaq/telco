import React, { useEffect, useState, useCallback, lazy, Suspense, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Cell,
} from 'recharts';
import KpiCard from './components/KpiCard';
import Spinner from './components/Spinner';
import DataTable from './components/DataTable';
import FilterBar from './components/FilterBar';
import AutoInsights from './components/AutoInsights';
import { SkeletonCard, SkeletonChart } from './components/Skeleton';
import { useFilters } from './hooks/useFilters';
import { useAggregations } from './hooks/useAggregations';
import { fetchSummary, fetchRaw, fetchMap, fetchMapPoints, fetchAutoInsights } from './services/api';
import { LABELS, STATUS_ID } from './constants/labels';

const SiteMap   = lazy(() => import('./components/SiteMap'));
const RegionMap = lazy(() => import('./components/RegionMap'));

const COLORS = { completed:'#22c55e', on_progress:'#3b82f6', delayed:'#ef4444', not_started:'#6b7280' };
const TABS = [
  { id:'ikhtisar', label:LABELS.ikhtisar },
  { id:'performa', label:LABELS.performa },
  { id:'kendala',  label:LABELS.kendala  },
  { id:'peta',     label:LABELS.peta     },
];
const FB_REGION   = [{ region:LABELS.tidakAdaData, completed:0, on_progress:0, delayed:0, not_started:1, total:1 }];
const FB_VENDOR   = [{ vendor:LABELS.tidakAdaData, completed:0, on_progress:0, delayed:0, total:1 }];
const FB_DELAY    = [{ reason:LABELS.tidakAdaData, count:0 }];
const FB_DIST     = ['0-10%','10-20%','20-30%','30-40%','40-50%','50-60%','60-70%','70-80%','80-90%','90-99%','100%']
                    .map(l => ({ label:l, count:0, pct:0 }));
const FB_PIC      = [{ pic:LABELS.tidakAdaData, total:0, completed:0, on_progress:0 }];
const FB_TIMELINE = [{ month:'--', planned:0, actual:0 }];
const CS = { background:'#1f2937', border:'none', fontSize:12, borderRadius:6 };
const AT = { fill:'#9ca3af', fontSize:10 };
const GS = '#374151';


function ChartCard({ title, desc, children, className='' }) {
  return (
    <div className={`bg-gray-800 rounded-xl p-4 shadow ${className}`}>
      <p className="text-sm font-semibold text-gray-200 mb-0.5">{title}</p>
      {desc && <p className="text-xs text-gray-500 mb-3">{desc}</p>}
      {!desc && <div className="mb-3" />}
      {children}
    </div>
  );
}
function TabButton({ label, active, onClick }) {
  return (
    <button onClick={onClick}
      className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap
        ${active ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}>
      {label}
    </button>
  );
}
function EmptyState({ message }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-gray-600">
      <p className="text-sm">{message || LABELS.tidakAdaData}</p>
    </div>
  );
}
function DistTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-xs">
      <p className="text-gray-300 font-semibold mb-1">{label}</p>
      <p className="text-purple-400">{d.count} site ({d.pct}%)</p>
    </div>
  );
}


export default function Dashboard() {
  const [raw,setRaw]=useState([]);
  const [summaryData,setSummaryData]=useState(null);
  const [mapRegions,setMapRegions]=useState([]);
  const [mapPoints,setMapPoints]=useState([]);
  const [autoInsights,setAutoInsights]=useState([]);
  const [lastUpdated,setLastUpdated]=useState(null);
  const [error,setError]=useState(null);
  const [loading,setLoading]=useState(true);
  const [activeTab,setActiveTab]=useState(0);

  const loadAll = useCallback(async () => {
    try {
      const [rawRes,mapRes,ptsRes,insRes,sumRes] = await Promise.all([
        fetchRaw(),fetchMap(),fetchMapPoints(),fetchAutoInsights(),fetchSummary(),
      ]);
      setRaw(rawRes.data||[]);
      setMapRegions(mapRes.data||[]);
      setMapPoints(ptsRes.data||[]);
      setAutoInsights(insRes.data||[]);
      setSummaryData(sumRes.data||null);
      setLastUpdated(rawRes.lastUpdated);
      setError(null);
    } catch(e) { setError(e.message||'Gagal memuat data'); }
    finally { setLoading(false); }
  },[]);

  useEffect(()=>{ loadAll(); const t=setInterval(loadAll,10000); return ()=>clearInterval(t); },[loadAll]);

  const {filters,setFilter,filteredRows,regionOptions,vendorOptions}=useFilters(raw);
  const agg=useAggregations(filteredRows);

  const filteredPoints=useMemo(()=>mapPoints.filter(pt=>{
    if(pt.lat>6||pt.lat<-11||pt.lng<95||pt.lng>141) return false;
    if(filters.region!=='all'&&pt.region!==filters.region) return false;
    if(filters.vendor!=='all'&&pt.vendor!==filters.vendor) return false;
    if(filters.status!=='all'&&pt.status!==filters.status) return false;
    return true;
  }),[mapPoints,filters]);

  const filterByStatus=useCallback(st=>setFilter(f=>({...f,status:f.status===st?'all':st})),[setFilter]);
  const filterByRegion=useCallback(r=>setFilter(f=>({...f,region:f.region===r?'all':r})),[setFilter]);
  const filterByVendor=useCallback(v=>setFilter(f=>({...f,vendor:f.vendor===v?'all':v})),[setFilter]);

  if(loading) return (
    <div className="min-h-screen bg-gray-950 p-6">
      <div className="max-w-screen-2xl mx-auto">
        <div className="h-8 bg-gray-800 rounded w-64 mb-6 animate-pulse"/>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-4 mb-4">
          {Array.from({length:7}).map((_,i)=><SkeletonCard key={i}/>)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SkeletonChart height={300}/><SkeletonChart height={300}/>
        </div>
      </div>
    </div>
  );

  if(error) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center flex-col gap-2">
      <span className="text-red-400 text-sm">{error}</span>
      <button onClick={loadAll} className="mt-2 text-xs text-blue-400 hover:text-blue-300">{LABELS.cobLagi}</button>
    </div>
  );

  const hasActiveFilter=Object.entries(filters).some(([k,v])=>k!=='search'?(v&&v!=='all'):!!v);
  const s=hasActiveFilter?agg?.summary:(summaryData||agg?.summary);
  const byRegion=agg?.by_region?.length?agg.by_region:FB_REGION;
  const timeline=agg?.plan_vs_actual?.length?agg.plan_vs_actual:FB_TIMELINE;
  const dist=agg?.distribution?.some(b=>b.count>0)?agg.distribution:FB_DIST;
  const vendors=agg?.vendor_performance?.length?agg.vendor_performance:FB_VENDOR;
  const delayKw=agg?.delay_by_keyword?.length?agg.delay_by_keyword:FB_DELAY;
  const pics=agg?.workload_per_pic?.length?agg.workload_per_pic:FB_PIC;


  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Bilah atas */}
      <div className="sticky top-0 z-50 bg-gray-900/95 backdrop-blur border-b border-gray-800 px-4 sm:px-6 py-3">
        <div className="max-w-screen-2xl mx-auto flex items-center justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <p className="text-sm sm:text-base font-bold text-white leading-tight truncate">Telkomsel NW RF National Tracker</p>
            <p className="text-xs text-gray-500">{LABELS.pemantauan}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex gap-1 bg-gray-800 rounded-lg p-1 overflow-x-auto">
              {TABS.map((t,i)=><TabButton key={t.id} label={t.label} active={activeTab===i} onClick={()=>setActiveTab(i)}/>)}
            </div>
            <span className="text-xs text-gray-600 hidden sm:block">
              {lastUpdated?new Date(lastUpdated).toLocaleTimeString('id-ID'):'--'}
            </span>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-6 max-w-screen-2xl mx-auto">
        <FilterBar filters={filters} onChange={setFilter} regions={regionOptions} vendors={vendorOptions}/>

        {/* Kartu KPI */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 mb-4">
          <KpiCard label={LABELS.totalSite}      value={s?.total_sites}/>
          <KpiCard label={LABELS.selesai}        value={s?.completed}   color="text-green-400"
            onClick={()=>filterByStatus('completed')}   active={filters.status==='completed'}/>
          <KpiCard label={LABELS.dalamProses}    value={s?.on_progress} color="text-blue-400"
            onClick={()=>filterByStatus('on_progress')} active={filters.status==='on_progress'}/>
          <KpiCard label={LABELS.tertunda}       value={s?.delayed}     color="text-red-400"
            onClick={()=>filterByStatus('delayed')}     active={filters.status==='delayed'}/>
          <KpiCard label={LABELS.belumMulai}     value={s?.not_started} color="text-gray-400"
            onClick={()=>filterByStatus('not_started')} active={filters.status==='not_started'}/>
          <KpiCard label={LABELS.melewatiJadwal} value={s?.overdue}     color="text-orange-400" sub={LABELS.lewatTanggal}/>
          <KpiCard label={LABELS.tingkatSelesai}
            value={s?.completion_rate!=null?`${s.completion_rate}%`:null} color="text-yellow-400"/>
        </div>

        {/* Banner validasi */}
        {s&&(
          <div className={`rounded-lg px-4 py-2 mb-4 text-xs flex items-center gap-3 flex-wrap ${
            s.data_valid===false?'bg-red-900/40 text-red-300 border border-red-700'
            :s.data_valid===true?'bg-green-900/30 text-green-400 border border-green-800'
            :'bg-gray-800 text-gray-500'}`}>
            <span className="font-bold shrink-0">
              {s.data_valid===false?`X ${LABELS.tidakValid}`:s.data_valid===true?`V ${LABELS.valid}`:'O'}
            </span>
            <span>
              {s.data_valid===false
                ?(s.validation_errors||[]).join(' | ')
                :`${s._debug?.total_status_check??'?'} / ${s.total_sites} ${LABELS.siteRekonsiliasi}`}
            </span>
            {s.data_health?.confidence_avg!=null&&(
              <span className="text-gray-500">{LABELS.kepercayaan}: {s.data_health.confidence_avg}</span>
            )}
          </div>
        )}


        {/* HALAMAN 1 - IKHTISAR */}
        {activeTab===0&&(
          <>
            <AutoInsights insights={autoInsights}/>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
              <ChartCard title={LABELS.progresPerRegional} desc={LABELS.descProgresRegional}>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={byRegion} margin={{top:0,right:10,left:-10,bottom:70}}>
                    <CartesianGrid strokeDasharray="3 3" stroke={GS}/>
                    <XAxis dataKey="region" tick={AT} angle={-40} textAnchor="end" interval={0}/>
                    <YAxis tick={AT}/>
                    <Tooltip contentStyle={CS} formatter={(v,n)=>[v,STATUS_ID[n]||n]}/>
                    <Legend wrapperStyle={{fontSize:11}} formatter={n=>STATUS_ID[n]||n}/>
                    <Bar dataKey="completed"   stackId="a" fill={COLORS.completed}   name="completed"   onClick={d=>filterByRegion(d.region)} style={{cursor:'pointer'}}/>
                    <Bar dataKey="on_progress" stackId="a" fill={COLORS.on_progress} name="on_progress" onClick={d=>filterByRegion(d.region)} style={{cursor:'pointer'}}/>
                    <Bar dataKey="delayed"     stackId="a" fill={COLORS.delayed}     name="delayed"     onClick={d=>filterByRegion(d.region)} style={{cursor:'pointer'}}/>
                    <Bar dataKey="not_started" stackId="a" fill={COLORS.not_started} name="not_started" onClick={d=>filterByRegion(d.region)} style={{cursor:'pointer'}}/>
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
              <ChartCard title={LABELS.rencanaVsRealisasi} desc={LABELS.descRencanaRealisasi}>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={timeline} margin={{top:0,right:10,left:-10,bottom:70}}>
                    <CartesianGrid strokeDasharray="3 3" stroke={GS}/>
                    <XAxis dataKey="month" tick={AT} angle={-40} textAnchor="end" interval={0}/>
                    <YAxis tick={AT}/>
                    <Tooltip contentStyle={CS}/>
                    <Legend wrapperStyle={{fontSize:11}} formatter={n=>n==='planned'?LABELS.rencana:LABELS.realisasi}/>
                    <Line type="monotone" dataKey="planned" stroke="#3b82f6" strokeWidth={2} dot={false} name="planned"/>
                    <Line type="monotone" dataKey="actual"  stroke="#22c55e" strokeWidth={2} dot={false} name="actual"/>
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>
          </>
        )}

        {/* HALAMAN 2 - PERFORMA */}
        {activeTab===1&&(
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
              <ChartCard title={LABELS.performaVendor} desc={LABELS.descVendor}>
                <div className="overflow-x-auto">
                  <ResponsiveContainer width="100%" height={320} minWidth={300}>
                    <BarChart data={vendors} layout="vertical" margin={{top:0,right:40,left:110,bottom:0}}>
                      <CartesianGrid strokeDasharray="3 3" stroke={GS}/>
                      <XAxis type="number" tick={AT}/>
                      <YAxis dataKey="vendor" type="category" tick={AT} width={110}/>
                      <Tooltip contentStyle={CS} formatter={(v,n)=>[v,STATUS_ID[n]||n]}/>
                      <Legend wrapperStyle={{fontSize:11}} formatter={n=>STATUS_ID[n]||n}/>
                      <Bar dataKey="completed"   fill={COLORS.completed}   name="completed"   onClick={d=>filterByVendor(d.vendor)} style={{cursor:'pointer'}}/>
                      <Bar dataKey="on_progress" fill={COLORS.on_progress} name="on_progress" onClick={d=>filterByVendor(d.vendor)} style={{cursor:'pointer'}}/>
                      <Bar dataKey="delayed"     fill={COLORS.delayed}     name="delayed"     onClick={d=>filterByVendor(d.vendor)} style={{cursor:'pointer'}}/>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>
              <ChartCard title={LABELS.bebanKerjaPIC} desc={LABELS.descPIC}>
                <div className="overflow-x-auto">
                  <ResponsiveContainer width="100%" height={320} minWidth={300}>
                    <BarChart data={pics.slice(0,15)} layout="vertical" margin={{top:0,right:30,left:110,bottom:0}}>
                      <CartesianGrid strokeDasharray="3 3" stroke={GS}/>
                      <XAxis type="number" tick={AT}/>
                      <YAxis dataKey="pic" type="category" tick={AT} width={110}/>
                      <Tooltip contentStyle={CS} formatter={(v,n)=>[v,STATUS_ID[n]||LABELS[n]||n]}/>
                      <Legend wrapperStyle={{fontSize:11}} formatter={n=>STATUS_ID[n]||LABELS[n]||n}/>
                      <Bar dataKey="total"       fill="#6366f1"           name="total"/>
                      <Bar dataKey="completed"   fill={COLORS.completed}   name="completed"/>
                      <Bar dataKey="on_progress" fill={COLORS.on_progress} name="on_progress"/>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>
            </div>
            <ChartCard title={LABELS.distribusiProgres} desc={LABELS.descDistribusi}>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={dist} margin={{top:10,right:20,left:-10,bottom:0}}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GS}/>
                  <XAxis dataKey="label" tick={{...AT,fontSize:11}}/>
                  <YAxis tick={AT}/>
                  <Tooltip content={<DistTooltip/>}/>
                  <Bar dataKey="count" name="Jumlah Site" radius={[4,4,0,0]}>
                    {dist.map((e,i)=>(
                      <Cell key={i} fill={
                        e.label==='100%'?COLORS.completed:
                        e.label.startsWith('90')||e.label.startsWith('80')?'#22c55e':
                        e.label.startsWith('70')||e.label.startsWith('60')?'#3b82f6':
                        e.label.startsWith('50')||e.label.startsWith('40')?'#8b5cf6':
                        e.label.startsWith('30')?'#f59e0b':
                        '#ef4444'
                      }/>
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </>
        )}

        {/* HALAMAN 3 - KENDALA */}
        {activeTab===2&&(
          <>
            <ChartCard title={LABELS.penyebabKeterlambatan} desc={LABELS.descKeterlambatan} className="mb-4">
              <div className="overflow-x-auto">
                <ResponsiveContainer width="100%" height={280} minWidth={300}>
                  <BarChart data={delayKw} layout="vertical" margin={{top:0,right:40,left:130,bottom:0}}>
                    <CartesianGrid strokeDasharray="3 3" stroke={GS}/>
                    <XAxis type="number" tick={AT}/>
                    <YAxis dataKey="reason" type="category" tick={AT} width={130}/>
                    <Tooltip contentStyle={CS}/>
                    <Bar dataKey="count" fill="#f59e0b" name="Jumlah Site" radius={[0,4,4,0]}/>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>
            <div>
              <p className="text-sm font-semibold text-gray-300 mb-2">
                Data Site &mdash; {filteredRows.length} {LABELS.baris}
                {hasActiveFilter&&<span className="text-xs text-blue-400 ml-2">{LABELS.difilter}</span>}
              </p>
              {filteredRows.length===0
                ?<EmptyState message={LABELS.tidakAdaFilter}/>
                :<DataTable rows={filteredRows}/>}
            </div>
          </>
        )}


        {/* HALAMAN 4 - PETA — vertikal penuh, TIDAK berdampingan */}
        {activeTab===3&&(
          <div className="flex flex-col gap-6">

            {/* Peta Site — lebar penuh */}
            <div className="bg-gray-800 rounded-xl p-4 shadow w-full">
              <p className="text-sm font-semibold text-gray-200 mb-0.5">{LABELS.petaSite}</p>
              <p className="text-xs text-gray-500 mb-3">{LABELS.descPetaSite}</p>
              <div className="w-full h-[400px] md:h-[550px]">
                <Suspense fallback={
                  <div className="w-full h-full flex items-center justify-center bg-gray-700 rounded-lg">
                    <Spinner/>
                  </div>
                }>
                  <SiteMap points={filteredPoints} filters={filters} height={550}/>
                </Suspense>
              </div>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className="text-xs text-gray-600">{filteredPoints.length} {LABELS.siteDitampilkan}</span>
                {hasActiveFilter&&<span className="text-xs text-blue-400">{LABELS.difilter}</span>}
              </div>
            </div>

            {/* Peta Regional — lebar penuh */}
            <div className="bg-gray-800 rounded-xl p-4 shadow w-full">
              <p className="text-sm font-semibold text-gray-200 mb-0.5">{LABELS.petaRegion}</p>
              <p className="text-xs text-gray-500 mb-3">{LABELS.descPetaRegion}</p>
              <div className="w-full h-[400px] md:h-[550px]">
                <Suspense fallback={
                  <div className="w-full h-full flex items-center justify-center bg-gray-700 rounded-lg">
                    <Spinner/>
                  </div>
                }>
                  <RegionMap regions={mapRegions} height={550}/>
                </Suspense>
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
