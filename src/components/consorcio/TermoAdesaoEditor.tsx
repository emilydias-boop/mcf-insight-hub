import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Eye, FileBadge, FileSignature, History, Loader2, Save } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { TermoMarkdown } from './TermoMarkdown';
import { useSaveTermoModelo, useTermoModelos, TERMO_TIPO_LABEL, type TermoTipo } from '@/hooks/useConsorcioTermos';
import { DADOS_EXEMPLO_TERMO, TERMO_PLACEHOLDERS, renderTermo } from '@/lib/consorcioTermo';
import { COMPROVANTE_PLACEHOLDERS, DADOS_EXEMPLO_COMPROVANTE } from '@/lib/consorcioComprovante';

export function TermoAdesaoEditor() {
  const { role } = useAuth();
  const podeEditar = role === 'admin' || role === 'manager';
  const [tipo, setTipo] = useState<TermoTipo>('adesao');
  const { data: modelos = [], isLoading } = useTermoModelos(false, tipo);
  const saveMut = useSaveTermoModelo();

  const ativo = useMemo(() => modelos.find((m) => m.ativo) || modelos[0], [modelos]);
  const [nome, setNome] = useState('');
  const [conteudo, setConteudo] = useState('');
  const [carregado, setCarregado] = useState(false);

  // Trocar de documento recarrega o editor com o modelo do novo tipo.
  useEffect(() => {
    setCarregado(false);
    setNome('');
    setConteudo('');
  }, [tipo]);

  useEffect(() => {
    if (ativo && !carregado) {
      setNome(ativo.nome);
      setConteudo(ativo.conteudo);
      setCarregado(true);
    }
  }, [ativo, carregado]);

  const isComprovante = tipo === 'comprovante_cadastro';
  const placeholders = isComprovante ? COMPROVANTE_PLACEHOLDERS : TERMO_PLACEHOLDERS;
  const dadosExemplo = isComprovante ? DADOS_EXEMPLO_COMPROVANTE : DADOS_EXEMPLO_TERMO;
  const preview = useMemo(() => renderTermo(conteudo, dadosExemplo), [conteudo, dadosExemplo]);
  const alterado = !!ativo && (ativo.conteudo !== conteudo || ativo.nome !== nome);

  const inserirPlaceholder = (key: string) => {
    setConteudo((c) => `${c}{{${key}}}`);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {isComprovante ? <FileBadge className="h-5 w-5" /> : <FileSignature className="h-5 w-5" />}
          Documentos do Consórcio
        </CardTitle>
        <CardDescription>
          {isComprovante
            ? 'Texto do comprovante enviado ao cliente depois do cadastro da cota na Embracon. Não é assinado.'
            : 'Texto do termo enviado ao cliente para assinatura eletrônica.'}{' '}
          Cada gravação cria uma nova versão — documentos já emitidos continuam com a versão que usaram.
        </CardDescription>
        <CardDescription className="text-xs">
          Os planos que preenchem os valores de parcela do termo ficam em Pós-Reunião → etapa Cotas → Cadastros → Planos.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label>Documento</Label>
          <Select value={tipo} onValueChange={(v) => setTipo(v as TermoTipo)}>
            <SelectTrigger className="w-full sm:w-80">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="adesao">{TERMO_TIPO_LABEL.adesao}</SelectItem>
              <SelectItem value="comprovante_cadastro">{TERMO_TIPO_LABEL.comprovante_cadastro}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="termo-nome">Nome do modelo</Label>
          <Input
            id="termo-nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            disabled={!podeEditar}
          />
        </div>

        <div className="space-y-2">
          <Label>Placeholders disponíveis (clique para inserir no fim do texto)</Label>
          <div className="flex flex-wrap gap-1.5">
            {placeholders.map((p) => (
              <button
                key={p.key}
                type="button"
                disabled={!podeEditar}
                onClick={() => inserirPlaceholder(p.key)}
                title={p.label}
              >
                <Badge variant="secondary" className="cursor-pointer font-mono text-[10px]">
                  {`{{${p.key}}}`}
                </Badge>
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="termo-conteudo">Conteúdo (markdown)</Label>
            <Textarea
              id="termo-conteudo"
              value={conteudo}
              onChange={(e) => setConteudo(e.target.value)}
              rows={28}
              disabled={!podeEditar}
              className="font-mono text-xs leading-relaxed"
            />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Eye className="h-4 w-4" /> Prévia com dados de exemplo
            </Label>
            <ScrollArea className="h-[560px] rounded-md border bg-card p-5">
              <TermoMarkdown content={preview} className="text-sm" />
            </ScrollArea>
          </div>
        </div>

        {podeEditar && (
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-xs text-muted-foreground">
              Versão ativa: v{ativo?.versao ?? '—'}
              {alterado ? ' · há alterações não salvas' : ''}
            </p>
            <Button
              onClick={() => saveMut.mutate({ nome: nome.trim(), conteudo, tipo })}
              disabled={!alterado || !nome.trim() || !conteudo.trim() || saveMut.isPending}
            >
              {saveMut.isPending ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-1" />
              )}
              Salvar como nova versão
            </Button>
          </div>
        )}

        <div className="space-y-2 pt-2 border-t">
          <Label className="flex items-center gap-2">
            <History className="h-4 w-4" /> Histórico de versões
          </Label>
          <div className="space-y-1">
            {modelos.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Badge variant={m.ativo ? 'default' : 'outline'} className="text-[10px]">
                    v{m.versao}
                    {m.ativo ? ' · ativa' : ''}
                  </Badge>
                  <span className="truncate">{m.nome}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(m.created_at), 'dd/MM/yyyy HH:mm')}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setNome(m.nome);
                      setConteudo(m.conteudo);
                    }}
                  >
                    Carregar no editor
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
