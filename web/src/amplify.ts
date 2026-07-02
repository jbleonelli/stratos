// Configure Amplify from build-time env (Terraform outputs → CI → VITE_* vars).
// Cognito authenticates the SPA; AppSync is the GraphQL data plane, authorized
// with the user's Cognito tokens (userPool auth mode).

import { Amplify } from 'aws-amplify';

export function configureAmplify() {
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: import.meta.env.VITE_USER_POOL_ID,
        userPoolClientId: import.meta.env.VITE_USER_POOL_CLIENT_ID,
      },
    },
    API: {
      GraphQL: {
        endpoint: import.meta.env.VITE_GRAPHQL_URL,
        region: import.meta.env.VITE_AWS_REGION,
        defaultAuthMode: 'userPool',
      },
    },
  });
}
