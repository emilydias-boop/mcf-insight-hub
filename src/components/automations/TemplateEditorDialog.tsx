import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, Save, MessageCircle, Mail, Eye, Plus, Trash2, RefreshCw, Send, Cloud } from "lucide-react";
import {
  useAutomationTemplate,
  useCreateTemplate,
  useUpdateTemplate,
  AutomationTemplate,
  TemplateButton,
  ApprovalStatus,
  TemplateBU,
} from "@/hooks/useAutomationTemplates";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useCreateTwilioContent,
  useSubmitTwilioContent,
  useRefreshTwilioContent,
} from "@/hooks/useTwilioContent";
import { TemplatePreview } from "./TemplatePreview";

interface TemplateEditorDialogProps {
  templateId: string | null;
  defaultChannel?: 'whatsapp' | 'email';
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const AVAILABLE_VARIABLES = ['nome', 'sdr', 'data', 'link', 'produto', 'empresa', 'telefone', 'email'];

const BU_LABELS: Record<TemplateBU, string> = {
  incorporador: 'Incorporador',
  consorcio: 'Consórcio',
  credito: 'Crédito',
  projetos: 'Projetos',
  leilao: 'Leilão',
  marketing: 'Marketing',
};
const ALL_BUS: TemplateBU[] = ['incorporador', 'consorcio', 'credito', 'projetos', 'leilao', 'marketing'];

const STATUS_LABEL: Record<ApprovalStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { label: 'Rascunho', variant: 'outline' },
  pending: { label: 'Aguardando Meta', variant: 'secondary' },
  approved: { label: 'Aprovado', variant: 'default' },
  rejected: { label: 'Rejeitado', variant: 'destructive' },
  paused: { label: 'Pausado', variant: 'destructive' },
  disabled: { label: 'Desativado', variant: 'destructive' },
  unknown: { label: 'Desconhecido', variant: 'outline' },
};

