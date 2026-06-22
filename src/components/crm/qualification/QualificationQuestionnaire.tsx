import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import {
  QUALIFICATION_QUESTIONS,
  MIN_ANSWER_LENGTH,
  type QualificationAnswers,
} from './QualificationQuestions';

interface Props {
  answers: QualificationAnswers;
  onChange: (answers: QualificationAnswers) => void;
  disabled?: boolean;
}

export function QualificationQuestionnaire({ answers, onChange, disabled }: Props) {
  const total = QUALIFICATION_QUESTIONS.length;
  const completed = QUALIFICATION_QUESTIONS.filter(
    (q) => (answers[q.key] || '').trim().length >= MIN_ANSWER_LENGTH
  ).length;
  const progress = (completed / total) * 100;

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">
            Questionário obrigatório · cada resposta com no mínimo {MIN_ANSWER_LENGTH} caracteres
          </span>
          <span className="font-medium">{completed}/{total}</span>
        </div>
        <Progress value={progress} className="h-1.5" />
      </div>

      <div className="space-y-4">
        {QUALIFICATION_QUESTIONS.map((q, idx) => {
          const value = answers[q.key] || '';
          const length = value.trim().length;
          const ok = length >= MIN_ANSWER_LENGTH;
          return (
            <div key={q.key} className="space-y-1.5">
              <Label className="text-sm font-medium flex items-start gap-2">
                <span className="text-muted-foreground">{idx + 1}.</span>
                <span>
                  {q.label} <span className="text-destructive">*</span>
                </span>
              </Label>
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
            </div>
          );
        })}
      </div>
    </div>
  );
}