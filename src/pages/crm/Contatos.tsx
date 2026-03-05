import { useState, useMemo, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useContactsEnriched, useContactFilterOptions, type EnrichedContact } from '@/hooks/useContactsEnriched';
import { useSyncClintData } from '@/hooks/useCRMData';
import { usePartnerProductDetectionBatch } from '@/hooks/usePartnerProductDetection';
import { Search, Plus, User, RefreshCw, Loader2, Send } from 'lucide-react';
import { ContactDetailsDrawer } from '@/components/crm/ContactDetailsDrawer';
import { ContactFormDialog } from '@/components/crm/ContactFormDialog';
import { ContactCard } from '@/components/crm/ContactCard';
import { ContactFilters, emptyFilters, type ContactFilterValues } from '@/components/crm/ContactFilters';
import { BulkActionsBar } from '@/components/crm/BulkActionsBar';
import { SendToPipelineModal } from '@/components/crm/SendToPipelineModal';
import { toast } from 'sonner';
import { subDays } from 'date-fns';

const Contatos = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [filters, setFilters] = useState<ContactFilterValues>(emptyFilters);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pipelineModalOpen, setPipelineModalOpen] = useState(false);
  const [isLoadingAll, setIsLoadingAll] = useState(false);
  const [wantsSelectAll, setWantsSelectAll] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 400);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const { data: contacts, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useContactsEnriched(debouncedSearch);
  const syncMutation = useSyncClintData();

  const contactsData = contacts || [];
  const filterOptions = useContactFilterOptions(contactsData);

  // Batch partner detection for ALL loaded contacts
  const attendeesForCheck = useMemo(() => 
    contactsData.map(c => ({ id: c.id, email: c.email })),
    [contactsData]
  );
  const { data: partnerMap } = usePartnerProductDetectionBatch(attendeesForCheck);

  // Auto-load all pages when partnership filter is active
  const needsFullLoad = !!(filters.partnerProduct && hasNextPage);
  useEffect(() => {
    if (needsFullLoad && !isFetchingNextPage) {
      setIsLoadingAll(true);
      fetchNextPage();
    }
    if (!hasNextPage && isLoadingAll) {
      setIsLoadingAll(false);
    }
  }, [needsFullLoad, isFetchingNextPage, hasNextPage, fetchNextPage, isLoadingAll]);

  // After full load completes, if user wanted select all, do it
  useEffect(() => {
    if (wantsSelectAll && !hasNextPage && !isFetchingNextPage) {
      setWantsSelectAll(false);
      setIsLoadingAll(false);
    }
  }, [wantsSelectAll, hasNextPage, isFetchingNextPage]);

  // Derive partner product options from partnerMap
  const partnerProductOptions = useMemo(() => {
    if (!partnerMap) return [];
    const labels = new Set<string>();
    Object.values(partnerMap).forEach(p => {
      if (p.isPartner && p.productLabel) labels.add(p.productLabel);
    });
    return Array.from(labels).sort();
  }, [partnerMap]);

  // Filter stages by selected pipeline
  const filteredStageOptions = useMemo(() => {
    if (!filters.pipeline) return filterOptions.stages;
    return Array.from(new Set(
      contactsData
        .filter(c => c.latestDeal?.origin_id === filters.pipeline && c.latestDeal?.stage_name)
        .map(c => c.latestDeal!.stage_name!)
    ));
  }, [filters.pipeline, contactsData, filterOptions.stages]);

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

    // Partnership filter
    if (filters.partnerProduct && partnerMap) {
      if (filters.partnerProduct === '__any__') {
        result = result.filter(c => partnerMap[c.id]?.isPartner);
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
    const allSelected = allIds.every(id => selectedIds.has(id));
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

  const allFilteredSelected = filteredContacts.length > 0 && filteredContacts.every(c => selectedIds.has(c.id));

  return (
    <div className="flex flex-col gap-3 sm:gap-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-foreground">Contatos</h2>
          <p className="text-sm text-muted-foreground hidden sm:block">Gerencie todos os seus contatos</p>
        </div>
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
        totalCount={contactsData.length}
        partnerProductOptions={partnerProductOptions}
      />

      {/* Select all toggle */}
      {filteredContacts.length > 0 && (
        <div className="flex items-center gap-2">
          <Checkbox
            checked={allFilteredSelected}
            onCheckedChange={handleSelectAll}
          />
          <span className="text-xs text-muted-foreground">
            Selecionar todos ({filteredContacts.length})
          </span>
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
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredContacts.map((contact) => (
              <ContactCard
                key={contact.id}
                contact={contact}
                onClick={handleContactClick}
                partnerProduct={partnerMap?.[contact.id]}
                selected={selectedIds.has(contact.id)}
                onSelect={handleSelect}
              />
            ))}
          </div>

          {/* Load more */}
          {hasNextPage && (
            <div className="flex flex-col items-center gap-2 py-4">
              <p className="text-sm text-muted-foreground">
                Mostrando {contactsData.length} contatos carregados
              </p>
              <Button
                variant="outline"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
              >
                {isFetchingNextPage ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Carregando mais...
                  </>
                ) : (
                  'Carregar mais contatos'
                )}
              </Button>
            </div>
          )}

          {!hasNextPage && contactsData.length > 0 && (
            <p className="text-sm text-muted-foreground text-center py-2">
              Todos os {contactsData.length} contatos carregados
            </p>
          )}
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
            {!searchTerm && !Object.values(filters).some(v => v) && (
              <Button onClick={() => setCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Contato
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Bulk actions */}
      <BulkActionsBar
        selectedCount={selectedIds.size}
        onTransfer={() => setPipelineModalOpen(true)}
        onClearSelection={() => setSelectedIds(new Set())}
        isTransferring={false}
      />

      <SendToPipelineModal
        open={pipelineModalOpen}
        onOpenChange={setPipelineModalOpen}
        selectedContactIds={Array.from(selectedIds)}
        onSuccess={() => setSelectedIds(new Set())}
      />

      <ContactDetailsDrawer contactId={selectedContactId} open={drawerOpen} onOpenChange={setDrawerOpen} />
      <ContactFormDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} />
    </div>
  );
};

export default Contatos;
