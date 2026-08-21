import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useConfirmarContratacaoEmbracon } from '@/hooks/useConfirmarContratacaoEmbracon';
import type { CotaReservada } from '@/hooks/useConsorcioCotasOrigem';

const hojeIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * Confirma que a Embracon devolveu o cadastro da cota: grava a data de
 * contratação, o número do contrato e anexa o retorno da administradora
 * (documento "Confirmação Embracon" — NÃO confundir com o Comprovante de
 * Cadastro que a MCF gera para o cliente).
 */
export function ConfirmarContratacaoModal({
  open,
  onOpenChange,
  cota,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  cota: CotaReservada | null;
}) {
  const confirmar = useConfirmarContratacaoEmbracon();
  const [data, setData] = useState(hojeIso());
  const [contrato, setContrato] = useState('');
  const [grupo, setGrupo] = useState('');
  const [cotaNum, setCotaNum] = useState('');
  const [diaVenc, setDiaVenc] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [semComprovante, setSemComprovante] = useState(false);
  const [motivo, setMotivo] = useState('');

  useEffect(() => {
    if (!open) return;
    setData(hojeIso());
    setContrato(cota?.contrato_embracon || '');
    setGrupo(cota?.grupo || '');
    setCotaNum(cota?.cota || '');
    setDiaVenc(cota?.dia_vencimento ? String(cota.dia_vencimento) : '');
    setFile(null);
    setSemComprovante(false);
    setMotivo('');
  }, [open, cota?.id, cota?.contrato_embracon, cota?.grupo, cota?.cota, cota?.dia_vencimento]);

  const handleConfirm = async () => {
    if (!cota) return;
    if (!data) {
      toast.error('Informe a data de contratação');
      return;
    }
    if (!semComprovante && !file) {
      toast.error('Anexe o documento de confirmação da Embracon');
      return;
    }
    if (semComprovante && motivo.trim().length < 10) {
      toast.error('Descreva o motivo da confirmação sem comprovante (mínimo 10 caracteres)');
      return;
    }
    const dia = Number(diaVenc);
    if (!dia || dia < 1 || dia > 31) {
      toast.error('Informe o dia de vencimento devolvido pela Embracon (1 a 31)');
      return;
    }
    if (!grupo.trim() || !cotaNum.trim()) {
      toast.error('Informe o grupo e a cota devolvidos pela Embracon');
      return;
    }
    try {
      await confirmar.mutateAsync({
        cardId: cota.id,
        dataContratacao: data,
        contratoEmbracon: contrato,
        grupo,
        cota: cotaNum,
        diaVencimento: dia,
        file: semComprovante ? null : file,
        motivoSemComprovante: semComprovante ? motivo : null,
      });
      onOpenChange(false);
    } catch {
      // Erro já é avisado pela mutation de conversão; o modal fica aberto para
      // nova tentativa (o fluxo é idempotente e não duplica documento/motivo).
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5" /> Confirmar contratação
          </DialogTitle>
          <DialogDescription>
            {cota
              ? `${cota.nome}${cota.grupo || cota.cota ? ` · Grupo ${cota.grupo || '—'} / Cota ${cota.cota || '—'}` : ' · reserva sem grupo/cota'}. `
              : ''}
            Ao confirmar, a cota sai da fila de reservas e passa a contar na etapa Cotas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="data-contratacao">Data de contratação</Label>
              <Input id="data-contratacao" type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="contrato-embracon">Contrato na Embracon</Label>
              <Input
                id="contrato-embracon"
                value={contrato}
                onChange={(e) => setContrato(e.target.value)}
                placeholder="Nº do contrato"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="grupo-embracon">Grupo</Label>
              <Input
                id="grupo-embracon"
                value={grupo}
                onChange={(e) => setGrupo(e.target.value)}
                placeholder="Grupo informado pela Embracon"
              />
            </div>
            <div>
              <Label htmlFor="cota-embracon">Cota</Label>
              <Input
                id="cota-embracon"
                value={cotaNum}
                onChange={(e) => setCotaNum(e.target.value)}
                placeholder="Cota informada pela Embracon"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="dia-vencimento-embracon">Dia de vencimento</Label>
            <Input
              id="dia-vencimento-embracon"
              type="number"
              min={1}
              max={31}
              value={diaVenc}
              onChange={(e) => setDiaVenc(e.target.value)}
              placeholder="Dia informado pela Embracon"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Na abertura o dia fica "A definir". É aqui, com o retorno da Embracon, que ele passa a valer — o
              cronograma de parcelas é gerado/recalculado com esse dia.
            </p>
          </div>

          {!semComprovante ? (
            <div>
              <Label htmlFor="doc-confirmacao">Confirmação Embracon (obrigatório)</Label>
              <Input
                id="doc-confirmacao"
                type="file"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                O retorno da administradora comprovando o cadastro da cota.
              </p>
              <button
                type="button"
                className="mt-2 text-xs text-muted-foreground underline hover:text-foreground"
                onClick={() => setSemComprovante(true)}
              >
                Confirmar sem comprovante
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  A cota será marcada com o selo <strong>sem comprovante</strong> na lista de confirmadas. O
                  motivo fica registrado nas observações com data e usuário.
                </AlertDescription>
              </Alert>
              <div>
                <Label htmlFor="motivo-sem-comprovante">Motivo (obrigatório)</Label>
                <Textarea
                  id="motivo-sem-comprovante"
                  rows={3}
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Explique por que a confirmação está sendo feita sem o retorno da Embracon"
                />
              </div>
              <button
                type="button"
                className="text-xs text-muted-foreground underline hover:text-foreground"
                onClick={() => setSemComprovante(false)}
              >
                Voltar e anexar o comprovante
              </button>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={confirmar.isPending}>
            {confirmar.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar contratação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
