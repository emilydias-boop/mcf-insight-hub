import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Search, User, Link2, X, UserPlus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useR2CarrinhoData } from '@/hooks/useR2CarrinhoData';
import { useAllApprovedAttendees } from '@/hooks/useAllApprovedAttendees';
import { useLinkTransactionToAttendee } from '@/hooks/useLinkTransactionToAttendee';
import { useCreateManualApprovedLead } from '@/hooks/useCreateManualApprovedLead';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface LinkAttendeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transactionId: string;
  transactionName: string;
  transactionEmail?: string;
  transactionPhone?: string;
  weekDate: Date;
}

export function LinkAttendeeDialog({
  open,
  onOpenChange,
  transactionId,
  transactionName,
  transactionEmail,
  transactionPhone,
  weekDate,
}: LinkAttendeeDialogProps) {
  const [search, setSearch] = useState('');
  const [searchAllWeeks, setSearchAllWeeks] = useState(false);
  const [showManualCreate, setShowManualCreate] = useState(false);
  const [selectedCloserId, setSelectedCloserId] = useState<string>('');
  
  const { data: currentWeekAttendees = [], isLoading: isLoadingCurrent } = useR2CarrinhoData(weekDate, 'aprovados');
  const { data: allAttendees = [], isLoading: isLoadingAll } = useAllApprovedAttendees();
  const linkMutation = useLinkTransactionToAttendee();
  const createManualMutation = useCreateManualApprovedLead();

  // Fetch closers for manual creation
  const { data: closers = [] } = useQuery({
    queryKey: ['closers-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('closers')
        .select('id, name, color')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });

  const attendees = searchAllWeeks ? allAttendees : currentWeekAttendees;
  const isLoading = searchAllWeeks ? isLoadingAll : isLoadingCurrent;

  const filteredAttendees = useMemo(() => {
    if (!search.trim()) return attendees;
    
    const searchLower = search.toLowerCase();
    return attendees.filter((att) => {
      const name = att.attendee_name?.toLowerCase() || '';
      const email = att.contact_email?.toLowerCase() || '';
      const phone = att.attendee_phone || '';
      
      return (
        name.includes(searchLower) ||
        email.includes(searchLower) ||
        phone.includes(search)
      );
    });
  }, [attendees, search]);

  const handleLink = async (attendeeId: string) => {
    await linkMutation.mutateAsync({ transactionId, attendeeId });
    onOpenChange(false);
  };

  const handleManualCreate = async () => {
    if (!selectedCloserId) return;
    
    await createManualMutation.mutateAsync({
      transactionId,
      closerId: selectedCloserId,
      customerName: transactionName,
      customerEmail: transactionEmail,
      customerPhone: transactionPhone,
    });
    
    onOpenChange(false);
  };

  const resetState = () => {
    setSearch('');
    setSearchAllWeeks(false);
    setShowManualCreate(false);
    setSelectedCloserId('');
  };

  // Reset state when dialog closes
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetState();
    }
    onOpenChange(newOpen);
  };

  const showEmptyState = !isLoading && filteredAttendees.length === 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {showManualCreate ? (
              <>
                <UserPlus className="h-5 w-5" />
                Criar Lead Aprovado Manual
              </>
            ) : (
              <>
                <Link2 className="h-5 w-5" />
                Vincular Venda a Lead Aprovado
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {showManualCreate ? (
              <>
                Criando lead aprovado para <strong>{transactionName}</strong>.
                Selecione o closer responsável.
              </>
            ) : (
              <>
                Vincular <strong>{transactionName}</strong> a um lead aprovado do R2.
                <span className="block text-xs mt-1 opacity-75">
                  Use quando a pessoa paga com dados de terceiros (esposa, filho, sócio).
                </span>
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {showManualCreate ? (
          // Manual creation form
          <div className="space-y-4 py-4">
            <div className="p-4 rounded-lg bg-muted/50 space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="font-medium">{transactionName}</p>
                  <p className="text-sm text-muted-foreground">
                    {transactionEmail || transactionPhone || 'Sem contato'}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Closer responsável *</Label>
              <Select value={selectedCloserId} onValueChange={setSelectedCloserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o closer..." />
                </SelectTrigger>
                <SelectContent>
                  {closers.map((closer) => (
                    <SelectItem key={closer.id} value={closer.id}>
                      <div className="flex items-center gap-2">
                        <div 
                          className="h-3 w-3 rounded-full" 
                          style={{ backgroundColor: closer.color || '#888' }}
                        />
                        {closer.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                O lead será criado como "Aprovado" e vinculado automaticamente a esta venda.
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowManualCreate(false)}
              >
                Voltar
              </Button>
              <Button
                className="flex-1"
                onClick={handleManualCreate}
                disabled={!selectedCloserId || createManualMutation.isPending}
              >
                {createManualMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Criando...
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Criar e Vincular
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          // Search and list view
          <>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <Label htmlFor="search-all-weeks" className="text-sm cursor-pointer">
                  Buscar em outras semanas
                </Label>
                <Switch 
                  id="search-all-weeks"
                  checked={searchAllWeeks} 
                  onCheckedChange={setSearchAllWeeks} 
                />
              </div>
              
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, email ou telefone..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
                {search && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                    onClick={() => setSearch('')}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            <ScrollArea className="flex-1 -mx-6 px-6">
              <div className="space-y-2 py-2">
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))
                ) : showEmptyState ? (
                  <div className="text-center py-6 space-y-4">
                    <div className="text-muted-foreground">
                      {search 
                        ? 'Nenhum lead encontrado com essa busca' 
                        : searchAllWeeks 
                          ? 'Nenhum lead aprovado nos últimos 45 dias'
                          : 'Nenhum lead aprovado esta semana'}
                    </div>
                    
                    <div className="p-4 rounded-lg border border-dashed bg-muted/30">
                      <p className="text-sm font-medium mb-2">
                        Não encontrou o lead?
                      </p>
                      <p className="text-xs text-muted-foreground mb-3">
                        Crie um lead aprovado manualmente para vincular esta venda.
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowManualCreate(true)}
                        className="gap-2"
                      >
                        <UserPlus className="h-4 w-4" />
                        Criar Lead Manual
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    {filteredAttendees.map((att) => (
                      <div
                        key={att.id}
                        className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <User className="h-5 w-5 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium truncate">{att.attendee_name}</p>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <span className="truncate">{att.contact_email || att.attendee_phone || '-'}</span>
                            {att.closer_name && (
                                <Badge 
                                  variant="outline" 
                                  className="text-xs flex-shrink-0"
                                  style={{ 
                                    borderColor: att.closer_color || undefined,
                                    color: att.closer_color || undefined 
                                  }}
                                >
                                  {att.closer_name}
                                </Badge>
                              )}
                              {searchAllWeeks && 'week_label' in att && (
                                <Badge variant="secondary" className="text-xs flex-shrink-0">
                                  {att.week_label}
                                </Badge>
                              )}
                            </div>
                            {att.scheduled_at && (
                              <span className="text-xs text-muted-foreground">
                                R2: {format(new Date(att.scheduled_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                              </span>
                            )}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleLink(att.id)}
                          disabled={linkMutation.isPending}
                        >
                          <Link2 className="h-4 w-4 mr-1" />
                          Vincular
                        </Button>
                      </div>
                    ))}
                    
                    {/* Manual create option at the bottom */}
                    <div className="pt-4 mt-4 border-t">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowManualCreate(true)}
                        className="w-full justify-center gap-2 text-muted-foreground hover:text-foreground"
                      >
                        <UserPlus className="h-4 w-4" />
                        Não encontrou? Criar lead manual
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </ScrollArea>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
