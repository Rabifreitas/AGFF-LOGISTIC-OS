import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "gold" | "danger" | "ghost";
const variants: Record<Variant, string> = {
  primary: "bg-navy-900 text-white hover:bg-navy-800",
  secondary: "border border-gray-300 bg-white text-navy-900 hover:bg-gray-50",
  gold: "bg-gold-500 text-navy-950 hover:bg-gold-600",
  danger: "bg-red-600 text-white hover:bg-red-700",
  ghost: "text-navy-900 hover:bg-gray-100",
};

export function buttonClass(variant: Variant = "primary", className?: string) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
    variants[variant],
    className,
  );
}

export function Button({
  variant = "primary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button className={buttonClass(variant, className)} {...props} />;
}

export function Label({ htmlFor, children }: { htmlFor: string; children: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium text-gray-700">
      {children}
    </label>
  );
}

const fieldClass =
  "block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-navy-700 focus:outline-none focus:ring-2 focus:ring-gold-500/40";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(fieldClass, className)} {...props} />;
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(fieldClass, className)} {...props}>
      {children}
    </select>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("rounded-lg border border-gray-200 bg-white p-6 shadow-sm", className)}>{children}</div>;
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-navy-900 text-2xl font-semibold">{title}</h1>
        {description && <p className="mt-1 text-sm text-gray-600">{description}</p>}
      </div>
      {actions}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed border-gray-300 bg-white px-6 py-12 text-center">
      <p className="text-navy-900 text-sm font-medium">{title}</p>
      {description && <p className="mx-auto mt-1 max-w-md text-sm text-gray-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

const badgeTones = {
  gray: "bg-gray-100 text-gray-700",
  green: "bg-green-100 text-green-800",
  yellow: "bg-yellow-100 text-yellow-800",
  red: "bg-red-100 text-red-800",
  navy: "bg-navy-900/10 text-navy-900",
  gold: "bg-gold-100 text-gold-600",
} as const;

export function Badge({ tone = "gray", children }: { tone?: keyof typeof badgeTones; children: ReactNode }) {
  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", badgeTones[tone])}>{children}</span>
  );
}

export function statusTone(status: string): keyof typeof badgeTones {
  if (["ACTIVE", "ACCEPTED", "APPROVED", "VERIFIED", "DELIVERED", "RESOLVED"].includes(status)) return "green";
  if (
    [
      "PENDING_APPROVAL",
      "PENDING",
      "PENDING_VERIFICATION",
      "PENDING_REVIEW",
      "REQUESTED",
      "QUOTED",
      "OPEN",
      "INVESTIGATING",
    ].includes(status)
  )
    return "yellow";
  if (["BOOKED", "IN_TRANSIT", "AT_CUSTOMS", "MEDIUM"].includes(status)) return "navy";
  if (["HIGH"].includes(status)) return "gold";
  if (["REJECTED", "SUSPENDED", "LOCKED", "DISABLED", "REVOKED", "EXPIRED", "CANCELLED", "CRITICAL"].includes(status))
    return "red";
  return "gray";
}

export function Table({ head, children }: { head: ReactNode[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            {head.map((h, i) => (
              <th key={i} className="px-4 py-2 text-left font-medium text-gray-600">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">{children}</tbody>
      </table>
    </div>
  );
}

export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={cn("px-4 py-2 align-top", className)}>{children}</td>;
}

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 font-semibold tracking-tight",
        light ? "text-white" : "text-navy-900",
      )}
    >
      <span className="bg-gold-500 text-navy-950 inline-flex h-8 w-8 items-center justify-center rounded-md text-sm font-bold">
        A
      </span>
      <span>
        AGFF <span className="text-gold-500">Logistics OS</span>
      </span>
    </span>
  );
}
