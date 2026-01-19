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
    let limit: number = 500; // Reduced default limit
    let dryRun: boolean = false;

    try {
      const body = await req.json();
      originId = body.origin_id || body.originId || null;
      stageId = body.stage_id || body.stageId || null;
      limit = Math.min(body.limit || 500, 1000); // Cap at 1000
      dryRun = body.dry_run || body.dryRun || false;
    } catch {
      // No body or invalid JSON, use defaults
    }

    console.log(`[BACKFILL] Starting - originId: ${originId}, stageId: ${stageId}, limit: ${limit}, dryRun: ${dryRun}`);

    // 1. Get all activity templates first (to avoid processing deals without templates)
    const { data: allTemplates, error: templatesError } = await supabase
      .from("activity_templates")
      .select("id, name, description, type, default_due_days, stage_id, order_index")
      .eq("is_active", true)
      .order("order_index");

    if (templatesError) {
      console.error("[BACKFILL] Error fetching templates:", templatesError);
      throw templatesError;
    }

    // Group templates by stage_id
    const templatesByStage: Record<string, any[]> = {};
    const stagesWithTemplates: string[] = [];
    for (const template of allTemplates || []) {
      if (template.stage_id) {
        if (!templatesByStage[template.stage_id]) {
          templatesByStage[template.stage_id] = [];
          stagesWithTemplates.push(template.stage_id);
        }
        templatesByStage[template.stage_id].push(template);
      }
    }

    console.log(`[BACKFILL] Templates loaded for ${stagesWithTemplates.length} stages`);

    if (stagesWithTemplates.length === 0) {
      return new Response(JSON.stringify({
        processed: 0,
        skipped: 0,
        noTemplates: 0,
        tasksCreated: 0,
        tasksToCreate: 0,
        dryRun,
        message: "No stages have templates configured"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // 2. Get deals that are in stages with templates (optimized query)
    let dealsQuery = supabase
      .from("crm_deals")
      .select("id, stage_id, origin_id, owner_id, contact_id")
      .in("stage_id", stageId ? [stageId] : stagesWithTemplates);

    if (originId) {
      dealsQuery = dealsQuery.eq("origin_id", originId);
    }

    const { data: deals, error: dealsError } = await dealsQuery.limit(limit);

    if (dealsError) {
      console.error("[BACKFILL] Error fetching deals:", dealsError);
      throw dealsError;
    }

    console.log(`[BACKFILL] Found ${deals?.length || 0} deals in stages with templates`);

    if (!deals || deals.length === 0) {
      return new Response(JSON.stringify({
        processed: 0,
        skipped: 0,
        noTemplates: 0,
        tasksCreated: 0,
        tasksToCreate: 0,
        dryRun,
        message: "No deals found matching criteria"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // 3. Get deals that already have pending tasks (single optimized query)
    const dealIds = deals.map(d => d.id);
    const { data: existingTasks, error: tasksError } = await supabase
      .from("deal_tasks")
      .select("deal_id")
      .in("deal_id", dealIds)
      .eq("status", "pending");

    if (tasksError) {
      console.error("[BACKFILL] Error checking existing tasks:", tasksError);
      throw tasksError;
    }

    // Create a Set of deal IDs that already have pending tasks
    const dealsWithTasks = new Set((existingTasks || []).map(t => t.deal_id));
    console.log(`[BACKFILL] ${dealsWithTasks.size} deals already have pending tasks`);

    // 4. Filter deals and create tasks
    let processed = 0;
    let skipped = dealsWithTasks.size;
    const allTasksToInsert: any[] = [];
    const now = new Date();

    for (const deal of deals) {
      // Skip if already has pending tasks
      if (dealsWithTasks.has(deal.id)) {
        continue;
      }

      // Get templates for this deal's stage
      const templates = templatesByStage[deal.stage_id] || [];
      if (templates.length === 0) {
        continue;
      }

      // Create tasks from templates
      for (const template of templates) {
        const dueDays = template.default_due_days || 0;
        const dueDate = new Date(now.getTime() + dueDays * 24 * 60 * 60 * 1000);

        allTasksToInsert.push({
          deal_id: deal.id,
          template_id: template.id,
          title: template.name,
          description: template.description,
          type: template.type || "other",
          status: "pending",
          due_date: dueDate.toISOString(),
          owner_id: deal.owner_id || null,
          contact_id: deal.contact_id || null,
        });
      }
      processed++;
    }

    console.log(`[BACKFILL] Will create ${allTasksToInsert.length} tasks for ${processed} deals`);

    // 5. Insert all tasks in batches (if not dry run)
    let insertedCount = 0;
    const errors: string[] = [];

    if (!dryRun && allTasksToInsert.length > 0) {
      const batchSize = 200; // Smaller batches for reliability
      for (let i = 0; i < allTasksToInsert.length; i += batchSize) {
        const batch = allTasksToInsert.slice(i, i + batchSize);
        const { error: insertError } = await supabase
          .from("deal_tasks")
          .insert(batch);

        if (insertError) {
          console.error(`[BACKFILL] Error inserting batch ${Math.floor(i / batchSize) + 1}:`, insertError);
          errors.push(`Batch ${Math.floor(i / batchSize) + 1} error: ${insertError.message}`);
        } else {
          insertedCount += batch.length;
        }
      }
    }

    const result = {
      processed,
      skipped,
      tasksCreated: dryRun ? 0 : insertedCount,
      tasksToCreate: allTasksToInsert.length,
      dryRun,
      errors: errors.length > 0 ? errors : undefined,
      stagesWithTemplates: stagesWithTemplates.length,
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
