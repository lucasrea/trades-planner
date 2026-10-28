"use client";

import { useFormStatus } from "react-dom";

export function FormSubmitButton({
  label,
  pendingLabel,
  className,
  disabled,
}: {
  label: string;
  pendingLabel?: string;
  className?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={disabled || pending}>
      {pending ? (pendingLabel ?? `${label}…`) : label}
    </button>
  );
}
