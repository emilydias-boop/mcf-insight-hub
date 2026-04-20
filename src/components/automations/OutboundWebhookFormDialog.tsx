import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import {
  OUTBOUND_EVENTS,
  OUTBOUND_SOURCES,
  OutboundWebhookConfig,
  useCreateOutboundWebhook,
  useUpdateOutboundWebhook,
} from '@/hooks/useOutboundWebhooks';
import { Trash2, Plus } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  webhook?: OutboundWebhookConfig | null;
}

export function OutboundWebhookFormDialog({ open, onOpenChange, webhook }: Props) {
  const create = useCreateOutboundWebhook();
  const update = useUpdateOutboundWebhook();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [url, setUrl] = useState('');
  const [method, setMethod] = useState('POST');
  const [events, setEvents] = useState<string[]>(['sale.created']);
  const [sources, setSources] = useState<string[]>(OUTBOUND_SOURCES.map((s) => s.value));
  const [productCategoriesText, setProductCategoriesText] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [secretToken, setSecretToken] = useState('');
  const [headerEntries, setHeaderEntries] = useState<{ k: string; v: string }[]>([]);

  useEffect(() => {
    if (webhook) {
      setName(webhook.name);
      setDescription(webhook.description ?? '');
      setUrl(webhook.url);
      setMethod(webhook.method);
      setEvents(webhook.events);
      setSources(webhook.sources);
      setProductCategoriesText((webhook.product_categories ?? []).join(', '));
      setIsActive(webhook.is_active);
      setSecretToken(webhook.secret_token ?? '');
      setHeaderEntries(Object.entries(webhook.headers ?? {}).map(([k, v]) => ({ k, v: String(v) })));
    } else {
      setName('');
      setDescription('');
      setUrl('');
      setMethod('POST');
      setEvents(['sale.created']);
      setSources(OUTBOUND_SOURCES.map((s) => s.value));
      setProductCategoriesText('');
      setIsActive(true);
      setSecretToken('');
      setHeaderEntries([]);
    }
  }, [webhook, open]);

  const toggle = (arr: string[], setArr: (v: string[]) => void, val: string) => {
    setArr(arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]);
  };

  const handleSave = async () => {
    const headers = headerEntries.reduce<Record<string, string>>((acc, { k, v }) => {
      if (k.trim()) acc[k.trim()] = v;
      return acc;
    }, {});
    const product_categories = productCategoriesText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const payload = {
      name,
      description: description || null,
      url,
      method,
      events,
      sources,
      product_categories: product_categories.length ? product_categories : null,
      headers,
      is_active: isActive,
      secret_token: secretToken || null,
    };

    if (webhook) {
      await update.mutateAsync({ id: webhook.id, ...payload });
    } else {
      await create.mutateAsync(payload);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{webhook ? 'Editar Webhook de Saída' : 'Novo Webhook de Saída'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Nome</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Webhook Vendas → CRM externo" />
            </div>
            <div className="col-span-2">
              <Label>Descrição</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
            </div>
            <div className="col-span-2">
              <Label>URL de Destino</Label>
              <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." />
            </div>
            <div>
              <Label>Método</Label>
              <select
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={method}
                onChange={(e) => setMethod(e.target.value)}
              >
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="PATCH">PATCH</option>
              </select>
            </div>
            <div className="flex items-end gap-2">
              <div className="flex items-center gap-2">
                <Switch checked={isActive} onCheckedChange={setIsActive} id="active" />
                <Label htmlFor="active">Ativo</Label>
              </div>
            </div>
          </div>

          <div>
            <Label>Eventos</Label>
            <div className="grid grid-cols-3 gap-2 mt-2">
              {OUTBOUND_EVENTS.map((e) => (
                <label key={e.value} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={events.includes(e.value)} onCheckedChange={() => toggle(events, setEvents, e.value)} />
                  {e.label}
                </label>
              ))}
            </div>
          </div>

          <div>
            <Label>Origens (sources)</Label>
            <div className="grid grid-cols-3 gap-2 mt-2">
              {OUTBOUND_SOURCES.map((s) => (
                <label key={s.value} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={sources.includes(s.value)} onCheckedChange={() => toggle(sources, setSources, s.value)} />
                  {s.label}
                </label>
              ))}
            </div>
          </div>

          <div>
            <Label>Categorias de Produto (opcional, separadas por vírgula)</Label>
            <Input
              value={productCategoriesText}
              onChange={(e) => setProductCategoriesText(e.target.value)}
              placeholder="a010, consorcio, incorporador"
            />
            <p className="text-xs text-muted-foreground mt-1">Deixe vazio para receber todas as categorias.</p>
          </div>

          <div>
            <Label>Secret Token (HMAC SHA-256, opcional)</Label>
            <Input value={secretToken} onChange={(e) => setSecretToken(e.target.value)} placeholder="Gerar e copiar — usado em X-Signature" />
            <p className="text-xs text-muted-foreground mt-1">
              Se preenchido, cada request inclui header <code>X-Signature: sha256=&lt;hex&gt;</code> do body.
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label>Headers Customizados</Label>
              <Button type="button" variant="ghost" size="sm" onClick={() => setHeaderEntries([...headerEntries, { k: '', v: '' }])}>
                <Plus className="h-4 w-4 mr-1" /> Adicionar
              </Button>
            </div>
            <div className="space-y-2 mt-2">
              {headerEntries.map((h, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    placeholder="Header"
                    value={h.k}
                    onChange={(e) => setHeaderEntries(headerEntries.map((x, j) => (j === i ? { ...x, k: e.target.value } : x)))}
                  />
                  <Input
                    placeholder="Valor"
                    value={h.v}
                    onChange={(e) => setHeaderEntries(headerEntries.map((x, j) => (j === i ? { ...x, v: e.target.value } : x)))}
                  />
                  <Button type="button" variant="ghost" size="icon" onClick={() => setHeaderEntries(headerEntries.filter((_, j) => j !== i))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!name || !url || events.length === 0 || sources.length === 0}>
            {webhook ? 'Salvar' : 'Criar Webhook'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}