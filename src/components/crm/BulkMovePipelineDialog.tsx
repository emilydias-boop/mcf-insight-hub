import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Loader2, FolderOutput } from 'lucide-react';
import { useCRMOrigins, useCRMStages } from '@/hooks/useCRMData';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface BulkMovePipelineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDealIds: string[];
  onSuccess: () => void;
}

export const BulkMovePipelineDialog = ({
  open,
  onOpenChange,
  selectedDealIds,
  onSuccess,
}: BulkMovePipelineDialogProps) => {
  const [selectedOriginId, setSelectedOriginId] = useState('');
  const [selectedStageId, setSelectedStageId] = useState('');
  const [isMoving, setIsMoving] = useState(false);

  const { data: origins } = useCRMOrigins();
  const { data: stages } = useCRMStages(selectedOriginId || undefined);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!open) {
      setSelectedOriginId('');
      setSelectedStageId('');
    }
  }, [open]);

  useEffect(() => {
    setSelectedStageId('');
  }, [selectedOriginId]);

  const flatOrigins = origins?.flatMap(group => {
    if (group.children && group.children.length > 0) {
      return group.children.map((child: any) => ({
        id: child.id,
        name: `${group.name} › ${child.name}`,
      }));
    }
    return [{ id: group.id, name: group.name }];
  }) || [];

  const handleMove = async () => {
    if (!selectedOriginId || !selectedStageId || selectedDealIds.length === 0) return;

    const INSIDE_SALES_ORIGIN_ID = 'e3c04f21-ba2c-4c66-84f8-b4341c826b1c';

    setIsMoving(true);
    let moved = 0;
    let updated = 0;
    let errors = 0;
    let blocked = 0;

    try {
      for (const dealId of selectedDealIds) {
        // 1. Fetch source deal data
        const { data: sourceDeal } = await supabase
          .from('crm_deals')
          .select('contact_id, tags, custom_fields, name, origin_id')
          .eq('id', dealId)
          .single();

        if (!sourceDeal) {
          errors++;
          continue;
        }

        // TRAVA A010: Bloquear movimentação de compradores A010 para fora de Inside Sales
        if (selectedOriginId !== INSIDE_SALES_ORIGIN_ID) {
          // Buscar email do contato
          const { data: contactData } = await supabase
            .from('crm_contacts')
            .select('email, phone')
            .eq('id', sourceDeal.contact_id)
            .single();

          if (contactData?.email) {
            const { data: a010Check } = await supabase
              .from('hubla_transactions')
              .select('id')
              .eq('product_category', 'a010')
              .eq('sale_status', 'completed')
              .ilike('customer_email', contactData.email.toLowerCase())
              .limit(1);

            if (a010Check && a010Check.length > 0) {
              blocked++;
              continue;
            }
          }

          // Fallback: check por telefone
          if (contactData?.phone) {
            const phoneSuffix = contactData.phone.replace(/\D/g, '').slice(-9);
            if (phoneSuffix.length === 9) {
              const { data: a010PhoneCheck } = await supabase
                .from('hubla_transactions')
                .select('id')
                .eq('product_category', 'a010')
                .eq('sale_status', 'completed')
                .ilike('customer_phone', `%${phoneSuffix}`)
                .limit(1);

              if (a010PhoneCheck && a010PhoneCheck.length > 0) {
                blocked++;
                continue;
              }
            }
          }
        }

        // 2. Try normal move
        const { error } = await supabase
          .from('crm_deals')
          .update({ origin_id: selectedOriginId, stage_id: selectedStageId })
          .eq('id', dealId);

        if (error) {
          if (error.message?.includes('crm_deals_contact_origin_unique')) {
            // 3. Find existing deal in target pipeline
            const { data: existingDeal } = await supabase
              .from('crm_deals')
              .select('id, tags, custom_fields')
              .eq('contact_id', sourceDeal.contact_id)
              .eq('origin_id', selectedOriginId)
              .single();

            if (existingDeal) {
              // 4. Merge tags (union) and custom_fields (source overwrites)
              const mergedTags = Array.from(new Set([
                ...((existingDeal.tags as string[]) || []),
                ...((sourceDeal.tags as string[]) || []),
              ]));
              const mergedCustomFields = {
                ...((existingDeal.custom_fields as Record<string, any>) || {}),
                ...((sourceDeal.custom_fields as Record<string, any>) || {}),
              };

              const { error: updateError } = await supabase
                .from('crm_deals')
                .update({
                  stage_id: selectedStageId,
                  tags: mergedTags,
                  custom_fields: mergedCustomFields,
                  name: sourceDeal.name || undefined,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', existingDeal.id);

              if (updateError) {
                console.error('Erro ao atualizar deal existente:', updateError);
                errors++;
              } else {
                // Remover o deal de origem para não ficar duplicado
                await supabase
                  .from('crm_deals')
                  .delete()
                  .eq('id', dealId);
                updated++;
              }
            } else {
              errors++;
            }
          } else {
            console.error('Erro ao mover deal:', dealId, error);
            errors++;
          }
        } else {
          moved++;
        }
      }

      if (moved > 0 || updated > 0) {
        const parts: string[] = [];
        if (moved > 0) parts.push(`${moved} movido(s)`);
        if (updated > 0) parts.push(`${updated} atualizado(s)`);
        toast.success(parts.join(', '));
      }
      if (blocked > 0) {
        toast.warning(`${blocked} lead(s) A010 bloqueado(s) — compradores A010 devem ficar na Inside Sales`);
      }
      if (errors > 0) {
        toast.warning(`${errors} lead(s) com erro ao mover`);
      }

      queryClient.invalidateQueries({ queryKey: ['crm-deals'] });
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      console.error('Erro ao mover deals:', err);
      toast.error('Erro ao mover leads. Tente novamente.');
    } finally {
      setIsMoving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOutput className="h-5 w-5" />
            Mover para outra Pipeline
          </DialogTitle>
          <DialogDescription>
            Mover {selectedDealIds.length} lead(s) para uma pipeline diferente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Pipeline destino</Label>
            <Select value={selectedOriginId} onValueChange={setSelectedOriginId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a pipeline..." />
              </SelectTrigger>
              <SelectContent>
                {flatOrigins.map((origin: any) => (
                  <SelectItem key={origin.id} value={origin.id}>
                    {origin.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedOriginId && (
            <div className="space-y-2">
              <Label>Estágio destino</Label>
              <Select value={selectedStageId} onValueChange={setSelectedStageId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o estágio..." />
                </SelectTrigger>
                <SelectContent>
                  {stages?.map((stage: any) => (
                    <SelectItem key={stage.id} value={stage.id}>
                      {stage.stage_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isMoving}>
            Cancelar
          </Button>
          <Button onClick={handleMove} disabled={!selectedOriginId || !selectedStageId || isMoving}>
            {isMoving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Movendo...
              </>
            ) : (
              `Mover ${selectedDealIds.length} lead(s)`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
