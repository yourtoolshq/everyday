export function normalizeTenureBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

/** Server-side Tenure API calls may need a different base URL than browser links. */
export function resolveTenureFetchBaseUrl(configuredBaseUrl: string): string {
  const override = process.env.TENURE_FETCH_BASE_URL?.trim();
  if (override) {
    return normalizeTenureBaseUrl(override);
  }
  return normalizeTenureBaseUrl(configuredBaseUrl);
}

export function tenureHomeUrl(baseUrl: string): string {
  return normalizeTenureBaseUrl(baseUrl);
}

export function tenureEmploymentUrl(
  baseUrl: string,
  employmentId: string,
): string {
  return `${normalizeTenureBaseUrl(baseUrl)}/employments/${employmentId}`;
}
