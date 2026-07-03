// Stratos claim-bridge proof — identities & personas.
// UUIDs mirror seed.sql; keep the two in sync.

export const ORG = {
  alpha: '0a1a0a1a-0000-0000-0000-000000000001',
  beta: '0b1b0b1b-0000-0000-0000-000000000001',
  swift: '0c1c0c1c-0000-0000-0000-000000000001',
  platform: '0f0f0f0f-0000-0000-0000-000000000001',
};

export const LOC = {
  alphaTower: '10c0a001-0000-0000-0000-000000000001',
  alphaAnnex: '10c0a001-0000-0000-0000-000000000002',
  betaPlaza: '10c0b001-0000-0000-0000-000000000001',
};

// Seeded domain rows (db/seed/dev.sql), used by the baseline test.
export const DEVICE = {
  alphaTower: 'de000a01-0000-0000-0000-000000000001',
  alphaAnnex: 'de000a01-0000-0000-0000-000000000002',
  betaPlaza: 'de000b01-0000-0000-0000-000000000001',
};

export const EVENT = {
  alpha: 'e5e00a01-0000-0000-0000-000000000001',
  beta: 'e5e00b01-0000-0000-0000-000000000001',
};

export const ASK = {
  alpha: 'a5c00a01-0000-0000-0000-000000000001',
  beta: 'a5c00b01-0000-0000-0000-000000000001',
};

export const USER = {
  alphaAdmin: '05e00a01-0000-0000-0000-000000000001', // org-wide (no grants)
  alphaScoped: '05e00a01-0000-0000-0000-000000000002', // Alpha Tower grant only
  betaAdmin: '05e00b01-0000-0000-0000-000000000001', // org-wide in Beta
  swiftTech: '05e00c01-0000-0000-0000-000000000001', // Swift HVAC contractor
  platform: '05e0f001-0000-0000-0000-000000000001', // platform admin
};

export const CONTRACT = {
  alphaHvac: '5c000a01-0000-0000-0000-000000000001',
};

// Cognito-style claim sets, as the pre-token-generation Lambda would emit them.
export const AS = {
  alphaAdmin: { sub: USER.alphaAdmin, organization_id: ORG.alpha },
  alphaScoped: { sub: USER.alphaScoped, organization_id: ORG.alpha },
  betaAdmin: { sub: USER.betaAdmin, organization_id: ORG.beta },
  swiftTech: { sub: USER.swiftTech, organization_id: ORG.swift, email: 'tech@swift.example' },
  platform: { sub: USER.platform, organization_id: ORG.alpha, platform_role: 'platform_admin' },
  anonymous: {},
};
