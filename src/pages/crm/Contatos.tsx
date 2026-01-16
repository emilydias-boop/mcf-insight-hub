import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useCRMContactsWithDeals, useSyncClintData } from '@/hooks/useCRMData';
import { Search, Plus, Mail, Phone, User, RefreshCw, GitBranch } from 'lucide-react';
import { ContactDetailsDrawer } from '@/components/crm/ContactDetailsDrawer';
import { ContactFormDialog } from '@/components/crm/ContactFormDialog';
import { toast } from 'sonner';

const Contatos = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const { data: contacts, isLoading } = useCRMContactsWithDeals();
  const syncMutation = useSyncClintData();
  
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

  const contactsData = contacts || [];
  const filteredContacts = contactsData.filter((contact: any) =>
    contact.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Helper to get valid tags (parse JSON strings and filter nulls)
  const getValidTags = (tags: any[]): { name: string; color: string | null }[] => {
    if (!tags || !Array.isArray(tags)) return [];
    return tags
      .map((tag: any) => {
        // Se for string, tentar parsear como JSON
        if (typeof tag === 'string') {
          const trimmed = tag.trim();
          // Se parece ser JSON (começa com {), parsear
          if (trimmed.startsWith('{')) {
            try {
              const parsed = JSON.parse(trimmed);
              if (parsed && parsed.name && parsed.name.trim()) {
                return { name: parsed.name.trim(), color: parsed.color || null };
              }
            } catch {
              // Se falhar parse, usar string diretamente se não vazia
              if (trimmed) {
                return { name: trimmed, color: null };
              }
            }
          } else if (trimmed) {
            // String simples não-JSON
            return { name: trimmed, color: null };
          }
          return null;
        }
        // Se já for objeto
        if (tag && typeof tag === 'object' && tag.name && tag.name.trim()) {
          return { name: tag.name.trim(), color: tag.color || null };
        }
        return null;
      })
      .filter(Boolean) as { name: string; color: string | null }[];
  };

  // Helper to get latest deal info
  const getLatestDeal = (deals: any[]) => {
    if (!deals || deals.length === 0) return null;
    return deals.sort((a: any, b: any) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0];
  };

  return (
    <div className="flex flex-col gap-3 sm:gap-scale-lg">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-foreground">Contatos</h2>
          <p className="text-sm text-muted-foreground hidden sm:block">Gerencie todos os seus contatos</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button 
            variant="outline" 
            onClick={handleSync}
            disabled={syncMutation.isPending}
            className="flex-1 sm:flex-none"
            size="sm"
          >
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

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 icon-scale-sm text-muted-foreground" />
        <Input
          placeholder="Buscar contatos por nome ou email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 bg-card border-border text-foreground"
        />
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-scale-md"></div>
          <p className="text-lg font-semibold text-foreground">Carregando contatos...</p>
          <p className="text-sm text-muted-foreground mt-scale-sm">
            Dados carregados do banco local
          </p>
        </div>
      ) : filteredContacts.length > 0 ? (
        <div className="grid gap-scale-md grid-scale-cards">
          {filteredContacts.map((contact: any) => {
            const validTags = getValidTags(contact.tags);
            const latestDeal = getLatestDeal(contact.crm_deals);
            
            return (
              <Card 
                key={contact.id} 
                className="bg-card border-border hover:border-primary/50 transition-colors cursor-pointer"
                onClick={() => handleContactClick(contact.id)}
              >
                <CardContent className="p-scale-lg">
                  <div className="flex items-start justify-between mb-scale-md">
                    <div className="flex items-center gap-scale-sm">
                      <div className="avatar-scale rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="icon-scale-md text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground">{contact.name}</h3>
                        {contact.organization_name && (
                          <p className="text-xs text-muted-foreground">{contact.organization_name}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-scale-xs mb-scale-md">
                    {contact.email && (
                      <div className="flex items-center gap-scale-xs text-sm text-muted-foreground">
                        <Mail className="icon-scale-sm" />
                        <span className="truncate">{contact.email}</span>
                      </div>
                    )}
                    {contact.phone && (
                      <div className="flex items-center gap-scale-xs text-sm text-muted-foreground">
                        <Phone className="icon-scale-sm" />
                        <span>{contact.phone}</span>
                      </div>
                    )}
                  </div>

                  {/* Stage/Pipeline info */}
                  {latestDeal && (
                    <div className="flex items-center gap-scale-xs mb-scale-sm text-xs">
                      <GitBranch className="h-3 w-3 text-muted-foreground" />
                      <span className="text-muted-foreground truncate">
                        {latestDeal.crm_origins?.name || 'Pipeline'}
                      </span>
                      {latestDeal.crm_stages && (
                        <Badge 
                          variant="outline" 
                          className="text-xs"
                          style={{ 
                            borderColor: latestDeal.crm_stages.color || undefined,
                            color: latestDeal.crm_stages.color || undefined 
                          }}
                        >
                          {latestDeal.crm_stages.stage_name}
                        </Badge>
                      )}
                    </div>
                  )}

                  {/* Tags */}
                  {validTags.length > 0 && (
                    <div className="flex flex-wrap gap-scale-xs">
                      {validTags.slice(0, 3).map((tag, idx) => (
                        <Badge 
                          key={idx} 
                          variant="secondary" 
                          className="text-xs"
                          style={tag.color ? { backgroundColor: `${tag.color}20`, color: tag.color } : undefined}
                        >
                          {tag.name}
                        </Badge>
                      ))}
                      {validTags.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{validTags.length - 3}
                        </Badge>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="bg-card border-border">
          <CardContent className="p-scale-xl text-center">
            <User className="icon-scale-lg text-muted-foreground mx-auto mb-scale-md" style={{ width: '3rem', height: '3rem' }} />
            <h3 className="text-lg font-semibold text-foreground mb-scale-sm">
              {searchTerm ? 'Nenhum contato encontrado' : 'Nenhum contato cadastrado'}
            </h3>
            <p className="text-muted-foreground mb-scale-md">
              {searchTerm
                ? 'Tente buscar com outros termos'
                : 'Comece adicionando seus primeiros contatos'}
            </p>
            {!searchTerm && (
              <Button onClick={() => setCreateDialogOpen(true)}>
                <Plus className="icon-scale-sm mr-2" />
                Adicionar Contato
              </Button>
            )}
          </CardContent>
        </Card>
      )}
      
      <ContactDetailsDrawer
        contactId={selectedContactId}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
      
      <ContactFormDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
    </div>
  );
};

export default Contatos;
