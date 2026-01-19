import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Parse optional filters from request body
    let originId: string | null = null;
    let stageId: string | null = null;
    let limit: number = 1000;
    let dryRun: boolean = false;

    try {
      const body = await req.json();
      originId = body.origin_id || null;
      stageId = body.stage_id || null;
      limit = body.limit || 1000;
      dryRun = body.dry_run || false;
    } catch {
      // No body or invalid JSON, use defaults
    }

    console.log(`[BACKFILL] Starting - originId: ${originId}, stageId: ${stageId}, limit: ${limit}, dryRun: ${dryRun}`);

    // 1. Get deals that need tasks
    let dealsQuery = supabase
      .from("crm_deals")
      .select("id, stage_id, origin_id, owner_id, contact_id, name")
      .not("stage_id", "is", null);

    if (originId) {
      dealsQuery = dealsQuery.eq("origin_id", originId);
    }
    if (stageId) {
      dealsQuery = dealsQuery.eq("stage_id", stageId);
    }

    const { data: deals, error: dealsError } = await dealsQuery.limit(limit);

    if (dealsError) {
      console.error("[BACKFILL] Error fetching deals:", dealsError);
      throw dealsError;
    }

    console.log(`[BACKFILL] Found ${deals?.length || 0} deals to process`);

    // 2. Get all activity templates (to avoid repeated queries)
    const { data: allTemplates, error: templatesError } = await supabase
      .from("activity_templates")
      .select("*")
      .eq("is_active", true)
      .order("order_index");

    if (templatesError) {
      console.error("[BACKFILL] Error fetching templates:", templatesError);
      throw templatesError;
    }

    // Group templates by stage_id
    const templatesByStage: Record<string, any[]> = {};
    for (const template of allTemplates || []) {
      if (template.stage_id) {
        if (!templatesByStage[template.stage_id]) {
          templatesByStage[template.stage_id] = [];
        }
        templatesByStage[template.stage_id].push(template);
      }
    }

    console.log(`[BACKFILL] Templates loaded for ${Object.keys(templatesByStage).length} stages`);

    // 3. Process each deal
    let processed = 0;
    let skipped = 0;
    let noTemplates = 0;
    const errors: string[] = [];
    const allTasksToInsert: any[] = [];

    for (const deal of deals || []) {
      // Check if deal already has pending tasks
      const { count, error: countError } = await supabase
        .from("deal_tasks")
        .select("*", { count: "exact", head: true })
        .eq("deal_id", deal.id)
        .eq("status", "pending");

      if (countError) {
        errors.push(`Error checking tasks for deal ${deal.id}: ${countError.message}`);
        continue;
      }

      if ((count || 0) > 0) {
        skipped++;
        continue;
      }

      // Get templates for this deal's stage
      const templates = templatesByStage[deal.stage_id] || [];

      if (templates.length === 0) {
        noTemplates++;
        continue;
      }

      // Create tasks from templates
      const now = new Date();
      const tasks = templates.map((template: any) => {
        const dueDays = template.default_due_days || 0;
        const dueDate = new Date(now.getTime() + dueDays * 24 * 60 * 60 * 1000);

        return {
          deal_id: deal.id,
          template_id: template.id,
          title: template.name,
          description: template.description,
          type: template.type || "other",
          status: "pending",
          due_date: dueDate.toISOString(),
          owner_id: deal.owner_id || null,
          contact_id: deal.contact_id || null,
        };
      });

      allTasksToInsert.push(...tasks);
      processed++;
    }

    // 4. Insert all tasks in batches (if not dry run)
    let insertedCount = 0;
    if (!dryRun && allTasksToInsert.length > 0) {
      // Insert in batches of 500
      const batchSize = 500;
      for (let i = 0; i < allTasksToInsert.length; i += batchSize) {
        const batch = allTasksToInsert.slice(i, i + batchSize);
        const { error: insertError } = await supabase
          .from("deal_tasks")
          .insert(batch);

        if (insertError) {
          console.error(`[BACKFILL] Error inserting batch ${i / batchSize + 1}:`, insertError);
          errors.push(`Batch insert error: ${insertError.message}`);
        } else {
          insertedCount += batch.length;
        }
      }
    }

    const result = {
      processed,
      skipped,
      noTemplates,
      tasksCreated: dryRun ? 0 : insertedCount,
      tasksToCreate: allTasksToInsert.length,
      dryRun,
      errors: errors.length > 0 ? errors : undefined,
      stagesWithTemplates: Object.keys(templatesByStage).length,
    };

    console.log("[BACKFILL] Completed:", result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[BACKFILL] Fatal error:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
