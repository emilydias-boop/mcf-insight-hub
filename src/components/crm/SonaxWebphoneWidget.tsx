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

/** Distância mínima (px) entre mousedown e mouseup para caracterizar arraste
 *  no launcher (#widget). Abaixo disso o evento é tratado como clique normal,
 *  preservando o toggle de abrir/fechar o painel implementado pelo Sonax. */
const DRAG_THRESHOLD = 5;

/**
 * Torna o container do widget arrastável a partir de dois pontos:
 *  - `#header` (barra "SONAX | Fone" do painel aberto): arraste imediato,
 *    ignorando botões/inputs internos. Comportamento já existente.
 *  - `#widget` (bolha launcher quando minimizado): arraste com threshold, de
 *    modo que um clique rápido continue abrindo/fechando o painel (toggle
 *    nativo deles), e só um movimento real (>5px) arraste o container.
 *
 * Tudo é puramente aditivo: apenas `transform` no container `.SonaxWidget`
 * (painel e ícone se movem juntos como uma unidade). Nenhum listener é
 * adicionado aos botões internos (discador, atender, desligar).
 */
function attachDragBehavior(container: HTMLElement): () => void {
  // Garante empilhamento acima de qualquer Dialog/Sheet do app.
  container.style.zIndex = TOP_Z_INDEX;
  if (getComputedStyle(container).position === 'static') {
    container.style.position = 'relative';
  }

  const findHandles = (): {
    header: HTMLElement | null;
    launcher: HTMLElement | null;
  } => {
    // Cabeçalho do painel: <nav id="header"> (fallback .content > nav).
    // Launcher minimizado: <div id="widget"> (a bolha que abre/fecha).
    const header =
      container.querySelector<HTMLElement>('#header') ??
      container.querySelector<HTMLElement>('.content nav') ??
      null;
    const launcher = container.querySelector<HTMLElement>('#widget') ?? null;
    return { header, launcher };
  };

  let offsetX = 0;
  let offsetY = 0;
  let startX = 0;
  let startY = 0;
  // Arraste efetivamente em andamento (threshold já superado, se vindo do
  // launcher; ou imediato, se vindo do header).
  let dragging = false;
  // mousedown no launcher, aguardando confirmação de arraste vs. clique.
  let pendingLauncher = false;
  // Arraste em andamento originou-se do launcher (#widget).
  let launcherDragging = false;
  // Flag levantada no mouseup de um arraste do launcher para suprimir o
  // click nativo de toggle deles logo em seguida.
  let suppressClick = false;

  let boundHeader: HTMLElement | null = null;
  let boundLauncher: HTMLElement | null = null;

  const onMouseMove = (event: MouseEvent) => {
    if (!dragging && !pendingLauncher) return;
    if (pendingLauncher) {
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return; // ainda pode ser clique
      // Cruzou o threshold → agora é arraste de verdade.
      pendingLauncher = false;
      dragging = true;
      launcherDragging = true;
      container.setAttribute('data-sonax-dragging', 'true');
    }
    if (dragging) {
      event.preventDefault();
      const x = offsetX + (event.clientX - startX);
      const y = offsetY + (event.clientY - startY);
      container.style.transform = `translate(${x}px, ${y}px)`;
    }
  };

  const onMouseUp = (event: MouseEvent) => {
    if (dragging) {
      const wasLauncher = launcherDragging;
      dragging = false;
      launcherDragging = false;
      container.removeAttribute('data-sonax-dragging');
      const match =
        /translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/.exec(container.style.transform);
      offsetX = match ? parseFloat(match[1]) : offsetX;
      offsetY = match ? parseFloat(match[2]) : offsetY;
      // Se o arraste veio do launcher, suprime o click de toggle nativo deles
      // (via flag lida no handler de click em capture), e ainda para a
      // propagação do mouseup por segurança.
      if (wasLauncher) {
        suppressClick = true;
        event.stopPropagation();
      }
    } else if (pendingLauncher) {
      // Abaixo do threshold: clique normal — não interfira, deixe o toggle
      // nativo deles (abrir/fechar painel) acontecer.
      pendingLauncher = false;
    }
  };

  // Header (#header): arraste imediato, preventDefault no mousedown (já que
  // o cabeçalho não tem toggle de clique próprio) e ignora botões/inputs.
  const onHeaderMouseDown = (event: MouseEvent) => {
    const target = event.target as HTMLElement | null;
    if (!target || target.closest('button, input, a, img, svg')) return;
    dragging = true;
    launcherDragging = false;
    startX = event.clientX;
    startY = event.clientY;
    container.setAttribute('data-sonax-dragging', 'true');
    event.preventDefault();
  };

  // Launcher (#widget): marca intenção pendente sem preventDefault, para que
  // o click nativo deles (toggle abrir/fechar) continue disponível caso o
  // mouse não se mova além do threshold.
  const onLauncherMouseDown = (event: MouseEvent) => {
    pendingLauncher = true;
    startX = event.clientX;
    startY = event.clientY;
  };

  // Suprime o click de toggle quando o gesto acabou de ser um arraste real.
  // Captura para interceptar antes do handler nativo deles, e atende cliques
  // disparados em filhos do launcher (ex.: ícone svg interno).
  const onLauncherClick = (event: MouseEvent) => {
    if (!suppressClick) return;
    suppressClick = false;
    event.preventDefault();
    event.stopPropagation();
  };

  const bindHandles = () => {
    const { header, launcher } = findHandles();

    if (header && header !== boundHeader) {
      boundHeader?.removeEventListener('mousedown', onHeaderMouseDown);
      boundHeader = header;
      header.setAttribute('data-sonax-drag-handle', 'true');
      header.addEventListener('mousedown', onHeaderMouseDown);
    }

    if (launcher && launcher !== boundLauncher) {
      boundLauncher?.removeEventListener('mousedown', onLauncherMouseDown);
      boundLauncher?.removeEventListener('click', onLauncherClick, true);
      boundLauncher = launcher;
      launcher.setAttribute('data-sonax-drag-handle', 'true');
      launcher.addEventListener('mousedown', onLauncherMouseDown);
      launcher.addEventListener('click', onLauncherClick, true);
    }
  };

  bindHandles();
  // O painel só existe depois de abrir a bolha; observa mudanças no container.
  const observer = new MutationObserver(() => bindHandles());
  observer.observe(container, { childList: true, subtree: true });

  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);

  return () => {
    observer.disconnect();
    boundHeader?.removeEventListener('mousedown', onHeaderMouseDown);
    boundLauncher?.removeEventListener('mousedown', onLauncherMouseDown);
    boundLauncher?.removeEventListener('click', onLauncherClick, true);
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
