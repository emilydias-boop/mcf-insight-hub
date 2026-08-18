/**
 * Tema único dos documentos institucionais (Termo de Adesão, Comprovante de
 * Cadastro e Relatório do Lead). Fonte única do CSS: a MESMA folha é usada na
 * tela e na janela de impressão, para que o PDF saia idêntico ao que se vê.
 *
 * Importante: o conteúdo armazenado dos documentos continua sendo **markdown**.
 * Este módulo é só apresentação — nada aqui participa do `conteudo_hash`.
 *
 * Identidade visual: verde-limão #B3F302, grafite #101010, branco. Display em
 * Nasalization (sempre caixa alta, o subset embutido só tem maiúsculas) e texto
 * em Poppins. O logo e a fonte vêm embutidos de `marcaAtivos` para não haver
 * corrida de rede antes do `window.print()`.
 */

import { FONTE_MARCA_CSS, LOGO_MCF_VERDE } from '@/lib/marcaAtivos';

export const EMPRESA_RAZAO_SOCIAL = 'VMX Participações e Empreendimentos Ltda';
export const EMPRESA_CNPJ = '39.662.160/0001-31';

export const PAPEL_CSS = `${FONTE_MARCA_CSS}
/* Tinta explícita: nada dentro do papel pode herdar os tokens de tema da
   aplicação (que é escura por padrão). Redefinir as variáveis aqui é a rede de
   segurança para qualquer componente do design system que entre no papel. */
.papel{
  --background:60 20% 99%;--foreground:0 0% 10%;
  --card:60 20% 99%;--card-foreground:0 0% 10%;
  --popover:60 20% 99%;--popover-foreground:0 0% 10%;
  --muted:60 6% 96%;--muted-foreground:0 0% 42%;
  --primary:0 0% 6%;--primary-foreground:0 0% 100%;
  --secondary:60 6% 96%;--secondary-foreground:0 0% 10%;
  --accent:74 98% 48%;--accent-foreground:0 0% 6%;
  --destructive:0 72% 42%;--destructive-foreground:0 0% 100%;
  --border:220 10% 88%;--input:220 10% 88%;--ring:74 98% 48%;
}
/* As faixas grafite e as barras verdes SÃO a identidade: sem isto o Chrome
   descarta os fundos quando "Gráficos de plano de fundo" está desligado. */
.papel{background:#fcfcfb;color:#1a1c20;font-size:13px;line-height:1.62;
  font-family:'Poppins',-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Roboto,sans-serif;
  -webkit-print-color-adjust:exact;print-color-adjust:exact}

.papel h1{background:#101010;color:#fff;font-family:'Nasalization',Impact,sans-serif;
  font-size:20px;line-height:1.24;letter-spacing:.005em;text-transform:uppercase;
  font-weight:400;margin:0 0 20px;padding:4px 18px 18px}
.papel h2{font-size:10.5px;margin:24px 0 10px;color:#101010;text-transform:uppercase;
  letter-spacing:.08em;font-weight:600;border:0;border-left:3px solid #B3F302;
  background:#f6f7f5;padding:7px 11px}
.papel h3{font-size:11.5px;margin:18px 0 7px;color:#101010;font-weight:600}
.papel p{margin:0 0 11px;text-align:justify}
.papel ul,.papel ol{margin:0 0 12px;padding-left:22px}
.papel ul{list-style:disc}
.papel ol{list-style:decimal}
.papel li{margin:0 0 5px}

/* Cabeçalho: a faixa \`.brand\` e o \`h1\` são irmãos no DOM, mas os dois têm
   fundo grafite e margem zero entre eles — leem como um bloco único. */
.papel .brand{display:flex;justify-content:space-between;align-items:flex-start;
  background:#101010;border:0;padding:16px 18px 10px;margin:0}
.papel .brand .logo{font-size:0;line-height:0}
.papel .brand .logo img{height:32px;width:auto;display:block}
.papel .brand .logo small{display:block;font-size:8.5px;font-weight:500;color:#9aa0aa;
  letter-spacing:.16em;text-transform:uppercase;margin-top:7px;line-height:1.4}
.papel .brand .meta{text-align:right;font-size:9px;color:#9aa0aa;line-height:1.75;
  letter-spacing:.01em;white-space:nowrap}
/* Nota de apoio — usada no corpo do Relatório do Lead. */
.papel .sub{font-size:10.5px;color:#6b7078;letter-spacing:normal;
  text-transform:none;line-height:1.55;margin:0 0 6px}
/* Kicker do cabeçalho: só dentro da faixa grafite. */
.papel .brand .sub{font-size:8.5px;color:#b9bec7;letter-spacing:.14em;
  text-transform:uppercase;line-height:1.4;margin:9px 0 0}

/* Rótulo em cima, valor embaixo — igual ao PDF institucional. */
.papel .kv{display:grid;grid-template-columns:repeat(2,1fr);gap:0 28px;margin:0 0 10px}
.papel .kv > div{display:flex;flex-direction:column;gap:2px;align-items:flex-start;
  border-bottom:1px solid #e2e5ea;padding:8px 0;font-size:12.5px}
.papel .kv b{color:#8b9099;font-weight:500;min-width:0;font-size:8.5px;
  letter-spacing:.1em;text-transform:uppercase;line-height:1.4}
.papel .kv > div > span{color:#1a1c20;font-weight:500;font-size:12.5px;line-height:1.45}
.papel .kv .full{grid-column:1/-1}

.papel table.doc{width:100%;border-collapse:collapse;margin:8px 0 14px;font-size:12px}
.papel table.doc th{background:#101010;color:#fff;text-align:left;padding:8px 10px;
  font-size:9.5px;letter-spacing:.07em;text-transform:uppercase;font-weight:600}
.papel table.doc td{padding:7px 10px;border-bottom:1px solid #e4e4df}
.papel table.doc tr:nth-child(even) td{background:#f6f7f5}
/* Linha de total: marcada em \`TermoMarkdown\` quando a 1ª célula é "Total". */
.papel table.doc tr.tot td{background:#eef7cc;border-top:1.5px solid #B3F302;
  border-bottom:0;font-weight:600;color:#101010}

.papel .tag{display:inline-block;font-size:10px;font-weight:700;border-radius:4px;padding:2px 7px}
.papel .tag.mcf{background:#eef7cc;color:#101010;border:1px solid #cfe86b}
.papel .tag.cli{background:#eef0f3;color:#4a4f57}
.papel .tag.pg{background:#d7f5d7;color:#166534}
.papel .tag.pend{background:#fef0c7;color:#92400e}
.papel .tag.err{background:#fee2e2;color:#991b1b}

.papel .assin{border:1px solid #d8dbe0;border-left:3px solid #B3F302;border-radius:8px;
  padding:18px 20px;margin-top:18px;background:#fbfcf6}
.papel .assin h3{margin:0 0 12px;font-size:10.5px;color:#101010;
  text-transform:uppercase;letter-spacing:.08em}
.papel .chk{display:flex;gap:9px;align-items:flex-start;font-size:11.5px;color:#444;line-height:1.5;margin:12px 0 14px}

.papel .cert{border:1px solid #d8dbe0;border-left:3px solid #B3F302;border-radius:8px;
  background:#f6f7f5;margin-top:24px;padding:14px 16px}
.papel .cert h3{margin:0 0 6px;font-size:10.5px;color:#101010;
  text-transform:uppercase;letter-spacing:.08em}
.papel .cert .hashline{font-family:ui-monospace,Menlo,monospace;font-size:9.5px;color:#4a4f57;
  word-break:break-all;background:#ecefe4;padding:7px 9px;border-radius:5px;margin-top:9px}
.papel .legal{font-size:9.5px;color:#777;line-height:1.55;margin-top:12px}

/* Rodapé institucional — filete verde + assinatura da marca. */
.papel .rodape-doc{margin-top:28px;padding-top:10px;border-top:2px solid #B3F302;
  font-size:8.5px;color:#8b9099;letter-spacing:.08em;text-transform:uppercase;text-align:left}

.papel .tl{position:relative;padding-left:26px}
.papel .tl::before{content:"";position:absolute;left:7px;top:5px;bottom:5px;width:2px;background:#d5d5d0}
.papel .ev{position:relative;padding-bottom:16px}
.papel .ev::before{content:"";position:absolute;left:-23px;top:4px;width:11px;height:11px;
  border-radius:50%;background:#101010;border:2px solid #fcfcfb}
.papel .ev.warn::before{background:#fab219}
.papel .ev.ok::before{background:#166534}
.papel .ev .when{font-size:10.5px;color:#777;font-weight:600}
.papel .ev .what{font-size:12.5px;font-weight:700;margin:1px 0 2px}
.papel .ev .who{font-size:11.5px;color:#555}

.papel .tarja{background:#101010;color:#B3F302;border-left:4px solid #B3F302;
  font-weight:800;font-size:11px;letter-spacing:.05em;
  padding:9px 14px;border-radius:6px;margin-bottom:18px;text-transform:uppercase}

/* Texto secundário e blocos — substituem text-muted-foreground / border-border. */
.papel .dim{color:#777}
.papel .dim2{color:#555}
.papel .bloco{border:1px solid #e4e4df;border-radius:7px;padding:12px;background:#fff}
.papel .aviso{border:1px solid #f0b3b3;background:#fdf3f3;color:#8f1d1d;
  border-radius:6px;padding:9px 11px;font-size:11.5px;line-height:1.5;margin:6px 0}

@media print{
  .papel{font-size:11.5pt}
  .papel table.doc{break-inside:auto}
  .papel thead{display:table-header-group}
  .papel tr,.papel li,.papel .ev{break-inside:avoid}
  .papel h2{break-after:avoid}
  .no-print{display:none!important}
}
@media(max-width:760px){.papel .kv{grid-template-columns:1fr}}
`;