export function TemplateEditorDialog({ templateId, defaultChannel = 'whatsapp', open, onOpenChange }: TemplateEditorDialogProps) {
  const isEditing = !!templateId;
  const { data: template, isLoading } = useAutomationTemplate(templateId);
  
  const createTemplate = useCreateTemplate();
  const updateTemplate = useUpdateTemplate();
  const createTwilio = useCreateTwilioContent();
  const submitTwilio = useSubmitTwilioContent();
  const refreshTwilio = useRefreshTwilioContent();

  // Form state
  const [name, setName] = useState("");
  const [channel, setChannel] = useState<'whatsapp' | 'email'>(defaultChannel);
  const [content, setContent] = useState("");
  const [subject, setSubject] = useState("");
  const [twilioTemplateSid, setTwilioTemplateSid] = useState("");
  const [activecampaignTemplateId, setActivecampaignTemplateId] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const [category, setCategory] = useState<'utility' | 'marketing' | 'authentication'>('utility');
  const [language, setLanguage] = useState('pt_BR');
  const [buttons, setButtons] = useState<TemplateButton[]>([]);
  const [businessUnits, setBusinessUnits] = useState<TemplateBU[]>([]);

  // Reset form when template changes
  useEffect(() => {
    if (template) {
      setName(template.name);
      setChannel(template.channel);
      setContent(template.content);
      setSubject(template.subject || "");
      setTwilioTemplateSid(template.twilio_template_sid || "");
      setActivecampaignTemplateId(template.activecampaign_template_id || "");
      setIsActive(template.is_active);
      setCategory(template.category ?? 'utility');
      setLanguage(template.language ?? 'pt_BR');
      setButtons(template.buttons_config ?? []);
      setBusinessUnits(template.business_units ?? []);
    } else {
      setName("");
      setChannel(defaultChannel);
      setContent("");
      setSubject("");
      setTwilioTemplateSid("");
      setActivecampaignTemplateId("");
      setIsActive(true);
      setCategory('utility');
      setLanguage('pt_BR');
      setButtons([]);
      setBusinessUnits([]);
    }
  }, [template, open, defaultChannel]);

  const approvalStatus: ApprovalStatus = template?.approval_status ?? 'draft';
  const isLocked = channel === 'whatsapp' && approvalStatus !== 'draft' && approvalStatus !== 'rejected';

  const handleSave = async () => {
    // Extract used variables from content
    const usedVariables = AVAILABLE_VARIABLES.filter(v => 
      content.includes(`{{${v}}}`)
    );

    const data: Partial<AutomationTemplate> = {
      name,
      channel,
      content,
      subject: channel === 'email' ? subject : undefined,
      variables: usedVariables,
      twilio_template_sid: channel === 'whatsapp' ? twilioTemplateSid || undefined : undefined,
      activecampaign_template_id: channel === 'email' ? activecampaignTemplateId || undefined : undefined,
      is_active: isActive,
      category: channel === 'whatsapp' ? category : undefined,
      language: channel === 'whatsapp' ? language : undefined,
      buttons_config: channel === 'whatsapp' ? buttons : [],
      business_units: businessUnits,
    };

    if (isEditing && templateId) {
      await updateTemplate.mutateAsync({ id: templateId, ...data });
    } else {
      await createTemplate.mutateAsync(data);
    }
    
    onOpenChange(false);
  };

  const insertVariable = (variable: string) => {
    setContent(prev => prev + `{{${variable}}}`);
  };

  const addButton = () => {
    if (buttons.length >= 3) return;
    setButtons((prev) => [...prev, { type: 'quick_reply', text: '' }]);
  };
  const updateButton = (idx: number, patch: Partial<TemplateButton>) => {
    setButtons((prev) => prev.map((b, i) => (i === idx ? { ...b, ...patch } : b)));
  };
  const removeButton = (idx: number) => setButtons((prev) => prev.filter((_, i) => i !== idx));

  const toggleBU = (bu: TemplateBU) => {
    setBusinessUnits((prev) => (prev.includes(bu) ? prev.filter((b) => b !== bu) : [...prev, bu]));
  };

  const isSaving = createTemplate.isPending || updateTemplate.isPending;
  const isTwilioBusy = createTwilio.isPending || submitTwilio.isPending || refreshTwilio.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar Template" : "Novo Template"}
          </DialogTitle>
          <DialogDescription>
            Crie mensagens reutilizáveis com variáveis dinâmicas
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : showPreview ? (
          <div className="flex-1 overflow-auto">
            <TemplatePreview
              content={content}
              subject={subject}
              channel={channel}
              onBack={() => setShowPreview(false)}
            />
          </div>
        ) : (
          <div className="flex-1 overflow-auto space-y-4">
            {/* Status Meta (apenas WhatsApp + edição) */}
            {isEditing && channel === 'whatsapp' && (
              <div className="flex items-center justify-between rounded-md border p-3 bg-muted/30">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Status Meta:</span>
                  <Badge variant={STATUS_LABEL[approvalStatus].variant}>
                    {STATUS_LABEL[approvalStatus].label}
                  </Badge>
                  {template?.approval_rejected_reason && approvalStatus === 'rejected' && (
                    <span className="text-xs text-destructive ml-2">
                      Motivo: {template.approval_rejected_reason}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {!template?.twilio_template_sid && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => templateId && createTwilio.mutate(templateId)}
                      disabled={isTwilioBusy}
                    >
                      <Cloud className="h-3 w-3 mr-1" />
                      Criar no Twilio
                    </Button>
                  )}
                  {template?.twilio_template_sid && approvalStatus === 'draft' && (
                    <Button
                      size="sm"
                      onClick={() => templateId && submitTwilio.mutate(templateId)}
                      disabled={isTwilioBusy}
                    >
                      <Send className="h-3 w-3 mr-1" />
                      Submeter à Meta
                    </Button>
                  )}
                  {template?.twilio_template_sid && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => templateId && refreshTwilio.mutate(templateId)}
                      disabled={isTwilioBusy}
                    >
                      <RefreshCw className={`h-3 w-3 ${refreshTwilio.isPending ? 'animate-spin' : ''}`} />
                    </Button>
                  )}
                </div>
              </div>
            )}

            {isLocked && (
              <p className="text-xs text-muted-foreground bg-amber-500/10 border border-amber-500/30 rounded p-2">
                Conteúdo congelado: a Meta não permite alterar templates após aprovação. Crie um novo template para mudar a mensagem.
              </p>
            )}

            {/* Basic Info */}
            <div className="space-y-2">
              <Label htmlFor="name">Nome do Template *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Boas-vindas Reunião Agendada"
              />
            </div>

            {/* Business Units Scope */}
            <div className="space-y-2">
              <Label>Escopo de Business Unit</Label>
              <p className="text-xs text-muted-foreground">
                Selecione as BUs onde este template pode ser usado. Nenhuma selecionada = <strong>Global</strong> (disponível para todas).
              </p>
              <div className="flex flex-wrap gap-1">
                <Badge
                  variant={businessUnits.length === 0 ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => setBusinessUnits([])}
                >
                  Global
                </Badge>
                {ALL_BUS.map((bu) => (
                  <Badge
                    key={bu}
                    variant={businessUnits.includes(bu) ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => toggleBU(bu)}
                  >
                    {BU_LABELS[bu]}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Channel Selection */}
            <div className="space-y-2">
              <Label>Canal</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={channel === 'whatsapp' ? 'default' : 'outline'}
                  className="justify-start"
                  onClick={() => setChannel('whatsapp')}
                  disabled={isEditing}
                >
                  <MessageCircle className="h-4 w-4 mr-2 text-green-600" />
                  WhatsApp
                </Button>
                <Button
                  type="button"
                  variant={channel === 'email' ? 'default' : 'outline'}
                  className="justify-start"
                  onClick={() => setChannel('email')}
                  disabled={isEditing}
                >
                  <Mail className="h-4 w-4 mr-2 text-blue-600" />
                  Email
                </Button>
              </div>
            </div>

            {/* Subject (Email only) */}
            {channel === 'email' && (
              <div className="space-y-2">
                <Label htmlFor="subject">Assunto do Email *</Label>
                <Input
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Ex: {{nome}}, sua reunião está confirmada!"
                />
              </div>
            )}

            {/* Content */}
            <div className="space-y-2">
              <Label htmlFor="content">Conteúdo da Mensagem *</Label>
              <Textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Olá {{nome}}, sua reunião foi agendada para {{data}}..."
                rows={6}
                className="font-mono text-sm"
                disabled={isLocked}
              />
            </div>

            {/* Variables */}
            <div className="space-y-2">
              <Label>Variáveis Disponíveis</Label>
              <div className="flex flex-wrap gap-1">
                {AVAILABLE_VARIABLES.map((variable) => (
                  <Badge
                    key={variable}
                    variant="outline"
                    className="cursor-pointer hover:bg-accent"
                    onClick={() => insertVariable(variable)}
                  >
                    {`{{${variable}}}`}
                  </Badge>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Clique em uma variável para inserir no conteúdo
              </p>
            </div>

            <Separator />

            {/* Twilio: categoria, idioma e botões (apenas WhatsApp) */}
            {channel === 'whatsapp' && (
              <div className="space-y-4">
                <h4 className="font-medium text-sm">Configuração WhatsApp / Meta</h4>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Categoria</Label>
                    <Select value={category} onValueChange={(v) => setCategory(v as typeof category)} disabled={isLocked}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="utility">Utility (notificações, lembretes)</SelectItem>
                        <SelectItem value="marketing">Marketing (promoções)</SelectItem>
                        <SelectItem value="authentication">Authentication (códigos)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Idioma</Label>
                    <Input value={language} onChange={(e) => setLanguage(e.target.value)} disabled={isLocked} />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Botões interativos (até 3)</Label>
                    <Button type="button" size="sm" variant="outline" onClick={addButton} disabled={isLocked || buttons.length >= 3}>
                      <Plus className="h-3 w-3 mr-1" /> Adicionar
                    </Button>
                  </div>
                  {buttons.length === 0 && (
                    <p className="text-xs text-muted-foreground">Sem botões — mensagem será texto puro.</p>
                  )}
                  {buttons.map((b, idx) => (
                    <div key={idx} className="grid grid-cols-[110px_1fr_auto] gap-2 items-end border rounded p-2">
                      <div>
                        <Label className="text-xs">Tipo</Label>
                        <Select
                          value={b.type}
                          onValueChange={(v) => updateButton(idx, { type: v as TemplateButton['type'] })}
                          disabled={isLocked}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="quick_reply">Quick Reply</SelectItem>
                            <SelectItem value="url">URL</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Texto do botão</Label>
                        <Input value={b.text} onChange={(e) => updateButton(idx, { text: e.target.value })} disabled={isLocked} />
                        {b.type === 'url' && (
                          <Input
                            placeholder="https://exemplo.com (use {{1}} para variável)"
                            value={b.url ?? ''}
                            onChange={(e) => updateButton(idx, { url: e.target.value })}
                            disabled={isLocked}
                          />
                        )}
                      </div>
                      <Button type="button" size="icon" variant="ghost" onClick={() => removeButton(idx)} disabled={isLocked}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Separator />

            {/* External IDs */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm">Configurações Avançadas</h4>
              
              {channel === 'whatsapp' && (
                <div className="space-y-2">
                  <Label htmlFor="twilioSid">Twilio Content SID</Label>
                  <Input
                    id="twilioSid"
                    value={twilioTemplateSid}
                    onChange={(e) => setTwilioTemplateSid(e.target.value)}
                    placeholder="HXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    disabled={!!template?.twilio_template_sid}
                  />
                  <p className="text-xs text-muted-foreground">
                    Preenchido automaticamente após "Criar no Twilio". Cole manualmente apenas se já existir no Console.
                  </p>
                </div>
              )}

              {channel === 'email' && (
                <div className="space-y-2">
                  <Label htmlFor="activecampaignId">ActiveCampaign Template ID (opcional)</Label>
                  <Input
                    id="activecampaignId"
                    value={activecampaignTemplateId}
                    onChange={(e) => setActivecampaignTemplateId(e.target.value)}
                    placeholder="12345"
                  />
                  <p className="text-xs text-muted-foreground">
                    Informe o ID de um template existente no ActiveCampaign
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between">
                <Label htmlFor="isActive">Template ativo</Label>
                <Switch
                  id="isActive"
                  checked={isActive}
                  onCheckedChange={setIsActive}
                />
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-between gap-2 pt-4 border-t">
          <Button 
            variant="outline" 
            onClick={() => showPreview ? setShowPreview(false) : setShowPreview(true)}
            disabled={!content}
          >
            <Eye className="h-4 w-4 mr-2" />
            {showPreview ? "Voltar" : "Preview"}
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={!name || !content || isSaving}>
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {isEditing ? "Salvar" : "Criar Template"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
