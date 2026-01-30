import { useState, useMemo, useEffect } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Search, User, Calendar, Check, Pencil } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useAllApprovedAttendees, ApprovedAttendeeWithWeek } from '@/hooks/useAllApprovedAttendees';
import { useCreateCarrinhoTransaction } from '@/hooks/useCreateCarrinhoTransaction';
import { useUpdateCarrinhoTransaction } from '@/hooks/useUpdateCarrinhoTransaction';

// Produtos de parceria disponíveis
const PARCERIA_PRODUCTS = [
  { name: 'A009 - MCF INCORPORADOR COMPLETO + THE CLUB', price: 19500 },
  { name: 'A001 - MCF INCORPORADOR COMPLETO', price: 14500 },
  { name: 'A003 - INCORPORADOR ESSENCIAL', price: 7500 },
  { name: 'A004 - INCORPORADOR START', price: 5500 },
];

// Transaction data for edit mode
export interface TransactionToEdit {
  id: string;
  product_name: string;
  product_price: number;
  net_value: number;
  customer_name: string;
  customer_email: string;
  customer_phone?: string | null;
  sale_date: string;
  linked_attendee_id?: string | null;
}

interface R2CarrinhoTransactionFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  weekStart: Date;
  // Props for edit mode
  editMode?: boolean;
  transactionToEdit?: TransactionToEdit;
}

