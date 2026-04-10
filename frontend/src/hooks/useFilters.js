import { useState, useMemo, useCallback, useEffect, useRef } from 'react';

const DEFAULT_FILTERS = { region: 'all', vendor: 'all', status: 'all', dateFrom: '', dateTo: '', search: '' };

export function useFilters(rawRows = []) {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const timerRef = useRef(null);

  // Debounce search input only
  useEffect(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setDebouncedSearch(filters.search), 300);
    return () => clearTimeout(timerRef.current);
  }, [filters.search]);

  const setFilter = useCallback((next) => setFilters(next), []);

  const filteredRows = useMemo(() => {
    const q = debouncedSearch.toLowerCase().trim();
    return rawRows.filter(row => {
      if (filters.region !== 'all' && row._region !== filters.region) return false;
      if (filters.vendor !== 'all' && row._vendor !== filters.vendor) return false;
      if (filters.status !== 'all' && row._status !== filters.status) return false;
      if (filters.dateFrom && row._plan_date && row._plan_date < filters.dateFrom) return false;
      if (filters.dateTo   && row._plan_date && row._plan_date > filters.dateTo)   return false;
      if (q) {
        const siteId  = typeof row.site_id === 'string' ? row.site_id.toLowerCase() : '';
        const region  = (row._region  || '').toLowerCase();
        const vendor  = (row._vendor  || '').toLowerCase();
        const pic     = (row._pic     || '').toLowerCase();
        if (!siteId.includes(q) && !region.includes(q) && !vendor.includes(q) && !pic.includes(q)) return false;
      }
      return true;
    });
  }, [rawRows, filters.region, filters.vendor, filters.status, filters.dateFrom, filters.dateTo, debouncedSearch]);

  const regionOptions = useMemo(() => {
    const s = new Set(rawRows.map(r => r._region).filter(Boolean));
    return [...s].sort();
  }, [rawRows]);

  const vendorOptions = useMemo(() => {
    const s = new Set(rawRows.map(r => r._vendor).filter(v => v && v !== 'Unknown Vendor'));
    return [...s].sort();
  }, [rawRows]);

  return { filters, setFilter, filteredRows, regionOptions, vendorOptions };
}
