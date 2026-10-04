"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AppNav } from "@/components/layout/app-nav";
import { ActionButton } from "@/components/catalog/fields";
import { QuoteDocumentPanel } from "@/components/quote/quote-document-panel";
import { VoiceLevel } from "@/components/teklif/voice-level";
import { apiErrorMessage } from "@/lib/api/errors";
import {
  chatWithQuote,
  createQuote,
  createQuoteVersion,
  getQuoteById,
  setQuoteConverted,
  updateQuote,
} from "@/lib/api/generated/endpoints/quotes/quotes";
import type {
  CustomerResponse,
  InstitutionResponse,
  ProductResponse,
  QuoteResponse,
} from "@/lib/api/generated/model";
import { quoteToRequest } from "@/lib/api/map";
import { isQuoteActionReady } from "@/lib/quote/action-ready";
import {
  clearQuoteWorkspace,
  loadQuoteWorkspace,
  saveQuoteWorkspace,
} from "@/lib/quote/workspace";
import type { ChatMessage } from "@/lib/quote/types";
import { recordingFilename, transcribeAudio } from "@/lib/stt/client";
import {
  beginUtterance,
  createListenSession,
  destroyListenSession,
  listenSessionLive,
  shouldSubmitUtterance,
  type ListenSession,
  type UtteranceHandle,
  type UtteranceResult,
  type VoiceMeter,
} from "@/lib/stt/listen";
import { voiceSettings } from "@/lib/stt/settings";
import { isUsableTranscript } from "@/lib/stt/vad";

