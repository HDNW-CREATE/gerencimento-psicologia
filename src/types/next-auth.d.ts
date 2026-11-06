import type { DefaultSession } from 'next-auth';
import type { Role } from '@prisma/client';

declare module 'next-auth' {
  interface User {
    role?: Role;
    sv?: number;
  }
  interface Session {
    user: {
      id: string;
      role: Role;
      sv: number;
      at: number;
    } & DefaultSession['user'];
  }
}

declare module '@auth/core/jwt' {
  interface JWT {
    uid?: string;
    role?: Role;
    sv?: number;
    /** Instante do login (ms) – sessões de equipe expiram mais cedo. */
    at?: number;
  }
}
