import { useEffect } from 'react';
import { useDialerEngine } from '@/hooks/useDialerEngine';

/**
 * Sonax Webphone Widget (softphone visual/WebRTC).
 *
 * Responsabilidade ÚNICA: injetar dinamicamente no DOM o <script> do widget
 * de webfone do Sonax, lendo `widget_data` e `widget_client` de
 * `sdr_ramal_mapping` para o usuário logado. O próprio script do Sonax desenha
 * a UI flutuante — não construímos nenhuma UI aqui.
 *
 * Regras:
 *  - Só injeta quando `auto_dialer_engine === 'sonax'` E `widget_data` existir.
 *    Para todos os SDRs com engine 'twilio' (a maioria), o componente é no-op.
 *  - Injeta UMA única vez (checa se o script já existe no documento).
 *  - É ADITIVO: não altera o fluxo de click-to-call (sonax-click-to-call).
 *  - Qualquer erro de rede/esquema → não renderiza nada, sem quebrar o layout.
 *
 * Montado no shell (MainLayout), dentro do bloco isSDR, para avaliar em toda
 * sessão logada sem duplicar por página.
 */
const WIDGET_SCRIPT_ID = 'widget-script';
const WIDGET_BASE_URL = 'https://webphone2.sonax.cloud/widget';
const TOP_Z_INDEX = '2147483000';

/**
 * Torna o container do widget arrastável a partir da barra de título
 * ("SONAX | Fone"), de forma puramente aditiva: apenas `transform` no
 * container. Nenhum listener é adicionado aos botões internos (discador,
 * atender, desligar), então o comportamento do script deles é preservado.
 */
function attachDragBehavior(container: HTMLElement): () => void {
  // Garante empilhamento acima de qualquer Dialog/Sheet do app.
  container.style.zIndex = TOP_Z_INDEX;
  if (getComputedStyle(container).position === 'static') {
    container.style.position = 'relative';
  }

  const findHandle = (): HTMLElement | null => {
    // O cabeçalho do widget (injetado pelo script Sonax) é <nav id="header">.
    // Usamos o seletor estável por ID; fallback pela estrutura .content > nav.
    return (
      container.querySelector<HTMLElement>('#header') ??
      container.querySelector<HTMLElement>('.content nav') ??
      null
    );
  };

  let offsetX = 0;
  let offsetY = 0;
  let startX = 0;
  let startY = 0;
  let dragging = false;
  let handle: HTMLElement | null = null;

  const onMouseMove = (event: MouseEvent) => {
    if (!dragging) return;
    event.preventDefault();
    const x = offsetX + (event.clientX - startX);
    const y = offsetY + (event.clientY - startY);
    container.style.transform = `translate(${x}px, ${y}px)`;
  };

  const onMouseUp = () => {
    if (!dragging) return;
    dragging = false;
    container.removeAttribute('data-sonax-dragging');
    const match = /translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/.exec(container.style.transform);
    offsetX = match ? parseFloat(match[1]) : offsetX;
    offsetY = match ? parseFloat(match[2]) : offsetY;
  };

  const onMouseDown = (event: MouseEvent) => {
    // Só arrasta pelo cabeçalho; ignora qualquer botão/input/img interno.
    const target = event.target as HTMLElement | null;
    if (!target || target.closest('button, input, a, img, svg')) return;
    dragging = true;
    startX = event.clientX;
    startY = event.clientY;
    container.setAttribute('data-sonax-dragging', 'true');
    event.preventDefault();
  };

  const bindHandle = () => {
    const next = findHandle();
    if (!next || next === handle) return;
    handle?.removeEventListener('mousedown', onMouseDown);
    handle = next;
    handle.setAttribute('data-sonax-drag-handle', 'true');
    handle.addEventListener('mousedown', onMouseDown);
  };

  bindHandle();
  // O painel só existe depois de abrir a bolha; observa mudanças no container.
  const observer = new MutationObserver(() => bindHandle());
  observer.observe(container, { childList: true, subtree: true });

  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);

  return () => {
    observer.disconnect();
    handle?.removeEventListener('mousedown', onMouseDown);
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
  };
}

export function SonaxWebphoneWidget() {
  const { data, isError } = useDialerEngine();

  const widgetData = data?.widgetData ?? null;
  const widgetClient = data?.widgetClient ?? null;
  const shouldInject =
    !isError &&
    data?.engine === 'sonax' &&
    !!widgetData;

  useEffect(() => {
    if (!shouldInject || !widgetData) return;

    // Evita re-injeção em re-renders / navegação / StrictMode double-invoke.
    const existing = document.getElementById(WIDGET_SCRIPT_ID);
    if (existing) return;

    const client = widgetClient ?? '';
    const src = `${WIDGET_BASE_URL}?data=${encodeURIComponent(widgetData)}${
      client ? `&dataClient=${encodeURIComponent(client)}` : ''
    }`;

    const script = document.createElement('script');
    script.id = WIDGET_SCRIPT_ID;
    script.src = src;
    script.async = true;
    script.onerror = () => {
      // Falha silenciosa: remove o script inválido pra permitir nova tentativa
      // numa futura sessão sem deixar nó quebrado no DOM.
      script.remove();
    };

    document.body.appendChild(script);
  }, [shouldInject, widgetData, widgetClient]);

  // Aguarda o container `.SonaxWidget` (injetado assincronamente pelo script
  // deles) e habilita o arraste + hardening de z-index.
  useEffect(() => {
    if (!shouldInject) return;

    let cleanupDrag: (() => void) | null = null;

    const tryAttach = () => {
      const container = document.querySelector<HTMLElement>('.SonaxWidget');
      if (!container || container.dataset.sonaxDragReady === 'true') return false;
      container.dataset.sonaxDragReady = 'true';
      cleanupDrag = attachDragBehavior(container);
      return true;
    };

    if (tryAttach()) return () => cleanupDrag?.();

    const observer = new MutationObserver(() => {
      if (tryAttach()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      cleanupDrag?.();
    };
  }, [shouldInject]);

  // Não renderiza nada no React tree — o widget flutuante é desenhado pelo
  // script do Sonax diretamente no DOM.
  return null;
}
