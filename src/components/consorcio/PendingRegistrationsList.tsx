import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Loader2, FolderOpen, MoreVertical, Eye, Link2, Trash2, FileEdit, Plus, Download } from 'lucide-react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  usePendingRegistrations,
  useDeletePendingRegistration,
  type EnrichedPendingRegistration,
} from '@/hooks/useConsorcioPendingRegistrations';
import { OpenCotaModal } from './OpenCotaModal';
import { LinkExistingCotaModal } from './LinkExistingCotaModal';
import { AddPendingRegistrationModal } from './AddPendingRegistrationModal';
import { PendingRegistrationsKPIs } from './PendingRegistrationsKPIs';
import {
  PendingRegistrationsFilters,
  applyPendingFilters,
  defaultPendingFilters,
  type PendingFiltersState,
} from './PendingRegistrationsFilters';
import { formatCurrency } from '@/lib/consorcioCalculos';
import { tipoContratoLabel } from '@/lib/consorcioParcelasEmpresa';
import { loadXLSX } from '@/lib/lazyExport';

export function PendingRegistrationsList() {
  const { data: registrations = [], isLoading } = usePendingRegistrations();
  const [openId, setOpenId] = useState<string | null>(null);
  const [viewId, setViewId] = useState<string | null>(null);
  const [linkTarget, setLinkTarget] = useState<EnrichedPendingRegistration | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EnrichedPendingRegistration | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [filters, setFilters] = useState<PendingFiltersState>(defaultPendingFilters);
  const deleteMut = useDeletePendingRegistration();

  const filtered = useMemo(
    () => applyPendingFilters(registrations, filters),
    [registrations, filters],
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
  useEffect(() => { setPage(0); }, [filters, pageSize]);

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
    XLSX.utils.book_append_sheet(wb, ws, 'Cadastros Pendentes');
    XLSX.writeFile(wb, `cadastros-pendentes-${format(new Date(), 'yyyy-MM-dd-HHmm')}.xlsx`);
  };

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
    />
    <PendingRegistrationsKPIs registrations={filtered} />
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="text-base flex items-center gap-2">
          <FolderOpen className="h-5 w-5" />
          Cadastros Pendentes ({filtered.length}
          {filtered.length !== registrations.length ? ` de ${registrations.length}` : ''})
        </CardTitle>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={handleExport} disabled={filtered.length === 0}>
            <Download className="h-4 w-4 mr-1" /> Exportar
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Adicionar Pendente
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            {registrations.length === 0
              ? 'Nenhum cadastro pendente de abertura.'
              : 'Nenhum cadastro corresponde aos filtros aplicados.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Origem</TableHead>
                  <TableHead>Nome / Razão Social</TableHead>
                  <TableHead>Valor da Cota</TableHead>
                  <TableHead>Parcelas (empresa)</TableHead>
                  <TableHead>Total a pagar</TableHead>
                  <TableHead>Closer</TableHead>
                  <TableHead>SDR</TableHead>
                  <TableHead className="text-center">Cotas existentes</TableHead>
                  <TableHead className="text-center">Destinada</TableHead>
                  <TableHead>Solicitado em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map((reg) => (
                  <RegistrationRow
                    key={reg.id}
                    reg={reg}
                    onOpen={() => setOpenId(reg.id)}
                    onView={() => setViewId(reg.id)}
                    onLink={() => setLinkTarget(reg)}
                    onDelete={() => setDeleteTarget(reg)}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {filtered.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 mt-3 border-t">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Itens por página:</span>
              <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                <SelectTrigger className="h-8 w-[80px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[10, 25, 50, 100].map((n) => (
                    <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="ml-2">
                {safePage * pageSize + 1}–{Math.min((safePage + 1) * pageSize, filtered.length)} de {filtered.length}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={safePage === 0}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground">
                Página {safePage + 1} de {totalPages}
              </span>
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={safePage >= totalPages - 1}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {openId && (
          <OpenCotaModal
            open={!!openId}
            onOpenChange={(o) => !o && setOpenId(null)}
            registrationId={openId}
          />
        )}
        {viewId && (
          <OpenCotaModal
            open={!!viewId}
            onOpenChange={(o) => !o && setViewId(null)}
            registrationId={viewId}
            mode="view"
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
    <AddPendingRegistrationModal open={addOpen} onOpenChange={setAddOpen} />
    </>
    </TooltipProvider>
  );
}

function RegistrationRow({
  reg,
  onOpen,
  onView,
  onLink,
  onDelete,
}: {
  reg: EnrichedPendingRegistration;
  onOpen: () => void;
  onView: () => void;
  onLink: () => void;
  onDelete: () => void;
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

  return (
    <TableRow>
      <TableCell className="text-sm">
        <Badge variant="outline" className="text-xs">{reg.origem_label}</Badge>
      </TableCell>
      <TableCell className="font-medium">
        <div>{nome || '—'}</div>
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
        {reg.aceite_date
          ? format(new Date(reg.aceite_date + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR })
          : format(new Date(reg.created_at), 'dd/MM/yyyy', { locale: ptBR })}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center gap-1 justify-end">
          <Button size="sm" onClick={onOpen}>
            <FileEdit className="h-3 w-3 mr-1" /> Abrir
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onView}>
                <Eye className="h-4 w-4 mr-2" /> Ver detalhes
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onLink}>
                <Link2 className="h-4 w-4 mr-2" /> Vincular a cota existente
              </DropdownMenuItem>
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
