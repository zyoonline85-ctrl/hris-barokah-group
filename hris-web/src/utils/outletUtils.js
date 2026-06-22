/**
 * Centralized utility to fetch live outlet names.
 * Reads directly from localStorage key 'outlet_cabang_data' (canonical source).
 * Returns an array of uppercase 'nama_tablet' strings (NAMA OUTLET + WILAYAH).
 * No mock/fake data fallback.
 */
export const getLiveOutletList = () => {
  try {
    const raw = localStorage.getItem('outlet_cabang_data');
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.length > 0) {
        return arr
          .map(o => o.nama_tablet || `${(o.nama || '').trim()} ${(o.wilayah || '').trim()}`.trim().toUpperCase())
          .filter(Boolean);
      }
    }
  } catch (e) {
    console.error('Error parsing outlet_cabang_data:', e);
  }
  return [];
};
