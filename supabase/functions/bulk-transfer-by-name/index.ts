import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { names, origin_id, new_owner_email, new_owner_profile_id, new_owner_name, dry_run = false, current_owner_profile_id } = await req.json();

    // Mode 1: Transfer by current owner (no names needed)
    if (current_owner_profile_id && origin_id && new_owner_email && new_owner_profile_id) {
      console.log(`Processing bulk transfer from owner ${current_owner_profile_id} to ${new_owner_email}`);

      // Find deals matching the current owner in the specified origin/pipeline
      const { data: matchingDeals, error: fetchError } = await supabase
        .from("crm_deals")
        .select("id, name")
        .eq("origin_id", origin_id)
        .eq("owner_profile_id", current_owner_profile_id);

      if (fetchError) {
        console.error("Error fetching deals:", fetchError);
        return new Response(
          JSON.stringify({ error: fetchError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`Found ${matchingDeals?.length || 0} deals from current owner`);

      if (!matchingDeals || matchingDeals.length === 0) {
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: "No matching deals found for current owner",
            matched: 0,
            transferred: 0 
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (dry_run) {
        return new Response(
          JSON.stringify({ 
            success: true, 
            dry_run: true,
            matched: matchingDeals.length,
            deals: matchingDeals
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const dealIds = matchingDeals.map(d => d.id);

      // Update deals with new owner
      const { error: updateError } = await supabase
        .from("crm_deals")
        .update({
          owner_id: new_owner_email,
          owner_profile_id: new_owner_profile_id,
          updated_at: new Date().toISOString()
        })
        .in("id", dealIds);

      if (updateError) {
        console.error("Error updating deals:", updateError);
        return new Response(
          JSON.stringify({ error: updateError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Register activities for each deal
      const activities = dealIds.map(dealId => ({
        deal_id: dealId,
        activity_type: "owner_change",
        description: `Transferido para ${new_owner_name || new_owner_email} (correção em massa)`,
        metadata: {
          previous_owner_profile_id: current_owner_profile_id,
          new_owner: new_owner_email,
          new_owner_name: new_owner_name || new_owner_email,
          transferred_by: "Sistema",
          transferred_at: new Date().toISOString(),
          bulk_transfer: true,
          transfer_source: "bulk-transfer-by-name (owner correction)"
        }
      }));

      const { error: activityError } = await supabase
        .from("deal_activities")
        .insert(activities);

      if (activityError) {
        console.error("Error inserting activities:", activityError);
      }

      console.log(`Transfer complete: ${dealIds.length} deals transferred to ${new_owner_email}`);

      return new Response(
        JSON.stringify({
          success: true,
          matched: matchingDeals.length,
          transferred: dealIds.length,
          new_owner: new_owner_email,
          previous_owner_profile_id: current_owner_profile_id
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mode 2: Transfer orphan deals by name (original behavior)
    if (!names || !Array.isArray(names) || names.length === 0) {
      return new Response(
        JSON.stringify({ error: "names array is required (or use current_owner_profile_id for owner-to-owner transfer)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!origin_id || !new_owner_email || !new_owner_profile_id) {
      return new Response(
        JSON.stringify({ error: "origin_id, new_owner_email, and new_owner_profile_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing bulk transfer: ${names.length} names to ${new_owner_email}`);

    // Find orphan deals matching the names in the specified origin/pipeline
    const { data: matchingDeals, error: fetchError } = await supabase
      .from("crm_deals")
      .select("id, name")
      .eq("origin_id", origin_id)
      .is("owner_id", null)
      .in("name", names);

    if (fetchError) {
      console.error("Error fetching deals:", fetchError);
      return new Response(
        JSON.stringify({ error: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${matchingDeals?.length || 0} matching orphan deals`);

    if (!matchingDeals || matchingDeals.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "No matching orphan deals found",
          matched: 0,
          transferred: 0 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (dry_run) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          dry_run: true,
          matched: matchingDeals.length,
          deals: matchingDeals
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const dealIds = matchingDeals.map(d => d.id);

    // 2. Update deals with new owner
    const { error: updateError, count } = await supabase
      .from("crm_deals")
      .update({
        owner_id: new_owner_email,
        owner_profile_id: new_owner_profile_id,
        updated_at: new Date().toISOString()
      })
      .in("id", dealIds);

    if (updateError) {
      console.error("Error updating deals:", updateError);
      return new Response(
        JSON.stringify({ error: updateError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Updated ${dealIds.length} deals`);

    // 3. Register activities for each deal
    const activities = dealIds.map(dealId => ({
      deal_id: dealId,
      activity_type: "owner_change",
      description: `Transferido para ${new_owner_name || new_owner_email} (em massa via script)`,
      metadata: {
        previous_owner: null,
        new_owner: new_owner_email,
        new_owner_name: new_owner_name || new_owner_email,
        transferred_by: "Sistema",
        transferred_at: new Date().toISOString(),
        bulk_transfer: true,
        transfer_source: "bulk-transfer-by-name"
      }
    }));

    const { error: activityError } = await supabase
      .from("deal_activities")
      .insert(activities);

    if (activityError) {
      console.error("Error inserting activities:", activityError);
      // Don't fail the whole operation, just log the error
    }

    console.log(`Transfer complete: ${dealIds.length} deals transferred to ${new_owner_email}`);

    return new Response(
      JSON.stringify({
        success: true,
        matched: matchingDeals.length,
        transferred: dealIds.length,
        new_owner: new_owner_email
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
