import type { NextAuthConfig } from 'next-auth';

/**
 * Configuração compatível com o runtime Edge (usada pelo middleware). NÃO importe Prisma aqui.
 * O middleware é só a 1ª barreira (rota × papel). A autorização real é refeita no servidor
 * em `requireUser/requirePermission` – que também confere `sessionVersion` no banco.
 */
export const authConfig = {
  pages: { signIn: '/entrar' },
  session: { strategy: 'jwt', maxAge: 60 * 60 * 24 * 7, updateAge: 60 * 60 }, // 7 dias
  trustHost: true,
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
        token.role = user.role;
        token.sv = user.sv;
        token.at = Date.now();
      }
      return token;
    },
    session({ session, token }) {
      if (token.uid) {
        session.user.id = token.uid;
        session.user.role = token.role!;
        session.user.sv = token.sv ?? 0;
        session.user.at = token.at ?? 0;
      }
      return session;
    },
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const role = auth?.user?.role;
      const isStaff = role === 'ADMIN' || role === 'SECRETARIA';

      if (pathname.startsWith('/admin')) {
        if (!auth?.user) return false; // → redireciona para /entrar
        if (!isStaff) return Response.redirect(new URL('/paciente', request.nextUrl));
        return true;
      }
      if (pathname.startsWith('/paciente')) {
        if (!auth?.user) return false;
        if (isStaff) return Response.redirect(new URL('/admin', request.nextUrl));
        return true;
      }
      // Logado não precisa ver login/cadastro
      if (auth?.user && (pathname === '/entrar' || pathname === '/cadastro')) {
        return Response.redirect(new URL(isStaff ? '/admin' : '/paciente', request.nextUrl));
      }
      return true;
    },
  },
} satisfies NextAuthConfig;
