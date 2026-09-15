import { HeartPulse } from "lucide-react";

import { Badge } from "~/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { api } from "~/trpc/server";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const system = await api.system.status();

  return (
    <div className="flex flex-1 items-center justify-center p-6 md:p-10">
      <Card className="w-full max-w-xl">
        <CardHeader className="items-center text-center">
          <div className="mb-3 flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <HeartPulse aria-hidden="true" className="size-6" />
          </div>
          <CardTitle className="text-xl">
            <h2>First Aid is ready</h2>
          </CardTitle>
          <CardDescription className="max-w-md text-pretty">
            The private foundation for planning your healthcare year is in
            place. Workflows will be added one useful phase at a time.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Badge
            variant="outline"
            className="gap-2 border-primary/25 bg-primary/5 text-primary"
            data-testid="system-status"
          >
            <span
              aria-hidden="true"
              className="size-1.5 rounded-full bg-primary"
            />
            Local system {system.status === "ok" ? "ready" : "unavailable"}
          </Badge>
        </CardContent>
      </Card>
    </div>
  );
}
