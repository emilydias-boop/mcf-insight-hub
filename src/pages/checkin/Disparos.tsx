import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ArrowLeft, Loader2, Pencil, Plus, Send, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import {
  useCreateWaBroadcast,
  useExcluirRascunho,
  useIniciarBroadcast,
  useMontarPublico,
  useUpdateWaBroadcast,
  useWaBroadcasts,
  useWaBusDisponiveis,
  useWaSaldoHoje,
  useWaSampleName,
  useWaTargetsCount,
  useWaTemplates,
  WaBroadcast,
  WaBroadcastEscopo,
  WaTemplateOption,
} from '@/hooks/wa/useWaBroadcasts';
import { TemplateStep } from '@/components/checkin/broadcast/TemplateStep';
import { PublicoStep } from '@/components/checkin/broadcast/PublicoStep';
import { RevisaoStep } from '@/components/checkin/broadcast/RevisaoStep';
import { ConfirmarEnvioDialog } from '@/components/checkin/broadcast/ConfirmarEnvioDialog';
import { BROADCAST_STATUS_LABEL } from '@/components/checkin/broadcast/waBroadcastLabels';
import { formatDateTime } from '@/lib/formatters';

export default function Disparos() {
  const { user } = useAuth();
  const { data: broadcasts = [], isLoading } = useWaBroadcasts();
  const { data: saldoInfo } = useWaSaldoHoje();
  const [wizardOpen, setWizardOpen] = useState(false);
  /** rascunho reaberto para continuar de onde parou */
  const [rascunho, setRascunho] = useState<WaBroadcast | null>(null);
  const [excluindo, setExcluindo] = useState<WaBroadcast | null>(null);
  const excluir = useExcluirRascunho();

  const abrirNovo = () => {
    setRascunho(null);
    setWizardOpen(true);
  };
  const abrirRascunho = (b: WaBroadcast) => {
    setRascunho(b);
    setWizardOpen(true);
  };


  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Disparos por template</h1>
          <p className="text-sm text-muted-foreground">
            Envio em massa pelo número Comercial, com limite diário e ritmo controlados pelo sistema.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link to="/checkin">
              <ArrowLeft className="mr-2 h-4 w-4" /> Voltar ao inbox
            </Link>
          </Button>
          <Button onClick={abrirNovo}>
            <Plus className="mr-2 h-4 w-4" /> Novo disparo
          </Button>
        </div>
      </div>

      {saldoInfo && (
        <Card>
          <CardContent className="pt-4 text-sm text-muted-foreground">
            Saldo de hoje: <span className="font-medium text-foreground">{saldoInfo.saldo}</span>{' '}
            mensagem(ns) · já enviadas hoje: {saldoInfo.enviadosHoje}
          </CardContent>
        </Card>
      )}

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Disparo</TableHead>
              <TableHead>Template</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Alvos</TableHead>
              <TableHead className="text-right">Enviados</TableHead>
              <TableHead className="text-right">Falhas</TableHead>
              <TableHead>Criado</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  Carregando…
                </TableCell>
              </TableRow>
            ) : broadcasts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  Nenhum disparo criado ainda
                </TableCell>
              </TableRow>
            ) : (
              broadcasts.map((b) => {
                const ehRascunho = b.status === 'rascunho';
                const podeExcluir = ehRascunho && b.criado_por === user?.id;
                return (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">
                      {ehRascunho ? (
                        // rascunho reabre o assistente; o resto vai para o acompanhamento
                        <button
                          type="button"
                          className="text-left hover:underline"
                          onClick={() => abrirRascunho(b)}
                        >
                          {b.nome}
                        </button>
                      ) : (
                        <Link to={`/checkin/disparos/${b.id}`} className="hover:underline">
                          {b.nome}
                        </Link>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {b.template_nome ?? b.content_sid ?? '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={b.status === 'cancelado' ? 'destructive' : 'secondary'}>
                        {BROADCAST_STATUS_LABEL[b.status] ?? b.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{b.total_alvos}</TableCell>
                    <TableCell className="text-right">{b.total_enviados}</TableCell>
                    <TableCell className="text-right">{b.total_falhas}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {formatDateTime(b.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {ehRascunho && (
                          <Button variant="ghost" size="sm" onClick={() => abrirRascunho(b)}>
                            <Pencil className="mr-1 h-3.5 w-3.5" /> Continuar
                          </Button>
                        )}
                        {podeExcluir && (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Excluir rascunho"
                            onClick={() => setExcluindo(b)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <CriarDisparoDialog
        key={rascunho?.id ?? 'novo'}
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        rascunho={rascunho}
      />

      <AlertDialog open={!!excluindo} onOpenChange={(v) => !v && setExcluindo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir rascunho</AlertDialogTitle>
            <AlertDialogDescription>
              “{excluindo?.nome}” será removido junto com o público montado. Nada foi enviado
              ainda, então nenhum lead é afetado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!excluindo) return;
                try {
                  await excluir.mutateAsync(excluindo.id);
                } finally {
                  setExcluindo(null);
                }
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}

function CriarDisparoDialog({
  open,
  onOpenChange,
  rascunho,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  rascunho?: WaBroadcast | null;
}) {
  const navigate = useNavigate();
  const { hasAnyRole } = useAuth();
  const { data: templates = [] } = useWaTemplates();
  const { data: busDisponiveis = [] } = useWaBusDisponiveis();
  const criar = useCreateWaBroadcast();
  const atualizar = useUpdateWaBroadcast();
  const montar = useMontarPublico();
  const iniciar = useIniciarBroadcast();

  // a função devolve vazio para quem não é admin/manager, mas o gate da UI não
  // depende só disso
  const podeUsarBu = (hasAnyRole('admin', 'manager') && busDisponiveis.length > 0) || false;

  const [step, setStep] = useState(1);
  const [nome, setNome] = useState('');
  const [template, setTemplate] = useState<WaTemplateOption | null>(null);
  const [broadcast, setBroadcast] = useState<WaBroadcast | null>(null);
  const [stageIds, setStageIds] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [originId, setOriginId] = useState('');
  const [limite, setLimite] = useState('');
  const [escopo, setEscopo] = useState<WaBroadcastEscopo>('minha_carteira');
  const [bu, setBu] = useState('');
  const [jaMontou, setJaMontou] = useState(false);
  const [bloqueado, setBloqueado] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  /** quando o público em banco foi montado — só quando um rascunho é reaberto */
  const [publicoMontadoEm, setPublicoMontadoEm] = useState<string | null>(null);
  /**
   * Recorte de origem quando o disparo nasceu de uma seleção de negócios no CRM.
   * Não é filtro editável nos seletores: precisa sobreviver a cada remontagem,
   * senão o público deixa de ser o que a pessoa marcou.
   */
  const [dealIds, setDealIds] = useState<string[]>([]);

  /** Reabrir rascunho: recarrega template, escopo, BU, filtros e limite. */
  useEffect(() => {
    if (!open || !rascunho) return;
    setBroadcast(rascunho);
    setNome(rascunho.nome ?? '');
    setTemplate(
      rascunho.content_sid
        ? (templates.find((t) => t.content_sid === rascunho.content_sid) ?? null)
        : null,
    );
    setEscopo((rascunho.escopo as WaBroadcastEscopo) ?? 'minha_carteira');
    setBu(rascunho.bu ?? '');
    // rascunho antigo salvava stage_id (string única) — converte para array
    const filtro = rascunho.filtro ?? {};
    const comoArray = (v: unknown): string[] =>
      Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
    const stagesSalvos = comoArray(filtro.stage_ids);
    const stageAntigo = typeof filtro.stage_id === 'string' && filtro.stage_id ? [filtro.stage_id] : [];
    setStageIds(stagesSalvos.length > 0 ? stagesSalvos : stageAntigo);
    setTags(comoArray(filtro.tags));
    setOriginId(typeof filtro.origin_id === 'string' ? filtro.origin_id : '');
    // seleção do CRM: preservada como recorte, fora dos seletores do wizard
    setDealIds(comoArray(filtro.deal_ids));
    setLimite(rascunho.limite_alvos ? String(rascunho.limite_alvos) : '');
    const temAlvos = (rascunho.total_alvos ?? 0) > 0;
    setJaMontou(temAlvos);
    setPublicoMontadoEm(temAlvos ? rascunho.updated_at : null);
    setStep(rascunho.content_sid ? 2 : 1);
  }, [open, rascunho, templates]);

  const { data: sampleName = null } = useWaSampleName(broadcast?.id);
  const {
    data: pendentesData,
    isFetching: buscandoPendentes,
    isError: erroPendentes,
  } = useWaTargetsCount(broadcast?.id, 'pendente');
  /** null = contagem indisponível. Nunca cai para 0, que liberaria o envio. */
  const pendentes = typeof pendentesData === 'number' ? pendentesData : null;
  /**
   * `isFetching` (e não `isLoading`): num refetch com dado em cache o React
   * Query mantém isLoading falso e devolveria a contagem do público ANTERIOR —
   * era assim que a confirmação por digitação se desarmava.
   */
  const contagemIndisponivel = pendentes === null || buscandoPendentes || erroPendentes;


  /**
   * Qualquer mudança de filtro, escopo ou limite invalida o público já montado:
   * o limite só é persistido dentro do handleMontar, então seguir sem remontar
   * dispararia para a base inteira depois de um "Testar com 10".
   */
  const invalidarPublico = () => {
    setJaMontou(false);
    setPublicoMontadoEm(null);
  };
  const handleStageIdsChange = (v: string[]) => {
    setStageIds(v);
    invalidarPublico();
  };
  const handleTagsChange = (v: string[]) => {
    setTags(v);
    invalidarPublico();
  };
  const handleOriginChange = (v: string) => {
    setOriginId(v);
    // as opções de estágio mudam com a origem; as tags são independentes
    setStageIds([]);
    invalidarPublico();
  };

  const handleEscopoChange = (v: WaBroadcastEscopo) => {
    setEscopo(v);
    if (v === 'minha_carteira') setBu('');
    // as listas de origem/estágio/tag mudam de recorte junto com o escopo
    if (v === 'bu') {
      setOriginId('');
      setStageIds([]);
      setTags([]);
    }
    invalidarPublico();
  };
  const handleBuChange = (v: string) => {
    setBu(v);
    invalidarPublico();
  };

  const handleLimiteChange = (v: string) => {
    setLimite(v);
    invalidarPublico();
  };


  const templateAtual = useMemo(
    () => template ?? templates.find((t) => t.content_sid === broadcast?.content_sid) ?? null,
    [template, templates, broadcast?.content_sid],
  );

  const reset = () => {
    setStep(1);
    setNome('');
    setTemplate(null);
    setBroadcast(null);
    setStageIds([]);
    setTags([]);
    setOriginId('');
    setDealIds([]);
    setLimite('');
    setEscopo('minha_carteira');
    setBu('');
    setJaMontou(false);
    setPublicoMontadoEm(null);
    setBloqueado(true);
  };

  const handleClose = (v: boolean) => {
    onOpenChange(v);
    if (!v) reset();
  };

  const avancarParaPublico = async () => {
    if (!nome.trim()) return toast.error('Dê um nome ao disparo');
    if (!template) return toast.error('Escolha um template');
    if (broadcast) {
      await atualizar.mutateAsync({
        id: broadcast.id,
        patch: {
          nome: nome.trim(),
          content_sid: template.content_sid,
          template_nome: template.name,
          template_preview: template.body_preview,
        },
      });
      setStep(2);
      return;
    }
    const created = await criar.mutateAsync({
      nome: nome.trim(),
      content_sid: template.content_sid,
      template_nome: template.name,
      template_preview: template.body_preview,
    });
    setBroadcast(created);
    setStep(2);
  };

  const handleMontar = async () => {
    if (!broadcast) return;
    if (escopo === 'bu' && !bu) return toast.error('Escolha a BU');
    const filtro: Record<string, string | string[]> = {};
    if (stageIds.length > 0) filtro.stage_ids = stageIds;
    if (tags.length > 0) filtro.tags = tags;
    if (originId) filtro.origin_id = originId;
    try {
      await atualizar.mutateAsync({
        id: broadcast.id,
        patch: {
          filtro,
          limite_alvos: limite ? Number(limite) : null,
          escopo,
          bu: escopo === 'bu' ? bu : null,
        },
      });
      const res = await montar.mutateAsync(broadcast.id);
      setJaMontou(true);
      setPublicoMontadoEm(null);
      toast.success(`${res.elegiveis} vão receber · ${res.ignorados} ficam de fora`);
    } catch (err) {
      // o RPC levanta exceção quando o disparo não está mais em rascunho, ou
      // quando um SDR tenta usar o escopo de BU
      setJaMontou(false);
      toast.error(
        err instanceof Error && err.message ? err.message : 'Não foi possível montar o público',
      );
    }
  };



  const handleDisparar = async () => {
    if (!broadcast) return;
    await iniciar.mutateAsync(broadcast.id);
    setConfirmOpen(false);
    handleClose(false);
    navigate(`/checkin/disparos/${broadcast.id}`);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {rascunho ? 'Continuar rascunho' : 'Novo disparo'} · passo {step} de 3 ·{' '}
            {step === 1 ? 'Template' : step === 2 ? 'Público' : 'Revisão'}
          </DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <TemplateStep
            nome={nome}
            onNomeChange={setNome}
            selected={template}
            onSelect={setTemplate}
            sampleName={sampleName}
          />
        )}

        {step === 2 && broadcast && (
          <PublicoStep
            broadcast={broadcast}
            stageIds={stageIds}
            tags={tags}
            originId={originId}
            limite={limite}
            pendentes={pendentes ?? 0}
            montando={montar.isPending || atualizar.isPending}
            jaMontou={jaMontou}
            escopo={escopo}
            bu={bu}
            busDisponiveis={busDisponiveis}
            podeUsarBu={podeUsarBu}
            publicoMontadoEm={publicoMontadoEm}
            onEscopoChange={handleEscopoChange}
            onBuChange={handleBuChange}
            onStageIdsChange={handleStageIdsChange}
            onTagsChange={handleTagsChange}
            onOriginChange={handleOriginChange}
            onLimiteChange={handleLimiteChange}
            onMontar={handleMontar}
          />
        )}


        {step === 3 && broadcast && (
          <RevisaoStep
            broadcast={broadcast}
            template={templateAtual}
            pendentes={pendentes ?? 0}
            sampleName={sampleName}
            onBloqueioChange={setBloqueado}
          />
        )}

        <DialogFooter className="gap-2">
          {step > 1 && (
            <Button variant="outline" onClick={() => setStep(step - 1)}>
              Voltar
            </Button>
          )}
          {step === 1 && (
            <Button onClick={avancarParaPublico} disabled={criar.isPending || atualizar.isPending}>
              {(criar.isPending || atualizar.isPending) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Continuar
            </Button>
          )}
          {step === 2 && (
            <Button
              onClick={() => setStep(3)}
              disabled={!jaMontou || contagemIndisponivel || pendentes === 0}
            >
              Continuar
            </Button>
          )}
          {step === 3 && (
            <Button
              onClick={() => setConfirmOpen(true)}
              disabled={bloqueado || contagemIndisponivel}
            >
              <Send className="mr-2 h-4 w-4" /> Revisar e disparar
            </Button>
          )}
        </DialogFooter>

        <ConfirmarEnvioDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          destinatarios={pendentes}
          sending={iniciar.isPending}
          onConfirm={handleDisparar}
        />
      </DialogContent>
    </Dialog>
  );
}