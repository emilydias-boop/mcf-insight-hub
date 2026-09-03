import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ClipboardList } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface QuizProfileCardProps {
  customFields: Record<string, unknown> | null | undefined;
}

// Ordem fixa das perguntas conhecidas do quiz-mapa.
// Chave -> rótulo em português.
const QUIZ_QUESTOES: Array<{ key: string; rotulo: string }> = [
  { key: 'finalidade_obra', rotulo: 'Objetivo da obra' },
  { key: 'renda', rotulo: 'Renda mensal' },
  { key: 'capital', rotulo: 'Capital disponível' },
  { key: 'patrimonio', rotulo: 'Patrimônio hoje' },
  { key: 'experiencia', rotulo: 'Experiência' },
  { key: 'armadilha', rotulo: 'Armadilha declarada' },
  { key: 'rota', rotulo: 'Rota indicada' },
  { key: 'prazo', rotulo: 'Prazo' },
  { key: 'regiao', rotulo: 'Região' },
  { key: 'perfil', rotulo: 'Perfil' },
];

const CHAVES_CONHECIDAS = new Set(QUIZ_QUESTOES.map((q) => q.key));

// Normaliza texto: remove acentos e passa para minúsculo.
function normalizarTexto(valor: unknown): string {
  if (typeof valor !== 'string') return '';
  return valor
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

// Considera vazio: nulo, string vazia, ou "não informado" (com/sem acento).
function isVazio(valor: unknown): boolean {
  if (valor === null || valor === undefined) return true;
  if (typeof valor === 'string' && valor.trim() === '') return true;
  const norm = normalizarTexto(valor);
  if (norm === 'nao informado') return true;
  return false;
}

// Rótulo de fallback para chaves extras: troca _ por espaço e capitaliza a primeira letra.
function rotuloDeChave(chave: string): string {
  const comEspaco = chave.replace(/_/g, ' ');
  return comEspaco.charAt(0).toUpperCase() + comEspaco.slice(1);
}

function valorComoString(valor: unknown): string {
  if (valor === null || valor === undefined) return '';
  if (typeof valor === 'string') return valor.trim();
  if (typeof valor === 'number' || typeof valor === 'boolean') return String(valor);
  try {
    return JSON.stringify(valor);
  } catch {
    return String(valor);
  }
}

export function QuizProfileCard({ customFields }: QuizProfileCardProps) {
  // 1. Ler qualification_answers; se não for objeto ou vazio, some.
  const answers = customFields?.qualification_answers;
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
    return null;
  }
  const respostas = answers as Record<string, unknown>;
  if (Object.keys(respostas).length === 0) {
    return null;
  }

  // 2. Só renderiza para leads do quiz.
  const isQuiz =
    customFields?.source === 'quiz-mapa' ||
    customFields?.lead_channel === 'QUIZ-MAPA';
  if (!isQuiz) {
    return null;
  }

  // 4. Renderiza perguntas conhecidas em ordem fixa, pulando vazias.
  const linhasConhecidas: Array<{ rotulo: string; valor: string }> = [];
  for (const questao of QUIZ_QUESTOES) {
    if (isVazio(respostas[questao.key])) continue;
    linhasConhecidas.push({
      rotulo: questao.rotulo,
      valor: valorComoString(respostas[questao.key]),
    });
  }

  // 6. Chaves extras não conhecidas, depois das conhecidas.
  const linhasExtras: Array<{ rotulo: string; valor: string }> = [];
  for (const chave of Object.keys(respostas)) {
    if (CHAVES_CONHECIDAS.has(chave)) continue;
    if (isVazio(respostas[chave])) continue;
    linhasExtras.push({
      rotulo: rotuloDeChave(chave),
      valor: valorComoString(respostas[chave]),
    });
  }

  const todasLinhas = [...linhasConhecidas, ...linhasExtras];
  if (todasLinhas.length === 0) {
    return null;
  }

  // 7. Data de resposta discreta.
  const respondidoEm = customFields?.quiz_respondido_em;
  const dataFormatada =
    typeof respondidoEm === 'string' && respondidoEm
      ? format(new Date(respondidoEm), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
      : null;

  return (
    <Card className="border-blue-500/30 bg-blue-500/5">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <ClipboardList className="h-4 w-4 text-blue-600" />
          Perfil do Quiz
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {todasLinhas.map((linha, idx) => (
          <div key={`${linha.rotulo}-${idx}`} className="text-sm">
            <span className="text-xs text-muted-foreground">{linha.rotulo}</span>
            <p className="text-foreground">{linha.valor}</p>
          </div>
        ))}

        {dataFormatada && (
          <p className="text-xs text-muted-foreground pt-2 border-t">
            Respondido em {dataFormatada}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
