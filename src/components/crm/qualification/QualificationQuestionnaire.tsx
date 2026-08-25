import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';
import {
  QUALIFICATION_QUESTIONS,
  MIN_ANSWER_LENGTH,
  type QualificationAnswers,
  type QualificationQuestion,
} from './QualificationQuestions';

interface Props {
  answers: QualificationAnswers;
  onChange: (answers: QualificationAnswers) => void;
  disabled?: boolean;
}

/** Mesma regra de validateAnswers: escolha única só precisa estar preenchida. */
function respostaOk(q: QualificationQuestion, value: string) {
  const v = value.trim();
  return q.type === 'choice' ? v.length > 0 : v.length >= MIN_ANSWER_LENGTH;
}

export function QualificationQuestionnaire({ answers, onChange, disabled }: Props) {
  const total = QUALIFICATION_QUESTIONS.length;
  const completed = QUALIFICATION_QUESTIONS.filter((q) =>
    respostaOk(q, answers[q.key] || '')
  ).length;
  const progress = (completed / total) * 100;

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">
            Questionário obrigatório · responda todas as perguntas antes de salvar
          </span>
          <span className="font-medium">{completed}/{total}</span>
        </div>
        <Progress value={progress} className="h-1.5" />
      </div>

      <div className="space-y-4">
        {QUALIFICATION_QUESTIONS.map((q, idx) => {
          const value = answers[q.key] || '';
          const length = value.trim().length;
          const ok = respostaOk(q, value);
          const isChoice = q.type === 'choice';
          return (
            <div key={q.key} className="space-y-1.5">
              <Label className="text-sm font-medium flex items-start gap-2">
                <span className="text-muted-foreground">{idx + 1}.</span>
                <span>
                  {q.label} <span className="text-destructive">*</span>
                </span>
              </Label>
              {isChoice ? (
                <RadioGroup
                  value={value}
                  onValueChange={(v) => onChange({ ...answers, [q.key]: v })}
                  disabled={disabled}
                  className="grid gap-2"
                >
                  {(q.options || []).map((opt, i) => (
                    <label
                      key={opt}
                      htmlFor={`${q.key}-${i}`}
                      className={cn(
                        'flex items-center gap-2 rounded-md border p-2 cursor-pointer text-sm',
                        value === opt ? 'border-primary bg-primary/5' : 'border-border'
                      )}
                    >
                      <RadioGroupItem value={opt} id={`${q.key}-${i}`} />
                      {opt}
                    </label>
                  ))}
                </RadioGroup>
              ) : (
                <>
                  <Textarea
                    value={value}
                    onChange={(e) => onChange({ ...answers, [q.key]: e.target.value })}
                    placeholder={q.placeholder}
                    rows={2}
                    disabled={disabled}
                    className={cn(
                      'text-sm resize-none',
                      !ok && length > 0 && 'border-amber-500/60 focus-visible:ring-amber-500/40'
                    )}
                  />
                  <div
                    className={cn(
                      'text-[11px] flex justify-end',
                      ok ? 'text-emerald-600' : 'text-muted-foreground'
                    )}
                  >
                    {length}/{MIN_ANSWER_LENGTH} {ok && '✓'}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
