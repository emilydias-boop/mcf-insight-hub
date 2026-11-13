import { useEffect, useRef, useState } from "react";
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
import { Loader2, Save, MessageCircle, Mail, Eye, Plus, Trash2, Send } from "lucide-react";
import {
  useAutomationTemplate,
  useCreateTemplate,
  useUpdateTemplate,
  AutomationTemplate,
  TemplateButton,
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
  useAutomationTemplatesMeta,
  useVincularTemplateMeta,
} from "@/hooks/useAutomationTemplates";
import {
  slugMeta,
  proximoNomeMeta,
  corpoParaMeta,
  variaveisDoTemplate,
  variaveisDoTexto,
  botoesParaMeta,
  baseUrlVariavel,
  validarParaMeta,
  campoDaEdge,
  lerErroEdge,
  podeEnviarParaMeta,
  statusMetaVisual,
  type ErrosMeta,
} from "@/lib/automationMetaTemplate";
import { rpc, type EstadoWA } from "@/components/marketing/WhatsAppDisparos";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { TemplatePreview } from "./TemplatePreview";

interface TemplateEditorDialogProps {
  templateId: string | null;
  defaultChannel?: 'whatsapp' | 'email';
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const AVAILABLE_VARIABLES = [
  'nome', 'sdr', 'data', 'link', 'produto', 'empresa', 'telefone', 'email',
  'dono_nome', 'dono_telefone', 'dono_link_wa', 'data_hora', 'closer', 'wa_agendar_token',
];

const BU_LABELS: Record<TemplateBU, string> = {
  incorporador: 'Incorporador',
  consorcio: 'Consórcio',
  credito: 'Crédito',
  projetos: 'Projetos',
  leilao: 'Leilão',
  marketing: 'Marketing',
};
const ALL_BUS: TemplateBU[] = ['incorporador', 'consorcio', 'credito', 'projetos', 'leilao', 'marketing'];


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
  const [activecampaignTemplateId, setActivecampaignTemplateId] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const [category, setCategory] = useState<'utility' | 'marketing' | 'authentication'>('utility');
  const [language, setLanguage] = useState('pt_BR');
  const [buttons, setButtons] = useState<TemplateButton[]>([]);
  const [businessUnits, setBusinessUnits] = useState<TemplateBU[]>([]);
  const [nomeMeta, setNomeMeta] = useState("");
  const [nomeMetaEditado, setNomeMetaEditado] = useState(false);
  const [exemplos, setExemplos] = useState<Record<string, string>>({});
  const [exemplosUrl, setExemplosUrl] = useState<Record<number, string>>({});
  const [erros, setErros] = useState<ErrosMeta>({});
  const [enviandoMeta, setEnviandoMeta] = useState(false);
  const trava = useRef(false);
  const idSalvo = useRef<string | null>(null);

  // Reset form when template changes
  useEffect(() => {
    if (template) {
      setName(template.name);
      setChannel(template.channel);
      setContent(template.content);
      setSubject(template.subject || "");
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
      setActivecampaignTemplateId("");
      setIsActive(true);
      setCategory('utility');
      setLanguage('pt_BR');
      setButtons([]);
      setBusinessUnits([]);
    }
  }, [template, open, defaultChannel]);

  useEffect(() => {
    setNomeMeta(""); setNomeMetaEditado(false); setExemplos({}); setExemplosUrl({}); setErros({});
    idSalvo.current = null;
  }, [templateId, open]);

