import type { ReactNode } from "react";

export function StatusMessage({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-[50vh] w-full max-w-lg flex-col justify-center gap-3 p-6">
      <h1 className="font-heading text-xl font-medium">{title}</h1>
      <p className="text-muted-foreground text-sm">{description}</p>
      {children ? <div className="flex flex-wrap gap-2">{children}</div> : null}
    </main>
  );
}
