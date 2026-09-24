import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  CREDITO_QUALIFICATION_QUESTIONS,
  creditoVisibleQuestions,
  creditoAnswerOk,
  parseMoney,
  previewCreditoIcp,
  type CreditoAnswers,
  type CreditoQuestion,
} from './CreditoQualificationQuestions';

interface Props {
  answers: CreditoAnswers;
  onChange: (answers: CreditoAnswers) => void;
  disabled?: boolean;
}

/**
 * Ao trocar a modalidade, limpa as respostas das perguntas condicionais
 * (showWhen) que não valem para a nova modalidade — evita resposta órfã.
 */
function handleChange(
  answers: CreditoAnswers,
  onChange: (a: CreditoAnswers) => void,
  key: string,
  value: string,
) {
  const next = { ...answers, [key]: value };
  if (key === 'modalidade') {
    for (const q of CREDITO_QUALIFICATION_QUESTIONS) {
      if (q.showWhen && !q.showWhen.includes(value as never)) {
        delete next[q.key];
      }
    }
  }
  onChange(next);
}

export function CreditoQualificationQuestionnaire({ answers, onChange, disabled }: Props) {
  const visible = creditoVisibleQuestions(answers);
  const obrigatorias = visible.filter((q) => !q.optional);
  const completed = obrigatorias.filter((q) =>
    creditoAnswerOk(q, answers[q.key] || '')
  ).length;
  const progress = obrigatorias.length ? (completed / obrigatorias.length) * 100 : 0;
  const icp = previewCreditoIcp(answers);

  const renderCampo = (q: CreditoQuestion, value: string, ok: boolean) => {
    if (q.type === 'choice') {
      return (
        <RadioGroup
          value={value}
          onValueChange={(v) => handleChange(answers, onChange, q.key, v)}
          disabled={disabled}
          className="grid gap-2"
        >
          {(q.options || []).map((opt, i) => (
            <label
              key={opt}
              htmlFor={`credito-${q.key}-${i}`}
              className={cn(
                'flex items-center gap-2 rounded-md border p-2 cursor-pointer text-sm',
                value === opt ? 'border-primary bg-primary/5' : 'border-border'
              )}
            >
              <RadioGroupItem value={opt} id={`credito-${q.key}-${i}`} />
              {opt}
            </label>
          ))}
        </RadioGroup>
      );
    }

    if (q.type === 'money') {
      const moneyOk = (parseMoney(value) ?? 0) > 0;
      return (
        <>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              R$
            </span>
            <Input
              value={value}
              onChange={(e) => handleChange(answers, onChange, q.key, e.target.value)}
              placeholder={q.placeholder}
              inputMode="numeric"
              disabled={disabled}
              className={cn(
                'pl-9 text-sm',
                !moneyOk && value.trim().length > 0 && !q.optional &&
                  'border-amber-500/60 focus-visible:ring-amber-500/40'
              )}
            />
          </div>
          {q.help && <p className="text-[11px] text-muted-foreground">{q.help}</p>}
        </>
      );
    }

    // text
    const length = value.trim().length;
    return (
      <Textarea
        value={value}
        onChange={(e) => handleChange(answers, onChange, q.key, e.target.value)}
        placeholder={q.placeholder}
        rows={2}
        disabled={disabled}
        className={cn(
          'text-sm resize-none',
          !ok && length > 0 && !q.optional &&
            'border-amber-500/60 focus-visible:ring-amber-500/40'
        )}
      />
    );
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">
            Qualificação de crédito · responda as perguntas obrigatórias antes de salvar
          </span>
          <span className="font-medium">{completed}/{obrigatorias.length}</span>
        </div>
        <Progress value={progress} className="h-1.5" />
      </div>

      <div className="space-y-4">
        {visible.map((q, idx) => {
          const value = answers[q.key] || '';
          const ok = creditoAnswerOk(q, value);
          return (
            <div key={q.key} className="space-y-1.5">
              <Label className="text-sm font-medium flex items-start gap-2">
                <span className="text-muted-foreground">{idx + 1}.</span>
                <span>
                  {q.label} {!q.optional && <span className="text-destructive">*</span>}
                </span>
              </Label>
              {renderCampo(q, value, ok)}
            </div>
          );
        })}
      </div>

      {/* Prévia da classificação — a final é gravada pelo banco ao salvar */}
      {answers.modalidade && (
        <div className="space-y-1 pt-1">
          {icp ? (
            <Badge
              className={cn(
                'border-0 text-white',
                icp === 'ICP' && 'bg-green-600 hover:bg-green-600',
                icp === 'Parcial' && 'bg-amber-500 hover:bg-amber-500',
                icp === 'Fora do ICP' && 'bg-zinc-500 hover:bg-zinc-500'
              )}
            >
              Prévia: {icp}
            </Badge>
          ) : (
            answers.modalidade === 'Comprar imóvel' && (
              <Badge variant="secondary">Sem ICP definido — depende do crédito conseguido</Badge>
            )
          )}
          <p className="text-[11px] text-muted-foreground">
            classificação final é gravada pelo sistema ao salvar
          </p>
        </div>
      )}
    </div>
  );
}

export default CreditoQualificationQuestionnaire;
