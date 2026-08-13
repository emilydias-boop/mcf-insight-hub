import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';
import { toast } from '@/hooks/use-toast';

// Call record interface (matches the calls table)
interface CallRecord {
  id: string;
  deal_id: string | null;
  contact_id: string | null;
  user_id: string;
  origin_id: string | null;
  twilio_call_sid: string | null;
  direction: string;
  from_number: string | null;
  to_number: string | null;
  status: string;
  started_at: string | null;
  answered_at: string | null;
  ended_at: string | null;
  duration_seconds: number;
  outcome: string | null;
  notes: string | null;
  recording_url: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

// Twilio SDK types
interface TwilioDevice {
  register: () => Promise<void>;
  unregister: () => Promise<void>;
  connect: (params: { params: Record<string, string> }) => Promise<TwilioCall>;
  on: (event: string, handler: (...args: any[]) => void) => void;
  state: string;
  destroy: () => void;
  audio?: {
    setInputDevice?: (deviceId: string) => Promise<void>;
    unsetInputDevice?: () => Promise<void>;
  };
}

interface TwilioCall {
  disconnect: () => void;
  mute: (muted: boolean) => void;
  isMuted: () => boolean;
  on: (event: string, handler: (...args: any[]) => void) => void;
  parameters: Record<string, string>;
  status: () => string;
}

type DeviceStatus = 'disconnected' | 'connecting' | 'ready' | 'busy' | 'error';
type CallStatus = 'idle' | 'connecting' | 'ringing' | 'in-progress' | 'completed' | 'failed';

interface TwilioContextType {
  device: TwilioDevice | null;
  currentCall: TwilioCall | null;
  deviceStatus: DeviceStatus;
  callStatus: CallStatus;
  callDuration: number;
  isMuted: boolean;
  currentCallId: string | null;
  currentCallDealId: string | null;
  initializeDevice: () => Promise<boolean>;
  makeCall: (phoneNumber: string, dealId?: string, contactId?: string, originId?: string) => Promise<string | null>;
  hangUp: () => void;
  toggleMute: () => void;
  isTestPipeline: (originId: string | null | undefined) => boolean;
  testPipelineId: string | null;
  // Qualification modal control (global)
  qualificationModalOpen: boolean;
  qualificationDealId: string | null;
  qualificationContactName: string | null;
  openQualificationModal: (dealId: string, contactName?: string) => void;
  closeQualificationModal: () => void;
  // Drawer state for inline call controls
  isDrawerOpen: boolean;
  drawerDealId: string | null;
  setDrawerState: (open: boolean, dealId: string | null) => void;
}

const TwilioContext = createContext<TwilioContextType | null>(null);

const TWILIO_TEST_ORIGIN_NAME = 'Twilio – Teste';
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isUuid = (value: string | null | undefined) => !!value && UUID_REGEX.test(value);

const getTwilioErrorText = (error: unknown) => {
  const err = error as {
    code?: number | string;
    name?: string;
    message?: string;
    originalError?: { name?: string; message?: string };
  };

  return [err?.code, err?.name, err?.message, err?.originalError?.name, err?.originalError?.message]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
};

const isMicrophoneDeviceError = (error: unknown) => {
  const text = getTwilioErrorText(error);
  return text.includes('31402')
    || text.includes('acquisitionfailed')
    || text.includes('usermedia')
    || text.includes('requested device not found')
    || text.includes('notfounderror');
};

const releaseMediaStream = (stream: MediaStream) => {
  stream.getTracks().forEach((track) => track.stop());
};

export function TwilioProvider({ children }: { children: ReactNode }) {
  const { user, hasAnyRole } = useAuth();
  const [device, setDevice] = useState<TwilioDevice | null>(null);
  const deviceRef = useRef<TwilioDevice | null>(null);
  const [currentCall, setCurrentCall] = useState<TwilioCall | null>(null);
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus>('disconnected');
  const [callStatus, setCallStatus] = useState<CallStatus>('idle');
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [currentCallId, setCurrentCallId] = useState<string | null>(null);
  const [currentCallDealId, setCurrentCallDealId] = useState<string | null>(null);
  const [testPipelineId, setTestPipelineId] = useState<string | null>(null);
  const [durationInterval, setDurationInterval] = useState<ReturnType<typeof setInterval> | null>(null);
  const tokenCreatedAt = useRef<number | null>(null);
  // Momento do atendimento REAL do lead (confirmado pelo webhook 'in-progress'),
  // não o instante em que o navegador aceita o leg WebRTC.
  const answeredAtRef = useRef<number | null>(null);
  const answerPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const callDurationRef = useRef(0);

  const TOKEN_MAX_AGE_MS = 50 * 60 * 1000; // 50 minutes
  
  // Qualification modal state (global)
  const [qualificationModalOpen, setQualificationModalOpen] = useState(false);
  const [qualificationDealId, setQualificationDealId] = useState<string | null>(null);
  const [qualificationContactName, setQualificationContactName] = useState<string | null>(null);
  
  // Drawer state for inline call controls
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerDealId, setDrawerDealId] = useState<string | null>(null);

