import { useEffect, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Info, Send } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { useCheckinTemplates, CheckinTemplateVariable } from '@/hooks/checkin/useCheckinTemplates';
import { WaConversation } from '@/hooks/wa/useWaConversations';
import { get24hWindow } from './waLabels';

/**
 * As fontes product_name / purchase_date não existem no modelo de conversa por pessoa,
 * então ficam em branco para o operador preencher.
 */
function resolveVarSource(v: CheckinTemplateVariable, conversation: WaConversation): string {
  switch (v.source) {
    case 'customer_name':
      return conversation.contact_name ?? '';
    default:
      return '';
  }
}

function previewWithVars(
  preview: string,
  variables: CheckinTemplateVariable[],
  vars: Record<string, string>,
): string {
  let out = preview;
  for (const v of variables) {
    const filled = vars[String(v.index)];
    out = out.split(`{{${v.name}}}`).join(filled || `{{${v.name}}}`);
    out = out.split(`{{${v.index}}}`).join(filled || `{{${v.index}}}`);
  }
  return out;
}

interface Props {
  conversation: WaConversation;
  sending: boolean;
  forceTemplateMode?: boolean;
  onSendFree: (body: string) => Promise<any>;
  onSendTemplate: (contentSid: string, vars: Record<string, string>) => Promise<any>;
}

export function MessageComposer({
  conversation,
  sending,
  forceTemplateMode,
  onSendFree,
  onSendTemplate,
}: Props) {
  const [text, setText] = useState('');
  const [tplId, setTplId] = useState<string>('');
  const [vars, setVars] = useState<Record<string, string>>({});
  const { data: templates = [], isLoading: loadingTpls } = useCheckinTemplates();

  const { open: windowOpen, lastInboundAt } = get24hWindow(conversation.last_inbound_at);
  const canSendFree = windowOpen && !forceTemplateMode;

  const selectedTpl = useMemo(
    () => templates.find((t) => t.id === tplId) ?? null,
    [templates, tplId],
  );

  useEffect(() => {
    if (!selectedTpl) {
      setVars({});
      return;
    }
    const initial: Record<string, string> = {};
    for (const v of selectedTpl.variables ?? []) {
      initial[String(v.index)] = resolveVarSource(v, conversation);
    }
    setVars(initial);
  }, [selectedTpl, conversation]);

  if (canSendFree) {
    const submit = async () => {
      if (!text.trim()) return;
      const body = text.trim();
      setText('');
      await onSendFree(body);
    };
    return (
      <div className="p-3 border-t flex gap-2 items-end">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Digite sua mensagem…"
          rows={2}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          className="resize-none text-base min-h-[52px]"
        />
        <Button onClick={submit} disabled={!text.trim() || sending} size="lg" className="h-[52px] px-4">
          <Send className="h-5 w-5" />
        </Button>
      </div>
    );
  }

  const submitTemplate = async () => {
    if (!selectedTpl) return;
    for (const v of selectedTpl.variables ?? []) {
      if (!vars[String(v.index)]?.trim()) {
        toast.error(`Preencha a variável: ${v.label}`);
        return;
      }
    }
    await onSendTemplate(selectedTpl.content_sid, vars);
    setTplId('');
    setVars({});
  };

  return (
    <div className="border-t bg-muted/30">
      <div className="px-3 pt-3 flex items-start gap-2 text-xs text-muted-foreground">
        <Info className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
        <div>
          {lastInboundAt
            ? <>Janela de 24h fechada (última mensagem do cliente há{' '}
                {formatDistanceToNow(lastInboundAt, { locale: ptBR })}).</>
            : <>O cliente ainda não iniciou conversa neste número.</>}
          {' '}Envie um <b>template aprovado</b> para reabrir o contato.
        </div>
      </div>

      <div className="p-3 space-y-3">
        <div>
          <Label className="text-xs">Template</Label>
          <Select value={tplId} onValueChange={setTplId}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder={loadingTpls ? 'Carregando…' : 'Escolha um template aprovado'} />
            </SelectTrigger>
            <SelectContent>
              {templates.length === 0 && (
                <div className="px-3 py-2 text-xs text-muted-foreground">
                  Nenhum template de WhatsApp aprovado disponível. Cadastre e submeta em Administração → Automações.
                </div>
              )}
              {templates.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedTpl && (
          <>
            {selectedTpl.body_preview && (
              <div className="text-xs bg-background rounded-md border p-3 whitespace-pre-wrap">
                {previewWithVars(selectedTpl.body_preview, selectedTpl.variables, vars)}
              </div>
            )}
            {(selectedTpl.variables ?? []).length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {selectedTpl.variables.map((v) => (
                  <div key={v.index}>
                    <Label className="text-xs">
                      {v.label} <span className="text-muted-foreground">{`{{${v.name}}}`}</span>
                    </Label>
                    <Input
                      value={vars[String(v.index)] ?? ''}
                      onChange={(e) =>
                        setVars((prev) => ({ ...prev, [String(v.index)]: e.target.value }))
                      }
                      className="h-8"
                    />
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-end">
              <Button onClick={submitTemplate} disabled={sending} size="sm">
                <Send className="h-4 w-4 mr-2" />
                Enviar template
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}