/**
 * Tema único dos documentos institucionais (Termo de Adesão, Comprovante de
 * Cadastro e Relatório do Lead). Fonte única do CSS: a MESMA folha é usada na
 * tela e na janela de impressão, para que o PDF saia idêntico ao que se vê.
 *
 * Importante: o conteúdo armazenado dos documentos continua sendo **markdown**.
 * Este módulo é só apresentação — nada aqui participa do `conteudo_hash`.
 */

export const EMPRESA_RAZAO_SOCIAL = 'VMX Participações e Empreendimentos Ltda';
export const EMPRESA_CNPJ = '39.662.160/0001-31';

export const PAPEL_CSS = `
/* Tinta explícita: nada dentro do papel pode herdar os tokens de tema da
   aplicação (que é escura por padrão). Redefinir as variáveis aqui é a rede de
   segurança para qualquer componente do design system que entre no papel. */
.papel{
  --background:60 20% 99%;--foreground:60 3% 10%;
  --card:60 20% 99%;--card-foreground:60 3% 10%;
  --popover:60 20% 99%;--popover-foreground:60 3% 10%;
  --muted:60 6% 94%;--muted-foreground:0 0% 40%;
  --primary:219 53% 26%;--primary-foreground:0 0% 100%;
  --secondary:60 6% 94%;--secondary-foreground:60 3% 10%;
  --accent:60 6% 94%;--accent-foreground:60 3% 10%;
  --destructive:0 72% 42%;--destructive-foreground:0 0% 100%;
  --border:47 8% 88%;--input:47 8% 88%;--ring:219 53% 26%;
}
.papel{background:#fcfcfb;color:#1a1a19;font-size:13px;line-height:1.62;
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Roboto,sans-serif}
.papel h1{font-size:17px;margin:0 0 3px;color:#1f3864;letter-spacing:.02em}
.papel h2{font-size:12px;margin:26px 0 9px;color:#1f3864;text-transform:uppercase;
  letter-spacing:.07em;border-bottom:1.5px solid #1f3864;padding-bottom:4px}
.papel h3{font-size:12px;margin:18px 0 7px;color:#1f3864}
.papel p{margin:0 0 11px;text-align:justify}
.papel ul,.papel ol{margin:0 0 12px;padding-left:22px}
.papel ul{list-style:disc}
.papel ol{list-style:decimal}
.papel li{margin:0 0 5px}

.papel .brand{display:flex;justify-content:space-between;align-items:flex-start;
  border-bottom:2.5px solid #1f3864;padding-bottom:14px;margin-bottom:22px}
.papel .brand .logo{font-weight:800;font-size:19px;color:#1f3864;letter-spacing:-.02em}
.papel .brand .logo small{display:block;font-size:9.5px;font-weight:500;color:#666;
  letter-spacing:.08em;text-transform:uppercase;margin-top:2px}
.papel .brand .meta{text-align:right;font-size:10.5px;color:#666;line-height:1.6}
.papel .sub{font-size:11px;color:#666;margin:0 0 4px}

.papel .kv{display:grid;grid-template-columns:repeat(2,1fr);gap:7px 26px;margin:0 0 6px}
.papel .kv > div{display:flex;gap:7px;font-size:12.5px;border-bottom:1px dotted #d5d5d0;padding-bottom:4px}
.papel .kv b{color:#555;font-weight:600;min-width:112px;font-size:11.5px}
.papel .kv .full{grid-column:1/-1}

.papel table.doc{width:100%;border-collapse:collapse;margin:8px 0 14px;font-size:12px}
.papel table.doc th{background:#1f3864;color:#fff;text-align:left;padding:7px 10px;
  font-size:10.5px;letter-spacing:.04em;text-transform:uppercase;font-weight:600}
.papel table.doc td{padding:7px 10px;border-bottom:1px solid #e4e4df}
.papel table.doc tr:nth-child(even) td{background:#f4f4f0}

.papel .tag{display:inline-block;font-size:10px;font-weight:700;border-radius:4px;padding:2px 7px}
.papel .tag.mcf{background:#dbeafe;color:#1e40af}
.papel .tag.cli{background:#e8e8e3;color:#555}
.papel .tag.pg{background:#d7f5d7;color:#166534}
.papel .tag.pend{background:#fef0c7;color:#92400e}
.papel .tag.err{background:#fee2e2;color:#991b1b}

.papel .assin{border:2px solid #1f3864;border-radius:8px;padding:18px 20px;margin-top:18px;background:#f7f9ff}
.papel .assin h3{margin:0 0 12px;font-size:12px;color:#1f3864;text-transform:uppercase;letter-spacing:.06em}
.papel .chk{display:flex;gap:9px;align-items:flex-start;font-size:11.5px;color:#444;line-height:1.5;margin:12px 0 14px}

.papel .cert{border-top:2px solid #1f3864;margin-top:26px;padding-top:16px}
.papel .cert .hashline{font-family:ui-monospace,Menlo,monospace;font-size:10px;color:#444;
  word-break:break-all;background:#f0f0eb;padding:7px 9px;border-radius:5px;margin-top:7px}
.papel .legal{font-size:9.5px;color:#777;line-height:1.55;margin-top:12px}

.papel .tl{position:relative;padding-left:26px}
.papel .tl::before{content:"";position:absolute;left:7px;top:5px;bottom:5px;width:2px;background:#d5d5d0}
.papel .ev{position:relative;padding-bottom:16px}
.papel .ev::before{content:"";position:absolute;left:-23px;top:4px;width:11px;height:11px;
  border-radius:50%;background:#1f3864;border:2px solid #fcfcfb}
.papel .ev.warn::before{background:#fab219}
.papel .ev.ok::before{background:#166534}
.papel .ev .when{font-size:10.5px;color:#777;font-weight:600}
.papel .ev .what{font-size:12.5px;font-weight:700;margin:1px 0 2px}
.papel .ev .who{font-size:11.5px;color:#555}

.papel .tarja{background:#e8484a;color:#fff;font-weight:800;font-size:11px;letter-spacing:.05em;
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

/** Cabeçalho institucional — logotipo em texto, sem arquivo de imagem. */
export function papelBrandHtml(opts: { subtitulo?: string } = {}): string {
  const data = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  return `<div class="brand">
  <div><div class="logo">MCF CAPITAL<small>Minha Casa Financiada</small></div>${
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
<style>html,body{margin:0;padding:0;background:#fcfcfb}
body{padding:22px}
@media print{body{padding:0}}
${PAPEL_CSS}
${PAPEL_PAGE_CSS}</style></head>
<body><div class="papel">
${opts.avisoTopo ? `<div class="tarja">${escapeHtml(opts.avisoTopo)}</div>` : ''}
${papelBrandHtml({ subtitulo: opts.subtitulo })}
${opts.corpoHtml}
</div>
<script>window.onload=function(){setTimeout(function(){window.focus();window.print();},250);};</script>
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