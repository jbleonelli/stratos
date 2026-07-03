// Static innovate marketplace data (Merlin snapshot 659d224 subset).

export type VendorStatus = 'available' | 'beta' | 'coming-soon';
export type DeployType = 'sensor' | 'hardware' | 'service' | 'software';

export interface Vendor {
  id: string;
  name: string;
  desc: string;
  categoryId: string;
  region: string;
  status: VendorStatus;
  deployType: DeployType;
  featured?: boolean;
}

export interface CatalogSku {
  id: string;
  name: string;
  desc: string;
  deployType: DeployType;
  uplink?: string;
  power?: string;
}

export const VENDOR_CATEGORIES = [
  { id: 'wellbeing', label: 'Wellbeing' },
  { id: 'energy', label: 'Energy' },
  { id: 'safety', label: 'Safety' },
  { id: 'compliance', label: 'Compliance' },
  { id: 'operations', label: 'Operations' },
  { id: 'financial', label: 'Financial' },
] as const;

export const VENDORS: Vendor[] = [
  { id: 'awair', name: 'Awair', desc: 'Indoor air quality monitors and analytics.', categoryId: 'wellbeing', region: 'global', status: 'available', deployType: 'sensor', featured: true },
  { id: 'verdigris', name: 'Verdigris', desc: 'AI-powered energy intelligence for buildings.', categoryId: 'energy', region: 'us', status: 'available', deployType: 'sensor', featured: true },
  { id: 'kisi', name: 'Kisi', desc: 'Cloud access control integrated with occupancy.', categoryId: 'safety', region: 'global', status: 'available', deployType: 'software' },
  { id: 'planon', name: 'Planon', desc: 'IWMS and compliance workflows.', categoryId: 'compliance', region: 'eu', status: 'beta', deployType: 'software' },
  { id: 'swift-hvac', name: 'Swift HVAC', desc: 'Contractor servicing and SLA tracking.', categoryId: 'operations', region: 'us', status: 'available', deployType: 'service' },
  { id: 'gridium', name: 'Gridium', desc: 'Utility bill analytics and cost forecasting.', categoryId: 'financial', region: 'us', status: 'available', deployType: 'software' },
  { id: 'uplight', name: 'Uplight', desc: 'Demand response and load flexibility.', categoryId: 'energy', region: 'us', status: 'beta', deployType: 'service' },
  { id: 'density', name: 'Density', desc: 'Occupancy and space utilization.', categoryId: 'wellbeing', region: 'global', status: 'available', deployType: 'sensor' },
  { id: 'butlr', name: 'Butlr', desc: 'Privacy-preserving occupancy heatmaps.', categoryId: 'wellbeing', region: 'global', status: 'beta', deployType: 'sensor' },
  { id: 'genetec', name: 'Genetec', desc: 'Video and security operations center.', categoryId: 'safety', region: 'global', status: 'available', deployType: 'hardware' },
  { id: 'facilio', name: 'Facilio', desc: 'Connected CMMS and work-order orchestration.', categoryId: 'operations', region: 'global', status: 'available', deployType: 'software' },
  { id: 'nexthink', name: 'Nexthink', desc: 'Digital employee experience signals.', categoryId: 'wellbeing', region: 'eu', status: 'coming-soon', deployType: 'software' },
];

export const ADAPTIV_CATALOG: CatalogSku[] = [
  { id: 'thermostat', name: 'Adaptiv Thermostat', desc: 'Zone comfort control with Merlin setpoint automation.', deployType: 'hardware', uplink: 'LoRa / BACnet', power: '24VAC' },
  { id: 'gateway', name: 'Adaptiv Edge Gateway', desc: 'Secure device ingress for multi-protocol sensors.', deployType: 'hardware', uplink: 'Ethernet / LTE', power: 'PoE' },
  { id: 'airq', name: 'Adaptiv Air Quality Node', desc: 'CO₂, PM2.5, and VOC sensing for wellbeing insights.', deployType: 'sensor', uplink: 'LoRa', power: 'Battery 3y' },
  { id: 'occupancy', name: 'Adaptiv Occupancy Puck', desc: 'Room-level presence for space optimization.', deployType: 'sensor', uplink: 'LoRa', power: 'Battery 5y' },
  { id: 'meter', name: 'Adaptiv Energy Meter', desc: 'Sub-metering for savings and carbon reporting.', deployType: 'sensor', uplink: 'Modbus', power: 'Mains' },
];

export function statusTone(status: VendorStatus): 'ok' | 'warn' | 'neutral' {
  if (status === 'available') return 'ok';
  if (status === 'beta') return 'warn';
  return 'neutral';
}

export function statusLabel(status: VendorStatus): string {
  if (status === 'available') return 'Available';
  if (status === 'beta') return 'Beta';
  return 'Coming soon';
}
