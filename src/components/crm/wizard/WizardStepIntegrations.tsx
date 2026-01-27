import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Webhook, Plus, X, Copy, Check, ExternalLink } from 'lucide-react';
import { WizardData } from './types';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

interface WizardStepIntegrationsProps {
  data: WizardData;
  onChange: (data: Partial<WizardData>) => void;
  errors: Record<string, string>;
}

export const WizardStepIntegrations = ({ data, onChange, errors }: WizardStepIntegrationsProps) => {
  const [newTag, setNewTag] = useState('');
  const [copied, setCopied] = useState(false);

  const updateIntegration = (updates: Partial<typeof data.integration>) => {
    onChange({ integration: { ...data.integration, ...updates } });
  };

  const generateSlug = () => {
    const slug = data.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    updateIntegration({ slug });
  };

  const addTag = () => {
    if (!newTag.trim()) return;
    if (data.integration.auto_tags.includes(newTag.trim())) return;
    
    updateIntegration({ auto_tags: [...data.integration.auto_tags, newTag.trim()] });
    setNewTag('');
  };

  const removeTag = (tag: string) => {
    updateIntegration({ 
      auto_tags: data.integration.auto_tags.filter((t) => t !== tag) 
    });
  };

  const webhookUrl = data.integration.slug 
    ? `https://rehcfgqvigfcekiipqkc.supabase.co/functions/v1/webhook-lead-receiver/${data.integration.slug}`
    : '';

  const copyWebhookUrl = async () => {
    if (!webhookUrl) return;
    await navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    toast({ title: 'URL copiada!', description: 'A URL do webhook foi copiada para a área de transferência.' });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Integrações</h3>
        <p className="text-sm text-muted-foreground">
          Configure webhooks para receber leads automaticamente. (Opcional)
        </p>
      </div>

      {/* Enable Webhook */}
      <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/20">
        <div className="flex items-center gap-3">
          <Webhook className="h-5 w-5 text-primary" />
          <div>
            <p className="font-medium">Webhook de Entrada</p>
            <p className="text-sm text-muted-foreground">
              Receba leads de fontes externas via HTTP
            </p>
          </div>
        </div>
        <Switch
          checked={data.integration.enabled}
          onCheckedChange={(enabled) => updateIntegration({ enabled })}
        />
      </div>

      {data.integration.enabled && (
        <div className="space-y-6 pl-4 border-l-2 border-primary/20">
          {/* Slug */}
          <div className="space-y-2">
            <Label htmlFor="slug">Identificador do Webhook (slug) *</Label>
            <div className="flex gap-2">
              <Input
                id="slug"
                value={data.integration.slug}
                onChange={(e) => updateIntegration({ 
                  slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') 
                })}
                placeholder="meu-webhook"
                className={errors['integration.slug'] ? 'border-destructive' : ''}
              />
              <Button variant="outline" onClick={generateSlug} disabled={!data.name}>
                Gerar do Nome
              </Button>
            </div>
            {errors['integration.slug'] && (
              <p className="text-sm text-destructive">{errors['integration.slug']}</p>
            )}
          </div>

          {/* Webhook URL Preview */}
          {data.integration.slug && (
            <div className="space-y-2">
              <Label>URL do Webhook</Label>
              <div className="flex gap-2">
                <Input
                  value={webhookUrl}
                  readOnly
                  className="font-mono text-xs bg-muted"
                />
                <Button variant="outline" size="icon" onClick={copyWebhookUrl}>
                  {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Use esta URL para enviar leads via POST. O webhook será criado após a finalização.
              </p>
            </div>
          )}

          {/* Auto Tags */}
          <div className="space-y-2">
            <Label>Tags Automáticas</Label>
            <p className="text-sm text-muted-foreground">
              Tags que serão automaticamente adicionadas aos leads recebidos
            </p>
            <div className="flex flex-wrap gap-2 mb-2">
              {data.integration.auto_tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="gap-1 pr-1">
                  {tag}
                  <button
                    onClick={() => removeTag(tag)}
                    className="ml-1 hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                placeholder="Nova tag..."
                onKeyDown={(e) => e.key === 'Enter' && addTag()}
              />
              <Button variant="outline" onClick={addTag} disabled={!newTag.trim()}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Initial Stage */}
          <div className="space-y-2">
            <Label>Etapa Inicial para Novos Leads</Label>
          <Select
            value={data.integration.initial_stage_id || '__default__'}
            onValueChange={(value) => updateIntegration({ 
              initial_stage_id: value === '__default__' ? '' : value 
            })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione a etapa inicial (padrão: primeira etapa)" />
            </SelectTrigger>
            <SelectContent className="bg-background border shadow-lg z-50">
              <SelectItem value="__default__">Primeira etapa (padrão)</SelectItem>
                {data.stages.map((stage) => (
                  <SelectItem key={stage.id} value={stage.id}>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: stage.color }} 
                      />
                      {stage.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {!data.integration.enabled && (
        <div className="text-center py-8 border rounded-lg bg-muted/20">
          <Webhook className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">Webhook desabilitado</p>
          <p className="text-sm text-muted-foreground">
            Ative o webhook para receber leads automaticamente de fontes externas.
          </p>
        </div>
      )}
    </div>
  );
};
