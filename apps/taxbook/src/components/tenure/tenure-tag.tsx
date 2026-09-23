import { Badge } from "~/components/ui/badge";

export function TenureTag({ href }: { href?: string }) {
  const badge = (
    <Badge
      variant="outline"
      className="px-1.5 py-0 text-[10px] font-medium tracking-wide uppercase"
    >
      Tenure
    </Badge>
  );

  if (!href) return badge;

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex transition-opacity hover:opacity-80"
      title="Open in Tenure"
    >
      {badge}
    </a>
  );
}
