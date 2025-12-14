import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Phone, Mail, Edit2, Check, X } from 'lucide-react';
import { useUpdateCRMContact } from '@/hooks/useCRMData';
import { toast } from 'sonner';

interface SdrSummaryBlockProps {
  deal: any;
  contact: any;
}

export const SdrSummaryBlock = ({ deal, contact }: SdrSummaryBlockProps) => {
  const updateContact = useUpdateCRMContact();
  const [editingPhone, setEditingPhone] = useState(false);
  const [phoneValue, setPhoneValue] = useState('');
  
  const customFields = deal?.custom_fields as Record<string, any> | null;
  const originName = deal?.crm_origins?.name || customFields?.origem || 'Não informada';
  const productName = deal?.product_name || customFields?.produto || customFields?.product_name || 'A010';
  
  const handleStartEditPhone = () => {
    setPhoneValue(contact?.phone || '');
    setEditingPhone(true);
  };
  
  const handleSavePhone = async () => {
    if (!contact?.id) return;
    
    try {
      await updateContact.mutateAsync({
        id: contact.id,
        phone: phoneValue
      });
      toast.success('Telefone atualizado');
      setEditingPhone(false);
    } catch (error) {
      toast.error('Erro ao atualizar telefone');
    }
  };
  
  const handleCancelEditPhone = () => {
    setEditingPhone(false);
    setPhoneValue('');
  };
  
  return (
    <div className="rounded-lg border border-border bg-secondary/30 p-3">
      <h3 className="text-xs font-semibold text-muted-foreground mb-2">📋 Resumo</h3>
      
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        {/* Coluna 1: Contato */}
        <div className="space-y-1.5">
          {contact?.name && (
            <div>
              <span className="text-xs text-muted-foreground">Nome:</span>
              <p className="font-medium text-foreground truncate">{contact.name}</p>
            </div>
          )}
          
          {contact?.email && (
            <div className="flex items-center gap-1.5">
              <Mail className="h-3 w-3 text-muted-foreground shrink-0" />
              <a 
                href={`mailto:${contact.email}`} 
                className="text-xs text-muted-foreground hover:text-primary transition-colors truncate"
              >
                {contact.email}
              </a>
            </div>
          )}
          
          {/* Telefone editável */}
          <div className="flex items-center gap-1.5">
            <Phone className="h-3 w-3 text-muted-foreground shrink-0" />
            {editingPhone ? (
              <div className="flex items-center gap-1 flex-1">
                <Input
                  value={phoneValue}
                  onChange={(e) => setPhoneValue(e.target.value)}
                  placeholder="+5511999990001"
                  className="h-6 text-xs bg-background flex-1"
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 text-primary hover:text-primary/80"
                  onClick={handleSavePhone}
                  disabled={updateContact.isPending}
                >
                  <Check className="h-3 w-3" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 text-destructive hover:text-destructive/80"
                  onClick={handleCancelEditPhone}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-1 flex-1">
                <span className="text-xs text-muted-foreground truncate">
                  {contact?.phone || 'Não cadastrado'}
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-5 w-5 shrink-0"
                  onClick={handleStartEditPhone}
                >
                  <Edit2 className="h-2.5 w-2.5" />
                </Button>
              </div>
            )}
          </div>
        </div>
        
        {/* Coluna 2: Negócio */}
        <div className="space-y-1.5">
          <div>
            <span className="text-xs text-muted-foreground">Valor:</span>
            <p className="font-bold text-primary">
              R$ {(deal.value || 0).toLocaleString('pt-BR')}
            </p>
          </div>
          
          <div>
            <span className="text-xs text-muted-foreground">Produto:</span>
            <p className="text-foreground text-xs">{productName}</p>
          </div>
          
          <div>
            <span className="text-xs text-muted-foreground">Origem:</span>
            <p className="text-foreground text-xs truncate">{originName}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
