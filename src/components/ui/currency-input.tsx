import * as React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { formatBRLInput, parseBRLInput } from '@/lib/brlMask';

const PLACEHOLDER_PADRAO = 'Digite o valor';
const EMPTY_HINT_PADRAO = 'Campo vazio — digite o valor.';

/**
 * Placeholder numérico é proibido: em produção um placeholder "150.000,00"
 * foi lido como valor já preenchido e travou o lançamento da venda. Se a tela
 * passar algo que pareça número, o componente descarta e usa o texto padrão —
 * a trava existe para o padrão não voltar por copiar-e-colar.
 */
function sanitizarPlaceholder(placeholder?: string): string {
  if (!placeholder) return PLACEHOLDER_PADRAO;
  const semMoeda = placeholder.replace(/[R$\s.,]/g, '');
  const pareceNumero = semMoeda.length > 0 && /^\d+$/.test(semMoeda);
  return pareceNumero ? PLACEHOLDER_PADRAO : placeholder;
}

export interface CurrencyInputProps {
  /** Sempre mascarado no padrão pt-BR: "150.000,00". */
  value: string;
  /** Opcional: telas que guardam número no estado usam só `onNumberChange`. */
  onChange?: (masked: string) => void;
  /** Conveniência para telas que guardam número no estado. */
  onNumberChange?: (value: number) => void;
  label?: string;
  required?: boolean;
  /** Normalmente o `mostrarErros` da tela: pinta o aviso de vermelho. */
  showError?: boolean;
  placeholder?: string;
  emptyHint?: string;
  helperText?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
  /** Classes do <input> — telas densas usam h-9. */
  inputClassName?: string;
  /** Prefixo exibido dentro do campo. */
  prefix?: string;
}




export function CurrencyInput({
  value,
  onChange,
  onNumberChange,
  label,
  required,
  showError,
  placeholder,
  emptyHint,
  helperText,
  disabled,
  id,
  className,
  inputClassName,
  prefix = 'R$',

}: CurrencyInputProps) {
  const autoId = React.useId();
  const inputId = id || autoId;

  // Zero conta como vazio: R$ 0,00 nunca é um valor de venda válido.
  const vazio = parseBRLInput(value) <= 0;
  const mostrarVazio = !!required && vazio;

  const handleChange = (raw: string) => {
    const masked = formatBRLInput(raw);
    onChange?.(masked);
    onNumberChange?.(parseBRLInput(masked));
  };

  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <Label htmlFor={inputId}>
          {label}
          {required && <span className="ml-0.5 text-destructive">*</span>}
        </Label>
      )}
      <div className="relative">
        {prefix && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            {prefix}
          </span>
        )}
        <Input
          id={inputId}
          type="text"
          inputMode="decimal"
          value={value}
          disabled={disabled}
          placeholder={sanitizarPlaceholder(placeholder)}
          onChange={e => handleChange(e.target.value)}
          className={cn(
            prefix && 'pl-10',
            inputClassName,
            mostrarVazio && showError && 'border-destructive focus-visible:ring-destructive',

          )}
        />
      </div>
      {mostrarVazio && (
        <p className={cn('text-xs', showError ? 'text-destructive' : 'text-muted-foreground')}>
          {emptyHint || EMPTY_HINT_PADRAO}
        </p>
      )}
      {helperText && !mostrarVazio && (
        <p className="text-xs text-muted-foreground">{helperText}</p>
      )}
    </div>
  );
}