/** Regra `@page` — vale SÓ onde a impressão é do documento (janela de impressão,
 *  página pública e relatório). Nunca dentro do `PAPEL_CSS`, senão vaza para a app. */
export const PAPEL_PAGE_CSS = `@media print{@page{size:A4;margin:16mm}}`;

const PAPEL_STYLE_ID = 'mcf-papel-css';

/** Injeta o `PAPEL_CSS` no `<head>` UMA única vez (idempotente por id). */
export function ensurePapelStylesheet(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(PAPEL_STYLE_ID)) return;
  const el = document.createElement('style');
  el.id = PAPEL_STYLE_ID;
  el.textContent = PAPEL_CSS;
  document.head.appendChild(el);
}

export function escapeHtml(v: string): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Cabeçalho institucional — logotipo em imagem (data URL embutida). */
export function papelBrandHtml(opts: { subtitulo?: string } = {}): string {
  const data = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  return `<div class="brand">
  <div><div class="logo"><img src="${LOGO_MCF_VERDE}" alt="MCF Capital"><small>Minha Casa Financiada</small></div>${
    opts.subtitulo ? `<div class="sub">${escapeHtml(opts.subtitulo)}</div>` : ''
  }</div>
  <div class="meta">${escapeHtml(EMPRESA_RAZAO_SOCIAL)}<br>
    CNPJ ${escapeHtml(EMPRESA_CNPJ)}<br>Documento gerado em ${escapeHtml(data)}</div>
</div>`;
}

