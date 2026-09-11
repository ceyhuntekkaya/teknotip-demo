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
const TIMESLICE_MS = 250;
const STOP_WATCHDOG_MS = 1000;
const FREEZE_TICKS = 8;
/** 1 = no smoothing (old behavior). 0.4 absorbs single-tick spikes. */
const RMS_SMOOTHING = 0.4;

export type ListenSession = {
  stream: MediaStream;
  context: AudioContext;
  analyser: AnalyserNode;
  source: MediaStreamAudioSourceNode;
  tap: MediaStreamAudioDestinationNode;
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

export function byteBuffersEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function audioContextConstructor(): typeof AudioContext | undefined {
  if (typeof window === "undefined") return undefined;
  return (
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext
  );
}

/** 128 is PCM silence. An unwritten buffer then reads RMS 0, not 1.0. */
function createTimeData(fftSize: number): Uint8Array {
  return new Uint8Array(new ArrayBuffer(fftSize)).fill(128);
}

function stopTracks(stream: MediaStream): void {
  stream.getTracks().forEach((track) => track.stop());
}

export async function createListenSession(): Promise<ListenSession> {
  // AGC off: after speech it boosts the noise floor and looks like talking.
  // Noise suppression on: real silence stays near 0.
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: false,
    },
  });
  const Context = audioContextConstructor();
  if (!Context) {
    stopTracks(stream);
    throw new Error("AudioContext desteklenmiyor.");
  }
  const context = new Context();
  await context.resume();
  const source = context.createMediaStreamSource(stream);
  const analyser = context.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.5;
  const tap = context.createMediaStreamDestination();
  source.connect(analyser);
  analyser.connect(tap);
  return {
    stream,
    context,
    analyser,
    source,
    tap,
    timeData: createTimeData(analyser.fftSize),
  };
}

export function listenSessionLive(session: ListenSession): boolean {
  return (
    session.context.state !== "closed" &&
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
  try {
    session.tap.disconnect();
  } catch {
    /* already disconnected */
  }
  if (session.context.state !== "closed") {
    void session.context.close();
  }
  stopTracks(session.stream);
}

function wakeAudioContext(session: ListenSession): void {
  const { state } = session.context;
  if (state !== "running" && state !== "closed") {
    void session.context.resume();
  }
}

export function beginUtterance(
  session: ListenSession,
  onLevel: (level: number, speechSeen: boolean) => void,
  onStopped: (result: UtteranceResult) => void,
  vadConfig: VadConfig = voiceVadConfig(),
): UtteranceHandle {
  let recStream = session.stream;
  let ownsRecStream = false;
  try {
    recStream = session.stream.clone();
    ownsRecStream = true;
  } catch {
    recStream = session.stream;
  }

  const mimeType = pickRecorderMimeType();
  const recorder = mimeType
    ? new MediaRecorder(recStream, { mimeType })
    : new MediaRecorder(recStream);
  const chunks: Blob[] = [];
  const previous = createTimeData(session.timeData.length);
  let vad: VadState = createVadState(performance.now());
  let reason: StopReason = "silence";
  let speechSeen = false;
  let finishing = false;
  let delivered = false;
  let freezeTicks = 0;
  let smoothedRms = 0;
  let intervalId = 0;
  let watchdogId = 0;

  const result = (): UtteranceResult => ({
    blob: new Blob(chunks, { type: recorder.mimeType || "audio/webm" }),
    mimeType: recorder.mimeType,
    reason,
    speechSeen,
  });

  const releaseRecStream = () => {
    if (ownsRecStream) stopTracks(recStream);
  };

  const deliver = () => {
    if (delivered) return;
    delivered = true;
    finishing = true;
    window.clearInterval(intervalId);
    window.clearTimeout(watchdogId);
    releaseRecStream();
    onStopped(result());
  };

  const armWatchdog = () => {
    window.clearTimeout(watchdogId);
    watchdogId = window.setTimeout(() => {
      releaseRecStream();
      deliver();
    }, STOP_WATCHDOG_MS);
  };

  const stopRecorder = (next: StopReason) => {
    if (finishing) return;
    finishing = true;
    reason = next;
    window.clearInterval(intervalId);
    if (recorder.state === "recording" || recorder.state === "paused") {
      try {
        if (recorder.state === "recording") recorder.requestData();
      } catch {
        /* Safari: requestData is not always available */
      }
      try {
        recorder.stop();
      } catch {
        deliver();
        return;
      }
      armWatchdog();
      return;
    }
    deliver();
  };

  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };
  recorder.onstop = () => {
    deliver();
  };
  recorder.onerror = () => {
    if (!finishing) reason = "silence";
    deliver();
  };

  try {
    recorder.start(TIMESLICE_MS);
  } catch {
    deliver();
    return { stopManual: () => deliver() };
  }

  intervalId = window.setInterval(() => {
    wakeAudioContext(session);
    let rms = 0;
    try {
      session.analyser.getByteTimeDomainData(
        session.timeData as Parameters<AnalyserNode["getByteTimeDomainData"]>[0],
      );
      rms = rmsFromByteTimeDomain(session.timeData);
      if (byteBuffersEqual(session.timeData, previous)) {
        freezeTicks += 1;
      } else {
        freezeTicks = 0;
        previous.set(session.timeData);
      }
      if (freezeTicks >= FREEZE_TICKS) rms = 0;
    } catch {
      rms = 0;
      wakeAudioContext(session);
    }
    smoothedRms = smoothedRms * (1 - RMS_SMOOTHING) + rms * RMS_SMOOTHING;
    const tick = tickVad(vad, smoothedRms, performance.now(), vadConfig);
    vad = tick.state;
    speechSeen = tick.state.speechSeen;
    onLevel(tick.level, speechSeen);
    if (tick.decision !== "continue") stopRecorder(tick.decision);
  }, TICK_MS);

  return { stopManual: () => stopRecorder("manual") };
}
