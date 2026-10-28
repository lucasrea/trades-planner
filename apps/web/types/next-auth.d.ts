import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    userId: string;
    contractorId: string;
    user: DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    contractorId?: string;
  }
}
