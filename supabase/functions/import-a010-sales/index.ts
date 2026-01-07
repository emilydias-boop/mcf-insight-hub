import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface A010SaleRow {
  sale_date: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  net_value: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { csvData } = await req.json();

    if (!csvData || typeof csvData !== 'string') {
      return new Response(
        JSON.stringify({ error: 'CSV data is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Starting A010 sales import...');

    // Parse CSV (skip header)
    const lines = csvData.trim().split('\n');
    const rows: A010SaleRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;

      // Parse CSV line (handle quoted fields)
      const values = line.match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g) || [];
      const cleanValues = values.map(v => v.replace(/^"|"$/g, '').trim());

      if (cleanValues.length < 5) {
        console.warn(`Skipping invalid line ${i + 1}: ${line}`);
        continue;
      }

      const [dateStr, customerName, email, phone, , valueStr] = cleanValues;

      // Parse Brazilian date format (DD/MM/YYYY)
      const dateParts = dateStr.split('/');
      if (dateParts.length !== 3) {
        console.warn(`Invalid date format at line ${i + 1}: ${dateStr}`);
        continue;
      }
      const [day, month, year] = dateParts;
      const saleDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;

      // Parse Brazilian currency (R$ 230,95 -> 230.95)
      const netValue = parseFloat(
        valueStr
          .replace('R$', '')
          .replace(/\./g, '')
          .replace(',', '.')
          .trim()
      );

      if (isNaN(netValue)) {
        console.warn(`Invalid value at line ${i + 1}: ${valueStr}`);
        continue;
      }

      rows.push({
        sale_date: saleDate,
        customer_name: customerName,
        customer_email: email || null,
        customer_phone: phone || null,
        net_value: netValue,
      });
    }

    console.log(`Parsed ${rows.length} rows from CSV`);

    // Insert in batches of 500
    const batchSize = 500;
    let inserted = 0;
    let errors = 0;

    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      
      const { error } = await supabase
        .from('a010_sales')
        .insert(batch);

      if (error) {
        console.error(`Error inserting batch ${i / batchSize + 1}:`, error);
        errors += batch.length;
      } else {
        inserted += batch.length;
        console.log(`Inserted batch ${i / batchSize + 1}: ${batch.length} rows`);
      }
    }

    console.log(`Import completed: ${inserted} inserted, ${errors} errors`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        inserted,
        errors,
        total: rows.length 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Import error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
