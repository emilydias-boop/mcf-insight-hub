/** Cabeçalho institucional dos documentos (versão React do `papelBrandHtml`). */
import { EMPRESA_CNPJ, EMPRESA_RAZAO_SOCIAL } from '@/lib/documentoPapel';
import { LOGO_MCF_VERDE } from '@/lib/marcaAtivos';

export function PapelBrand({ subtitulo, data }: { subtitulo?: string; data?: Date }) {
  const quando = (data || new Date()).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  return (
    <div className="brand">
      <div>
        <div className="logo">
          <img src={LOGO_MCF_VERDE} alt="MCF Capital" />
          <small>Minha Casa Financiada</small>
        </div>
        {subtitulo ? <div className="sub">{subtitulo}</div> : null}
      </div>
      <div className="meta">
        {EMPRESA_RAZAO_SOCIAL}
        <br />
        CNPJ {EMPRESA_CNPJ}
        <br />
        Documento gerado em {quando}
      </div>
    </div>
  );
}
