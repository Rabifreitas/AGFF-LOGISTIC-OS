import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["@prisma/client", "bcryptjs"],
  // Uploads do DMS (limite real de 15 MB validado no servidor).
  experimental: { serverActions: { bodySizeLimit: "16mb" } },
};

export default withNextIntl(nextConfig);
