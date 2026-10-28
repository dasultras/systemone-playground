import type { ReactNode } from "react";

/**
 * Gruppierte Fläche im Stil der macOS-Einstellungen: Titel über der Karte,
 * Hinweis darunter. Zeilen in der Karte trennt `divide-y`.
 */
export function Group({
  title,
  titleFor,
  aside,
  hint,
  hintId,
  children,
  className = "",
  bodyClassName = "divide-y",
}: {
  title: string;
  titleFor?: string;
  aside?: ReactNode;
  hint?: ReactNode;
  hintId?: string;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  const Title = titleFor ? "label" : "h2";
  return (
    <section className={className}>
      <div className="mb-1.5 flex items-baseline justify-between gap-3 px-1">
        <Title htmlFor={titleFor} className="text-xs font-semibold text-muted-foreground">
          {title}
        </Title>
        {aside}
      </div>
      <div className={`overflow-hidden rounded-lg border bg-card ${bodyClassName}`}>{children}</div>
      {hint && (
        <p id={hintId} className="mt-1.5 px-1 text-xs text-muted-foreground">
          {hint}
        </p>
      )}
    </section>
  );
}

/** Zeile in einer Gruppe: Bezeichnung links, Steuerelement rechts. */
export function GroupRow({
  label,
  children,
  className = "",
}: {
  label: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex min-h-10 items-center justify-between gap-3 px-3 py-1.5 ${className}`}>
      <span className="min-w-0 text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

/** Ergebnisblock: Kopfleiste auf `strip`, Inhalt auf `card`, optionaler Fuß. */
export function Panel({
  head,
  foot,
  children,
  className = "",
  ...rest
}: {
  head: ReactNode;
  foot?: ReactNode;
  children?: ReactNode;
  className?: string;
} & Omit<React.ComponentProps<"article">, "children">) {
  return (
    <article className={`overflow-hidden rounded-lg border bg-card ${className}`} {...rest}>
      <header className="border-b bg-strip px-4 py-2.5">{head}</header>
      {children}
      {foot && <footer className="border-t bg-strip px-4 py-1.5">{foot}</footer>}
    </article>
  );
}
