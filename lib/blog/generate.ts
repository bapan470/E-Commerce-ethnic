import { createClient } from "@supabase/supabase-js";
import { buildBlogPrompt } from "./prompt";

// Server-only Supabase client (service role — never expose this key to the browser)
function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

interface GenerateResult {
  success: boolean;
  postId?: string;
  slug?: string;
  city?: string;
  error?: string;
}

/**
 * Picks the next city that hasn't been used yet (round-robins once the
 * queue is exhausted so the automation never runs out of cities).
 */
async function pickNextCity(supabase: ReturnType<typeof getSupabaseAdmin>) {
  let { data: row } = await supabase
    .from("blog_city_queue")
    .select("*")
    .eq("is_used", false)
    .limit(1)
    .maybeSingle();

  if (!row) {
    // Queue exhausted — reset it so the automation keeps running forever
    await supabase.from("blog_city_queue").update({ is_used: false, used_at: null }).neq("id", "");
    const retry = await supabase
      .from("blog_city_queue")
      .select("*")
      .eq("is_used", false)
      .limit(1)
      .maybeSingle();
    row = retry.data;
  }
  return row;
}

export async function generateAndPublishBlogPost(opts: {
  runType: "cron" | "manual" | "test";
  cityOverride?: string;
  dryRun?: boolean; // true => generate but don't save/publish (used by the test endpoint)
}): Promise<GenerateResult> {
  const start = Date.now();
  const supabase = getSupabaseAdmin();

  const siteName = process.env.SITE_NAME || "Your Ethnic Wear Store";
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://example.com";
  const shopCategoryUrl = `${siteUrl}/collections/sarees`;

  let cityRow: any = null;

  try {
    if (opts.cityOverride) {
      cityRow = { city: opts.cityOverride, category: "saree" };
    } else {
      cityRow = await pickNextCity(supabase);
    }

    if (!cityRow) {
      throw new Error("No city available in blog_city_queue");
    }

    const prompt = buildBlogPrompt({
      city: cityRow.city,
      category: cityRow.category,
      siteName,
      siteUrl,
      shopCategoryUrl,
    });

    const aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      throw new Error(`Anthropic API error ${aiResponse.status}: ${errText}`);
    }

    const aiData = await aiResponse.json();
    const rawText = aiData.content?.[0]?.text ?? "";
    const cleaned = rawText.replace(/```json|```/g, "").trim();

    let parsed: {
      title: string;
      meta_description: string;
      keywords: string[];
      content_html: string;
      cta_text: string;
    };

    try {
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error("Failed to parse AI JSON output: " + cleaned.slice(0, 300));
    }

    const slug = `${slugify(parsed.title)}-${cityRow.city.toLowerCase()}`.slice(0, 90);

    if (opts.dryRun) {
      await logRun(supabase, {
        run_type: opts.runType,
        city: cityRow.city,
        status: "success",
        duration_ms: Date.now() - start,
      });
      return { success: true, slug, city: cityRow.city };
    }

    const { data: inserted, error: insertError } = await supabase
      .from("blog_posts")
      .insert({
        slug,
        title: parsed.title,
        meta_description: parsed.meta_description,
        city: cityRow.city,
        category: cityRow.category,
        content_html: parsed.content_html,
        keywords: parsed.keywords,
        cta_text: parsed.cta_text,
        status: "published",
        published_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // Mark this city as used so tomorrow's run picks a different one
    if (!opts.cityOverride) {
      await supabase
        .from("blog_city_queue")
        .update({ is_used: true, used_at: new Date().toISOString() })
        .eq("city", cityRow.city)
        .eq("category", cityRow.category);
    }

    await logRun(supabase, {
      run_type: opts.runType,
      city: cityRow.city,
      status: "success",
      post_id: inserted.id,
      duration_ms: Date.now() - start,
    });

    return { success: true, postId: inserted.id, slug: inserted.slug, city: cityRow.city };
  } catch (err: any) {
    await logRun(supabase, {
      run_type: opts.runType,
      city: cityRow?.city,
      status: "error",
      error_message: err?.message || String(err),
      duration_ms: Date.now() - start,
    });
    return { success: false, error: err?.message || String(err) };
  }
}

async function logRun(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  entry: {
    run_type: string;
    city?: string;
    status: "success" | "error";
    post_id?: string;
    error_message?: string;
    duration_ms: number;
  }
) {
  await supabase.from("blog_generation_logs").insert(entry);
}
