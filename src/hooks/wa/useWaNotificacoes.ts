import { useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { WaConversation } from '@/hooks/wa/useWaConversations';

/** Linha de wa_messages como vem no payload do realtime. */
interface WaMessageRealtimeRow {
  id: string;
  conversation_id: string;
  direction: 'inbound' | 'outbound';
  body: string | null;
}

interface Opcoes {
  /** Conversas do escopo "minhas" — base do contador do título da aba. */
  conversas: WaConversation[];
  /** Conversa aberta na tela: não notificamos, o operador já está vendo. */
  conversaSelecionadaId: string | null;
  /** Abre a conversa quando o usuário clica na notificação do navegador. */
  onAbrirConversa?: (conversationId: string) => void;
  /** Título base da aba. */
  tituloBase?: string;
}

const TITULO_PADRAO = 'MCF - Atendimento';
/** Janela de agrupamento do bipe, para várias mensagens juntas não virarem rajada. */
const INTERVALO_SOM_MS = 3000;

/**
 * Avisos de mensagem recebida no MCF - Atendimento: bipe, notificação do
 * navegador e contador de não lidas no título da aba.
 *
 * Só notifica conversas atribuídas ao usuário logado — quem está vendo "Todas"
 * não recebe aviso de conversa alheia.
 */
export function useWaNotificacoes({
  conversas,
  conversaSelecionadaId,
  onAbrirConversa,
  tituloBase = TITULO_PADRAO,
}: Opcoes) {
  const { user } = useAuth();
  const uid = user?.id ?? null;

  const uidRef = useRef<string | null>(uid);
  uidRef.current = uid;
  const selecionadaRef = useRef<string | null>(conversaSelecionadaId);
  selecionadaRef.current = conversaSelecionadaId;
  const abrirRef = useRef<Opcoes['onAbrirConversa']>(onAbrirConversa);
  abrirRef.current = onAbrirConversa;

  const audioCtxRef = useRef<AudioContext | null>(null);
  const ultimoSomRef = useRef(0);
  /** Já houve interação do usuário nesta aba? Gate da política de autoplay. */
  const interagiuRef = useRef(false);

  // ── Interação do usuário: libera áudio e permite pedir permissão ────────────
  useEffect(() => {
    const aoInteragir = () => {
      interagiuRef.current = true;
      try {
        const Ctor: typeof AudioContext | undefined =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return;
        if (!audioCtxRef.current) audioCtxRef.current = new Ctor();
        if (audioCtxRef.current.state === 'suspended') void audioCtxRef.current.resume();
      } catch {
        /* áudio indisponível: seguimos sem som */
      }
      // Permissão só depois da interação, e uma única vez.
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        void Notification.requestPermission().catch(() => undefined);
      }
    };
    window.addEventListener('pointerdown', aoInteragir, { once: true });
    window.addEventListener('keydown', aoInteragir, { once: true });
    return () => {
      window.removeEventListener('pointerdown', aoInteragir);
      window.removeEventListener('keydown', aoInteragir);
    };
  }, []);

  /** Bipe curto e discreto via Web Audio API — sem arquivo de áudio. */
  const tocarBipe = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx || ctx.state !== 'running') return; // suspenso/ausente: ignora em silêncio
    const agora = Date.now();
    if (agora - ultimoSomRef.current < INTERVALO_SOM_MS) return;
    ultimoSomRef.current = agora;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.06, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.2);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.21);
    } catch {
      /* som é acessório */
    }
  }, []);

  const notificarNavegador = useCallback((titulo: string, corpo: string, conversationId: string) => {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission !== 'granted') return; // negado: segue em silêncio
    try {
      const n = new Notification(titulo, { body: corpo, tag: `wa-${conversationId}` });
      n.onclick = () => {
        window.focus();
        abrirRef.current?.(conversationId);
        n.close();
      };
    } catch {
      /* alguns navegadores exigem service worker: ignora */
    }
  }, []);

  // ── Realtime de mensagens recebidas (canal próprio) ─────────────────────────
  useEffect(() => {
    if (!uid) return;
    const channel = supabase
      .channel('wa-notificacoes-inbound')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'wa_messages' },
        async (payload) => {
          const msg = payload.new as WaMessageRealtimeRow;
          if (msg.direction !== 'inbound') return; // espelhos e disparos são outbound
          if (msg.conversation_id === selecionadaRef.current) return; // já está vendo

          // O payload não traz assigned_to: buscamos a conversa para conferir o dono.
          const { data, error } = await supabase
            .from('wa_conversations')
            .select('id, contact_name, phone_e164, assigned_to')
            .eq('id', msg.conversation_id)
            .maybeSingle();
          if (error || !data) return;
          if (data.assigned_to !== uidRef.current) return;

          const titulo = data.contact_name?.trim() || data.phone_e164 || 'Nova mensagem';
          const corpo = (msg.body ?? '').trim().slice(0, 140) || 'Mensagem recebida';
          tocarBipe();
          notificarNavegador(titulo, corpo, data.id);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [uid, tocarBipe, notificarNavegador]);

  // ── Contador de não lidas no título da aba ──────────────────────────────────
  const totalNaoLidas = conversas.reduce(
    (soma, c) => soma + (c.assigned_to === uid ? (c.unread_count ?? 0) : 0),
    0,
  );

  useEffect(() => {
    const original = document.title;
    document.title = totalNaoLidas > 0 ? `(${totalNaoLidas}) ${tituloBase}` : tituloBase;
    return () => {
      document.title = original;
    };
  }, [totalNaoLidas, tituloBase]);

  return { totalNaoLidas };
}
