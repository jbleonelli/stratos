// Query hooks for the Innovate marketplace's Adaptiv first-party catalog.
import { useQuery } from '@tanstack/react-query';
import { sb } from '../db-client';

const KIND_TO_ICON: Record<string, string> = {
  display_touch: 'display',
  display_eink: 'display',
  display_sdg: 'display',
  airq: 'air',
  occupancy: 'people',
  pc_counter: 'people',
  camera: 'beacon',
  badge: 'badge',
  leak: 'droplet',
  beacon: 'beacon',
};

// Active Adaptiv device SKUs, shaped into the catalog card view-model.
export function useDeviceSkus() {
  return useQuery({
    queryKey: ['device-skus'],
    queryFn: async () => {
      const { data, error } = await sb
        .from('device_skus')
        .select('id, name, family, kind, description, short_description, manufacturer')
        .eq('active', true)
        .order('family')
        .order('name');
      if (error) return [];
      return (data || []).map((r) => ({
        id: r.id,
        name: r.name,
        sku: r.id,
        family: r.family,
        kind: r.kind,
        icon: KIND_TO_ICON[r.kind] || 'sparkle',
        desc: r.description || r.short_description || '',
        manufacturer: r.manufacturer || 'Adaptiv Systems',
      }));
    },
  });
}
