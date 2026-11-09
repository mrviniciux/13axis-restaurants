import "server-only";

import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import type { NextRequest } from "next/server";
import { RoleSchema, type Role } from "@13axis/shared";
import { prisma } from "./lib/server/prisma";
import { verifyPassword } from "@13axis/database";
import { requireAuthSecret } from "./lib/server/auth-secret";
import { parseLoginCredentials } from "./lib/server/credentials-input";

declare module "next-auth" {
  interface Session {
    user: NonNullable<DefaultSession["user"]> & {
      id?: string;
      restaurantId?: string;
      role?: Role;
    };
  }

  interface User {
    restaurantId?: string;
    role?: Role;
  }
}

function createAuth() {
  const secret = requireAuthSecret();
  return NextAuth({
    secret,
    session: { strategy: "jwt" },
    providers: [
      Credentials({
        credentials: {
          email: { label: "Email", type: "email" },
          password: { label: "Senha", type: "password" },
        },
        async authorize(credentials) {
          const parsed = parseLoginCredentials(credentials);
          if (!parsed) return null;

          const user = await prisma.user.findFirst({
            where: {
              email: { equals: parsed.email, mode: "insensitive" },
              deletedAt: null,
              restaurant: { deletedAt: null },
            },
            select: {
              id: true,
              restaurantId: true,
              name: true,
              email: true,
              role: true,
              passwordHash: true,
            },
          });
          if (
            !user ||
            !(await verifyPassword(parsed.password, user.passwordHash))
          ) {
            return null;
          }

          return {
            id: user.id,
            name: user.name,
            email: user.email,
            restaurantId: user.restaurantId,
            role: user.role,
          };
        },
      }),
    ],
    callbacks: {
      async jwt({ token, user }) {
        if (user) {
          token.id = user.id;
          token.restaurantId = user.restaurantId;
          token.role = user.role;
        }

        const userId = token.id ?? token.sub;
        if (!userId) {
          delete token.id;
          delete token.restaurantId;
          delete token.role;
          return token;
        }

        // Refresh claims from canonical active records so deleted accounts,
        // deleted restaurants and changed roles cannot keep stale privileges.
        const current = await prisma.user.findFirst({
          where: {
            id: userId,
            deletedAt: null,
            restaurant: { deletedAt: null },
          },
          select: { id: true, restaurantId: true, role: true },
        });
        if (!current) {
          delete token.id;
          delete token.restaurantId;
          delete token.role;
          return token;
        }
        token.id = current.id;
        token.restaurantId = current.restaurantId;
        token.role = current.role;
        return token;
      },
      async session({ session, token }) {
        // JWT claims are untrusted at the boundary and typed as unknown by
        // Auth.js; only copy values that pass the expected runtime schemas.
        if (typeof token.id === "string") session.user.id = token.id;
        if (typeof token.restaurantId === "string") {
          session.user.restaurantId = token.restaurantId;
        }
        const role = RoleSchema.safeParse(token.role);
        if (role.success) session.user.role = role.data;
        return session;
      },
    },
  });
}

/**
 * Auth.js is instantiated only when used, and every access requires the
 * explicitly configured secret. No development or production fallback exists.
 */
export async function auth() {
  return createAuth().auth();
}

export const handlers = {
  GET: (request: NextRequest) => createAuth().handlers.GET(request),
  POST: (request: NextRequest) => createAuth().handlers.POST(request),
};
