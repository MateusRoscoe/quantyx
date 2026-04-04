import { createAuthClient } from 'better-auth/react';

// better-auth 1.5 internal types aren't portable with TS composite project
// references (Next.js incremental mode). Isolate via inferred-only local.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const authClient: any = createAuthClient({
  baseURL: process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001',
});

export const useSession: ReturnType<typeof createAuthClient>['useSession'] =
  authClient.useSession;
export const signIn: ReturnType<typeof createAuthClient>['signIn'] =
  authClient.signIn;
export const signUp: ReturnType<typeof createAuthClient>['signUp'] =
  authClient.signUp;
export const signOut: ReturnType<typeof createAuthClient>['signOut'] =
  authClient.signOut;
