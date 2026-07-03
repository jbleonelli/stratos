import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLocations } from '../queries/useData';
import type { Location } from '../api/types';

interface BuildingContextValue {
  locations: Location[];
  selectedLocationId: string | null;
  selectedLocation: Location | null;
  setSelectedLocationId: (id: string | null) => void;
  multiLocation: boolean;
}

const BuildingContext = createContext<BuildingContextValue | null>(null);

const STORAGE_KEY = 'stratosSelectedLocation';

export function BuildingProvider({ children }: { children: ReactNode }) {
  const { data: locations = [] } = useLocations();
  const [selectedLocationId, setSelectedLocationIdState] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (selectedLocationId && locations.some((l) => l.id === selectedLocationId)) return;
    if (locations.length > 0) setSelectedLocationIdState(locations[0].id);
  }, [locations, selectedLocationId]);

  const setSelectedLocationId = (id: string | null) => {
    setSelectedLocationIdState(id);
    try {
      if (id) localStorage.setItem(STORAGE_KEY, id);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  };

  const selectedLocation = useMemo(
    () => locations.find((l) => l.id === selectedLocationId) ?? null,
    [locations, selectedLocationId],
  );

  const value = useMemo(
    () => ({
      locations,
      selectedLocationId,
      selectedLocation,
      setSelectedLocationId,
      multiLocation: locations.length > 1,
    }),
    [locations, selectedLocationId, selectedLocation],
  );

  return <BuildingContext.Provider value={value}>{children}</BuildingContext.Provider>;
}

export function useBuilding() {
  const ctx = useContext(BuildingContext);
  if (!ctx) throw new Error('useBuilding must be used within BuildingProvider');
  return ctx;
}
