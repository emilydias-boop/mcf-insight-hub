import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Search, User, Link2, X } from 'lucide-react';
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
import { useR2CarrinhoData } from '@/hooks/useR2CarrinhoData';
import { useAllApprovedAttendees } from '@/hooks/useAllApprovedAttendees';
import { useLinkTransactionToAttendee } from '@/hooks/useLinkTransactionToAttendee';

interface LinkAttendeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transactionId: string;
  transactionName: string;
  weekDate: Date;
}

export function LinkAttendeeDialog({
  open,
  onOpenChange,
  transactionId,
  transactionName,
  weekDate,
}: LinkAttendeeDialogProps) {
  const [search, setSearch] = useState('');
  const [searchAllWeeks, setSearchAllWeeks] = useState(false);
  
  const { data: currentWeekAttendees = [], isLoading: isLoadingCurrent } = useR2CarrinhoData(weekDate, 'aprovados');
  const { data: allAttendees = [], isLoading: isLoadingAll } = useAllApprovedAttendees();
  const linkMutation = useLinkTransactionToAttendee();

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Vincular Venda a Lead Aprovado
          </DialogTitle>
          <DialogDescription>
            Vincular <strong>{transactionName}</strong> a um lead aprovado do R2 desta semana.
            Use quando a pessoa paga com dados de terceiros (esposa, filho, sócio).
          </DialogDescription>
        </DialogHeader>

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
            ) : filteredAttendees.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {search ? 'Nenhum lead encontrado com essa busca' : 'Nenhum lead aprovado esta semana'}
              </div>
            ) : (
              filteredAttendees.map((att) => (
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
              ))
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
