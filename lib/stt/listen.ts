import { pickRecorderMimeType } from "./client";
import { voiceVadConfig } from "./settings";
import {
  createVadState,
  rmsFromByteTimeDomain,
  tickVad,
  type VadConfig,
  type VadState,
} from "./vad";

const VAD_METER_URL = "/audio/vad-meter.worklet.js";
const WORKLET_LOAD_TIMEOUT_MS = 2000;
const FRAME_MS = 20;
/** Fallback path only (no AudioWorklet): analyser polling interval. */
const TICK_MS = 50;
const TIMESLICE_MS = 250;
const STOP_WATCHDOG_MS = 1000;
const FREEZE_TICKS = 8;
/** Wall-clock checks for when audio frames stop arriving altogether. */
const BACKSTOP_MS = 250;
const STALL_MS = 500;

export type ListenSession = {
  stream: MediaStream;
  context: AudioContext;
  analyser: AnalyserNode;
  source: MediaStreamAudioSourceNode;
  tap: MediaStreamAudioDestinationNode;
  timeData: Uint8Array;
  /** Audio-thread RMS meter. Null when AudioWorklet is unavailable. */
  meter: AudioWorkletNode | null;
  sink: GainNode | null;
};

export type StopReason = "silence" | "max" | "manual" | "discard";

export type UtteranceResult = {
  blob: Blob;
  mimeType: string;
  reason: StopReason;
  speechSeen: boolean;
};

export type UtteranceHandle = {
  /** Flush audio captured so far and hand it to the caller. */
  stopManual: () => void;
  /** Drop the recording. Used when leaving the page or starting a new quote. */
  discard: () => void;
};

/** Live VAD readout for the level bars and the ?voiceDebug=1 line. */
export type VoiceMeter = {
  level: number;
  speechSeen: boolean;
  rms: number;
  floor: number;
  speechOn: number;
  speechOff: number;
  silentMs: number;
  source: "worklet" | "analyser";
};

/** Durdur submits whatever was captured. Silence still waits for VAD. */
export function shouldSubmitUtterance(result: UtteranceResult): boolean {
  if (result.reason === "discard" || result.blob.size === 0) return false;
  if (result.reason === "manual") return true;
  return result.speechSeen;
}

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

function safeDisconnect(node: AudioNode | null): void {
  try {
    node?.disconnect();
  } catch {
    /* already disconnected */
  }
}

