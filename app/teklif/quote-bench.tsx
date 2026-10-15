"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useBrand } from "@/components/brand/brand-provider";
import { ActionButton } from "@/components/catalog/fields";
import { AppHeader } from "@/components/layout/app-header";
import { QuoteDocumentPanel } from "@/components/quote/quote-document-panel";
import { VoiceLevel } from "@/components/teklif/voice-level";
import { addQuoteCatalogPropertyValue } from "@/lib/api/catalog-addons";
import { apiErrorMessage, isSuccessStatus } from "@/lib/api/errors";
import {
  chatWithQuote,
  createQuote,
  createQuoteVersion,
  deleteQuote,
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
import { DEFAULT_BRAND, isBrandId, type BrandId } from "@/lib/brand/brands";
import { isQuoteActionReady } from "@/lib/quote/action-ready";
import { quoteWithBrand } from "@/lib/quote/terms";
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
import { formatSilenceSeconds } from "@/lib/stt/settings";
import { isUsableTranscript } from "@/lib/stt/vad";

/** Backend LLM'i en fazla iki kez 30 sn bekler; bunun üstünde Gönder kilitli kalmasın. */
const CHAT_TIMEOUT_MS = 75_000;

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
  const { brand, setBrand } = useBrand();
  const brandRef = useRef(brand);
  brandRef.current = brand;
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
  const chatAbortRef = useRef<AbortController | null>(null);
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

  const schedulePersist = useCallback((next: QuoteResponse) => {
    setQuote(next);
    if (persistTimer.current) window.clearTimeout(persistTimer.current);
    persistTimer.current = window.setTimeout(() => {
      void persistQuote(next);
    }, 600);
  }, [persistQuote]);

  const applyLoadedQuote = useCallback(
    (next: QuoteResponse) => {
      setQuote(next);
      quoteRef.current = next;
      const nextBrand = isBrandId(next.brand) ? next.brand : DEFAULT_BRAND;
      setBrand(nextBrand, { silent: true });
    },
    [setBrand],
  );

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
      applyLoadedQuote(response.data);
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
    applyLoadedQuote(response.data);
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
    const storedMessages = fromQuotes ? [] : workspace.messages;
    // Sohbet yalnızca ait olduğu teklif yüklenince gösterilir; aksi halde boş belgenin
    // yanında eski yazışma kalır ve iş kaybolmuş gibi görünür.
    void (async () => {
      try {
        if (targetId) {
          const existing = await getQuoteById(targetId);
          if (existing.status === 200) {
            applyLoadedQuote(existing.data);
            setMessages(storedMessages);
            saveQuoteWorkspace({
              version: 3,
              quoteId: existing.data.id ?? null,
              messages: storedMessages,
            });
            return;
          }
          if (fromQuotes) {
            setError(apiErrorMessage(existing.data, "Teklif yüklenemedi."));
            return;
          }
        }
        const created = await createQuote({ brand: brandRef.current, currency: "USD" });
        if (created.status === 201) {
          applyLoadedQuote(created.data);
          setMessages([]);
          saveQuoteWorkspace({
            version: 3,
            quoteId: created.data.id ?? null,
            messages: [],
          });
        } else {
          setError(apiErrorMessage(created.data, "Teklif açılamadı."));
        }
      } catch {
        setError("Teklif yüklenemedi. Sayfayı yenileyip tekrar deneyin.");
      }
    })();
  }, [initialQuoteId, applyLoadedQuote]);

  useEffect(() => {
    const onBrandChange = (event: Event) => {
      const nextBrand = (event as CustomEvent<BrandId>).detail;
      if (!isBrandId(nextBrand)) return;
      const current = quoteRef.current;
      if (!current || current.brand === nextBrand) return;
      void quoteWithBrand(current, nextBrand).then((next) => schedulePersist(next));
    };
    window.addEventListener("teknotip:brand-change", onBrandChange);
    return () => {
      window.removeEventListener("teknotip:brand-change", onBrandChange);
    };
  }, [schedulePersist]);

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
      chatAbortRef.current?.abort();
      voiceSessionRef.current = false;
      utteranceRef.current?.discard();
      destroyListenSession(listenSessionRef.current);
      listenSessionRef.current = null;
      if (persistTimer.current) window.clearTimeout(persistTimer.current);
    };
  }, []);

  const resetQuote = async () => {
    // Bekleyen sohbet yanıtı eski teklifi yeni teklifin üstüne yazmasın.
    chatAbortRef.current?.abort();
    chatAbortRef.current = null;
    if (persistTimer.current) {
      window.clearTimeout(persistTimer.current);
      persistTimer.current = null;
    }
    quoteRef.current = null;
    setQuote(null);
    setMessages([]);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
    setSessionOpen(false);
    utteranceRef.current?.discard();
    destroyListen();
    clearQuoteWorkspace();
    const created = await createQuote({ brand, currency: "USD" });
    if (created.status === 201) {
      applyLoadedQuote(created.data);
      saveQuoteWorkspace({
        version: 3,
        quoteId: created.data.id ?? null,
        messages: [],
      });
    } else {
      setError(apiErrorMessage(created.data, "Yeni teklif açılamadı."));
    }
  };

  const cancelQuote = async () => {
    if (!window.confirm("Bu teklifi silmek istiyor musunuz?")) return;
    if (persistTimer.current) {
      window.clearTimeout(persistTimer.current);
      persistTimer.current = null;
    }
    const currentId = quoteRef.current?.id;
    if (currentId) {
      const response = await deleteQuote(currentId);
      if (!isSuccessStatus(response.status)) {
        setError(apiErrorMessage(response.data, "Teklif silinemedi."));
        return;
      }
    }
    await resetQuote();
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

    const controller = new AbortController();
    chatAbortRef.current = controller;
    let timedOut = false;
    const timeout = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, CHAT_TIMEOUT_MS);

    try {
      await flushPersist();
      const quoteId = quoteRef.current?.id;
      if (!quoteId) {
        setError("Teklif henüz açılmadı.");
        return;
      }
      const response = await chatWithQuote({ quoteId, message: text }, { signal: controller.signal });
      if (quoteRef.current?.id !== quoteId) return;
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
          catalogValueSuggestion: response.data.catalogValueSuggestion,
        },
      ]);
    } catch {
      if (timedOut) {
        setError("Asistan zamanında yanıt vermedi, lütfen tekrar deneyin.");
      } else if (!controller.signal.aborted) {
        setError("Bağlantı kurulamadı.");
      }
    } finally {
      window.clearTimeout(timeout);
      if (chatAbortRef.current === controller) chatAbortRef.current = null;
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

  const applyCatalogValueSuggestion = async (
    messageIndex: number,
    suggestion: NonNullable<ChatMessage["catalogValueSuggestion"]>,
  ) => {
    const quoteId = quoteRef.current?.id;
    if (
      !quoteId ||
      !suggestion.productId ||
      !suggestion.lineId ||
      !suggestion.propertyName ||
      !suggestion.attemptedValue
    ) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await flushPersist();
      const response = await addQuoteCatalogPropertyValue(quoteId, {
        productId: suggestion.productId,
        lineId: suggestion.lineId,
        propertyName: suggestion.propertyName,
        value: suggestion.attemptedValue,
      });
      if (!isSuccessStatus(response.status)) {
        setError(apiErrorMessage(response.data, "Değer kataloga eklenemedi."));
        return;
      }
      const payload = response.data as {
        quote?: QuoteResponse;
        message?: string;
      };
      if (payload.quote) setQuote(payload.quote);
      setMessages((prev) => {
        const next = [...prev];
        const current = next[messageIndex];
        if (current) {
          next[messageIndex] = { ...current, catalogValueSuggestion: undefined };
        }
        next.push({
          role: "assistant",
          content:
            payload.message ??
            `${suggestion.propertyName} özelliğine ${suggestion.attemptedValue} eklendi.`,
        });
        return next;
      });
      router.refresh();
    } catch {
      setError("Değer eklenirken bağlantı hatası oluştu.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <AppHeader section="Genixo" compact />

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
              messages.map((message, index) => {
                const suggestion = message.catalogValueSuggestion;
                const canAddValue =
                  message.role === "assistant" &&
                  suggestion?.productId &&
                  suggestion.lineId &&
                  suggestion.propertyName &&
                  suggestion.attemptedValue;
                const addLabel = canAddValue
                  ? `${suggestion.propertyName}'a ${suggestion.attemptedValue} ekle`
                  : null;
                return (
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
                    {addLabel && suggestion ? (
                      <div>
                        <ActionButton
                          tone="heat"
                          disabled={loading}
                          onClick={() => void applyCatalogValueSuggestion(index, suggestion)}
                        >
                          {addLabel}
                        </ActionButton>
                      </div>
                    ) : null}
                  </article>
                );
              })
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
                  ? `sessiz ${(voiceMeter.silentMs / 1000).toFixed(1)} / ${formatSilenceSeconds()} sn`
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
                  ? `Konuşma alındı. ${formatSilenceSeconds()} sn sessizlikte gönderilir. Durdur, o ana kadarki sesi sohbete yollar.`
                  : `Dinleniyor. Konuşunca ${formatSilenceSeconds()} sn sessizlikte gönderilir. Durdur, o ana kadarki sesi sohbete yollar.`
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
          onCancelQuote={() => void cancelQuote()}
        />
      </div>
    </div>
  );
}
