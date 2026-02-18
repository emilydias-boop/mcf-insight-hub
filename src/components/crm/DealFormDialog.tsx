import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCreateCRMDeal, useCRMStages } from '@/hooks/useCRMData';
import { useCreateDealActivity } from '@/hooks/useDealActivities';
import { useActiveBU } from '@/hooks/useActiveBU';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

const dealSchema = z.object({
  name: z.string()
    .min(3, 'Nome deve ter no mínimo 3 caracteres')
    .max(100, 'Nome deve ter no máximo 100 caracteres'),
  value: z.coerce.number()
    .min(0, 'Valor mínimo é R$ 0'),
  stage: z.string().min(1, 'Selecione um estágio'),
  contact_name: z.string().min(2, 'Nome do lead é obrigatório'),
  contact_email: z.string().email('Email inválido').optional().or(z.literal('')),
  contact_phone: z.string().optional(),
  owner_id: z.string().optional(),
  notes: z.string().max(1000).optional(),
});

type DealFormValues = z.infer<typeof dealSchema>;

interface DealFormDialogProps {
  trigger: React.ReactNode;
  defaultOriginId?: string;
  defaultOriginName?: string;
}

export function DealFormDialog({ 
  trigger, 
  defaultOriginId,
  defaultOriginName 
}: DealFormDialogProps) {
  const [open, setOpen] = useState(false);
  const createDealMutation = useCreateCRMDeal();
  const createActivityMutation = useCreateDealActivity();
  const activeBU = useActiveBU();

  // Use the unified useCRMStages hook - only enabled when dialog is open
  // This prevents cache pollution with the Kanban's stages query
  const { data: pipelineStages = [] } = useCRMStages(defaultOriginId, {
    enabled: open && !!defaultOriginId,
  });

  // Fallback to global stages if pipeline has none (for legacy origins)
  const { data: globalStages = [] } = useQuery({
    queryKey: ['deal-form-global-stages'],
    queryFn: async () => {
      const { data } = await supabase
        .from('crm_stages')
        .select('*')
        .is('origin_id', null)
        .eq('is_active', true)
        .order('stage_order');
      return data || [];
    },
    enabled: open && pipelineStages.length === 0,
  });

  // Use pipeline stages if available, otherwise fall back to global
  const stages = pipelineStages.length > 0 ? pipelineStages : globalStages;

  // Fetch SDRs/Closers filtered by active BU squad
  const { data: dealOwners = [] } = useQuery({
    queryKey: ['deal-owners-by-bu', activeBU],
    queryFn: async () => {
      // 1. Buscar profiles do squad da BU ativa (ou todos SDRs como fallback)
      let profilesQuery = supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('access_status', 'ativo')
        .order('full_name');

      if (activeBU) {
        profilesQuery = profilesQuery.contains('squad', [activeBU]);
      }

      const { data: profiles, error: profilesError } = await profilesQuery;
      if (profilesError || !profiles || profiles.length === 0) return [];

      const profileIds = profiles.map(p => p.id);

      // 2. Buscar roles sdr/closer desses profiles
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', profileIds)
        .in('role', ['sdr', 'closer']);

      if (rolesError) return [];

      // 3. Retornar apenas profiles que tenham role relevante
      const validUserIds = new Set((roles || []).map(r => r.user_id));
      return profiles.filter(p => validUserIds.has(p.id));
    },
    enabled: open,
  });

  const form = useForm<DealFormValues>({
    resolver: zodResolver(dealSchema),
    defaultValues: {
      name: '',
      value: 0,
      stage: '',
      contact_name: '',
      contact_email: '',
      contact_phone: '',
      owner_id: '',
      notes: '',
    },
  });

  const onSubmit = async (data: DealFormValues) => {
    try {
      // 1. Create contact first
      const { data: newContact, error: contactError } = await supabase
        .from('crm_contacts')
        .insert({
          clint_id: `local-${Date.now()}`,
          name: data.contact_name,
          email: data.contact_email || null,
          phone: data.contact_phone || null,
          origin_id: defaultOriginId,
        })
        .select()
        .single();
      
      if (contactError) throw contactError;

      // 2. Create deal linked to contact
      // Buscar email do profile selecionado para manter owner_id (legacy)
      const selectedProfile = dealOwners.find((p: any) => p.id === data.owner_id);
      
      const payload = {
        name: data.name,
        value: data.value,
        stage_id: data.stage,
        contact_id: newContact.id,
        origin_id: defaultOriginId,
        owner_id: selectedProfile?.email || undefined, // legacy (email)
        owner_profile_id: data.owner_id || undefined,  // novo (UUID)
        clint_id: `local-${Date.now()}`,  // ID local para deals criados manualmente
        data_source: 'manual',             // Indica criação manual (não webhook/CSV)
      };

      const newDeal = await createDealMutation.mutateAsync(payload);

      // 3. Log activity
      if (newDeal) {
        await createActivityMutation.mutateAsync({
          deal_id: newDeal.id,
          activity_type: 'deal_created',
          description: `Negócio "${data.name}" criado`,
          metadata: {
            value: data.value,
            notes: data.notes,
          },
        });
      }

      toast.success(`Negócio "${data.contact_name}" criado com sucesso!`);
      form.reset();
      setOpen(false);
    } catch (error) {
      console.error('Error creating deal:', error);
      toast.error('Erro ao criar negócio. Tente novamente.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Criar Novo Negócio</DialogTitle>
          <DialogDescription>
            Adicione um novo lead ao pipeline
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Origem (read-only) */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Origem</label>
              <div className="flex items-center h-10 px-3 border rounded-md bg-muted">
                <span className="text-sm text-muted-foreground">
                  {defaultOriginName || 'Pipeline selecionada'}
                </span>
              </div>
            </div>

            {/* Estágio Inicial */}
            <FormField
              control={form.control}
              name="stage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Etapa *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a etapa inicial" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {stages.map((stage: any) => (
                        <SelectItem key={stage.id} value={stage.id}>
                          {stage.stage_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Responsável (SDRs apenas) */}
            <FormField
              control={form.control}
              name="owner_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Dono do negócio</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o responsável" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {dealOwners.map((user: any) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Valor do Negócio */}
            <FormField
              control={form.control}
              name="value"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Valor do negócio</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="R$ 0,00"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Nome do Lead */}
            <FormField
              control={form.control}
              name="contact_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome do Lead *</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: João Silva" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Nome do Negócio */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome do Negócio *</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Consórcio Imóvel" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Email e Telefone */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="contact_email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input 
                        type="email" 
                        placeholder="email@exemplo.com" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contact_phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefone</FormLabel>
                    <FormControl>
                      <Input placeholder="(11) 99999-9999" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Observações */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Adicione observações sobre o negócio..."
                      className="resize-none"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Botões */}
            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createDealMutation.isPending}
              >
                {createDealMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Criando...
                  </>
                ) : (
                  `Criar ${form.watch('contact_name') || 'Negócio'}`
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
