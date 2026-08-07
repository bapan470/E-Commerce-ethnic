import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateAndPublishBlogPost } from "@/lib/blog/generate";

/**
 * GET  /api/blog/status  -> health check: shows last 10 runs + last post,
 *                           so you (or an uptime monitor) can confirm
 *                           "haan, AI khud se blog likh raha hai."
 *
 * POST /api/blog/status?mode=test  -> runs one END-TO-END test generation
 *                                     (dryRun, nothing gets published) so
 *                                     you can confirm the pipeline works
 *                                     RIGHT NOW without waiting for tomorrow's cron.
 */
export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: logs } = await supabase
    .from("blog_generation_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(10);

  const { data: lastPost } = await supabase
    .from("blog_posts")
    .select("slug, title, city, published_at")
    .order("published_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const lastSuccess = logs?.find((l) => l.status === "success");
  const isHealthy =
    !!lastSuccess &&
    Date.now() - new Date(lastSuccess.created_at).getTime() < 1000 * 60 * 60 * 36; // 36h grace window

  return NextResponse.json({
    healthy: isHealthy,
    message: isHealthy
      ? "✅ Automation chal raha hai — last successful run neeche dekhein."
      : "⚠️ Pichle 36 ghante me koi successful run nahi mila. Cron job check karein.",
    lastPost,
    recentLogs: logs,
  });
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-test-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await generateAndPublishBlogPost({ runType: "test", dryRun: true });
  return NextResponse.json(result, { status: result.success ? 200 : 500 });
}
