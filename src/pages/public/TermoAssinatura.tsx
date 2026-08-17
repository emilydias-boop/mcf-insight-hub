import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, Download, FileBadge, FileSignature, Loader2, ShieldAlert } from 'lucide-react';
import { useTermoPublico } from '@/hooks/useTermoPublico';
import { TermoMarkdown } from '@/components/consorcio/TermoMarkdown';
import { baixarTermoPdf } from '@/lib/consorcioTermo';

export default function TermoAssinatura() {
  const { token } = useParams<{ token: string }>();
  const { termo, loading, notFound, assinar } = useTermoPublico(token ?? null);
  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [aceite, setAceite] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

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
      await assinar(nome.trim(), cpf.trim());
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

  const download = () =>
    baixarTermoPdf({
      conteudo: termo.conteudo || '',
      clienteNome: cert?.assinante_nome || termo.nome_mascarado || 'cliente',
      certificado: assinado && !isComprovante ? cert : null,
      prefixoArquivo: isComprovante ? 'comprovante-cadastro' : 'termo-adesao',
    });

  return (
    <div className="min-h-[100dvh] bg-slate-100 text-slate-900">
      <header className="bg-white border-b">
        <div className="max-w-3xl mx-auto px-5 py-5">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">MCF Capital</div>
          <h1 className="text-xl sm:text-2xl font-semibold mt-1">
            {isComprovante ? 'Comprovante de Cadastro — Consórcio' : 'Termo de Adesão — Consórcio'}
          </h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-5 py-6 space-y-5">
        {isComprovante && (
          <div className="rounded-lg border border-sky-300 bg-sky-50 p-4 flex gap-3">
            <FileBadge className="h-5 w-5 text-sky-600 shrink-0 mt-0.5" />
            <div className="text-sm">
              <div className="font-semibold text-sky-900">Comprovante de cadastro da sua cota</div>
              <div className="text-sky-800">
                Documento apenas informativo — não é necessário assinar. Guarde uma cópia em PDF.
              </div>
            </div>
          </div>
        )}

        {assinado && !isComprovante && (
          <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-4 flex gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-sm">
              <div className="font-semibold text-emerald-800">Termo assinado com sucesso</div>
              <div className="text-emerald-700">
                Guarde uma cópia em PDF para os seus registros.
              </div>
            </div>
          </div>
        )}

        <article className="bg-white rounded-lg border shadow-sm px-5 py-6 sm:px-8 sm:py-8 text-[15px] leading-relaxed">
          <TermoMarkdown content={termo.conteudo || ''} />
        </article>

        {isComprovante ? (
          <section className="bg-white rounded-lg border shadow-sm p-5 sm:p-6">
            <button
              onClick={download}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-slate-900 text-white px-4 py-2.5 text-sm font-medium hover:bg-slate-800 w-full sm:w-auto"
            >
              <Download className="h-4 w-4" /> Baixar PDF
            </button>
          </section>
        ) : assinado ? (
          <section className="bg-white rounded-lg border shadow-sm p-5 sm:p-6 space-y-3">
            <h2 className="font-semibold flex items-center gap-2">
              <FileSignature className="h-4 w-4" /> Certificado de assinatura eletrônica
            </h2>
            <dl className="text-sm space-y-1.5">
              <Linha rotulo="Assinante" valor={cert?.assinante_nome || '—'} />
              <Linha rotulo="CPF/CNPJ" valor={cert?.assinante_cpf || '—'} />
              <Linha
                rotulo="Data e hora (Brasília)"
                valor={
                  cert?.assinado_em
                    ? new Date(cert.assinado_em).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
                    : '—'
                }
              />
              <Linha rotulo="Endereço IP" valor={cert?.assinante_ip || '—'} />
              <Linha rotulo="Hash SHA-256" valor={cert?.conteudo_hash || '—'} mono />
            </dl>
            <p className="text-xs text-slate-500">
              Assinatura eletrônica com validade jurídica nos termos da MP nº 2.200-2/2001 e da Lei nº 14.063/2020.
            </p>
            <button
              onClick={download}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-slate-900 text-white px-4 py-2.5 text-sm font-medium hover:bg-slate-800 w-full sm:w-auto"
            >
              <Download className="h-4 w-4" /> Baixar PDF
            </button>
          </section>
        ) : (
          <section className="bg-white rounded-lg border shadow-sm p-5 sm:p-6 space-y-4">
            <h2 className="font-semibold">Assinatura eletrônica</h2>
            <p className="text-sm text-slate-600">
              Confirme seus dados exatamente como constam no termo — conferindo com{' '}
              <strong>{termo.nome_mascarado}</strong>, documento <strong>{termo.documento_mascarado}</strong>.
            </p>

            <div className="space-y-3">
              <label className="block">
                <span className="text-sm font-medium">Nome completo</span>
                <input
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  autoComplete="name"
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-slate-400"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium">CPF / CNPJ</span>
                <input
                  value={cpf}
                  onChange={(e) => setCpf(e.target.value)}
                  inputMode="numeric"
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-slate-400"
                />
              </label>
            </div>

            <label className="flex gap-3 items-start text-sm text-slate-700">
              <input
                type="checkbox"
                checked={aceite}
                onChange={(e) => setAceite(e.target.checked)}
                className="mt-1 h-4 w-4"
              />
              <span>
                Declaro que li e concordo integralmente com o conteúdo deste termo e reconheço que esta
                assinatura eletrônica tem validade jurídica nos termos da Medida Provisória nº 2.200-2/2001 e da
                Lei nº 14.063/2020. Autorizo o registro de nome, documento, data, hora e endereço IP desta
                assinatura.
              </span>
            </label>

            {erro && (
              <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700 flex gap-2">
                <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" /> {erro}
              </div>
            )}

            <button
              onClick={submit}
              disabled={!nome.trim() || !cpf.trim() || !aceite || enviando}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-slate-900 text-white px-5 py-3 text-base font-medium hover:bg-slate-800 disabled:opacity-50 w-full sm:w-auto"
            >
              {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSignature className="h-4 w-4" />}
              Assinar termo
            </button>
          </section>
        )}

        <footer className="text-xs text-slate-500 text-center pb-8">
          MCF Capital · documento gerado eletronicamente
        </footer>
      </main>
    </div>
  );
}

function Linha({ rotulo, valor, mono }: { rotulo: string; valor: string; mono?: boolean }) {
  return (
    <div className="flex flex-col sm:flex-row sm:gap-2">
      <dt className="text-slate-500 sm:w-52 shrink-0">{rotulo}</dt>
      <dd className={`font-medium break-all ${mono ? 'font-mono text-xs' : ''}`}>{valor}</dd>
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
