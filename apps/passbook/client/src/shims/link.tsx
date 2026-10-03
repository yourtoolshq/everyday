import type { ComponentProps } from "react";
import { Link as RouterLink } from "react-router-dom";

export default function Link({
  href,
  ...props
}: ComponentProps<typeof RouterLink> & { href?: string }) {
  const to = href ?? props.to;
  return <RouterLink {...props} to={to} />;
}
