import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import prisma from "@/lib/prisma"; // Usa l'istanza centralizzata
import bcrypt from "bcrypt";
import type { DefaultSession } from "next-auth";

// Estensione delle tipologie per NextAuth
declare module "next-auth" {
  interface User {
    id: string;
    role?: string;
  }
  interface Session {
    user: {
      id: string;
      role?: string;
    } & DefaultSession["user"];
  }
}


export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma) as any,
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "email@esempio.it" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials: Partial<Record<"email" | "password", unknown>>, request: Request) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email e password richiesti");
        }
        
        const email = credentials.email as string;
        const password = credentials.password as string;

        const user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user || !user.password) {
          return null;
        }

        if (user.isBlocked) {
          throw new Error("L'account è stato bloccato. Contatta l'amministratore.");
        }

        const isPasswordMatch = await bcrypt.compare(
          password,
          user.password || ""
        );

        if (!isPasswordMatch) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.email.split('@')[0], // Usiamo la parte prima della @ come nome utente
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }: { token: any; user: any }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }: { session: DefaultSession & { user?: { id?: string; role?: string } }, token: any }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
});
