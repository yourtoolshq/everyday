import type { ComponentProps, ReactNode } from "react";
import { Link as RouterLink } from "react-router-dom";

export type NextLinkProps = {
  href: string;
  children?: ReactNode;
  className?: string;
  prefetch?: boolean;
} & Omit<ComponentProps<typeof RouterLink>, "to" | "href" | "children">;

export default function Link({ href, prefetch: _prefetch, ...props }: NextLinkProps) {
  return <RouterLink {...props} to={href} />;
}
