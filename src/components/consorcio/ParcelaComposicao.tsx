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
  /** Valor do plano/tabela (o que vale de verdade) para comparar com a estimativa. */
  valorOficial1a12?: number | null;
  /** Valor do plano/tabela das parcelas de 13ª em diante. */
  valorOficialDemais?: number | null;
}

export function ParcelaComposicao({
  calculo,
  prazo,
  incluiSeguro,
  taxaAntecipadaTipo,
  usandoTabelaOficial,
  valorOficial1a12,
  valorOficialDemais,
}: ParcelaComposicaoProps) {
  const estimado1a12 =
    taxaAntecipadaTipo === 'primeira_parcela' && !usandoTabelaOficial
      ? calculo.parcela1a12 + calculo.taxaAntecipada
      : calculo.parcela1a12;
  const centavos = (n: number) => Math.round(n * 100);
  const div1a12 =
    valorOficial1a12 != null && valorOficial1a12 > 0 && centavos(valorOficial1a12) !== centavos(estimado1a12)
      ? valorOficial1a12 - estimado1a12
      : null;
  const divDemais =
    valorOficialDemais != null && valorOficialDemais > 0 && centavos(valorOficialDemais) !== centavos(calculo.parcelaDemais)
      ? valorOficialDemais - calculo.parcelaDemais
      : null;
  const temDivergencia = div1a12 != null || divDemais != null;

  return (
    <Card className="bg-muted/20 border-muted">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          Composição da parcela (estimativa)
          <Badge variant="outline" className="text-[10px] font-normal">
            {prazo} meses
          </Badge>
          {usandoTabelaOficial && (
            <Badge variant="outline" className="text-[10px] font-normal">
              valores da tabela
            </Badge>
          )}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Isto é só o detalhamento estimado de como a parcela se forma. O valor que vale — e que é gravado — é o do
          plano/tabela nos campos abaixo.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Componentes da parcela */}
        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Fundo Comum (FC)</span>
            <span>{formatCurrency(calculo.fundoComum)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Taxa de Administração</span>
            <span>{formatCurrency(calculo.taxaAdm)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Fundo de Reserva (2%)</span>
            <span>{formatCurrency(calculo.fundoReserva)}</span>
          </div>
          {incluiSeguro && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Seguro de Vida</span>
              <span>{formatCurrency(calculo.seguroVida)}</span>
            </div>
          )}
          {taxaAntecipadaTipo === 'dividida_12' && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Taxa Antecipada (÷12)</span>
              <span>{formatCurrency(calculo.taxaAntecipada / 12)}</span>
            </div>
          )}
        </div>

        <Separator />

        {/* Valores estimados das parcelas — tipografia de detalhamento, não de resultado */}
        <div className="space-y-1.5 text-xs">
          {taxaAntecipadaTipo === 'primeira_parcela' ? (
            <>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">
                  1ª parcela estimada
                  {!usandoTabelaOficial && ' (inclui taxa antecipada de 2%)'}
                </span>
                <span className="font-medium">{formatCurrency(estimado1a12)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Demais parcelas estimadas</span>
                <span className="font-medium">{formatCurrency(calculo.parcelaDemais)}</span>
              </div>
            </>
          ) : (
            <>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">1ª a 12ª parcela estimada (taxa de 1,2% diluída)</span>
                <span className="font-medium">{formatCurrency(estimado1a12)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">13ª em diante, estimada</span>
                <span className="font-medium">{formatCurrency(calculo.parcelaDemais)}</span>
              </div>
            </>
          )}
        </div>

        {temDivergencia && (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2 space-y-1">
            <p className="text-xs text-amber-600 dark:text-amber-400">
              A estimativa acima não bate com o valor do plano. Quem manda é o plano — é ele que a Embracon cobra e é ele
              que o sistema grava.
            </p>
            {div1a12 != null && (
              <p className="text-xs text-muted-foreground">
                1ª a 12ª: plano {formatCurrency(valorOficial1a12 as number)} · estimativa {formatCurrency(estimado1a12)} ·
                diferença {formatCurrency(Math.abs(div1a12))}
              </p>
            )}
            {divDemais != null && (
              <p className="text-xs text-muted-foreground">
                Demais: plano {formatCurrency(valorOficialDemais as number)} · estimativa{' '}
                {formatCurrency(calculo.parcelaDemais)} · diferença {formatCurrency(Math.abs(divDemais))}
              </p>
            )}
          </div>
        )}

        <Separator />

        {/* Total estimado */}
        <div className="flex justify-between items-center text-xs">
          <span className="text-muted-foreground">Total estimado do plano</span>
          <span className="font-medium">{formatCurrency(calculo.totalPago)}</span>
        </div>

      </CardContent>
    </Card>
  );
}
