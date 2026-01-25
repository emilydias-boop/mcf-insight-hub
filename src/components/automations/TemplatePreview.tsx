import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, MessageCircle, Mail } from "lucide-react";

interface TemplatePreviewProps {
  content: string;
  subject?: string;
  channel: 'whatsapp' | 'email';
  onBack: () => void;
}

const SAMPLE_DATA: Record<string, string> = {
  nome: "João Silva",
  sdr: "Carolina",
  data: "15/01/2026 às 14:00",
  link: "https://meet.google.com/abc-defg-hij",
  produto: "Consórcio Imobiliário",
  empresa: "MCF Capital",
  telefone: "(11) 99999-9999",
  email: "joao@email.com",
};

function replaceVariables(text: string): string {
  let result = text;
  Object.entries(SAMPLE_DATA).forEach(([key, value]) => {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
  });
  return result;
}

export function TemplatePreview({ content, subject, channel, onBack }: TemplatePreviewProps) {
  const previewContent = replaceVariables(content);
  const previewSubject = subject ? replaceVariables(subject) : undefined;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Voltar
        </Button>
        <span className="text-sm text-muted-foreground">Preview da mensagem</span>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            {channel === 'whatsapp' ? (
              <MessageCircle className="h-5 w-5 text-green-600" />
            ) : (
              <Mail className="h-5 w-5 text-blue-600" />
            )}
            <CardTitle className="text-base">
              {channel === 'whatsapp' ? 'WhatsApp' : 'Email'}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Email Subject */}
          {channel === 'email' && previewSubject && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase">Assunto</p>
              <p className="font-medium">{previewSubject}</p>
            </div>
          )}

          {/* Message Content */}
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase">Mensagem</p>
            {channel === 'whatsapp' ? (
              <div className="bg-green-50 dark:bg-green-950/20 rounded-lg p-4 max-w-sm">
                <p className="whitespace-pre-wrap text-sm">{previewContent}</p>
              </div>
            ) : (
              <div className="border rounded-lg p-4 bg-background">
                <p className="whitespace-pre-wrap text-sm">{previewContent}</p>
              </div>
            )}
          </div>

          {/* Sample Data Reference */}
          <div className="pt-4 border-t">
            <p className="text-xs font-medium text-muted-foreground uppercase mb-2">
              Dados de exemplo utilizados
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {Object.entries(SAMPLE_DATA).map(([key, value]) => (
                <div key={key} className="flex gap-1">
                  <span className="text-muted-foreground">{`{{${key}}}`}:</span>
                  <span>{value}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
