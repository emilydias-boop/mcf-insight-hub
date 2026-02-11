import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Send, XCircle, CheckCircle, RotateCcw, FileText, Loader2 } from 'lucide-react';
import { ProposalModal } from '@/components/consorcio/ProposalModal';
import { SemSucessoModal } from '@/components/consorcio/SemSucessoModal';
import {
  useRealizadas, useProposals, useSemSucesso,
  useConfirmarAceite, useRetomarContato,
  type CompletedMeeting, type Proposal, type SemSucessoDeal,
} from '@/hooks/useConsorcioPostMeeting';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function PosReuniao() {
  const [activeTab, setActiveTab] = useState('realizadas');

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="realizadas">Realizadas</TabsTrigger>
          <TabsTrigger value="propostas">Propostas</TabsTrigger>
          <TabsTrigger value="sem-sucesso">Sem Sucesso</TabsTrigger>
        </TabsList>

        <TabsContent value="realizadas"><RealizadasTab /></TabsContent>
        <TabsContent value="propostas"><PropostasTab /></TabsContent>
        <TabsContent value="sem-sucesso"><SemSucessoTab /></TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Realizadas Tab ──────────────────────────────────────────
function RealizadasTab() {
  const { data: realizadas = [], isLoading } = useRealizadas();
  const [proposalTarget, setProposalTarget] = useState<CompletedMeeting | null>(null);
  const [semSucessoTarget, setSemSucessoTarget] = useState<CompletedMeeting | null>(null);

  if (isLoading) return <LoadingState />;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Reuniões Realizadas — Aguardando Ação</CardTitle>
      </CardHeader>
      <CardContent>
        {realizadas.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhuma reunião realizada pendente de ação.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contato</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Pipeline</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {realizadas.map(r => (
                <TableRow key={r.deal_id}>
                  <TableCell className="font-medium">{r.contact_name || r.deal_name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.contact_phone || '—'}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{r.origin_name}</Badge></TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {r.updated_at ? format(new Date(r.updated_at), 'dd/MM/yyyy', { locale: ptBR }) : '—'}
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button size="sm" onClick={() => setProposalTarget(r)}>
                      <Send className="h-3 w-3 mr-1" /> Proposta
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => setSemSucessoTarget(r)}>
                      <XCircle className="h-3 w-3 mr-1" /> Sem Sucesso
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {proposalTarget && (
          <ProposalModal
            open={!!proposalTarget}
            onOpenChange={o => !o && setProposalTarget(null)}
            dealId={proposalTarget.deal_id}
            dealName={proposalTarget.deal_name}
            contactName={proposalTarget.contact_name}
            originId={proposalTarget.origin_id}
          />
        )}
        {semSucessoTarget && (
          <SemSucessoModal
            open={!!semSucessoTarget}
            onOpenChange={o => !o && setSemSucessoTarget(null)}
            dealId={semSucessoTarget.deal_id}
            dealName={semSucessoTarget.deal_name}
            contactName={semSucessoTarget.contact_name}
            originId={semSucessoTarget.origin_id}
          />
        )}
      </CardContent>
    </Card>
  );
}

// ─── Propostas Tab ───────────────────────────────────────────
function PropostasTab() {
  const { data: propostas = [], isLoading } = useProposals();
  const confirmarAceite = useConfirmarAceite();
  const [semSucessoTarget, setSemSucessoTarget] = useState<Proposal | null>(null);

  if (isLoading) return <LoadingState />;

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Propostas Enviadas</CardTitle>
      </CardHeader>
      <CardContent>
        {propostas.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhuma proposta pendente.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contato</TableHead>
                <TableHead>Valor Crédito</TableHead>
                <TableHead>Prazo</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {propostas.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.contact_name || p.deal_name}</TableCell>
                  <TableCell>{formatCurrency(p.valor_credito)}</TableCell>
                  <TableCell>{p.prazo_meses} meses</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs capitalize">{p.tipo_produto}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={p.status === 'aceita' ? 'default' : 'outline'} className="text-xs capitalize">
                      {p.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    {p.status === 'pendente' && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => confirmarAceite.mutate({ proposal_id: p.id })}
                          disabled={confirmarAceite.isPending}
                        >
                          <CheckCircle className="h-3 w-3 mr-1" /> Aceite
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => setSemSucessoTarget(p)}>
                          <XCircle className="h-3 w-3 mr-1" /> Recusar
                        </Button>
                      </>
                    )}
                    {p.status === 'aceita' && !p.consortium_card_id && (
                      <Button size="sm" variant="outline" asChild>
                        <a href={`/consorcio?prefill_deal=${p.deal_id}&prefill_proposal=${p.id}`}>
                          <FileText className="h-3 w-3 mr-1" /> Cadastrar Cota
                        </a>
                      </Button>
                    )}
                    {p.consortium_card_id && (
                      <Badge className="bg-primary/10 text-primary text-xs">Cota Cadastrada</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {semSucessoTarget && (
          <SemSucessoModal
            open={!!semSucessoTarget}
            onOpenChange={o => !o && setSemSucessoTarget(null)}
            dealId={semSucessoTarget.deal_id}
            dealName={semSucessoTarget.deal_name}
            contactName={semSucessoTarget.contact_name}
            originId={semSucessoTarget.origin_id}
            proposalId={semSucessoTarget.id}
          />
        )}
      </CardContent>
    </Card>
  );
}

// ─── Sem Sucesso Tab ─────────────────────────────────────────
function SemSucessoTab() {
  const { data: deals = [], isLoading } = useSemSucesso();
  const retomar = useRetomarContato();

  if (isLoading) return <LoadingState />;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Deals Sem Sucesso</CardTitle>
      </CardHeader>
      <CardContent>
        {deals.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhum deal sem sucesso.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contato</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Pipeline</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deals.map(d => (
                <TableRow key={d.deal_id}>
                  <TableCell className="font-medium">{d.contact_name || d.deal_name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{d.contact_phone || '—'}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{d.origin_name}</Badge></TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                    {d.motivo_recusa || '—'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {d.updated_at ? format(new Date(d.updated_at), 'dd/MM/yyyy', { locale: ptBR }) : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => retomar.mutate({ deal_id: d.deal_id, origin_id: d.origin_id })}
                      disabled={retomar.isPending}
                    >
                      <RotateCcw className="h-3 w-3 mr-1" /> Retomar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}
