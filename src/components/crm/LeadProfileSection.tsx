import { useState } from 'react';
import { ChevronDown, ChevronRight, ClipboardList } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatCurrency } from '@/lib/formatters';
import { useLeadProfile } from '@/hooks/useLeadProfile';

interface LeadProfileSectionProps {
  contactId: string | null | undefined;
  dealId?: string | null;
}

interface FieldDef {
  key: string;
  label: string;
  format?: 'currency' | 'date' | 'boolean' | 'json';
}

const CATEGORIES: { title: string; fields: FieldDef[] }[] = [
  {
    title: 'Dados Pessoais',
    fields: [
      { key: 'nome_completo', label: 'Nome Completo' },
      { key: 'cpf', label: 'CPF' },
      { key: 'data_nascimento', label: 'Nascimento', format: 'date' },
      { key: 'estado_civil', label: 'Estado Civil' },
      { key: 'num_filhos', label: 'Filhos' },
      { key: 'estado_cidade', label: 'Estado/Cidade' },
      { key: 'profissao', label: 'Profissão' },
      { key: 'whatsapp', label: 'WhatsApp' },
      { key: 'email', label: 'E-mail' },
      { key: 'instagram', label: 'Instagram' },
      { key: 'canal_conhecimento', label: 'Como conheceu' },
    ],
  },
  {
    title: 'Experiência & Interesse',
    fields: [
      { key: 'ja_constroi', label: 'Já constrói?' },
      { key: 'experiencia_imobiliaria', label: 'Experiência Imobiliária' },
      { key: 'interesse_consorcio', label: 'Interesse em Consórcio' },
    ],
  },
  {
    title: 'Crédito & Urgência',
    fields: [
      { key: 'situacao_credito', label: 'Situação de Crédito' },
      { key: 'tentou_financiamento', label: 'Tentou Financiamento?' },
      { key: 'urgencia_operacao', label: 'Urgência da Operação' },
    ],
  },
  {
    title: 'Financeiro',
    fields: [
      { key: 'renda_bruta', label: 'Renda Bruta', format: 'currency' },
      { key: 'fonte_renda', label: 'Fonte de Renda' },
      { key: 'faixa_aporte', label: 'Faixa de Aporte', format: 'currency' },
      { key: 'faixa_aporte_descricao', label: 'Aporte (descrição)' },
      { key: 'investe', label: 'Investe?', format: 'boolean' },
      { key: 'valor_investido', label: 'Valor Investido', format: 'currency' },
      { key: 'corretora', label: 'Corretora' },
      { key: 'possui_divida', label: 'Possui Dívida?', format: 'boolean' },
      { key: 'saldo_fgts', label: 'Saldo FGTS', format: 'currency' },
    ],
  },
  {
    title: 'Patrimônio',
    fields: [
      { key: 'is_empresario', label: 'Empresário?', format: 'boolean' },
      { key: 'porte_empresa', label: 'Porte Empresa' },
      { key: 'imovel_financiado', label: 'Imóvel Financiado?', format: 'boolean' },
      { key: 'possui_consorcio', label: 'Consórcio?', format: 'boolean' },
      { key: 'possui_carro', label: 'Possui Carro?', format: 'boolean' },
      { key: 'possui_seguros', label: 'Possui Seguros?', format: 'boolean' },
      { key: 'precisa_capital_giro', label: 'Precisa Capital de Giro?', format: 'boolean' },
      { key: 'valor_capital_giro', label: 'Valor Capital de Giro', format: 'currency' },
    ],
  },
  {
    title: 'Interesse & Objetivos',
    fields: [
      { key: 'objetivos_principais', label: 'Objetivos', format: 'json' },
      { key: 'renda_passiva_meta', label: 'Meta Renda Passiva', format: 'currency' },
      { key: 'tempo_independencia', label: 'Tempo p/ Independência' },
      { key: 'interesse_holding', label: 'Interesse em Holding?', format: 'boolean' },
      { key: 'perfil_indicacao', label: 'Perfil de Indicação' },
      { key: 'esporte_hobby', label: 'Esporte/Hobby' },
      { key: 'gosta_futebol', label: 'Gosta de Futebol?', format: 'boolean' },
      { key: 'time_futebol', label: 'Time' },
      { key: 'bancos', label: 'Bancos', format: 'json' },
    ],
  },
];

function formatValue(value: unknown, fmt?: string): string {
  if (value === null || value === undefined || value === '') return '';
  if (fmt === 'currency') return formatCurrency(Number(value));
  if (fmt === 'date') {
    try {
      return format(new Date(String(value)), 'dd/MM/yyyy', { locale: ptBR });
    } catch {
      return String(value);
    }
  }
  if (fmt === 'boolean') return value ? 'Sim' : 'Não';
  if (fmt === 'json') {
    if (Array.isArray(value)) return value.join(', ');
    if (typeof value === 'object') return JSON.stringify(value);
  }
  return String(value);
}

export function LeadProfileSection({ contactId, dealId }: LeadProfileSectionProps) {
  const [open, setOpen] = useState(false);
  const { data: profile, isLoading } = useLeadProfile(contactId, dealId);

  if (isLoading || !profile) return null;

  // Count filled fields
  const filledCount = CATEGORIES.flatMap(c => c.fields).filter(f => {
    const v = (profile as any)[f.key];
    return v !== null && v !== undefined && v !== '';
  }).length;

  if (filledCount === 0) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 px-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors text-left">
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        <ClipboardList className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium text-foreground flex-1">Perfil do Lead</span>
        <Badge variant="secondary" className="text-xs">{filledCount} campos</Badge>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 space-y-3">
        {CATEGORIES.map(cat => {
          const filledFields = cat.fields.filter(f => {
            const v = (profile as any)[f.key];
            return v !== null && v !== undefined && v !== '';
          });
          if (filledFields.length === 0) return null;
          return (
            <div key={cat.title} className="rounded-lg border border-border bg-card p-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{cat.title}</h4>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                {filledFields.map(f => (
                  <div key={f.key} className="min-w-0">
                    <span className="text-[11px] text-muted-foreground">{f.label}</span>
                    <p className="text-sm text-foreground break-words">{formatValue((profile as any)[f.key], f.format)}</p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        {profile.lead_score != null && (
          <div className="flex items-center gap-2 px-1">
            <span className="text-xs text-muted-foreground">Lead Score:</span>
            <Badge variant="outline">{profile.lead_score}</Badge>
            {profile.icp_level != null && (
              <Badge variant="secondary">
                ICP {profile.icp_level}
                {(profile as any).icp_level_name ? ` · ${(profile as any).icp_level_name}` : ''}
              </Badge>
            )}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
