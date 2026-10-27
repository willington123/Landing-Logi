'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Phone,
  PhoneCall,
  PhoneOff,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  XCircle,
  RotateCcw,
  Clock,
  User,
  MapPin,
  Send,
  X,
  Bot,
  ExternalLink,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { VoiceCallTask, OrderItem, CallLogMessage } from '@/lib/types';
import { VoiceCallSimulator } from '@/lib/voice-engine';
import { logiStore } from '@/lib/store';

interface VoiceCallSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  task?: VoiceCallTask | null;
  order?: OrderItem | null;
  onCompleted?: (task: VoiceCallTask) => void;
}

export const VoiceCallSimulatorModal: React.FC<VoiceCallSimulatorModalProps> = ({
  isOpen,
  onClose,
  task: initialTask,
  order,
  onCompleted,
}) => {
  // Build or find working task
  const [currentTask, setCurrentTask] = useState<VoiceCallTask>(() => {
    if (initialTask) return { ...initialTask };
    return {
      id: `call-sim-${Date.now()}`,
      orderId: order?.id || 'ord-sim',
      customerName: order?.customerName || 'Carlos Andrés Morales',
      phone: order?.phone || '+57 300 123 4567',
      status: 'pending_call',
      attempts: 0,
      maxAttempts: 3,
      durationSeconds: 0,
      transcript: [],
    };
  });

  const [callState, setCallState] = useState<'idle' | 'calling' | 'connected' | 'completed'>('idle');
  const [isAgentSpeaking, setIsAgentSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [isListeningMic, setIsListeningMic] = useState(false);
  const [customInput, setCustomInput] = useState('');
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [transcriptMessages, setTranscriptMessages] = useState<CallLogMessage[]>([]);
  const [recognitionError, setRecognitionError] = useState<string | null>(null);

  const simulatorRef = useRef<VoiceCallSimulator | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const speechRecognitionRef = useRef<any>(null);

  // Sync when initialTask or order changes
  useEffect(() => {
    if (initialTask) {
      setCurrentTask({ ...initialTask });
      setTranscriptMessages(initialTask.transcript || []);
    } else if (order) {
      setCurrentTask({
        id: `call-sim-${Date.now()}`,
        orderId: order.id,
        customerName: order.customerName,
        phone: order.phone,
        status: 'pending_call',
        attempts: 0,
        maxAttempts: 3,
        durationSeconds: 0,
        transcript: [],
      });
      setTranscriptMessages([]);
    }
  }, [initialTask, order]);

  // Scroll transcript to bottom on new message
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcriptMessages, isAgentSpeaking]);

  // Duration timer
  useEffect(() => {
    if (callState === 'connected') {
      timerRef.current = setInterval(() => {
        setSecondsElapsed((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [callState]);

  // Initialize and start call when modal is opened
  useEffect(() => {
    if (!isOpen) {
      handleHangUp(false);
      return;
    }

    // Auto start call when opened
    startSimulation();

    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      if (speechRecognitionRef.current) {
        try {
          speechRecognitionRef.current.stop();
        } catch {}
      }
    };
  }, [isOpen]);

  const startSimulation = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    setCallState('calling');
    setSecondsElapsed(0);
    setTranscriptMessages([]);
    setIsAgentSpeaking(false);

    const baseTask: VoiceCallTask = {
      ...currentTask,
      status: 'calling',
      attempts: (currentTask.attempts || 0) + 1,
      startedAt: new Date().toISOString(),
      transcript: [],
    };
    setCurrentTask(baseTask);

    const simulator = new VoiceCallSimulator(baseTask, {
      onSpeak: (speaker, text) => {
        const newMsg: CallLogMessage = {
          speaker,
          text,
          timestamp: formatSeconds(secondsElapsed),
        };
        setTranscriptMessages((prev) => [...prev, newMsg]);

        if (speaker === 'agent') {
          setIsAgentSpeaking(true);
          // Estimate duration in case browser SpeechSynthesis events don't trigger
          const approxDuration = Math.max(2500, text.length * 65);
          setTimeout(() => {
            setIsAgentSpeaking(false);
          }, approxDuration);
        } else {
          setIsAgentSpeaking(false);
        }
      },
      onStatusChange: (status) => {
        if (status === 'calling') {
          setTimeout(() => {
            setCallState('connected');
          }, 1200);
        }
      },
      onComplete: (finishedTask) => {
        setCallState('completed');
        setIsAgentSpeaking(false);
        finishedTask.durationSeconds = secondsElapsed || 38;
        setCurrentTask(finishedTask);

        // Update in logiStore
        logiStore.updateCallTask(finishedTask);

        // Notify parent callback
        if (onCompleted) {
          onCompleted(finishedTask);
        }

        // Trigger confetti celebration if confirmed
        if (finishedTask.status === 'confirmed_by_voice') {
          try {
            confetti({
              particleCount: 90,
              spread: 70,
              origin: { y: 0.5 },
              colors: ['#FF252B', '#FF5A16', '#172C8A', '#10B981'],
            });
          } catch {}
        }
      },
    });

    simulatorRef.current = simulator;

    // Simulate ringtone delay before agent speaks
    setTimeout(() => {
      setCallState('connected');
      simulator.startCall();
    }, 1400);
  };

  const handleSimulatedReply = async (userReply: string) => {
    if (!simulatorRef.current || callState !== 'connected') return;
    setIsAgentSpeaking(false);
    await simulatorRef.current.handleCustomerResponse(userReply);
  };

  const handleCustomSend = () => {
    if (!customInput.trim()) return;
    const text = customInput.trim();
    setCustomInput('');
    handleSimulatedReply(text);
  };

  // Web Speech Recognition for Real Microphone
  const toggleSpeechRecognition = () => {
    if (isListeningMic) {
      if (speechRecognitionRef.current) {
        speechRecognitionRef.current.stop();
      }
      setIsListeningMic(false);
      return;
    }

    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRec) {
      setRecognitionError('Tu navegador no soporta dictado por voz directo. Puedes usar los botones o escribir.');
      setTimeout(() => setRecognitionError(null), 4000);
      return;
    }

    try {
      const recognition = new SpeechRec();
      recognition.lang = 'es-CO';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsListeningMic(true);
        setRecognitionError(null);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setIsListeningMic(false);
        if (transcript) {
          handleSimulatedReply(transcript);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        setIsListeningMic(false);
        if (event.error === 'not-allowed') {
          setRecognitionError('Permiso de micrófono denegado. Habilítalo en tu navegador.');
        } else {
          setRecognitionError('No se detectó audio claro. Intenta de nuevo.');
        }
        setTimeout(() => setRecognitionError(null), 4000);
      };

      recognition.onend = () => {
        setIsListeningMic(false);
      };

      speechRecognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error(err);
      setIsListeningMic(false);
    }
  };

  const handleHangUp = (saveStore = true) => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch {}
    }

    if (simulatorRef.current && callState === 'connected') {
      simulatorRef.current.finishCall('unanswered', {
        confirmed: false,
        customerSentiment: 'neutral',
        notes: 'Llamada terminada antes de confirmación',
      });
    }

    setCallState('idle');
    setIsAgentSpeaking(false);
    if (!saveStore) {
      onClose();
    }
  };

  const formatSeconds = (sec: number): string => {
    const mins = Math.floor(sec / 60);
    const remainingSecs = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${remainingSecs.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-fadeIn">
      {/* Modal Container: Styled as High-end Smartphone / Voice Terminal */}
      <div className="relative w-full max-w-md bg-gradient-to-b from-[#0F172A] via-[#111827] to-[#0A0F1D] border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] text-white">
        
        {/* Top Header Bar with Ambient Pill */}
        <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-white/10 bg-white/5 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <div className="relative flex h-3 w-3">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                callState === 'connected' ? 'bg-emerald-400' : callState === 'calling' ? 'bg-amber-400' : 'bg-red-400'
              }`}></span>
              <span className={`relative inline-flex rounded-full h-3 w-3 ${
                callState === 'connected' ? 'bg-emerald-500' : callState === 'calling' ? 'bg-amber-500' : 'bg-slate-400'
              }`}></span>
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              {callState === 'calling' && 'Marcando a Destino...'}
              {callState === 'connected' && 'En Llamada Automática'}
              {callState === 'completed' && 'Llamada Finalizada'}
              {callState === 'idle' && 'Simulador de Voz IA'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {callState === 'connected' && (
              <span className="flex items-center gap-1 font-mono text-xs text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                <Clock className="w-3 h-3" />
                {formatSeconds(secondsElapsed)}
              </span>
            )}
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
              title="Cerrar ventana"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Dynamic Island / Caller Card */}
        <div className="p-4 bg-gradient-to-b from-white/5 to-transparent flex flex-col items-center text-center relative">
          
          {/* Agent Avatar with Pulsing Waves */}
          <div className="relative my-2">
            {/* Pulsing Aura Rings */}
            {isAgentSpeaking && (
              <>
                <div className="absolute -inset-3 rounded-full bg-gradient-to-r from-[#FF252B] to-[#172C8A] opacity-40 blur-md animate-pulse"></div>
                <div className="absolute -inset-1 rounded-full border-2 border-[#FF252B] animate-ping opacity-60"></div>
              </>
            )}
            <div className="relative w-20 h-20 rounded-full bg-gradient-to-tr from-[#172C8A] via-[#0d1b54] to-[#FF252B] p-1 shadow-glow-navy flex items-center justify-center">
              <div className="w-full h-full rounded-full bg-slate-900 flex flex-col items-center justify-center border border-white/20">
                <Bot className="w-9 h-9 text-[#FF5A16]" />
              </div>
            </div>
          </div>

          <h3 className="text-base font-bold text-white flex items-center gap-1.5 justify-center">
            Valentina IA
            <span className="bg-gradient-to-r from-[#FF252B] to-[#FF5A16] text-[10px] text-white font-extrabold uppercase px-2 py-0.5 rounded-full shadow-sm">
              Asistente de Despachos
            </span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
            <Phone className="w-3 h-3 text-emerald-400" />
            Llamando a: <strong className="text-slate-200">{currentTask.customerName}</strong> ({currentTask.phone})
          </p>

          {/* Audio Waveform Visualizer */}
          <div className="w-full max-w-xs mt-3 px-4 py-2 bg-slate-950/70 border border-white/10 rounded-2xl flex flex-col items-center justify-center">
            <div className="flex items-center justify-center gap-1.5 h-10 w-full">
              {[40, 75, 55, 90, 60, 100, 70, 85, 45, 95, 65, 80, 50, 70, 30].map((h, i) => (
                <span
                  key={i}
                  className={`w-1.5 rounded-full transition-all duration-150 ${
                    isAgentSpeaking
                      ? 'bg-gradient-to-t from-[#172C8A] via-[#FF252B] to-[#FF5A16]'
                      : 'bg-slate-700 h-2'
                  }`}
                  style={{
                    height: isAgentSpeaking
                      ? `${Math.max(12, Math.round(h * ((i % 3 === 0 ? 1 : 0.7) + Math.random() * 0.4)))}%`
                      : '6px',
                  }}
                />
              ))}
            </div>
            <div className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5 mt-1">
              {isAgentSpeaking ? (
                <span className="text-[#FF5A16] flex items-center gap-1 animate-pulse">
                  <Sparkles className="w-3 h-3" /> Valentina hablando por voz...
                </span>
              ) : callState === 'connected' ? (
                <span className="text-slate-400">Escuchando respuesta del cliente...</span>
              ) : callState === 'calling' ? (
                <span className="text-amber-400 animate-pulse">Timbrando teléfono...</span>
              ) : (
                <span className="text-slate-400">Llamada finalizada</span>
              )}
            </div>
          </div>
        </div>

        {/* Live Conversation Bubbles Transcript */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-[170px] max-h-[220px] bg-slate-950/40 border-y border-white/5 scrollbar-thin scrollbar-thumb-white/10">
          {transcriptMessages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs italic py-6">
              <Bot className="w-6 h-6 mb-1 text-slate-600 animate-bounce" />
              Iniciando diálogo con el comprador...
            </div>
          ) : (
            transcriptMessages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex flex-col ${
                  msg.speaker === 'agent' ? 'items-start' : 'items-end'
                }`}
              >
                <div className="flex items-center gap-1 text-[10px] text-slate-400 mb-0.5 px-1">
                  <span>{msg.speaker === 'agent' ? 'Valentina IA' : currentTask.customerName}</span>
                  <span>•</span>
                  <span>{msg.timestamp}</span>
                </div>
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed shadow-md ${
                    msg.speaker === 'agent'
                      ? 'bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/60 text-slate-100 rounded-tl-sm'
                      : 'bg-gradient-to-r from-[#172C8A] to-[#1e3a8a] text-white border border-blue-400/20 rounded-tr-sm'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))
          )}
          <div ref={transcriptEndRef} />
        </div>

        {/* Call Completion Summary Banner (if finished) */}
        {callState === 'completed' ? (
          <div className="p-4 bg-slate-900/90 border-t border-white/10 flex flex-col gap-3">
            <div className="p-3 rounded-2xl bg-white/5 border border-white/10 text-center">
              {currentTask.status === 'confirmed_by_voice' ? (
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ¡PEDIDO CONFIRMADO EXITOSAMENTE!
                  </div>
                  <p className="text-xs text-slate-300">
                    Valentina validó la dirección y el compromiso de pago contraentrega.
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Estado sincronizado: <strong className="text-emerald-400">confirmed_by_voice</strong>
                  </p>
                </div>
              ) : currentTask.status === 'needs_review' ? (
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    <AlertCircle className="w-4 h-4 text-amber-400" />
                    TRANSFERIDO A ASESOR LOGÍSTICO
                  </div>
                  <p className="text-xs text-slate-300">
                    El cliente pidió corrección o aclaración. Se agendó ticket prioritario en WhatsApp.
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Estado: <strong className="text-amber-400">needs_review</strong>
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-500/20 text-red-300 border border-red-500/30">
                    <XCircle className="w-4 h-4 text-red-400" />
                    PEDIDO CANCELADO POR CLIENTE
                  </div>
                  <p className="text-xs text-slate-300">
                    El comprador desistió o no reconoció la orden. Se evitó un flete perdido.
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Estado: <strong className="text-red-400">cancelled</strong>
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={startSimulation}
                className="flex-1 py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-white transition flex items-center justify-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Repetir Prueba
              </button>
              <button
                onClick={onClose}
                className="flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-[#FF252B] to-[#FF5A16] hover:opacity-95 text-xs font-bold text-white shadow-lg shadow-red-500/20 transition flex items-center justify-center gap-1.5"
              >
                Finalizar y Cerrar
              </button>
            </div>
          </div>
        ) : (
          /* Interactive Customer Response Controls during active call */
          <div className="p-3 sm:p-4 bg-slate-900/90 border-t border-white/10 flex flex-col gap-2.5">
            <div className="text-[11px] font-semibold text-slate-400 flex items-center justify-between">
              <span>Respuestas Rápidas de Simulación:</span>
              <span className="text-[10px] text-slate-400">Haz clic para responder</span>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-1 gap-1.5">
              <button
                disabled={callState !== 'connected'}
                onClick={() => handleSimulatedReply('Sí, confirmo mi pedido y la dirección')}
                className="w-full text-left px-3 py-2 rounded-xl text-xs font-medium bg-emerald-950/50 hover:bg-emerald-900/60 border border-emerald-500/30 text-emerald-200 hover:text-white transition flex items-center gap-2 group disabled:opacity-50"
              >
                <span className="p-1 rounded-lg bg-emerald-500/20 group-hover:bg-emerald-500/30 text-emerald-300 text-sm">
                  ✅
                </span>
                <span className="flex-1 font-semibold">
                  "Sí, confirmo mi pedido y la dirección"
                </span>
              </button>

              <button
                disabled={callState !== 'connected'}
                onClick={() =>
                  handleSimulatedReply(
                    'Me equivoqué, quiero cambiar de dirección a Casa 28 en conjunto cerrado'
                  )
                }
                className="w-full text-left px-3 py-2 rounded-xl text-xs font-medium bg-amber-950/50 hover:bg-amber-900/60 border border-amber-500/30 text-amber-200 hover:text-white transition flex items-center gap-2 group disabled:opacity-50"
              >
                <span className="p-1 rounded-lg bg-amber-500/20 group-hover:bg-amber-500/30 text-amber-300 text-sm">
                  📍
                </span>
                <span className="flex-1 font-semibold">
                  "Me equivoqué, quiero cambiar de dirección a Casa 28"
                </span>
              </button>

              <button
                disabled={callState !== 'connected'}
                onClick={() => handleSimulatedReply('No lo pedí, cancelar pedido por favor')}
                className="w-full text-left px-3 py-2 rounded-xl text-xs font-medium bg-rose-950/50 hover:bg-rose-900/60 border border-rose-500/30 text-rose-200 hover:text-white transition flex items-center gap-2 group disabled:opacity-50"
              >
                <span className="p-1 rounded-lg bg-rose-500/20 group-hover:bg-rose-500/30 text-rose-300 text-sm">
                  ❌
                </span>
                <span className="flex-1 font-semibold">
                  "No lo pedí, cancelar pedido"
                </span>
              </button>
            </div>

            {/* Custom Input or Microphone */}
            <div className="flex items-center gap-2 mt-1">
              <button
                type="button"
                onClick={toggleSpeechRecognition}
                className={`p-2.5 rounded-xl border transition flex items-center justify-center shrink-0 ${
                  isListeningMic
                    ? 'bg-rose-600 text-white border-rose-400 animate-pulse'
                    : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-300'
                }`}
                title={isListeningMic ? 'Detener dictado' : 'Hablar con tu micrófono'}
              >
                {isListeningMic ? (
                  <Mic className="w-4 h-4 text-white" />
                ) : (
                  <Mic className="w-4 h-4 text-slate-300" />
                )}
              </button>

              <div className="relative flex-1">
                <input
                  type="text"
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCustomSend()}
                  placeholder={
                    isListeningMic
                      ? '🎙️ Escuchando tu voz...'
                      : 'O escribe tu respuesta personalizada...'
                  }
                  disabled={callState !== 'connected'}
                  className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#FF252B] disabled:opacity-50"
                />
                {customInput.trim() && (
                  <button
                    onClick={handleCustomSend}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-[#FF252B] text-white hover:bg-[#FF5A16] transition"
                  >
                    <Send className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Recognition error message if any */}
            {recognitionError && (
              <p className="text-[11px] text-amber-400 bg-amber-950/40 border border-amber-500/20 rounded-lg px-2.5 py-1 text-center">
                {recognitionError}
              </p>
            )}

            {/* Bottom Call Hardware Controls (Mute, Speaker, Hangup) */}
            <div className="flex items-center justify-around pt-2 border-t border-white/5">
              <button
                type="button"
                onClick={() => setIsMuted(!isMuted)}
                className={`p-2.5 rounded-full border transition flex flex-col items-center gap-1 ${
                  isMuted
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                    : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                }`}
                title="Silenciar micrófono"
              >
                {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                <span className="text-[9px]">Silenciar</span>
              </button>

              <button
                type="button"
                onClick={() => handleHangUp(true)}
                className="w-12 h-12 rounded-full bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/40 flex items-center justify-center transition transform active:scale-95"
                title="Colgar llamada"
              >
                <PhoneOff className="w-5 h-5" />
              </button>

              <button
                type="button"
                onClick={() => setIsSpeakerOn(!isSpeakerOn)}
                className={`p-2.5 rounded-full border transition flex flex-col items-center gap-1 ${
                  isSpeakerOn
                    ? 'bg-blue-500/20 border-blue-500/50 text-blue-300'
                    : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                }`}
                title="Altavoz"
              >
                {isSpeakerOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                <span className="text-[9px]">Altavoz</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VoiceCallSimulatorModal;
