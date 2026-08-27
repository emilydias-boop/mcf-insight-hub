import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { PARCELAS_MARCAVEIS } from '@/types/consorcioCartas';

interface ParcelasMcfPickerProps {
  value: number[];
  onChange: (v: number[]) => void;
  /** Quantas parcelas ficam marcáveis. Padrão: as 12 primeiras. */
  max?: number;
  disabled?: boolean;
  /** Rótulo do bloco. */
  label?: string;
}

/**
 * Seletor controlado das parcelas que a MCF assume — fonte única usada tanto no
 * editor de cartas (intenção do closer) quanto no cadastro manual de cota.
 * Puro: não guarda estado nem grava nada, só devolve a lista ordenada.
 */
export function ParcelasMcfPicker({
  value,
  onChange,
  max = PARCELAS_MARCAVEIS,
  disabled = false,
  label = 'Parcelas que a MCF paga',
}: ParcelasMcfPickerProps) {
  const selecionadas = value || [];

  const toggle = (n: number) => {
    if (disabled) return;
    onChange(
      selecionadas.includes(n)
        ? selecionadas.filter(p => p !== n)
        : [...selecionadas, n].sort((a, b) => a - b),
    );
  };

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label className="text-xs">{label}</Label>
        <span className="text-xs font-medium">
          MCF paga {selecionadas.length} de {max}
        </span>
      </div>

      <div className="flex flex-wrap gap-1">
        {Array.from({ length: max }, (_, k) => k + 1).map(n => {
          const mcf = selecionadas.includes(n);
          return (
            <Button
              key={n}
              type="button"
              size="sm"
              variant={mcf ? 'default' : 'outline'}
              className="h-7 w-9 p-0 text-xs tabular-nums"
              aria-pressed={mcf}
              aria-label={`Parcela ${n} — ${mcf ? 'MCF paga' : 'cliente paga'}`}
              disabled={disabled}
              onClick={() => toggle(n)}
            >
              {n}
            </Button>
          );
        })}
      </div>

      <p className="text-[11px] text-muted-foreground">
        {selecionadas.length > 0 ? (
          <>
            Selecionadas:{' '}
            <span className="font-medium tabular-nums text-foreground">
              {selecionadas.join(', ')}
            </span>{' '}
            — são exatamente essas parcelas que a MCF assume (a 1ª só entra se
            estiver marcada).
          </>
        ) : (
          <>Nenhuma parcela marcada: o cliente paga desde a 1ª.</>
        )}
      </p>
    </div>
  );
}
