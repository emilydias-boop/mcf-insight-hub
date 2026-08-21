import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowLeft, Printer, AlertTriangle, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useLeadReport, BOOKED_AT_TRACKING_SINCE, type SourceStatus } from '@/hooks/useLeadReport';
import { useLeadFullTimeline } from '@/hooks/useLeadFullTimeline';
import { maskDocumento } from '@/lib/consorcioTermo';
import { PAPEL_CSS, PAPEL_PAGE_CSS } from '@/lib/documentoPapel';
import { PapelBrand } from '@/components/consorcio/PapelBrand';

/**
 * Impressão: NÃO usar `position: absolute` no container do relatório — no Chromium
 * um bloco absolutamente posicionado maior que uma página não pagina e o restante
 * é descartado. Além disso, os ancestrais do layout (`SidebarInset` com
 * `overflow-hidden` e o wrapper com `overflow-auto`) fazem o Chromium **cortar** o
 * conteúdo em vez de paginar: por isso forçamos `overflow: visible` e altura
 * automática em todo ancestral do relatório.
 */
const PRINT_CSS = `
@media print {
  body *:not(:has(#lead-report)):not(#lead-report):not(#lead-report *) {
    display: none !important;
  }
  html, body, body *:has(#lead-report) {
    overflow: visible !important;
    height: auto !important;
    max-height: none !important;
    min-height: 0 !important;
    position: static !important;
    display: block !important;
  }
  #lead-report { position: static !important; width: 100% !important; max-width: none !important; padding: 0 !important; margin: 0 !important; }
  .no-print { display: none !important; }
  .report-section { break-inside: auto; }
  .avoid-break { break-inside: avoid; }
  table { break-inside: auto; }
  thead { display: table-header-group; }
  tr, li { break-inside: avoid; }
}
`;

/**
 * Selos do papel — NÃO usar `Badge` do design system aqui: `variant="outline"`
 * aplica `text-foreground`, que no tema escuro é quase branco e desaparece
 * sobre o papel claro (na tela e no PDF).
 */
function Selo({ children, tom = 'neutro' }: { children: React.ReactNode; tom?: 'neutro' | 'erro' | 'mcf' }) {
  const cls = tom === 'erro' ? 'tag err' : tom === 'mcf' ? 'tag mcf' : 'tag cli';
  return <span className={cls}>{children}</span>;
}

/** Aviso em tinta explícita (o `Alert` do design system herda os tokens). */
const Aviso = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={className ? `aviso ${className}` : 'aviso'}>{children}</div>
);

const NOT_RECORDED = 'não registrado';

const fmtDate = (v?: string | null, absent = NOT_RECORDED) =>
  v ? format(new Date(v), 'dd/MM/yyyy', { locale: ptBR }) : absent;
const fmtDateTime = (v?: string | null, absent = NOT_RECORDED) =>
  v ? format(new Date(v), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : absent;
const fmtMoney = (v?: number | null, absent = NOT_RECORDED) =>
  v === null || v === undefined ? absent : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtInt = (v?: number | null) => (v === null || v === undefined ? NOT_RECORDED : String(v));

function Section({
  title,
  subtitle,
  source,
  showTechnical,
  children,
}: {
  title: string;
  subtitle?: string;
  source?: SourceStatus | SourceStatus[];
  showTechnical?: boolean;
  children: React.ReactNode;
}) {
  const failures = (Array.isArray(source) ? source : source ? [source] : []).filter((s) => !s.ok);
  return (
    <section className="report-section space-y-2">
      <div>
        <h2>{title}</h2>
        {subtitle && <p className="sub">{subtitle}</p>}
      </div>
      {failures.length > 0 && (
        <Aviso className="avoid-break">
          Não foi possível carregar esta seção
          {showTechnical ? ` — ${failures.map((f) => f.error || 'erro desconhecido').join(' · ')}` : ''}
          . Nada aqui pode ser lido como ausência de dado.
        </Aviso>
      )}
      {children}
    </section>
  );
}

function Field({ label, value, full }: { label: string; value: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? 'full' : undefined}>
      <b>{label}</b>
      <span className="break-words">{value ?? NOT_RECORDED}</span>
    </div>
  );
}

const Empty = ({ children }: { children: React.ReactNode }) => (
  <p className="text-sm italic" style={{ color: '#777' }}>
    {children}
  </p>
);

