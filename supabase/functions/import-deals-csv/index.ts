import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    console.log('📥 Iniciando processo de upload de CSV...')

    const formData = await req.formData()
    const file = formData.get('file') as File
    const originId = formData.get('origin_id') as string
    const ownerEmail = formData.get('owner_email') as string | null
    const ownerProfileId = formData.get('owner_profile_id') as string | null
    
    const defaultStageId = formData.get('default_stage_id') as string | null

    if (!file) {
      throw new Error('Nenhum arquivo fornecido')
    }

    if (!originId) {
      throw new Error('origin_id é obrigatório')
    }

    console.log(`📄 Arquivo recebido: ${file.name} (${file.size} bytes)`)
    console.log(`🎯 Origin ID: ${originId}`)
    if (ownerEmail) {
      console.log(`👤 Owner: ${ownerEmail} (${ownerProfileId})`);
    }

    // Ler conteúdo do arquivo
    const csvText = await file.text()
    const lines = csvText.trim().split('\n')
    
    if (lines.length < 2) {
      throw new Error('CSV vazio ou sem dados')
    }

    const totalDeals = lines.length - 1 // Subtrair header
    console.log(`📊 Total de negócios a processar: ${totalDeals}`)

    // Gerar nome único para o arquivo no storage
    const timestamp = Date.now()
    const fileName = `deals_${timestamp}.csv`
    const filePath = `uploads/${fileName}`

    // Upload do CSV para storage
    console.log(`☁️ Fazendo upload para storage: ${filePath}`)
    const { error: uploadError } = await supabase.storage
      .from('csv-imports')
      .upload(filePath, file, {
        contentType: 'text/csv',
        upsert: false
      })

    if (uploadError) {
      console.error('❌ Erro ao fazer upload:', uploadError)
      throw new Error(`Erro ao fazer upload do arquivo: ${uploadError.message}`)
    }

    console.log('✅ Upload concluído com sucesso')

    // Criar job pendente para processamento em background
    const { data: job, error: jobError } = await supabase
      .from('sync_jobs')
      .insert({
        job_type: 'import_deals_csv',
        status: 'pending',
        metadata: {
          file_name: fileName,
          file_path: filePath,
          total_deals: totalDeals,
          origin_id: originId,
          owner_email: ownerEmail || null,
          owner_profile_id: ownerProfileId || null,
          default_stage_id: defaultStageId || null,
          uploaded_at: new Date().toISOString()
        }
      })
      .select()
      .single()

    if (jobError) {
      console.error('❌ Erro ao criar job:', jobError)
      throw new Error(`Erro ao criar job: ${jobError.message}`)
    }

    console.log(`✅ Job criado: ${job.id}`)
    console.log('🔄 Processamento será feito em background pelo cron job')

    return new Response(
      JSON.stringify({
        success: true,
        message: 'CSV enviado para processamento em background',
        jobId: job.id,
        totalDeals,
        status: 'pending'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error: any) {
    console.error('❌ Erro geral:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: 'Erro ao processar upload do CSV'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})
