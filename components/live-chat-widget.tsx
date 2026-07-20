'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { MessageSquareText, MessageCircle, X, ChevronRight, ArrowLeft, Send, Sparkles } from 'lucide-react';
import { fetchMarketingSettings, fetchLegalPages, MarketingSettings, LegalPages } from '@/lib/marketing-api';

// ---------------------------------------------------------------------
// On-site live chat widget.
//
// Purpose: answer the pre-purchase doubts that stop someone from buying
// a lehenga/saree (fit, fabric, delivery time, COD, returns) instantly,
// in-page, instead of making them leave to WhatsApp for every question.
//
// Two layers:
// 1. Quick-topic buttons — instant, scripted answers, always available,
//    zero dependency on any external service.
// 2. Free-text box — routes to a live AI model (app/api/chat/ai/route.ts,
//    NVIDIA's free NIM API) that can hold a real conversation and, for
//    logged-in shoppers, is quietly primed with their own order history
//    so it can nudge relevant recommendations instead of talking to a
//    stranger. If the AI call fails for any reason (no API key, rate
//    limit, network), the widget says so plainly and falls back to
//    "Continue on WhatsApp" so a real person can pick it up — the
//    shopper is never left stuck.
//
// No new backend/table required beyond the new API route: it reads the
// settings that already exist (marketing_settings, legal_pages) so
// scripted answers stay in sync with whatever the admin edits.
// ---------------------------------------------------------------------

type Sender = 'bot' | 'user';

interface ChatMessage {
  id: string;
  sender: Sender;
  text: string;
  isError?: boolean;
}

interface Topic {
  key: string;
  label: string;
  answer: (ctx: { legal: LegalPages | null; whatsappHref: string | null }) => string;
}

const TOPICS: Topic[] = [
  {
    key: 'sizing',
    label: 'Sizing & fit help',
    answer: () =>
      "Most of our lehengas and sarees come with adjustable blouses/drawstrings, so a little give either way is fine. Check the size chart on the product page against a similar outfit you already own for the best match. If you're between two sizes or want a custom fit, tell us your bust/waist/hip measurements on WhatsApp and we'll confirm before you order.",
  },
  {
    key: 'fabric',
    label: 'Fabric & care',
    answer: () =>
      'Each product page lists the exact fabric (silk, georgette, banarasi, cotton, etc.) under the description. As a rule of thumb: dry-clean silks and heavily embroidered pieces, hand-wash cottons in cold water, and always store folded in a breathable cloth away from direct sunlight to protect embroidery and zari work.',
  },
  {
    key: 'delivery',
    label: 'Delivery time & COD',
    answer: ({ legal }) =>
      legal?.['shipping-policy']?.trim()
        ? summarize(legal['shipping-policy'], 'Orders typically leave our warehouse within 2-3 business days, then take 3-7 days to arrive depending on your pincode.')
        : 'Orders typically leave our warehouse within 2-3 business days, then take 3-7 days to arrive depending on your pincode. Cash on Delivery availability is shown at checkout once you enter your pincode.',
  },
  {
    key: 'returns',
    label: 'Returns & exchange',
    answer: ({ legal }) =>
      legal?.['refund-policy']?.trim()
        ? summarize(legal['refund-policy'], 'We accept returns and exchanges within 7 days of delivery on unworn items with original tags and packaging intact.')
        : 'We accept returns and exchanges within 7 days of delivery on unworn items with original tags and packaging intact. Customized or stitched pieces are usually final sale — check the product page for specifics.',
  },
  {
    key: 'order',
    label: 'Track my order',
    answer: () =>
      "You can track your order anytime from My Account > Orders once you're logged in — it shows live courier status. If you checked out as a guest, use the tracking link from your confirmation email.",
  },
  {
    key: 'human',
    label: 'Talk to a real person',
    answer: () => '__whatsapp__',
  },
];

