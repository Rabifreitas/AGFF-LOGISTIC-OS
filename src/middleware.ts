import { NextResponse, type NextRequest } from "next/server";

const PROTECTED = ["/app", "/admin", "/account"];
const SESSION_COOKIES = ["authjs.session-token", "__Secure-authjs.session-token"];

/**
 * Filtro rápido: sem cookie de sessão → /login. A validação real (sessão na BD,
 * estado da conta, permissões) é feita no servidor em cada página/acção.
 */
export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (!PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return NextResponse.next();
  if (SESSION_COOKIES.some((c) => req.cookies.has(c))) return NextResponse.next();
  const url = new URL("/login", req.url);
  url.searchParams.set("next", pathname + search);
  return NextResponse.redirect(url);
}

export const config = { matcher: ["/app/:path*", "/admin/:path*", "/account/:path*"] };
