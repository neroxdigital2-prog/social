import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    // Acceso único NEROX: valida la cookie nx_sess contra el portal (acceso.nerox.es).
    // Requiere en Vercel: NX_SOCIAL_USER_ID (id del usuario en la tabla User); opcional NX_SOCIAL_NAME, NX_SOCIAL_EMAIL, NX_PORTAL_URL.
    Credentials({
      id: "portal",
      name: "Acceso único",
      credentials: {},
      async authorize(_credentials, request) {
        const userId = process.env.NX_SOCIAL_USER_ID;
        if (!userId) return null;
        const cookie = request?.headers?.get("cookie") ?? "";
        const m = cookie.match(/(?:^|;\s*)nx_sess=([^;]+)/);
        if (!m) return null;
        try {
          const base = process.env.NX_PORTAL_URL || "https://acceso.nerox.es";
          const res = await fetch(`${base}/api.php?a=sesion`, {
            headers: { Cookie: `nx_sess=${m[1]}` },
            cache: "no-store",
          });
          const data = await res.json();
          if (!data?.ok) return null;
          return {
            id: userId,
            name: process.env.NX_SOCIAL_NAME || "Amor",
            email: process.env.NX_SOCIAL_EMAIL || null,
          };
        } catch {
          return null;
        }
      },
    }),
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email as string;
        const password = credentials?.password as string;
        if (!email || !password) return null;

        const res = await fetch(process.env.IONOS_BRIDGE_URL_LOGIN!, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Bridge-Secret": process.env.BRIDGE_SECRET!,
          },
          body: JSON.stringify({ email, password }),
        });

        if (!res.ok) return null;

        const data = await res.json();
        if (!data.ok || !data.user) return null;

        return { id: data.user.id, name: data.user.name, email: data.user.email };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
});