export function R2CarrinhoTransactionFormDialog({
  open,
  onOpenChange,
  weekStart,
  editMode = false,
  transactionToEdit,
}: R2CarrinhoTransactionFormDialogProps) {
  const { data: allApprovedAttendees = [], isLoading: isLoadingAttendees } = useAllApprovedAttendees();
  const createTransaction = useCreateCarrinhoTransaction();
  const updateTransaction = useUpdateCarrinhoTransaction();

  // Form state
  const [selectedAttendee, setSelectedAttendee] = useState<ApprovedAttendeeWithWeek | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [saleDate, setSaleDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [productPrice, setProductPrice] = useState<number>(0);
  const [netValue, setNetValue] = useState<number>(0);
  const [searchAllWeeks, setSearchAllWeeks] = useState(false);
  const [attendeePopoverOpen, setAttendeePopoverOpen] = useState(false);

  // Pre-fill form when editing
  useEffect(() => {
    if (editMode && transactionToEdit && open) {
      setSelectedProduct(transactionToEdit.product_name || '');
      setCustomerName(transactionToEdit.customer_name || '');
      setCustomerEmail(transactionToEdit.customer_email || '');
      setCustomerPhone(transactionToEdit.customer_phone || '');
      setProductPrice(transactionToEdit.product_price || 0);
      setNetValue(transactionToEdit.net_value || 0);
      
      // Format date correctly
      if (transactionToEdit.sale_date) {
        const date = new Date(transactionToEdit.sale_date);
        setSaleDate(format(date, 'yyyy-MM-dd'));
      }
      
      // Find and set the linked attendee if exists
      if (transactionToEdit.linked_attendee_id && allApprovedAttendees.length > 0) {
        const attendee = allApprovedAttendees.find(a => a.id === transactionToEdit.linked_attendee_id);
        if (attendee) {
          setSelectedAttendee(attendee);
          setSearchAllWeeks(true); // Enable all weeks search since the attendee might be from another week
        }
      }
    }
  }, [editMode, transactionToEdit, open, allApprovedAttendees]);

  // Filtrar attendees com base na semana
  const filteredAttendees = useMemo(() => {
    if (searchAllWeeks) {
      return allApprovedAttendees;
    }
    // Filtrar apenas da semana atual
    const weekStartStr = format(weekStart, 'yyyy-MM-dd');
    return allApprovedAttendees.filter(att => {
      if (!att.scheduled_at) return false;
      const attDate = new Date(att.scheduled_at);
      const attWeekStart = format(attDate, 'yyyy-MM-dd');
      // Simplificar: mostrar se está na mesma semana aproximada
      return att.week_label.includes(format(weekStart, "dd/MM"));
    });
  }, [allApprovedAttendees, searchAllWeeks, weekStart]);

  // Quando selecionar attendee, preencher dados
  const handleSelectAttendee = (attendee: ApprovedAttendeeWithWeek) => {
    setSelectedAttendee(attendee);
    setCustomerName(attendee.attendee_name || '');
    setCustomerEmail(attendee.contact_email || '');
    setCustomerPhone(attendee.attendee_phone || '');
    setAttendeePopoverOpen(false);
  };

  // Quando selecionar produto, preencher preço
  const handleProductChange = (productName: string) => {
    setSelectedProduct(productName);
    const product = PARCERIA_PRODUCTS.find(p => p.name === productName);
    if (product) {
      setProductPrice(product.price);
      // Estimar líquido como ~67% do bruto (aproximação)
      setNetValue(Math.round(product.price * 0.67));
    }
  };

  // Reset form
  const resetForm = () => {
    setSelectedAttendee(null);
    setSelectedProduct('');
    setCustomerName('');
    setCustomerEmail('');
    setCustomerPhone('');
    setSaleDate(format(new Date(), 'yyyy-MM-dd'));
    setProductPrice(0);
    setNetValue(0);
    setSearchAllWeeks(false);
  };

  // Submit
  const handleSubmit = async () => {
    // For create mode, attendee is required
    if (!editMode && !selectedAttendee) {
      return;
    }
    
    if (!selectedProduct || !customerEmail || !netValue) {
      return;
    }

    if (editMode && transactionToEdit) {
      // Update existing transaction
      await updateTransaction.mutateAsync({
        id: transactionToEdit.id,
        product_name: selectedProduct,
        product_price: productPrice,
        net_value: netValue,
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone,
        sale_date: new Date(saleDate).toISOString(),
      });
    } else if (selectedAttendee) {
      // Create new transaction
      await createTransaction.mutateAsync({
        product_name: selectedProduct,
        product_price: productPrice,
        net_value: netValue,
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone,
        sale_date: new Date(saleDate).toISOString(),
        linked_attendee_id: selectedAttendee.id,
      });
    }

    resetForm();
    onOpenChange(false);
  };

  const isFormValid = editMode
    ? selectedProduct && customerEmail && netValue > 0
    : selectedAttendee && selectedProduct && customerEmail && netValue > 0;
    
  const isPending = createTransaction.isPending || updateTransaction.isPending;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) resetForm();
      onOpenChange(isOpen);
    }}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {editMode ? <Pencil className="h-5 w-5" /> : <User className="h-5 w-5" />}
            {editMode ? 'Editar Venda de Parceria' : 'Nova Venda de Parceria'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Lead Aprovado */}
          <div className="space-y-2">
            <Label>Lead Aprovado *</Label>
            <Popover open={attendeePopoverOpen} onOpenChange={setAttendeePopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className={cn(
                    "w-full justify-between",
                    !selectedAttendee && "text-muted-foreground"
                  )}
                >
                  {selectedAttendee ? (
                    <div className="flex items-center gap-2">
                      <span>{selectedAttendee.attendee_name}</span>
                      {selectedAttendee.closer_name && (
                        <Badge 
                          variant="outline" 
                          className="text-xs"
                          style={{ 
                            borderColor: selectedAttendee.closer_color || undefined,
                            color: selectedAttendee.closer_color || undefined 
                          }}
                        >
                          {selectedAttendee.closer_name}
                        </Badge>
                      )}
                    </div>
                  ) : (
                    "Buscar lead aprovado..."
                  )}
                  <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[400px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Buscar por nome, email ou telefone..." />
                  <CommandList>
                    <CommandEmpty>
                      {isLoadingAttendees ? 'Carregando...' : 'Nenhum lead aprovado encontrado'}
                    </CommandEmpty>
                    <CommandGroup>
                      {filteredAttendees.map((attendee) => (
                        <CommandItem
                          key={attendee.id}
                          value={`${attendee.attendee_name} ${attendee.contact_email} ${attendee.attendee_phone}`}
                          onSelect={() => handleSelectAttendee(attendee)}
                        >
                          <div className="flex flex-col flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{attendee.attendee_name || 'Sem nome'}</span>
                              {attendee.closer_name && (
                                <span 
                                  className="text-xs px-1.5 py-0.5 rounded-full"
                                  style={{ 
                                    backgroundColor: attendee.closer_color ? `${attendee.closer_color}20` : 'hsl(var(--muted))',
                                    color: attendee.closer_color || 'hsl(var(--muted-foreground))'
                                  }}
                                >
                                  {attendee.closer_name}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {attendee.contact_email || attendee.attendee_phone || '-'} • {attendee.week_label}
                            </div>
                          </div>
                          {selectedAttendee?.id === attendee.id && (
                            <Check className="h-4 w-4 text-primary" />
                          )}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            <div className="flex items-center gap-2">
              <Switch
                id="search-all-weeks"
                checked={searchAllWeeks}
                onCheckedChange={setSearchAllWeeks}
              />
              <Label htmlFor="search-all-weeks" className="text-sm text-muted-foreground cursor-pointer">
                Buscar em outras semanas
              </Label>
            </div>
          </div>

          {/* Produto */}
          <div className="space-y-2">
            <Label>Produto *</Label>
            <Select value={selectedProduct} onValueChange={handleProductChange}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o produto" />
              </SelectTrigger>
              <SelectContent>
                {PARCERIA_PRODUCTS.map((product) => (
                  <SelectItem key={product.name} value={product.name}>
                    <div className="flex justify-between items-center gap-4">
                      <span>{product.name}</span>
                      <span className="text-muted-foreground">
                        R$ {product.price.toLocaleString('pt-BR')}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Nome e Email */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nome do Cliente *</Label>
              <Input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Nome completo"
              />
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder="email@exemplo.com"
              />
            </div>
          </div>

          {/* Telefone e Data */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="(11) 99999-9999"
              />
            </div>
            <div className="space-y-2">
              <Label>Data da Venda *</Label>
              <Input
                type="date"
                value={saleDate}
                onChange={(e) => setSaleDate(e.target.value)}
              />
            </div>
          </div>

          {/* Valores */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Valor Bruto (R$)</Label>
              <Input
                type="number"
                value={productPrice}
                onChange={(e) => setProductPrice(Number(e.target.value))}
                placeholder="0,00"
              />
            </div>
            <div className="space-y-2">
              <Label>Valor Líquido (R$) *</Label>
              <Input
                type="number"
                value={netValue}
                onChange={(e) => setNetValue(Number(e.target.value))}
                placeholder="0,00"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={!isFormValid || isPending}
          >
            {isPending 
              ? (editMode ? 'Salvando...' : 'Criando...') 
              : (editMode ? 'Salvar Alterações' : 'Criar Venda')
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
