import Link from "next/link";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Logo } from "@/components/ui";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <header className="bg-navy-900 flex items-center justify-between px-6 py-4">
        <Link href="/">
          <Logo light />
        </Link>
        <LocaleSwitcher light />
      </header>
      <main className="flex flex-1 items-start justify-center px-4 py-12">{children}</main>
    </div>
  );
}
