export type TenureIntegrationEmployment = {
  id: string;
  personId: string;
  personName: string;
  employerId: string;
  employerName: string;
  jobTitle: string | null;
  status: "current" | "former";
  startDate: string | null;
  endDate: string | null;
  payFrequency: string;
  biweeklyAnchorDate: string | null;
  deductionSettings: string;
  createdAt: string;
  updatedAt: string;
};

export type TenureIntegrationPaycheck = {
  id: string;
  employmentId: string;
  payDate: string;
  periodStartDate: string;
  periodEndDate: string;
  grossPayCents: number;
  incomeTaxCents: number;
  federalIncomeTaxCents: number;
  manitobaIncomeTaxCents: number;
  cppCents: number;
  cpp2Cents: number;
  eiCents: number;
  wiCents: number;
  ltdCents: number;
  extendedHealthCents: number;
  travelMedicalCents: number;
  unionDuesCents: number;
  otherDeductionsCents: number;
  netPayCents: number;
  hasStub: boolean;
  createdAt: string;
  updatedAt: string;
};

import { resolveTenureFetchBaseUrl } from "./tenure-url";

function describeTenureFetchError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/certificate|CERT|UNABLE_TO_VERIFY|self signed/i.test(message)) {
    return "Unable to reach Tenure. TLS verification failed for the configured URL. In Docker, set TENURE_FETCH_BASE_URL to Tenure's internal HTTP URL.";
  }
  if (/ENOTFOUND|getaddrinfo|EAI_AGAIN/i.test(message)) {
    return "Unable to reach Tenure. The configured hostname is not reachable from this process. In Docker, set TENURE_FETCH_BASE_URL to Tenure's internal HTTP URL.";
  }
  if (/ECONNREFUSED|fetch failed/i.test(message)) {
    return "Unable to reach Tenure. Check that Tenure is running and the base URL is correct.";
  }
  return "Unable to reach Tenure.";
}

export async function fetchTenureHealth(
  baseUrl: string,
): Promise<{ ok: boolean; error?: string }> {
  const fetchBaseUrl = resolveTenureFetchBaseUrl(baseUrl);
  try {
    const response = await fetch(`${fetchBaseUrl}/api/health`, {
      cache: "no-store",
    });
    if (!response.ok) {
      return { ok: false, error: `Tenure responded with ${response.status}.` };
    }
    const body = (await response.json()) as { status?: string };
    if (body.status !== "ok") {
      return { ok: false, error: "Tenure health check failed." };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: describeTenureFetchError(error) };
  }
}

export async function fetchTenureEmployments(baseUrl: string) {
  const fetchBaseUrl = resolveTenureFetchBaseUrl(baseUrl);
  const response = await fetch(
    `${fetchBaseUrl}/api/integration/employments`,
    {
      cache: "no-store",
    },
  );
  if (!response.ok) {
    throw new Error(`Tenure responded with ${response.status}.`);
  }
  const body = (await response.json()) as {
    items: TenureIntegrationEmployment[];
  };
  return body.items;
}

export async function fetchTenurePaychecks(
  baseUrl: string,
  input: { employmentId: string; updatedSince?: string },
) {
  const fetchBaseUrl = resolveTenureFetchBaseUrl(baseUrl);
  const params = new URLSearchParams({ employmentId: input.employmentId });
  if (input.updatedSince) params.set("updatedSince", input.updatedSince);

  const response = await fetch(
    `${fetchBaseUrl}/api/integration/paychecks?${params.toString()}`,
    { cache: "no-store" },
  );
  if (!response.ok) {
    throw new Error(`Tenure responded with ${response.status}.`);
  }
  const body = (await response.json()) as {
    items: TenureIntegrationPaycheck[];
  };
  return body.items;
}
