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

  // Não renderiza nada no React tree — o widget flutuante é desenhado pelo
  // script do Sonax diretamente no DOM.
  return null;
}
