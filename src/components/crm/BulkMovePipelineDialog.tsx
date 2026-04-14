import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, FolderOutput, Users, AlertTriangle } from 'lucide-react';
import { useCRMOrigins, useCRMStages } from '@/hooks/useCRMData';
import { useDistributionConfig } from '@/hooks/useLeadDistribution';
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
  const [distributeEqually, setDistributeEqually] = useState(false);
  const [isMoving, setIsMoving] = useState(false);

  const { data: origins } = useCRMOrigins();
  const { data: stages } = useCRMStages(selectedOriginId || undefined);
  const { data: distributionConfig } = useDistributionConfig(selectedOriginId || null);
  const queryClient = useQueryClient();

  const activeSDRs = useMemo(() => {
    return distributionConfig?.filter(c => c.is_active) || [];
  }, [distributionConfig]);

  const leadsPerSDR = activeSDRs.length > 0
    ? Math.floor(selectedDealIds.length / activeSDRs.length)
    : 0;
  const remainder = activeSDRs.length > 0
    ? selectedDealIds.length % activeSDRs.length
    : 0;

  useEffect(() => {
    if (!open) {
      setSelectedOriginId('');
      setSelectedStageId('');
      setDistributeEqually(false);
    }
  }, [open]);

  useEffect(() => {
    setSelectedStageId('');
    setDistributeEqually(false);
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

    // If distributing, resolve profile IDs for SDRs
    let sdrProfiles: { email: string; name: string; profileId: string }[] = [];
    if (distributeEqually && activeSDRs.length > 0) {
      const emails = activeSDRs.map(s => s.user_email);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email, display_name')
        .in('email', emails);

      sdrProfiles = activeSDRs.map(sdr => {
        const profile = profiles?.find((p: any) => p.email === sdr.user_email);
        return {
          email: sdr.user_email,
          name: sdr.user_name || profile?.display_name || sdr.user_email.split('@')[0],
          profileId: profile?.id || '',
        };
      });
    }

    setIsMoving(true);
    let moved = 0;
    let updated = 0;
    let errors = 0;
    let blocked = 0;
    let sdrIndex = 0;

    try {
      for (const dealId of selectedDealIds) {
        const { data: sourceDeal } = await supabase
          .from('crm_deals')
          .select('contact_id, tags, custom_fields, name, origin_id')
          .eq('id', dealId)
          .single();

        if (!sourceDeal) { errors++; continue; }

        // A010 block check
        if (selectedOriginId !== INSIDE_SALES_ORIGIN_ID) {
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
            if (a010Check && a010Check.length > 0) { blocked++; continue; }
          }

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
              if (a010PhoneCheck && a010PhoneCheck.length > 0) { blocked++; continue; }
            }
          }
        }

        // Build update payload
        const updatePayload: Record<string, any> = {
          origin_id: selectedOriginId,
          stage_id: selectedStageId,
        };

        // Round-robin assignment
        if (distributeEqually && sdrProfiles.length > 0) {
          const targetSDR = sdrProfiles[sdrIndex % sdrProfiles.length];
          updatePayload.owner_id = targetSDR.email;
          updatePayload.owner_profile_id = targetSDR.profileId || null;
          sdrIndex++;
        }

        const { error } = await supabase
          .from('crm_deals')
          .update(updatePayload)
          .eq('id', dealId);

        if (error) {
          if (error.message?.includes('crm_deals_contact_origin_unique')) {
            const { data: existingDeal } = await supabase
              .from('crm_deals')
              .select('id, tags, custom_fields')
              .eq('contact_id', sourceDeal.contact_id)
              .eq('origin_id', selectedOriginId)
              .single();

            if (existingDeal) {
              const mergedTags = Array.from(new Set([
                ...((existingDeal.tags as string[]) || []),
                ...((sourceDeal.tags as string[]) || []),
              ]));
              const mergedCustomFields = {
                ...((existingDeal.custom_fields as Record<string, any>) || {}),
                ...((sourceDeal.custom_fields as Record<string, any>) || {}),
              };

              const mergePayload: Record<string, any> = {
                stage_id: selectedStageId,
                tags: mergedTags,
                custom_fields: mergedCustomFields,
                name: sourceDeal.name || undefined,
                updated_at: new Date().toISOString(),
              };

              if (distributeEqually && sdrProfiles.length > 0) {
                const targetSDR = sdrProfiles[(sdrIndex - 1) % sdrProfiles.length];
                mergePayload.owner_id = targetSDR.email;
                mergePayload.owner_profile_id = targetSDR.profileId || null;
              }

              const { error: updateError } = await supabase
                .from('crm_deals')
                .update(mergePayload)
                .eq('id', existingDeal.id);

              if (updateError) {
                console.error('Erro ao atualizar deal existente:', updateError);
                errors++;
              } else {
                await supabase.from('crm_deals').delete().eq('id', dealId);
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
        if (distributeEqually && sdrProfiles.length > 0) {
          parts.push(`distribuídos entre ${sdrProfiles.length} SDRs`);
        }
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

          {selectedOriginId && (
            <div className="space-y-3 pt-2 border-t">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="distribute-equally"
                  checked={distributeEqually}
                  onCheckedChange={(checked) => setDistributeEqually(checked === true)}
                  disabled={activeSDRs.length === 0}
                />
                <label
                  htmlFor="distribute-equally"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-1.5"
                >
                  <Users className="h-4 w-4 text-muted-foreground" />
                  Distribuir igualitariamente entre SDRs
                </label>
              </div>

              {activeSDRs.length === 0 && (
                <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 p-2 rounded">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  Nenhum SDR configurado na pipeline destino
                </div>
              )}

              {distributeEqually && activeSDRs.length > 0 && (
                <div className="bg-muted/50 rounded-md p-3 space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">
                    {selectedDealIds.length} leads → {activeSDRs.length} SDRs (~{leadsPerSDR}{remainder > 0 ? `-${leadsPerSDR + 1}` : ''} cada)
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {activeSDRs.map((sdr, i) => {
                      const count = leadsPerSDR + (i < remainder ? 1 : 0);
                      return (
                        <span key={sdr.id} className="inline-flex items-center gap-1 text-xs bg-background border rounded-full px-2 py-0.5">
                          {sdr.user_name || sdr.user_email.split('@')[0]}
                          <span className="text-muted-foreground">({count})</span>
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
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
