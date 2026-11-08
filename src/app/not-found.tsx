import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-50">
      <p className="text-5xl font-semibold text-navy-900">404</p>
      <Link href="/" className="text-gold-600 hover:underline">
        AGFF Logistics OS
      </Link>
    </div>
  );
}
