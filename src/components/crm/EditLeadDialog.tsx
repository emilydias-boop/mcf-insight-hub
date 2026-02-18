import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useUpdateCRMContact, useUpdateCRMDeal } from '@/hooks/useCRMData';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface EditLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deal: any;
  contact: any;
}

export const EditLeadDialog = ({ open, onOpenChange, deal, contact }: EditLeadDialogProps) => {
  const [formData, setFormData] = useState({
    dealName: '',
    contactName: '',
    email: '',
    phone: '',
    organization_name: '',
  });

  const updateContact = useUpdateCRMContact();
  const updateDeal = useUpdateCRMDeal();
  const isPending = updateContact.isPending || updateDeal.isPending;

  useEffect(() => {
    if (open) {
      setFormData({
        dealName: deal?.name || '',
        contactName: contact?.name || '',
        email: contact?.email || '',
        phone: contact?.phone || '',
        organization_name: contact?.organization_name || '',
      });
    }
  }, [open, deal, contact]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // Update deal name if changed
      if (deal?.id && formData.dealName.trim() !== (deal?.name || '')) {
        await updateDeal.mutateAsync({
          id: deal.id,
          name: formData.dealName.trim(),
        });
      }

      // Update contact fields if contact exists
      if (contact?.id) {
        const contactUpdates: Record<string, any> = { id: contact.id };
        let hasChanges = false;

        if (formData.contactName.trim() !== (contact?.name || '')) {
          contactUpdates.name = formData.contactName.trim();
          hasChanges = true;
        }
        if (formData.email.trim() !== (contact?.email || '')) {
          contactUpdates.email = formData.email.trim() || null;
          hasChanges = true;
        }
        if (formData.phone.trim() !== (contact?.phone || '')) {
          contactUpdates.phone = formData.phone.trim() || null;
          hasChanges = true;
        }
        if (formData.organization_name.trim() !== (contact?.organization_name || '')) {
          contactUpdates.organization_name = formData.organization_name.trim() || null;
          hasChanges = true;
        }

        if (hasChanges) {
          await updateContact.mutateAsync(contactUpdates);
        }
      }

      toast.success('Informações atualizadas');
      onOpenChange(false);
    } catch (error) {
      // Errors already handled by hooks
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Lead</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="dealName">Nome do Negócio</Label>
            <Input
              id="dealName"
              value={formData.dealName}
              onChange={(e) => setFormData(prev => ({ ...prev, dealName: e.target.value }))}
              placeholder="Nome do negócio"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contactName">Nome do Contato</Label>
            <Input
              id="contactName"
              value={formData.contactName}
              onChange={(e) => setFormData(prev => ({ ...prev, contactName: e.target.value }))}
              placeholder="Nome do contato"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              placeholder="email@exemplo.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Telefone</Label>
            <Input
              id="phone"
              value={formData.phone}
              onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
              placeholder="+5511999990001"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="organization">Organização</Label>
            <Input
              id="organization"
              value={formData.organization_name}
              onChange={(e) => setFormData(prev => ({ ...prev, organization_name: e.target.value }))}
              placeholder="Nome da empresa"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
