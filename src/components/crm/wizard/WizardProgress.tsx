import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

interface WizardProgressProps {
  currentStep: number;
  totalSteps: number;
  stepLabels: string[];
}

export const WizardProgress = ({ currentStep, totalSteps, stepLabels }: WizardProgressProps) => {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between">
        {Array.from({ length: totalSteps }, (_, i) => i + 1).map((step) => {
          const isCompleted = step < currentStep;
          const isCurrent = step === currentStep;
          
          return (
            <div key={step} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium border-2 transition-all",
                    isCompleted && "bg-primary border-primary text-primary-foreground",
                    isCurrent && "border-primary text-primary bg-primary/10",
                    !isCompleted && !isCurrent && "border-muted-foreground/30 text-muted-foreground"
                  )}
                >
                  {isCompleted ? <Check className="h-5 w-5" /> : step}
                </div>
                <span className={cn(
                  "text-xs mt-2 text-center max-w-[80px]",
                  isCurrent ? "text-primary font-medium" : "text-muted-foreground"
                )}>
                  {stepLabels[step - 1]}
                </span>
              </div>
              
              {step < totalSteps && (
                <div className={cn(
                  "flex-1 h-0.5 mx-2",
                  step < currentStep ? "bg-primary" : "bg-muted-foreground/30"
                )} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
