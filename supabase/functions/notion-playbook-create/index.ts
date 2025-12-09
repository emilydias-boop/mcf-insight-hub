import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const NOTION_API_KEY = Deno.env.get('NOTION_API_KEY');
const NOTION_DATABASE_ID = '0297a9586e9d4a0f99165ecb2a71d8e9';

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
    const { titulo, role, categoria, tipo_conteudo, obrigatorio, ativo, link_url, versao, conteudo_rico } = body;

    console.log(`📝 Criando playbook no Notion: ${titulo}`);

    // Construir properties para o Notion
    const properties: Record<string, any> = {
      'Name': {
        title: [{ text: { content: titulo || 'Sem título' } }]
      },
      'Cargo': {
        select: { name: mapRoleToCargo(role) }
      },
      'Categoria': {
        select: { name: mapCategoriaToNotion(categoria) }
      },
      'Tipo_conteudo': {
        select: { name: mapTipoConteudoToNotion(tipo_conteudo) }
      },
      'Obrigatorio': {
        checkbox: obrigatorio || false
      },
      'Ativo': {
        checkbox: ativo !== undefined ? ativo : true
      },
      'Versao': {
        rich_text: [{ text: { content: versao || 'v1' } }]
      },
    };

    // Adicionar URL se for tipo link
    if (tipo_conteudo === 'link' && link_url) {
      properties['URL'] = { url: link_url };
    }

    // Construir conteúdo da página se for tipo texto
    const children: any[] = [];
    if (tipo_conteudo === 'texto' && conteudo_rico) {
      // Dividir o conteúdo em parágrafos
      const paragraphs = conteudo_rico.split('\n').filter((p: string) => p.trim());
      for (const paragraph of paragraphs) {
        children.push({
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [{ type: 'text', text: { content: paragraph } }]
          }
        });
      }
    }

    const requestBody: any = {
      parent: { database_id: NOTION_DATABASE_ID },
      properties,
    };

    if (children.length > 0) {
      requestBody.children = children;
    }

    const response = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_API_KEY}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Erro Notion API:', errorText);
      throw new Error(`Notion API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    console.log(`✅ Playbook criado: ${data.id}`);

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
