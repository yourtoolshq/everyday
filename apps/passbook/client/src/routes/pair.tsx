import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { LoaderCircle } from "lucide-react";

import { Button } from "@yourtoolshq/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@yourtoolshq/ui/card";
import { Input } from "@yourtoolshq/ui/input";
import { Label } from "@yourtoolshq/ui/label";

import { setAuthToken } from "../lib/auth";
import { getHostUrl, hostApiPath } from "../lib/host";

export function PairRoute() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [label, setLabel] = useState("My phone");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const hostUrl = getHostUrl();
  if (
    hostUrl.includes("127.0.0.1") ||
    hostUrl.includes("localhost") ||
    hostUrl.includes("[::1]")
  ) {
    return <Navigate to="/" replace />;
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const response = await fetch(hostApiPath("/api/auth/pair"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code, label }),
      });
      const body = (await response.json()) as {
        token?: string;
        error?: string;
      };
      if (!response.ok || !body.token) {
        throw new Error(body.error ?? "Pairing failed.");
      }
      setAuthToken(body.token);
      void navigate("/", { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Pairing failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <Card className="w-full max-w-md shadow-none">
        <CardHeader>
          <CardTitle>Pair with Passbook</CardTitle>
          <CardDescription>
            Enter the pairing code shown on the host computer to connect this
            device to <code>{hostUrl}</code>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={submit}>
            <div className="space-y-2">
              <Label htmlFor="pair-code">Pairing code</Label>
              <Input
                id="pair-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pair-label">Device label</Label>
              <Input
                id="pair-label"
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                required
              />
            </div>
            {error ? <p className="text-destructive text-sm">{error}</p> : null}
            <Button className="w-full" type="submit" disabled={pending}>
              {pending ? (
                <>
                  <LoaderCircle className="animate-spin" /> Pairing…
                </>
              ) : (
                "Pair device"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
