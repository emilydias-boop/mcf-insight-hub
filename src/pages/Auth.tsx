import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Mail, Lock, User, Zap, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ConnectivityCheck } from '@/components/auth/ConnectivityCheck';

export default function Auth() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupName, setSignupName] = useState('');
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [sendingReset, setSendingReset] = useState(false);

  const { signIn, signUp, resetPassword, user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && !loading) {
      navigate('/');
    }
  }, [user, loading, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await signIn(loginEmail, loginPassword);
    } catch (error) {
      // Error handled in AuthContext
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSendingReset(true);
    try {
      await resetPassword(forgotEmail);
      setShowForgotPassword(false);
      setForgotEmail('');
    } catch (error) {
      // Error handled in AuthContext
    } finally {
      setSendingReset(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (signupPassword !== signupConfirmPassword) {
      alert('As senhas não coincidem');
      return;
    }

    if (signupPassword.length < 6) {
      alert('A senha deve ter pelo menos 6 caracteres');
      return;
    }

    try {
      await signUp(signupEmail, signupPassword, signupName);
    } catch (error) {
      // Error handled in AuthContext
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-[#0a0a0a] text-zinc-100 selection:bg-primary selection:text-primary-foreground font-sans">
      {/* Left: Auth Form */}
      <div className="w-full lg:w-[480px] flex flex-col p-8 md:p-12 border-r border-white/5 bg-[#0d0d0d] relative z-10">
        <div className="mb-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center shadow-[0_0_20px_hsl(var(--primary)/0.35)]">
              <Zap className="w-5 h-5 text-primary-foreground" strokeWidth={2.5} />
            </div>
            <span className="text-xl font-bold tracking-tight uppercase font-mono">
              MCF <span className="text-primary">Gestão</span>
            </span>
          </div>
        </div>

        <div className="max-w-sm w-full mx-auto lg:mx-0 py-8">
          <header className="mb-8">
            <h1 className="text-3xl font-bold mb-2 tracking-tight">
              {mode === 'login' ? 'Bem-vindo ao Hub' : 'Criar conta'}
            </h1>
            <p className="text-zinc-500 text-sm">
              {mode === 'login'
                ? 'Acesse o seu centro de comando de vendas.'
                : 'Configure suas credenciais para começar.'}
            </p>
          </header>

          <ConnectivityCheck />

          {mode === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-5 mt-4">
              <div className="space-y-2">
                <Label htmlFor="login-email" className="text-xs font-semibold uppercase tracking-wider text-zinc-400 ml-1">
                  Email Corporativo
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-600" />
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="nome@mcfgestao.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    required
                    className="h-12 pl-10 bg-zinc-900/50 border-zinc-800 rounded-xl text-sm focus-visible:border-primary/50 focus-visible:ring-1 focus-visible:ring-primary/20 placeholder:text-zinc-600"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center px-1">
                  <Label htmlFor="login-password" className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    Senha
                  </Label>
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(true)}
                    className="text-xs text-primary hover:underline opacity-80 hover:opacity-100 transition-opacity"
                  >
                    Esqueci minha senha
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-600" />
                  <Input
                    id="login-password"
                    type="password"
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                    className="h-12 pl-10 bg-zinc-900/50 border-zinc-800 rounded-xl text-sm focus-visible:border-primary/50 focus-visible:ring-1 focus-visible:ring-primary/20 placeholder:text-zinc-600"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/90 shadow-[0_10px_25px_-10px_hsl(var(--primary)/0.5)] group"
              >
                {loading ? 'Entrando...' : (
                  <span className="flex items-center gap-2">
                    Entrar no Sistema
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                  </span>
                )}
              </Button>

              <p className="text-xs text-zinc-500 text-center pt-2">
                Não tem conta?{' '}
                <button type="button" onClick={() => setMode('signup')} className="text-primary hover:underline font-medium">
                  Criar acesso
                </button>
              </p>
            </form>
          ) : (
            <form onSubmit={handleSignup} className="space-y-5 mt-4">
              <div className="space-y-2">
                <Label htmlFor="signup-name" className="text-xs font-semibold uppercase tracking-wider text-zinc-400 ml-1">
                  Nome Completo
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-600" />
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder="Seu nome"
                    value={signupName}
                    onChange={(e) => setSignupName(e.target.value)}
                    required
                    className="h-12 pl-10 bg-zinc-900/50 border-zinc-800 rounded-xl text-sm focus-visible:border-primary/50 focus-visible:ring-1 focus-visible:ring-primary/20 placeholder:text-zinc-600"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="signup-email" className="text-xs font-semibold uppercase tracking-wider text-zinc-400 ml-1">
                  Email Corporativo
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-600" />
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="nome@mcfgestao.com"
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    required
                    className="h-12 pl-10 bg-zinc-900/50 border-zinc-800 rounded-xl text-sm focus-visible:border-primary/50 focus-visible:ring-1 focus-visible:ring-primary/20 placeholder:text-zinc-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="signup-password" className="text-xs font-semibold uppercase tracking-wider text-zinc-400 ml-1">
                    Senha
                  </Label>
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="••••••"
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    required
                    minLength={6}
                    className="h-12 bg-zinc-900/50 border-zinc-800 rounded-xl text-sm focus-visible:border-primary/50 focus-visible:ring-1 focus-visible:ring-primary/20 placeholder:text-zinc-600"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-confirm" className="text-xs font-semibold uppercase tracking-wider text-zinc-400 ml-1">
                    Confirmar
                  </Label>
                  <Input
                    id="signup-confirm"
                    type="password"
                    placeholder="••••••"
                    value={signupConfirmPassword}
                    onChange={(e) => setSignupConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                    className="h-12 bg-zinc-900/50 border-zinc-800 rounded-xl text-sm focus-visible:border-primary/50 focus-visible:ring-1 focus-visible:ring-primary/20 placeholder:text-zinc-600"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/90 shadow-[0_10px_25px_-10px_hsl(var(--primary)/0.5)]"
              >
                {loading ? 'Criando conta...' : 'Criar Conta'}
              </Button>

              <p className="text-xs text-zinc-500 text-center pt-2">
                Já tem conta?{' '}
                <button type="button" onClick={() => setMode('login')} className="text-primary hover:underline font-medium">
                  Entrar
                </button>
              </p>
            </form>
          )}
        </div>

        <div className="mt-auto pt-10 border-t border-white/5 flex items-center gap-3 text-[10px] text-zinc-600 font-mono uppercase tracking-wider">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            Sistema Operacional
          </span>
          <span className="w-1 h-1 rounded-full bg-zinc-800" />
          <span>Monitoramento em tempo real</span>
        </div>
      </div>

      {/* Right: Product Showcase */}
      <div className="hidden lg:flex flex-1 relative items-center justify-center bg-[#0a0a0a] overflow-hidden">
        {/* Grid backdrop */}
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              'linear-gradient(#1a1a1a 1px, transparent 1px), linear-gradient(90deg, #1a1a1a 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
        {/* Ambient glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/10 blur-[140px] rounded-full pointer-events-none" />

        <div className="relative w-full max-w-4xl h-[600px]">
          {/* KPI Card */}
          <div className="absolute top-0 right-4 w-[400px] bg-[#111] border border-white/10 rounded-xl shadow-2xl p-4 rotate-1 -translate-y-5 backdrop-blur-sm animate-fade-in">
            <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Metas da Equipe</span>
              <div className="flex gap-1">
                <div className="w-2 h-2 rounded-full bg-red-500/50" />
                <div className="w-2 h-2 rounded-full bg-yellow-500/50" />
                <div className="w-2 h-2 rounded-full bg-green-500/50" />
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-zinc-400">R1 Agendada</span>
                <span className="text-primary font-mono">100%</span>
              </div>
              <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full bg-primary w-full shadow-[0_0_8px_hsl(var(--primary))]" />
              </div>
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-zinc-400">Contrato Pago</span>
                <span className="text-primary font-mono">101%</span>
              </div>
              <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full bg-primary w-full shadow-[0_0_8px_hsl(var(--primary))]" />
              </div>
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-zinc-400">Vendas Realizadas</span>
                <span className="text-primary font-mono">98%</span>
              </div>
              <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full bg-primary w-[98%] shadow-[0_0_8px_hsl(var(--primary))]" />
              </div>
            </div>
          </div>

          {/* Kanban Card */}
          <div className="absolute top-1/2 left-0 -translate-y-1/2 w-[460px] bg-[#111] border border-white/10 rounded-2xl shadow-2xl p-5 -rotate-2 -translate-x-12 z-20 animate-fade-in">
            <div className="flex gap-4">
              <div className="flex-1 space-y-3">
                <div className="text-[10px] font-bold text-zinc-600 uppercase mb-3 tracking-wider">Negócios em Aberto</div>
                <div className="bg-zinc-900/80 border border-white/5 p-3 rounded-lg space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] font-bold">Thallis Machado</span>
                    <span className="text-[9px] bg-red-500/20 text-red-400 px-1.5 rounded font-mono">LIVE</span>
                  </div>
                  <div className="flex gap-1.5">
                    <span className="text-[9px] bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-400">A010</span>
                    <span className="text-[9px] bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-400">Kiwify</span>
                  </div>
                  <div className="flex justify-between items-center pt-1 border-t border-white/5">
                    <span className="text-primary font-mono text-[10px]">R$ 47,00</span>
                    <span className="text-[9px] text-zinc-500">1d</span>
                  </div>
                </div>
                <div className="bg-zinc-900/80 border border-white/5 p-3 rounded-lg opacity-60">
                  <div className="flex justify-between">
                    <span className="text-[11px] font-bold">Felipe Lucas</span>
                    <span className="text-[9px] bg-blue-500/20 text-blue-400 px-1.5 rounded">A010</span>
                  </div>
                </div>
              </div>
              <div className="w-px bg-white/5" />
              <div className="flex-1 space-y-3">
                <div className="text-[10px] font-bold text-zinc-600 uppercase mb-3 tracking-wider">Ganhos</div>
                <div className="bg-primary/5 border border-primary/20 p-3 rounded-lg space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] font-bold">Renata Marques</span>
                    <span className="text-[9px] bg-primary/20 text-primary px-1.5 rounded font-mono">FECHADO</span>
                  </div>
                  <div className="text-primary font-mono text-[12px] font-bold">R$ 36.922,00</div>
                </div>
              </div>
            </div>
          </div>

          {/* Agenda Card */}
          <div className="absolute bottom-8 right-0 w-[500px] bg-[#111] border border-white/10 rounded-2xl shadow-2xl p-6 rotate-1 z-10 animate-fade-in">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Agenda dos Closers</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              <div className="h-20 bg-blue-500/10 border-l-2 border-blue-500 rounded-r p-2">
                <div className="text-[9px] text-blue-400 font-bold">09:00 • Julio</div>
                <div className="text-[8px] text-zinc-500 leading-tight mt-1">Call de Fechamento</div>
              </div>
              <div className="h-24 bg-primary/10 border-l-2 border-primary rounded-r p-2">
                <div className="text-[9px] text-primary font-bold">10:15 • Will</div>
                <div className="text-[8px] text-zinc-500 leading-tight mt-1">Onboarding High Ticket</div>
              </div>
              <div className="h-16 bg-purple-500/10 border-l-2 border-purple-500 rounded-r p-2">
                <div className="text-[9px] text-purple-400 font-bold">11:30 • Sara</div>
              </div>
              <div className="h-28 bg-emerald-500/10 border-l-2 border-emerald-500 rounded-r p-2">
                <div className="text-[9px] text-emerald-400 font-bold">09:30 • Jessica</div>
                <div className="text-[8px] text-zinc-500 leading-tight mt-1">Reunião Estratégica</div>
              </div>
            </div>
          </div>

          {/* Floating metric badge */}
          <div className="absolute top-1/4 left-1/3 px-4 py-2 bg-black/80 border border-primary/40 rounded-full text-[10px] font-bold text-primary shadow-[0_0_15px_hsl(var(--primary)/0.25)] z-30 font-mono">
            +24.8% PERFORMANCE MENSAL
          </div>
        </div>
      </div>

      <Dialog open={showForgotPassword} onOpenChange={setShowForgotPassword}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Recuperar Senha</DialogTitle>
            <DialogDescription>
              Digite seu email para receber um link de recuperação de senha.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="forgot-email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="forgot-email"
                  type="email"
                  placeholder="seu@email.com"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Button type="submit" disabled={sendingReset}>
                {sendingReset ? 'Enviando...' : 'Enviar link de recuperação'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowForgotPassword(false)}
              >
                Voltar ao login
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
