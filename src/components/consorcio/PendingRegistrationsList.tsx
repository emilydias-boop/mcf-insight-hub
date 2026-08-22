import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Loader2, FolderOpen, MoreVertical, Link2, Trash2, FileEdit, Download, Ban, RotateCcw, FileSignature, BadgeCheck, FileSearch } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  usePendingRegistrations,
  useDeletePendingRegistration,
  useDeclinePendingRegistration,
  useUndeclinePendingRegistration,
  type EnrichedPendingRegistration,
} from '@/hooks/useConsorcioPendingRegistrations';
import { OpenCotaModal } from './OpenCotaModal';
import { GerarTermoModal } from './GerarTermoModal';
import { TermoPanelDialog } from './TermoPanelDialog';
import { useTermosByPending, useTermosByProposal, type ConsorcioTermo } from '@/hooks/useConsorcioTermos';
import { LinkExistingCotaModal } from './LinkExistingCotaModal';
import { PendingRegistrationsKPIs } from './PendingRegistrationsKPIs';
import {
  PendingRegistrationsFilters,
  applyPendingFilters,
  defaultPendingFilters,
  isPendingStatusFilter,
  DEFAULT_PENDING_STATUS_FILTER,
  type PendingFiltersState,
  type PendingStatusFilter,
} from './PendingRegistrationsFilters';
import { formatCurrency } from '@/lib/consorcioCalculos';
import { camposCadastroFaltantes, resumoCamposFaltantes } from '@/lib/consorcioCadastroIncompleto';
import { tipoContratoLabel } from '@/lib/consorcioParcelasEmpresa';
import { SeloDiasParados, diasDesde, DIAS_PARADOS_MINIMO, DIAS_PARADOS_VERMELHO } from '@/components/consorcio/SeloDiasParados';
import { loadXLSX } from '@/lib/lazyExport';
import { isInPeriod, PENDING_REGISTRATION_ALL_STATUSES } from '@/components/consorcio/FunilConsorcioTimeline';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { TablePagination } from '@/components/ui/table-pagination';
import { useTableSortUrl } from '@/hooks/useTableSortUrl';
import { ordenarPor } from '@/lib/ordenacaoTabela';
import { CONSORCIO_LABELS } from '@/lib/consorcioLabels';
import { FilaDuasListas } from '@/components/consorcio/FilaDuasListas';

import { CotaCadastradaModal } from '@/components/consorcio/CotaCadastradaModal';
import { DossieCadastroDialog } from '@/components/consorcio/DossieCadastroDialog';
import {
  ancoraEsperaAssinatura,
  cadastroTravadoSemAssinatura,
  termosDoCadastro as termosDoCadastroLib,
} from '@/lib/consorcioLiberacaoCadastro';


const STATUS_LABELS: Record<string, string> = {
  aguardando_abertura: 'Aguardando abertura',
  cota_aberta: 'Cota aberta',
  vinculada: 'Vinculada',
  declinada: 'Declinada',
};

/** Só `aguardando_abertura` ainda não tem cota — é a fila de trabalho. */
const SEM_COTA = ['aguardando_abertura'];


/** Ordem de processo: o que exige ação primeiro em `asc`. */




/** Ordem de processo: o que exige ação primeiro em `asc`. */
const RANK_STATUS: Record<string, number> = {
  aguardando_abertura: 1,
  cota_aberta: 3,
  vinculada: 4,
  declinada: 5,
};

const PENDING_SORT_FIELDS = [
  'origem', 'nome', 'valor_credito', 'parcelas_empresa', 'valor_total_empresa',
  'closer', 'sdr', 'cotas_existentes', 'destinada', 'solicitado_em', 'status',
] as const;
/** `created_at` é só o default (ordem em que a lista já abria), não é coluna. */
type PendingSortField = (typeof PENDING_SORT_FIELDS)[number] | 'created_at';

const PENDING_EXTRATORES: Record<PendingSortField, (r: EnrichedPendingRegistration) => unknown> = {
  created_at: (r) => (r.created_at ? new Date(r.created_at) : null),
  origem: (r) => r.origem_label || '',
  nome: (r) => (r.tipo_pessoa === 'pf' ? r.nome_completo : r.razao_social) || '',
  valor_credito: (r) => Number(r.valor_credito) || 0,
  parcelas_empresa: (r) => r.parcelas_empresa.length,
  valor_total_empresa: (r) => Number(r.valor_total_empresa) || 0,
  closer: (r) => r.closer_name || '',
  sdr: (r) => r.sdr_name || '',
  cotas_existentes: (r) => r.cotas_existentes_count ?? 0,
  destinada: (r) => r.parte_atual ?? 1,
  solicitado_em: (r) =>
    r.aceite_date ? new Date(`${r.aceite_date}T00:00:00`) : r.created_at ? new Date(r.created_at) : null,
  status: (r) => RANK_STATUS[r.status] ?? 9,
};

