// Optional Cognito AdminCreateUser for org invites. Skipped when COGNITO_USER_POOL_ID
// is unset (local tests / PGlite resolver runs).

let clientPromise;

async function getClient() {
  if (!process.env.COGNITO_USER_POOL_ID) return null;
  if (!clientPromise) {
    const { CognitoIdentityProviderClient, AdminCreateUserCommand, AdminGetUserCommand } =
      await import('@aws-sdk/client-cognito-identity-provider');
    clientPromise = {
      client: new CognitoIdentityProviderClient({}),
      AdminCreateUserCommand,
      AdminGetUserCommand,
    };
  }
  return clientPromise;
}

/** Send a Cognito invitation email to a new user, or no-op when pool id is absent. */
export async function inviteCognitoUser(email) {
  const poolId = process.env.COGNITO_USER_POOL_ID;
  if (!poolId) return { skipped: true };

  const sdk = await getClient();
  if (!sdk) return { skipped: true };

  const { client, AdminCreateUserCommand, AdminGetUserCommand } = sdk;

  try {
    await client.send(
      new AdminGetUserCommand({
        UserPoolId: poolId,
        Username: email,
      }),
    );
    return { existing: true };
  } catch (err) {
    if (err?.name !== 'UserNotFoundException') throw err;
  }

  await client.send(
    new AdminCreateUserCommand({
      UserPoolId: poolId,
      Username: email,
      UserAttributes: [
        { Name: 'email', Value: email },
        { Name: 'email_verified', Value: 'true' },
      ],
      DesiredDeliveryMediums: ['EMAIL'],
    }),
  );

  return { invited: true };
}