  const { data: metaRows } = useAutomationTemplatesMeta();
  const metaInfo = metaRows?.find(r => r.template_id === templateId);
  const metaNome = template?.meta_template_name ?? null;
  const metaStatus = metaInfo?.status ?? null;
  // pode (re)enviar: sem vínculo, recusado/excluído, ou vinculado mas sumiu da Meta (linha não encontrada)
  const podeEnviarMeta = channel === 'whatsapp' && podeEnviarParaMeta(metaNome, metaInfo);
  const visualMeta = statusMetaVisual(!!metaNome, metaStatus);
  const isLocked = channel === 'whatsapp' && !!metaNome && !podeEnviarMeta;
  const nomeMetaSugerido = metaNome && podeEnviarMeta ? proximoNomeMeta(metaNome) : slugMeta(name);
  const nomeMetaFinal = nomeMetaEditado ? nomeMeta : nomeMetaSugerido;
  const previaMeta = corpoParaMeta(content);
  const EXEMPLO_PH: Record<string, string> = {
    nome: "Maria", data_hora: "14/11/2026 às 15:00", closer: "Diego",
    link: "https://meet.google.com/abc-defg-hij", data: "14/11/2026", sdr: "Ana", dono_nome: "Ana",
  };

  const buildPayload = (): Partial<AutomationTemplate> => {
    // Extract used variables from content
    const usedVariables = channel === 'whatsapp'
      ? variaveisDoTemplate(content, buttons)
      : AVAILABLE_VARIABLES.filter(v => content.includes(`{{${v}}}`));

    return {
      name,
      channel,
      content,
      subject: channel === 'email' ? subject : undefined,
      variables: usedVariables,
      activecampaign_template_id: channel === 'email' ? activecampaignTemplateId || undefined : undefined,
      is_active: isActive,
      category: channel === 'whatsapp' ? category : undefined,
      language: channel === 'whatsapp' ? language : undefined,
      buttons_config: channel === 'whatsapp' ? buttons : [],
      business_units: businessUnits,
    };
  };

  const persist = async (): Promise<string | null> => {
    const data = buildPayload();
    const alvo = templateId ?? idSalvo.current;
    if (alvo) {
      await updateTemplate.mutateAsync({ id: alvo, ...data });
      return alvo;
    }
    const created = await createTemplate.mutateAsync(data);
    const novoId = (created as { id?: string } | null)?.id ?? null;
    idSalvo.current = novoId;
    return novoId;
  };

  const handleSave = async () => {
    try {
      await persist();
      onOpenChange(false);
    } catch (e) {
      // hooks já mostram toast de erro
    }
  };

