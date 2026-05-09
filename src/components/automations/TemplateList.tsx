import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, 
  Pencil, 
  Trash2, 
  MessageCircle, 
  Mail,
  Loader2,
  RefreshCw
} from "lucide-react";
import { useAutomationTemplates, useDeleteTemplate, ApprovalStatus, TemplateBU } from "@/hooks/useAutomationTemplates";
import { useSyncAllTwilioStatus } from "@/hooks/useTwilioContent";
import { TemplateEditorDialog } from "./TemplateEditorDialog";
import { useAuth } from "@/contexts/AuthContext";
import { useMyBU } from "@/hooks/useMyBU";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const STATUS_BADGE: Record<ApprovalStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { label: 'Rascunho', variant: 'outline' },
  pending: { label: 'Aguardando Meta', variant: 'secondary' },
  approved: { label: 'Aprovado', variant: 'default' },
  rejected: { label: 'Rejeitado', variant: 'destructive' },
  paused: { label: 'Pausado', variant: 'destructive' },
  disabled: { label: 'Desativado', variant: 'destructive' },
  unknown: { label: '—', variant: 'outline' },
};

const BU_LABELS: Record<TemplateBU, string> = {
  incorporador: 'Incorporador',
  consorcio: 'Consórcio',
  credito: 'Crédito',
  projetos: 'Projetos',
  leilao: 'Leilão',
  marketing: 'Marketing',
};
const ALL_BUS: TemplateBU[] = ['incorporador', 'consorcio', 'credito', 'projetos', 'leilao', 'marketing'];

