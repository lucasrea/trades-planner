export type VerifiedAppleIdToken = {
  /** Apple's stable id for this person (the token's `sub`). */
  appleId: string;
  /** Lowercased, and only when Apple says it is verified. */
  email: string | null;
  /** True when the email is a Hide My Email relay address. */
  isPrivateEmail: boolean;
};

export type AppleIdTokenVerifier = (idToken: string) => Promise<VerifiedAppleIdToken | null>;
