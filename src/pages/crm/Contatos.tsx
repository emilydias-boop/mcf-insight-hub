import { useState, useMemo, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useContactsEnriched, useContactFilterOptions, type EnrichedContact } from '@/hooks/useContactsEnriched';
import { useSyncClintData } from '@/hooks/useCRMData';
import { usePartnerProductDetectionBatch, useAllPartnerProducts, PRODUCT_GROUPS } from '@/hooks/usePartnerProductDetection';
import { Search, Plus, User, RefreshCw, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveBU } from '@/hooks/useActiveBU';
import { useBUOriginIds } from '@/hooks/useBUPipelineMap';
import { ContactDetailsDrawer } from '@/components/crm/ContactDetailsDrawer';
import { ContactFormDialog } from '@/components/crm/ContactFormDialog';
import { ContactFilters, emptyFilters, type ContactFilterValues } from '@/components/crm/ContactFilters';
import { BulkActionsBar } from '@/components/crm/BulkActionsBar';
import { SendToPipelineModal } from '@/components/crm/SendToPipelineModal';
import { DuplicateToInsideDialog } from '@/components/crm/DuplicateToInsideDialog';
import { useDuplicateToInsideSales } from '@/hooks/useLimboLeads';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious, PaginationEllipsis } from '@/components/ui/pagination';
import { toast } from 'sonner';
import { subDays } from 'date-fns';

const THERMAL_ICONS: Record<string, string> = {
  quente: '🟢',
  morno: '🟡',
  frio: '🔵',
  perdido: '🔴',
  sem_deal: '⚪',
};

