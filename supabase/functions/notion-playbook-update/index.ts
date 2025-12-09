import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const NOTION_API_KEY = Deno.env.get('NOTION_API_KEY');

function mapRoleToCargo(role: string): string {
  const map: Record<string, string> = {
    'sdr': 'SDR',
    'closer': 'Closer',
    'coordenador': 'Coordenador',
    'gestor_sdr': 'Gestor SDR',
    'gestor_closer': 'Gestor Closer',
    'master': 'Master',
    'admin': 'Admin',
    'manager': 'Manager',
    'viewer': 'Viewer',
  };
  return map[role] || 'Viewer';
}

function mapCategoriaToNotion(categoria: string): string {
  const map: Record<string, string> = {
    'onboarding': 'Onboarding',
    'processo': 'Processo',
    'politica': 'Política',
    'script': 'Script',
    'treinamento': 'Treinamento',
    'outro': 'Outro',
  };
  return map[categoria] || 'Outro';
}

function mapTipoConteudoToNotion(tipo: string): string {
  const map: Record<string, string> = {
    'texto': 'texto',
    'link': 'link',
    'arquivo': 'arquivo',
  };
  return map[tipo] || 'texto';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!NOTION_API_KEY) {
      throw new Error('NOTION_API_KEY não configurada');
    }

    const body = await req.json();
    const { pageId, titulo, role, categoria, tipo_conteudo, obrigatorio, ativo, link_url, versao } = body;

    if (!pageId) {
      throw new Error('pageId é obrigatório');
    }

    console.log(`📝 Atualizando playbook no Notion: ${pageId}`);

    // Construir properties para atualizar
    const properties: Record<string, any> = {};

    if (titulo !== undefined) {
      properties['Name'] = {
        title: [{ text: { content: titulo } }]
      };
    }

    if (role !== undefined) {
      properties['Cargo'] = {
        select: { name: mapRoleToCargo(role) }
      };
    }

    if (categoria !== undefined) {
      properties['Categoria'] = {
        select: { name: mapCategoriaToNotion(categoria) }
      };
    }

    if (tipo_conteudo !== undefined) {
      properties['Tipo_conteudo'] = {
        select: { name: mapTipoConteudoToNotion(tipo_conteudo) }
      };
    }

    if (obrigatorio !== undefined) {
      properties['Obrigatorio'] = {
        checkbox: obrigatorio
      };
    }

    if (ativo !== undefined) {
      properties['Ativo'] = {
        checkbox: ativo
      };
    }

    if (versao !== undefined) {
      properties['Versao'] = {
        rich_text: [{ text: { content: versao } }]
      };
    }

    if (link_url !== undefined) {
      properties['URL'] = link_url ? { url: link_url } : { url: null };
    }

    const response = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${NOTION_API_KEY}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ properties }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Erro Notion API:', errorText);
      throw new Error(`Notion API error: ${response.status}`);
    }

    const data = await response.json();

    console.log(`✅ Playbook atualizado: ${data.id}`);

    return new Response(
      JSON.stringify({ 
        notion_page_id: data.id, 
        url: data.url,
        success: true 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('❌ Erro:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
