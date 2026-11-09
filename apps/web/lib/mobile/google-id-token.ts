export type VerifiedGoogleIdToken = {
  email: string;
  emailVerified: boolean;
};

export type GoogleIdTokenVerifier = (idToken: string) => Promise<VerifiedGoogleIdToken | null>;
