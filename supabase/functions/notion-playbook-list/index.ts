import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const NOTION_API_KEY = Deno.env.get('NOTION_API_KEY');
const NOTION_DATABASE_ID = '0297a9586e9d4a0f99165ecb2a71d8e9';

interface NotionPage {
  id: string;
  properties: Record<string, any>;
  url: string;
}

function mapCargoToRole(cargo: string | null): string {
  if (!cargo) return 'viewer';
  const map: Record<string, string> = {
    'SDR': 'sdr',
    'Closer': 'closer',
    'Coordenador': 'coordenador',
    'Gestor SDR': 'gestor_sdr',
    'Gestor Closer': 'gestor_closer',
    'Master': 'master',
    'Admin': 'admin',
    'Manager': 'manager',
    'Viewer': 'viewer',
  };
  return map[cargo] || 'viewer';
}

function mapCategoriaFromNotion(categoria: string | null): string {
  if (!categoria) return 'outro';
  const map: Record<string, string> = {
    'Onboarding': 'onboarding',
    'Processo': 'processo',
    'Política': 'politica',
    'Script': 'script',
    'Treinamento': 'treinamento',
    'Outro': 'outro',
  };
  return map[categoria] || 'outro';
}

function mapTipoConteudoFromNotion(tipo: string | null): string {
  if (!tipo) return 'texto';
  const map: Record<string, string> = {
    'texto': 'texto',
    'link': 'link',
    'arquivo': 'arquivo',
  };
  return map[tipo] || 'texto';
}

function extractProperty(properties: Record<string, any>, key: string): any {
  const prop = properties[key];
  if (!prop) return null;

  switch (prop.type) {
    case 'title':
      return prop.title?.[0]?.plain_text || '';
    case 'rich_text':
      return prop.rich_text?.[0]?.plain_text || '';
    case 'select':
      return prop.select?.name || null;
    case 'checkbox':
      return prop.checkbox || false;
    case 'url':
      return prop.url || null;
    default:
      return null;
  }
}

function mapNotionPageToPlaybook(page: NotionPage): any {
  const props = page.properties;
  
  return {
    notion_page_id: page.id,
    titulo: extractProperty(props, 'Name') || 'Sem título',
    role: mapCargoToRole(extractProperty(props, 'Cargo')),
    categoria: mapCategoriaFromNotion(extractProperty(props, 'Categoria')),
    tipo_conteudo: mapTipoConteudoFromNotion(extractProperty(props, 'Tipo_conteudo')),
    obrigatorio: extractProperty(props, 'Obrigatorio') || false,
    ativo: extractProperty(props, 'Ativo') || false,
    link_url: extractProperty(props, 'URL'),
    versao: extractProperty(props, 'Versao') || 'v1',
    notion_url: page.url,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!NOTION_API_KEY) {
      throw new Error('NOTION_API_KEY não configurada');
    }

    const { role, ativo } = await req.json().catch(() => ({}));

    console.log(`📚 Listando playbooks do Notion - role: ${role}, ativo: ${ativo}`);

    // Construir filtros
    const filters: any[] = [];
    
    if (role) {
      const cargoMap: Record<string, string> = {
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
      filters.push({
        property: 'Cargo',
        select: { equals: cargoMap[role] || role }
      });
    }

    if (ativo !== undefined) {
      filters.push({
        property: 'Ativo',
        checkbox: { equals: ativo }
      });
    }

    const queryBody: any = {
      sorts: [
        { property: 'Cargo', direction: 'ascending' },
        { property: 'Categoria', direction: 'ascending' },
        { property: 'Name', direction: 'ascending' },
      ],
    };

    if (filters.length > 0) {
      queryBody.filter = filters.length === 1 
        ? filters[0] 
        : { and: filters };
    }

    const response = await fetch(
      `https://api.notion.com/v1/databases/${NOTION_DATABASE_ID}/query`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${NOTION_API_KEY}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(queryBody),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Erro Notion API:', errorText);
      throw new Error(`Notion API error: ${response.status}`);
    }

    const data = await response.json();
    const docs = data.results.map(mapNotionPageToPlaybook);

    console.log(`✅ Encontrados ${docs.length} playbooks`);

    return new Response(
      JSON.stringify({ docs, hasMore: data.has_more }),
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
