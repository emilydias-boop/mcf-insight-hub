import { FileText } from "lucide-react";

interface SdrAutoSummaryProps {
  text: string;
  isLoading?: boolean;
}

export function SdrAutoSummary({ text, isLoading }: SdrAutoSummaryProps) {
  if (isLoading || !text) {
    return (
      <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 animate-pulse h-16" />
    );
  }

  return (
    <div className="p-4 rounded-xl bg-primary/5 border border-primary/10">
      <div className="flex items-start gap-3">
        <FileText className="h-4 w-4 text-primary mt-0.5 shrink-0" />
        <p className="text-sm text-foreground leading-relaxed">{text}</p>
      </div>
    </div>
  );
}
