import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { CalendarIcon, DollarSign } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
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
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { useCreateClintDeal } from '@/hooks/useClintAPI';
import { useDealStages } from '@/hooks/useDealStages';
import { useClintOrigins, useClintUsers } from '@/hooks/useClintAPI';
import { useStagePermissions } from '@/hooks/useStagePermissions';
import { useCreateDealActivity } from '@/hooks/useDealActivities';
import { useAuth } from '@/contexts/AuthContext';
import { ContactSelector } from './ContactSelector';
import { TagsSelector } from './TagsSelector';

const dealSchema = z.object({
  name: z.string()
    .min(3, 'Nome deve ter no mínimo 3 caracteres')
    .max(100, 'Nome deve ter no máximo 100 caracteres'),
  value: z.coerce.number()
    .positive('Valor deve ser positivo')
    .min(1, 'Valor mínimo é R$ 1'),
  stage: z.string().min(1, 'Selecione um estágio'),
  probability: z.number()
    .min(0, 'Probabilidade mínima é 0%')
    .max(100, 'Probabilidade máxima é 100%'),
  expected_close_date: z.date().optional(),
  contact_id: z.string().optional(),
  origin_id: z.string().optional(),
  tags: z.array(z.string()).optional(),
  owner_id: z.string().optional(),
  notes: z.string().max(1000, 'Notas devem ter no máximo 1000 caracteres').optional(),
});

type DealFormValues = z.infer<typeof dealSchema>;

interface DealFormDialogProps {
  trigger: React.ReactNode;
  defaultOriginId?: string;
}

export function DealFormDialog({ trigger, defaultOriginId }: DealFormDialogProps) {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  
  const { data: stages = [], isLoading: stagesLoading } = useDealStages();
  const { data: originsResponse } = useClintOrigins();
  const { data: usersResponse } = useClintUsers();
  const { canMoveToStage } = useStagePermissions();
  
  // Extract arrays from API response structure
  const origins = Array.isArray(originsResponse) ? originsResponse : (originsResponse?.data || []);
  const users = Array.isArray(usersResponse) ? usersResponse : (usersResponse?.data || []);
  
  const createDealMutation = useCreateClintDeal();
  const createActivityMutation = useCreateDealActivity();

  const form = useForm<DealFormValues>({
    resolver: zodResolver(dealSchema),
    defaultValues: {
      name: '',
      value: 0,
      stage: '',
      probability: 50,
      origin_id: defaultOriginId || '',
      tags: [],
      owner_id: user?.id || '',
      notes: '',
    },
  });

  const availableStages = stages.filter(stage => canMoveToStage(stage.stage_id));

  const onSubmit = async (data: DealFormValues) => {
    try {
      const payload = {
        name: data.name,
        value: data.value,
        stage: data.stage,
        probability: data.probability,
        expected_close_date: data.expected_close_date?.toISOString(),
        contact_id: data.contact_id,
        owner_id: data.owner_id || user?.id,
        custom_fields: {
          origin_id: data.origin_id,
          tags: data.tags,
          notes: data.notes,
        }
      };

      const newDeal = await createDealMutation.mutateAsync(payload) as any;

      // Registrar atividade no Supabase
      await createActivityMutation.mutateAsync({
        deal_id: newDeal.id,
        activity_type: 'created',
        description: `Negócio "${data.name}" criado`,
        to_stage: data.stage,
        metadata: {
          initial_value: data.value,
          initial_probability: data.probability,
        }
      });

      toast.success('Negócio criado com sucesso! 🎉');
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Criar Novo Negócio</DialogTitle>
          <DialogDescription>
            Preencha os dados do negócio abaixo. Campos com * são obrigatórios.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Nome do Negócio */}
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Nome do Negócio *</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Venda apartamento centro" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Valor */}
              <FormField
                control={form.control}
                name="value"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor *</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="number"
                          placeholder="0.00"
                          className="pl-9"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Estágio Inicial */}
              <FormField
                control={form.control}
                name="stage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estágio Inicial *</FormLabel>
                    <Select
                      disabled={stagesLoading}
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o estágio" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {availableStages
                          .filter(stage => 
                            stage.stage_id && 
                            stage.stage_id.trim() !== '' && 
                            stage.stage_name && 
                            stage.stage_name.trim() !== ''
                          )
                          .map((stage) => (
                            <SelectItem key={stage.stage_id} value={stage.stage_id}>
                              {stage.stage_name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Probabilidade */}
              <FormField
                control={form.control}
                name="probability"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Probabilidade: {field.value}%</FormLabel>
                    <FormControl>
                      <Slider
                        min={0}
                        max={100}
                        step={5}
                        value={[field.value]}
                        onValueChange={(vals) => field.onChange(vals[0])}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Data Prevista */}
              <FormField
                control={form.control}
                name="expected_close_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data Prevista de Fechamento</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              'w-full pl-3 text-left font-normal',
                              !field.value && 'text-muted-foreground'
                            )}
                          >
                            {field.value ? (
                              format(field.value, 'PPP', { locale: ptBR })
                            ) : (
                              <span>Selecione uma data</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) => date < new Date()}
                          initialFocus
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Contato */}
              <FormField
                control={form.control}
                name="contact_id"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Contato</FormLabel>
                    <FormControl>
                      <ContactSelector
                        value={field.value}
                        onValueChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Origem */}
              <FormField
                control={form.control}
                name="origin_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Origem</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a origem" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {origins
                          .filter(origin => 
                            origin.id && 
                            origin.id.trim() !== '' && 
                            origin.name && 
                            origin.name.trim() !== ''
                          )
                          .map((origin) => (
                            <SelectItem key={origin.id} value={origin.id}>
                              {origin.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Responsável */}
              <FormField
                control={form.control}
                name="owner_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Responsável</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o responsável" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {users
                          .filter(user => 
                            user.id && 
                            user.id.trim() !== '' && 
                            user.name && 
                            user.name.trim() !== ''
                          )
                          .map((user) => (
                            <SelectItem key={user.id} value={user.id}>
                              {user.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Tags */}
              <FormField
                control={form.control}
                name="tags"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Tags</FormLabel>
                    <FormControl>
                      <TagsSelector
                        value={field.value || []}
                        onValueChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Observações */}
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Observações</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Adicione observações sobre este negócio..."
                        className="min-h-[100px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  form.reset();
                  setOpen(false);
                }}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createDealMutation.isPending || createActivityMutation.isPending}
              >
                {createDealMutation.isPending ? 'Criando...' : 'Criar Negócio'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
