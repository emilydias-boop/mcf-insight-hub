import { useState, useMemo, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Search, DollarSign, User, Phone, Mail, Link2, Loader2, Package, BadgeCheck } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useUnlinkedContracts } from '@/hooks/useUnlinkedContracts';
import { useLinkContractToAttendee } from '@/hooks/useLinkContractToAttendee';

interface LinkContractDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  attendeeId: string;
  attendeeName: string;
  dealId?: string | null;
}

const onlyDigits = (s: string | null | undefined) => (s || '').replace(/\D/g, '');

export function LinkContractDialog({ 
  open, 
  onOpenChange, 
  attendeeId, 
  attendeeName,
  dealId 
}: LinkContractDialogProps) {
  const [search, setSearch] = useState('');
  const [searchAll, setSearchAll] = useState(false);
  const [attendeeCpf, setAttendeeCpf] = useState<string>('');

  // Buscar CPF do attendee para destacar matches
  useEffect(() => {
    if (!open || !attendeeId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('meeting_slot_attendees')
        .select('cpf')
        .eq('id', attendeeId)
        .maybeSingle();
      if (!cancelled) setAttendeeCpf(onlyDigits(data?.cpf));
    })();
    return () => { cancelled = true; };
  }, [open, attendeeId]);

  const { data: contracts = [], isLoading } = useUnlinkedContracts(
    searchAll ? { searchAll: true, search } : {}
  );
  const linkContract = useLinkContractToAttendee();

  // Filter + sort: matches por CPF aparecem primeiro
  const filteredContracts = useMemo(() => {
    let list = contracts;
    // In searchAll mode, filtering is server-side
    if (!searchAll && search.trim()) {
      const searchLower = search.toLowerCase();
      const searchDigits = search.replace(/\D/g, '');
      list = list.filter(c => {
        const nameMatch = c.customer_name?.toLowerCase().includes(searchLower);
        const emailMatch = c.customer_email?.toLowerCase().includes(searchLower);
        const phoneMatch = searchDigits && c.customer_phone?.replace(/\D/g, '').includes(searchDigits);
        const cpfMatch = searchDigits && onlyDigits(c.customer_document).includes(searchDigits);
        return nameMatch || emailMatch || phoneMatch || cpfMatch;
      });
    }
    // Ordenar: matches por CPF no topo
    if (attendeeCpf && attendeeCpf.length >= 11) {
      list = [...list].sort((a, b) => {
        const aMatch = onlyDigits(a.customer_document) === attendeeCpf ? 1 : 0;
        const bMatch = onlyDigits(b.customer_document) === attendeeCpf ? 1 : 0;
        return bMatch - aMatch;
      });
    }
    return list;
  }, [contracts, search, searchAll, attendeeCpf]);

  const handleLink = (transactionId: string) => {
    linkContract.mutate(
      { transactionId, attendeeId, dealId },
      {
        onSuccess: () => {
          onOpenChange(false);
          setSearch('');
          setSearchAll(false);
        }
      }
    );
  };

  const formatCurrency = (value: number | null) => {
    if (value === null) return 'R$ -';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const formatPhone = (phone: string | null) => {
    if (!phone) return null;
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 11) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    }
    return phone;
  };

  const formatCpf = (cpf: string | null) => {
    const d = onlyDigits(cpf);
    if (d.length !== 11) return cpf;
    return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary" />
            Vincular Contrato
          </DialogTitle>
          <DialogDescription>
            Vincular um contrato pago a <strong>{attendeeName}</strong>
            {attendeeCpf && attendeeCpf.length >= 11 && (
              <span className="ml-2 text-xs text-muted-foreground">
                · CPF: {formatCpf(attendeeCpf)}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={searchAll ? "Buscar por nome, email ou telefone (mín. 3 caracteres)..." : "Buscar por nome, email ou telefone..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Search All Toggle */}
          <div className="flex items-center justify-between gap-2 rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="search-all" className="text-sm font-medium cursor-pointer">
                Buscar em todo o histórico
              </Label>
              <p className="text-xs text-muted-foreground">
                Remove filtros de data e categoria
              </p>
            </div>
            <Switch
              id="search-all"
              checked={searchAll}
              onCheckedChange={setSearchAll}
            />
          </div>

          {/* Contracts List */}
          <ScrollArea className="h-[300px] pr-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : searchAll && search.trim().length < 3 ? (
              <div className="text-center py-8 text-muted-foreground">
                Digite pelo menos 3 caracteres para buscar
              </div>
            ) : filteredContracts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {!searchAll && contracts.length === 0 
                  ? 'Nenhum contrato pendente nos últimos 14 dias'
                  : 'Nenhum contrato encontrado com essa busca'}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredContracts.map((contract) => {
                  const contractCpf = onlyDigits(contract.customer_document);
                  const cpfMatches = !!attendeeCpf && attendeeCpf.length >= 11 && contractCpf === attendeeCpf;
                  return (
                  <div 
                    key={contract.id}
                    className={`border rounded-lg p-3 transition-colors ${
                      cpfMatches 
                        ? 'border-primary bg-primary/5 hover:bg-primary/10' 
                        : 'hover:bg-muted/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0 space-y-1">
                        {/* Name and Value */}
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="font-medium truncate">
                            {contract.customer_name || 'Sem nome'}
                          </span>
                          <Badge variant="secondary" className="shrink-0">
                            <DollarSign className="h-3 w-3 mr-1" />
                            {formatCurrency(contract.net_value || contract.product_price)}
                          </Badge>
                          {cpfMatches && (
                            <Badge className="shrink-0 bg-primary text-primary-foreground hover:bg-primary/90">
                              <BadgeCheck className="h-3 w-3 mr-1" />
                              CPF confere
                            </Badge>
                          )}
                        </div>
                        
                        {/* Product info (searchAll mode) */}
                        {searchAll && contract.product_name && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Package className="h-3 w-3 shrink-0" />
                            <span className="truncate">{contract.product_name}</span>
                            {contract.product_category && (
                              <Badge variant="outline" className="text-xs shrink-0">
                                {contract.product_category}
                              </Badge>
                            )}
                          </div>
                        )}

                        {/* Email */}
                        {contract.customer_email && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Mail className="h-3 w-3 shrink-0" />
                            <span className="truncate">{contract.customer_email}</span>
                          </div>
                        )}
                        
                        {/* Phone */}
                        {contract.customer_phone && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Phone className="h-3 w-3 shrink-0" />
                            <span>{formatPhone(contract.customer_phone)}</span>
                          </div>
                        )}

                        {/* CPF */}
                        {contractCpf && (
                          <div className={`flex items-center gap-2 text-sm ${cpfMatches ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
                            <BadgeCheck className="h-3 w-3 shrink-0" />
                            <span>CPF: {formatCpf(contractCpf)}</span>
                          </div>
                        )}
                        
                        {/* Date */}
                        <div className="text-xs text-muted-foreground">
                          Pago em {format(parseISO(contract.sale_date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </div>
                      </div>
                      
                      {/* Link Button */}
                      <Button
                        size="sm"
                        onClick={() => handleLink(contract.id)}
                        disabled={linkContract.isPending}
                        variant={cpfMatches ? 'default' : 'outline'}
                      >
                        {linkContract.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Link2 className="h-4 w-4 mr-1" />
                            Vincular
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          {/* Info */}
          <p className="text-xs text-muted-foreground text-center">
            {searchAll 
              ? 'Buscando em todo o histórico de transações não vinculadas'
              : 'Mostrando contratos pendentes dos últimos 14 dias'}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