export interface AbrirParaImpressaoOpts {
  /** Vira o `document.title` da janela — é o nome sugerido do arquivo PDF. */
  titulo: string;
  /** HTML do corpo — SEM wrapper `.papel` (ele é criado aqui, uma única vez). */
  corpoHtml: string;
  /** Tarja opcional no topo (ex.: "DOCUMENTO CANCELADO EM ..."). */
  avisoTopo?: string | null;
  subtitulo?: string;
}

/**
 * Abre a janela de impressão de forma SÍNCRONA. Precisa ser chamada dentro do
 * handler do clique: Safari/iOS bloqueia `window.open` depois de qualquer
 * fronteira assíncrona (import dinâmico, fetch, await).
 */
export function abrirJanelaImpressao(): Window | null {
  return window.open('', '_blank', 'width=900,height=1000');
}

/** Escreve o documento numa janela já aberta e dispara a impressão. */
export function escreverImpressao(win: Window, opts: AbrirParaImpressaoOpts): void {
  win.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(opts.titulo)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>html,body{margin:0;padding:0;background:#fcfcfb}
body{padding:22px}
@media print{body{padding:0}}
${PAPEL_CSS}
${PAPEL_PAGE_CSS}</style></head>
<body><div class="papel">
${opts.avisoTopo ? `<div class="tarja">${escapeHtml(opts.avisoTopo)}</div>` : ''}
${papelBrandHtml({ subtitulo: opts.subtitulo })}
${opts.corpoHtml}
<p class="rodape-doc">MCF Capital · documento gerado eletronicamente</p>
</div>
<script>window.onload=function(){var feito=false;
var go=function(){if(feito)return;feito=true;window.focus();window.print();};
if(document.fonts&&document.fonts.ready){document.fonts.ready.then(function(){setTimeout(go,150);});setTimeout(go,3000);}
else{setTimeout(go,250);}};</script>
</body></html>`);
  win.document.close();
}

/**
 * Conveniência para chamadas 100% síncronas (desktop, sem import dinâmico).
 * Devolve `false` quando o navegador bloqueia o popup.
 */
export function abrirParaImpressao(opts: AbrirParaImpressaoOpts): boolean {
  const win = abrirJanelaImpressao();
  if (!win) return false;
  escreverImpressao(win, opts);
  return true;
}