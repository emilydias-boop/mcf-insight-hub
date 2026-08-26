import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
import { ArrowDown, ArrowUp, ClipboardList, Info, Plus, RefreshCw, Trash2, Upload } from 'lucide-react';
import { useSalesScript, type MeetingType, type ScriptStepInput } from '@/hooks/useSalesScript';

interface DraftStep extends ScriptStepInput {
  key: string;
}

let keyCounter = 0;
const novaKey = () => `etapa-${Date.now()}-${keyCounter++}`;

export default function ScriptVendas() {
  const [meetingType, setMeetingType] = useState<MeetingType>('r1');
  const { data: etapasAtivas, isLoading, publicar, reavaliar } = useSalesScript(meetingType);

  const [draft, setDraft] = useState<DraftStep[]>([]);
  const [erros, setErros] = useState<Record<string, { etapa?: boolean; criterio?: boolean }>>({});
  const [confirmPublicar, setConfirmPublicar] = useState(false);
  const [confirmReavaliar, setConfirmReavaliar] = useState(false);

  useEffect(() => {
    if (!etapasAtivas) return;
    setDraft(
      etapasAtivas.map((e) => ({
        key: e.id,
        ordem: e.ordem,
        etapa: e.etapa,
        descricao: e.descricao ?? '',
        criterio: e.criterio,
        peso: Number(e.peso) || 1,
        obrigatoria: e.obrigatoria,
      })),
    );
    setErros({});
  }, [etapasAtivas]);

  const versaoAtual = etapasAtivas?.[0]?.versao ?? null;
  const pesoTotal = useMemo(
    () => draft.reduce((acc, e) => acc + (Number(e.peso) || 0), 0),
    [draft],
  );

  const atualizar = (key: string, patch: Partial<DraftStep>) => {
    setDraft((prev) => prev.map((e) => (e.key === key ? { ...e, ...patch } : e)));
  };

  const mover = (index: number, direcao: -1 | 1) => {
    const destino = index + direcao;
    if (destino < 0 || destino >= draft.length) return;
    setDraft((prev) => {
      const copia = [...prev];
      [copia[index], copia[destino]] = [copia[destino], copia[index]];
      return copia;
    });
  };

  const remover = (key: string) => setDraft((prev) => prev.filter((e) => e.key !== key));

  const adicionar = () =>
    setDraft((prev) => [
      ...prev,
      {
        key: novaKey(),
        ordem: prev.length + 1,
        etapa: '',
        descricao: '',
        criterio: '',
        peso: 1,
        obrigatoria: true,
      },
    ]);

  const validar = () => {
    const novos: Record<string, { etapa?: boolean; criterio?: boolean }> = {};
    draft.forEach((e) => {
      const falhas: { etapa?: boolean; criterio?: boolean } = {};
      if (!e.etapa.trim()) falhas.etapa = true;
      if (!e.criterio.trim()) falhas.criterio = true;
      if (falhas.etapa || falhas.criterio) novos[e.key] = falhas;
    });
    setErros(novos);
    return Object.keys(novos).length === 0;
  };

  const abrirPublicar = () => {
    if (draft.length === 0) {
      toast.error('Adicione pelo menos uma etapa antes de publicar.');
      return;
    }
    if (!validar()) {
      toast.error('Existem etapas com nome ou critério em branco.');
      return;
    }
    setConfirmPublicar(true);
  };

  const executarPublicar = async () => {
    try {
      const payload: ScriptStepInput[] = draft.map((e, i) => ({
        ordem: i + 1,
        etapa: e.etapa.trim(),
        descricao: e.descricao?.trim() ? e.descricao.trim() : null,
        criterio: e.criterio.trim(),
        peso: Number(e.peso) || 0,
        obrigatoria: e.obrigatoria,
      }));
      const res = await publicar.mutateAsync(payload);
      toast.success(
        res?.versao
          ? `Versão ${res.versao} publicada com ${res.etapas ?? payload.length} etapas.`
          : 'Nova versão publicada.',
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível publicar a versão.');
    }
  };

  const executarReavaliar = async () => {
    try {
      const res = await reavaliar.mutateAsync(meetingType);
      toast.success(`${res?.reenfileiradas ?? 0} reunião(ões) reenfileirada(s) para reanálise.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível reenfileirar as reuniões.');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <ClipboardList className="h-5 w-5 text-primary" />
            Script de vendas
          </h1>
          <p className="text-sm text-muted-foreground">
            Etapas que a IA usa para avaliar a aderência das reuniões gravadas.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setConfirmReavaliar(true)}
            disabled={reavaliar.isPending}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Reavaliar reuniões com este script
          </Button>
          <Button onClick={abrirPublicar} disabled={publicar.isPending}>
            <Upload className="mr-2 h-4 w-4" />
            Publicar nova versão
          </Button>
        </div>
      </div>

      <Tabs value={meetingType} onValueChange={(v) => setMeetingType(v as MeetingType)}>
        <TabsList>
          <TabsTrigger value="r1">R1</TabsTrigger>
          <TabsTrigger value="r2">R2</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-2 p-4">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">
              {versaoAtual ? `Versão ${versaoAtual}` : 'Sem versão ativa'} · {draft.length} etapa(s)
            </Badge>
            <Badge variant="outline">Peso total: {pesoTotal.toLocaleString('pt-BR')}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            A aderência é a soma dos pesos das etapas cumpridas dividida pela soma dos pesos
            aplicáveis. Etapas marcadas como não aplicáveis saem das duas somas.
          </p>
        </CardContent>
      </Card>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Descrição x Critério</AlertTitle>
        <AlertDescription className="space-y-1 text-sm">
          <p>
            A <strong>descrição</strong> é para humanos entenderem o que é a etapa. O{' '}
            <strong>critério</strong> é a regra objetiva que a IA aplica para dizer se a etapa foi
            cumprida. Critérios vagos produzem avaliações inconsistentes.
          </p>
          <p>
            Bom: “O lead declara um objetivo com número ou prazo, provocado por pergunta do closer”.
          </p>
          <p>Ruim: “O closer faz um bom diagnóstico”.</p>
        </AlertDescription>
      </Alert>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : (
        <div className="space-y-3">
          {draft.length === 0 && (
            <Card>
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                Nenhuma etapa cadastrada para {meetingType.toUpperCase()}.
              </CardContent>
            </Card>
          )}

          {draft.map((etapa, index) => {
            const erro = erros[etapa.key];
            return (
              <Card key={etapa.key}>
                <CardContent className="space-y-4 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <Badge variant="outline" className="mt-1">
                      Etapa {index + 1}
                    </Badge>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => mover(index, -1)}
                        disabled={index === 0}
                        aria-label="Mover para cima"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => mover(index, 1)}
                        disabled={index === draft.length - 1}
                        aria-label="Mover para baixo"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => remover(etapa.key)}
                        aria-label="Remover etapa"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Nome da etapa</Label>
                    <Input
                      value={etapa.etapa}
                      onChange={(e) => atualizar(etapa.key, { etapa: e.target.value })}
                      placeholder="Ex.: Diagnóstico de objetivo"
                      aria-invalid={!!erro?.etapa}
                      className={erro?.etapa ? 'border-destructive' : undefined}
                    />
                    {erro?.etapa && (
                      <p className="text-xs text-destructive">Informe o nome da etapa.</p>
                    )}
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Descrição (para humanos)</Label>
                      <Textarea
                        value={etapa.descricao ?? ''}
                        onChange={(e) => atualizar(etapa.key, { descricao: e.target.value })}
                        rows={4}
                        placeholder="O que acontece nesta etapa da reunião"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Critério (regra objetiva da IA)</Label>
                      <Textarea
                        value={etapa.criterio}
                        onChange={(e) => atualizar(etapa.key, { criterio: e.target.value })}
                        rows={4}
                        placeholder="Ex.: O lead declara um objetivo com número ou prazo, provocado por pergunta do closer"
                        aria-invalid={!!erro?.criterio}
                        className={erro?.criterio ? 'border-destructive' : undefined}
                      />
                      {erro?.criterio && (
                        <p className="text-xs text-destructive">Informe o critério objetivo.</p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-6">
                    <div className="space-y-1.5">
                      <Label>Peso</Label>
                      <Input
                        type="number"
                        step={0.5}
                        min={0}
                        value={etapa.peso}
                        onChange={(e) =>
                          atualizar(etapa.key, { peso: e.target.value === '' ? 0 : Number(e.target.value) })
                        }
                        className="w-28"
                      />
                    </div>
                    <div className="flex items-center gap-2 pt-5">
                      <Switch
                        checked={etapa.obrigatoria}
                        onCheckedChange={(v) => atualizar(etapa.key, { obrigatoria: v })}
                        id={`obrigatoria-${etapa.key}`}
                      />
                      <Label htmlFor={`obrigatoria-${etapa.key}`} className="cursor-pointer">
                        Obrigatória
                      </Label>
                      {!etapa.obrigatoria && (
                        <span className="text-xs text-muted-foreground">
                          A IA pode marcar “não aplicável”.
                        </span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          <Button variant="outline" onClick={adicionar} className="w-full">
            <Plus className="mr-2 h-4 w-4" />
            Adicionar etapa
          </Button>
        </div>
      )}

      <AlertDialog open={confirmPublicar} onOpenChange={setConfirmPublicar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publicar nova versão do script?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso cria uma versão nova do script de {meetingType.toUpperCase()} e desativa a
              anterior. As avaliações antigas continuam guardadas com a versão em que foram feitas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={executarPublicar}>Publicar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmReavaliar} onOpenChange={setConfirmReavaliar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reavaliar reuniões com este script?</AlertDialogTitle>
            <AlertDialogDescription>
              Todas as reuniões de {meetingType.toUpperCase()} já transcritas voltam para a fila e
              serão reanalisadas pela IA. Isso leva algum tempo e consome cota de análise.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={executarReavaliar}>Reavaliar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
