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
    <div className="rounded-lg border border-border bg-secondary/30 p-2">
      <h3 className="text-[10px] font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Contato</h3>
      
      {/* Layout inline compacto */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        {/* Nome */}
        {contact?.name && (
          <span className="font-medium text-foreground">{contact.name}</span>
        )}
        
        {/* Email clicável */}
        {contact?.email && (
          <a 
            href={`mailto:${contact.email}`} 
            className="flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors"
          >
            <Mail className="h-3 w-3" />
            <span className="truncate max-w-[180px]">{contact.email}</span>
          </a>
        )}
        
        {/* Telefone editável */}
        <div className="flex items-center gap-1">
          <Phone className="h-3 w-3 text-muted-foreground" />
          {editingPhone ? (
            <div className="flex items-center gap-1">
              <Input
                value={phoneValue}
                onChange={(e) => setPhoneValue(e.target.value)}
                placeholder="+5511999990001"
                className="h-6 w-32 text-xs bg-background"
              />
              <Button
                size="icon"
                variant="ghost"
                className="h-5 w-5 text-primary hover:text-primary/80"
                onClick={handleSavePhone}
                disabled={updateContact.isPending}
              >
                <Check className="h-3 w-3" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-5 w-5 text-destructive hover:text-destructive/80"
                onClick={handleCancelEditPhone}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">
                {contact?.phone || 'Sem telefone'}
              </span>
              <Button
                size="icon"
                variant="ghost"
                className="h-5 w-5"
                onClick={handleStartEditPhone}
              >
                <Edit2 className="h-2.5 w-2.5" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