  // Fetch test pipeline ID on mount
  useEffect(() => {
    async function fetchTestPipeline() {
      const { data } = await supabase
        .from('crm_origins')
        .select('id')
        .eq('name', TWILIO_TEST_ORIGIN_NAME)
        .maybeSingle();
      
      if (data) {
        setTestPipelineId(data.id);
      }
    }
    fetchTestPipeline();
  }, []);

  // Clean up duration interval
  useEffect(() => {
    return () => {
      if (durationInterval) {
        clearInterval(durationInterval);
      }
    };
  }, [durationInterval]);

  // Espelha a duração num ref para os handlers de evento (que capturam closure antiga)
  useEffect(() => {
    callDurationRef.current = callDuration;
  }, [callDuration]);

  // Timer de duração: conta a partir do ATENDIMENTO REAL (answeredAtRef), que é
  // confirmado pelo status 'in-progress' vindo do Twilio (webhook). Enquanto o lead
  // não atende, a duração permanece 0 — igual ao que o Twilio contabiliza.
  useEffect(() => {
    if (callStatus === 'in-progress' && answeredAtRef.current) {
      const tick = () => {
        const base = answeredAtRef.current;
        if (!base) return;
        setCallDuration(Math.max(0, Math.floor((Date.now() - base) / 1000)));
      };
      tick();
      const interval = setInterval(tick, 1000);
      setDurationInterval(interval);
      return () => clearInterval(interval);
    }
    if (['idle', 'completed', 'failed'].includes(callStatus)) {
      if (durationInterval) {
        clearInterval(durationInterval);
        setDurationInterval(null);
      }
    }
  }, [callStatus]);