const jsonSnippet = (v: any) => {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'object') {
    const s = JSON.stringify(v);
    return s.length > 240 ? `${s.slice(0, 240)}…` : s;
  }
  return String(v);
};

/**
 * Permissão avaliada ANTES das queries do relatório.
 * Enquanto carrega, o default é NEGAR.
 */
function useLeadReportAccess(dealId: string | undefined) {
  const { user, role, allRoles } = useAuth() as any;
  const roles: string[] = allRoles?.length ? allRoles : role ? [role] : [];
  const isLeadership = roles.some((r) => ['admin', 'manager', 'coordenador'].includes(r));

  const { data, isLoading, error } = useQuery({
    queryKey: ['lead-report-access', dealId],
    enabled: !!dealId && !isLeadership,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_deals')
        .select('id, owner_profile_id, owner_id, original_sdr_email, r1_closer_email, r2_closer_email')
        .eq('id', dealId as string)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  if (isLeadership) return { canView: true, isLeadership, loading: false, error: null as any };
  if (isLoading || !data) return { canView: false, isLeadership, loading: isLoading, error };

  const email = (user?.email || '').toLowerCase();
  const owns =
    (!!data.owner_profile_id && !!user?.id && data.owner_profile_id === user.id) ||
    (!!(data as any).owner_id && !!user?.id && (data as any).owner_id === user.id) ||
    [data.original_sdr_email, data.r1_closer_email, data.r2_closer_email]
      .filter(Boolean)
      .some((e) => (e as string).toLowerCase() === email);

  return { canView: owns, isLeadership, loading: false, error };
}

export default function RelatorioLead() {
  const { dealId } = useParams<{ dealId: string }>();
  const navigate = useNavigate();
  const access = useLeadReportAccess(dealId);

  const { data, isLoading, error } = useLeadReport(dealId, access.canView);

  const { data: timeline = [], error: timelineError } = useLeadFullTimeline({
    dealId: dealId || '',
    dealUuid: dealId || '',
    contactEmail: data?.contact.email || undefined,
    // sem contactId: mesma assinatura do relatório → uma única resolução de ids
    meetings: data?.meetings ?? null,
    enabled: access.canView && !!data,
  });

  const bookedAtCutoff = useMemo(() => new Date(`${BOOKED_AT_TRACKING_SINCE}T00:00:00`).getTime(), []);

  if (access.loading) {
    return (
      <div className="p-6 space-y-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!access.canView) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertDescription>
            Você não tem permissão para ver o relatório deste lead. Ele é visível para liderança e para o
            SDR/Closer responsável.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertDescription>
            Não foi possível carregar o relatório deste lead. {(error as any)?.message || ''}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const d = data.deal;
  const s = data.sources;
  /** Mensagem técnica (nome de tabela/coluna) só para liderança. */
  const tech = !!access.isLeadership;

  return (
    <div className="p-4 md:p-6">
      <style>{`${PAPEL_CSS}\n${PRINT_CSS}\n${PAPEL_PAGE_CSS}`}</style>

      <div className="no-print flex items-center justify-between mb-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        <Button size="sm" onClick={() => window.print()}>
          <Printer className="h-4 w-4 mr-2" />
          Imprimir / PDF
        </Button>
      </div>

      <div id="lead-report" className="papel mx-auto max-w-4xl space-y-5 rounded-lg border bg-[#fcfcfb] p-8">
        {/* Cabeçalho */}
        <header className="space-y-1 avoid-break">
          <PapelBrand subtitulo="Relatório do Lead — Consórcio" />
          <h1>Relatório do Lead — {d.name || data.contact.name || 'Sem nome'}</h1>
          <p className="sub">
            {data.contact.email ? `${data.contact.email} · ` : ''}
            {d.pipeline_name ? `${d.pipeline_name} · ` : ''}Negócio {d.id}
          </p>
          {data.unknowns.length > 0 && (
            <Aviso className="mt-2 avoid-break">
              <strong>Atenção:</strong> parte das fontes não pôde ser lida. Onde isso ocorreu, o relatório diz
              “fonte indisponível” — não afirma ausência.
            </Aviso>
          )}
        </header>

        {/* 1. Identificação */}
        <Section title="1. Identificação" source={[s.deal, s.deals, s.profiles]} showTechnical={tech}>
          <div className="kv">
            <Field label="Contato" value={data.contact.name} />
            <Field label="E-mail" value={data.contact.email} />
            <Field label="Telefone" value={data.contact.phone} />
            <Field label="Entrada no CRM" value={fmtDateTime(d.created_at)} />
            <Field label="Pipeline atual" value={d.pipeline_name} />
            <Field label="Estágio atual" value={d.stage_name} />
            <Field label="Responsável" value={d.owner_name} />
            <Field label="SDR de origem" value={d.original_sdr_email} />
            <Field label="Closer R1" value={d.r1_closer_email} />
            <Field label="Closer R2" value={d.r2_closer_email} />
            <Field label="Produto" value={d.product_name} />
            <Field label="Valor do negócio" value={fmtMoney(d.value)} />
            <Field label="Temperatura" value={d.lead_temperature} />
            <Field label="Segmento ICP" value={d.icp_segment ?? '—'} />
            <Field label="Tags" value={d.tags?.length ? d.tags.join(', ') : NOT_RECORDED} />
          </div>

          {data.pipelines.length > 1 && (
            <div className="mt-2 text-sm">
              <div className="text-xs dim mb-1">Presença em outras pipelines</div>
              <ul className="list-disc pl-5">
                {data.pipelines.map((p) => (
                  <li key={p.deal_id}>
                    {p.pipeline_name || 'Pipeline'} — {p.stage_name || 'sem estágio'} (desde {fmtDate(p.created_at)})
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Section>

        {/* 2. Linha do tempo */}
        <Section
          title="2. Linha do tempo"
          subtitle="Eventos registrados em todos os negócios deste contato. Reuniões vêm da mesma leitura da seção 3."
        >
          {timelineError ? (
            <Aviso className="avoid-break">
              Não foi possível carregar a linha do tempo
              {tech ? ` — ${(timelineError as any)?.message || 'erro desconhecido'}` : ''}. Fonte indisponível,
              não é possível afirmar ausência de eventos.
            </Aviso>
          ) : timeline.length === 0 ? (
            <Empty>Nenhum evento registrado.</Empty>
          ) : (
            <div className="tl">
              {[...timeline]
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                .map((e) => {
                  const texto = `${e.title} ${e.description || ''}`.toLowerCase();
                  const pendente = /no-?show|pendente|aguard|atras|recus|cancel|declin/.test(texto);
                  const concluido = /pago|assinad|realizada|cadastrad|conclu/.test(texto);
                  return (
                    <div
                      key={e.id}
                      className={`ev ${pendente ? 'warn' : concluido ? 'ok' : ''}`}
                    >
                      <div className="when">{fmtDateTime(e.date)}</div>
                      <div className="what">{e.title}</div>
                      {e.description ? <div className="who">{e.description}</div> : null}
                      {e.author ? <div className="who">{e.author}</div> : null}
                    </div>
                  );
                })}
            </div>
          )}
        </Section>

        {/* 3. Reuniões */}
        <Section title="3. Reuniões" source={[s.meetings, s.movements]} showTechnical={tech}>
          {!s.meetings.ok ? null : data.meetings.length === 0 ? (
            <Empty>Nenhuma reunião registrada na agenda.</Empty>
          ) : (
            <div className="space-y-3">
              {data.meetings.map((m) => {
                const scheduledMs = m.scheduled_at ? new Date(m.scheduled_at).getTime() : null;
                const preCutoff = scheduledMs !== null && scheduledMs < bookedAtCutoff;
                return (
                  <div key={m.id} className="bloco text-sm space-y-1 avoid-break">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong>{fmtDateTime(m.scheduled_at)}</strong>
                      <Selo>{m.status || 'sem status'}</Selo>
                      {m.is_reschedule && <Selo>Remarcada</Selo>}
                      {m.contract_paid_at && (
                        <Selo>Contrato pago {fmtDate(m.contract_paid_at)}</Selo>
                      )}
                      {m.refunded_at && <Selo>Reembolsado {fmtDate(m.refunded_at)}</Selo>}
                    </div>
                    <div className="kv">
                      <Field label="Closer" value={m.closer_name} />
                      <Field label="Agendada por" value={m.booked_by_name} />
                      <Field
                        label="Agendada em"
                        value={
                          m.booked_at ? (
                            fmtDateTime(m.booked_at)
                          ) : (
                            <span className="dim">
                              não registrado
                              {preCutoff
                                ? ' — agendamentos anteriores a 16/08/2026 não gravavam a data do agendamento'
                                : ''}
                            </span>
                          )
                        }
                      />
                    </div>
                    {(m.outcome_reason || m.outcome_reason_note) && (
                      <div className="text-xs">
                        <span className="dim">Desfecho: </span>
                        {m.outcome_reason}
                        {m.outcome_reason_note ? ` — ${m.outcome_reason_note}` : ''}
                      </div>
                    )}
                    {m.notes && (
                      <div className="text-xs whitespace-pre-wrap">
                        <span className="dim">Notas: </span>
                        {m.notes}
                      </div>
                    )}
                    {m.closer_notes && (
                      <div className="text-xs whitespace-pre-wrap">
                        <span className="dim">Notas do closer: </span>
                        {m.closer_notes}
                      </div>
                    )}
                    {m.movements.length > 0 && (
                      <div className="text-xs">
                        <div className="dim">Movimentações</div>
                        <ul className="list-disc pl-5">
                          {m.movements.map((mv) => (
                            <li key={mv.id}>
                              {fmtDateTime(mv.created_at)} — {mv.movement_type || 'movimentação'}
                              {mv.from_scheduled_at || mv.to_scheduled_at
                                ? `: ${fmtDateTime(mv.from_scheduled_at)} → ${fmtDateTime(mv.to_scheduled_at)}`
                                : ''}
                              {mv.to_closer_name
                                ? ` · closer: ${mv.from_closer_name || NOT_RECORDED} → ${mv.to_closer_name}`
                                : ''}
                              {mv.reason ? ` · motivo: ${mv.reason}` : ''}
                              {mv.moved_by_name ? ` (${mv.moved_by_name})` : ''}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Section>

        {/* 4. Cartas / Propostas */}
        <Section title="4. Cartas negociadas" source={[s.proposals, s.audit]} showTechnical={tech}>
          {!s.proposals.ok ? null : data.proposals.length === 0 ? (
            <Empty>Nenhuma carta/proposta registrada.</Empty>
          ) : (
            <div className="space-y-3">
              {data.proposals.map((p) => (
                <div key={p.id} className="bloco text-sm space-y-1 avoid-break">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong>{fmtMoney(p.valor_credito)}</strong>
                    <span className="text-xs dim">
                      {p.prazo_meses ? `${p.prazo_meses} meses` : ''} {p.tipo_produto || ''}
                    </span>
                    <Selo>{p.status || 'sem status'}</Selo>
                    {(p.carta_excluida || p.excluida_value) && <Selo tom="erro">Excluída</Selo>}
                  </div>
                  <div className="kv">
                    <Field label="Data da proposta" value={fmtDate(p.proposal_date)} />
                    <Field
                      label="Criada em"
                      value={`${fmtDateTime(p.created_at)}${p.created_by_name ? ` · ${p.created_by_name}` : ''}`}
                    />
                    <Field
                      label="Aceite"
                      value={
                        p.aceite_value
                          ? `${fmtDateTime(p.aceite_value)}${p.aceite_by_name ? ` · ${p.aceite_by_name}` : ''} (campo ${p.aceite_source})`
                          : NOT_RECORDED
                      }
                    />
                    {p.recusada_at && (
                      <Field
                        label="Recusa"
                        value={`${fmtDateTime(p.recusada_at)}${p.recusada_by_name ? ` · ${p.recusada_by_name}` : ''}${p.motivo_recusa ? ` — ${p.motivo_recusa}` : ''}`}
                      />
                    )}
                  </div>
                  {p.proposal_details && (
                    <div className="text-xs whitespace-pre-wrap">
                      <span className="dim">Detalhes: </span>
                      {p.proposal_details}
                    </div>
                  )}
                  {(p.carta_excluida || p.excluida_value) && (
                    <div className="text-xs">
                      <span className="dim">Exclusão: </span>
                      {p.excluida_value ? `${fmtDateTime(p.excluida_value)} (campo ${p.excluida_source})` : NOT_RECORDED}
                      {p.carta_excluida_por_nome
                        ? ` · ${p.carta_excluida_por_nome}${
                            p.excluida_por_source === 'perfil_do_usuario'
                              ? ' (nome obtido do perfil do usuário, campo carta_excluida_por)'
                              : ' (campo carta_excluida_por_nome)'
                          }`
                        : ''}
                      {p.excluida_motivo ? ` — ${p.excluida_motivo} (campo ${p.excluida_motivo_source})` : ''}
                    </div>
                  )}
                  {p.valueChanges.length > 0 && (
                    <div className="text-xs">
                      <div className="dim">Alterações de valor/condição</div>
                      <ul className="list-disc pl-5">
                        {p.valueChanges.map((a) => (
                          <li key={a.id}>
                            {fmtDateTime(a.created_at)}
                            {a.actor_name ? ` · ${a.actor_name}` : ''} —{' '}
                            {a.changes.length
                              ? a.changes
                                  .map((c) => `${c.field}: ${jsonSnippet(c.from)} → ${jsonSnippet(c.to)}`)
                                  .join('; ')
                              : a.action}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* 5. Cadastros e documentos */}
        <Section title="5. Cadastro e documentos do cliente" source={[s.registrations, s.registrationsByProposal]} showTechnical={tech}>
          {!s.registrations.ok ? null : data.registrations.length === 0 ? (
            <Empty>Nenhum cadastro de dados da cota registrado.</Empty>
          ) : (
            <div className="space-y-3">
              {data.registrations.map((r) => (
                <div key={r.id} className="bloco text-sm space-y-1 avoid-break">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong>{r.nome || 'Sem nome'}</strong>
                    <Selo>{r.tipo_pessoa === 'PJ' ? 'PJ' : 'PF'}</Selo>
                    <Selo>{r.status || 'sem status'}</Selo>
                    {r.declinada_at && <Selo tom="erro">Declinado</Selo>}
                  </div>
                  <div className="kv">
                    <Field label="Categoria" value={r.categoria} />
                    <Field label="Crédito" value={fmtMoney(r.valor_credito)} />
                    <Field label="Prazo" value={r.prazo_meses ? `${r.prazo_meses} meses` : NOT_RECORDED} />
                    <Field label="Condição" value={r.condicao_pagamento} />
                    <Field label="Parcela 1ª–12ª" value={fmtMoney(r.parcela_1a_12a)} />
                    <Field label="Parcela demais" value={fmtMoney(r.parcela_demais)} />
                    <Field label="Parcelas pagas pela MCF" value={fmtInt(r.parcelas_pagas_empresa)} />
                    <Field label="Vencimento" value={r.dia_vencimento ? `dia ${r.dia_vencimento}` : 'A definir'} />
                    <Field label="Grupo / Cota" value={`${r.grupo || NOT_RECORDED} / ${r.cota || NOT_RECORDED}`} />
                    <Field label="Criado em" value={fmtDateTime(r.created_at)} />
                    <Field label="Cadastrada na Embracon" value={fmtDateTime(r.cadastrada_at)} />
                    <Field label="Cadastrada por" value={r.cadastrada_por} />
                    <Field label="Cota aberta" value={fmtDateTime(r.cota_aberta_at)} />
                    <Field label="Cota aberta por" value={r.cota_aberta_por} />
                    <Field label="Vinculada em" value={fmtDateTime(r.vinculada_at)} />
                    <Field label="Vinculada por" value={r.vinculada_por} />
                  </div>
                  {r.declinada_at && (
                    <div className="text-xs">
                      <span className="dim">Declínio: </span>
                      {fmtDateTime(r.declinada_at)}
                      {r.motivo_declinio ? ` — ${r.motivo_declinio}` : ''}
                    </div>
                  )}
                  <div className="text-xs">
                    <div className="dim">Documentos anexados ao cadastro</div>
                    {!s.documents.ok ? (
                      <span className="italic">fonte indisponível, não é possível afirmar</span>
                    ) : r.documentos.length === 0 ? (
                      <span className="italic">nenhum documento anexado a este cadastro</span>
                    ) : (
                      <ul className="list-disc pl-5">
                        {r.documentos.map((doc) => (
                          <li key={doc.id}>
                            {doc.tipo || 'documento'} — {doc.nome_arquivo || 'arquivo'} ({fmtDate(doc.uploaded_at)})
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {s.documents.ok && data.documentosSoltos.length > 0 && (
            <div className="mt-3 text-sm avoid-break">
              <div className="text-xs dim mb-1">
                Documentos sem vínculo conhecido (nem cota, nem cadastro deste lead)
              </div>
              <ul className="list-disc pl-5 text-xs">
                {data.documentosSoltos.map((doc) => (
                  <li key={doc.id}>
                    {doc.tipo || 'documento'} — {doc.nome_arquivo || 'arquivo'} ({fmtDate(doc.uploaded_at)})
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-3">
            <div className="text-xs dim mb-1">
              Documentos assinados (termo de adesão e comprovante de cadastro) — evidência de assinatura
            </div>
            {!s.termos.ok ? (
              <Empty>Fonte indisponível, não é possível afirmar se há documentos emitidos.</Empty>
            ) : data.termos.length === 0 ? (
              <Empty>Nenhum documento emitido.</Empty>
            ) : (
              <div className="space-y-2">
                {data.termos.map((t) => (
                  <div key={t.id} className="bloco text-xs space-y-1 avoid-break">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong>
                        {t.tipo === 'comprovante_cadastro' ? 'Comprovante de Cadastro' : 'Termo de Adesão'}
                      </strong>
                      <Selo>{t.status}</Selo>
                      <span className="dim">
                        modelo v{t.modelo_versao ?? '?'} · emitido em {fmtDateTime(t.created_at)}
                      </span>
                    </div>
                    <div className="kv">
                      <Field label="Assinante" value={t.assinante_nome} />
                      <Field
                        label="CPF do assinante"
                        value={t.assinante_cpf ? maskDocumento(t.assinante_cpf) : NOT_RECORDED}
                      />
                      <Field label="Assinado em" value={fmtDateTime(t.assinado_em)} />
                      <Field label="IP da assinatura" value={t.assinante_ip || NOT_RECORDED} />
                      <Field label="Visualizado em" value={fmtDateTime(t.visualizado_em)} />
                      <Field label="IP da visualização" value={t.visualizado_ip || NOT_RECORDED} />
                      <Field label="Validade do link" value={fmtDateTime(t.expires_at)} />
                      <Field
                        label="Cancelado em"
                        value={
                          t.cancelado_em
                            ? `${fmtDateTime(t.cancelado_em)}${t.cancelado_motivo ? ` — ${t.cancelado_motivo}` : ''}`
                            : '—'
                        }
                      />
                    </div>
                    <div>
                      <span className="dim">Hash SHA-256 do conteúdo: </span>
                      <span className="font-mono break-all">{t.conteudo_hash || NOT_RECORDED}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Section>

        {/* 6. Cotas e parcelas */}
        <Section title="6. Cotas e parcelas" source={[s.cards, s.installments, s.cardActivity]} showTechnical={tech}>
          {!s.cards.ok ? null : data.cards.length === 0 ? (
            <Empty>Nenhuma cota vinculada a este lead.</Empty>
          ) : (
            <div className="space-y-4">
              {data.cards.map((c) => (
                <div key={c.id} className="bloco text-sm space-y-2">
                  <div className="flex flex-wrap items-center gap-2 avoid-break">
                    <strong>
                      Grupo {c.grupo || NOT_RECORDED} · Cota {c.cota || NOT_RECORDED}
                    </strong>
                    <Selo>{c.status || 'sem status'}</Selo>
                    {c.isExternal && <Selo tom="erro">Cota externa (sem vínculo com o funil)</Selo>}
                  </div>
                  <div className="kv avoid-break">
                    <Field label="Contrato Embracon" value={c.contrato_embracon} />
                    <Field label="Crédito" value={fmtMoney(c.valor_credito)} />
                    <Field label="Prazo" value={c.prazo_meses ? `${c.prazo_meses} meses` : NOT_RECORDED} />
                    <Field label="Contratação" value={fmtDate(c.data_contratacao)} />
                    <Field label="Parcela 1ª–12ª" value={fmtMoney(c.parcela_1a_12a)} />
                    <Field label="Parcela demais" value={fmtMoney(c.parcela_demais)} />
                    <Field label="Parcelas pagas pela MCF" value={fmtInt(c.parcelas_pagas_empresa)} />
                    <Field label="Vendedor" value={c.vendedor_name} />
                  </div>

                  {/* Somatórios por responsável de pagamento */}
                  {!s.installments.ok ? (
                    <Empty>Parcelas: fonte indisponível, não é possível afirmar.</Empty>
                  ) : c.installments.length === 0 ? (
                    <Empty>Nenhuma parcela gerada para esta cota.</Empty>
                  ) : (
                    <>
                      <table className="doc avoid-break">
                        <thead>
                          <tr>
                            <th>Quem paga</th>
                            <th>Parcelas</th>
                            <th>Total</th>
                            <th>Já pago</th>
                            <th>Falta</th>
                          </tr>
                        </thead>
                        <tbody>
                          {([
                            ['MCF Capital', c.totals.empresa],
                            ['Cliente', c.totals.cliente],
                          ] as const).map(([label, t]) => (
                            <tr key={label}>
                              <td>
                                <span className={label === 'Cliente' ? 'tag cli' : 'tag mcf'}>{label}</span>
                              </td>
                              <td>
                                {t.paidCount}/{t.count}
                              </td>
                              <td>{fmtMoney(t.total)}</td>
                              <td>{fmtMoney(t.paid)}</td>
                              <td>
                                {fmtMoney(t.open)} ({t.openCount})
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      <table className="doc">
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Quem paga</th>
                            <th>Valor</th>
                            <th>Vencimento</th>
                            <th>Pagamento</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {c.installments.map((i) => (
                            <tr key={i.id}>
                              <td>{i.numero_parcela}</td>
                              <td>
                                <span className={i.tipo === 'empresa' ? 'tag mcf' : 'tag cli'}>
                                  {i.tipo === 'empresa' ? 'MCF Capital' : 'Cliente'}
                                </span>
                              </td>
                              <td>{fmtMoney(i.valor_parcela)}</td>
                              <td>{fmtDate(i.data_vencimento)}</td>
                              <td>{fmtDate(i.data_pagamento, 'não pago')}</td>
                              <td>
                                <span
                                  className={
                                    i.data_pagamento || /pag/i.test(i.status || '')
                                      ? 'tag pg'
                                      : 'tag pend'
                                  }
                                >
                                  {i.status || NOT_RECORDED}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  )}

                  <div className="text-xs">
                    <div className="dim">Documentos anexados à cota</div>
                    {!s.documents.ok ? (
                      <span className="italic">fonte indisponível, não é possível afirmar</span>
                    ) : c.documentos.length === 0 ? (
                      <span className="italic">nenhum documento anexado</span>
                    ) : (
                      <ul className="list-disc pl-5">
                        {c.documentos.map((doc) => (
                          <li key={doc.id}>
                            {doc.tipo || 'documento'} — {doc.nome_arquivo || 'arquivo'} ({fmtDate(doc.uploaded_at)})
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Histórico da cota (antes → depois) */}
                  <div className="text-xs">
                    <div className="dim">Histórico da cota (antes → depois)</div>
                    {!s.cardActivity.ok ? (
                      <span className="italic">fonte indisponível, não é possível afirmar</span>
                    ) : c.activity.length === 0 ? (
                      <span className="italic">nenhum evento registrado</span>
                    ) : (
                      <ul className="list-disc pl-5">
                        {c.activity.map((a) => (
                          <li key={a.id}>
                            {fmtDateTime(a.created_at)} — {a.description || a.event_type}
                            {a.event_category ? ` [${a.event_category}]` : ''}
                            {a.before_value !== null || a.after_value !== null
                              ? `: ${jsonSnippet(a.before_value)} → ${jsonSnippet(a.after_value)}`
                              : ''}
                            {a.actor_name ? ` (${a.actor_name})` : ''}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* 7. Lacunas */}
        <Section
          title="7. Lacunas e pendências"
          subtitle="Checagens automáticas. Só afirmam ausência quando a fonte correspondente foi lida com sucesso."
        >
          {data.unknowns.length > 0 && (
            <ul className="space-y-1 text-sm mb-2">
              {data.unknowns.map((u, i) => (
                <li key={`u-${i}`} className="flex items-start gap-2">
                  <HelpCircle className="h-4 w-4 mt-0.5 shrink-0 dim" />
                  <span>
                    {u.label}: fonte indisponível, não é possível afirmar
                    {tech && u.error ? ` (${u.error})` : ''}.
                  </span>
                </li>
              ))}
            </ul>
          )}
          {data.gaps.length === 0 ? (
            <Empty>
              {data.unknowns.length > 0
                ? 'Nenhuma lacuna identificada nas fontes que puderam ser lidas.'
                : 'Nenhuma lacuna identificada.'}
            </Empty>
          ) : (
            <ul className="space-y-1 text-sm">
              {data.gaps.map((g, i) => (
                <li key={i} className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-600" />
                  <span>{g}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <p className="legal">
          Relatório gerado em {fmtDateTime(new Date().toISOString())} a partir dos registros do MCF Gestão. Cada
          evento tem origem rastreável, com autor e carimbo de data e hora.
        </p>
      </div>
    </div>
  );
}
