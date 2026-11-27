import { ExternalLink } from "lucide-react";

const TRIAGEM_URL = "https://rh-mcf.lovable.app/painel";

export default function TriagemCandidatos() {
  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <p className="text-muted-foreground">
          No primeiro acesso, entre com o e-mail e a senha da triagem dentro do quadro. Se o Safari bloquear o login, use "Abrir em nova aba".
        </p>
        <a
          href={TRIAGEM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
        >
          Abrir em nova aba <ExternalLink className="h-4 w-4" />
        </a>
      </div>
      <iframe
        src={TRIAGEM_URL}
        title="Triagem de candidatos"
        allow="clipboard-write"
        className="w-full flex-1 border-0"
      />
    </div>
  );
}
