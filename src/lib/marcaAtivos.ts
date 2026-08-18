/**
 * Ativos da marca embutidos como data URL.
 *
 * Por que embutido e não arquivo: a janela de impressão é um documento novo
 * (`window.open` + `document.write`). Um `<img src>` ou `@font-face` apontando
 * para a rede pode não carregar antes do `window.print()`, e o PDF sairia sem
 * o logo ou com fonte de fallback. Data URL elimina essa corrida.
 *
 * A Nasalization aqui é um SUBSET só com CAIXA ALTA, dígitos e pontuação
 * (4 KB). Por isso todo uso dela tem `text-transform:uppercase` junto.
 */

export const NASALIZATION_WOFF2 = 'data:font/woff2;base64,FONT_PLACEHOLDER';

export const LOGO_MCF_VERDE = 'data:image/png;base64,LOGO_PLACEHOLDER';

export const FONTE_MARCA_CSS = `@font-face{font-family:'Nasalization';src:url(${NASALIZATION_WOFF2}) format('woff2');font-weight:400;font-style:normal;font-display:block}`;