async function attachMeter(
  context: AudioContext,
  source: MediaStreamAudioSourceNode,
): Promise<{ meter: AudioWorkletNode; sink: GainNode } | null> {
  if (!context.audioWorklet || typeof AudioWorkletNode === "undefined") return null;
  let meter: AudioWorkletNode | null = null;
  let sink: GainNode | null = null;
  try {
    let timer = 0;
    await Promise.race([
      context.audioWorklet.addModule(VAD_METER_URL),
      new Promise((_, reject) => {
        timer = window.setTimeout(
          () => reject(new Error("worklet timeout")),
          WORKLET_LOAD_TIMEOUT_MS,
        );
      }),
    ]).finally(() => window.clearTimeout(timer));
    meter = new AudioWorkletNode(context, "vad-meter", {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [1],
      processorOptions: { frameMs: FRAME_MS },
    });
    // Muted route to the destination keeps the node pulled in every browser.
    sink = context.createGain();
    sink.gain.value = 0;
    source.connect(meter);
    meter.connect(sink);
    sink.connect(context.destination);
    return { meter, sink };
  } catch {
    safeDisconnect(meter);
    safeDisconnect(sink);
    return null;
  }
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
  try {
    await context.resume();
    const source = context.createMediaStreamSource(stream);
    const analyser = context.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.5;
    const tap = context.createMediaStreamDestination();
    source.connect(analyser);
    analyser.connect(tap);
    const metered = await attachMeter(context, source);
    return {
      stream,
      context,
      analyser,
      source,
      tap,
      timeData: createTimeData(analyser.fftSize),
      meter: metered?.meter ?? null,
      sink: metered?.sink ?? null,
    };
  } catch (error) {
    void context.close();
    stopTracks(stream);
    throw error;
  }
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
  if (session.meter) session.meter.port.onmessage = null;
  safeDisconnect(session.source);
  safeDisconnect(session.analyser);
  safeDisconnect(session.tap);
  safeDisconnect(session.meter);
  safeDisconnect(session.sink);
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
  onMeter: (meter: VoiceMeter) => void,
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
  const meterSource: VoiceMeter["source"] = session.meter ? "worklet" : "analyser";
  // Worklet frames carry audio-clock time; the fallback uses performance.now().
  const clockNow = () =>
    session.meter ? session.context.currentTime * 1000 : performance.now();
  const startWall = performance.now();
  let vad: VadState = createVadState(clockNow());
  let lastFrameAt = vad.startedAt;
  let lastFrameWall = startWall;
  let lastSpeechWall: number | null = null;
  let stalledSince: number | null = null;
  let reason: StopReason = "silence";
  let speechSeen = false;
  let finishing = false;
  let delivered = false;
  let pollId = 0;
  let backstopId = 0;
  let watchdogId = 0;
  let rafId = 0;
  let pendingMeter: VoiceMeter | null = null;

  const result = (): UtteranceResult => ({
    blob: new Blob(chunks, { type: recorder.mimeType || "audio/webm" }),
    mimeType: recorder.mimeType,
    reason,
    speechSeen,
  });

  const releaseRecStream = () => {
    if (ownsRecStream) stopTracks(recStream);
  };

  const stopMetering = () => {
    if (session.meter) session.meter.port.onmessage = null;
    window.clearInterval(pollId);
    window.clearInterval(backstopId);
    if (rafId) window.cancelAnimationFrame(rafId);
    rafId = 0;
  };

  const deliver = () => {
    if (delivered) return;
    delivered = true;
    finishing = true;
    stopMetering();
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
    stopMetering();
    if (recorder.state === "recording" || recorder.state === "paused") {
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

  // UI updates at most once per animation frame; VAD itself runs per audio frame.
  const publish = (meter: VoiceMeter) => {
    pendingMeter = meter;
    if (rafId) return;
    rafId = window.requestAnimationFrame(() => {
      rafId = 0;
      if (pendingMeter && !finishing) onMeter(pendingMeter);
    });
  };

  const handleFrame = (rms: number, at: number) => {
    // Frames captured before this utterance began are ignored.
    if (finishing || at <= lastFrameAt) return;
    lastFrameAt = at;
    lastFrameWall = performance.now();
    stalledSince = null;
    const tick = tickVad(vad, rms, at, vadConfig);
    if (tick.state.lastLoudAt !== vad.lastLoudAt) lastSpeechWall = lastFrameWall;
    vad = tick.state;
    speechSeen = tick.state.speechSeen;
    publish({
      level: tick.level,
      speechSeen,
      rms,
      floor: tick.thresholds.floor,
      speechOn: tick.thresholds.speechOn,
      speechOff: tick.thresholds.speechOff,
      silentMs: tick.silentMs,
      source: meterSource,
    });
    if (tick.decision !== "continue") stopRecorder(tick.decision);
  };

  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };
  // stop() already emits a final dataavailable. Deliver on the next turn so
  // that chunk is in `chunks` before the blob is built.
  recorder.onstop = () => {
    window.setTimeout(deliver, 0);
  };
  recorder.onerror = () => {
    if (!finishing) reason = "silence";
    deliver();
  };

  try {
    recorder.start(TIMESLICE_MS);
  } catch {
    deliver();
    return { stopManual: () => deliver(), discard: () => deliver() };
  }

  if (session.meter) {
    session.meter.port.onmessage = (event: MessageEvent<{ rms: number; t: number }>) => {
      handleFrame(event.data.rms, event.data.t);
    };
  } else {
    const previous = createTimeData(session.timeData.length);
    let freezeTicks = 0;
    pollId = window.setInterval(() => {
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
      }
      handleFrame(rms, performance.now());
    }, TICK_MS);
  }

  // If audio frames stop (context suspended, device switched), fall back to
  // the wall clock so the take still ends. A stall must be seen on two
  // consecutive checks, so a busy main thread with queued frames never
  // counts as one.
  backstopId = window.setInterval(() => {
    if (finishing) return;
    const wall = performance.now();
    if (wall - startWall >= vadConfig.maxRecordMs + STOP_WATCHDOG_MS) {
      stopRecorder("max");
      return;
    }
    if (wall - lastFrameWall < STALL_MS) {
      stalledSince = null;
      return;
    }
    wakeAudioContext(session);
    if (stalledSince === null) {
      stalledSince = wall;
      return;
    }
    if (
      wall - stalledSince >= STALL_MS &&
      speechSeen &&
      lastSpeechWall !== null &&
      wall - lastSpeechWall >= vadConfig.silenceMs
    ) {
      stopRecorder("silence");
    }
  }, BACKSTOP_MS);

  return {
    stopManual: () => stopRecorder("manual"),
    discard: () => stopRecorder("discard"),
  };
}
