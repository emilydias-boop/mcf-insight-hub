import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
// definição única de "bloqueante" — o wizard e o retomar precisam concordar
import { PROBLEMAS_BLOQUEANTES } from '@/components/checkin/broadcast/waBroadcastLabels';


export type WaBroadcastStatus =
  | 'rascunho'
  | 'aguardando'
  | 'enviando'
  | 'pausado'
  | 'concluido'
  | 'cancelado';

export type WaTargetStatus = 'pendente' | 'enviando' | 'enviado' | 'falha' | 'ignorado';

/** De onde vem o público: a carteira de quem dispara ou a de todos os SDRs da BU. */
export type WaBroadcastEscopo = 'minha_carteira' | 'bu';

export interface WaBroadcastBuDisponivel {
  bu: string;
  sdrs: number;
  /** leads disparáveis: só quem tem dono ativo */
  leads: number;
  /** leads cujo dono está bloqueado — ninguém para ler a resposta */
  leads_sem_dono_ativo: number;
}

/** Abaixo disso a BU não é carteira comercial — é área da empresa no campo squad. */
export const BU_VOLUME_MINIMO = 50;


export interface WaBroadcast {
  id: string;
  criado_por: string;
  nome: string;
  content_sid: string;
  template_nome: string | null;
  template_preview: string | null;
  variaveis_fixas: Record<string, string>;
  /** Chaves: origin_id (string), stage_ids/tags/deal_ids (arrays). */
  filtro: Record<string, string | string[]>;
  escopo: WaBroadcastEscopo;
  bu: string | null;
  updated_at: string | null;
  status: WaBroadcastStatus;
  total_alvos: number;
  total_enviados: number;
  total_falhas: number;
  total_ignorados: number;
  limite_alvos: number | null;
  sender_number: string | null;
  iniciado_em: string | null;
  concluido_em: string | null;
  motivo_cancelamento: string | null;
  created_at: string;
}

export interface WaBroadcastTarget {
  id: string;
  broadcast_id: string;
  phone_e164: string;
  deal_id: string | null;
  contact_name: string | null;
  owner_profile_id: string | null;
  variaveis: Record<string, string>;
  status: WaTargetStatus;
  motivo_ignorado: string | null;
  erro: string | null;
  enviado_em: string | null;
  conversation_id: string | null;
}

export interface WaTemplateOption {
  content_sid: string;
  name: string;
  body_preview: string | null;
  variables: string[];
  category: string | null;
}

export interface WaValidacaoItem {
  problema: string;
  detalhe: string;
  quantidade: number;
}

export interface WaSendBudget {
  teto_diario: number;
  reserva_atendimento_diaria: number;
  teto_por_usuario_diario: number;
  ritmo_por_minuto: number;
}

// PostgREST errors are plain objects with { message, details, hint, code },
// not instances of Error — `instanceof Error` discards the real DB message.
const errMsg = (err: unknown, fallback: string): string => {
  if (err instanceof Error && err.message) return err.message;
  if (
    err &&
    typeof err === 'object' &&
    typeof (err as { message?: unknown }).message === 'string' &&
    ((err as { message: string }).message).length > 0
  ) {
    return (err as { message: string }).message;
  }
  return fallback;
};

/** Templates aprovados disponíveis para disparo. */
export function useWaTemplates() {
  return useQuery({
    queryKey: ['wa-templates', 'broadcast'],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<WaTemplateOption[]> => {
      // a view wa_templates já filtra com COALESCE(is_active, true) — um .eq()
      // aqui excluiria template aprovado com is_active nulo
      const { data, error } = await supabase
        .from('wa_templates')
        .select('content_sid, name, body_preview, variables, category')
        .order('name');

      if (error) throw error;
      return (data ?? [])
        .filter((t) => !!t.content_sid && !!t.name)
        .map((t) => ({
          content_sid: t.content_sid as string,
          name: t.name as string,
          body_preview: t.body_preview ?? null,
          variables: (t.variables ?? []) as string[],
          category: t.category ?? null,
        }));
    },
  });
}

