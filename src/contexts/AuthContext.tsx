import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { getRolesFromToken } from '@/utils/jwt';

type AppRole = 'admin' | 'manager' | 'viewer' | 'sdr' | 'closer' | 'coordenador' | 'closer_sombra' | 'financeiro' | 'rh';

const ROLE_PRIORITY: Record<string, number> = {
  admin: 1,
  manager: 2,
  coordenador: 3,
  closer: 4,
  closer_sombra: 5,
  financeiro: 6,
  rh: 7,
  sdr: 8,
  viewer: 9,
};

// Timeout constants
const AUTH_TIMEOUT_MS = 5000; // 5s for session check
const WATCHDOG_TIMEOUT_MS = 10000; // 10s absolute max

interface AuthState {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  allRoles: AppRole[];
  loading: boolean;
}

interface AuthContextType extends AuthState {
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signOut: () => Promise<void>;
  hasRole: (role: AppRole) => boolean;
  hasAnyRole: (...roles: AppRole[]) => boolean;
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper: Promise with timeout
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))
  ]);
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [allRoles, setAllRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  
  const initialSessionHandled = useRef(false);
  const initStartTime = useRef(Date.now());

  // Check if user is blocked - with timeout (background, non-blocking)
  const checkUserBlockedInBackground = async (userId: string) => {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('access_status, blocked_until')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.warn('[Auth] Error checking profile:', error);
        return;
      }

      if (!profile) return;

      const isBlocked = profile.access_status === 'bloqueado' || 
                       profile.access_status === 'desativado' ||
                       (profile.blocked_until && new Date(profile.blocked_until) > new Date());
      
      if (isBlocked) {
        console.log('[Auth] User is blocked, signing out');
        await supabase.auth.signOut();
        setUser(null);
        setSession(null);
        setRole(null);
        setAllRoles([]);
        toast.error('Sua conta foi bloqueada ou desativada.');
      }
    } catch (err) {
      console.warn('[Auth] Exception checking blocked:', err);
    }
  };

  // Extract and sort roles from JWT token
  const extractRolesFromSession = (newSession: Session): { primaryRole: AppRole; roles: AppRole[] } => {
    const tokenRoles = getRolesFromToken(newSession.access_token) as AppRole[];
    
    if (tokenRoles.length === 0) {
      console.log('[Auth] No roles in token, defaulting to viewer');
      return { primaryRole: 'viewer', roles: ['viewer'] };
    }

    const sortedRoles = [...tokenRoles].sort((a, b) => 
      (ROLE_PRIORITY[a] || 99) - (ROLE_PRIORITY[b] || 99)
    );

    console.log('[Auth] Extracted roles from JWT:', { primary: sortedRoles[0], all: sortedRoles });
    return { primaryRole: sortedRoles[0], roles: sortedRoles };
  };

  // Handle session - INSTANT role assignment from JWT
  const handleSession = (newSession: Session | null) => {
    const elapsed = Date.now() - initStartTime.current;
    console.log(`[Auth] handleSession called after ${elapsed}ms, session:`, !!newSession);
    
    if (!newSession?.user) {
      setSession(null);
      setUser(null);
      setRole(null);
      setAllRoles([]);
      setLoading(false);
      console.log('[Auth] No session, auth complete');
      return;
    }

    // INSTANT: Roles come directly from JWT token!
    const { primaryRole, roles } = extractRolesFromSession(newSession);

    setSession(newSession);
    setUser(newSession.user);
    setRole(primaryRole);
    setAllRoles(roles);
    setLoading(false);
    
    console.log('[Auth] Session set with roles from JWT:', { primaryRole, roles });

    // Check blocked status in background (non-blocking)
    checkUserBlockedInBackground(newSession.user.id);
  };

  useEffect(() => {
    initStartTime.current = Date.now();
    console.log('[Auth] Initializing auth with JWT-based roles...');

    // WATCHDOG: Force loading=false after absolute max time
    const watchdogTimer = setTimeout(() => {
      if (loading) {
        console.warn('[Auth] Watchdog triggered! Forcing loading=false');
        setLoading(false);
      }
    }, WATCHDOG_TIMEOUT_MS);

    // Setup auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        console.log(`[Auth] onAuthStateChange: ${event}`);
        
        if (event === 'INITIAL_SESSION') {
          if (initialSessionHandled.current) {
            return;
          }
          initialSessionHandled.current = true;
        }
        
        // For token refresh, just update session and re-extract roles from new token
        if ((event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') && 
            user && 
            newSession?.user?.id === user.id) {
          console.log('[Auth] Token refreshed, re-extracting roles from new JWT');
          const { primaryRole, roles } = extractRolesFromSession(newSession);
          setSession(newSession);
          setRole(primaryRole);
          setAllRoles(roles);
          return;
        }
        
        handleSession(newSession);
      }
    );

    // Also try getSession (with timeout) as backup
    const getSessionWithTimeout = async () => {
      try {
        const result = await withTimeout(
          supabase.auth.getSession(),
          AUTH_TIMEOUT_MS,
          { data: { session: null }, error: null }
        );
        
        if (!initialSessionHandled.current) {
          initialSessionHandled.current = true;
          handleSession(result.data.session);
        }
      } catch (err) {
        console.error('[Auth] getSession error:', err);
        if (!initialSessionHandled.current) {
          initialSessionHandled.current = true;
          setLoading(false);
        }
      }
    };

    getSessionWithTimeout();

    return () => {
      clearTimeout(watchdogTimer);
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    const LOGIN_TIMEOUT_MS = 15000;
    
    try {
      const authResult = await withTimeout(
        supabase.auth.signInWithPassword({ email, password }),
        LOGIN_TIMEOUT_MS,
        null
      );

      if (!authResult) {
        throw new Error('Servidor não respondeu. Tente novamente.');
      }

      if (authResult.error) {
        const errMsg = authResult.error.message || '';
        if (errMsg.includes('fetch') || errMsg.includes('network') || errMsg.includes('Failed to fetch')) {
          throw new Error('Erro de conexão. Verifique sua internet e tente novamente.');
        }
        throw new Error(authResult.error.message);
      }
      
      if (!authResult.data?.user || !authResult.data?.session) {
        throw new Error('Falha na autenticação. Tente novamente.');
      }

      const userId = authResult.data.user.id;
      
      // Quick blocked check
      const { data: profile } = await supabase
        .from('profiles')
        .select('access_status, blocked_until')
        .eq('id', userId)
        .maybeSingle();
      
      const isBlocked = profile?.access_status === 'bloqueado' || 
                       profile?.access_status === 'desativado' ||
                       (profile?.blocked_until && new Date(profile.blocked_until) > new Date());
      
      if (isBlocked) {
        await supabase.auth.signOut();
        throw new Error('Sua conta está bloqueada. Entre em contato com o administrador.');
      }

      // Extract roles from the new session's JWT token
      const { primaryRole, roles } = extractRolesFromSession(authResult.data.session);
      
      toast.success('Login realizado com sucesso!');
      
      // Navigate based on role
      if (primaryRole === 'sdr') {
        navigate('/sdr/minhas-reunioes');
      } else {
        navigate('/home');
      }

      // Background: update last_login_at
      setTimeout(async () => {
        try {
          await supabase
            .from('profiles')
            .update({ last_login_at: new Date().toISOString() })
            .eq('id', userId);
          console.log('[Auth] last_login_at updated');
        } catch (err) {
          console.warn('[Auth] Failed to update last_login_at:', err);
        }
      }, 0);
      
    } catch (error: any) {
      const errMsg = error.message || 'Erro ao fazer login';
      if (errMsg.includes('fetch') || errMsg.includes('network') || errMsg.includes('Failed')) {
        toast.error('Erro de conexão. Verifique sua internet.');
      } else {
        toast.error(errMsg);
      }
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    setLoading(true);
    try {
      const redirectUrl = `${window.location.origin}/`;
      
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: fullName,
          },
        },
      });

      if (error) throw error;
      
      toast.success('Conta criada com sucesso! Verifique seu email para confirmar.');
      navigate('/');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao criar conta');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error && !error.message.includes('session missing') && 
          !error.message.includes('session_not_found')) {
        console.warn('Logout warning:', error.message);
      }
    } catch (error: any) {
      console.warn('Logout error (ignored):', error.message);
    } finally {
      setUser(null);
      setSession(null);
      setRole(null);
      setAllRoles([]);
      toast.success('Logout realizado com sucesso!');
      navigate('/auth');
    }
  };

  const hasRole = (requiredRole: AppRole): boolean => {
    if (allRoles.length === 0) return false;
    if (allRoles.includes('admin')) return true;
    if (allRoles.includes('manager') && requiredRole === 'viewer') return true;
    return allRoles.includes(requiredRole);
  };

  const hasAnyRole = (...roles: AppRole[]): boolean => {
    if (allRoles.length === 0) return false;
    if (allRoles.includes('admin')) return true;
    return roles.some(r => allRoles.includes(r));
  };

  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth`,
      });
      
      if (error) throw error;
      
      toast.success('Email de recuperação enviado! Verifique sua caixa de entrada.');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao enviar email de recuperação');
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        role,
        allRoles,
        loading,
        signIn,
        signUp,
        signOut,
        hasRole,
        hasAnyRole,
        resetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
