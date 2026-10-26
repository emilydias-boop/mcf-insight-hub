import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { MessageCircle } from 'lucide-react';
import { QUALIFICATION_QUESTIONS } from '../qualification/QualificationQuestions';

function WhatsappPrintThumb({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    supabase.storage
      .from('qualification-attachments')
      .createSignedUrl(path, 3600)
      .then(({ data }) => {
        if (active && data?.signedUrl) setUrl(data.signedUrl);
      });
    return () => {
      active = false;
    };
  }, [path]);
  if (!url) return null;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="block mt-2">
      <img
        src={url}
        alt="Print do WhatsApp"
        className="max-h-48 rounded border border-border"
      />
    </a>
  );
}

export function formatAISummary(summary: Record<string, any> | null | undefined): string {
  const s = summary || {};
              const bullets = (s.bullets || []).map((b: string) => `• ${b}`).join('\n');
              const d = s.discovery || {};
              const discovery = [
                `Conhece MCF há: ${d.tempo_conhece_mcf || 'não informado'}`,
                `Profissão: ${d.profissao || 'não informado'}`,
                `Renda: ${d.renda || 'não informado'}`,
                `Já constrói: ${d.ja_constroi || 'não informado'}`,
                `Possui imóvel: ${d.possui_imovel || 'não informado'}`,
                `Possui terreno: ${d.possui_terreno || 'não informado'}`,
                `Tem sócio: ${d.tem_socio || 'não informado'}`,
              ].join('\n');
              return `${bullets}\n\n— Descoberta —\n${discovery}\n\n— Próximos passos —\n${s.next_steps || '—'}`;

}

export function AISummaryContent({ content }: { content: string }) {
 return <p className="text-sm text-foreground whitespace-pre-wrap">{content}</p>;
}

export function QualificationContent({ answers, channel, whatsappPrintPath }: { answers?: Record<string, string>; channel?: string; whatsappPrintPath?: string }) {
 return <>
                  {answers && (
                    <div className="mt-2 space-y-1.5 text-xs">
                      {QUALIFICATION_QUESTIONS.map((q) => {
                        const v = answers?.[q.key];
                        if (!v) return null;
                        return (
                          <div key={q.key}>
                            <div className="font-medium text-foreground/80">▸ {q.label}</div>
                            <div className="text-muted-foreground pl-3">{v}</div>
                          </div>
                        );
                      })}
                      {channel === 'whatsapp' && (
                        <div className="flex items-center gap-1 text-emerald-600 mt-1">
                          <MessageCircle className="h-3 w-3" /> Qualificação via WhatsApp
                        </div>
                      )}
                    </div>
                  )}
                  {whatsappPrintPath && <WhatsappPrintThumb path={whatsappPrintPath} />}

 </>;
}
