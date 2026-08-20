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
          <Button onClick={() => setWizardOpen(true)}>
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
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  Carregando…
                </TableCell>
              </TableRow>
            ) : broadcasts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  Nenhum disparo criado ainda
                </TableCell>
              </TableRow>
            ) : (
              broadcasts.map((b) => (
                <TableRow key={b.id} className="cursor-pointer">
                  <TableCell className="font-medium">
                    <Link to={`/checkin/disparos/${b.id}`} className="hover:underline">
                      {b.nome}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {b.template_nome ?? b.content_sid}
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
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <CriarDisparoDialog open={wizardOpen} onOpenChange={setWizardOpen} />
    </div>
  );
}

function CriarDisparoDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const navigate = useNavigate();
  const { data: templates = [] } = useWaTemplates();
  const criar = useCreateWaBroadcast();
  const atualizar = useUpdateWaBroadcast();
  const montar = useMontarPublico();
  const iniciar = useIniciarBroadcast();

  const [step, setStep] = useState(1);
  const [nome, setNome] = useState('');
  const [template, setTemplate] = useState<WaTemplateOption | null>(null);
  const [broadcast, setBroadcast] = useState<WaBroadcast | null>(null);
  const [stageId, setStageId] = useState('');
  const [originId, setOriginId] = useState('');
  const [limite, setLimite] = useState('');
  const [jaMontou, setJaMontou] = useState(false);
  const [bloqueado, setBloqueado] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);

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
   * Qualquer mudança de filtro ou limite invalida o público já montado: o
   * limite só é persistido dentro do handleMontar, então seguir sem remontar
   * dispararia para a base inteira depois de um "Testar com 10".
   */
  const invalidarPublico = () => setJaMontou(false);
  const handleStageChange = (v: string) => {
    setStageId(v);
    invalidarPublico();
  };
  const handleOriginChange = (v: string) => {
    setOriginId(v);
    setStageId('');
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
    setStageId('');
    setOriginId('');
    setLimite('');
    setJaMontou(false);
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
    const filtro: Record<string, string> = {};
    if (stageId) filtro.stage_id = stageId;
    if (originId) filtro.origin_id = originId;
    try {
      await atualizar.mutateAsync({
        id: broadcast.id,
        patch: { filtro, limite_alvos: limite ? Number(limite) : null },
      });
      const res = await montar.mutateAsync(broadcast.id);
      setJaMontou(true);
      toast.success(`${res.elegiveis} vão receber · ${res.ignorados} ficam de fora`);
    } catch (err) {
      // o RPC levanta exceção quando o disparo não está mais em rascunho
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
            Novo disparo · passo {step} de 3 ·{' '}
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
            stageId={stageId}
            originId={originId}
            limite={limite}
            pendentes={pendentes ?? 0}
            montando={montar.isPending || atualizar.isPending}
            jaMontou={jaMontou}
            onStageChange={handleStageChange}
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