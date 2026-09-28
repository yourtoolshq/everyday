import type { z } from "zod";

import { careOrganizationFieldsSchema } from "~/lib/visits";

export type CreateCareOrganizationCommand = z.infer<
  typeof careOrganizationFieldsSchema
>;
