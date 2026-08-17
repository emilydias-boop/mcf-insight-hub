import { useState } from 'react';
import { format } from 'date-fns';
import { Ban, Copy, Download, FileSignature, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { useCancelTermo, termoPublicUrl, type ConsorcioTermo } from '@/hooks/useConsorcioTermos';
import { baixarTermoPdf } from '@/lib/consorcioTermo';

const STATUS_LABEL: Record<string, string> = {
  pendente: 'Aguardando assinatura',
  assinado: 'Assinado',
  expirado: 'Expirado',
  cancelado: 'Cancelado',
};

export function TermoPanelDialog({
  open,
  onOpenChange,
  termos,
  clienteNome,
  onGerarNovo,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  termos: ConsorcioTermo[];
  clienteNome: string;
  onGerarNovo: () => void;
}) {
  const cancelMut = useCancelTermo();
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [motivo, setMotivo] = useState('');

  const copy = async (token: string) => {
    await navigator.clipboard.writeText(termoPublicUrl(token));
    toast.success('Link copiado');
  };

  const download = async (t: ConsorcioTermo) => {
    await baixarTermoPdf({
      conteudo: t.conteudo_renderizado,
      clienteNome,
      certificado: t.status === 'assinado' ? t : null,
    });
  };

  const temPendente = termos.some((t) => t.status === 'pendente');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSignature className="h-5 w-5" /> Termos de Adesão — {clienteNome}
          </DialogTitle>
          <DialogDescription>Link de assinatura, status e download do documento.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {termos.map((t) => (
            <div key={t.id} className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <Badge
                  variant="outline"
                  className={
                    t.status === 'assinado'
                      ? 'border-emerald-500/60 text-emerald-600'
                      : t.status === 'pendente'
                        ? 'border-amber-500/60 text-amber-600'
                        : 'text-muted-foreground'
                  }
                >
                  {STATUS_LABEL[t.status] || t.status}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  Emitido em {format(new Date(t.created_at), 'dd/MM/yyyy HH:mm')}
                  {t.modelo_versao ? ` · modelo v${t.modelo_versao}` : ''}
                </span>
              </div>

              {t.status === 'pendente' && (
                <>
                  <div className="flex gap-2">
                    <Input readOnly value={termoPublicUrl(t.access_token)} className="font-mono text-xs" />
                    <Button variant="outline" size="sm" onClick={() => copy(t.access_token)}>
                      <Copy className="h-4 w-4 mr-1" /> Copiar
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Válido até {format(new Date(t.expires_at), 'dd/MM/yyyy')}
                  </p>
                </>
              )}

              {t.status === 'assinado' && (
                <div className="text-sm space-y-1">
                  <p>
                    Assinado por <strong>{t.assinante_nome}</strong> (CPF {t.assinante_cpf}) em{' '}
                    {t.assinado_em
                      ? new Date(t.assinado_em).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
                      : '—'}
                  </p>
                  <p className="text-xs text-muted-foreground break-all">
                    IP {t.assinante_ip || '—'} · hash {t.conteudo_hash}
                  </p>
                </div>
              )}

              {t.status === 'cancelado' && (
                <p className="text-sm text-muted-foreground">
                  Cancelado{t.cancelado_em ? ` em ${format(new Date(t.cancelado_em), 'dd/MM/yyyy')}` : ''}
                  {t.cancelado_motivo ? ` — ${t.cancelado_motivo}` : ''}
                </p>
              )}

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => download(t)}>
                  <Download className="h-4 w-4 mr-1" /> Baixar PDF
                </Button>
                {t.status === 'pendente' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => {
                      setMotivo('');
                      setCancelId(t.id);
                    }}
                  >
                    <Ban className="h-4 w-4 mr-1" /> Cancelar termo
                  </Button>
                )}
              </div>

              {cancelId === t.id && (
                <div className="space-y-2 rounded-md bg-muted/40 p-3">
                  <Label htmlFor={`motivo-${t.id}`}>Motivo do cancelamento *</Label>
                  <Textarea
                    id={`motivo-${t.id}`}
                    rows={3}
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    placeholder="Ex.: dados do crédito corrigidos, termo será reemitido."
                  />
                  <div className="flex gap-2 justify-end">
                    <Button variant="ghost" size="sm" onClick={() => setCancelId(null)}>
                      Voltar
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={!motivo.trim() || cancelMut.isPending}
                      onClick={async () => {
                        await cancelMut.mutateAsync({ termoId: t.id, motivo: motivo.trim() });
                        setCancelId(null);
                      }}
                    >
                      {cancelMut.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                      Confirmar cancelamento
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          {!temPendente && (
            <Button
              onClick={() => {
                onOpenChange(false);
                onGerarNovo();
              }}
            >
              <FileSignature className="h-4 w-4 mr-1" /> Gerar novo termo
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
