import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Copy, ExternalLink, Search } from 'lucide-react';
import { getWebhookUrl, useToggleWebhookEndpoint } from '@/hooks/useWebhookEndpoints';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface OriginRow {
  id: string;
  name: string;
  bu_type: string | null;
}

export function IncomingWebhooksGlobalList() {
  const [search, setSearch] = useState('');
  const toggle = useToggleWebhookEndpoint();

  const { data: origins } = useQuery({
    queryKey: ['crm-origins-all'],
    queryFn: async () => {
      const { data, error } = await supabase.from('crm_origins').select('id, name, bu_type');
      if (error) throw error;
      return (data || []) as OriginRow[];
    },
  });

  const { data: endpoints, isLoading } = useQuery({
    queryKey: ['webhook-endpoints', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('webhook_endpoints')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 15000,
  });

  const originMap = useMemo(() => {
    const m = new Map<string, OriginRow>();
    (origins ?? []).forEach((o) => m.set(o.id, o));
    return m;
  }, [origins]);

  const grouped = useMemo(() => {
    const filtered = (endpoints ?? []).filter((ep: any) => {
      if (!search.trim()) return true;
      const s = search.toLowerCase();
      return (
        ep.name?.toLowerCase().includes(s) ||
        ep.slug?.toLowerCase().includes(s) ||
        originMap.get(ep.origin_id)?.name?.toLowerCase().includes(s)
      );
    });
    const buckets = new Map<string, any[]>();
    filtered.forEach((ep: any) => {
      const o = originMap.get(ep.origin_id);
      const key = o ? `${o.name}__${o.bu_type ?? '-'}` : 'Sem origem';
      const arr = buckets.get(key) ?? [];
      arr.push(ep);
      buckets.set(key, arr);
    });
    return Array.from(buckets.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [endpoints, originMap, search]);

  const copyUrl = (slug: string) => {
    navigator.clipboard.writeText(getWebhookUrl(slug));
    toast.success('URL copiada');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Webhooks de Entrada</h2>
          <p className="text-sm text-muted-foreground">
            Endpoints que recebem leads/eventos de fontes externas (Hubla, Kiwify, MCFPay, Make, Clint, Asaas, formulários, etc).
          </p>
        </div>
        <div className="relative w-72">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar..." className="pl-8" />
        </div>
      </div>

      {isLoading && <div className="text-sm text-muted-foreground">Carregando...</div>}
      {!isLoading && grouped.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhum webhook de entrada cadastrado.
          </CardContent>
        </Card>
      )}

      <div className="space-y-6">
        {grouped.map(([key, items]) => {
          const [originName, bu] = key.split('__');
          return (
            <div key={key}>
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-sm font-semibold">{originName}</h3>
                {bu && bu !== '-' && <Badge variant="outline" className="text-xs">{bu}</Badge>}
                <span className="text-xs text-muted-foreground">({items.length})</span>
              </div>
              <div className="grid gap-2">
                {items.map((ep: any) => (
                  <Card key={ep.id} className={ep.is_active ? '' : 'opacity-60'}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-sm">{ep.name}</CardTitle>
                          <p className="text-xs font-mono text-muted-foreground truncate mt-1">
                            /{ep.slug}
                          </p>
                        </div>
                        <Switch
                          checked={ep.is_active}
                          onCheckedChange={(v) => toggle.mutate({ id: ep.id, is_active: v })}
                        />
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="grid grid-cols-3 gap-3 text-xs mb-2">
                        <div>
                          <div className="text-muted-foreground">Leads recebidos</div>
                          <div className="font-semibold">{ep.leads_received ?? 0}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Último lead</div>
                          <div className="font-medium">
                            {ep.last_lead_at ? format(new Date(ep.last_lead_at), "dd/MM HH:mm", { locale: ptBR }) : '—'}
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Auth</div>
                          <div className="font-medium">{ep.auth_header_name ? 'Sim' : '—'}</div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => copyUrl(ep.slug)}>
                          <Copy className="h-3 w-3 mr-1" /> Copiar URL
                        </Button>
                        <Button size="sm" variant="ghost" asChild>
                          <a href={getWebhookUrl(ep.slug)} target="_blank" rel="noreferrer">
                            <ExternalLink className="h-3 w-3 mr-1" /> Abrir
                          </a>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground pt-4 border-t">
        Para criar/editar webhooks de entrada com mapeamento de campos, vá em <strong>CRM → Pipelines → Webhooks</strong> da pipeline desejada.
      </p>
    </div>
  );
}