const Contatos = () => {
  const { role } = useAuth();
  const isReadOnly = role === 'sdr' || role === 'closer' || role === 'closer_sombra';

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [filters, setFilters] = useState<ContactFilterValues>(emptyFilters);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pipelineModalOpen, setPipelineModalOpen] = useState(false);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  const activeBU = useActiveBU();
  const { data: buOriginIds } = useBUOriginIds(activeBU);
  const { data, isLoading } = useContactsEnriched(debouncedSearch, currentPage, pageSize, buOriginIds && buOriginIds.length > 0 ? buOriginIds : undefined);
  const syncMutation = useSyncClintData();
  const duplicateMutation = useDuplicateToInsideSales();

  const contactsData = data?.contacts || [];
  const totalCount = data?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / pageSize);
  const filterOptions = useContactFilterOptions(contactsData);

  // Batch partner detection for current page contacts
  const attendeesForCheck = useMemo(() =>
    contactsData.map(c => ({ id: c.id, email: c.email })),
    [contactsData]
  );
  const { data: partnerMap } = usePartnerProductDetectionBatch(attendeesForCheck);
  const { data: allPartnerProducts = [] } = useAllPartnerProducts();

  // Filter stages by selected pipeline
  const filteredStageOptions = useMemo(() => {
    if (!filters.pipeline) return filterOptions.stages;
    return Array.from(new Set(
      contactsData
        .filter(c => c.latestDeal?.origin_id === filters.pipeline && c.latestDeal?.stage_name)
        .map(c => c.latestDeal!.stage_name!)
    ));
  }, [filters.pipeline, contactsData, filterOptions.stages]);

  // Client-side filtering (for filters not handled server-side)
  const filteredContacts = useMemo(() => {
    let result = contactsData;
    if (filters.pipeline) result = result.filter(c => c.latestDeal?.origin_id === filters.pipeline);
    if (filters.stage) result = result.filter(c => c.latestDeal?.stage_name === filters.stage);
    if (filters.sdr) result = result.filter(c => c.sdrName === filters.sdr);
    if (filters.closer) result = result.filter(c => c.closerName === filters.closer);
    if (filters.status) result = result.filter(c => c.thermalStatus === filters.status);
    if (filters.dateRange) {
      const days = parseInt(filters.dateRange);
      const cutoff = subDays(new Date(), days);
      result = result.filter(c => new Date(c.created_at) >= cutoff);
    }
    if (filters.partnerProduct && partnerMap) {
      if (filters.partnerProduct === '__any__') {
        result = result.filter(c => partnerMap[c.id]?.isPartner);
      } else if (filters.partnerProduct === '__incorporador__') {
        result = result.filter(c => PRODUCT_GROUPS.incorporador.products.includes(partnerMap[c.id]?.productLabel || ''));
      } else if (filters.partnerProduct === '__anticrise__') {
        result = result.filter(c => PRODUCT_GROUPS.anticrise.products.includes(partnerMap[c.id]?.productLabel || ''));
      } else {
        result = result.filter(c => partnerMap[c.id]?.productLabel === filters.partnerProduct);
      }
    }
    return result;
  }, [contactsData, filters, partnerMap]);

  // Selection handlers
  const handleSelect = useCallback((id: string, checked: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (checked) next.add(id); else next.delete(id);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    const allIds = filteredContacts.map(c => c.id);
    const allSelected = allIds.length > 0 && allIds.every(id => selectedIds.has(id));
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allIds));
    }
  }, [filteredContacts, selectedIds]);

  const handleContactClick = (contactId: string) => {
    setSelectedContactId(contactId);
    setDrawerOpen(true);
  };

  const handleSync = () => {
    toast.info('Sincronizando dados do Clint...');
    syncMutation.mutate(undefined, {
      onSuccess: () => toast.success('Dados sincronizados com sucesso!'),
      onError: () => toast.error('Erro ao sincronizar dados'),
    });
  };

  const handlePageSizeChange = (value: string) => {
    setPageSize(Number(value));
    setCurrentPage(1);
  };

  const allFilteredSelected = filteredContacts.length > 0 && filteredContacts.every(c => selectedIds.has(c.id));

  // Pagination range
  const getPaginationRange = () => {
    const range: (number | 'ellipsis')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) range.push(i);
    } else {
      range.push(1);
      if (currentPage > 3) range.push('ellipsis');
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) range.push(i);
      if (currentPage < totalPages - 2) range.push('ellipsis');
      range.push(totalPages);
    }
    return range;
  };

  const showFrom = totalCount > 0 ? (currentPage - 1) * pageSize + 1 : 0;
  const showTo = Math.min(currentPage * pageSize, totalCount);

  return (
    <div className="flex flex-col gap-3 sm:gap-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-foreground">Contatos</h2>
          <p className="text-sm text-muted-foreground hidden sm:block">Gerencie todos os seus contatos</p>
        </div>
        {!isReadOnly && (
          <div className="flex gap-2 w-full sm:w-auto">
            <Button variant="outline" onClick={handleSync} disabled={syncMutation.isPending} className="flex-1 sm:flex-none" size="sm">
              <RefreshCw className={`h-4 w-4 sm:mr-2 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Sincronizar</span>
            </Button>
            <Button onClick={() => setCreateDialogOpen(true)} className="flex-1 sm:flex-none" size="sm">
              <Plus className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Novo Contato</span>
              <span className="sm:hidden">Novo</span>
            </Button>
          </div>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, email ou telefone..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 bg-card border-border text-foreground"
        />
      </div>

      {/* Filters */}
      <ContactFilters
        filters={filters}
        onChange={setFilters}
        options={{ ...filterOptions, stages: filteredStageOptions as string[] }}
        resultCount={filteredContacts.length}
        totalCount={totalCount}
        partnerProductOptions={allPartnerProducts}
      />

      {/* Select all toggle + info */}
      {filteredContacts.length > 0 && (
        <div className="flex items-center justify-between">
          {!isReadOnly ? (
            <div className="flex items-center gap-2">
              <Checkbox
                checked={allFilteredSelected}
                onCheckedChange={handleSelectAll}
              />
              <span className="text-xs text-muted-foreground">
                Selecionar todos da página ({filteredContacts.length})
              </span>
            </div>
          ) : <div />}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              Mostrando {showFrom}-{showTo} de {totalCount.toLocaleString('pt-BR')} contatos
            </span>
          </div>
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
          <p className="text-lg font-semibold text-foreground">Carregando contatos...</p>
        </div>
      ) : filteredContacts.length > 0 ? (
        <>
          {/* Table */}
          <div className="rounded-lg border border-border overflow-x-auto bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  {!isReadOnly && <th className="w-10 px-3 py-2.5"></th>}
                  <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Nome</th>
                  <th className="text-left px-3 py-2.5 font-medium text-muted-foreground hidden md:table-cell">Email</th>
                  <th className="text-left px-3 py-2.5 font-medium text-muted-foreground hidden lg:table-cell">Telefone</th>
                   <th className="text-center px-3 py-2.5 font-medium text-muted-foreground w-16">Status</th>
                   <th className="text-left px-3 py-2.5 font-medium text-muted-foreground hidden lg:table-cell">Etapa</th>
                   <th className="text-left px-3 py-2.5 font-medium text-muted-foreground hidden lg:table-cell">SDR</th>
                   <th className="text-left px-3 py-2.5 font-medium text-muted-foreground hidden xl:table-cell">Closer</th>
                   <th className="text-left px-3 py-2.5 font-medium text-muted-foreground hidden lg:table-cell">Parceria</th>
                   <th className="text-left px-3 py-2.5 font-medium text-muted-foreground hidden 2xl:table-cell">Organização</th>
                </tr>
              </thead>
              <tbody>
                {filteredContacts.map((contact) => {
                  const partner = partnerMap?.[contact.id];
                  return (
                    <tr
                      key={contact.id}
                      className="border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer transition-colors"
                      onClick={() => handleContactClick(contact.id)}
                    >
                      {!isReadOnly && (
                        <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedIds.has(contact.id)}
                            onCheckedChange={(checked) => handleSelect(contact.id, !!checked)}
                          />
                        </td>
                      )}
                      <td className="px-3 py-2.5 font-medium text-foreground truncate max-w-[200px]">
                        {contact.name}
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground truncate max-w-[200px] hidden md:table-cell">
                        {contact.email || '—'}
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground hidden lg:table-cell">
                        {contact.phone || '—'}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span title={contact.thermalStatus}>
                          {THERMAL_ICONS[contact.thermalStatus] || '⚪'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 hidden lg:table-cell">
                        {contact.latestDeal?.stage_name ? (
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                            style={{
                              backgroundColor: contact.latestDeal.stage_color ? `${contact.latestDeal.stage_color}20` : undefined,
                              color: contact.latestDeal.stage_color || undefined,
                            }}
                          >
                            {contact.latestDeal.stage_name}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground truncate max-w-[120px] hidden lg:table-cell">
                        {contact.sdrName || '—'}
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground truncate max-w-[120px] hidden xl:table-cell">
                        {contact.closerName || '—'}
                      </td>
                      <td className="px-3 py-2.5 hidden lg:table-cell">
                        {partner?.isPartner ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                            {partner.productLabel}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground truncate max-w-[150px] hidden 2xl:table-cell">
                        {contact.organization_name || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 py-2">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Por página:</span>
              <Select value={String(pageSize)} onValueChange={handlePageSizeChange}>
                <SelectTrigger className="w-20 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                  <SelectItem value="200">200</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {totalPages > 1 && (
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>
                  {getPaginationRange().map((item, idx) =>
                    item === 'ellipsis' ? (
                      <PaginationItem key={`ellipsis-${idx}`}>
                        <PaginationEllipsis />
                      </PaginationItem>
                    ) : (
                      <PaginationItem key={item}>
                        <PaginationLink
                          isActive={currentPage === item}
                          onClick={() => setCurrentPage(item as number)}
                          className="cursor-pointer"
                        >
                          {item}
                        </PaginationLink>
                      </PaginationItem>
                    )
                  )}
                  <PaginationItem>
                    <PaginationNext
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            )}

            <span className="text-sm text-muted-foreground">
              {totalCount.toLocaleString('pt-BR')} contatos
            </span>
          </div>
        </>
      ) : (
        <Card className="bg-card border-border">
          <CardContent className="p-8 text-center">
            <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              {searchTerm || Object.values(filters).some(v => v) ? 'Nenhum contato encontrado' : 'Nenhum contato cadastrado'}
            </h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm || Object.values(filters).some(v => v)
                ? 'Tente ajustar os filtros ou buscar com outros termos'
                : 'Comece adicionando seus primeiros contatos'}
            </p>
            {!isReadOnly && !searchTerm && !Object.values(filters).some(v => v) && (
              <Button onClick={() => setCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Contato
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Bulk actions - hidden for read-only roles */}
      {!isReadOnly && (
        <>
           <BulkActionsBar
            selectedCount={selectedIds.size}
            onTransfer={() => setPipelineModalOpen(true)}
            onClearSelection={() => setSelectedIds(new Set())}
            isTransferring={false}
            onDuplicate={activeBU !== 'consorcio' ? () => setDuplicateDialogOpen(true) : undefined}
            isDuplicating={duplicateMutation.isPending}
          />

          <SendToPipelineModal
            open={pipelineModalOpen}
            onOpenChange={setPipelineModalOpen}
            selectedContactIds={Array.from(selectedIds)}
            onSuccess={() => setSelectedIds(new Set())}
          />

          <DuplicateToInsideDialog
            open={duplicateDialogOpen}
            onOpenChange={setDuplicateDialogOpen}
            selectedCount={selectedIds.size}
            isLoading={duplicateMutation.isPending}
            onConfirm={(ownerEmail, ownerProfileId, stageId) => {
              const leads = filteredContacts
                .filter(c => selectedIds.has(c.id))
                .map(c => ({
                  name: c.name,
                  email: c.email || '',
                  phone: c.phone || '',
                  sourceContactId: c.id,
                  sourceDealId: c.latestDeal?.id,
                }));
              duplicateMutation.mutate({ leads, ownerEmail, ownerProfileId, stageId }, {
                onSuccess: () => {
                  setSelectedIds(new Set());
                  setDuplicateDialogOpen(false);
                },
              });
            }}
          />

          <ContactFormDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} />
        </>
      )}

      <ContactDetailsDrawer contactId={selectedContactId} open={drawerOpen} onOpenChange={setDrawerOpen} />
    </div>
  );
};

export default Contatos;
