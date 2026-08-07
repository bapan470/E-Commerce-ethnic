import { NextRequest, NextResponse } from "next/server";
import { generateAndPublishBlogPost } from "@/lib/blog/generate";

/**
 * This route is called automatically every day by Vercel Cron (see vercel.json).
 * It can also be triggered manually by you (with the secret) for an extra city,
 * or you can pass ?city=Jaipur to force a specific city.
 *
 * Security: request must include header
 *   Authorization: Bearer <CRON_SECRET>
 * Vercel Cron sends this automatically if CRON_SECRET is set in project env vars.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const city = req.nextUrl.searchParams.get("city") || undefined;
  const isCronCall = req.headers.get("x-vercel-cron") !== null;

  const result = await generateAndPublishBlogPost({
    runType: isCronCall ? "cron" : "manual",
    cityOverride: city,
  });

  if (!result.success) {
    return NextResponse.json(result, { status: 500 });
  }
  return NextResponse.json(result, { status: 200 });
}
