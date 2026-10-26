'use client';
import type { ReactNode } from 'react';

export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="admin-page-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p className="muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}
export function ErrorNotice({ error }: { error: string }) {
  return error ? (
    <div className="error-message" role="alert">
      {error}
    </div>
  ) : null;
}
export const errorText = (e: unknown) =>
  e instanceof Error ? e.message : 'Terjadi kesalahan. Silakan coba kembali.';
export function Loading() {
  return (
    <div className="admin-loading">
      <span className="spinner" /> Menyiapkan arena…
    </div>
  );
}
