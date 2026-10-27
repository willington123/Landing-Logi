'use client';

import React, { useState, useEffect } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import LandingWizardModal from '@/components/landings/LandingWizardModal';
import { VoiceAgentSettings } from '@/components/voice/VoiceAgentSettings';
import { VoiceCallSimulatorModal } from '@/components/voice/VoiceCallSimulatorModal';
import { logiStore } from '@/lib/store';
import { VoiceCallTask } from '@/lib/types';
import {
  PhoneCall,
  Play,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  FileText,
  User,
  History,
  Sparkles,
} from 'lucide-react';

export default function VoiceAiPage() {
  const [callTasks, setCallTasks] = useState<VoiceCallTask[]>([]);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<VoiceCallTask | null>(null);

  const refreshData = () => {
    setCallTasks(logiStore.getCallTasks());
  };

  useEffect(() => {
    refreshData();
  }, []);

  const handleTestCall = (task?: VoiceCallTask) => {
    setSelectedTask(task || callTasks[0] || null);
    setIsSimulatorOpen(true);
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar onOpenWizard={() => setIsWizardOpen(true)} />

      <div className="flex-1 flex flex-col min-w-0">
        <Header onOpenWizard={() => setIsWizardOpen(true)} title="Agente de Llamadas con IA (Voice)" />

        <main className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto w-full">
          {/* Top Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                <span>Confirmación Automatizada de Pedidos Contraentrega</span>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full uppercase">
                  Vapi / Retell / Web Audio
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Tu asistente virtual llama a cada comprador, verifica dirección y valida intención real de pago contraentrega.
              </p>
            </div>

            <button
              onClick={() => handleTestCall()}
              className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:opacity-95 text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-2 transition transform active:scale-95"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Lanzar Prueba de Voz en Vivo</span>
            </button>
          </div>

          {/* Voice Agent Settings Panel */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <VoiceAgentSettings onOpenSimulator={() => handleTestCall()} />
          </div>

          {/* Call Logs & Transcripts */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-brand-navy" />
                <h3 className="text-base font-bold text-slate-900">Historial y Transcripciones de Llamadas</h3>
              </div>
              <span className="text-xs text-slate-400 font-semibold">{callTasks.length} registros</span>
            </div>

            <div className="space-y-3">
              {callTasks.map((task) => (
                <div
                  key={task.id}
                  className="p-4 rounded-xl border border-slate-100 hover:border-slate-200 bg-slate-50/50 space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-brand-navyDark text-white flex items-center justify-center font-bold text-xs">
                        {task.customerName.charAt(0)}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900">{task.customerName}</p>
                        <p className="text-[11px] text-slate-500">{task.phone} • {task.durationSeconds}s duración</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                          task.status === 'confirmed_by_voice'
                            ? 'bg-emerald-100 text-emerald-800'
                            : task.status === 'needs_review'
                            ? 'bg-blue-100 text-blue-800'
                            : task.status === 'cancelled'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {task.status === 'confirmed_by_voice'
                          ? '✅ Confirmado por Voz'
                          : task.status === 'needs_review'
                          ? '⚠️ Revisión Humana'
                          : task.status === 'cancelled'
                          ? '❌ Cancelado por Cliente'
                          : '⏳ En Espera'}
                      </span>

                      <button
                        onClick={() => handleTestCall(task)}
                        className="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition flex items-center gap-1"
                      >
                        <PhoneCall className="w-3 h-3 text-emerald-400" />
                        <span>Simular</span>
                      </button>
                    </div>
                  </div>

                  {/* Transcript Preview */}
                  {task.transcript && task.transcript.length > 0 && (
                    <div className="p-3 bg-white border border-slate-200 rounded-lg text-xs space-y-1.5 max-h-36 overflow-y-auto">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Fragmento de Audio / Transcripción:
                      </p>
                      {task.transcript.slice(0, 3).map((m, idx) => (
                        <div key={idx} className="flex gap-2">
                          <span className={`font-bold text-[11px] ${m.speaker === 'agent' ? 'text-brand-red' : 'text-slate-800'}`}>
                            {m.speaker === 'agent' ? 'Valentina IA:' : `${task.customerName.split(' ')[0]}:`}
                          </span>
                          <span className="text-slate-600">{m.text}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {task.structuredResult && (
                    <div className="text-[11px] text-slate-500 flex items-center gap-4">
                      <span>
                        Sentimiento:{' '}
                        <strong className="text-slate-700 capitalize">
                          {task.structuredResult.customerSentiment}
                        </strong>
                      </span>
                      {task.structuredResult.notes && (
                        <span>
                          Nota: <strong className="text-slate-700">{task.structuredResult.notes}</strong>
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>

      <VoiceCallSimulatorModal
        isOpen={isSimulatorOpen}
        onClose={() => setIsSimulatorOpen(false)}
        task={selectedTask}
        onCompleted={() => refreshData()}
      />

      <LandingWizardModal
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        onGenerated={() => refreshData()}
      />
    </div>
  );
}
