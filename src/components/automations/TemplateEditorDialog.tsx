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
import { Loader2, Save, MessageCircle, Mail, Eye } from "lucide-react";
import { useAutomationTemplate, useCreateTemplate, useUpdateTemplate, AutomationTemplate } from "@/hooks/useAutomationTemplates";
import { TemplatePreview } from "./TemplatePreview";

interface TemplateEditorDialogProps {
  templateId: string | null;
  defaultChannel?: 'whatsapp' | 'email';
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const AVAILABLE_VARIABLES = ['nome', 'sdr', 'data', 'link', 'produto', 'empresa', 'telefone', 'email'];

export function TemplateEditorDialog({ templateId, defaultChannel = 'whatsapp', open, onOpenChange }: TemplateEditorDialogProps) {
  const isEditing = !!templateId;
  const { data: template, isLoading } = useAutomationTemplate(templateId);
  
  const createTemplate = useCreateTemplate();
  const updateTemplate = useUpdateTemplate();

  // Form state
  const [name, setName] = useState("");
  const [channel, setChannel] = useState<'whatsapp' | 'email'>(defaultChannel);
  const [content, setContent] = useState("");
  const [subject, setSubject] = useState("");
  const [twilioTemplateSid, setTwilioTemplateSid] = useState("");
  const [activecampaignTemplateId, setActivecampaignTemplateId] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [showPreview, setShowPreview] = useState(false);

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
    } else {
      setName("");
      setChannel(defaultChannel);
      setContent("");
      setSubject("");
      setTwilioTemplateSid("");
      setActivecampaignTemplateId("");
      setIsActive(true);
    }
  }, [template, open, defaultChannel]);

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

  const isSaving = createTemplate.isPending || updateTemplate.isPending;

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

            {/* External IDs */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm">Configurações Avançadas</h4>
              
              {channel === 'whatsapp' && (
                <div className="space-y-2">
                  <Label htmlFor="twilioSid">Twilio Template SID (opcional)</Label>
                  <Input
                    id="twilioSid"
                    value={twilioTemplateSid}
                    onChange={(e) => setTwilioTemplateSid(e.target.value)}
                    placeholder="HXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  />
                  <p className="text-xs text-muted-foreground">
                    Informe o SID do template aprovado no Twilio para usar templates oficiais do WhatsApp
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
