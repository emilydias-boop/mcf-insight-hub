import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const NOTION_API_KEY = Deno.env.get('NOTION_API_KEY');
    if (!NOTION_API_KEY) {
      throw new Error('NOTION_API_KEY não configurado');
    }

    const { pageId, content } = await req.json();

    if (!pageId) {
      return new Response(JSON.stringify({ error: 'pageId é obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Atualizando conteúdo da página ${pageId}`);

    // 1. Buscar blocos existentes da página
    const blocksResponse = await fetch(`https://api.notion.com/v1/blocks/${pageId}/children?page_size=100`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${NOTION_API_KEY}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
    });

    if (!blocksResponse.ok) {
      const errorText = await blocksResponse.text();
      console.error('Erro ao buscar blocos:', errorText);
      throw new Error(`Erro ao buscar blocos: ${blocksResponse.status}`);
    }

    const blocksData = await blocksResponse.json();
    const existingBlocks = blocksData.results || [];

    console.log(`Encontrados ${existingBlocks.length} blocos existentes`);

    // 2. Deletar blocos existentes (exceto arquivos/imagens)
    for (const block of existingBlocks) {
      // Manter arquivos e imagens
      if (block.type === 'file' || block.type === 'image' || block.type === 'pdf') {
        console.log(`Mantendo bloco ${block.type}: ${block.id}`);
        continue;
      }

      try {
        const deleteResponse = await fetch(`https://api.notion.com/v1/blocks/${block.id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${NOTION_API_KEY}`,
            'Notion-Version': '2022-06-28',
          },
        });

        if (!deleteResponse.ok) {
          console.warn(`Falha ao deletar bloco ${block.id}:`, await deleteResponse.text());
        }
      } catch (err) {
        console.warn(`Erro ao deletar bloco ${block.id}:`, err);
      }
    }

    // 3. Converter conteúdo em blocos do Notion
    const newBlocks = convertContentToBlocks(content || '');

    console.log(`Criando ${newBlocks.length} novos blocos`);

    // 4. Adicionar novos blocos
    if (newBlocks.length > 0) {
      const appendResponse = await fetch(`https://api.notion.com/v1/blocks/${pageId}/children`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${NOTION_API_KEY}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ children: newBlocks }),
      });

      if (!appendResponse.ok) {
        const errorText = await appendResponse.text();
        console.error('Erro ao adicionar blocos:', errorText);
        throw new Error(`Erro ao adicionar blocos: ${appendResponse.status}`);
      }
    }

    console.log('Conteúdo atualizado com sucesso');

    return new Response(JSON.stringify({ success: true, pageId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('Erro:', error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Converte texto/markdown simples em blocos do Notion
function convertContentToBlocks(content: string): any[] {
  const lines = content.split('\n');
  const blocks: any[] = [];

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Linha vazia
    if (!trimmedLine) {
      continue;
    }

    // Heading 1
    if (trimmedLine.startsWith('# ')) {
      blocks.push({
        object: 'block',
        type: 'heading_1',
        heading_1: {
          rich_text: [{ type: 'text', text: { content: trimmedLine.slice(2) } }],
        },
      });
      continue;
    }

    // Heading 2
    if (trimmedLine.startsWith('## ')) {
      blocks.push({
        object: 'block',
        type: 'heading_2',
        heading_2: {
          rich_text: [{ type: 'text', text: { content: trimmedLine.slice(3) } }],
        },
      });
      continue;
    }

    // Heading 3
    if (trimmedLine.startsWith('### ')) {
      blocks.push({
        object: 'block',
        type: 'heading_3',
        heading_3: {
          rich_text: [{ type: 'text', text: { content: trimmedLine.slice(4) } }],
        },
      });
      continue;
    }

    // Bullet list
    if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ')) {
      blocks.push({
        object: 'block',
        type: 'bulleted_list_item',
        bulleted_list_item: {
          rich_text: [{ type: 'text', text: { content: trimmedLine.slice(2) } }],
        },
      });
      continue;
    }

    // Numbered list
    const numberedMatch = trimmedLine.match(/^(\d+)\.\s+(.+)$/);
    if (numberedMatch) {
      blocks.push({
        object: 'block',
        type: 'numbered_list_item',
        numbered_list_item: {
          rich_text: [{ type: 'text', text: { content: numberedMatch[2] } }],
        },
      });
      continue;
    }

    // Paragraph (default)
    blocks.push({
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: [{ type: 'text', text: { content: trimmedLine } }],
      },
    });
  }

  return blocks;
}
