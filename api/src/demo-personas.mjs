// Deterministic dev/demo Cognito personas — mirrored in db/seed/dev.sql (seed user_id
// column) and db/proof/fixtures.mjs (USER.*). After seedDemoUsers runs, profiles.user_id
// is remapped to each user's real Cognito sub.

import { USER } from '../../db/proof/fixtures.mjs';

/** Shared password for all demo personas (meets the Cognito pool policy). */
export const DEMO_PASSWORD = 'Stratos-Demo1!';

export const DEMO_PERSONAS = [
  {
    email: 'admin@alpha.example',
    fullName: 'Alpha Admin',
    seedUserId: USER.alphaAdmin,
  },
  {
    email: 'worker@alpha.example',
    fullName: 'Alpha Worker',
    seedUserId: USER.alphaScoped,
  },
  {
    email: 'admin@beta.example',
    fullName: 'Beta Admin',
    seedUserId: USER.betaAdmin,
  },
  {
    email: 'tech@swift.example',
    fullName: 'Swift Tech',
    seedUserId: USER.swiftTech,
  },
  {
    email: 'staff@adaptiv.example',
    fullName: 'Platform Staff',
    seedUserId: USER.platform,
  },
];