export interface PendingRegistrationsListProps {
  variant?: 'pendentes' | 'declinadas';
  /** Período global do funil — eixo: aceite_date ?? created_at. */
  range?: { startDate?: Date; endDate?: Date };
  /** Selo da timeline: mostrar só o estoque atual em `aguardando_abertura`. */
  onlyAguardandoAbertura?: boolean;
  onClearQuickFilter?: () => void;
}

export function PendingRegistrationsList({
  variant = 'pendentes',
  range,
  onlyAguardandoAbertura,
  onClearQuickFilter,
}: PendingRegistrationsListProps = {}) {
  const statuses =
    variant === 'declinadas' ? ['declinada']
    // Etapa 4 mede EVENTO: todos os cadastros criados no período,
    // independente do status atual.
    : [...PENDING_REGISTRATION_ALL_STATUSES];
  const { data: allRegistrations = [], isLoading } = usePendingRegistrations(statuses);
  // Etapas 4 e 5 do funil: eixo aceite_date ?? created_at.
  // NOTA (etapa 5): não existe campo de "quando virou cadastrada" — a etapa mede
  // cartas cujo ACEITE caiu no período e que HOJE estão marcadas como cadastradas.
  const registrations = useMemo(
    () => {
      let list = range
        ? allRegistrations.filter((r) => isInPeriod(r.aceite_date || r.created_at, range))
        : allRegistrations;
      if (onlyAguardandoAbertura) list = list.filter((r) => r.status === 'aguardando_abertura');
      return list;
    },
    [allRegistrations, onlyAguardandoAbertura, range?.startDate, range?.endDate],
  );
  const [openId, setOpenId] = useState<string | null>(null);
  /** Formulário curto "Cota Cadastrada" (grupo, cota, contrato Embracon). */
  const [cadastradaId, setCadastradaId] = useState<string | null>(null);
  /** Dossiê do cadastro: tudo para efetivar a cota, em um clique. */
  const [dossieId, setDossieId] = useState<string | null>(null);
  const [completarId, setCompletarId] = useState<string | null>(null);
  /** Cadastro cujo modal "Cota cadastrada na Embracon" deve reabrir após salvar a edição. */
  const [voltarCadastradaId, setVoltarCadastradaId] = useState<string | null>(null);
  const [linkTarget, setLinkTarget] = useState<EnrichedPendingRegistration | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EnrichedPendingRegistration | null>(null);
  const [declineTarget, setDeclineTarget] = useState<EnrichedPendingRegistration | null>(null);
  const [declineReason, setDeclineReason] = useState('');
  const [termoTarget, setTermoTarget] = useState<EnrichedPendingRegistration | null>(null);
  const [termoPanelTarget, setTermoPanelTarget] = useState<EnrichedPendingRegistration | null>(null);
  const [filtersState, setFiltersState] = useState<PendingFiltersState>(defaultPendingFilters);
  // Status vive na URL (`stPe`), mesmo mecanismo de `ordPe`/`dirPe`/`q`.
  const [searchParams, setSearchParams] = useSearchParams();
  const stParam = searchParams.get('stPe');
  const statusFilter: PendingStatusFilter =
    // Abas com status fixo (declinadas) não recortam por status.
    variant !== 'pendentes'
      ? 'todos'
      : onlyAguardandoAbertura
        ? 'aguardando_abertura'
        : isPendingStatusFilter(stParam)
          ? stParam
          : DEFAULT_PENDING_STATUS_FILTER;
  const setStatusFilter = useCallback(
    (v: PendingStatusFilter) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (v === DEFAULT_PENDING_STATUS_FILTER) next.delete('stPe');
          else next.set('stPe', v);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );
  const { field, dir, toggle, q, setQ } = useTableSortUrl<PendingSortField>({
    campos: PENDING_SORT_FIELDS,
    inicial: { field: 'created_at', dir: 'desc' },
    sufixo: 'Pe',
  });
  // A busca desta aba vive no `?qPe=`, como nas outras abas; os demais filtros
  // continuam locais.
  const filters = useMemo<PendingFiltersState>(
    () => ({ ...filtersState, search: q, status: statusFilter }),
    [filtersState, q, statusFilter],
  );
  const setFilters = (next: PendingFiltersState) => {
    if (next.search !== filters.search) setQ(next.search);
    if (next.status !== filters.status) {
      setStatusFilter(next.status);
      // O filtro rápido da timeline e o Select são a mesma coisa: mudar o Select
      // desfaz o atalho para não brigarem.
      if (onlyAguardandoAbertura) onClearQuickFilter?.();
    }
    setFiltersState({ ...next, search: '', status: DEFAULT_PENDING_STATUS_FILTER });
  };
  const { data: termosByPending = {} } = useTermosByPending();
  const { data: termosByProposal = {} } = useTermosByProposal();
  /**
   * O termo é um por venda e grava só o `pending_registration_id` da 1ª carta.
   * Lemos pela proposta para as cartas irmãs mostrarem o mesmo selo; o vínculo
   * antigo por cadastro fica como fallback para termos sem `proposal_id`.
   */
  const termosDoCadastro = (reg: { id: string; proposal_id?: string | null }): ConsorcioTermo[] =>
    termosDoCadastroLib(reg as any, termosByProposal, termosByPending);
  /** Venda esperando assinatura: sai da fila de trabalho e da contagem do funil. */
  const estaTravado = useCallback(
    (reg: EnrichedPendingRegistration) =>
      cadastroTravadoSemAssinatura(reg as any, termosByProposal, termosByPending),
    [termosByProposal, termosByPending],
  );



  /**
   * Maior número de "dias parados" entre as linhas da fila LIBERADA (as mesmas
   * que exibem "aguardando abertura há") — mesma âncora (created_at) e mesmos
   * limiares (2/6) do selo da linha. É o número que dispara ação.
   */
  const maisAntigoFila = useMemo(() => {
    const idades = registrations
      .filter((r) => r.status === 'aguardando_abertura' && !estaTravado(r))
      .map((r) => diasDesde(r.created_at))
      .filter((d): d is number => d != null);
    return idades.length ? Math.max(...idades) : null;
  }, [registrations, estaTravado]);
  const deleteMut = useDeletePendingRegistration();
  const declineMut = useDeclinePendingRegistration();
  const undeclineMut = useUndeclinePendingRegistration();

  // filtrar → ordenar → paginar. O default (`created_at` desc) reproduz a
  // ordem em que a lista já abria.
  const filtered = useMemo(
    () => ordenarPor(applyPendingFilters(registrations, filters), PENDING_EXTRATORES[field], dir),
    [registrations, filters, field, dir],
  );

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const pageRows = useMemo(
    () => filtered.slice(safePage * pageSize, (safePage + 1) * pageSize),
    [filtered, safePage, pageSize],
  );
  // reset page when filters/pageSize change
  useEffect(() => { setPage(0); }, [filters, pageSize, field, dir]);

  const handleExport = async () => {
    const XLSX = await loadXLSX();
    const rows = filtered.map((reg) => {
      const nome = reg.tipo_pessoa === 'pf' ? reg.nome_completo : reg.razao_social;
      const doc = reg.tipo_pessoa === 'pf' ? reg.cpf : reg.cnpj;
      return {
        'Origem': reg.origem_label || '',
        'Tipo Pessoa': reg.tipo_pessoa === 'pf' ? 'PF' : 'PJ',
        'Nome / Razão Social': nome || '',
        'CPF/CNPJ': doc || '',
        'Sócios (PJ)': reg.tipo_pessoa === 'pj' ? (reg.socios?.length || 0) : '',
        'Valor da Cota': reg.valor_credito ? Number(reg.valor_credito) : '',
        'Qtd Parcelas Empresa': reg.parcelas_empresa.length,
        'Tipo Contrato': tipoContratoLabel(reg.tipo_contrato),
        'Total a Pagar (Empresa)': reg.valor_total_empresa ? Number(reg.valor_total_empresa) : '',
        'Closer': reg.closer_name || '',
        'SDR': reg.sdr_name || '',
        'Cotas Existentes': reg.cotas_existentes_count,
        'Destinada': reg.total_destinado > 1 ? `${reg.parte_atual}/${reg.total_destinado}` : '1/1',
        'Solicitado em': reg.aceite_date
          ? format(new Date(reg.aceite_date + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR })
          : format(new Date(reg.created_at), 'dd/MM/yyyy', { locale: ptBR }),
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    const sheetName =
      variant === 'declinadas' ? 'Cartas Declinadas'
      : CONSORCIO_LABELS.cotasAFazer;
    const fileSlug =
      variant === 'declinadas' ? 'cartas-declinadas'
      : 'cotas-a-fazer';
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `${fileSlug}-${format(new Date(), 'yyyy-MM-dd-HHmm')}.xlsx`);
  };

  /**
   * Etapa 4 divide "Pendentes" em duas: LIBERADAS (termo assinado — é o que a
   * equipe de cadastro trabalha) e TRAVADAS (venda esperando assinatura).
   * Pendentes do mais parado para o mais recente (created_at, não updated_at).
   */
  const maisAntigoPrimeiro = (a: EnrichedPendingRegistration, b: EnrichedPendingRegistration) =>
    String(a.created_at || '').localeCompare(String(b.created_at || ''));
  const aguardando = useMemo(
    () => filtered.filter((r) => r.status === 'aguardando_abertura'),
    [filtered],
  );
  const pendentes = useMemo(
    () => aguardando.filter((r) => !estaTravado(r)).slice().sort(maisAntigoPrimeiro),
    [aguardando, estaTravado],
  );
  const travadas = useMemo(
    () => aguardando.filter((r) => estaTravado(r)).slice().sort(maisAntigoPrimeiro),
    [aguardando, estaTravado],
  );
  const tratadas = useMemo(
    () => filtered.filter((r) => r.status !== 'aguardando_abertura'),
    [filtered],
  );
  /**
   * Conjunto que alimenta os KPIs e a contagem do funil: fora as vendas travadas
   * esperando assinatura, para o número de cima não contradizer a lista de baixo.
   */
  const registrationsLiberados = useMemo(
    () => (variant === 'pendentes' ? registrations.filter((r) => !estaTravado(r)) : registrations),
    [registrations, estaTravado, variant],
  );


  /**
   * Uma tabela, reaproveitada nas seções da fila (e na aba declinadas).
   * `travadaAssinatura` desabilita apenas "Cota Cadastrada" — "Declinada" segue
   * ativa, porque uma venda pode morrer enquanto espera assinatura.
   */
  const renderTabela = (
    linhas: EnrichedPendingRegistration[],
    opcoes?: { travadaAssinatura?: boolean },
  ) => (

    <Table>
      <TableHeader>
        <TableRow>
          <SortableTableHead field="origem" active={field} dir={dir} onSort={toggle}>Origem</SortableTableHead>
          <SortableTableHead field="nome" active={field} dir={dir} onSort={toggle}>Nome / Razão Social</SortableTableHead>
          <SortableTableHead field="valor_credito" active={field} dir={dir} onSort={toggle}>Valor da Cota</SortableTableHead>
          <SortableTableHead field="parcelas_empresa" active={field} dir={dir} onSort={toggle}>Parcelas (empresa)</SortableTableHead>
          <SortableTableHead field="valor_total_empresa" active={field} dir={dir} onSort={toggle}>Total a pagar</SortableTableHead>
          <SortableTableHead field="closer" active={field} dir={dir} onSort={toggle}>Closer</SortableTableHead>
          <SortableTableHead field="sdr" active={field} dir={dir} onSort={toggle}>SDR</SortableTableHead>
          <SortableTableHead field="cotas_existentes" active={field} dir={dir} onSort={toggle} className="text-center" align="center">Cotas existentes</SortableTableHead>
          <SortableTableHead field="destinada" active={field} dir={dir} onSort={toggle} className="text-center" align="center">Destinada</SortableTableHead>
          <SortableTableHead field="solicitado_em" active={field} dir={dir} onSort={toggle}>Solicitado em</SortableTableHead>
          {variant === 'pendentes' && (
            <SortableTableHead field="status" active={field} dir={dir} onSort={toggle}>Status</SortableTableHead>
          )}
          {variant === 'declinadas' && <TableHead>Motivo do declínio</TableHead>}
          <TableHead className="text-right">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {linhas.map((reg) => (
          <RegistrationRow
            key={reg.id}
            reg={reg}
            variant={variant}
            onOpen={() => setCompletarId(reg.id)}
            onDossie={() => setDossieId(reg.id)}
            onCotaCadastrada={() => setCadastradaId(reg.id)}
            onLink={() => setLinkTarget(reg)}
            onDelete={() => setDeleteTarget(reg)}
            onDecline={() => { setDeclineReason(''); setDeclineTarget(reg); }}
            onUndecline={() => undeclineMut.mutate(reg.id)}
            termos={termosDoCadastro(reg)}
            onGerarTermo={() => setTermoTarget(reg)}
            onVerTermos={() => setTermoPanelTarget(reg)}
            isMarking={undeclineMut.isPending}
            travadaAssinatura={!!opcoes?.travadaAssinatura}
            esperandoDesde={
              opcoes?.travadaAssinatura
                ? ancoraEsperaAssinatura(reg as any, termosByProposal, termosByPending)
                : undefined
            }
          />
        ))}

      </TableBody>
    </Table>
  );


  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={150}>
    <>
    <PendingRegistrationsFilters
      filters={filters}
      onChange={setFilters}
      registrations={registrations}
      showStatus={variant === 'pendentes'}
    />
    <PendingRegistrationsKPIs registrations={registrationsLiberados} variant={variant} />
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="text-base flex items-center gap-2">
          <FolderOpen className="h-5 w-5" />
          {variant === 'declinadas' ? 'Cartas Declinadas' : CONSORCIO_LABELS.cotasAFazer} ({filtered.length}
          {filtered.length !== registrations.length ? ` de ${registrations.length}` : ''})
          {variant === 'pendentes' && maisAntigoFila != null && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge
                  variant="outline"
                  className={`cursor-help text-[10px] tabular-nums ${
                    maisAntigoFila > 15
                      ? 'border-destructive/60 bg-destructive/10 text-destructive'
                      : maisAntigoFila >= 8
                        ? 'border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                        : 'border-border text-muted-foreground'
                  }`}
                >
                  mais antigo: {maisAntigoFila} dia{maisAntigoFila === 1 ? '' : 's'}
                </Badge>
              </TooltipTrigger>
              <TooltipContent className="max-w-[260px]">
                <p className="text-xs">
                  Cadastro aguardando abertura de cota há mais tempo no período, contado da data em
                  "Solicitado em". Semáforo igual ao de "Dias parados" da etapa 5: âmbar a partir de 8
                  dias, vermelho acima de 15.
                </p>
              </TooltipContent>
            </Tooltip>
          )}
        </CardTitle>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={handleExport} disabled={filtered.length === 0}>
            <Download className="h-4 w-4 mr-1" /> Exportar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {onlyAguardandoAbertura && (
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-primary/50 text-primary">
              Filtrado: aguardando abertura
            </Badge>
            <Button size="sm" variant="ghost" onClick={onClearQuickFilter}>
              Limpar filtro
            </Button>
          </div>
        )}
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            {registrations.length === 0
              ? variant === 'declinadas'
                ? 'Nenhuma carta declinada.'
                : 'Nenhuma cota a fazer.'
              : 'Nenhum cadastro corresponde aos filtros aplicados.'}
          </p>
        ) : variant === 'pendentes' ? (
          <FilaDuasListas
            pendentes={pendentes}
            tratadas={tratadas}
            tituloPendentes={`Liberadas para cadastro — termo assinado (${pendentes.length})`}
            tituloTratadas={`Tratadas — cota aberta ou declinada (${tratadas.length})`}
            descricaoPendentes="do mais parado para o mais recente"
            vazioPendentes="Nenhum cadastro liberado para abertura de cota."
            renderTabela={renderTabela}
            secaoIntermediaria={{
              titulo: `Aguardando assinatura do termo (${travadas.length})`,
              descricao: 'a cota só é cadastrada na Embracon depois da assinatura',
              linhas: travadas,
              renderTabela: (linhas) => renderTabela(linhas, { travadaAssinatura: true }),
            }}
          />

        ) : (
          <>
            <div className="overflow-x-auto">{renderTabela(pageRows)}</div>
            <TablePagination
              page={safePage}
              pageSize={pageSize}
              total={filtered.length}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </>
        )}


        {openId && (
          <OpenCotaModal
            open={!!openId}
            onOpenChange={(o) => !o && setOpenId(null)}
            registrationId={openId}
          />
        )}
        {completarId && (
          <OpenCotaModal
            open={!!completarId}
            onOpenChange={(o) => !o && setCompletarId(null)}
            registrationId={completarId}
            mode="edit"
            focusPlano
            onSaved={() => {
              if (voltarCadastradaId) {
                const id = voltarCadastradaId;
                setVoltarCadastradaId(null);
                setCadastradaId(id);
              }
            }}
          />
        )}
        {cadastradaId && (
          <CotaCadastradaModal
            open={!!cadastradaId}
            onOpenChange={(o) => !o && setCadastradaId(null)}
            registrationId={cadastradaId}
            onAbrirFormularioCompleto={() => {
              setVoltarCadastradaId(cadastradaId);
              setCompletarId(cadastradaId);
            }}
          />
        )}
        {dossieId && (
          <DossieCadastroDialog
            open={!!dossieId}
            onOpenChange={(o) => !o && setDossieId(null)}
            registrationId={dossieId}
          />
        )}
        {linkTarget && (
          <LinkExistingCotaModal
            open={!!linkTarget}
            onOpenChange={(o) => !o && setLinkTarget(null)}
            registrationId={linkTarget.id}
            cpf={linkTarget.cpf}
            cnpj={linkTarget.cnpj}
            pessoaNome={linkTarget.nome_completo || linkTarget.razao_social}
          />
        )}
        <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir cadastro pendente?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação remove o cadastro e os documentos vinculados. O negócio no CRM não será afetado.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  if (!deleteTarget) return;
                  await deleteMut.mutateAsync(deleteTarget.id);
                  setDeleteTarget(null);
                }}
              >
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
    {termoTarget && (
      <GerarTermoModal
        open={!!termoTarget}
        onOpenChange={(o) => !o && setTermoTarget(null)}
        registrationId={termoTarget.id}
        onCompletarCadastro={() => {
          const id = termoTarget.id;
          setTermoTarget(null);
          setCompletarId(id);
        }}
      />
    )}
    {termoPanelTarget && (
      <TermoPanelDialog
        open={!!termoPanelTarget}
        onOpenChange={(o) => !o && setTermoPanelTarget(null)}
        termos={termosDoCadastro(termoPanelTarget)}
        clienteNome={termoPanelTarget.nome_completo || termoPanelTarget.razao_social || 'cliente'}
        onGerarNovo={() => setTermoTarget(termoPanelTarget)}
      />
    )}
    <Dialog open={!!declineTarget} onOpenChange={(o) => { if (!o) { setDeclineTarget(null); setDeclineReason(''); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Declinar carta</DialogTitle>
          <DialogDescription>
            O parceiro desistiu da aquisição desta carta. O valor da venda será abatido da meta e deduzido do saldo acumulado. O registro fica arquivado na aba <strong>Cartas Declinadas</strong> com o motivo informado.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label htmlFor="decline-reason">Motivo do declínio <span className="text-destructive">*</span></Label>
          <Textarea
            id="decline-reason"
            rows={4}
            placeholder="Descreva o motivo pelo qual o parceiro declinou desta carta..."
            value={declineReason}
            onChange={(e) => setDeclineReason(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => { setDeclineTarget(null); setDeclineReason(''); }}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            disabled={!declineReason.trim() || declineMut.isPending}
            onClick={async () => {
              if (!declineTarget) return;
              await declineMut.mutateAsync({ registrationId: declineTarget.id, motivo: declineReason.trim() });
              setDeclineTarget(null);
              setDeclineReason('');
            }}
          >
            <Ban className="h-4 w-4 mr-1" />
            Confirmar declínio
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
    </TooltipProvider>
  );
}

function RegistrationRow({
  reg,
  variant,
  onOpen,
  onDossie,
  onCotaCadastrada,
  onLink,
  onDelete,
  onDecline,
  onUndecline,
  termos,
  onGerarTermo,
  onVerTermos,
  isMarking,
  travadaAssinatura = false,
  esperandoDesde,

}: {
  reg: EnrichedPendingRegistration;
  variant: 'pendentes' | 'declinadas';
  onOpen: () => void;
  onDossie: () => void;
  onCotaCadastrada: () => void;
  onLink: () => void;
  onDelete: () => void;
  onDecline: () => void;
  onUndecline: () => void;
  termos: ConsorcioTermo[];
  onGerarTermo: () => void;
  onVerTermos: () => void;
  isMarking: boolean;
  /** Linha da lista "Aguardando assinatura do termo": bloqueia só "Cota Cadastrada". */
  travadaAssinatura?: boolean;
  /** Âncora do selo de dias parados nas linhas travadas (geração do termo). */
  esperandoDesde?: string | null;

}) {
  const nome = reg.tipo_pessoa === 'pf' ? reg.nome_completo : reg.razao_social;
  const doc = reg.tipo_pessoa === 'pf' ? reg.cpf : reg.cnpj;
  const sociosLabel = useMemo(() => {
    if (reg.tipo_pessoa !== 'pj' || !reg.socios?.length) return null;
    return `${reg.socios.length} sócio${reg.socios.length > 1 ? 's' : ''}`;
  }, [reg.tipo_pessoa, reg.socios]);

  const parcelasResumo = reg.parcelas_empresa.length
    ? `${reg.parcelas_empresa.length}× · ${tipoContratoLabel(reg.tipo_contrato)}`
    : '—';

  const termoAssinado = termos.find((t) => t.status === 'assinado');
  const semCota = SEM_COTA.includes(reg.status);
  const termoPendente = termos.find((t) => t.status === 'pendente');
  const termoBadge = termoAssinado
    ? { label: 'Termo assinado', className: 'border-emerald-500/60 text-emerald-600 hover:bg-emerald-500/10' }
    : termoPendente
      ? { label: 'Termo pendente', className: 'border-amber-500/60 text-amber-600 hover:bg-amber-500/10' }
      : null;

  return (
    <TableRow>
      <TableCell className="text-sm">
        <Badge variant="outline" className="text-xs">{reg.origem_label}</Badge>
      </TableCell>
      <TableCell className="font-medium">
        {/* Um clique no nome abre o dossiê: dados, plano e documentos numa só tela. */}
        <button type="button" onClick={onDossie} className="text-left hover:underline">
          {nome || '—'}
        </button>
        {variant === 'pendentes' && reg.status === 'aguardando_abertura' && (
          <div className="mt-1 flex items-center gap-1">
            <span className="text-[10px] text-muted-foreground">
              {travadaAssinatura ? 'aguardando assinatura há' : 'aguardando abertura há'}
            </span>
            {/* Liberadas: dias desde a criação. Travadas: dias desde a geração do
                termo (ou da criação, quando o termo ainda não existe). */}
            <SeloDiasParados
              desde={travadaAssinatura ? (esperandoDesde ?? reg.created_at) : reg.created_at}
              motivo={
                travadaAssinatura
                  ? 'Dias desde a geração do Termo de Adesão (ou da criação do cadastro, quando ainda não há termo), esperando a assinatura do cliente. Âmbar de 2 a 5 dias, vermelho a partir de 6.'
                  : 'Dias desde a criação do cadastro, ainda aguardando abertura de cota. Âmbar de 2 a 5 dias, vermelho a partir de 6.'
              }
            />
          </div>
        )}


        {termoBadge && (
          <button type="button" onClick={onVerTermos} className="mt-1 inline-flex">
            <Badge variant="outline" className={`text-[10px] cursor-pointer ${termoBadge.className}`}>
              <FileSignature className="h-3 w-3 mr-1" /> {termoBadge.label}
            </Badge>
          </button>
        )}
        {variant === 'pendentes' && (reg.checklist_incompleto || reg.documentos_faltando) && (
          <div className="mt-1 flex flex-wrap gap-1">
            {reg.checklist_incompleto && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="border-amber-500/50 bg-amber-500/10 text-[10px] text-amber-600 dark:text-amber-400">
                    cadastro incompleto
                    {camposCadastroFaltantes(reg as any).length > 0
                      ? ` (${camposCadastroFaltantes(reg as any).length})`
                      : ''}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  {resumoCamposFaltantes(camposCadastroFaltantes(reg as any))}
                </TooltipContent>
              </Tooltip>
            )}
            {reg.documentos_faltando && (
              <Badge variant="outline" className="border-amber-500/50 bg-amber-500/10 text-[10px] text-amber-600 dark:text-amber-400">
                documento faltando
              </Badge>
            )}
          </div>
        )}

        <div className="text-xs text-muted-foreground">
          {doc || '—'}
          {sociosLabel ? ` · ${sociosLabel}` : ''}
          <Badge variant="outline" className="ml-2 text-[10px]">
            {reg.tipo_pessoa === 'pf' ? 'PF' : 'PJ'}
          </Badge>
        </div>
      </TableCell>
      <TableCell className="text-sm">
        {reg.valor_credito ? formatCurrency(Number(reg.valor_credito)) : '—'}
      </TableCell>
      <TableCell className="text-sm">
        {reg.parcelas_empresa.length ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="secondary" className="cursor-help">{parcelasResumo}</Badge>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p className="text-xs font-medium mb-1">Parcelas que a empresa pagará</p>
              <ul className="text-xs space-y-0.5 max-h-56 overflow-auto">
                {reg.parcelas_empresa.map((p) => (
                  <li key={p.numero} className="flex justify-between gap-3">
                    <span>Parcela {p.numero}</span>
                    <span className="font-medium">{formatCurrency(p.valor)}</span>
                  </li>
                ))}
              </ul>
            </TooltipContent>
          </Tooltip>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="text-sm font-medium">
        {reg.valor_total_empresa ? formatCurrency(reg.valor_total_empresa) : '—'}
      </TableCell>
      <TableCell className="text-sm">{reg.closer_name || '—'}</TableCell>
      <TableCell className="text-sm">{reg.sdr_name || '—'}</TableCell>
      <TableCell className="text-center">
        <Badge variant={reg.cotas_existentes_count > 0 ? 'default' : 'outline'} className="text-xs">
          {reg.cotas_existentes_count}
        </Badge>
      </TableCell>
      <TableCell className="text-center text-sm">
        {reg.total_destinado > 1 ? `${reg.parte_atual}/${reg.total_destinado}` : '1/1'}
      </TableCell>
      <TableCell className="text-sm whitespace-nowrap">
        <div className="flex flex-col items-start">
          <span>
            {reg.aceite_date
              ? format(new Date(reg.aceite_date + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR })
              : reg.created_at
                ? format(new Date(reg.created_at), 'dd/MM/yyyy', { locale: ptBR })
                : '—'}
          </span>
        </div>
      </TableCell>
      {variant === 'pendentes' && (
        <TableCell className="text-sm">
          <Badge variant={reg.status === 'aguardando_abertura' ? 'outline' : 'secondary'}>
            {STATUS_LABELS[reg.status] || reg.status}
          </Badge>
        </TableCell>
      )}
      {variant === 'declinadas' && (
        <TableCell className="text-sm max-w-[280px]">
          <div className="truncate" title={reg.motivo_declinio || ''}>
            {reg.motivo_declinio || '—'}
          </div>
          {reg.declinada_at && (
            <div className="text-[10px] text-muted-foreground">
              {format(new Date(reg.declinada_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </div>
          )}
        </TableCell>
      )}
      <TableCell className="text-right">
        <div className="flex items-center gap-1 justify-end">
          {variant === 'pendentes' && semCota && (
            <>
              {/* O `title` fica no wrapper: navegadores não mostram tooltip de
                  elemento desabilitado. */}
              <span
                title={
                  travadaAssinatura
                    ? 'O cliente ainda não assinou o Termo de Adesão. Cadastre a cota na Embracon só depois da assinatura.'
                    : undefined
                }
                className="inline-flex"
              >
                <Button size="sm" onClick={onCotaCadastrada} disabled={travadaAssinatura}>
                  <BadgeCheck className="h-3 w-3 mr-1" /> Cota Cadastrada
                </Button>
              </span>


              {/* A outra ação que define a etapa 4 também fica na linha, em estilo
                  discreto de ação destrutiva (o motivo continua obrigatório). */}
              <Button
                size="sm"
                variant="outline"
                onClick={onDecline}
                className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <Ban className="h-3 w-3 mr-1" /> Declinada
              </Button>
            </>
          )}

          {variant === 'declinadas' && (
            <Button
              size="sm"
              variant="outline"
              onClick={onUndecline}
              disabled={isMarking}
            >
              <RotateCcw className="h-3 w-3 mr-1" /> Reverter declínio
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onDossie}>
                <FileSearch className="h-4 w-4 mr-2" /> Dossiê do cadastro
              </DropdownMenuItem>
              {/* Este item é SÓ edição do cadastro pendente: não abre cota.
                  A abertura acontece pelo botão "Cota Cadastrada" da linha. */}
              <DropdownMenuItem onClick={onOpen}>
                <FileEdit className="h-4 w-4 mr-2" /> Editar cadastro
              </DropdownMenuItem>

              {/* A GERAÇÃO do termo mudou para a etapa 3 (Termos de Adesão Pendentes),
                  onde o trabalho de fazer o cliente assinar acontece. Aqui só se
                  consulta o termo já emitido — informação útil para o cadastro. */}
              {variant === 'pendentes' && termos.length > 0 && (
                <DropdownMenuItem onClick={onVerTermos}>
                  <FileSignature className="h-4 w-4 mr-2" /> Termo de Adesão
                </DropdownMenuItem>
              )}

              {variant !== 'declinadas' && (variant !== 'pendentes' || semCota) && (
                <DropdownMenuItem onClick={onLink}>
                  <Link2 className="h-4 w-4 mr-2" /> Vincular a cota existente
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onDelete}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" /> Excluir cadastro
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </TableCell>
    </TableRow>
  );
}
