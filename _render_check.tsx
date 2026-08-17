import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { TermoMarkdown } from '@/components/consorcio/TermoMarkdown';
import { PAPEL_CSS, PAPEL_PAGE_CSS, papelBrandHtml } from '@/lib/documentoPapel';
import { DADOS_EXEMPLO_TERMO, renderTermo } from '@/lib/consorcioTermo';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env.SUPA_URL!, process.env.SUPA_KEY!);
const { data } = await sb.from('consorcio_termo_modelos').select('conteudo').eq('tipo','adesao').eq('ativo',true).single();
let md = renderTermo(data!.conteudo, DADOS_EXEMPLO_TERMO as any);
md += `\n\n## 6. TESTES DE FORMATAÇÃO\n\n**Importante:** esta frase isolada deve ser parágrafo justificado, não grade.\n\n**E-mail:** joao_silva_2@gmail.com\n**Endereço:** Rua _Teste_ 10, ap_2_b\n\n3. item que começa em três\n\n4. item seguinte após linha em branco\n`;
const body = renderToStaticMarkup(createElement(TermoMarkdown, { content: md, bare: true }));
await Bun.write('/tmp/browser/papel/out.html', `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:#fcfcfb}body{padding:22px}${PAPEL_CSS}${PAPEL_PAGE_CSS}</style><body><div class="papel">${papelBrandHtml({subtitulo:'Termo de Adesão — Consórcio'})}${body}</div>`);
console.log('ok', body.includes('papel'), (body.match(/class="papel"/g)||[]).length);
