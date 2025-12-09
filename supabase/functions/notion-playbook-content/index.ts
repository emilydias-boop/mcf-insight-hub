import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const NOTION_API_KEY = Deno.env.get('NOTION_API_KEY');

function extractRichText(richText: any[]): string {
  if (!richText || !Array.isArray(richText)) return '';
  return richText.map(t => t.plain_text || '').join('');
}

interface FileInfo {
  name: string;
  url: string;
  type: 'pdf' | 'image' | 'other';
  mimeType?: string;
}

function getFileType(url: string, name: string): 'pdf' | 'image' | 'other' {
  const lower = (name || url).toLowerCase();
  if (lower.endsWith('.pdf')) return 'pdf';
  if (lower.match(/\.(jpg|jpeg|png|gif|webp|svg|bmp)$/)) return 'image';
  return 'other';
}

function extractFilesFromBlock(block: any): FileInfo[] {
  const files: FileInfo[] = [];
  const type = block.type;
  const content = block[type];

  if (type === 'file') {
    const fileUrl = content?.file?.url || content?.external?.url || '';
    const fileName = content?.name || 'Arquivo';
    if (fileUrl) {
      files.push({
        name: fileName,
        url: fileUrl,
        type: getFileType(fileUrl, fileName),
      });
    }
  }

  if (type === 'pdf') {
    const pdfUrl = content?.file?.url || content?.external?.url || '';
    if (pdfUrl) {
      files.push({
        name: extractRichText(content?.caption) || 'Documento PDF',
        url: pdfUrl,
        type: 'pdf',
      });
    }
  }

  if (type === 'image') {
    const imageUrl = content?.file?.url || content?.external?.url || '';
    if (imageUrl) {
      files.push({
        name: extractRichText(content?.caption) || 'Imagem',
        url: imageUrl,
        type: 'image',
      });
    }
  }

  return files;
}

function blockToMarkdown(block: any): string {
  const type = block.type;
  const content = block[type];

  switch (type) {
    case 'paragraph':
      return extractRichText(content?.rich_text) + '\n';
    
    case 'heading_1':
      return '# ' + extractRichText(content?.rich_text) + '\n';
    
    case 'heading_2':
      return '## ' + extractRichText(content?.rich_text) + '\n';
    
    case 'heading_3':
      return '### ' + extractRichText(content?.rich_text) + '\n';
    
    case 'bulleted_list_item':
      return '• ' + extractRichText(content?.rich_text) + '\n';
    
    case 'numbered_list_item':
      return '1. ' + extractRichText(content?.rich_text) + '\n';
    
    case 'to_do':
      const checked = content?.checked ? '☑' : '☐';
      return checked + ' ' + extractRichText(content?.rich_text) + '\n';
    
    case 'toggle':
      return '▶ ' + extractRichText(content?.rich_text) + '\n';
    
    case 'quote':
      return '> ' + extractRichText(content?.rich_text) + '\n';
    
    case 'divider':
      return '---\n';
    
    case 'code':
      const code = extractRichText(content?.rich_text);
      const language = content?.language || '';
      return '```' + language + '\n' + code + '\n```\n';
    
    case 'callout':
      const icon = content?.icon?.emoji || '💡';
      return icon + ' ' + extractRichText(content?.rich_text) + '\n';
    
    case 'image':
      const imageUrl = content?.file?.url || content?.external?.url || '';
      const caption = extractRichText(content?.caption) || 'Imagem';
      return `![${caption}](${imageUrl})\n`;
    
    case 'file':
      const fileUrl = content?.file?.url || content?.external?.url || '';
      const fileName = content?.name || 'Arquivo';
      return `📎 [${fileName}](${fileUrl})\n`;
    
    case 'pdf':
      const pdfUrl = content?.file?.url || content?.external?.url || '';
      return `📄 [PDF](${pdfUrl})\n`;
    
    case 'video':
      const videoUrl = content?.file?.url || content?.external?.url || '';
      return `🎬 [Vídeo](${videoUrl})\n`;
    
    case 'embed':
      return `🔗 [Embed](${content?.url})\n`;
    
    case 'bookmark':
      return `🔖 [${content?.url}](${content?.url})\n`;
    
    case 'table':
      return '[Tabela]\n';
    
    default:
      return '';
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!NOTION_API_KEY) {
      throw new Error('NOTION_API_KEY não configurada');
    }

    const { pageId } = await req.json();

    if (!pageId) {
      throw new Error('pageId é obrigatório');
    }

    console.log(`📖 Buscando conteúdo do playbook: ${pageId}`);

    // Buscar blocos da página
    const response = await fetch(
      `https://api.notion.com/v1/blocks/${pageId}/children?page_size=100`,
      {
        headers: {
          'Authorization': `Bearer ${NOTION_API_KEY}`,
          'Notion-Version': '2022-06-28',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Erro Notion API:', errorText);
      throw new Error(`Notion API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Converter blocos para markdown e extrair arquivos
    let markdown = '';
    const files: FileInfo[] = [];
    
    for (const block of data.results) {
      markdown += blockToMarkdown(block);
      
      // Extrair arquivos dos blocos
      const blockFiles = extractFilesFromBlock(block);
      files.push(...blockFiles);
    }

    console.log(`✅ Conteúdo extraído: ${markdown.length} caracteres, ${files.length} arquivos`);

    return new Response(
      JSON.stringify({ 
        content: markdown.trim(),
        files,
        blocks: data.results,
        hasMore: data.has_more 
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
