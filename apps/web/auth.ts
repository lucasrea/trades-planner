import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import { upsertGoogleUser } from "./lib/google-user";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  callbacks: {
    async jwt({ token, account, user, profile }) {
      if (account?.provider === "google") {
        const email = user?.email ?? profile?.email;
        if (!email) return token;
        const picture =
          typeof profile === "object" && profile && "picture" in profile
            ? String(profile.picture ?? "")
            : "";
        const result = await upsertGoogleUser({
          email,
          name: user?.name ?? profile?.name ?? "",
          image: user?.image ?? picture,
          googleId: account.providerAccountId,
        });
        token.userId = result.userId;
        token.contractorId = result.contractorId;
        token.name = user?.name ?? profile?.name ?? token.name;
        token.email = email;
        token.picture = user?.image ?? picture ?? token.picture;
      }
      return token;
    },
    async session({ session, token }) {
      if (typeof token.userId === "string") session.userId = token.userId;
      if (typeof token.contractorId === "string") session.contractorId = token.contractorId;
      if (token.name) session.user.name = token.name;
      if (token.email) session.user.email = token.email;
      if (token.picture) session.user.image = token.picture;
      return session;
    },
  },
});
