import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { usePendingRegistration, useOpenCota } from '@/hooks/useConsorcioPendingRegistrations';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  registrationId: string;
  /** Abre o formulário completo de Abertura de Cota (dados essenciais faltando). */
  onAbrirFormularioCompleto: () => void;
}

/**
 * Ação "Cota Cadastrada" da etapa 4 — formulário curto de três campos
 * (grupo, cota e contrato Embracon). Confirmar cria a cota como RESERVA e move o
 * cadastro para a etapa 5 (Cotas Cadastradas), sem passar pelo formulário longo.
 *
 * O contrato Embracon é gravado em `consortium_cards.contrato_embracon` — a única
 * coluna que já existia para esse dado. O cadastro pendente não recebe cópia.
 */
export function CotaCadastradaModal({ open, onOpenChange, registrationId, onAbrirFormularioCompleto }: Props) {
  const { data: reg, isLoading } = usePendingRegistration(open ? registrationId : null);
  const openCota = useOpenCota();

  const [grupo, setGrupo] = useState('');
  const [cota, setCota] = useState('');
  const [contrato, setContrato] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setGrupo(reg?.grupo || '');
    setCota(reg?.cota || '');
    setContrato('');
    setErro(null);
  }, [open, reg?.grupo, reg?.cota]);

  /**
   * Dados que o card exige e que o formulário curto não pergunta. Sem eles a cota
   * nasceria incompleta — melhor mandar a pessoa para o formulário longo.
   */
  const faltando = useMemo(() => {
    if (!reg) return [];
    const itens: string[] = [];
    if (!reg.valor_credito) itens.push('valor do crédito');
    if (!reg.prazo_meses) itens.push('prazo (meses)');
    if (!reg.tipo_produto) itens.push('tipo de produto');
    if (!reg.categoria) itens.push('categoria');
    if (!reg.origem) itens.push('origem');
    return itens;
  }, [reg]);

  /** Aviso (nunca bloqueio): outra cota já usa o mesmo par grupo/cota. */
  const { data: duplicadas = [] } = useQuery({
    queryKey: ['cota-duplicada', grupo.trim(), cota.trim()],
    enabled: open && grupo.trim().length > 0 && cota.trim().length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('consortium_cards')
        .select('id, nome_completo, razao_social, grupo, cota')
        .eq('grupo', grupo.trim())
        .eq('cota', cota.trim())
        .limit(5);
      if (error) throw error;
      return (data || []) as Array<{ id: string; nome_completo: string | null; razao_social: string | null }>;
    },
  });

  const podeConfirmar =
    !!reg && faltando.length === 0 && grupo.trim().length > 0 && cota.trim().length > 0 && !openCota.isPending;

  const confirmar = async () => {
    if (!reg) return;
    setErro(null);
    const hoje = new Date().toISOString().slice(0, 10);
    // `consortium_cards.vendedor_id` tem FK para `consorcio_vendedor_options`:
    // um uuid de outra origem derrubava o insert inteiro (409). Resolvemos aqui e,
    // se não resolver, seguimos sem vínculo — preservando o nome do vendedor.
    const vendedorIdValido = await resolveVendedorOptionId(
      reg.vendedor_id,
      reg.vendedor_name_cota || reg.vendedor_name,
    );
    try {

      await openCota.mutateAsync({
        registrationId: reg.id,
        registration: reg,
        cotaData: {
          categoria: String(reg.categoria),
          grupo: grupo.trim(),
          cota: cota.trim(),
          contrato_embracon: contrato.trim() || null,
          valor_credito: Number(reg.valor_credito),
          prazo_meses: Number(reg.prazo_meses),
          tipo_produto: String(reg.tipo_produto),
          produto_codigo: reg.produto_codigo || undefined,
          condicao_pagamento: reg.condicao_pagamento || undefined,
          inclui_seguro: reg.inclui_seguro ?? false,
          empresa_paga_parcelas: reg.empresa_paga_parcelas || 'nao',
          tipo_contrato: reg.tipo_contrato || 'normal',
          parcelas_pagas_empresa: reg.parcelas_pagas_empresa || 0,
          // A Embracon informa o dia de vencimento depois: o cronograma nasce quando
          // ele for preenchido (mesma regra da Abertura de Cota).
          dia_vencimento: reg.dia_vencimento ?? null,
          inicio_segunda_parcela: reg.inicio_segunda_parcela || 'automatico',
          data_contratacao: hoje,
          tipo_registro: 'reserva',
          data_reserva: hoje,
          origem: String(reg.origem),
          origem_detalhe: reg.origem_detalhe || undefined,
          vendedor_id: reg.vendedor_id || undefined,
          vendedor_name: reg.vendedor_name_cota || reg.vendedor_name || undefined,
          valor_comissao: reg.valor_comissao ?? undefined,
          observacoes: reg.observacoes || undefined,
        },
      });
      onOpenChange(false);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Cota cadastrada na Embracon</DialogTitle>
          <DialogDescription>
            Informe a identificação devolvida pela Embracon. A cota passa para a etapa
            Cotas Cadastradas.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : faltando.length > 0 ? (
          <div className="space-y-3 py-2">
            <div className="rounded border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
              <div className="flex items-center gap-2 font-medium text-amber-600 dark:text-amber-400">
                <AlertCircle className="h-4 w-4" /> Dados do plano incompletos
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Faltam {faltando.join(', ')}. Como esses campos definem a cota, use o
                formulário completo de abertura para informá-los.
              </p>
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                onOpenChange(false);
                onAbrirFormularioCompleto();
              }}
            >
              Abrir formulário completo
            </Button>
          </div>
        ) : (
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="cc-grupo">Grupo <span className="text-destructive">*</span></Label>
                <Input id="cc-grupo" value={grupo} onChange={(e) => setGrupo(e.target.value)} placeholder="ex.: 1234" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="cc-cota">Cota <span className="text-destructive">*</span></Label>
                <Input id="cc-cota" value={cota} onChange={(e) => setCota(e.target.value)} placeholder="ex.: 567" />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="cc-contrato">Contrato Embracon</Label>
              <Input
                id="cc-contrato"
                value={contrato}
                onChange={(e) => setContrato(e.target.value)}
                placeholder="número do contrato na administradora"
              />
            </div>

            {duplicadas.length > 0 && (
              <div className="rounded border border-amber-500/40 bg-amber-500/5 p-2 text-xs">
                <div className="flex items-center gap-2 font-medium text-amber-600 dark:text-amber-400">
                  <AlertCircle className="h-3.5 w-3.5" /> Já existe cota com grupo {grupo.trim()} / cota {cota.trim()}
                </div>
                <ul className="mt-1 list-disc pl-5 text-muted-foreground">
                  {duplicadas.map((d) => (
                    <li key={d.id}>{d.nome_completo || d.razao_social || 'sem nome'}</li>
                  ))}
                </ul>
                <p className="mt-1 text-muted-foreground">
                  Pode ser erro de digitação — confira antes de confirmar. Não bloqueia.
                </p>
              </div>
            )}

            {duplicadas.length === 0 && grupo.trim() && cota.trim() && (
              <p className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" /> Nenhuma cota com este grupo/cota.
              </p>
            )}

            {erro && <p className="text-xs text-destructive">{erro}</p>}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={!podeConfirmar} onClick={confirmar}>
            {openCota.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            Confirmar cadastro
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
