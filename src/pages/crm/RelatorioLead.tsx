import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowLeft, Printer, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/contexts/AuthContext';
import { useLeadReport } from '@/hooks/useLeadReport';
import { useLeadFullTimeline } from '@/hooks/useLeadFullTimeline';

const PRINT_CSS = `
@media print {
  body * { visibility: hidden !important; }
  #lead-report, #lead-report * { visibility: visible !important; }
  #lead-report { position: absolute; left: 0; top: 0; width: 100%; padding: 0; }
  .no-print { display: none !important; }
  .report-section { break-inside: avoid; }
  @page { size: A4; margin: 14mm; }
}
`;

const fmtDate = (v?: string | null) =>
  v ? format(new Date(v), 'dd/MM/yyyy', { locale: ptBR }) : '—';
const fmtDateTime = (v?: string | null) =>
  v ? format(new Date(v), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : '—';
const fmtMoney = (v?: number | null) =>
  v === null || v === undefined
    ? '—'
    : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="report-section space-y-2 border-t border-border pt-4">
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="text-sm">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium break-words">{value ?? '—'}</div>
    </div>
  );
}

const Empty = ({ children }: { children: React.ReactNode }) => (
  <p className="text-sm text-muted-foreground italic">{children}</p>
);

export default function RelatorioLead() {
  const { dealId } = useParams<{ dealId: string }>();
  const navigate = useNavigate();
  const { user, role, allRoles } = useAuth() as any;
  const { data, isLoading, error } = useLeadReport(dealId);

  const { data: timeline = [] } = useLeadFullTimeline({
    dealId: dealId || '',
    dealUuid: dealId || '',
    contactEmail: data?.contact.email || undefined,
    contactId: data?.contact.id || undefined,
  });

  const canView = useMemo(() => {
    if (!data) return true;
    const roles: string[] = allRoles?.length ? allRoles : role ? [role] : [];
    if (roles.some((r) => ['admin', 'manager', 'coordenador'].includes(r))) return true;
    const email = (user?.email || '').toLowerCase();
    const d = data.deal;
    if (d.owner_profile_id && user?.id && d.owner_profile_id === user.id) return true;
    return [d.r1_closer_email, d.r2_closer_email, d.original_sdr_email]
      .filter(Boolean)
      .some((e) => (e as string).toLowerCase() === email);
  }, [data, allRoles, role, user]);

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

  if (!canView) {
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

  const d = data.deal;

  return (
    <div className="p-4 md:p-6">
      <style>{PRINT_CSS}</style>

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

      <div id="lead-report" className="mx-auto max-w-4xl space-y-5 bg-background text-foreground">
        {/* Cabeçalho */}
        <header className="space-y-1">
          <h1 className="text-xl font-bold">Relatório do Lead — {d.name || data.contact.name || 'Sem nome'}</h1>
          <p className="text-xs text-muted-foreground">
            Gerado em {fmtDateTime(new Date().toISOString())} · Negócio {d.id}
          </p>
        </header>

        {/* 1. Identificação */}
        <Section title="1. Identificação">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
            <Field label="Segmento ICP" value={d.icp_segment} />
            <Field
              label="Tags"
              value={d.tags?.length ? d.tags.join(', ') : '—'}
            />
          </div>

          {data.pipelines.length > 1 && (
            <div className="mt-2 text-sm">
              <div className="text-xs text-muted-foreground mb-1">Presença em outras pipelines</div>
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
        <Section title="2. Linha do tempo" subtitle="Eventos registrados em todos os negócios deste contato.">
          {timeline.length === 0 ? (
            <Empty>Nenhum evento registrado.</Empty>
          ) : (
            <ul className="space-y-1 text-sm">
              {[...timeline]
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                .map((e) => (
                  <li key={e.id} className="flex gap-2">
                    <span className="text-xs text-muted-foreground whitespace-nowrap w-32 shrink-0">
                      {fmtDateTime(e.date)}
                    </span>
                    <span>
                      <strong>{e.title}</strong>
                      {e.description ? ` — ${e.description}` : ''}
                      {e.author ? ` (${e.author})` : ''}
                    </span>
                  </li>
                ))}
            </ul>
          )}
        </Section>

        {/* 3. Reuniões */}
        <Section title="3. Reuniões">
          {data.meetings.length === 0 ? (
            <Empty>Nenhuma reunião registrada na agenda.</Empty>
          ) : (
            <div className="space-y-3">
              {data.meetings.map((m) => (
                <div key={m.id} className="rounded border border-border p-3 text-sm space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong>{fmtDateTime(m.scheduled_at)}</strong>
                    <Badge variant="outline">{m.status || 'sem status'}</Badge>
                    {m.is_reschedule && <Badge variant="outline">Remarcada</Badge>}
                    {m.contract_paid_at && <Badge variant="outline">Contrato pago {fmtDate(m.contract_paid_at)}</Badge>}
                    {m.refunded_at && <Badge variant="outline">Reembolsado {fmtDate(m.refunded_at)}</Badge>}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    <Field label="Closer" value={m.closer_name} />
                    <Field label="Agendada por" value={m.booked_by_name} />
                    <Field label="Agendada em" value={fmtDateTime(m.booked_at)} />
                  </div>
                  {(m.outcome_reason || m.outcome_reason_note) && (
                    <div className="text-xs">
                      <span className="text-muted-foreground">Desfecho: </span>
                      {m.outcome_reason}
                      {m.outcome_reason_note ? ` — ${m.outcome_reason_note}` : ''}
                    </div>
                  )}
                  {m.notes && <div className="text-xs whitespace-pre-wrap"><span className="text-muted-foreground">Notas: </span>{m.notes}</div>}
                  {m.closer_notes && (
                    <div className="text-xs whitespace-pre-wrap">
                      <span className="text-muted-foreground">Notas do closer: </span>
                      {m.closer_notes}
                    </div>
                  )}
                  {m.movements.length > 0 && (
                    <div className="text-xs">
                      <div className="text-muted-foreground">Movimentações</div>
                      <ul className="list-disc pl-5">
                        {m.movements.map((mv) => (
                          <li key={mv.id}>
                            {fmtDateTime(mv.created_at)} — {mv.movement_type || 'movimentação'}
                            {mv.from_scheduled_at || mv.to_scheduled_at
                              ? `: ${fmtDateTime(mv.from_scheduled_at)} → ${fmtDateTime(mv.to_scheduled_at)}`
                              : ''}
                            {mv.to_closer_name ? ` · closer: ${mv.from_closer_name || '—'} → ${mv.to_closer_name}` : ''}
                            {mv.reason ? ` · motivo: ${mv.reason}` : ''}
                            {mv.moved_by_name ? ` (${mv.moved_by_name})` : ''}
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

        {/* 4. Cartas / Propostas */}
        <Section title="4. Cartas negociadas">
          {data.proposals.length === 0 ? (
            <Empty>Nenhuma carta/proposta registrada.</Empty>
          ) : (
            <div className="space-y-3">
              {data.proposals.map((p) => (
                <div key={p.id} className="rounded border border-border p-3 text-sm space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong>{fmtMoney(p.valor_credito)}</strong>
                    <span className="text-xs text-muted-foreground">
                      {p.prazo_meses ? `${p.prazo_meses} meses` : ''} {p.tipo_produto || ''}
                    </span>
                    <Badge variant="outline">{p.status || 'sem status'}</Badge>
                    {(p.carta_excluida || p.deleted_at) && <Badge variant="destructive">Excluída</Badge>}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    <Field label="Data da proposta" value={fmtDate(p.proposal_date)} />
                    <Field label="Criada em" value={`${fmtDateTime(p.created_at)}${p.created_by_name ? ` · ${p.created_by_name}` : ''}`} />
                    <Field
                      label="Aceite"
                      value={
                        p.aceite_at || p.aceite_date
                          ? `${fmtDateTime(p.aceite_at || p.aceite_date)}${p.aceite_by_name ? ` · ${p.aceite_by_name}` : ''}`
                          : '—'
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
                      <span className="text-muted-foreground">Detalhes: </span>
                      {p.proposal_details}
                    </div>
                  )}
                  {(p.carta_excluida || p.deleted_at) && (
                    <div className="text-xs">
                      <span className="text-muted-foreground">Exclusão: </span>
                      {fmtDateTime(p.carta_excluida_em || p.deleted_at)}
                      {p.carta_excluida_por_nome ? ` · ${p.carta_excluida_por_nome}` : ''}
                      {p.carta_excluida_motivo || p.deletion_reason
                        ? ` — ${p.carta_excluida_motivo || p.deletion_reason}`
                        : ''}
                    </div>
                  )}
                  {p.valueChanges.length > 0 && (
                    <div className="text-xs">
                      <div className="text-muted-foreground">Alterações de valor/condição</div>
                      <ul className="list-disc pl-5">
                        {p.valueChanges.map((a) => (
                          <li key={a.id}>
                            {fmtDateTime(a.created_at)}
                            {a.actor_name ? ` · ${a.actor_name}` : ''} —{' '}
                            {a.changes.length
                              ? a.changes.map((c) => `${c.field}: ${c.from ?? '—'} → ${c.to ?? '—'}`).join('; ')
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
        <Section title="5. Cadastro e documentos do cliente">
          {data.registrations.length === 0 ? (
            <Empty>Nenhum cadastro de dados da cota registrado.</Empty>
          ) : (
            <div className="space-y-3">
              {data.registrations.map((r) => (
                <div key={r.id} className="rounded border border-border p-3 text-sm space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong>{r.nome || 'Sem nome'}</strong>
                    <Badge variant="outline">{r.tipo_pessoa === 'PJ' ? 'PJ' : 'PF'}</Badge>
                    <Badge variant="outline">{r.status || 'sem status'}</Badge>
                    {r.declinada_at && <Badge variant="destructive">Declinado</Badge>}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <Field label="Categoria" value={r.categoria} />
                    <Field label="Crédito" value={fmtMoney(r.valor_credito)} />
                    <Field label="Prazo" value={r.prazo_meses ? `${r.prazo_meses} meses` : '—'} />
                    <Field label="Condição" value={r.condicao_pagamento} />
                    <Field label="Parcela 1ª–12ª" value={fmtMoney(r.parcela_1a_12a)} />
                    <Field label="Parcela demais" value={fmtMoney(r.parcela_demais)} />
                    <Field label="Parcelas pagas pela MCF" value={r.parcelas_pagas_empresa ?? '—'} />
                    <Field label="Vencimento" value={r.dia_vencimento ? `dia ${r.dia_vencimento}` : '—'} />
                    <Field label="Grupo / Cota" value={`${r.grupo || '—'} / ${r.cota || '—'}`} />
                    <Field label="Criado em" value={fmtDateTime(r.created_at)} />
                    <Field label="Cadastrada na Embracon" value={fmtDateTime(r.cadastrada_at)} />
                    <Field label="Cota aberta" value={fmtDateTime(r.cota_aberta_at)} />
                  </div>
                  {r.declinada_at && (
                    <div className="text-xs">
                      <span className="text-muted-foreground">Declínio: </span>
                      {fmtDateTime(r.declinada_at)}
                      {r.motivo_declinio ? ` — ${r.motivo_declinio}` : ''}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="mt-3">
            <div className="text-xs text-muted-foreground mb-1">Documentos do cliente (termo e comprovante)</div>
            {data.termos.length === 0 ? (
              <Empty>Nenhum documento emitido.</Empty>
            ) : (
              <ul className="text-sm space-y-1">
                {data.termos.map((t) => (
                  <li key={t.id}>
                    <strong>{t.tipo === 'comprovante_cadastro' ? 'Comprovante de Cadastro' : 'Termo de Adesão'}</strong>{' '}
                    (v{t.modelo_versao ?? '?'}) — {t.status} · emitido em {fmtDateTime(t.created_at)}
                    {t.assinado_em ? ` · assinado em ${fmtDateTime(t.assinado_em)}${t.assinante_nome ? ` por ${t.assinante_nome}` : ''}` : ''}
                    {t.visualizado_em ? ` · visualizado em ${fmtDateTime(t.visualizado_em)}` : ''}
                    {t.cancelado_em ? ` · cancelado em ${fmtDateTime(t.cancelado_em)}${t.cancelado_motivo ? ` (${t.cancelado_motivo})` : ''}` : ''}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Section>

        {/* 6. Cotas e parcelas */}
        <Section title="6. Cotas e parcelas">
          {data.cards.length === 0 ? (
            <Empty>Nenhuma cota vinculada a este lead.</Empty>
          ) : (
            <div className="space-y-4">
              {data.cards.map((c) => (
                <div key={c.id} className="rounded border border-border p-3 text-sm space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong>
                      Grupo {c.grupo || '—'} · Cota {c.cota || '—'}
                    </strong>
                    <Badge variant="outline">{c.status || 'sem status'}</Badge>
                    {c.isExternal && <Badge variant="destructive">Cota externa (sem vínculo com o funil)</Badge>}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <Field label="Contrato Embracon" value={c.contrato_embracon} />
                    <Field label="Crédito" value={fmtMoney(c.valor_credito)} />
                    <Field label="Prazo" value={c.prazo_meses ? `${c.prazo_meses} meses` : '—'} />
                    <Field label="Contratação" value={fmtDate(c.data_contratacao)} />
                    <Field label="Parcela 1ª–12ª" value={fmtMoney(c.parcela_1a_12a)} />
                    <Field label="Parcela demais" value={fmtMoney(c.parcela_demais)} />
                    <Field label="Parcelas pagas pela MCF" value={c.parcelas_pagas_empresa ?? '—'} />
                    <Field label="Vendedor" value={c.vendedor_name} />
                  </div>

                  {c.installments.length > 0 && (
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr>
                          <th className="border border-border p-1 text-left">#</th>
                          <th className="border border-border p-1 text-left">Quem paga</th>
                          <th className="border border-border p-1 text-left">Valor</th>
                          <th className="border border-border p-1 text-left">Vencimento</th>
                          <th className="border border-border p-1 text-left">Pagamento</th>
                          <th className="border border-border p-1 text-left">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {c.installments.map((i) => (
                          <tr key={i.id}>
                            <td className="border border-border p-1">{i.numero_parcela}</td>
                            <td className="border border-border p-1">
                              {i.tipo === 'empresa' ? 'MCF Capital' : 'Cliente'}
                            </td>
                            <td className="border border-border p-1">{fmtMoney(i.valor_parcela)}</td>
                            <td className="border border-border p-1">{fmtDate(i.data_vencimento)}</td>
                            <td className="border border-border p-1">{fmtDate(i.data_pagamento)}</td>
                            <td className="border border-border p-1">{i.status || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {c.documentos.length > 0 && (
                    <div className="text-xs">
                      <div className="text-muted-foreground">Documentos anexados</div>
                      <ul className="list-disc pl-5">
                        {c.documentos.map((doc) => (
                          <li key={doc.id}>
                            {doc.tipo || 'documento'} — {doc.nome_arquivo || 'arquivo'} ({fmtDate(doc.uploaded_at)})
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

        {/* 7. Lacunas */}
        <Section title="7. Lacunas e pendências" subtitle="Checagens automáticas sobre o que falta na jornada.">
          {data.gaps.length === 0 ? (
            <Empty>Nenhuma lacuna identificada.</Empty>
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
      </div>
    </div>
  );
}