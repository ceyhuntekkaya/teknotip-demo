import { pickRecorderMimeType } from "./client";
import { voiceVadConfig } from "./settings";
import {
  createVadState,
  rmsFromByteTimeDomain,
  tickVad,
  type VadConfig,
  type VadState,
} from "./vad";

const TICK_MS = 50;

export type ListenSession = {
  stream: MediaStream;
  context: AudioContext;
  analyser: AnalyserNode;
  source: MediaStreamAudioSourceNode;
  timeData: Uint8Array;
};

export type StopReason = "silence" | "max" | "manual";

export type UtteranceResult = {
  blob: Blob;
  mimeType: string;
  reason: StopReason;
  speechSeen: boolean;
};

export type UtteranceHandle = {
  stopManual: () => void;
};

function audioContextConstructor(): typeof AudioContext | undefined {
  if (typeof window === "undefined") return undefined;
  return (
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext
  );
}

export async function createListenSession(): Promise<ListenSession> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const Context = audioContextConstructor();
  if (!Context) {
    stream.getTracks().forEach((track) => track.stop());
    throw new Error("AudioContext desteklenmiyor.");
  }
  const context = new Context();
  await context.resume();
  const source = context.createMediaStreamSource(stream);
  const analyser = context.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.5;
  source.connect(analyser);
  return {
    stream,
    context,
    analyser,
    source,
    timeData: new Uint8Array(analyser.fftSize),
  };
}

export function listenSessionLive(session: ListenSession): boolean {
  return (
    session.stream.active &&
    session.stream.getAudioTracks().some((track) => track.readyState === "live")
  );
}

export function destroyListenSession(session: ListenSession | null): void {
  if (!session) return;
  try {
    session.source.disconnect();
  } catch {
    /* already disconnected */
  }
  try {
    session.analyser.disconnect();
  } catch {
    /* already disconnected */
  }
  if (session.context.state !== "closed") {
    void session.context.close();
  }
  session.stream.getTracks().forEach((track) => track.stop());
}

export function beginUtterance(
  session: ListenSession,
  onLevel: (level: number) => void,
  onStopped: (result: UtteranceResult) => void,
  vadConfig: VadConfig = voiceVadConfig(),
): UtteranceHandle {
  const mimeType = pickRecorderMimeType();
  const recorder = mimeType
    ? new MediaRecorder(session.stream, { mimeType })
    : new MediaRecorder(session.stream);
  const chunks: Blob[] = [];
  let vad: VadState = createVadState(performance.now());
  let reason: StopReason = "manual";
  let speechSeen = false;
  let finishing = false;
  let intervalId = 0;

  const stopRecorder = (next: StopReason) => {
    if (finishing) return;
    finishing = true;
    reason = next;
    window.clearInterval(intervalId);
    if (recorder.state === "recording") {
      recorder.stop();
      return;
    }
    onStopped({
      blob: new Blob(chunks, { type: recorder.mimeType || "audio/webm" }),
      mimeType: recorder.mimeType,
      reason,
      speechSeen,
    });
  };

  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };
  recorder.onstop = () => {
    window.clearInterval(intervalId);
    onStopped({
      blob: new Blob(chunks, { type: recorder.mimeType || "audio/webm" }),
      mimeType: recorder.mimeType,
      reason,
      speechSeen,
    });
  };

  recorder.start(250);
  intervalId = window.setInterval(() => {
    session.analyser.getByteTimeDomainData(
      session.timeData as Parameters<AnalyserNode["getByteTimeDomainData"]>[0],
    );
    const tick = tickVad(
      vad,
      rmsFromByteTimeDomain(session.timeData),
      performance.now(),
      vadConfig,
    );
    vad = tick.state;
    speechSeen = tick.state.speechSeen;
    onLevel(tick.level);
    if (tick.decision !== "continue") stopRecorder(tick.decision);
  }, TICK_MS);

  return { stopManual: () => stopRecorder("manual") };
}