export function useWaSendBudget() {
  return useQuery({
    queryKey: ['wa-send-budget'],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<WaSendBudget | null> => {
      const { data, error } = await supabase
        .from('wa_send_budget')
        .select('teto_diario, reserva_atendimento_diaria, teto_por_usuario_diario, ritmo_por_minuto')
        .maybeSingle();
      if (error) throw error;
      return (data as WaSendBudget) ?? null;
    },
  });
}

/** Saldo de envios que ainda cabe hoje + quanto já saiu. */
export function useWaSaldoHoje() {
  return useQuery({
    queryKey: ['wa-saldo-hoje'],
    staleTime: 30_000,
    queryFn: async () => {
      const [saldo, enviados] = await Promise.all([
        supabase.rpc('wa_saldo_disparo_hoje'),
        supabase.rpc('wa_enviados_hoje', {}),
      ]);
      if (saldo.error) throw saldo.error;
      if (enviados.error) throw enviados.error;
      return {
        saldo: Number(saldo.data ?? 0),
        enviadosHoje: Number(enviados.data ?? 0),
      };
    },
  });
}

export function useWaBroadcasts() {
  return useQuery({
    queryKey: ['wa-broadcasts'],
    staleTime: 15_000,
    queryFn: async (): Promise<WaBroadcast[]> => {
      const { data, error } = await supabase
        .from('wa_broadcasts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as WaBroadcast[];
    },
  });
}

export function useWaBroadcast(id: string | undefined) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['wa-broadcast', id],
    enabled: !!id,
    queryFn: async (): Promise<WaBroadcast | null> => {
      const { data, error } = await supabase.from('wa_broadcasts').select('*').eq('id', id!).maybeSingle();
      if (error) throw error;
      return (data as unknown as WaBroadcast) ?? null;
    },
  });

  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`wa-broadcast-${id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'wa_broadcasts', filter: `id=eq.${id}` },
        () => {
          qc.invalidateQueries({ queryKey: ['wa-broadcast', id] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, qc]);

  return query;
}

/** Quantos alvos a tabela lista por página — a lista é truncada de propósito. */
export const TARGETS_PAGE_SIZE = 1000;

/** Total real de alvos no banco para o filtro atual (agregado no servidor). */
export function useWaTargetsTotal(broadcastId: string | undefined, status: string = 'all') {
  return useQuery({
    queryKey: ['wa-broadcast-targets-total', broadcastId, status],
    enabled: !!broadcastId,
    queryFn: async (): Promise<number> => {
      let q = supabase
        .from('wa_broadcast_targets')
        .select('id', { count: 'exact', head: true })
        .eq('broadcast_id', broadcastId!);
      if (status !== 'all') q = q.eq('status', status);
      const { count, error } = await q;
      if (error) throw error;
      return count ?? 0;
    },
  });
}

/** Alvos do disparo, com realtime para acompanhar a entrega. */
export function useWaBroadcastTargets(broadcastId: string | undefined, status: string = 'all') {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['wa-broadcast-targets', broadcastId, status],
    enabled: !!broadcastId,
    queryFn: async (): Promise<WaBroadcastTarget[]> => {
      let q = supabase
        .from('wa_broadcast_targets')
        .select(
          'id, broadcast_id, phone_e164, deal_id, contact_name, owner_profile_id, variaveis, status, motivo_ignorado, erro, enviado_em, conversation_id',
        )
        .eq('broadcast_id', broadcastId!)
        .order('enviado_em', { ascending: false, nullsFirst: false })
        .order('contact_name', { ascending: true })
        .limit(TARGETS_PAGE_SIZE);
      if (status !== 'all') q = q.eq('status', status);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as WaBroadcastTarget[];
    },
  });

  useEffect(() => {
    if (!broadcastId) return;
    const channel = supabase
      .channel(`wa-broadcast-targets-${broadcastId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'wa_broadcast_targets',
          filter: `broadcast_id=eq.${broadcastId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ['wa-broadcast-targets', broadcastId] });
          qc.invalidateQueries({ queryKey: ['wa-broadcast-targets-total', broadcastId] });
          qc.invalidateQueries({ queryKey: ['wa-broadcast', broadcastId] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [broadcastId, qc]);

  return query;
}

/** Contagem de ignorados por motivo — o número agregado esconde o problema. */
export function useWaTargetsCount(broadcastId: string | undefined, status: WaTargetStatus) {
  return useQuery({
    queryKey: ['wa-broadcast-targets-count', broadcastId, status],
    enabled: !!broadcastId,
    queryFn: async (): Promise<number> => {
      const { count, error } = await supabase
        .from('wa_broadcast_targets')
        .select('id', { count: 'exact', head: true })
        .eq('broadcast_id', broadcastId!)
        .eq('status', status);
      if (error) throw error;
      return count ?? 0;
    },
  });
}

/** Motivos conhecidos de ignorado — o resto cai em "outro". */
export const MOTIVOS_IGNORADO = [
  'optout',
  'cooldown',
  'nome_invalido',
  'limite_marketing_do_destinatario',
  'dono_inativo',
] as const;

/**
 * Contagem de ignorados por motivo — agregada NO SERVIDOR (`count: 'exact'`),
 * uma chamada por motivo. Antes baixávamos 5.000 linhas e somávamos no
 * cliente, o que dava número errado em disparo grande sem avisar ninguém.
 */
export function useWaIgnoradosPorMotivo(broadcastId: string | undefined) {
  return useQuery({
    queryKey: ['wa-broadcast-ignorados', broadcastId],
    enabled: !!broadcastId,
    queryFn: async (): Promise<Record<string, number>> => {
      const base = () =>
        supabase
          .from('wa_broadcast_targets')
          .select('id', { count: 'exact', head: true })
          .eq('broadcast_id', broadcastId!)
          .eq('status', 'ignorado');

      const [totalRes, ...porMotivo] = await Promise.all([
        base(),
        ...MOTIVOS_IGNORADO.map((m) => base().eq('motivo_ignorado', m)),
      ]);
      if (totalRes.error) throw totalRes.error;

      const acc: Record<string, number> = {};
      let somaConhecidos = 0;
      porMotivo.forEach((res, i) => {
        if (res.error) throw res.error;
        const n = res.count ?? 0;
        somaConhecidos += n;
        if (n > 0) acc[MOTIVOS_IGNORADO[i]] = n;
      });
      const outros = (totalRes.count ?? 0) - somaConhecidos;
      if (outros > 0) acc.outro = outros;
      return acc;
    },
  });
}

/** Um nome real da carteira do operador, para interpolar a prévia do template. */
export function useWaSampleName(broadcastId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['wa-sample-name', broadcastId, user?.id],
    staleTime: 60_000,
    queryFn: async (): Promise<string | null> => {
      if (broadcastId) {
        const { data } = await supabase
          .from('wa_broadcast_targets')
          .select('contact_name')
          .eq('broadcast_id', broadcastId)
          .eq('status', 'pendente')
          .not('contact_name', 'is', null)
          .limit(1);
        const name = data?.[0]?.contact_name;
        if (name) return name;
      }
      if (!user?.id) return null;
      const { data } = await supabase
        .from('crm_deals')
        .select('name')
        .eq('owner_profile_id', user.id)
        .eq('is_archived', false)
        .order('created_at', { ascending: false })
        .limit(1);
      return data?.[0]?.name ?? null;
    },
  });
}

export function useCreateWaBroadcast() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: {
      nome: string;
      content_sid: string;
      template_nome: string | null;
      template_preview: string | null;
    }) => {
      if (!user?.id) throw new Error('Sessão expirada');
      const { data, error } = await supabase
        .from('wa_broadcasts')
        .insert({
          criado_por: user.id,
          nome: input.nome,
          content_sid: input.content_sid,
          template_nome: input.template_nome,
          template_preview: input.template_preview,
        })
        .select('*')
        .single();
      if (error) throw error;
      return data as unknown as WaBroadcast;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wa-broadcasts'] }),
    onError: (err) => toast.error(errMsg(err, 'Erro ao criar disparo')),
  });
}

export function useUpdateWaBroadcast() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: Partial<
        Pick<
          WaBroadcast,
          | 'nome'
          | 'content_sid'
          | 'template_nome'
          | 'template_preview'
          | 'filtro'
          | 'limite_alvos'
          | 'status'
          | 'motivo_cancelamento'
          | 'iniciado_em'
          | 'escopo'
          | 'bu'
        >
      >;
    }) => {
      const { data, error } = await supabase
        .from('wa_broadcasts')
        .update(patch)
        .eq('id', id)
        .select('id');
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error(
          'Não foi possível salvar o disparo (sem permissão ou o disparo já saiu de rascunho).',
        );
      }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['wa-broadcast', vars.id] });
      qc.invalidateQueries({ queryKey: ['wa-broadcasts'] });
    },
    onError: (err) => toast.error(errMsg(err, 'Erro ao salvar disparo')),
  });
}

export function useMontarPublico() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (broadcastId: string) => {
      const { data, error } = await supabase.rpc('wa_broadcast_montar_publico', {
        _broadcast_id: broadcastId,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return (row ?? { total: 0, elegiveis: 0, ignorados: 0 }) as {
        total: number;
        elegiveis: number;
        ignorados: number;
      };
    },
    onMutate: (broadcastId: string) => {
      // a contagem em cache é do público ANTERIOR. Enquanto a nova não chega,
      // ela tem que ficar indisponível — não obsoleta — ou a confirmação por
      // digitação é calculada sobre o número errado.
      qc.removeQueries({ queryKey: ['wa-broadcast-targets-count', broadcastId] });
      qc.removeQueries({ queryKey: ['wa-broadcast-targets-total', broadcastId] });
    },
    onSuccess: (_d, broadcastId) => {
      qc.invalidateQueries({ queryKey: ['wa-broadcast', broadcastId] });
      qc.invalidateQueries({ queryKey: ['wa-broadcast-targets', broadcastId] });
      qc.invalidateQueries({ queryKey: ['wa-broadcast-targets-count', broadcastId] });
      qc.invalidateQueries({ queryKey: ['wa-broadcast-targets-total', broadcastId] });
      qc.invalidateQueries({ queryKey: ['wa-broadcast-ignorados', broadcastId] });
      // público novo invalida qualquer validação anterior: autorizar envio com
      // validação de outro público é o pior erro possível aqui
      qc.invalidateQueries({ queryKey: ['wa-broadcast-validacao', broadcastId] });
      qc.invalidateQueries({ queryKey: ['wa-sample-name', broadcastId] });
    },

    onError: (err) => toast.error(errMsg(err, 'Erro ao montar público')),
  });
}

export function useValidarBroadcast(broadcastId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ['wa-broadcast-validacao', broadcastId],
    enabled: !!broadcastId && enabled,
    // envio é irreversível: a validação nunca pode vir de cache
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    queryFn: async (): Promise<WaValidacaoItem[]> => {
      const { data, error } = await supabase.rpc('wa_broadcast_validar', {
        _broadcast_id: broadcastId!,
      });
      if (error) throw error;
      return (data ?? []) as WaValidacaoItem[];
    },
  });
}

export function useIgnorarNomeInvalido() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (broadcastId: string) => {
      const { data, error } = await supabase.rpc('wa_broadcast_ignorar_nome_invalido', {
        _broadcast_id: broadcastId,
      });
      if (error) throw error;
      return Number(data ?? 0);
    },
    onSuccess: (qtd, broadcastId) => {
      toast.success(`${qtd} alvo(s) movido(s) para ignorado`);
      qc.invalidateQueries({ queryKey: ['wa-broadcast', broadcastId] });
      qc.invalidateQueries({ queryKey: ['wa-broadcast-targets', broadcastId] });
      qc.invalidateQueries({ queryKey: ['wa-broadcast-targets-count', broadcastId] });
      qc.invalidateQueries({ queryKey: ['wa-broadcast-ignorados', broadcastId] });
      qc.invalidateQueries({ queryKey: ['wa-broadcast-validacao', broadcastId] });
    },
    onError: (err) => toast.error(errMsg(err, 'Erro ao ignorar nomes inválidos')),
  });
}

/** Roda a validação server-side e devolve só os problemas bloqueantes. */
async function validarBloqueantes(broadcastId: string): Promise<WaValidacaoItem[]> {
  const { data, error } = await supabase.rpc('wa_broadcast_validar', {
    _broadcast_id: broadcastId,
  });
  if (error) throw error;
  return ((data ?? []) as WaValidacaoItem[]).filter((p) => PROBLEMAS_BLOQUEANTES.has(p.problema));
}


/** Marca como enviando e dispara o primeiro lote. O cron segue sozinho depois. */
export function useIniciarBroadcast() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (broadcastId: string) => {
      // guarda de status: só um rascunho pode iniciar. Sem isso, um retry
      // reescreve o iniciado_em de um disparo em andamento — ou ressuscita
      // um cancelado.
      const { data, error } = await supabase
        .from('wa_broadcasts')
        .update({ status: 'enviando', iniciado_em: new Date().toISOString() })
        .eq('id', broadcastId)
        .eq('status', 'rascunho')
        .select('id');
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error(
          'Este disparo não está mais em rascunho — recarregue a tela para ver o status atual.',
        );
      }
      const { error: fnError } = await supabase.functions.invoke('wa-broadcast-dispatch', {
        body: { broadcast_id: broadcastId },
      });
      if (fnError) {
        // o disparo já está em enviando; o cron pega no próximo minuto
        toast.warning('Disparo iniciado. O primeiro lote sai no próximo ciclo automático.');
      }
    },
    onSuccess: (_d, broadcastId) => {
      qc.invalidateQueries({ queryKey: ['wa-broadcast', broadcastId] });
      qc.invalidateQueries({ queryKey: ['wa-broadcasts'] });
      qc.invalidateQueries({ queryKey: ['wa-saldo-hoje'] });
    },
    onError: (err) => toast.error(errMsg(err, 'Erro ao iniciar disparo')),
  });
}

export function useControlarBroadcast() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [agindo, setAgindo] = useState(false);

  const invalidar = (id: string) => {
    qc.invalidateQueries({ queryKey: ['wa-broadcast', id] });
    qc.invalidateQueries({ queryKey: ['wa-broadcasts'] });
  };

  /**
   * Transição de status com guarda: com dois admins na tela, um cancela e o
   * outro clica em "Retomar" num render obsoleto — sem `.eq('status', ...)` o
   * cancelado voltaria para `enviando` e o dispatcher retomaria o envio.
   */
  const transicionar = async (
    id: string,
    de: WaBroadcastStatus[],
    patch: Record<string, unknown>,
  ) => {
    const { data, error } = await supabase
      .from('wa_broadcasts')
      .update(patch)
      .eq('id', id)
      .in('status', de)
      .select('id');
    if (error) throw error;
    invalidar(id);
    return !!data && data.length > 0;
  };

  const pausar = async (id: string) => {
    setAgindo(true);
    try {
      const ok = await transicionar(id, ['enviando'], { status: 'pausado' });
      if (!ok) {
        toast.error('Este disparo não está mais enviando — recarregue para ver o status atual.');
        return;
      }
      toast.success('Disparo pausado');
    } catch (err) {
      toast.error(errMsg(err, 'Erro ao pausar disparo'));
    } finally {
      setAgindo(false);
    }
  };

  const cancelar = async (id: string, motivo: string) => {
    setAgindo(true);
    try {
      const ok = await transicionar(id, ['rascunho', 'aguardando', 'enviando', 'pausado'], {
        status: 'cancelado',
        motivo_cancelamento: motivo,
        cancelado_em: new Date().toISOString(),
        cancelado_por: user?.id ?? null,
      });
      if (!ok) {
        toast.error('Este disparo já foi encerrado — recarregue para ver o status atual.');
        return;
      }
      toast.success('Disparo cancelado');
    } catch (err) {
      toast.error(errMsg(err, 'Erro ao cancelar disparo'));
    } finally {
      setAgindo(false);
    }
  };

  /**
   * Retomar revalida antes o que a validação sabe conferir (variável sem
   * valor, nome inválido, template não aprovado) — ela NÃO sabe por que o
   * sistema pausou. Por isso lemos a resposta do dispatch: se ele pausar de
   * novo na mesma chamada (taxa de falha, limite), a tela mostra o motivo em
   * vez de "retomado".
   */
  const retomar = async (id: string) => {
    setAgindo(true);
    try {
      const bloqueantes = await validarBloqueantes(id);
      if (bloqueantes.length > 0) {
        toast.error(`Não é possível retomar: ${bloqueantes.map((p) => p.detalhe).join(' · ')}`);
        return;
      }
      const ok = await transicionar(id, ['pausado'], { status: 'enviando' });
      if (!ok) {
        toast.error('Este disparo não está mais pausado — recarregue para ver o status atual.');
        return;
      }
      const { data, error } = await supabase.functions.invoke('wa-broadcast-dispatch', {
        body: { broadcast_id: id },
      });
      invalidar(id);
      if (error) {
        toast.warning('Disparo retomado. O próximo lote sai no próximo ciclo automático.');
        return;
      }
      const res = (data ?? {}) as { pausado?: boolean; motivo?: string; concluido?: boolean };
      if (res.pausado) {
        toast.error(
          `O sistema pausou o disparo de novo${res.motivo ? `: ${res.motivo}` : ''} — resolva a causa antes de retomar.`,
        );
        return;
      }
      if (res.concluido) {
        toast.info('Este disparo já terminou — não há mais alvos pendentes.');
        return;
      }
      toast.success('Disparo retomado');
    } catch (err) {
      toast.error(errMsg(err, 'Erro ao retomar disparo'));
    } finally {
      setAgindo(false);
    }
  };

  return { pausar, retomar, cancelar, isPending: agindo };
}



/** Estágios e origens para os filtros opcionais do público. */
export interface WaBroadcastOrigemDisponivel {
  origin_id: string;
  nome: string;
  leads: number;
}

export interface WaBroadcastEstagioDisponivel {
  stage_id: string;
  nome: string;
  leads: number;
}

export function useWaOrigensDisponiveis() {
  return useQuery({
    queryKey: ['wa-broadcast-origens-disponiveis'],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('wa_broadcast_origens_disponiveis');
      if (error) throw error;
      return (data ?? []) as WaBroadcastOrigemDisponivel[];
    },
  });
}

export function useWaEstagiosDisponiveis(originId: string | null) {
  return useQuery({
    queryKey: ['wa-broadcast-estagios-disponiveis', originId || null],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('wa_broadcast_estagios_disponiveis', {
        _origin_id: originId || null,
      });
      if (error) throw error;
      return (data ?? []) as WaBroadcastEstagioDisponivel[];
    },
  });
}

/** Tag da carteira, com quantos leads alcançáveis a possuem. */
export interface WaBroadcastTagDisponivel {
  tag: string;
  leads: number;
}

/**
 * Escopo `bu` exige BU escolhida: a RPC levanta exceção sem ela, então a query
 * só é habilitada quando o recorte está coerente.
 */
const escopoCoerente = (escopo: WaBroadcastEscopo, bu: string | null) =>
  escopo !== 'bu' || !!bu;

/** Estágios visíveis dentro do escopo atual (carteira própria ou BU inteira). */
export function useWaEstagiosNoEscopo(
  escopo: WaBroadcastEscopo,
  bu: string | null,
  originId: string | null,
) {
  return useQuery({
    queryKey: ['wa-broadcast-estagios-no-escopo', escopo, bu || null, originId || null],
    enabled: escopoCoerente(escopo, bu),
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<WaBroadcastEstagioDisponivel[]> => {
      const { data, error } = await supabase.rpc('wa_broadcast_estagios_no_escopo', {
        _escopo: escopo,
        _bu: bu || null,
        _origin_id: originId || null,
      });
      if (error) throw error;
      return (data ?? []) as WaBroadcastEstagioDisponivel[];
    },
  });
}

/** Tags visíveis dentro do escopo atual. */
export function useWaTagsNoEscopo(
  escopo: WaBroadcastEscopo,
  bu: string | null,
  originId: string | null,
) {
  return useQuery({
    queryKey: ['wa-broadcast-tags-no-escopo', escopo, bu || null, originId || null],
    enabled: escopoCoerente(escopo, bu),
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<WaBroadcastTagDisponivel[]> => {
      const { data, error } = await supabase.rpc('wa_broadcast_tags_no_escopo', {
        _escopo: escopo,
        _bu: bu || null,
        _origin_id: originId || null,
      });
      if (error) throw error;
      return (data ?? []) as WaBroadcastTagDisponivel[];
    },
  });
}



/**
 * BUs com leads alcançáveis, com quantos SDRs cada uma tem. A função devolve
 * vazio para quem não é admin/manager — o próprio resultado serve de gate.
 */
export function useWaBusDisponiveis() {
  return useQuery({
    queryKey: ['wa-broadcast-bus-disponiveis'],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<WaBroadcastBuDisponivel[]> => {
      const { data, error } = await supabase.rpc('wa_broadcast_bus_disponiveis');
      if (error) throw error;
      // Guarda: BU vazia derruba o <SelectItem value=""> do Radix e a tela inteira.
      return ((data ?? []) as WaBroadcastBuDisponivel[])
        .filter((b) => !!b.bu?.trim())
        .map((b) => ({ ...b, leads_sem_dono_ativo: b.leads_sem_dono_ativo ?? 0 }))
        .sort((a, b) => b.leads - a.leads);
    },
  });
}

/** Exclui rascunho — a RLS só permite rascunho próprio. */
export function useExcluirRascunho() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (broadcastId: string) => {
      const { data, error } = await supabase
        .from('wa_broadcasts')
        .delete()
        .eq('id', broadcastId)
        .eq('status', 'rascunho')
        .select('id');
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('Só é possível excluir um rascunho seu — recarregue a tela.');
      }
    },
    onSuccess: () => {
      toast.success('Rascunho excluído');
      qc.invalidateQueries({ queryKey: ['wa-broadcasts'] });
    },
    onError: (err) => toast.error(errMsg(err, 'Erro ao excluir rascunho')),
  });
}

/**
 * Cria um disparo em rascunho a partir de uma seleção de negócios do CRM.
 * Toda a validação de permissão (carteira do SDR, BU única para admin) é do
 * banco — a mensagem de erro é exibida exatamente como vem.
 */
export function useCriarDisparoDeSelecao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ nome, dealIds }: { nome: string; dealIds: string[] }): Promise<string> => {
      const { data, error } = await supabase.rpc('wa_broadcast_criar_de_selecao', {
        _nome: nome,
        _deal_ids: dealIds,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wa-broadcasts'] });
    },
    onError: (err) => toast.error(errMsg(err, 'Não foi possível criar o disparo')),
  });
}
