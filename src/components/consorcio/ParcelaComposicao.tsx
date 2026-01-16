import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { CalculoParcela } from '@/types/consorcioProdutos';
import { formatCurrency } from '@/lib/consorcioCalculos';

interface ParcelaComposicaoProps {
  calculo: CalculoParcela;
  prazo: number;
  incluiSeguro: boolean;
  taxaAntecipadaTipo: 'primeira_parcela' | 'dividida_12';
  usandoTabelaOficial?: boolean;
}

export function ParcelaComposicao({
  calculo,
  prazo,
  incluiSeguro,
  taxaAntecipadaTipo,
  usandoTabelaOficial,
}: ParcelaComposicaoProps) {
  return (
    <Card className="bg-muted/30 border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          Composição da Parcela
          <Badge variant="outline" className="text-xs font-normal">
            {prazo} meses
          </Badge>
          {usandoTabelaOficial && (
            <Badge variant="default" className="text-xs font-normal bg-green-600 hover:bg-green-700">
              ✓ Tabela Oficial
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Componentes da parcela */}
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Fundo Comum (FC)</span>
            <span className="font-medium">{formatCurrency(calculo.fundoComum)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Taxa de Administração</span>
            <span className="font-medium">{formatCurrency(calculo.taxaAdm)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Fundo de Reserva (2%)</span>
            <span className="font-medium">{formatCurrency(calculo.fundoReserva)}</span>
          </div>
          {incluiSeguro && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Seguro de Vida</span>
              <span className="font-medium">{formatCurrency(calculo.seguroVida)}</span>
            </div>
          )}
          {taxaAntecipadaTipo === 'dividida_12' && (
            <div className="flex justify-between text-primary">
              <span>Taxa Antecipada (÷12)</span>
              <span className="font-medium">{formatCurrency(calculo.taxaAntecipada / 12)}</span>
            </div>
          )}
        </div>

        <Separator />

        {/* Valores das parcelas */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <div>
              <span className="font-medium">1ª a 12ª Parcela</span>
              {taxaAntecipadaTipo === 'primeira_parcela' && (
                <p className="text-xs text-muted-foreground">
                  1ª parcela: +{formatCurrency(calculo.taxaAntecipada)} (taxa)
                </p>
              )}
            </div>
            <span className="text-lg font-bold text-primary">
              {formatCurrency(calculo.parcela1a12)}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="font-medium">13ª em diante</span>
            <span className="text-lg font-bold">
              {formatCurrency(calculo.parcelaDemais)}
            </span>
          </div>
        </div>

        <Separator />

        {/* Total estimado */}
        <div className="flex justify-between items-center pt-1">
          <span className="text-muted-foreground text-sm">Total estimado do plano</span>
          <span className="font-semibold">{formatCurrency(calculo.totalPago)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