  const qc = useQueryClient();
  const vincular = useVincularTemplateMeta();
  const handleSaveAndSubmit = async () => {
    if (trava.current) return;
    const err = validarParaMeta({ nomeMeta: nomeMetaFinal, categoria: category, content, botoes: buttons, exemplos, exemplosUrl });
    setErros(err);
    if (Object.keys(err).length) { toast.error("Corrija os campos marcados antes de enviar para a Meta."); return; }
    trava.current = true; setEnviandoMeta(true);
    try {
      const id = await persist();            // grava automation_templates (sem meta_template_name)
      if (!id) return;
      const { corpo, ordem } = corpoParaMeta(content);
      const body = {
        acao: "criar", nome: nomeMetaFinal, categoria: category === 'marketing' ? "MARKETING" : "UTILITY", idioma: "pt_BR",
        cabecalho: null, rodape: null, corpo,
        exemplos: ordem.map(v => exemplos[v].trim()),
        botoes: botoesParaMeta(buttons, exemplosUrl),
      };
      const { data, error } = await supabase.functions.invoke("meta-wa-templates", { body });
      if (error) {
        const { status, mensagem, campo } = await lerErroEdge(error);
        if (status === 409) {
          // Depois de um 504 ou de um vincular que falhou, o template pode já estar na Meta: liga em vez de criar outro.
          const est = await rpc<EstadoWA>("mkt_wa_estado").catch(() => null);
          const ja = est?.templates.find(t => t.nome === nomeMetaFinal && t.idioma === "pt_BR" && t.corpo.trim() === corpo);
          if (ja) {
            try { await vincular.mutateAsync({ id, meta_template_name: nomeMetaFinal }); }
            catch { toast.error("Não foi possível ligar o template que já está na Meta. Tente de novo."); return; }
            toast.success("Esse template já estava na Meta e foi ligado a este template.");
            await qc.invalidateQueries({ queryKey: ["mkt-wa-estado"] });
            onOpenChange(false);
            return;
          }
        }
        const chave = campoDaEdge(campo, ordem);
        if (chave) setErros(x => ({ ...x, [chave]: mensagem }));
        toast.error(
          status === 409 ? "Já existe um template na Meta com esse nome. Troque o Nome na Meta."
          : status === 504 ? "A Meta não respondeu. Clique em Sincronizar status e tente de novo com o mesmo nome: se ele já tiver sido criado, o painel liga sozinho."
          : mensagem);
        return;                               // NÃO grava meta_template_name
      }
      try {
        await vincular.mutateAsync({ id, meta_template_name: nomeMetaFinal });
      } catch {
        toast.error(`O template ${nomeMetaFinal} foi criado na Meta, mas não ficou ligado a este template. Clique de novo em Salvar e enviar para a Meta, sem trocar o nome: o painel liga sozinho.`);
        return;
      }
      toast.success("Template enviado para análise da Meta. A aprovação costuma levar de minutos a algumas horas.");
      const aviso = (data as { aviso?: string } | null)?.aviso;
      if (aviso) toast.warning("O template foi criado na Meta, mas o status ainda não apareceu aqui. Clique em Sincronizar status na lista antes de qualquer reenvio.");
      await qc.invalidateQueries({ queryKey: ["mkt-wa-estado"] });
      onOpenChange(false);
    } catch {
      // erros de persist já mostram toast nos hooks; mantém o diálogo aberto
    } finally { trava.current = false; setEnviandoMeta(false); }
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
              <div className="flex flex-wrap items-center gap-2 rounded-md border p-3 bg-muted/30">
                {metaNome ? (
                  <>
                    <span className="text-sm font-medium">Meta: {metaNome}</span>
                    <Badge variant="outline" className={visualMeta.cls}>{visualMeta.label}</Badge>
                    {metaStatus?.toUpperCase() === 'REJECTED' && (
                      <span className="text-xs text-destructive">Motivo: {metaInfo?.motivo_rejeicao}</span>
                    )}
                    {metaStatus === null && (
                      <span className="text-xs text-muted-foreground">Clique em Sincronizar status na lista.</span>
                    )}
                  </>
                ) : (
                  <>
                    <Badge variant="outline" className={visualMeta.cls}>{visualMeta.label}</Badge>
                    <span className="text-xs text-muted-foreground">Preencha os exemplos abaixo e clique em Salvar e enviar para a Meta.</span>
                  </>
                )}
              </div>
            )}

            {isLocked && (
              <p className="text-xs text-muted-foreground bg-amber-500/10 border border-amber-500/30 rounded p-2">
                Conteúdo congelado: este template já está na Meta. Para mudar a mensagem, crie um novo template.
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
              {erros.content && <p className="text-xs text-destructive">{erros.content}</p>}
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
                        <SelectItem value="utility">Utilidade (lembretes, confirmações)</SelectItem>
                        <SelectItem value="marketing">Marketing (ofertas, boas-vindas)</SelectItem>
                      </SelectContent>
                    </Select>
                    {erros.categoria && <p className="text-xs text-destructive">{erros.categoria}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Idioma</Label>
                    <Input value="pt_BR" disabled />
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
                            <SelectItem value="phone">Telefone</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Texto do botão</Label>
                        <Input value={b.text} onChange={(e) => updateButton(idx, { text: e.target.value })} disabled={isLocked} />
                        {erros[`botao_${idx}_texto`] && <p className="text-xs text-destructive">{erros[`botao_${idx}_texto`]}</p>}
                        {b.type === 'url' && (
                          <Input
                            placeholder="https://exemplo.com/{{wa_agendar_token}} (variável só no final)"
                            value={b.url ?? ''}
                            onChange={(e) => updateButton(idx, { url: e.target.value })}
                            disabled={isLocked}
                          />
                        )}
                        {erros[`botao_${idx}_url`] && <p className="text-xs text-destructive">{erros[`botao_${idx}_url`]}</p>}
                        {b.type === 'phone' && (
                          <Input
                            placeholder="Telefone com +55 e DDD"
                            value={b.phone ?? ''}
                            onChange={(e) => updateButton(idx, { phone: e.target.value })}
                            disabled={isLocked}
                          />
                        )}
                        {erros[`botao_${idx}_telefone`] && <p className="text-xs text-destructive">{erros[`botao_${idx}_telefone`]}</p>}
                      </div>
                      <Button type="button" size="icon" variant="ghost" onClick={() => removeButton(idx)} disabled={isLocked}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  ))}
                  {erros.botoes && <p className="text-xs text-destructive">{erros.botoes}</p>}
                </div>
              </div>
            )}

            {channel === 'whatsapp' && podeEnviarMeta && (
              <div className="space-y-4">
                <h4 className="font-medium text-sm">Envio para a Meta</h4>
                <div className="space-y-2">
                  <Label htmlFor="nomeMeta">Nome na Meta</Label>
                  <Input
                    id="nomeMeta"
                    value={nomeMetaFinal}
                    onChange={(e) => { setNomeMeta(e.target.value.toLowerCase().replace(/ /g, "_")); setNomeMetaEditado(true); }}
                  />
                  <p className="text-xs text-muted-foreground">Só letras minúsculas, números e _. A Meta não deixa reaproveitar o nome de um template excluído por um tempo.</p>
                  {erros.nomeMeta && <p className="text-xs text-destructive">{erros.nomeMeta}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Como vai para a Meta</Label>
                  <div className="rounded-md bg-muted p-3 font-mono text-xs whitespace-pre-wrap">{previaMeta.corpo}</div>
                  {previaMeta.ordem.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {previaMeta.ordem.map((v, i) => `{{${i + 1}}} = ${v}`).join(" · ")}
                    </p>
                  )}
                </div>
                {previaMeta.ordem.map((v, i) => (
                  <div key={v} className="space-y-1">
                    <Label className="text-xs">{`Exemplo para {{${v}}} ({{${i + 1}}})`}</Label>
                    <Input
                      value={exemplos[v] ?? ""}
                      placeholder={EXEMPLO_PH[v] ?? ""}
                      onChange={(e) => setExemplos(x => ({ ...x, [v]: e.target.value }))}
                    />
                    {erros[`exemplo_${v}`] && <p className="text-xs text-destructive">{erros[`exemplo_${v}`]}</p>}
                  </div>
                ))}
                {buttons.map((b, i) => {
                  if (b.type !== 'url') return null;
                  const base = baseUrlVariavel(b.url ?? "");
                  if (base === null) return null;
                  return (
                    <div key={`ex-url-${i}`} className="space-y-1">
                      <Label className="text-xs">Exemplo da URL completa (botão {i + 1})</Label>
                      <Input
                        value={exemplosUrl[i] ?? ""}
                        placeholder={`${base}abc123`}
                        onChange={(e) => setExemplosUrl(x => ({ ...x, [i]: e.target.value }))}
                      />
                      {erros[`botao_${i}_exemplo`] && <p className="text-xs text-destructive">{erros[`botao_${i}_exemplo`]}</p>}
                    </div>
                  );
                })}
              </div>
            )}

            <Separator />

            {/* External IDs */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm">Configurações Avançadas</h4>
              
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
            <Button
              variant={channel === 'whatsapp' ? 'outline' : 'default'}
              onClick={handleSave}
              disabled={!name || !content || isSaving || enviandoMeta}
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {channel === 'whatsapp' ? (isLocked ? 'Salvar' : 'Salvar rascunho') : (isEditing ? 'Salvar' : 'Criar Template')}
            </Button>
            {channel === 'whatsapp' && podeEnviarMeta && (
              <Button
                onClick={handleSaveAndSubmit}
                disabled={!name || !content || isSaving || enviandoMeta}
              >
                {enviandoMeta ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Salvar e enviar para a Meta
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