  const initializeDevice = useCallback(async (forceRefresh = false): Promise<boolean> => {
    if (!user) return false;
    
    // If already ready and not forcing refresh, return immediately
    if (deviceStatus === 'ready' && device && !forceRefresh) {
      return true;
    }
    
    try {
      setDeviceStatus('connecting');
      
      // Destroy existing device before creating new one
      if (device) {
        try { device.destroy(); } catch (e) { /* ignore */ }
        deviceRef.current = null;
        setDevice(null);
      }
      
      // Load Twilio Voice SDK dynamically
      const { Device } = await import('@twilio/voice-sdk');
      
      // Garante que existe uma sessão válida antes de chamar a edge function
      // (a função exige JWT do usuário autenticado; sem sessão retorna 401).
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session?.access_token) {
        console.warn('[Twilio] Sem sessão ativa, abortando init do device.');
        setDeviceStatus('disconnected');
        return false;
      }

      // Get access token from our edge function
      const { data, error } = await supabase.functions.invoke('twilio-token', {
        body: { identity: user.email || user.id },
        headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
      });

      if (error || !data?.token) {
        console.error('Failed to get Twilio token:', error);
        setDeviceStatus('error');
        return false;
      }

      // Record token creation time
      tokenCreatedAt.current = Date.now();

      // Create and register device. We intentionally do not pin an inputDevice here:
      // stale microphone IDs can trigger Twilio 31402 / "Requested device not found"
      // for specific users even when browser permission is granted.
      const twilioDevice = new Device(data.token, {
        logLevel: 1,
        codecPreferences: ['opus', 'pcmu'] as any,
        edge: 'sao-paulo',
        closeProtection: true,
      } as any);

      // Auto-refresh token before expiry during active calls
      twilioDevice.on('tokenWillExpire', async () => {
        console.log('Twilio token will expire soon, refreshing...');
        try {
          const { data: refreshSession } = await supabase.auth.getSession();
          if (!refreshSession?.session?.access_token) {
            console.warn('[Twilio] Sem sessão ao renovar token.');
            return;
          }
          const { data: refreshData } = await supabase.functions.invoke('twilio-token', {
            body: { identity: user?.email || user?.id },
            headers: { Authorization: `Bearer ${refreshSession.session.access_token}` },
          });
          if (refreshData?.token) {
            twilioDevice.updateToken(refreshData.token);
            tokenCreatedAt.current = Date.now();
            console.log('Twilio token refreshed successfully');
          }
        } catch (err) {
          console.error('Failed to refresh Twilio token:', err);
        }
      });

      // Return Promise that resolves when device is registered
      return new Promise<boolean>((resolve) => {
        twilioDevice.on('registered', () => {
          console.log('Twilio device registered (edge: south-america, codec: opus)');
          setDeviceStatus('ready');
          deviceRef.current = twilioDevice as unknown as TwilioDevice;
          setDevice(twilioDevice as unknown as TwilioDevice);
          resolve(true);
        });

        twilioDevice.on('unregistered', () => {
          console.log('Twilio device unregistered');
          setDeviceStatus('disconnected');
        });

        twilioDevice.on('error', (err: Error) => {
          console.error('Twilio device error:', err);
          setDeviceStatus('error');
          resolve(false);
        });

        twilioDevice.register();
      });
      
    } catch (error) {
      console.error('Error initializing Twilio device:', error);
      setDeviceStatus('error');
      return false;
    }
  }, [user, deviceStatus, device]);

  // Ciclo de vida do Twilio atrelado ao login/logout:
  //  - Loga (SDR/Closer/Coordenador/etc.) → auto-inicializa o device em background
  //  - Desloga → derruba chamada ativa, destrói o device, reseta estado
  // Inicialização manual via QuickDialer continua funcionando como fallback.
  const autoInitTriedRef = useRef(false);
  const prevUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    const prevUserId = prevUserIdRef.current;
    const currentUserId = user?.id ?? null;

    // LOGOUT (ou troca de usuário): derruba o device
    if (prevUserId && prevUserId !== currentUserId) {
      console.log('[Twilio] Logout detectado, desligando telefone...');
      try {
        if (currentCall) {
          try { currentCall.disconnect(); } catch { /* ignore */ }
        }
        if (device) {
          try { device.destroy(); } catch { /* ignore */ }
        }
      } finally {
        deviceRef.current = null;
        setDevice(null);
        setCurrentCall(null);
        setDeviceStatus('disconnected');
        setCallStatus('idle');
        setCallDuration(0);
        setIsMuted(false);
        setCurrentCallId(null);
        setCurrentCallDealId(null);
        tokenCreatedAt.current = null;
        autoInitTriedRef.current = false;
      }
    }

    prevUserIdRef.current = currentUserId;

    // LOGIN: auto-inicializa para perfis elegíveis (uma vez por sessão)
    if (!user) return;
    if (autoInitTriedRef.current) return;
    if (deviceStatus === 'ready' || deviceStatus === 'connecting') return;
    const eligible = hasAnyRole('sdr');
    if (!eligible) return;
    autoInitTriedRef.current = true;
    console.log('[Twilio] Login detectado, inicializando telefone em background...');
    initializeDevice().catch((err) => {
      console.warn('[Twilio] Auto-init falhou (silencioso, será reativado on-demand):', err);
    });
  }, [user, deviceStatus, hasAnyRole, initializeDevice, currentCall, device]);

  // Desmontagem do provider (refresh / fechar aba): garante destruição do device
  useEffect(() => {
    return () => {
      if (device) {
        try { device.destroy(); } catch { /* ignore */ }
        deviceRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Check if token needs refresh
  const ensureValidToken = useCallback(async (): Promise<boolean> => {
    const tokenAge = tokenCreatedAt.current ? Date.now() - tokenCreatedAt.current : Infinity;
    if (tokenAge > TOKEN_MAX_AGE_MS) {
      console.log(`Twilio token expired (${Math.round(tokenAge / 60000)}min old), refreshing...`);
      toast({
        title: 'Reconectando telefone...',
        description: 'Sessão expirada, renovando conexão.',
      });
      return await initializeDevice(true);
    }
    return deviceStatus === 'ready' && !!device;
  }, [initializeDevice, deviceStatus, device]);

  // Helper to update call record in DB
  const updateCallInDb = useCallback(async (
    callId: string | null,
    updates: Record<string, any>
  ) => {
    if (!callId) return;
    try {
      const { error } = await supabase
        .from('calls')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', callId);
      if (error) console.error('Error updating call in DB:', error);
    } catch (e) {
      console.error('Failed to update call in DB:', e);
    }
  }, []);

  const FINAL_STATUSES = ['completed', 'no-answer', 'busy', 'failed', 'canceled'];

  /**
   * Finaliza o registro da chamada SEM sobrescrever o que o Twilio já reportou.
   * O webhook (DialCallStatus / RecordingDuration) é a fonte de verdade:
   * - se a linha já tem status final + ended_at, não mexemos em status/ended_at;
   * - a duração do timer local só é gravada quando o banco ainda está em 0/null.
   */
  const finalizeCallInDb = useCallback(async (
    callId: string | null,
    fallback: { status: string; durationSeconds?: number | null },
  ) => {
    if (!callId) return;
    try {
      const { data: row } = await supabase
        .from('calls')
        .select('status, ended_at, duration_seconds')
        .eq('id', callId)
        .maybeSingle();

      const webhookAlreadyFinal =
        !!row && FINAL_STATUSES.includes(row.status || '') && !!row.ended_at;

      const updates: Record<string, any> = {};
      if (!webhookAlreadyFinal) {
        updates.status = fallback.status;
        updates.ended_at = new Date().toISOString();
      }

      const localDuration = Math.max(0, fallback.durationSeconds ?? 0);
      const dbDuration = row?.duration_seconds ?? 0;
      if (localDuration > 0 && dbDuration <= 0) {
        updates.duration_seconds = localDuration;
      } else if (!row || row.duration_seconds == null) {
        updates.duration_seconds = localDuration;
      }

      if (Object.keys(updates).length === 0) return;
      await updateCallInDb(callId, updates);
    } catch (e) {
      console.error('Failed to finalize call in DB:', e);
    }
  }, [updateCallInDb]);

  const makeCall = useCallback(async (
    phoneNumber: string, 
    dealId?: string, 
    contactId?: string,
    originId?: string
  ): Promise<string | null> => {
    if (!user) {
      console.error('User not authenticated');
      return null;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      releaseMediaStream(stream);
    } catch (microphoneError) {
      console.error('Microphone preflight failed:', microphoneError);
      setCallStatus('failed');
      toast({
        title: 'Microfone indisponível',
        description: 'O Chrome não encontrou um microfone válido. Selecione outro microfone nas permissões do site ou reconecte o headset.',
        variant: 'destructive',
      });
      return null;
    }

    // Ensure token is valid before proceeding
    const tokenValid = await ensureValidToken();
    if (!tokenValid) {
      console.error('Device not ready after token refresh');
      toast({
        title: 'Erro de conexão',
        description: 'Não foi possível conectar ao telefone. Recarregue a página.',
        variant: 'destructive',
      });
      return null;
    }

    let callId: string | null = null;

    try {
      setCallStatus('connecting');
      setCallDuration(0);

      const safeDealId = isUuid(dealId) ? dealId : null;
      const safeContactId = isUuid(contactId) ? contactId : null;
      const safeOriginId = isUuid(originId) ? originId : (isUuid(testPipelineId) ? testPipelineId : null);

      // Create call record in database using direct insert
      const insertResult = await (supabase as any)
        .from('calls')
        .insert({
          user_id: user.id,
          deal_id: safeDealId,
          contact_id: safeContactId,
          origin_id: safeOriginId,
          to_number: phoneNumber,
          direction: 'outbound',
          status: 'initiated',
          started_at: new Date().toISOString()
        })
        .select('id')
        .single();

      if (insertResult.error) {
        console.error('Error creating call record:', insertResult.error);
        setCallStatus('failed');
        return null;
      }
      
      callId = insertResult.data.id;
      setCurrentCallId(callId);
      setCurrentCallDealId(safeDealId);
      answeredAtRef.current = null;
      if (answerPollRef.current) {
        clearInterval(answerPollRef.current);
        answerPollRef.current = null;
      }

      const connectWithCurrentDevice = async () => {
        const activeDevice = deviceRef.current || device;
        if (!activeDevice) throw new Error('Twilio device not ready');
        return await activeDevice.connect({
          params: {
            To: phoneNumber,
            callRecordId: callId
          }
        });
      };

      // Attempt to connect via Twilio
      let call: any;
      try {
        call = await connectWithCurrentDevice();
      } catch (connectError) {
        console.error('device.connect() failed, retrying with fresh token:', connectError);

        const isMicError = isMicrophoneDeviceError(connectError);
        if (isMicError) {
          try {
            await (deviceRef.current || device)?.audio?.unsetInputDevice?.();
          } catch (audioResetError) {
            console.warn('Failed to reset Twilio input device before retry:', audioResetError);
          }
        }
        
        // Retry once with fresh token/device. For 31402 this also clears stale browser mic selection.
        const refreshed = await initializeDevice(true);
        if (!refreshed) {
          throw isMicError
            ? new Error('Falha ao acessar o microfone. Verifique o dispositivo de entrada do Chrome/Windows e tente novamente.')
            : new Error('Failed to reconnect after token refresh');
        }

        toast({
          title: isMicError ? 'Microfone reconectado' : 'Reconectado',
          description: isMicError ? 'Tentando ligar novamente com o microfone padrão.' : 'Sessão renovada, tentando ligar novamente...',
        });

        call = await connectWithCurrentDevice();
      }

      // Capture CallSid once available and update the database
      const checkAndUpdateCallSid = async () => {
        const callSid = (call as any).parameters?.CallSid;
        if (callSid) {
          console.log(`Updating twilio_call_sid: ${callSid} for call ${callId}`);
          await supabase
            .from('calls')
            .update({ twilio_call_sid: callSid })
            .eq('id', callId);
        }
      };

      call.on('ringing', () => {
        console.log('Call ringing');
        setCallStatus('ringing');
        checkAndUpdateCallSid();
      });

      // O 'accept' do SDK significa apenas que o leg do NAVEGADOR conectou —
      // o lead pode ainda estar chamando. Marcamos o device como ocupado e
      // passamos a observar o status real reportado pelo Twilio (webhook).
      call.on('accept', () => {
        console.log('Call accepted (browser leg connected)');
        setDeviceStatus('busy');
        checkAndUpdateCallSid();

        const pollId = callId;
        if (answerPollRef.current) clearInterval(answerPollRef.current);
        answerPollRef.current = setInterval(async () => {
          if (!pollId) return;
          const { data } = await supabase
            .from('calls')
            .select('status')
            .eq('id', pollId)
            .maybeSingle();
          const status = data?.status || '';
          if (status === 'in-progress') {
            if (!answeredAtRef.current) answeredAtRef.current = Date.now();
            setCallStatus('in-progress');
            if (answerPollRef.current) {
              clearInterval(answerPollRef.current);
              answerPollRef.current = null;
            }
          } else if (FINAL_STATUSES.includes(status)) {
            if (answerPollRef.current) {
              clearInterval(answerPollRef.current);
              answerPollRef.current = null;
            }
          }
        }, 2000);
      });

      call.on('disconnect', () => {
        console.log('Call disconnected');
        if (answerPollRef.current) {
          clearInterval(answerPollRef.current);
          answerPollRef.current = null;
        }
        setCallStatus('completed');
        setDeviceStatus('ready');
        setCurrentCall(null);
        // Rede de segurança: NUNCA sobrescreve o status final do webhook e
        // grava a duração do timer local quando o banco ainda está em 0.
        finalizeCallInDb(callId, {
          status: 'completed',
          durationSeconds: answeredAtRef.current
            ? Math.max(0, Math.floor((Date.now() - answeredAtRef.current) / 1000))
            : 0,
        });
        answeredAtRef.current = null;
      });

      call.on('cancel', () => {
        console.log('Call cancelled');
        if (answerPollRef.current) {
          clearInterval(answerPollRef.current);
          answerPollRef.current = null;
        }
        setCallStatus('idle');
        setDeviceStatus('ready');
        setCurrentCall(null);
        finalizeCallInDb(callId, { status: 'canceled', durationSeconds: 0 });
        answeredAtRef.current = null;
      });

      call.on('error', (err: Error) => {
        console.error('Call error:', err);
        if (answerPollRef.current) {
          clearInterval(answerPollRef.current);
          answerPollRef.current = null;
        }
        setCallStatus('failed');
        setDeviceStatus('ready');
        setCurrentCall(null);
        finalizeCallInDb(callId, { status: 'failed', durationSeconds: 0 });
        answeredAtRef.current = null;
      });

      setCurrentCall(call as unknown as TwilioCall);

      return callId;
    } catch (error) {
      console.error('Error making call:', error);
      setCallStatus('failed');
      
      // Update DB record to 'failed' so it doesn't stay as 'initiated' forever
      if (callId) {
        updateCallInDb(callId, {
          status: 'failed',
          ended_at: new Date().toISOString(),
          duration_seconds: 0,
        });
      }

      toast({
        title: 'Erro ao ligar',
        description: 'Não foi possível realizar a chamada. Tente novamente.',
        variant: 'destructive',
      });
      
      return null;
    }
  }, [device, user, deviceStatus, testPipelineId, updateCallInDb, finalizeCallInDb, ensureValidToken, initializeDevice]);

  const hangUp = useCallback(() => {
    if (currentCall) {
      currentCall.disconnect();
      setCurrentCall(null);
      setCallStatus('completed');
      setDeviceStatus('ready');
      // Rede de segurança: grava a duração do timer local (que só corre após o
      // atendimento real) sem sobrescrever o status final do webhook.
      finalizeCallInDb(currentCallId, {
        status: 'completed',
        durationSeconds: answeredAtRef.current
          ? Math.max(0, Math.floor((Date.now() - answeredAtRef.current) / 1000))
          : callDurationRef.current,
      });
      answeredAtRef.current = null;
    }
  }, [currentCall, currentCallId, finalizeCallInDb]);

  const toggleMute = useCallback(() => {
    if (currentCall) {
      const newMuted = !isMuted;
      currentCall.mute(newMuted);
      setIsMuted(newMuted);
    }
  }, [currentCall, isMuted]);

  const isTestPipeline = useCallback((originId: string | null | undefined): boolean => {
    if (!originId || !testPipelineId) return false;
    return originId === testPipelineId;
  }, [testPipelineId]);

  // Qualification modal functions
  const openQualificationModal = useCallback((dealId: string, contactName?: string) => {
    setQualificationDealId(dealId);
    setQualificationContactName(contactName || null);
    setQualificationModalOpen(true);
  }, []);

  const closeQualificationModal = useCallback(() => {
    setQualificationModalOpen(false);
    // Don't clear the dealId immediately to allow for animations
    setTimeout(() => {
      setQualificationDealId(null);
      setQualificationContactName(null);
    }, 300);
  }, []);

  // Drawer state setter
  const setDrawerState = useCallback((open: boolean, dealId: string | null) => {
    setIsDrawerOpen(open);
    setDrawerDealId(dealId);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (device) {
        device.destroy();
        deviceRef.current = null;
      }
    };
  }, [device]);

  return (
    <TwilioContext.Provider value={{
      device,
      currentCall,
      deviceStatus,
      callStatus,
      callDuration,
      isMuted,
      currentCallId,
      currentCallDealId,
      initializeDevice,
      makeCall,
      hangUp,
      toggleMute,
      isTestPipeline,
      testPipelineId,
      // Qualification modal
      qualificationModalOpen,
      qualificationDealId,
      qualificationContactName,
      openQualificationModal,
      closeQualificationModal,
      // Drawer state
      isDrawerOpen,
      drawerDealId,
      setDrawerState
    }}>
      {children}
    </TwilioContext.Provider>
  );
}

export function useTwilio() {
  const context = useContext(TwilioContext);
  if (!context) {
    throw new Error('useTwilio must be used within a TwilioProvider');
  }
  return context;
}
