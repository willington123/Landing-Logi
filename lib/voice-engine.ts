'use client';

import { VoiceCallTask, CallLogMessage } from './types';

export interface VoiceSimulationCallbacks {
  onSpeak: (speaker: 'agent' | 'customer', text: string) => void;
  onStatusChange: (status: VoiceCallTask['status']) => void;
  onComplete: (task: VoiceCallTask) => void;
}

export class VoiceCallSimulator {
  private task: VoiceCallTask;
  private callbacks: VoiceSimulationCallbacks;
  private isRunning = false;
  private speechSynth: SpeechSynthesis | null = null;
  private currentStep = 0;

  constructor(task: VoiceCallTask, callbacks: VoiceSimulationCallbacks) {
    this.task = { ...task };
    this.callbacks = callbacks;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.speechSynth = window.speechSynthesis;
    }
  }

  public async startCall(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    this.task.startedAt = new Date().toISOString();
    this.task.attempts += 1;
    this.task.status = 'calling';
    this.callbacks.onStatusChange('calling');

    // Step 1: Agent Greeting
    const greeting = `¡Hola ${this.task.customerName}! Te habla Valentina, asistente virtual oficial de LogiPages. ¿Cómo estás hoy?`;
    await this.agentSpeak(greeting);
  }

  public async handleCustomerResponse(userText: string): Promise<void> {
    if (!this.isRunning) return;

    // Log customer response
    const msg: CallLogMessage = {
      speaker: 'customer',
      text: userText,
      timestamp: this.getElapsedFormatted(),
    };
    this.task.transcript.push(msg);
    this.callbacks.onSpeak('customer', userText);

    // Decision Logic
    const lower = userText.toLowerCase();

    // Check cancellation
    if (lower.includes('cancelar') || lower.includes('no quiero') || lower.includes('no lo pedí') || lower.includes('error')) {
      const cancellationMsg = `Entendido perfectamente ${this.task.customerName}. Procedo a cancelar la orden de inmediato sin ningún cobro ni compromiso. ¡Que tengas un excelente día!`;
      await this.agentSpeak(cancellationMsg);
      this.finishCall('cancelled', {
        confirmed: false,
        customerSentiment: 'rejected',
        cancellationReason: `El cliente indicó en llamada: "${userText}"`,
      });
      return;
    }

    // Check address or quantity correction
    if (lower.includes('cambiar') || lower.includes('me mudé') || lower.includes('otra dirección') || lower.includes('equivoc') || lower.includes('corregir')) {
      const reviewMsg = `Anoto la novedad: "${userText}". Para evitar errores en la entrega, derivaré este pedido a un asesor humano de logística que te escribirá por WhatsApp en 10 minutos.`;
      await this.agentSpeak(reviewMsg);
      this.finishCall('needs_review', {
        confirmed: false,
        notes: `Cliente solicitó corrección manual: ${userText}`,
        customerSentiment: 'neutral',
        cancellationReason: 'Requiere verificación manual de datos',
      });
      return;
    }

    // Progression Steps
    this.currentStep++;

    if (this.currentStep === 1) {
      // Step 2: Confirm Order & Payment Method
      const step2 = `Te llamo para verificar tu pedido contraentrega. ¿Confirmas que vas a recibir y pagar en efectivo cuando el repartidor llegue a tu domicilio?`;
      await this.agentSpeak(step2);
    } else if (this.currentStep === 2) {
      // Check confirmation
      if (lower.includes('si') || lower.includes('sí') || lower.includes('claro') || lower.includes('confirmo') || lower.includes('de acuerdo') || lower.includes('correcto')) {
        const confirmMsg = `¡Excelente! Tu pedido queda 100% verificado y aprobado para despacho prioritario hoy mismo. Te llegará un mensaje de WhatsApp con el número de guía. ¡Muchas gracias por tu compra!`;
        await this.agentSpeak(confirmMsg);
        this.finishCall('confirmed_by_voice', {
          confirmed: true,
          verifiedQuantity: 1,
          customerSentiment: 'positive',
          notes: 'Cliente confirmó afirmativamente por llamada de voz.',
        });
      } else {
        const unclearMsg = `No logré escuchar una confirmación clara. Por seguridad de tu envío, dejaré el pedido en revisión para que un asesor te contacte. ¡Gracias!`;
        await this.agentSpeak(unclearMsg);
        this.finishCall('needs_review', {
          confirmed: false,
          customerSentiment: 'neutral',
          notes: `Respuesta ambigua del cliente: "${userText}"`,
        });
      }
    }
  }

  private async agentSpeak(text: string): Promise<void> {
    const msg: CallLogMessage = {
      speaker: 'agent',
      text,
      timestamp: this.getElapsedFormatted(),
    };
    this.task.transcript.push(msg);
    this.callbacks.onSpeak('agent', text);

    if (this.speechSynth && 'SpeechSynthesisUtterance' in window) {
      return new Promise((resolve) => {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'es-ES';
        utterance.rate = 1.05;
        utterance.pitch = 1.0;
        utterance.onend = () => resolve();
        utterance.onerror = () => resolve();
        this.speechSynth!.speak(utterance);
      });
    } else {
      // Delay simulation if synthesis not available
      return new Promise((r) => setTimeout(r, 1200));
    }
  }

  public finishCall(
    status: VoiceCallTask['status'],
    structuredResult?: VoiceCallTask['structuredResult']
  ): void {
    this.isRunning = false;
    this.task.status = status;
    this.task.completedAt = new Date().toISOString();
    this.task.durationSeconds = 48; // realistic duration
    if (structuredResult) {
      this.task.structuredResult = structuredResult;
    }
    this.callbacks.onStatusChange(status);
    this.callbacks.onComplete(this.task);
  }

  private getElapsedFormatted(): string {
    const sec = this.task.transcript.length * 8;
    const mins = Math.floor(sec / 60);
    const remainingSecs = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${remainingSecs.toString().padStart(2, '0')}`;
  }
}
