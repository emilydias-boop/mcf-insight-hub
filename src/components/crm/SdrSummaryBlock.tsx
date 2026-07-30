import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Phone, Mail, Edit2, Check, X, Pencil } from 'lucide-react';
import { useUpdateCRMContact, useCreateCRMContact } from '@/hooks/useCRMData';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { EditLeadDialog } from './EditLeadDialog';
import { describeDuplicatePhoneError } from '@/lib/duplicateContactError';
import { extractPhoneFromDeal } from '@/lib/phoneUtils';

interface SdrSummaryBlockProps {
  deal: any;
  contact: any;
}

export const SdrSummaryBlock = ({ deal, contact }: SdrSummaryBlockProps) => {
  const updateContact = useUpdateCRMContact();
  const createContact = useCreateCRMContact();
  const queryClient = useQueryClient();
  const [editingPhone, setEditingPhone] = useState(false);
  const [phoneValue, setPhoneValue] = useState('');
  const [showEditDialog, setShowEditDialog] = useState(false);
  
  const customFields = deal?.custom_fields as Record<string, any> | null;
  const originName = deal?.crm_origins?.name || customFields?.origem || 'Não informada';
  const productName = deal?.product_name || customFields?.produto || customFields?.product_name || 'A010';

  // Fallback: alguns leads (importados via webhook) têm o telefone só em custom_fields,
  // sem registro em crm_contacts. Mostramos esse número aqui também.
  const displayPhone = contact?.phone || extractPhoneFromDeal(deal, contact) || '';
  
  const handleStartEditPhone = () => {
    setPhoneValue(displayPhone);
    setEditingPhone(true);
  };
  
  const handleSavePhone = async () => {
    if (!phoneValue.trim()) {
      toast.error('Digite um número de telefone');
      setEditingPhone(false);
      return;
    }

    try {
      if (contact?.id) {
        await updateContact.mutateAsync({
          id: contact.id,
          phone: phoneValue
        });
        toast.success('Telefone atualizado');
      } else if (deal?.id) {
        const newContact = await createContact.mutateAsync({
          name: deal.name || 'Contato sem nome',
          phone: phoneValue,
          clint_id: `manual-${Date.now()}`
        });
        await supabase
          .from('crm_deals')
          .update({ contact_id: (newContact as any).id })
          .eq('id', deal.id);
        queryClient.invalidateQueries({ queryKey: ['crm-deal'] });
        queryClient.invalidateQueries({ queryKey: ['crm-contacts'] });
        toast.success('Contato criado e telefone salvo');
      }
      setEditingPhone(false);
    } catch (error) {
      const friendly = await describeDuplicatePhoneError(error);
      if (friendly) {
        toast.error(friendly, {
          description:
            'Use a ficha do lead existente, ou ajuste o número aqui se for outro contato.',
          duration: 8000,
        });
      } else {
        toast.error('Erro ao salvar telefone');
      }
    }
  };
  
  const handleCancelEditPhone = () => {
    setEditingPhone(false);
    setPhoneValue('');
  };
  
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Contato</h3>
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6 text-muted-foreground hover:text-primary"
          onClick={() => setShowEditDialog(true)}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Nome em destaque */}
      {contact?.name && (
        <div className="text-2xl md:text-3xl font-bold text-foreground leading-tight mb-3 break-words">
          {contact.name}
        </div>
      )}

      {/* Layout inline com fonte maior */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-lg">
        {/* Email clicável */}
        {contact?.email && (
          <a
            href={`mailto:${contact.email}`}
            className="flex items-center gap-2 text-foreground/90 hover:text-primary transition-colors"
          >
            <Mail className="h-5 w-5 text-primary" />
            <span className="truncate max-w-[320px] font-semibold">{contact.email}</span>
          </a>
        )}

        {/* Telefone editável */}
        <div className="flex items-center gap-2">
          <Phone className="h-5 w-5 text-primary" />
          {editingPhone ? (
            <div className="flex items-center gap-1">
              <Input
                value={phoneValue}
                onChange={(e) => setPhoneValue(e.target.value)}
                placeholder="+5511999990001"
                className="h-9 w-44 text-base bg-background"
              />
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 text-primary hover:text-primary/80"
                onClick={handleSavePhone}
                disabled={updateContact.isPending}
              >
                <Check className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 text-destructive hover:text-destructive/80"
                onClick={handleCancelEditPhone}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <span className="text-foreground font-semibold text-lg">
                {displayPhone || 'Sem telefone'}
              </span>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                onClick={handleStartEditPhone}
              >
                <Edit2 className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
      </div>
      
      <EditLeadDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        deal={deal}
        contact={contact}
      />
    </div>
  );
};
