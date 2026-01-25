import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { X, Copy, Check } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  useWebhookEndpoints,
  useCreateWebhookEndpoint,
  useUpdateWebhookEndpoint,
  getWebhookUrl,
} from '@/hooks/useWebhookEndpoints';
import { useState } from 'react';
import { toast } from 'sonner';

const formSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  slug: z.string()
    .min(1, 'Slug é obrigatório')
    .regex(/^[a-z0-9-]+$/, 'Slug deve conter apenas letras minúsculas, números e hífens'),
  description: z.string().optional(),
  stage_id: z.string().optional(),
  auto_tags: z.array(z.string()).default([]),
  required_fields: z.array(z.string()).default(['name', 'email']),
  auth_header_name: z.string().optional(),
  auth_header_value: z.string().optional(),
  is_active: z.boolean().default(true),
});

type FormValues = z.infer<typeof formSchema>;

interface IncomingWebhookFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  originId: string;
  endpointId?: string | null;
}

export const IncomingWebhookFormDialog = ({
  open,
  onOpenChange,
  originId,
  endpointId,
}: IncomingWebhookFormDialogProps) => {
  const [tagInput, setTagInput] = useState('');
  const [copied, setCopied] = useState(false);

  const { data: endpoints } = useWebhookEndpoints(originId);
  const createMutation = useCreateWebhookEndpoint();
  const updateMutation = useUpdateWebhookEndpoint();

  const isEditing = !!endpointId;
  const endpoint = endpoints?.find((e) => e.id === endpointId);

  // Fetch stages for this origin
  const { data: stages } = useQuery({
    queryKey: ['crm-stages', originId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_stages')
        .select('id, stage_name, stage_order')
        .eq('origin_id', originId)
        .order('stage_order');
      if (error) throw error;
      return data;
    },
    enabled: !!originId,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      slug: '',
      description: '',
      stage_id: '',
      auto_tags: [],
      required_fields: ['name', 'email'],
      auth_header_name: '',
      auth_header_value: '',
      is_active: true,
    },
  });

  // Reset form when opening or changing endpoint
  useEffect(() => {
    if (open) {
      if (endpoint) {
        form.reset({
          name: endpoint.name,
          slug: endpoint.slug,
          description: endpoint.description || '',
          stage_id: endpoint.stage_id || '',
          auto_tags: endpoint.auto_tags || [],
          required_fields: endpoint.required_fields || ['name', 'email'],
          auth_header_name: endpoint.auth_header_name || '',
          auth_header_value: endpoint.auth_header_value || '',
          is_active: endpoint.is_active,
        });
      } else {
        form.reset({
          name: '',
          slug: '',
          description: '',
          stage_id: stages?.[0]?.id || '',
          auto_tags: [],
          required_fields: ['name', 'email'],
          auth_header_name: '',
          auth_header_value: '',
          is_active: true,
        });
      }
    }
  }, [open, endpoint, stages, form]);

  // Auto-generate slug from name
  const nameValue = form.watch('name');
  useEffect(() => {
    if (!isEditing && nameValue) {
      const slug = nameValue
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      form.setValue('slug', slug);
    }
  }, [nameValue, isEditing, form]);

  const slugValue = form.watch('slug');
  const webhookUrl = slugValue ? getWebhookUrl(slugValue) : '';

  const handleCopyUrl = async () => {
    if (webhookUrl) {
      await navigator.clipboard.writeText(webhookUrl);
      setCopied(true);
      toast.success('URL copiada!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const addTag = () => {
    const tag = tagInput.trim();
    if (tag && !form.getValues('auto_tags').includes(tag)) {
      form.setValue('auto_tags', [...form.getValues('auto_tags'), tag]);
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    form.setValue(
      'auto_tags',
      form.getValues('auto_tags').filter((t) => t !== tagToRemove)
    );
  };

  const onSubmit = async (values: FormValues) => {
    try {
      if (isEditing && endpointId) {
        await updateMutation.mutateAsync({
          id: endpointId,
          name: values.name,
          slug: values.slug,
          description: values.description || null,
          stage_id: values.stage_id || null,
          auto_tags: values.auto_tags,
          required_fields: values.required_fields,
          auth_header_name: values.auth_header_name || null,
          auth_header_value: values.auth_header_value || null,
          is_active: values.is_active,
        });
      } else {
        await createMutation.mutateAsync({
          name: values.name,
          slug: values.slug,
          description: values.description,
          origin_id: originId,
          stage_id: values.stage_id,
          auto_tags: values.auto_tags,
          required_fields: values.required_fields,
          auth_header_name: values.auth_header_name,
          auth_header_value: values.auth_header_value,
          is_active: values.is_active,
        });
      }
      onOpenChange(false);
    } catch {
      // Error is handled by the mutation
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Editar Webhook de Entrada' : 'Novo Webhook de Entrada'}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Instagram Bio" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="slug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Slug (URL)</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Ex: instagram-bio" 
                      {...field} 
                      disabled={isEditing}
                    />
                  </FormControl>
                  <FormDescription>
                    Identificador único usado na URL do webhook
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {slugValue && (
              <div className="p-3 bg-muted rounded-lg">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground mb-1">URL do Webhook:</p>
                    <code className="text-xs break-all">{webhookUrl}</code>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCopyUrl}
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            )}

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição (opcional)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Descrição do webhook..." 
                      rows={2}
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="stage_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Etapa Inicial</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a etapa inicial" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {stages?.map((stage) => (
                        <SelectItem key={stage.id} value={stage.id}>
                          {stage.stage_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Etapa onde os leads entrarão no funil
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="auto_tags"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tags Automáticas</FormLabel>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Digite uma tag..."
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addTag();
                        }
                      }}
                    />
                    <Button type="button" variant="outline" onClick={addTag}>
                      Adicionar
                    </Button>
                  </div>
                  {field.value.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {field.value.map((tag) => (
                        <Badge key={tag} variant="secondary" className="gap-1">
                          {tag}
                          <X
                            className="h-3 w-3 cursor-pointer"
                            onClick={() => removeTag(tag)}
                          />
                        </Badge>
                      ))}
                    </div>
                  )}
                  <FormDescription>
                    Tags aplicadas automaticamente aos leads recebidos
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="border-t pt-4">
              <h4 className="text-sm font-medium mb-3">Autenticação (opcional)</h4>
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="auth_header_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome do Header</FormLabel>
                      <FormControl>
                        <Input placeholder="X-Webhook-Key" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="auth_header_value"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor do Header</FormLabel>
                      <FormControl>
                        <Input placeholder="sua-chave-secreta" type="password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <FormField
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <FormLabel className="text-base">Ativo</FormLabel>
                    <FormDescription>
                      Webhook receberá leads quando ativo
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {createMutation.isPending || updateMutation.isPending
                  ? 'Salvando...'
                  : isEditing
                  ? 'Salvar'
                  : 'Criar Webhook'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
