"use client";

import { useActionState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { useTranslations } from "next-intl";
import type { ActionState } from "@/modules/iam/action-result";
import { Button, Input, Label, Select } from "./ui";

type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;

export function SubmitButton({ children, variant }: { children: ReactNode; variant?: "primary" | "gold" | "danger" | "secondary" }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} variant={variant}>
      {children}
    </Button>
  );
}

function useMsg() {
  const t = useTranslations();
  return (key?: string) => (key ? (t.has(key) ? t(key) : key) : "");
}

export function ActionForm({
  action,
  children,
  submitLabel,
  className,
  resetOnSuccess,
  variant,
}: {
  action: Action;
  children: (state: ActionState) => ReactNode;
  submitLabel: string;
  className?: string;
  resetOnSuccess?: boolean;
  variant?: "primary" | "gold" | "danger" | "secondary";
}) {
  const [state, formAction] = useActionState(action, {});
  const msg = useMsg();
  return (
    <form action={formAction} className={className ?? "space-y-4"} key={resetOnSuccess && state.ok ? Date.now() : undefined}>
      {state.error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {msg(state.error)}
        </p>
      )}
      {state.ok && state.message && (
        <p role="status" className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
          {msg(state.message)}
        </p>
      )}
      {children(state)}
      <SubmitButton variant={variant}>{submitLabel}</SubmitButton>
    </form>
  );
}

export function Field({
  name,
  label,
  state,
  type = "text",
  defaultValue,
  required,
  autoComplete,
  placeholder,
}: {
  name: string;
  label: string;
  state: ActionState;
  type?: string;
  defaultValue?: string | number | null;
  required?: boolean;
  autoComplete?: string;
  placeholder?: string;
}) {
  const msg = useMsg();
  const errors = state.fieldErrors?.[name];
  return (
    <div>
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue ?? undefined}
        required={required}
        autoComplete={autoComplete}
        placeholder={placeholder}
        aria-invalid={!!errors}
      />
      {errors?.map((e) => (
        <p key={e} className="mt-1 text-xs text-red-600">
          {msg(e)}
        </p>
      ))}
    </div>
  );
}

export function SelectField({
  name,
  label,
  options,
  defaultValue,
  state,
}: {
  name: string;
  label: string;
  options: { value: string; label: string }[];
  defaultValue?: string;
  state: ActionState;
}) {
  const msg = useMsg();
  return (
    <div>
      <Label htmlFor={name}>{label}</Label>
      <Select id={name} name={name} defaultValue={defaultValue}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
      {state.fieldErrors?.[name]?.map((e) => (
        <p key={e} className="mt-1 text-xs text-red-600">
          {msg(e)}
        </p>
      ))}
    </div>
  );
}
