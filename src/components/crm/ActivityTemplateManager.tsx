import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Phone, Mail, Calendar, MessageSquare, MoreHorizontal, Plus, Pencil, Trash2, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  useAllActivityTemplates,
  useCreateActivityTemplate,
  useUpdateActivityTemplate,
  useDeleteActivityTemplate,
  ActivityTemplate,
} from '@/hooks/useActivityTemplates';
import { useCRMOrigins, useCRMStages } from '@/hooks/useCRMData';
import { ScrollArea } from '@/components/ui/scroll-area';

const typeIcons: Record<string, React.ElementType> = {
  call: Phone,
  email: Mail,
  meeting: Calendar,
  whatsapp: MessageSquare,
  other: MoreHorizontal,
};

const typeLabels: Record<string, string> = {
  call: 'Ligação',
  email: 'E-mail',
  meeting: 'Reunião',
  whatsapp: 'WhatsApp',
  other: 'Outro',
};

const formSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  description: z.string().optional(),
  type: z.enum(['call', 'email', 'meeting', 'whatsapp', 'other']),
  origin_id: z.string().optional(),
  stage_id: z.string().optional(),
  sla_offset_minutes: z.coerce.number().min(0).optional(),
  script_title: z.string().optional(),
  script_body: z.string().optional(),
  order_index: z.coerce.number().default(0),
  is_active: z.boolean().default(true),
});

type FormValues = z.infer<typeof formSchema>;

