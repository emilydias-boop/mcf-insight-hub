import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { TermoMarkdown } from '@/components/consorcio/TermoMarkdown';
import { PAPEL_CSS, PAPEL_PAGE_CSS, papelBrandHtml } from '@/lib/documentoPapel';
import { DADOS_EXEMPLO_TERMO, renderTermo } from '@/lib/consorcioTermo';



const data = { conteudo: await Bun.file('/tmp/browser/papel/v2.md').text() };
let md = renderTermo(data!.conteudo, DADOS_EXEMPLO_TERMO as any);

const body = renderToStaticMarkup(createElement(TermoMarkdown, { content: md, bare: true }));
await Bun.write('/tmp/browser/papel/out.html', `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:#fcfcfb}body{padding:22px}${PAPEL_CSS}${PAPEL_PAGE_CSS}</style><body><div class="papel">${papelBrandHtml({subtitulo:'Termo de Adesão — Consórcio'})}${body}</div>`);
console.log('ok', body.includes('papel'), (body.match(/class="papel"/g)||[]).length);