function summarize(policyText: string, fallback: string): string {
  const plain = policyText.replace(/\s+/g, ' ').trim();
  if (!plain) return fallback;
  return plain.length > 320 ? `${plain.slice(0, 317)}...` : plain;
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export default function LiveChatWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [hasOpenedOnce, setHasOpenedOnce] = useState(false);
  const [marketing, setMarketing] = useState<MarketingSettings | null>(null);
  const [legal, setLegal] = useState<LegalPages | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: uid(),
      sender: 'bot',
      text: "Hi! I'm here to help with quick questions before you order — sizing, fabric, delivery, returns, anything. Pick a topic below, or type your own question and I'll answer directly.",
    },
  ]);
  const [input, setInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchMarketingSettings(), fetchLegalPages()])
      .then(([m, l]) => {
        if (!cancelled) {
          setMarketing(m);
          setLegal(l);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMarketing(null);
          setLegal(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open]);

  if (pathname?.startsWith('/admin')) return null;

  const whatsappHref =
    marketing?.whatsapp_enabled && marketing.whatsapp_number
      ? `https://wa.me/${marketing.whatsapp_number.replace(/\D/g, '')}?text=${encodeURIComponent(
          marketing.whatsapp_message || 'Hi! I have a question about your products.'
        )}`
      : null;

  function handleToggle() {
    setOpen((v) => !v);
    setHasOpenedOnce(true);
  }

  async function handleAskAi() {
    const question = input.trim();
    if (!question || aiLoading) return;

    setInput('');
    const history = [...messages, { id: uid(), sender: 'user' as Sender, text: question }];
    setMessages(history);
    setAiLoading(true);

    try {
      const res = await fetch('/api/chat/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history
            .slice(-8)
            .map((m) => ({ role: m.sender === 'user' ? 'user' : 'assistant', content: m.text })),
          page: pathname || '',
        }),
      });
      const data = await res.json().catch(() => ({ ok: false }));

      if (data?.ok && data.reply) {
        setMessages((prev) => [...prev, { id: uid(), sender: 'bot', text: data.reply }]);
      } else {
        const reason: string = data?.error || '';
        let text: string;
        if (reason.includes('not configured')) {
          text = "AI chat isn't set up yet on this site (missing API key) — tap the WhatsApp bar above and our team can help you directly.";
        } else if (reason.includes('rate-limited')) {
          text = "Our AI is getting a lot of questions right now (free-tier limit) — please try again in a minute, or tap WhatsApp above.";
        } else if (reason.includes('key was rejected')) {
          text = 'The AI assistant is misconfigured on our end — tap the WhatsApp bar above and our team can help you directly.';
        } else {
          text = "Our AI assistant is having trouble right now — tap the WhatsApp bar above and our team will take it from here.";
        }
        setMessages((prev) => [...prev, { id: uid(), sender: 'bot', isError: true, text }]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          sender: 'bot',
          isError: true,
          text: whatsappHref
            ? "Couldn't reach our AI assistant. Tap the WhatsApp bar above and our team will help directly."
            : "Couldn't reach our AI assistant right now — please try again shortly.",
        },
      ]);
    } finally {
      setAiLoading(false);
    }
  }

  function handleTopic(topic: Topic) {
    const answer = topic.answer({ legal, whatsappHref });
    setMessages((prev) => [
      ...prev,
      { id: uid(), sender: 'user', text: topic.label },
      {
        id: uid(),
        sender: 'bot',
        text:
          answer === '__whatsapp__'
            ? whatsappHref
              ? "Sure — tap the WhatsApp bar at the top of this chat and our team will pick it up from here."
              : "Our team isn't set up on WhatsApp chat right now, but you can reach us from the Contact page and we'll get back to you."
            : answer,
      },
    ]);
  }

  return (
    <>
      {open && (
        <div
          role="dialog"
          aria-label="Live chat"
          className="fixed inset-x-3 bottom-[9.5rem] z-50 flex max-h-[70vh] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl sm:inset-x-auto sm:bottom-24 sm:right-4 sm:w-[23rem]"
        >
          <div className="flex items-center justify-between bg-primary px-4 py-3 text-primary-foreground">
            <div>
              <p className="font-serif text-sm font-semibold leading-tight">Aruhi Handlooms</p>
              <p className="text-xs opacity-80">Usually replies in a few minutes</p>
            </div>
            <button
              onClick={handleToggle}
              aria-label="Close chat"
              className="rounded-full p-1.5 transition-colors hover:bg-white/15"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Pinned WhatsApp quick-access — always visible regardless of
              scroll position, not just after messages. Controlled by the
              SAME Admin > Marketing > WhatsApp toggle/number as the
              floating WhatsApp button, so turning it on/off in one place
              updates both. */}
          {whatsappHref && (
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-[#25D366]/10 px-4 py-2 text-xs font-medium text-[#128C4A] transition-colors hover:bg-[#25D366]/20"
            >
              <span className="flex items-center gap-1.5">
                <MessageCircle className="h-3.5 w-3.5" fill="#25D366" strokeWidth={0} />
                Prefer WhatsApp? Chat with our team directly
              </span>
              <ChevronRight className="h-3.5 w-3.5 shrink-0" />
            </a>
          )}

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-muted/40 px-3 py-4">
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed shadow-sm ${
                    m.sender === 'user'
                      ? 'rounded-br-sm bg-primary text-primary-foreground'
                      : m.isError
                        ? 'rounded-bl-sm border border-destructive/30 bg-destructive/10 text-foreground'
                        : 'rounded-bl-sm border border-border bg-card text-card-foreground'
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}

            {aiLoading && (
              <div className="flex justify-start">
                <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm border border-border bg-card px-3 py-2.5 shadow-sm">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" />
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-border bg-card p-3">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAskAi();
              }}
              className="mb-3 flex items-center gap-2"
            >
              <div className="relative flex-1">
                <Sparkles className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask me anything..."
                  disabled={aiLoading}
                  maxLength={600}
                  className="w-full rounded-full border border-border bg-background py-2 pl-8 pr-3 text-base outline-none transition-colors focus:border-primary disabled:opacity-60 sm:text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={aiLoading || !input.trim()}
                aria-label="Send"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity disabled:opacity-40"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>

            <p className="mb-2 flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <ArrowLeft className="h-3 w-3" /> Or pick a quick question
            </p>
            <div className="flex flex-wrap gap-1.5">
              {TOPICS.map((topic) => (
                <button
                  key={topic.key}
                  onClick={() => handleTopic(topic)}
                  className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary hover:text-primary"
                >
                  {topic.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <button
        onClick={handleToggle}
        aria-label={open ? 'Close chat' : 'Chat with us'}
        aria-expanded={open}
        className="fixed bottom-40 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 sm:bottom-24"
      >
        {open ? <X className="h-6 w-6" /> : <MessageSquareText className="h-6 w-6" />}
        {!hasOpenedOnce && (
          <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-secondary opacity-75" />
            <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-secondary" />
          </span>
        )}
      </button>
    </>
  );
}
