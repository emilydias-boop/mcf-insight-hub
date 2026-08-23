import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, FileSignature, Loader2, Printer, ShieldAlert } from 'lucide-react';
import { useTermoPublico } from '@/hooks/useTermoPublico';
import { TermoMarkdown } from '@/components/consorcio/TermoMarkdown';
import { PapelBrand } from '@/components/consorcio/PapelBrand';
import { imprimirDocumento } from '@/lib/consorcioTermo';
import { PAPEL_CSS, PAPEL_PAGE_CSS } from '@/lib/documentoPapel';
import { apenasDigitos, documentoCanonico, formatCpfCnpj } from '@/lib/cpfCnpjMask';

export default function TermoAssinatura() {
  const { token } = useParams<{ token: string }>();
  const { termo, loading, notFound, assinar } = useTermoPublico(token ?? null);
  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [aceite, setAceite] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erroImpressao, setErroImpressao] = useState<'popup' | 'erro' | null>(null);

  const isComprovante = termo?.tipo === 'comprovante_cadastro';

  useEffect(() => {
    document.title = isComprovante
      ? 'Comprovante de Cadastro — MCF Capital'
      : 'Termo de Adesão — MCF Capital';
  }, [isComprovante]);

  const submit = async () => {
    setErro(null);
    setEnviando(true);
    try {
      // O certificado recebe o documento no mesmo padrão do CRM.
      await assinar(nome.trim(), documentoCanonico(cpf));
    } catch (e: any) {
      setErro(e.message || 'Não foi possível assinar o termo.');
    } finally {
      setEnviando(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (notFound || !termo) {
    return <Aviso titulo="Documento não encontrado" texto="Verifique o link recebido ou entre em contato com quem enviou o documento." />;
  }

  // Documento cancelado: a função pública não devolve o conteúdo (nem para o
  // comprovante), então a página mostra o aviso. A tarja de cancelamento aparece
  // na impressão feita internamente, pelo painel de documentos.
  if (termo.status === 'cancelado') {
    return (
      <Aviso
        titulo="Documento cancelado"
        texto="Este documento foi cancelado e não é mais válido. Fale com o seu consultor para receber um novo."
      />
    );
  }

  if (termo.status === 'expirado') {
    return <Aviso titulo="Prazo expirado" texto="O prazo para assinatura deste termo expirou. Fale com o seu consultor para receber um novo link." />;
  }

  const assinado = termo.status === 'assinado';
  const cert = termo.certificado;

  const imprimir = async () => {
    setErroImpressao(null);
    const resultado = await imprimirDocumento({
      conteudo: termo.conteudo || '',
      clienteNome: cert?.assinante_nome || termo.nome_mascarado || 'cliente',
      tituloDocumento: isComprovante ? 'Comprovante de Cadastro' : 'Termo de Adesão',
      certificado: assinado && !isComprovante ? cert : null,
    });
    setErroImpressao(resultado === 'ok' ? null : resultado);
  };

  const botaoImprimir = (
    <button onClick={imprimir} className="mcf-btn no-print">
      <Printer className="h-4 w-4" /> Imprimir / Salvar PDF
    </button>
  );

  return (
    <div className="min-h-[100dvh] bg-[#eeeeea] py-6 px-3 sm:px-6">
      <style>{`${PAPEL_CSS}
${PAPEL_PAGE_CSS}
.mcf-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;width:100%;
  background:#1f3864;color:#fff;border:0;border-radius:7px;padding:13px 18px;font-size:14px;
  font-weight:600;cursor:pointer}
.mcf-btn:hover{background:#16294a}
.mcf-btn:disabled{opacity:.5;cursor:not-allowed}
.mcf-field{display:block;margin-bottom:12px}
.mcf-field span{font-size:12px;font-weight:600;color:#444}
.mcf-field input{margin-top:4px;width:100%;box-sizing:border-box;border:1px solid #ccccc6;
  border-radius:6px;padding:11px 12px;font-size:15px;background:#fff}
.mcf-field input:focus{outline:2px solid #1f3864;outline-offset:1px}
.mcf-folha{max-width:820px;margin:0 auto;background:#fcfcfb;border:1px solid #e4e4df;
  border-radius:10px;box-shadow:0 4px 24px rgba(0,0,0,.07);padding:34px 30px}
@media print{.mcf-folha{border:0;box-shadow:none;padding:0;max-width:none}
  body{background:#fcfcfb}}
`}</style>

      <div className="mcf-folha papel">
        <PapelBrand
          subtitulo={isComprovante ? 'Comprovante de Cadastro — Consórcio' : 'Termo de Adesão — Consórcio'}
        />

        {isComprovante && (
          <p className="legal" style={{ marginTop: 0 }}>
            Documento apenas informativo — não é necessário assinar. Guarde uma cópia em PDF.
          </p>
        )}

        {assinado && !isComprovante && (
          <p className="legal" style={{ marginTop: 0, color: '#166534', fontSize: 11 }}>
            <CheckCircle2 className="h-3 w-3 inline mr-1" />
            Termo assinado com sucesso — guarde uma cópia em PDF para os seus registros.
          </p>
        )}

        {/* `bare`: esta folha já é o `.papel` — não aninhar papel em papel. */}
        <TermoMarkdown content={termo.conteudo || ''} bare />

        {isComprovante ? (
          <div className="cert">
            <div className="kv">
              <div>
                <b>Emitido em</b>
                <span>
                  {termo.visualizado_em || termo.assinado_em
                    ? new Date(termo.visualizado_em || termo.assinado_em || '').toLocaleString('pt-BR', {
                        timeZone: 'America/Sao_Paulo',
                      })
                    : new Date().toLocaleDateString('pt-BR')}
                </span>
              </div>
            </div>
            {botaoImprimir}
          </div>
        ) : assinado ? (
          <div className="cert">
            <h3>Certificado de assinatura eletrônica</h3>
            <div className="kv">
              <div>
                <b>Signatário</b>
                <span>{cert?.assinante_nome || '—'}</span>
              </div>
              <div>
                <b>CPF / CNPJ</b>
                <span>{cert?.assinante_cpf ? formatCpfCnpj(cert.assinante_cpf) || cert.assinante_cpf : '—'}</span>
              </div>
              <div>
                <b>Data e hora (Brasília)</b>
                <span>
                  {cert?.assinado_em
                    ? new Date(cert.assinado_em).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
                    : '—'}
                </span>
              </div>
              <div>
                <b>Endereço IP</b>
                <span>{cert?.assinante_ip || '—'}</span>
              </div>
            </div>
            <div className="hashline">Hash SHA-256 do conteúdo assinado: {cert?.conteudo_hash || '—'}</div>
            <p className="legal">
              Assinatura eletrônica válida nos termos da Medida Provisória nº 2.200-2/2001 e da Lei nº
              14.063/2020. Ficam registrados nome, documento, data, hora, endereço IP e o resumo criptográfico do
              conteúdo lido pelo signatário.
            </p>
            {botaoImprimir}
          </div>
        ) : (
          <div className="assin no-print">
            <h3>
              <FileSignature className="h-4 w-4 inline mr-1" /> Assinatura eletrônica
            </h3>
            <p style={{ fontSize: 12, color: '#555' }}>
              Confirme seus dados exatamente como constam no documento — conferindo com{' '}
              <strong>{termo.nome_mascarado}</strong>, documento <strong>{termo.documento_mascarado}</strong>.
            </p>

            <label className="mcf-field">
              <span>Nome completo</span>
              <input value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" />
            </label>
            <label className="mcf-field">
              <span>CPF / CNPJ</span>
              <input
                value={cpf}
                onChange={(e) => setCpf(formatCpfCnpj(e.target.value))}
                inputMode="numeric"
                placeholder="000.000.000-00"
              />
            </label>

            <label className="chk">
              <input
                type="checkbox"
                checked={aceite}
                onChange={(e) => setAceite(e.target.checked)}
                style={{ marginTop: 3, width: 16, height: 16 }}
              />
              <span>
                Declaro que li e concordo integralmente com o conteúdo deste termo e reconheço que esta
                assinatura eletrônica tem validade jurídica nos termos da Medida Provisória nº 2.200-2/2001 e da
                Lei nº 14.063/2020. Autorizo o registro de nome, documento, data, hora e endereço IP desta
                assinatura.
              </span>
            </label>

            {erro && (
              <div
                style={{
                  border: '1px solid #fca5a5',
                  background: '#fef2f2',
                  color: '#991b1b',
                  borderRadius: 6,
                  padding: 10,
                  fontSize: 12.5,
                  marginBottom: 12,
                }}
              >
                <ShieldAlert className="h-4 w-4 inline mr-1" /> {erro}
              </div>
            )}

            <button
              onClick={submit}
              disabled={
                !nome.trim() ||
                ![11, 14].includes(apenasDigitos(cpf).length) ||
                !aceite ||
                enviando
              }
              className="mcf-btn"
            >
              {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSignature className="h-4 w-4" />}
              Assinar termo
            </button>
          </div>
        )}

        {erroImpressao && (
          <p className="legal no-print" style={{ color: '#991b1b' }}>
            {erroImpressao === 'popup'
              ? 'O navegador bloqueou a janela de impressão. Libere os pop-ups deste site e toque novamente em “Imprimir / Salvar PDF”.'
              : 'Não foi possível preparar o documento para impressão. Verifique sua conexão e tente novamente.'}
          </p>
        )}

        <p className="rodape-doc">
          MCF Capital · documento gerado eletronicamente
          {isComprovante ? '' : ' · assinatura eletrônica com validade jurídica'}
        </p>
      </div>
    </div>
  );
}

function Aviso({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="min-h-[100dvh] bg-slate-100 flex items-center justify-center p-6 text-center">
      <div className="bg-white border rounded-lg shadow-sm p-8 max-w-md">
        <ShieldAlert className="h-8 w-8 text-slate-400 mx-auto mb-3" />
        <div className="text-lg font-semibold mb-2">{titulo}</div>
        <p className="text-sm text-slate-600">{texto}</p>
      </div>
    </div>
  );
}
