import "next-auth";

declare module "next-auth" {
  interface Session {
    sessionId?: string;
  }
  interface User {
    sessionId?: string;
  }
}
