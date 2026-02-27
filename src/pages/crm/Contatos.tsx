import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useContactsEnriched, useContactFilterOptions, type EnrichedContact } from '@/hooks/useContactsEnriched';
import { useSyncClintData } from '@/hooks/useCRMData';
import { Search, Plus, User, RefreshCw } from 'lucide-react';
import { ContactDetailsDrawer } from '@/components/crm/ContactDetailsDrawer';
import { ContactFormDialog } from '@/components/crm/ContactFormDialog';
import { ContactCard } from '@/components/crm/ContactCard';
import { ContactFilters, emptyFilters, type ContactFilterValues } from '@/components/crm/ContactFilters';
import { toast } from 'sonner';
import { subDays } from 'date-fns';

const Contatos = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [filters, setFilters] = useState<ContactFilterValues>(emptyFilters);
  const { data: contacts, isLoading } = useContactsEnriched();
  const syncMutation = useSyncClintData();

  const contactsData = contacts || [];
  const filterOptions = useContactFilterOptions(contactsData);

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

    // Text search
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(c =>
        c.name?.toLowerCase().includes(term) ||
        c.email?.toLowerCase().includes(term) ||
        c.phone?.includes(term)
      );
    }

    // Pipeline
    if (filters.pipeline) {
      result = result.filter(c => c.latestDeal?.origin_id === filters.pipeline);
    }

    // Stage
    if (filters.stage) {
      result = result.filter(c => c.latestDeal?.stage_name === filters.stage);
    }

    // SDR
    if (filters.sdr) {
      result = result.filter(c => c.sdrName === filters.sdr);
    }

    // Closer
    if (filters.closer) {
      result = result.filter(c => c.closerName === filters.closer);
    }

    // Status
    if (filters.status) {
      result = result.filter(c => c.thermalStatus === filters.status);
    }

    // Date range
    if (filters.dateRange) {
      const days = parseInt(filters.dateRange);
      const cutoff = subDays(new Date(), days);
      result = result.filter(c => new Date(c.created_at) >= cutoff);
    }

    return result;
  }, [contactsData, searchTerm, filters]);

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
        options={{ ...filterOptions, stages: filteredStageOptions }}
        resultCount={filteredContacts.length}
        totalCount={contactsData.length}
      />

      {/* Content */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
          <p className="text-lg font-semibold text-foreground">Carregando contatos...</p>
        </div>
      ) : filteredContacts.length > 0 ? (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredContacts.map((contact) => (
            <ContactCard key={contact.id} contact={contact} onClick={handleContactClick} />
          ))}
        </div>
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

      <ContactDetailsDrawer contactId={selectedContactId} open={drawerOpen} onOpenChange={setDrawerOpen} />
      <ContactFormDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} />
    </div>
  );
};

export default Contatos;
