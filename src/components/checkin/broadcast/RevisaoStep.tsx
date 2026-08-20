import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle, CheckCircle2, Loader2, ShieldAlert } from 'lucide-react';
import {
  useIgnorarNomeInvalido,
  useValidarBroadcast,
  useWaSaldoHoje,
  WaBroadcast,
  WaTemplateOption,
} from '@/hooks/wa/useWaBroadcasts';
import { interpolarPreview, PROBLEMAS_BLOQUEANTES, problemaLabel } from './waBroadcastLabels';
import { useEffect } from 'react';

interface Props {
  broadcast: WaBroadcast;
  template: WaTemplateOption | null;
  pendentes: number;
  sampleName: string | null;
  onBloqueioChange: (bloqueado: boolean) => void;
}

export function RevisaoStep({ broadcast, template, pendentes, sampleName, onBloqueioChange }: Props) {
  const { data: problemas = [], isLoading, error } = useValidarBroadcast(broadcast.id);
  const { data: saldoInfo } = useWaSaldoHoje();
  const ignorarNomes = useIgnorarNomeInvalido();

  const bloqueantes = problemas.filter((p) => PROBLEMAS_BLOQUEANTES.has(p.problema));
  const avisos = problemas.filter((p) => !PROBLEMAS_BLOQUEANTES.has(p.problema));
  const temNomeInvalido = problemas.some((p) => p.problema === 'nome_invalido');

  // erro na validação também bloqueia — não deixamos disparar às cegas
  const bloqueado = isLoading || !!error || bloqueantes.length > 0 || pendentes === 0;
  useEffect(() => {
    onBloqueioChange(bloqueado);
  }, [bloqueado, onBloqueioChange]);

  const saldo = saldoInfo?.saldo ?? 0;
  const excede = pendentes > saldo;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-2 pt-4">
          <p className="text-sm">
            <span className="text-muted-foreground">Template: </span>
            <span className="font-medium">{broadcast.template_nome ?? broadcast.content_sid}</span>
          </p>
          <p className="text-sm">
            <span className="text-muted-foreground">Vão receber: </span>
            <span className="font-medium">{pendentes}</span>
          </p>
          <div className="whitespace-pre-wrap rounded-lg bg-muted p-3 text-sm">
            {interpolarPreview(template?.body_preview ?? broadcast.template_preview, sampleName)}
          </div>
        </CardContent>
      </Card>

      {isLoading && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Validando o disparo…
        </p>
      )}

      {error && (
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Não foi possível validar</AlertTitle>
          <AlertDescription>
            {error instanceof Error ? error.message : 'Erro na validação'} — o envio fica bloqueado até
            a validação rodar.
          </AlertDescription>
        </Alert>
      )}

      {bloqueantes.map((p) => (
        <Alert variant="destructive" key={p.problema + p.detalhe}>
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>
            {problemaLabel(p.problema)} · {p.quantidade}
          </AlertTitle>
          <AlertDescription>
            {p.problema === 'variavel_sem_valor'
              ? `${p.detalhe} — este template exige um dado individual por pessoa que o disparo em massa não tem como preencher. Escolha um template que use só o nome, ou envie pelo inbox, conversa por conversa.`
              : `${p.detalhe} — envio bloqueado.`}
          </AlertDescription>
        </Alert>
      ))}


      {avisos.map((p) => (
        <Alert key={p.problema + p.detalhe}>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>
            {problemaLabel(p.problema)} · {p.quantidade}
          </AlertTitle>
          <AlertDescription>{p.detalhe}</AlertDescription>
        </Alert>
      ))}

      {temNomeInvalido && (
        <Button
          type="button"
          variant="outline"
          onClick={() => ignorarNomes.mutate(broadcast.id)}
          disabled={ignorarNomes.isPending}
        >
          {ignorarNomes.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Ignorar quem está com o telefone no lugar do nome
        </Button>
      )}

      {!isLoading && !error && problemas.length === 0 && (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>Nenhum problema encontrado</AlertTitle>
          <AlertDescription>O disparo está pronto para sair.</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="pt-4 text-sm">
          <p className="text-muted-foreground">
            Saldo de hoje: <span className="font-medium text-foreground">{saldo}</span> mensagem(ns) ·
            já enviadas hoje: {saldoInfo?.enviadosHoje ?? 0}
          </p>
          {excede && (
            <p className="mt-1">
              {pendentes} alvos, {saldo} cabem hoje. O resto continua amanhã automaticamente.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}