import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useArHistorico, useArParcelas } from '@/hooks/useAReceber';
import { ticketNumber } from '@/lib/arTicketNumber';
import { emAberto, hojeSP, isAtrasada, diasEntre } from '@/lib/arCobrancaCalc';
import type { ArTitulo } from '@/types/aReceber';
import { ContatoRapido, SaldoValor, brl, dataBR } from './GestaoCobranca';

/** Painel lateral: dados, cronograma de parcelas e linha do tempo do título. Só leitura + anotação. */
export function ClientePainelLateral({ titulo, onClose }: { titulo: ArTitulo | null; onClose: () => void }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: parcelas } = useArParcelas(titulo?.id ?? null);
  const { data: historico } = useArHistorico(titulo?.id ?? null);
  const [nota, setNota] = useState('');
  const [salvando, setSalvando] = useState(false);
  const hoje = hojeSP();

  const anotar = async () => {
    if (!titulo || !nota.trim()) return;
    setSalvando(true);
    const { error } = await supabase.from('ar_historico' as any).insert({ titulo_id: titulo.id, tipo: 'anotacao', descricao: nota.trim() } as any);
    setSalvando(false);
    if (error) return toast.error(error.message);
    setNota('');
    qc.invalidateQueries({ queryKey: ['ar-historico', titulo.id] });
    toast.success('Anotação registrada');
  };

  return (
    <Sheet open={!!titulo} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        {titulo && (
          <>
            <SheetHeader>
              <SheetTitle>{titulo.customer_name}</SheetTitle>
              <p className="text-xs text-muted-foreground">Título {ticketNumber(titulo.id)} · {titulo.product_code} {titulo.product_name}</p>
            </SheetHeader>
            <div className="mt-4 space-y-5 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><div className="text-xs text-muted-foreground">Contato</div><ContatoRapido telefone={titulo.customer_phone} email={titulo.customer_email} /></div>
                <div><div className="text-xs text-muted-foreground">CPF/CNPJ</div>{titulo.customer_document || '—'}</div>
                <div><div className="text-xs text-muted-foreground">Valor total</div>{brl(Number(titulo.valor_total))}</div>
                <div><div className="text-xs text-muted-foreground">Forma de pagamento</div>{titulo.payment_method || '—'}</div>
                <div><div className="text-xs text-muted-foreground">Recebido</div><span className="text-emerald-600">{brl(titulo.valor_pago || 0)}</span></div>
                <div><div className="text-xs text-muted-foreground">Saldo devedor</div><SaldoValor valor={titulo.valor_pendente || 0} /></div>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Cronograma de cobranças</h4>
                {(parcelas ?? []).length === 0 ? <p className="text-xs text-muted-foreground">Sem parcelas lançadas.</p> : (
                  <div className="space-y-1">
                    {(parcelas as any[]).map((p) => {
                      const atras = isAtrasada(p, hoje);
                      return (
                        <div key={p.id} className="flex items-center justify-between gap-2 border-b py-1 text-xs">
                          <span className="w-16">{p.numero}/{parcelas!.length}</span>
                          <span className="w-20">{dataBR(p.data_vencimento)}</span>
                          <span className="w-24 text-right">{brl(Number(p.valor))}</span>
                          <span className="flex-1 text-right">
                            {p.status === 'pago' ? <Badge variant="outline" className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30">Paga {dataBR(p.data_pagamento)}</Badge>
                              : p.status === 'cancelado' ? <Badge variant="outline">Cancelada</Badge>
                              : atras ? <span className="font-semibold text-red-600">{diasEntre(p.data_vencimento, hoje)} dias de atraso · {brl(emAberto(p))}</span>
                              : <span className="text-muted-foreground">Pendente</span>}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <h4 className="font-semibold mb-2">Linha do tempo</h4>
                <div className="flex gap-2 mb-3">
                  <Textarea rows={2} placeholder="Nova anotação…" value={nota} onChange={(e) => setNota(e.target.value)} />
                  <Button onClick={anotar} disabled={salvando || !nota.trim()}>Salvar</Button>
                </div>
                <div className="space-y-2">
                  {(historico ?? []).map((h: any) => (
                    <div key={h.id} className="border-l-2 border-border pl-3 text-xs">
                      <div className="text-muted-foreground">{new Date(h.created_at).toLocaleString('pt-BR')} · {h.tipo}</div>
                      <div>{h.descricao}{h.valor ? ` · ${brl(Number(h.valor))}` : ''}</div>
                    </div>
                  ))}
                </div>
              </div>

              <Button variant="outline" className="w-full" onClick={() => navigate(`/financeiro/a-receber/${titulo.id}`)}>
                Abrir ficha completa
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
