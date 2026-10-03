export function isAllowedNavigation(target: string, allowedOrigins: string[]) {
  if (target.startsWith("file://") || target.startsWith("data:")) {
    return true;
  }

  try {
    const { origin } = new URL(target);
    return allowedOrigins.includes(origin);
  } catch {
    return false;
  }
}
