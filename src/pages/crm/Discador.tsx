import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Play, Square, PhoneCall, RefreshCw, Loader2 } from 'lucide-react';
import {
  useSonaxCampaignsToday,
  useSonaxCampaignContacts,
  useSonaxCampaignControl,
  useSonaxCallStatus,
  useSonaxTabulacoes,
} from '@/hooks/useSonaxDialer';
import { useAuth } from '@/contexts/AuthContext';
import DiscadorAudienceBuilder from '@/components/crm/DiscadorAudienceBuilder';


const statusVariant = (status: string) => {
  switch (status) {
    case 'atendido': return 'default' as const;
    case 'discando': return 'secondary' as const;
    case 'tabulado': return 'outline' as const;
    default: return 'outline' as const;
  }
};

export default function Discador() {
  const { data: campaigns = [], isLoading, refetch } = useSonaxCampaignsToday();
  const [selectedId, setSelectedId] = useState<string | undefined>();

  useEffect(() => {
    if (!selectedId && campaigns.length) setSelectedId(campaigns[0].id);
  }, [campaigns, selectedId]);

  const selected = useMemo(
    () => campaigns.find((c) => c.id === selectedId),
    [campaigns, selectedId],
  );

  const { data: contacts = [], isLoading: loadingContacts } = useSonaxCampaignContacts(selectedId);
  const control = useSonaxCampaignControl();
  const { data: liveStatus, isFetching: fetchingStatus } = useSonaxCallStatus(selectedId, 15000);
  const { data: tabulacoes } = useSonaxTabulacoes();

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <PhoneCall className="h-6 w-6 text-primary" />
            Discador Automático
          </h1>
          <p className="text-sm text-muted-foreground">
            Campanhas de discagem Sonax criadas hoje — o Sonax disca e transfere para o seu ramal quando o lead atende.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Campanhas de hoje</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
            </div>
          ) : campaigns.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma campanha hoje. Selecione leads no Kanban de Negócios e clique em "Enviar para discador".
            </p>
          ) : (
            <div className="space-y-2">
              {campaigns.map((c) => (
                <div
                  key={c.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedId(c.id)}
                  onKeyDown={(e) => e.key === 'Enter' && setSelectedId(c.id)}
                  className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                    c.id === selectedId ? 'border-primary bg-accent/40' : 'hover:bg-accent/20'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{c.descricao}</span>
                    <Badge variant={c.status === 'ativa' ? 'default' : 'secondary'}>{c.status}</Badge>
                    {c.sonax_campaign_id && (
                      <span className="text-xs text-muted-foreground">Sonax #{c.sonax_campaign_id}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="default"
                      disabled={control.isPending}
                      onClick={(e) => { e.stopPropagation(); control.mutate({ campaignId: c.id, play: true }); }}
                    >
                      <Play className="h-4 w-4 mr-1" /> Play
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={control.isPending}
                      onClick={(e) => { e.stopPropagation(); control.mutate({ campaignId: c.id, play: false }); }}
                    >
                      <Square className="h-4 w-4 mr-1" /> Stop
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {selected && (
        <>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                Status ao vivo
                {fetchingStatus && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Chamadas na fila</p>
                <pre className="text-xs bg-muted rounded p-3 overflow-auto max-h-48">
{JSON.stringify((liveStatus as any)?.fila?.raw ?? (liveStatus as any)?.fila ?? {}, null, 2)}
                </pre>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Chamadas em andamento</p>
                <pre className="text-xs bg-muted rounded p-3 overflow-auto max-h-48">
{JSON.stringify((liveStatus as any)?.andamento?.raw ?? (liveStatus as any)?.andamento ?? {}, null, 2)}
                </pre>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                Contatos enviados ({contacts.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingContacts ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Carregando contatos...
                </div>
              ) : contacts.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum contato nesta campanha ainda.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Tabulação</TableHead>
                      <TableHead>ID Sonax</TableHead>
                      <TableHead>Enviado em</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contacts.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-mono text-sm">{c.contact_phone || '—'}</TableCell>
                        <TableCell><Badge variant={statusVariant(c.status)}>{c.status}</Badge></TableCell>
                        <TableCell className="text-sm">{c.tabulacao || '—'}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {c.sonax_id_contato_campanha || '—'}
                        </TableCell>
                        <TableCell className="text-sm">
                          {new Date(c.created_at).toLocaleString('pt-BR')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {!!tabulacoes?.tabulacoes?.length && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Tabulações disponíveis no Sonax</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {tabulacoes.tabulacoes.map((t) => (
              <Badge key={t.id} variant="outline">{t.nome}</Badge>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
