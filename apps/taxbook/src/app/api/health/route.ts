import { db } from "~/server/db";

export async function GET() {
  try {
    await db.query.households.findFirst();
    return Response.json({ status: "ok" });
  } catch {
    return Response.json({ status: "error" }, { status: 503 });
  }
}