export function ActivityTemplateManager() {
  const { data: templates, isLoading } = useAllActivityTemplates();
  const { data: origins } = useCRMOrigins();
  const [selectedOriginId, setSelectedOriginId] = useState<string | undefined>();
  const { data: stages } = useCRMStages(selectedOriginId);
  
  const createTemplate = useCreateActivityTemplate();
  const updateTemplate = useUpdateActivityTemplate();
  const deleteTemplate = useDeleteActivityTemplate();
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ActivityTemplate | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      description: '',
      type: 'call',
      origin_id: '',
      stage_id: '',
      sla_offset_minutes: 60,
      script_title: '',
      script_body: '',
      order_index: 0,
      is_active: true,
    },
  });

  const openCreateDialog = () => {
    setEditingTemplate(null);
    form.reset({
      name: '',
      description: '',
      type: 'call',
      origin_id: '',
      stage_id: '',
      sla_offset_minutes: 60,
      script_title: '',
      script_body: '',
      order_index: (templates?.length || 0) + 1,
      is_active: true,
    });
    setSelectedOriginId(undefined);
    setDialogOpen(true);
  };

  const openEditDialog = (template: ActivityTemplate) => {
    setEditingTemplate(template);
    setSelectedOriginId(template.origin_id || undefined);
    form.reset({
      name: template.name,
      description: template.description || '',
      type: template.type,
      origin_id: template.origin_id || '',
      stage_id: template.stage_id || '',
      sla_offset_minutes: template.sla_offset_minutes || 60,
      script_title: template.script_title || '',
      script_body: template.script_body || '',
      order_index: template.order_index,
      is_active: template.is_active ?? true,
    });
    setDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Tem certeza que deseja desativar este template?')) {
      deleteTemplate.mutate(id);
    }
  };

  const onSubmit = (values: FormValues) => {
    const data = {
      ...values,
      origin_id: values.origin_id || null,
      stage_id: values.stage_id || null,
      description: values.description || null,
      script_title: values.script_title || null,
      script_body: values.script_body || null,
      sla_offset_minutes: values.sla_offset_minutes || null,
    };

    if (editingTemplate) {
      updateTemplate.mutate({ id: editingTemplate.id, ...data }, {
        onSuccess: () => setDialogOpen(false),
      });
    } else {
      createTemplate.mutate(data as any, {
        onSuccess: () => setDialogOpen(false),
      });
    }
  };

  const activeTemplates = templates?.filter(t => t.is_active) || [];
  const inactiveTemplates = templates?.filter(t => !t.is_active) || [];

  const getOriginName = (originId: string | null) => {
    if (!originId) return 'Todos os pipelines';
    return origins?.find(o => o.id === originId)?.name || 'Pipeline desconhecido';
  };

  const getStageName = (stageId: string | null) => {
    if (!stageId) return 'Todos os estágios';
    // Search across all possible stages
    return stages?.find(s => s.id === stageId)?.stage_name || 'Estágio desconhecido';
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Templates de Atividades</CardTitle>
            <CardDescription>
              Configure atividades automáticas por estágio do pipeline
            </CardDescription>
          </div>
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Template
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : activeTemplates.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhum template de atividade configurado
          </p>
        ) : (
          <ScrollArea className="h-[400px]">
            <div className="space-y-2">
              {activeTemplates.map((template) => {
                const Icon = typeIcons[template.type];
                return (
                  <div
                    key={template.id}
                    className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                  >
                    <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{template.name}</span>
                        <Badge variant="secondary" className="text-xs">
                          {typeLabels[template.type]}
                        </Badge>
                        {template.sla_offset_minutes && (
                          <Badge variant="outline" className="text-xs">
                            SLA: {template.sla_offset_minutes}min
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {getOriginName(template.origin_id)} → {getStageName(template.stage_id)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => openEditDialog(template)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(template.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}

        {/* Form Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingTemplate ? 'Editar Template' : 'Novo Template de Atividade'}
              </DialogTitle>
              <DialogDescription>
                Configure uma atividade que será criada automaticamente quando leads entrarem no estágio selecionado
              </DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome da Atividade</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: Tentativa de Ligação 01" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo/Canal</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="call">📞 Ligação</SelectItem>
                            <SelectItem value="whatsapp">💬 WhatsApp</SelectItem>
                            <SelectItem value="email">📧 E-mail</SelectItem>
                            <SelectItem value="meeting">📅 Reunião</SelectItem>
                            <SelectItem value="other">📋 Outro</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="origin_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Pipeline</FormLabel>
                        <Select 
                          onValueChange={(value) => {
                            field.onChange(value);
                            setSelectedOriginId(value || undefined);
                            form.setValue('stage_id', '');
                          }} 
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Todos os pipelines" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="">Todos os pipelines</SelectItem>
                            {origins?.map(origin => (
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

                  <FormField
                    control={form.control}
                    name="stage_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Estágio</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione um estágio" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="">Todos os estágios</SelectItem>
                            {stages?.map(stage => (
                              <SelectItem key={stage.id} value={stage.id}>
                                {stage.stage_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Atividade será criada quando lead entrar neste estágio
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="sla_offset_minutes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>SLA (minutos)</FormLabel>
                        <FormControl>
                          <Input type="number" min={0} placeholder="60" {...field} />
                        </FormControl>
                        <FormDescription>
                          Tempo limite após entrada no estágio
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="order_index"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ordem</FormLabel>
                        <FormControl>
                          <Input type="number" min={0} {...field} />
                        </FormControl>
                        <FormDescription>
                          Ordem de exibição na lista
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="script_title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Título do Script</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Roteiro de Primeira Ligação" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="script_body"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Roteiro/Script</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Digite o roteiro da atividade. Suporta markdown básico:
- Bullets com - ou •
- **Negrito** com asteriscos
- Numeração com 1. 2. 3."
                          className="min-h-[150px] font-mono text-sm"
                          {...field} 
                        />
                      </FormControl>
                      <FormDescription>
                        Este texto será exibido para o SDR durante a execução da atividade
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descrição (opcional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Breve descrição da atividade" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="is_active"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <FormLabel>Template Ativo</FormLabel>
                        <FormDescription>
                          Templates inativos não criam atividades automaticamente
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={createTemplate.isPending || updateTemplate.isPending}>
                    {editingTemplate ? 'Salvar' : 'Criar Template'}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