export function QuoteBench({
  products,
  customers,
  institutions,
  initialQuoteId,
  openInEdit = false,
  voiceDebug = false,
}: {
  products: ProductResponse[];
  customers: CustomerResponse[];
  institutions: InstitutionResponse[];
  initialQuoteId?: string;
  openInEdit?: boolean;
  /** /teklif?voiceDebug=1 shows live VAD thresholds under the level bars. */
  voiceDebug?: boolean;
}) {
  const router = useRouter();
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [voiceSession, setVoiceSession] = useState(false);
  const [voiceLevel, setVoiceLevel] = useState(0);
  const [speechHeard, setSpeechHeard] = useState(false);
  const [voiceMeter, setVoiceMeter] = useState<VoiceMeter | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const skipSave = useRef(true);
  const aliveRef = useRef(true);
  const voiceSessionRef = useRef(false);
  const recordingRef = useRef(false);
  const startingRef = useRef(false);
  const loadingRef = useRef(false);
  const listenSessionRef = useRef<ListenSession | null>(null);
  const utteranceRef = useRef<UtteranceHandle | null>(null);
  const messagesRef = useRef(messages);
  const quoteRef = useRef(quote);
  const persistTimer = useRef<number | null>(null);
  const persistInFlight = useRef<Promise<void>>(Promise.resolve());
  const startListeningRef = useRef<() => Promise<void>>(async () => {});
  const finishUtteranceRef = useRef<(result: UtteranceResult) => void>(() => {});

  messagesRef.current = messages;
  quoteRef.current = quote;

  const setSessionOpen = (open: boolean) => {
    voiceSessionRef.current = open;
    setVoiceSession(open);
  };

  const destroyListen = () => {
    utteranceRef.current = null;
    destroyListenSession(listenSessionRef.current);
    listenSessionRef.current = null;
    recordingRef.current = false;
    setRecording(false);
    setVoiceLevel(0);
    setSpeechHeard(false);
  };

  const shouldResumeVoice = () => {
    if (!aliveRef.current || !voiceSessionRef.current) return false;
    const field = inputRef.current;
    if (field?.value.trim()) return false;
    if (field && typeof window !== "undefined" && window.document.activeElement === field) {
      return false;
    }
    return true;
  };

  /** Listen again, or close the session — never leave it open but deaf. */
  const continueVoice = () => {
    if (shouldResumeVoice()) {
      void startListeningRef.current();
      return;
    }
    if (voiceSessionRef.current) {
      setSessionOpen(false);
      destroyListen();
    }
  };

  const persistQuote = useCallback(async (next: QuoteResponse) => {
    if (!next.id) return;
    const quoteId = next.id;
    const run = async () => {
      setSaving(true);
      try {
        const response = await updateQuote(quoteId, quoteToRequest(next));
        if (response.status !== 200) {
          setError(apiErrorMessage(response.data, "Teklif kaydedilemedi."));
          return;
        }
        setQuote(response.data);
      } catch {
        setError("Teklif kaydedilemedi.");
      } finally {
        setSaving(false);
      }
    };
    persistInFlight.current = run();
    await persistInFlight.current;
  }, []);

  const flushPersist = useCallback(async () => {
    if (persistTimer.current) {
      window.clearTimeout(persistTimer.current);
      persistTimer.current = null;
      const current = quoteRef.current;
      if (current) {
        await persistQuote(current);
        return;
      }
    }
    await persistInFlight.current;
  }, [persistQuote]);

  const schedulePersist = (next: QuoteResponse) => {
    setQuote(next);
    if (persistTimer.current) window.clearTimeout(persistTimer.current);
    persistTimer.current = window.setTimeout(() => {
      void persistQuote(next);
    }, 600);
  };

  const createVersion = async () => {
    await flushPersist();
    const current = quoteRef.current;
    if (!current?.id || !isQuoteActionReady(current)) return;
    setSaving(true);
    setError(null);
    try {
      const response = await createQuoteVersion(current.id);
      if (response.status !== 201) {
        setError(apiErrorMessage(response.data, "Versiyon üretilemedi."));
        return;
      }
      setQuote(response.data);
      setMessages([]);
      saveQuoteWorkspace({
        version: 3,
        quoteId: response.data.id ?? null,
        messages: [],
      });
      if (response.data.id) {
        router.replace(`/teklif?quoteId=${encodeURIComponent(response.data.id)}`);
      }
    } catch {
      setError("Versiyon üretilemedi.");
    } finally {
      setSaving(false);
    }
  };

  const selectVersion = async (id: string) => {
    if (id === quoteRef.current?.id) return;
    await flushPersist();
    setError(null);
    const response = await getQuoteById(id);
    if (response.status !== 200) {
      setError(apiErrorMessage(response.data, "Teklif yüklenemedi."));
      return;
    }
    setQuote(response.data);
    saveQuoteWorkspace({
      version: 3,
      quoteId: response.data.id ?? null,
      messages: messagesRef.current,
    });
  };

  const toggleConverted = async () => {
    const current = quoteRef.current;
    if (!current?.id) return;
    if (!current.convertedToSale && !isQuoteActionReady(current)) return;
    setSaving(true);
    setError(null);
    try {
      const response = await setQuoteConverted(current.id, {
        converted: !current.convertedToSale,
      });
      if (response.status !== 200) {
        setError(apiErrorMessage(response.data, "Satış durumu güncellenemedi."));
        return;
      }
      setQuote(response.data);
    } catch {
      setError("Satış durumu güncellenemedi.");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const workspace = loadQuoteWorkspace();
    const fromQuotes = Boolean(initialQuoteId);
    const targetId = initialQuoteId ?? workspace.quoteId;
    const nextMessages = fromQuotes ? [] : workspace.messages;
    setMessages(nextMessages);
    void (async () => {
      if (targetId) {
        const existing = await getQuoteById(targetId);
        if (existing.status === 200) {
          setQuote(existing.data);
          saveQuoteWorkspace({
            version: 3,
            quoteId: existing.data.id ?? null,
            messages: nextMessages,
          });
          return;
        }
        if (fromQuotes) {
          setError(apiErrorMessage(existing.data, "Teklif yüklenemedi."));
          return;
        }
      }
      const created = await createQuote({});
      if (created.status === 201) {
        setQuote(created.data);
        saveQuoteWorkspace({
          version: 3,
          quoteId: created.data.id ?? null,
          messages: nextMessages,
        });
      } else {
        setError(apiErrorMessage(created.data, "Teklif açılamadı."));
      }
    })();
  }, [initialQuoteId]);

  useEffect(() => {
    if (skipSave.current) {
      skipSave.current = false;
      return;
    }
    saveQuoteWorkspace({
      version: 3,
      quoteId: quote?.id ?? null,
      messages,
    });
  }, [quote?.id, messages]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [messages]);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      voiceSessionRef.current = false;
      utteranceRef.current?.discard();
      destroyListenSession(listenSessionRef.current);
      listenSessionRef.current = null;
      if (persistTimer.current) window.clearTimeout(persistTimer.current);
    };
  }, []);

  const resetQuote = async () => {
    setMessages([]);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
    setSessionOpen(false);
    utteranceRef.current?.discard();
    destroyListen();
    clearQuoteWorkspace();
    const created = await createQuote({});
    if (created.status === 201) {
      setQuote(created.data);
      saveQuoteWorkspace({
        version: 3,
        quoteId: created.data.id ?? null,
        messages: [],
      });
    } else {
      setError(apiErrorMessage(created.data, "Yeni teklif açılamadı."));
    }
  };

  const send = async (override?: string, source: "typed" | "voice" = "typed") => {
    const text = (override ?? inputRef.current?.value ?? "").trim();
    if (!text || loadingRef.current) {
      if (source === "voice") continueVoice();
      return;
    }
    if (source === "typed" && (recordingRef.current || transcribing)) return;

    if (source === "typed") {
      setSessionOpen(false);
      utteranceRef.current?.discard();
      destroyListen();
      if (inputRef.current) inputRef.current.value = "";
    }

    const nextMessages: ChatMessage[] = [
      ...messagesRef.current,
      { role: "user", content: text },
    ];
    setMessages(nextMessages);
    loadingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      await flushPersist();
      const quoteId = quoteRef.current?.id;
      if (!quoteId) {
        setError("Teklif henüz açılmadı.");
        return;
      }
      const response = await chatWithQuote({ quoteId, message: text });
      if (response.status !== 200) {
        setError(apiErrorMessage(response.data, "İstek başarısız."));
        return;
      }
      if (response.data.quote) {
        setQuote(response.data.quote);
      }
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: response.data.assistantMessage ?? "",
        },
      ]);
    } catch {
      setError("Bağlantı kurulamadı.");
    } finally {
      loadingRef.current = false;
      setLoading(false);
      if (source === "voice") continueVoice();
    }
  };

  const startListening = async () => {
    if (
      !aliveRef.current ||
      !voiceSessionRef.current ||
      recordingRef.current ||
      startingRef.current
    ) {
      return;
    }
    startingRef.current = true;
    try {
      let session = listenSessionRef.current;
      if (!session || !listenSessionLive(session)) {
        destroyListenSession(session);
        listenSessionRef.current = null;
        session = await createListenSession();
        listenSessionRef.current = session;
      } else {
        if (session.context.state !== "running") {
          await session.context.resume();
        }
        if (session.context.state !== "running") {
          destroyListenSession(session);
          listenSessionRef.current = null;
          session = await createListenSession();
          listenSessionRef.current = session;
        } else {
          await new Promise<void>((resolve) => {
            window.setTimeout(resolve, 40);
          });
        }
      }
      if (!aliveRef.current || !voiceSessionRef.current) {
        destroyListen();
        return;
      }
      recordingRef.current = true;
      setRecording(true);
      setVoiceLevel(0);
      setSpeechHeard(false);
      utteranceRef.current = beginUtterance(
        session,
        (meter) => {
          if (!aliveRef.current) return;
          setVoiceLevel(meter.level);
          setVoiceMeter(meter);
          if (meter.speechSeen) setSpeechHeard(true);
        },
        (result) => finishUtteranceRef.current(result),
      );
    } catch {
      setSessionOpen(false);
      destroyListen();
      setError("Mikrofona erişilemedi.");
    } finally {
      startingRef.current = false;
    }
  };
  startListeningRef.current = startListening;

  const finishUtterance = (result: UtteranceResult) => {
    utteranceRef.current = null;
    recordingRef.current = false;
    setRecording(false);
    setVoiceLevel(0);
    if (!aliveRef.current || result.reason === "discard") return;

    if (result.reason === "manual") {
      setSessionOpen(false);
      destroyListen();
    }

    if (!shouldSubmitUtterance(result)) {
      if (result.blob.size === 0 && (result.speechSeen || result.reason === "manual")) {
        setError("Ses kaydı boş.");
      }
      continueVoice();
      return;
    }

    void (async () => {
      setTranscribing(true);
      setError(null);
      try {
        const text = await transcribeAudio(
          result.blob,
          recordingFilename(result.mimeType),
        );
        if (!aliveRef.current) return;
        if (!isUsableTranscript(text)) {
          setError("Ses anlaşılamadı. Tekrar deneyin.");
          setTranscribing(false);
          continueVoice();
          return;
        }
        setTranscribing(false);
        await send(text, "voice");
      } catch (caught) {
        if (!aliveRef.current) return;
        setError(
          caught instanceof Error ? caught.message : "STT servisine bağlanılamadı.",
        );
        setTranscribing(false);
        continueVoice();
      } finally {
        setTranscribing(false);
      }
    })();
  };
  finishUtteranceRef.current = finishUtterance;

  const toggleSpeak = async () => {
    if (recordingRef.current) {
      setSessionOpen(false);
      utteranceRef.current?.stopManual();
      return;
    }
    if (voiceSessionRef.current && (loading || transcribing)) {
      setSessionOpen(false);
      return;
    }
    if (loading || transcribing) return;
    setError(null);
    setSessionOpen(true);
    await startListening();
  };

  const speakDisabled = (loading || transcribing) && !voiceSession && !recording;
  const speakOpen = recording || voiceSession;

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[var(--rule)] px-4 py-3">
        <div>
          <p className="font-display text-[11px] uppercase tracking-[0.22em] text-[var(--steel)]">
            TeknoTip · Genixo
          </p>
          <h1 className="font-display text-3xl leading-none tracking-wide">Teklif</h1>
        </div>
        <AppNav />
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-y-auto p-3 lg:grid-cols-[minmax(0,22rem)_1fr] lg:overflow-hidden xl:grid-cols-[minmax(0,28rem)_1fr]">
        <section className="flex h-[min(70dvh,40rem)] min-h-0 flex-col overflow-hidden border border-[var(--rule)] bg-[var(--paper)] lg:h-full">
          <header className="flex shrink-0 flex-wrap items-end justify-between gap-3 border-b border-[var(--rule)] px-4 py-3">
            <div>
              <p className="font-display text-[11px] uppercase tracking-[0.22em] text-[var(--steel)]">
                Sohbet
              </p>
              <h2 className="font-display text-2xl leading-none tracking-wide">İstek</h2>
            </div>
            <ActionButton
              type="button"
              disabled={loading || recording || transcribing}
              onClick={() => void resetQuote()}
            >
              Yeni teklif
            </ActionButton>
          </header>
          <div
            ref={scroller}
            className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-4"
          >
            {messages.length === 0 ? (
              <p className="text-sm text-[var(--steel)]">
                Örnek: “CVD fırın olsun, sıcaklık 1400, çap 60 mm.”
              </p>
            ) : (
              messages.map((message, index) => (
                <article
                  key={`${message.role}-${index}`}
                  className={`grid gap-1.5 text-sm ${
                    message.role === "user" ? "text-[var(--charcoal)]" : ""
                  }`}
                >
                  <p className="font-display text-[11px] uppercase tracking-[0.16em] text-[var(--steel)]">
                    {message.role === "user" ? "Siz" : "Asistan"}
                  </p>
                  <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
                </article>
              ))
            )}
            {loading ? (
              <p className="font-display text-[11px] uppercase tracking-[0.16em] text-[var(--heat)]">
                Yanıt bekleniyor
              </p>
            ) : null}
          </div>
          <form
            className="grid shrink-0 gap-2 border-t border-[var(--rule)] p-3"
            method="dialog"
            onSubmit={(event) => {
              event.preventDefault();
              void send();
            }}
          >
            {error ? <p className="text-xs text-[#8f2d1f]">{error}</p> : null}
            {speakOpen ? (
              <VoiceLevel level={voiceLevel} active={recording} />
            ) : null}
            {voiceDebug && speakOpen && voiceMeter ? (
              <p className="font-mono text-[11px] text-[var(--steel)]">
                {voiceMeter.source} · rms {voiceMeter.rms.toFixed(3)} · floor{" "}
                {voiceMeter.floor.toFixed(3)} · on {voiceMeter.speechOn.toFixed(3)} · off{" "}
                {voiceMeter.speechOff.toFixed(3)} ·{" "}
                {voiceMeter.speechSeen
                  ? `sessiz ${(voiceMeter.silentMs / 1000).toFixed(1)} / ${voiceSettings.silenceSeconds} sn`
                  : "konuşma bekleniyor"}
              </p>
            ) : null}
            <textarea
              ref={inputRef}
              rows={3}
              placeholder="Ürün, özellik veya değişiklik yazın"
              disabled={recording || transcribing}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void send();
                }
              }}
              className="w-full resize-none border border-[var(--rule)] bg-[var(--paper)] px-3 py-2 text-sm outline-none focus:border-[var(--heat)] disabled:opacity-60"
            />
            <p className="text-xs text-[var(--steel)]">
              {recording
                ? speechHeard
                  ? `Konuşma alındı. ${voiceSettings.silenceSeconds} sn sessizlikte gönderilir. Durdur, o ana kadarki sesi sohbete yollar.`
                  : `Dinleniyor. Konuşunca ${voiceSettings.silenceSeconds} sn sessizlikte gönderilir. Durdur, o ana kadarki sesi sohbete yollar.`
                : transcribing
                  ? "Ses yazıya çevriliyor…"
                  : loading && voiceSession
                    ? "Yanıt bekleniyor — dinleme yanıtta sürecek"
                    : "Yazabilir veya konuşabilirsiniz. Ses kaydı saklanmaz."}
            </p>
            <div className="flex items-center justify-between gap-2">
              <ActionButton
                tone={speakOpen ? "danger" : "default"}
                disabled={speakDisabled}
                type="button"
                onClick={() => void toggleSpeak()}
              >
                {speakOpen ? "Durdur" : "Konuş"}
              </ActionButton>
              <ActionButton
                tone="heat"
                disabled={loading || recording || transcribing}
                type="button"
                onClick={() => void send()}
              >
                Gönder
              </ActionButton>
            </div>
          </form>
        </section>

        <QuoteDocumentPanel
          quote={quote}
          products={products}
          customers={customers}
          institutions={institutions}
          saving={saving}
          defaultView={openInEdit ? "edit" : "quote"}
          emptyHint="Düzenlemeden ürün ekleyin veya soldan bir istek yazın."
          onChange={schedulePersist}
          onCreateVersion={() => void createVersion()}
          onSelectVersion={(id) => void selectVersion(id)}
          onToggleConverted={() => void toggleConverted()}
        />
      </div>
    </div>
  );
}
