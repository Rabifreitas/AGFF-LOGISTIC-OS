import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { loginSchema } from "@/modules/iam/schemas";
import { authenticate, logout } from "@/modules/iam/services/auth.service";
import { SESSION_TTL_HOURS } from "@/modules/iam/services/session.service";

class LoginError extends CredentialsSignin {
  constructor(code: string) {
    super();
    this.code = code;
  }
}

function metaFrom(request: Request | undefined) {
  const h = request?.headers;
  return {
    ip: h?.get("x-forwarded-for")?.split(",")[0]?.trim() || h?.get("x-real-ip") || undefined,
    userAgent: h?.get("user-agent") ?? undefined,
  };
}

/**
 * Auth.js (NextAuth v5) com Credentials. O JWT transporta apenas o id da sessão
 * (`sid`); a sessão real vive na tabela `sessions` e é validada em cada pedido
 * (ver modules/iam/session-context.ts), permitindo revogação imediata.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt", maxAge: SESSION_TTL_HOURS * 3600 },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(credentials, request) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) throw new LoginError("invalid_credentials");
        const result = await authenticate(parsed.data.email, parsed.data.password, metaFrom(request));
        if (!result.ok) throw new LoginError(result.code);
        return { id: result.user.id, email: result.user.email, name: result.user.name, sessionId: result.sessionId };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
        token.sid = (user as { sessionId?: string }).sessionId;
      }
      return token;
    },
    session({ session, token }) {
      return { ...session, sessionId: token.sid as string | undefined, user: { ...session.user, id: token.uid as string } };
    },
  },
  events: {
    async signOut(message) {
      const sid = "token" in message ? (message.token?.sid as string | undefined) : undefined;
      if (sid) await logout(sid);
    },
  },
});