export function TemplateList() {
  const { data: templates, isLoading } = useAutomationTemplates();
  const deleteTemplate = useDeleteTemplate();
  const syncAll = useSyncAllTwilioStatus();
  const { hasAnyRole } = useAuth();
  const { data: myBUs = [] } = useMyBU();
  const isAdmin = hasAnyRole('admin', 'manager');
  
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [creatingChannel, setCreatingChannel] = useState<'whatsapp' | 'email'>('whatsapp');
  const [deletingTemplateId, setDeletingTemplateId] = useState<string | null>(null);
  const [buFilter, setBuFilter] = useState<'all' | 'global' | TemplateBU>('all');

  const handleDelete = () => {
    if (deletingTemplateId) {
      deleteTemplate.mutate(deletingTemplateId);
      setDeletingTemplateId(null);
    }
  };

  const handleCreateNew = (channel: 'whatsapp' | 'email') => {
    setCreatingChannel(channel);
    setIsCreating(true);
  };

  // Apply BU filter: explicit dropdown + auto-restrict for non-admins
  const visibleTemplates = useMemo(() => {
    if (!templates) return [];
    return templates.filter((t) => {
      const tBUs = (t.business_units ?? []) as TemplateBU[];
      const isGlobal = tBUs.length === 0;

      // Auto-restrict for non-admins: must be global OR include one of user's BUs
      if (!isAdmin) {
        const allowedByUserBU = isGlobal || tBUs.some((bu) => (myBUs as TemplateBU[]).includes(bu));
        if (!allowedByUserBU) return false;
      }

      // Explicit filter
      if (buFilter === 'all') return true;
      if (buFilter === 'global') return isGlobal;
      return tBUs.includes(buFilter);
    });
  }, [templates, isAdmin, myBUs, buFilter]);

  const whatsappTemplates = visibleTemplates.filter(t => t.channel === 'whatsapp');
  const emailTemplates = visibleTemplates.filter(t => t.channel === 'email');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const renderTemplateCards = (templatesList: typeof templates, channel: 'whatsapp' | 'email') => {
    if (!templatesList || templatesList.length === 0) {
      return (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="rounded-full bg-muted p-4 mb-4">
              {channel === 'whatsapp' ? (
                <MessageCircle className="h-8 w-8 text-muted-foreground" />
              ) : (
                <Mail className="h-8 w-8 text-muted-foreground" />
              )}
            </div>
            <h3 className="text-lg font-medium mb-2">Nenhum template de {channel === 'whatsapp' ? 'WhatsApp' : 'Email'}</h3>
            <p className="text-muted-foreground text-center mb-4">
              Crie templates para usar nos fluxos de automação
            </p>
            <Button onClick={() => handleCreateNew(channel)}>
              <Plus className="h-4 w-4 mr-2" />
              Criar Template
            </Button>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="grid gap-4 md:grid-cols-2">
        {templatesList.map((template) => (
          <Card key={template.id} className={!template.is_active ? "opacity-60" : ""}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  {template.channel === 'whatsapp' ? (
                    <MessageCircle className="h-5 w-5 text-green-600" />
                  ) : (
                    <Mail className="h-5 w-5 text-blue-600" />
                  )}
                  <CardTitle className="text-base">{template.name}</CardTitle>
                </div>
                <div className="flex items-center gap-1">
                  {template.channel === 'whatsapp' && (
                    <Badge variant={STATUS_BADGE[template.approval_status ?? 'draft'].variant}>
                      {STATUS_BADGE[template.approval_status ?? 'draft'].label}
                    </Badge>
                  )}
                  <Badge variant={template.is_active ? "default" : "secondary"}>
                    {template.is_active ? "Ativo" : "Inativo"}
                  </Badge>
                </div>
              </div>
          {/* BU chips */}
          <div className="flex flex-wrap gap-1 mt-2">
            {(template.business_units ?? []).length === 0 ? (
              <Badge variant="outline" className="text-xs">Global</Badge>
            ) : (
              (template.business_units as TemplateBU[]).map((bu) => (
                <Badge key={bu} variant="secondary" className="text-xs">
                  {BU_LABELS[bu]}
                </Badge>
              ))
            )}
          </div>
              {template.subject && (
                <CardDescription className="mt-1">
                  Assunto: {template.subject}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Content Preview */}
              <div className="bg-muted rounded-md p-3 text-sm">
                <p className="line-clamp-3 whitespace-pre-wrap">{template.content}</p>
              </div>

              {/* Variables */}
              {template.variables && template.variables.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {template.variables.map((variable) => (
                    <Badge key={variable} variant="outline" className="text-xs">
                      {`{{${variable}}}`}
                    </Badge>
                  ))}
                </div>
              )}

              {/* External IDs */}
              {(template.twilio_template_sid || template.activecampaign_template_id) && (
                <div className="text-xs text-muted-foreground">
                  {template.twilio_template_sid && (
                    <p>Twilio SID: {template.twilio_template_sid}</p>
                  )}
                  {template.activecampaign_template_id && (
                    <p>ActiveCampaign ID: {template.activecampaign_template_id}</p>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2 pt-2 border-t">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1"
                  onClick={() => setEditingTemplateId(template.id)}
                >
                  <Pencil className="h-3 w-3 mr-1" />
                  Editar
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setDeletingTemplateId(template.id)}
                >
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold">Templates de Mensagem</h2>
          <p className="text-sm text-muted-foreground">
            Crie e gerencie templates para WhatsApp e Email
          </p>
        </div>
      </div>

      <Tabs defaultValue="whatsapp" className="space-y-4">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="whatsapp" className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4" />
              WhatsApp ({whatsappTemplates.length})
            </TabsTrigger>
            <TabsTrigger value="email" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Email ({emailTemplates.length})
            </TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => syncAll.mutate()}
              disabled={syncAll.isPending}
              title="Consulta a Meta sob demanda — atualiza status de todos os templates pendentes"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${syncAll.isPending ? 'animate-spin' : ''}`} />
              Sincronizar status
            </Button>
            <Button onClick={() => handleCreateNew('whatsapp')}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Template
            </Button>
          </div>
        </div>

        <TabsContent value="whatsapp">
          {renderTemplateCards(whatsappTemplates, 'whatsapp')}
        </TabsContent>

        <TabsContent value="email">
          {renderTemplateCards(emailTemplates, 'email')}
        </TabsContent>
      </Tabs>

      {/* Template Editor Dialog */}
      <TemplateEditorDialog
        templateId={editingTemplateId}
        defaultChannel={creatingChannel}
        open={!!editingTemplateId || isCreating}
        onOpenChange={(open) => {
          if (!open) {
            setEditingTemplateId(null);
            setIsCreating(false);
          }
        }}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingTemplateId} onOpenChange={(open) => !open && setDeletingTemplateId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir template?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Fluxos que usam este template deixarão de funcionar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
