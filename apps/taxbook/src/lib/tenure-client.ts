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

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

export async function fetchTenureHealth(
  baseUrl: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await fetch(`${normalizeBaseUrl(baseUrl)}/api/health`, {
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
  } catch {
    return { ok: false, error: "Unable to reach Tenure." };
  }
}

export async function fetchTenureEmployments(baseUrl: string) {
  const response = await fetch(
    `${normalizeBaseUrl(baseUrl)}/api/integration/employments`,
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
  const params = new URLSearchParams({ employmentId: input.employmentId });
  if (input.updatedSince) params.set("updatedSince", input.updatedSince);

  const response = await fetch(
    `${normalizeBaseUrl(baseUrl)}/api/integration/paychecks?${params.toString()}`,
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
