export function normalizeTenureBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
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
