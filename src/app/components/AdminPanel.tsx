import { useState, useRef } from "react";
import { Plus, Trash2, Save, X, Clock, Upload, Check, MessageSquare, Users, Tag, CalendarDays, CreditCard } from "lucide-react";

// Shown briefly after any save action succeeds — a clear, visible
// confirmation instead of just a small label changing on the button.
function SaveToast({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <>
      <style>{`
        @keyframes saveToastIn {
          from { opacity: 0; transform: translate(-50%, 12px) scale(0.95); }
          to { opacity: 1; transform: translate(-50%, 0) scale(1); }
        }
      `}</style>
      <div
        className="fixed left-1/2 bottom-24 z-50 flex items-center gap-2 px-5 py-3 rounded-full shadow-lg"
        style={{
          background: "var(--primary)",
          color: "var(--primary-foreground)",
          animation: "saveToastIn 0.3s ease-out",
          transform: "translate(-50%, 0)",
        }}
      >
        <Check size={16} />
        <span className="text-sm">Alteração salva com sucesso!</span>
      </div>
    </>
  );
}

function photoUrl(img: string, size = 120) {
  if (!img) return "";
  if (img.startsWith("http")) return img;
  return `https://images.unsplash.com/${img}?w=${size}&h=${size}&fit=crop&auto=format`;
}

interface AdminPanelProps {
  businessName: string;
  businessLink?: string | null;
  currentSlug?: string | null;
  onChangeSlug?: (newSlug: string) => Promise<void>;
  currentAddress?: string | null;
  onChangeAddress?: (address: string) => Promise<void>;
  businessHours?: Record<number, { open: boolean; start?: string; end?: string; breakStart?: string; breakEnd?: string }>;
  onSaveHours?: (hours: any) => Promise<void>;
  paymentSettings?: any;
  onSavePaymentSettings?: (payload: any) => Promise<void>;
  businessId?: string | null;
  webhookBaseUrl?: string | null;
  subscription?: { plan: string; status: string; trialEndsAt?: string } | null;
  onSubscribe?: () => Promise<void>;
  services: any[];
  professionals: any[];
  appointments: any[];
  loadingAppts: boolean;
  saveBusinessData: (payload: { services?: any[]; professionals?: any[] }) => Promise<void>;
  uploadPhoto: (dataUrl: string) => Promise<string>;
  cancelWithMessage: (appt: any, message: string) => Promise<void>;
  sendReminder?: (appt: any) => void;
  onComplete?: (appt: any) => void;
  completingKey?: string | null;
  onReschedule: (appt: any) => void;
  apptKey: (appt: any) => string;
}

type AdminTab = "appointments" | "services" | "team" | "hours" | "payments";

export function AdminPanel({
  businessName,
  businessLink,
  currentSlug,
  onChangeSlug,
  currentAddress,
  onChangeAddress,
  businessHours,
  onSaveHours,
  paymentSettings,
  onSavePaymentSettings,
  businessId,
  webhookBaseUrl,
  subscription,
  onSubscribe,
  services,
  professionals,
  appointments,
  loadingAppts,
  saveBusinessData,
  uploadPhoto,
  cancelWithMessage,
  sendReminder,
  onComplete,
  completingKey,
  onReschedule,
  apptKey,
}: AdminPanelProps) {
  const [tab, setTab] = useState<AdminTab>("appointments");
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const [editingSlug, setEditingSlug] = useState(false);
  const [slugInput, setSlugInput] = useState(currentSlug || "");
  const [slugSaving, setSlugSaving] = useState(false);
  const [editingAddress, setEditingAddress] = useState(false);
  const [addressInput, setAddressInput] = useState(currentAddress || "");
  const [addressSaving, setAddressSaving] = useState(false);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [slugError, setSlugError] = useState<string | null>(null);

  const copyLink = async () => {
    if (!businessLink) return;
    try {
      // Preferred method — works when the page has clipboard-write permission.
      await navigator.clipboard.writeText(businessLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for sandboxed contexts (e.g. an iframe preview) where the
      // Clipboard API is blocked: select a hidden textarea and use the
      // older execCommand copy, which doesn't need that permission.
      try {
        const textarea = document.createElement("textarea");
        textarea.value = businessLink;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(textarea);
        if (ok) {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } else {
          setCopyFailed(true);
          setTimeout(() => setCopyFailed(false), 3000);
        }
      } catch {
        setCopyFailed(true);
        setTimeout(() => setCopyFailed(false), 3000);
      }
    }
  };

  const saveSlug = async () => {
    if (!onChangeSlug) return;
    setSlugSaving(true);
    setSlugError(null);
    try {
      await onChangeSlug(slugInput);
      setEditingSlug(false);
    } catch (err: any) {
      setSlugError(err.message || "Erro ao atualizar o link.");
    } finally {
      setSlugSaving(false);
    }
  };

  const saveAddress = async () => {
    if (!onChangeAddress) return;
    setAddressSaving(true);
    setAddressError(null);
    try {
      await onChangeAddress(addressInput);
      setEditingAddress(false);
    } catch (err: any) {
      setAddressError(err.message || "Erro ao atualizar o endereço.");
    } finally {
      setAddressSaving(false);
    }
  };

  // Mirrors the backend's allow-list logic: only these two states let the
  // owner actually use the panel. Everything else shows a full block screen
  // instead of the normal tabs — not just a banner they can dismiss and
  // work around.
  const trialStillValid = subscription?.status === "trialing" && subscription.trialEndsAt && new Date(subscription.trialEndsAt).getTime() >= Date.now();
  const subscriptionActive = trialStillValid || subscription?.status === "authorized";
  const subscriptionBlocked = !!subscription && !subscriptionActive;

  // Trial/subscription status banner text, if relevant.
  let trialBanner: { text: string; urgent: boolean; showSubscribeButton: boolean } | null = null;
  if (subscription?.status === "trialing" && subscription.trialEndsAt) {
    const daysLeft = Math.ceil((new Date(subscription.trialEndsAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
    if (daysLeft <= 0) {
      trialBanner = { text: "Seu período de teste acabou. Assine o plano mensal para continuar editando serviços e equipe.", urgent: true, showSubscribeButton: true };
    } else {
      trialBanner = { text: `Seu teste grátis termina em ${daysLeft} dia${daysLeft === 1 ? "" : "s"}.`, urgent: daysLeft <= 3, showSubscribeButton: daysLeft <= 3 };
    }
  } else if (subscription?.status === "pending_payment") {
    trialBanner = { text: "Este CPF/CNPJ já usou o teste gratuito antes. Assine o plano mensal para começar a usar o painel.", urgent: true, showSubscribeButton: true };
  } else if (subscription?.status === "pending") {
    trialBanner = { text: "Você começou a assinar mas não finalizou o pagamento. Clique para voltar para o checkout.", urgent: false, showSubscribeButton: true };
  } else if (subscription?.status === "canceled" || subscription?.status === "past_due" || subscription?.status === "paused") {
    trialBanner = { text: "Sua assinatura não está ativa. Assine de novo para continuar usando o painel.", urgent: true, showSubscribeButton: true };
  }

  const [subscribing, setSubscribing] = useState(false);
  const handleSubscribe = async () => {
    if (!onSubscribe) return;
    setSubscribing(true);
    try {
      await onSubscribe();
    } finally {
      setSubscribing(false);
    }
  };

  // Full block: replaces the ENTIRE panel (no tabs, no editing anything)
  // until the subscription is actually active. Not just a banner — the
  // owner genuinely can't use the app while this shows.
  if (subscriptionBlocked) {
    return (
      <div className="px-4 pt-2 pb-28">
        <p className="text-xs tracking-widest uppercase text-muted-foreground mb-1">Painel</p>
        <h2 className="text-2xl text-foreground mb-4" style={{ fontFamily: "'Cormorant', serif", fontWeight: 400 }}>
          {businessName}
        </h2>
        <div className="p-4 rounded-sm border text-sm" style={{ background: "#fef2f2", borderColor: "#fecaca", color: "#dc2626" }}>
          <p className="mb-3 font-medium">{trialBanner?.text || "Sua assinatura precisa ser confirmada para usar o painel."}</p>
          {onSubscribe && trialBanner?.showSubscribeButton !== false && (
            <button
              onClick={handleSubscribe}
              disabled={subscribing}
              className="w-full py-3 rounded-sm bg-primary text-primary-foreground text-sm disabled:opacity-50"
            >
              {subscribing ? "Abrindo checkout..." : subscription?.status === "pending" ? "Voltar para o pagamento" : "Assinar agora — R$ 79,90/mês"}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="pb-28">
      <div className="px-4 pt-2">
        <p className="text-xs tracking-widest uppercase text-muted-foreground mb-1">Painel</p>
        <h2 className="text-2xl text-foreground mb-1" style={{ fontFamily: "'Cormorant', serif", fontWeight: 400 }}>
          {businessName}
        </h2>
        <p className="text-sm text-muted-foreground mb-3">Gerencie sua agenda, serviços e equipe.</p>

        {trialBanner && (
          <div
            className="mb-4 p-3 rounded-sm border text-sm"
            style={
              trialBanner.urgent
                ? { background: "#fef2f2", borderColor: "#fecaca", color: "#dc2626" }
                : { background: "var(--secondary)", borderColor: "var(--border)", color: "var(--foreground)" }
            }
          >
            <p className="mb-2">{trialBanner.text}</p>
            {trialBanner.showSubscribeButton && onSubscribe && (
              <button
                onClick={handleSubscribe}
                disabled={subscribing}
                className="text-xs px-3 py-1.5 rounded-sm bg-primary text-primary-foreground disabled:opacity-50"
              >
                {subscribing ? "Abrindo checkout..." : subscription?.status === "pending" ? "Voltar para o pagamento" : "Assinar agora — R$ 79,90/mês"}
              </button>
            )}
          </div>
        )}

        {businessLink && (
          <div className="mb-5 p-3 rounded-sm border border-border" style={{ background: "var(--secondary)" }}>
            {!editingSlug ? (
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground mb-0.5">Link para seus clientes agendarem</p>
                  <p
                    className="text-sm text-foreground truncate select-all cursor-text"
                    onClick={(e) => {
                      // Tapping the link itself selects the text, so it can
                      // always be copied manually as a last resort.
                      const range = document.createRange();
                      range.selectNodeContents(e.currentTarget);
                      const sel = window.getSelection();
                      sel?.removeAllRanges();
                      sel?.addRange(range);
                    }}
                  >
                    {businessLink}
                  </p>
                  {copyFailed && (
                    <p className="text-xs mt-1" style={{ color: "#dc2626" }}>
                      Não consegui copiar automaticamente. Toque no link acima para selecioná-lo e copie manualmente.
                    </p>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  {onChangeSlug && (
                    <button
                      onClick={() => { setSlugInput(currentSlug || ""); setSlugError(null); setEditingSlug(true); }}
                      className="text-xs px-3 py-1.5 rounded-sm border border-border text-foreground"
                    >
                      Editar
                    </button>
                  )}
                  <button
                    onClick={copyLink}
                    className="text-xs px-3 py-1.5 rounded-sm bg-primary text-primary-foreground"
                  >
                    {copied ? "Copiado!" : "Copiar"}
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">Escolha o link do seu salão</p>
                <div className="flex items-center gap-1 mb-2">
                  <span className="text-xs text-muted-foreground shrink-0">{window.location.origin}/</span>
                  <input
                    type="text"
                    value={slugInput}
                    onChange={(e) => setSlugInput(e.target.value)}
                    className="flex-1 min-w-0 text-sm px-2 py-1.5 rounded-sm border border-border bg-background"
                    placeholder="nome-do-salao"
                  />
                </div>
                {slugError && <p className="text-xs text-red-600 mb-2">{slugError}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={saveSlug}
                    disabled={slugSaving}
                    className="text-xs px-3 py-1.5 rounded-sm bg-primary text-primary-foreground disabled:opacity-50"
                  >
                    {slugSaving ? "Salvando..." : "Salvar link"}
                  </button>
                  <button
                    onClick={() => setEditingSlug(false)}
                    className="text-xs px-3 py-1.5 rounded-sm border border-border text-foreground"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Address */}
        <div className="mb-5 p-3 rounded-sm border border-border" style={{ background: "var(--secondary)" }}>
          {!editingAddress ? (
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground mb-0.5">Endereço do estúdio</p>
                <p className="text-sm text-foreground truncate">{currentAddress || "Ainda não definido"}</p>
              </div>
              {onChangeAddress && (
                <button
                  onClick={() => { setAddressInput(currentAddress || ""); setAddressError(null); setEditingAddress(true); }}
                  className="shrink-0 text-xs px-3 py-1.5 rounded-sm border border-border text-foreground"
                >
                  Editar
                </button>
              )}
            </div>
          ) : (
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Endereço completo (aparece na confirmação do cliente)</p>
              <input
                type="text"
                value={addressInput}
                onChange={(e) => setAddressInput(e.target.value)}
                className="w-full text-sm px-2 py-1.5 rounded-sm border border-border bg-background mb-2"
                placeholder="Rua Exemplo, 123 — Bairro, Cidade/UF"
              />
              {addressError && <p className="text-xs text-red-600 mb-2">{addressError}</p>}
              <div className="flex gap-2">
                <button
                  onClick={saveAddress}
                  disabled={addressSaving}
                  className="text-xs px-3 py-1.5 rounded-sm bg-primary text-primary-foreground disabled:opacity-50"
                >
                  {addressSaving ? "Salvando..." : "Salvar endereço"}
                </button>
                <button
                  onClick={() => setEditingAddress(false)}
                  className="text-xs px-3 py-1.5 rounded-sm border border-border text-foreground"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Sub tabs */}
        <div className="flex gap-1 p-1 mb-6 rounded-sm" style={{ background: "var(--secondary)" }}>
          {([
            { key: "appointments", label: "Agenda", icon: CalendarDays },
            { key: "services", label: "Serviços", icon: Tag },
            { key: "team", label: "Equipe", icon: Users },
            { key: "hours", label: "Horários", icon: Clock },
            { key: "payments", label: "Pagamentos", icon: CreditCard },
          ] as const).map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className="flex-1 py-2 rounded-sm text-sm flex items-center justify-center gap-1.5 transition-colors"
                style={{
                  background: tab === t.key ? "var(--primary)" : "transparent",
                  color: tab === t.key ? "var(--primary-foreground)" : "var(--foreground)",
                  fontWeight: tab === t.key ? 500 : 400,
                }}
              >
                <Icon size={14} /> {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {tab === "appointments" && (
        <AppointmentsManager
          appointments={appointments}
          loading={loadingAppts}
          cancelWithMessage={cancelWithMessage}
          sendReminder={sendReminder}
          onReschedule={onReschedule}
          onComplete={onComplete}
          completingKey={completingKey}
          apptKey={apptKey}
        />
      )}
      {tab === "services" && (
        <ServicesManager services={services} saveBusinessData={saveBusinessData} />
      )}
      {tab === "team" && (
        <TeamManager professionals={professionals} saveBusinessData={saveBusinessData} uploadPhoto={uploadPhoto} />
      )}
      {tab === "hours" && (
        <HoursManager businessHours={businessHours} onSave={onSaveHours} appointments={appointments} />
      )}
      {tab === "payments" && (
        <PaymentsManager paymentSettings={paymentSettings} onSave={onSavePaymentSettings} businessId={businessId} webhookBaseUrl={webhookBaseUrl} />
      )}
    </div>
  );
}

/* ---------------- Appointments ---------------- */

function AppointmentsManager({ appointments, loading, cancelWithMessage, sendReminder, onReschedule, onComplete, completingKey, apptKey }: any) {
  const [cancelTarget, setCancelTarget] = useState<any>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [remindedKeys, setRemindedKeys] = useState<Record<string, boolean>>({});
  const [view, setView] = useState<"proximos" | "historico">("proximos");

  const confirmCancel = async () => {
    setBusy(true);
    setErr(null);
    try {
      await cancelWithMessage(cancelTarget, message.trim());
      setCancelTarget(null);
      setMessage("");
    } catch (e: any) {
      setErr(e.message || "Erro ao cancelar.");
    } finally {
      setBusy(false);
    }
  };

  // Appointments happening tomorrow, so the owner can send a quick reminder
  // with one tap — no automatic background sending, but no cost either.
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowAppts = appointments.filter((appt: any) => {
    const d = appt.date;
    return d && d.day === tomorrow.getDate() && d.month === tomorrow.getMonth() && d.year === tomorrow.getFullYear();
  });

  const handleRemind = (appt: any) => {
    sendReminder?.(appt);
    setRemindedKeys((prev) => ({ ...prev, [apptKey(appt)]: true }));
  };

  const upcomingAppts = appointments.filter((a: any) => a.status !== "concluido");
  const historyAppts = appointments
    .filter((a: any) => a.status === "concluido")
    .sort((a: any, b: any) => new Date(b.completedAt || 0).getTime() - new Date(a.completedAt || 0).getTime());
  const visibleAppts = view === "proximos" ? upcomingAppts : historyAppts;

  return (
    <div className="px-4">
      {view === "proximos" && tomorrowAppts.length > 0 && (
        <div className="mb-5 p-3 rounded-sm border border-border" style={{ background: "var(--secondary)" }}>
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Amanhã — lembrar clientes</p>
          <div className="space-y-2">
            {tomorrowAppts.map((appt: any) => {
              const key = apptKey(appt);
              const already = remindedKeys[key];
              return (
                <div key={key} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate">
                    {appt.time} · {appt.service?.name}
                  </span>
                  <button
                    onClick={() => handleRemind(appt)}
                    disabled={!appt.userPhone}
                    className="shrink-0 text-xs px-3 py-1.5 rounded-sm flex items-center gap-1 disabled:opacity-40"
                    style={{ background: already ? "transparent" : "var(--primary)", color: already ? "var(--muted-foreground)" : "var(--primary-foreground)", border: already ? "1px solid var(--border)" : "none" }}
                    title={!appt.userPhone ? "Cliente sem WhatsApp cadastrado" : ""}
                  >
                    <MessageSquare size={12} /> {already ? "Enviado" : "Lembrar"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex gap-1 p-1 mb-4 rounded-sm" style={{ background: "var(--secondary)" }}>
        {([
          { key: "proximos", label: "Próximos" },
          { key: "historico", label: "Histórico" },
        ] as const).map((v) => (
          <button
            key={v.key}
            onClick={() => setView(v.key)}
            className="flex-1 py-2 rounded-sm text-sm transition-colors"
            style={{
              background: view === v.key ? "var(--primary)" : "transparent",
              color: view === v.key ? "var(--primary-foreground)" : "var(--foreground)",
            }}
          >
            {v.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-10 text-center text-muted-foreground text-sm">Carregando agenda...</div>
      ) : visibleAppts.length === 0 ? (
        <div className="py-10 text-center text-muted-foreground text-sm">
          {view === "proximos" ? "Nenhum agendamento por enquanto." : "Nenhum atendimento concluído ainda."}
        </div>
      ) : (
        <div className="space-y-3">
          {visibleAppts.map((appt: any) => {
            const key = apptKey(appt);
            return (
              <div key={key} className="bg-card border border-border rounded-sm p-4" style={view === "historico" ? { opacity: 0.85 } : undefined}>
                <div className="flex justify-between items-start mb-2">
                  <p className="font-medium text-foreground">{appt.service?.name}</p>
                  <span className="text-sm font-medium" style={{ color: "var(--primary)" }}>{appt.service?.price}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                  <span>{appt.professional?.name}</span>
                  <span style={{ fontFamily: "'DM Mono', monospace" }}>
                    {`${String(appt.date?.day).padStart(2, "0")}/${String(appt.date?.month + 1).padStart(2, "0")}/${appt.date?.year}`} · {appt.time}
                  </span>
                  {view === "historico" && (
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--secondary)", color: "var(--primary)" }}>
                      concluído
                    </span>
                  )}
                </div>
                {appt.userEmail && (
                  <p className="text-xs text-muted-foreground mt-1">Cliente: {appt.userEmail}</p>
                )}
                {view === "proximos" && (
                  <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border">
                    <button
                      onClick={() => onComplete?.(appt)}
                      disabled={completingKey === key}
                      className="flex items-center gap-1 text-xs disabled:opacity-50"
                      style={{ color: "var(--primary)" }}
                    >
                      <Check size={12} /> {completingKey === key ? "concluindo..." : "finalizar"}
                    </button>
                    <button
                      onClick={() => onReschedule(appt)}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Clock size={12} /> remarcar
                    </button>
                    <button
                      onClick={() => { setCancelTarget(appt); setMessage(""); setErr(null); }}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-red-500 transition-colors"
                    >
                      <X size={12} /> desmarcar
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Cancel with message modal */}
      {cancelTarget && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6" style={{ background: "rgba(42,31,26,0.45)" }}>
          <div className="w-full max-w-sm bg-background rounded-t-2xl sm:rounded-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <MessageSquare size={18} style={{ color: "var(--primary)" }} />
                <h3 className="text-lg text-foreground" style={{ fontFamily: "'Cormorant', serif" }}>Desmarcar horário</h3>
              </div>
              <button onClick={() => setCancelTarget(null)} className="p-2 rounded-full hover:bg-secondary transition-colors">
                <X size={18} className="text-muted-foreground" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              {cancelTarget.service?.name} · {cancelTarget.professional?.name} ·{" "}
              {`${String(cancelTarget.date?.day).padStart(2, "0")}/${String(cancelTarget.date?.month + 1).padStart(2, "0")}`} às {cancelTarget.time}
            </p>
            {err && <div className="mb-3 p-3 rounded-sm bg-red-50 border border-red-200 text-red-600 text-sm">{err}</div>}
            <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-1">Mensagem ao cliente</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              placeholder="Ex: Precisamos remarcar devido a um imprevisto. Entre em contato para escolher um novo horário."
              className="w-full px-4 py-3 bg-card border border-border rounded-sm focus:outline-none focus:border-primary transition-colors text-sm resize-none mb-4"
            />
            <button
              onClick={confirmCancel}
              disabled={busy}
              className="w-full py-3 rounded-sm text-primary-foreground text-sm tracking-widest uppercase transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ background: "var(--primary)" }}
            >
              {busy ? "Enviando..." : "Confirmar Cancelamento"}
            </button>
            <button onClick={() => setCancelTarget(null)} className="w-full py-3 mt-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
              Voltar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Services ---------------- */

function ServicesManager({ services, saveBusinessData }: any) {
  const [draft, setDraft] = useState<any[]>(() => JSON.parse(JSON.stringify(services)));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const updateItem = (ci: number, ii: number, field: string, value: string) => {
    setDraft((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      next[ci].items[ii][field] = value;
      return next;
    });
  };
  const addItem = (ci: number) => {
    setDraft((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      next[ci].items.push({ id: `s${Date.now()}`, name: "Novo serviço", duration: "1h", price: "R$ 0", description: "" });
      return next;
    });
  };
  const removeItem = (ci: number, ii: number) => {
    setDraft((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      next[ci].items.splice(ii, 1);
      return next;
    });
  };

  const updateCategoryName = (ci: number, value: string) => {
    setDraft((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      next[ci].category = value;
      return next;
    });
  };
  const addCategory = () => {
    setDraft((prev) => [
      ...prev,
      { id: `cat${Date.now()}`, category: "Nova categoria", items: [] },
    ]);
  };
  const removeCategory = (ci: number) => {
    setDraft((prev) => prev.filter((_, idx) => idx !== ci));
  };

  const save = async () => {
    setSaving(true);
    setErr(null);
    try {
      await saveBusinessData({ services: draft });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      setErr(e.message || "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-4">
      <SaveToast show={saved} />
      {err && <div className="mb-3 p-3 rounded-sm bg-red-50 border border-red-200 text-red-600 text-sm">{err}</div>}
      <div className="space-y-6">
        {draft.map((cat: any, ci: number) => (
          <div key={cat.id ?? ci}>
            <div className="flex items-center gap-2 mb-2">
              <input
                value={cat.category}
                onChange={(e) => updateCategoryName(ci, e.target.value)}
                className="flex-1 text-xs tracking-widest uppercase text-muted-foreground bg-transparent border-b border-border focus:outline-none focus:border-primary py-1"
                placeholder="Ex: Pedicure, Tratamento..."
              />
              <button
                onClick={() => removeCategory(ci)}
                className="text-muted-foreground hover:text-red-500 transition-colors shrink-0"
                title="Remover categoria"
              >
                <Trash2 size={14} />
              </button>
            </div>
            <div className="space-y-3">
              {cat.items.map((item: any, ii: number) => (
                <div key={item.id} className="bg-card border border-border rounded-sm p-3">
                  <input
                    value={item.name}
                    onChange={(e) => updateItem(ci, ii, "name", e.target.value)}
                    className="w-full mb-2 px-3 py-2 bg-input-background border border-border rounded-sm text-sm focus:outline-none focus:border-primary"
                    placeholder="Nome do serviço"
                  />
                  <div className="flex gap-2 mb-2">
                    <input
                      value={item.price}
                      onChange={(e) => updateItem(ci, ii, "price", e.target.value)}
                      className="flex-1 px-3 py-2 bg-input-background border border-border rounded-sm text-sm focus:outline-none focus:border-primary"
                      placeholder="Preço (R$)"
                    />
                    <input
                      value={item.duration}
                      onChange={(e) => updateItem(ci, ii, "duration", e.target.value)}
                      className="flex-1 px-3 py-2 bg-input-background border border-border rounded-sm text-sm focus:outline-none focus:border-primary"
                      placeholder="Duração"
                    />
                  </div>
                  <input
                    value={item.description}
                    onChange={(e) => updateItem(ci, ii, "description", e.target.value)}
                    className="w-full mb-2 px-3 py-2 bg-input-background border border-border rounded-sm text-sm focus:outline-none focus:border-primary"
                    placeholder="Descrição"
                  />
                  <button
                    onClick={() => removeItem(ci, ii)}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={12} /> remover
                  </button>
                </div>
              ))}
              <button
                onClick={() => addItem(ci)}
                className="w-full py-2 rounded-sm border border-dashed border-border text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors flex items-center justify-center gap-1"
              >
                <Plus size={14} /> Adicionar serviço
              </button>
            </div>
          </div>
        ))}
        <button
          onClick={addCategory}
          className="w-full py-2 rounded-sm border border-dashed border-border text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors flex items-center justify-center gap-1"
        >
          <Plus size={14} /> Adicionar categoria
        </button>
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="w-full mt-6 py-4 rounded-sm text-primary-foreground text-sm tracking-widest uppercase transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
        style={{ background: "var(--primary)" }}
      >
        {saved ? (<><Check size={16} /> Salvo!</>) : saving ? "Salvando..." : (<><Save size={16} /> Salvar Serviços</>)}
      </button>
    </div>
  );
}

/* ---------------- Team ---------------- */

function TeamManager({ professionals, saveBusinessData, uploadPhoto }: any) {
  const [draft, setDraft] = useState<any[]>(() => JSON.parse(JSON.stringify(professionals || [])).slice(0, 1));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<any>(null);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  const update = (i: number, field: string, value: any) => {
    setDraft((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], [field]: value };
      return next;
    });
  };

  const addPro = () => {
    // Hard limit of one professional — this button only shows when the
    // list is empty (i.e. after removing the existing one).
    if (draft.length >= 1) return;
    setDraft([{ id: Date.now(), name: "Nail designer", specialty: "Especialidade", rating: 5.0, reviews: 0, img: "" }]);
  };

  const removePro = (i: number) => {
    setDraft((prev) => prev.filter((_, idx) => idx !== i));
  };

  const handleFile = async (i: number, file: File) => {
    setUploadingId(draft[i].id);
    setErr(null);
    try {
      const dataUrl: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const url = await uploadPhoto(dataUrl);
      update(i, "img", url);
    } catch (e: any) {
      setErr(e.message || "Erro ao enviar foto.");
    } finally {
      setUploadingId(null);
    }
  };

  const save = async () => {
    setSaving(true);
    setErr(null);
    try {
      await saveBusinessData({ professionals: draft });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      setErr(e.message || "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-4">
      <SaveToast show={saved} />
      <p className="text-xs text-muted-foreground mb-4">
        Seu estúdio tem uma única nail designer (você). Se quiser trocar quem aparece, exclua e adicione de novo.
      </p>
      {err && <div className="mb-3 p-3 rounded-sm bg-red-50 border border-red-200 text-red-600 text-sm">{err}</div>}
      <div className="space-y-3">
        {draft.map((pro: any, i: number) => (
          <div key={pro.id} className="bg-card border border-border rounded-sm p-3 flex gap-3">
            <div className="shrink-0">
              <div className="w-16 h-16 rounded-sm overflow-hidden bg-secondary mb-1">
                {pro.img ? (
                  <img src={photoUrl(pro.img, 120)} alt={pro.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Users size={20} className="text-muted-foreground" />
                  </div>
                )}
              </div>
              <input
                ref={(el) => (fileInputs.current[pro.id] = el)}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(i, f); }}
              />
              <button
                onClick={() => fileInputs.current[pro.id]?.click()}
                disabled={uploadingId === pro.id}
                className="w-16 text-[10px] flex items-center justify-center gap-0.5 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              >
                <Upload size={10} /> {uploadingId === pro.id ? "..." : "foto"}
              </button>
            </div>
            <div className="flex-1">
              <input
                value={pro.name}
                onChange={(e) => update(i, "name", e.target.value)}
                className="w-full mb-2 px-3 py-2 bg-input-background border border-border rounded-sm text-sm focus:outline-none focus:border-primary"
                placeholder="Nome"
              />
              <input
                value={pro.specialty}
                onChange={(e) => update(i, "specialty", e.target.value)}
                className="w-full mb-2 px-3 py-2 bg-input-background border border-border rounded-sm text-sm focus:outline-none focus:border-primary"
                placeholder="Especialidade"
              />
              <button
                onClick={() => removePro(i)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-red-500 transition-colors"
              >
                <Trash2 size={12} /> excluir
              </button>
            </div>
          </div>
        ))}
        {draft.length === 0 && (
          <button
            onClick={addPro}
            className="w-full py-2 rounded-sm border border-dashed border-border text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors flex items-center justify-center gap-1"
          >
            <Plus size={14} /> Adicionar nail designer
          </button>
        )}
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="w-full mt-6 py-4 rounded-sm text-primary-foreground text-sm tracking-widest uppercase transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
        style={{ background: "var(--primary)" }}
      >
        {saved ? (<><Check size={16} /> Salvo!</>) : saving ? "Salvando..." : (<><Save size={16} /> Salvar</>)}
      </button>
    </div>
  );
}

/* ---------------- Hours ---------------- */

const WEEKDAY_LABELS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

function HoursManager({ businessHours, onSave, appointments }: any) {
  const [draft, setDraft] = useState<any>(() => JSON.parse(JSON.stringify(businessHours || {})));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const updateDay = (day: number, field: string, value: any) => {
    setDraft((prev: any) => ({
      ...prev,
      [day]: { ...(prev[day] || {}), [field]: value },
    }));
  };

  const toggleOpen = (day: number) => {
    setDraft((prev: any) => {
      const current = prev[day] || {};
      if (current.open) {
        return { ...prev, [day]: { open: false } };
      }
      return { ...prev, [day]: { open: true, start: current.start || "09:00", end: current.end || "18:00" } };
    });
  };

  const toggleBreak = (day: number) => {
    setDraft((prev: any) => {
      const current = prev[day] || {};
      if (current.breakStart) {
        const { breakStart, breakEnd, ...rest } = current;
        return { ...prev, [day]: rest };
      }
      return { ...prev, [day]: { ...current, breakStart: "12:00", breakEnd: "13:00" } };
    });
  };

  // Checks the draft's lunch breaks against existing confirmed appointments,
  // so the owner is warned if a break would land on top of a client who's
  // already booked at that time on that weekday.
  const findBreakConflicts = () => {
    const toMinutes = (t: string) => {
      const [h, m] = t.split(":").map(Number);
      return h * 60 + m;
    };
    const conflicts: string[] = [];
    for (const appt of appointments || []) {
      if (appt.status !== "confirmado" || !appt.date || !appt.time) continue;
      const dayOfWeek = new Date(appt.date.year, appt.date.month, appt.date.day).getDay();
      const config = draft[dayOfWeek];
      if (!config?.breakStart || !config?.breakEnd) continue;
      const apptMin = toMinutes(appt.time);
      if (apptMin >= toMinutes(config.breakStart) && apptMin < toMinutes(config.breakEnd)) {
        const dateStr = `${String(appt.date.day).padStart(2, "0")}/${String(appt.date.month + 1).padStart(2, "0")}`;
        conflicts.push(`${dateStr} às ${appt.time} (${appt.service?.name || "agendamento"})`);
      }
    }
    return conflicts;
  };
  const breakConflicts = findBreakConflicts();

  const save = async () => {
    if (!onSave) return;
    setSaving(true);
    setErr(null);
    try {
      await onSave(draft);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      setErr(e.message || "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-4">
      <SaveToast show={saved} />
      <p className="text-sm text-muted-foreground mb-4">
        Defina os dias e horários em que você atende. Isso controla os horários que aparecem para os clientes agendarem.
      </p>
      {breakConflicts.length > 0 && (
        <div className="mb-4 p-3 rounded-sm border text-sm" style={{ background: "#fef3c7", borderColor: "#fde68a", color: "#92400e" }}>
          <p className="font-medium mb-1">Atenção: você já tem cliente(s) agendada(s) nesse horário de almoço:</p>
          <ul className="list-disc list-inside">
            {breakConflicts.map((c, i) => <li key={i}>{c}</li>)}
          </ul>
        </div>
      )}
      {err && <div className="mb-3 p-3 rounded-sm bg-red-50 border border-red-200 text-red-600 text-sm">{err}</div>}
      <div className="space-y-3">
        {[1, 2, 3, 4, 5, 6, 0].map((day) => {
          const config = draft[day] || { open: false };
          return (
            <div key={day} className="bg-card border border-border rounded-sm p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-foreground">{WEEKDAY_LABELS[day]}</span>
                <button
                  onClick={() => toggleOpen(day)}
                  className="text-xs px-3 py-1 rounded-sm"
                  style={{
                    background: config.open ? "var(--secondary)" : "var(--muted)",
                    color: config.open ? "var(--primary)" : "var(--muted-foreground)",
                  }}
                >
                  {config.open ? "Aberto" : "Fechado"}
                </button>
              </div>

              {config.open && (
                <>
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      type="time"
                      value={config.start || "09:00"}
                      onChange={(e) => updateDay(day, "start", e.target.value)}
                      className="flex-1 px-2 py-1.5 bg-input-background border border-border rounded-sm text-sm"
                    />
                    <span className="text-xs text-muted-foreground">até</span>
                    <input
                      type="time"
                      value={config.end || "18:00"}
                      onChange={(e) => updateDay(day, "end", e.target.value)}
                      className="flex-1 px-2 py-1.5 bg-input-background border border-border rounded-sm text-sm"
                    />
                  </div>

                  <button
                    onClick={() => toggleBreak(day)}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors mb-2"
                  >
                    {config.breakStart ? "− remover intervalo de almoço" : "+ adicionar intervalo de almoço"}
                  </button>

                  {config.breakStart && (
                    <div className="flex items-center gap-2">
                      <input
                        type="time"
                        value={config.breakStart}
                        onChange={(e) => updateDay(day, "breakStart", e.target.value)}
                        className="flex-1 px-2 py-1.5 bg-input-background border border-border rounded-sm text-sm"
                      />
                      <span className="text-xs text-muted-foreground">até</span>
                      <input
                        type="time"
                        value={config.breakEnd}
                        onChange={(e) => updateDay(day, "breakEnd", e.target.value)}
                        className="flex-1 px-2 py-1.5 bg-input-background border border-border rounded-sm text-sm"
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="w-full mt-6 py-4 rounded-sm text-primary-foreground text-sm tracking-widest uppercase transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
        style={{ background: "var(--primary)" }}
      >
        {saved ? (<><Check size={16} /> Salvo!</>) : saving ? "Salvando..." : (<><Save size={16} /> Salvar Horários</>)}
      </button>
    </div>
  );
}

/* ---------------- Payments ---------------- */

const PROVIDER_INFO: Record<string, { label: string; helpUrl: string }> = {
  mercadopago: { label: "Mercado Pago", helpUrl: "https://www.mercadopago.com.br/developers/panel/app" },
  asaas: { label: "Asaas", helpUrl: "https://www.asaas.com/" },
  pagbank: { label: "PagBank", helpUrl: "https://developer.pagbank.com.br/" },
};

function PaymentsManager({ paymentSettings, onSave, businessId, webhookBaseUrl }: any) {
  const [provider, setProvider] = useState<string>(paymentSettings?.provider || "");
  const [depositPercent, setDepositPercent] = useState<number>(paymentSettings?.depositPercent ?? 50);
  const [mpToken, setMpToken] = useState("");
  const [mpWebhookSecret, setMpWebhookSecret] = useState("");
  const [asaasKey, setAsaasKey] = useState("");
  const [asaasEnv, setAsaasEnv] = useState<"sandbox" | "production">("sandbox");
  const [pbToken, setPbToken] = useState("");
  const [pbEnv, setPbEnv] = useState<"sandbox" | "production">("sandbox");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const asaasWebhookUrl = webhookBaseUrl ? `${webhookBaseUrl}/webhooks/asaas?businessId=${encodeURIComponent(businessId || "")}` : "";

  const save = async () => {
    if (!onSave) return;
    setSaving(true);
    setErr(null);
    try {
      const payload: any = { provider: provider || null, depositPercent };
      if (provider === "mercadopago" && (mpToken || mpWebhookSecret)) {
        payload.mercadopago = {
          ...(mpToken ? { accessToken: mpToken } : {}),
          ...(mpWebhookSecret ? { webhookSecret: mpWebhookSecret } : {}),
        };
      }
      if (provider === "asaas" && asaasKey) payload.asaas = { apiKey: asaasKey, environment: asaasEnv };
      if (provider === "pagbank" && pbToken) payload.pagbank = { token: pbToken, environment: pbEnv };
      await onSave(payload);
      setSaved(true);
      setMpToken(""); setMpWebhookSecret(""); setAsaasKey(""); setPbToken("");
      setTimeout(() => setSaved(false), 2500);
    } catch (e: any) {
      setErr(e.message || "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-4">
      <SaveToast show={saved} />
      <div
        className="mb-5 p-3 rounded-sm border text-sm"
        style={{ background: "#fef3c7", borderColor: "#fde68a", color: "#92400e" }}
      >
        Antes de usar com clientes de verdade: conecte primeiro suas chaves de <strong>teste/sandbox</strong> do provedor
        escolhido e faça uma reserva de teste completa (do agendamento ao webhook confirmando o pagamento) antes de
        trocar para as chaves de produção. Isso evita qualquer surpresa com dinheiro real.
      </div>

      <div className="mb-5">
        <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-2">
          Provedor de pagamento
        </label>
        <div className="grid grid-cols-3 gap-2">
          {(["mercadopago", "asaas", "pagbank"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setProvider(p)}
              className="py-2.5 rounded-sm border text-xs font-medium transition-colors"
              style={{
                borderColor: provider === p ? "var(--primary)" : "var(--border)",
                background: provider === p ? "var(--secondary)" : "transparent",
                color: "var(--foreground)",
              }}
            >
              {PROVIDER_INFO[p].label}
            </button>
          ))}
        </div>
      </div>

      {provider && (
        <>
          <div className="mb-5">
            <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-1">
              Sinal exigido do cliente (%)
            </label>
            <input
              type="number"
              min={0}
              max={100}
              value={depositPercent}
              onChange={(e) => setDepositPercent(Number(e.target.value))}
              className="w-full text-sm px-2 py-2 rounded-sm border border-border bg-background"
            />
          </div>

          {provider === "mercadopago" && (
            <div className="mb-5">
              <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-1">
                Access Token do Mercado Pago
              </label>
              <input
                type="password"
                value={mpToken}
                onChange={(e) => setMpToken(e.target.value)}
                placeholder={paymentSettings?.mercadopago?.accessTokenMasked || "APP_USR-..."}
                className="w-full text-sm px-2 py-2 rounded-sm border border-border bg-background mb-1"
              />
              <a href={PROVIDER_INFO.mercadopago.helpUrl} target="_blank" rel="noreferrer" className="text-xs mb-3 block" style={{ color: "var(--accent)" }}>
                Pegar meu Access Token no Mercado Pago →
              </a>

              <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-1">
                Chave secreta do Webhook (recomendado)
              </label>
              <input
                type="password"
                value={mpWebhookSecret}
                onChange={(e) => setMpWebhookSecret(e.target.value)}
                placeholder={paymentSettings?.mercadopago?.hasWebhookSecret ? "•••• já configurada" : "cole a chave secreta aqui"}
                className="w-full text-sm px-2 py-2 rounded-sm border border-border bg-background mb-1"
              />
              <p className="text-xs text-muted-foreground">
                Pegue essa chave em Suas Integrações → Webhooks, depois de colar a URL de notificação e salvar. Ela confirma
                que os avisos de pagamento realmente vêm do Mercado Pago, e não de alguém tentando fingir um pagamento.
              </p>
            </div>
          )}

          {provider === "asaas" && (
            <div className="mb-5">
              <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-1">
                Chave de API do Asaas
              </label>
              <input
                type="password"
                value={asaasKey}
                onChange={(e) => setAsaasKey(e.target.value)}
                placeholder={paymentSettings?.asaas?.apiKeyMasked || "$aact_..."}
                className="w-full text-sm px-2 py-2 rounded-sm border border-border bg-background mb-2"
              />
              <div className="flex gap-2 mb-1">
                <button
                  onClick={() => setAsaasEnv("sandbox")}
                  className="flex-1 py-1.5 rounded-sm border text-xs"
                  style={{ borderColor: asaasEnv === "sandbox" ? "var(--primary)" : "var(--border)", background: asaasEnv === "sandbox" ? "var(--secondary)" : "transparent" }}
                >
                  Teste (sandbox)
                </button>
                <button
                  onClick={() => setAsaasEnv("production")}
                  className="flex-1 py-1.5 rounded-sm border text-xs"
                  style={{ borderColor: asaasEnv === "production" ? "var(--primary)" : "var(--border)", background: asaasEnv === "production" ? "var(--secondary)" : "transparent" }}
                >
                  Produção
                </button>
              </div>
              <a href={PROVIDER_INFO.asaas.helpUrl} target="_blank" rel="noreferrer" className="text-xs mb-2 block" style={{ color: "var(--accent)" }}>
                Criar conta / pegar chave no Asaas →
              </a>
              <div className="p-2 rounded-sm border border-border" style={{ background: "var(--background)" }}>
                <p className="text-xs text-muted-foreground mb-1">
                  Passo extra necessário: no painel do Asaas, em Configurações → Webhooks, cole esta URL:
                </p>
                <p className="text-xs font-mono break-all select-all">
                  {asaasWebhookUrl}
                </p>
              </div>
            </div>
          )}

          {provider === "pagbank" && (
            <div className="mb-5">
              <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-1">
                Token do PagBank
              </label>
              <input
                type="password"
                value={pbToken}
                onChange={(e) => setPbToken(e.target.value)}
                placeholder={paymentSettings?.pagbank?.tokenMasked || "..."}
                className="w-full text-sm px-2 py-2 rounded-sm border border-border bg-background mb-2"
              />
              <div className="flex gap-2 mb-1">
                <button
                  onClick={() => setPbEnv("sandbox")}
                  className="flex-1 py-1.5 rounded-sm border text-xs"
                  style={{ borderColor: pbEnv === "sandbox" ? "var(--primary)" : "var(--border)", background: pbEnv === "sandbox" ? "var(--secondary)" : "transparent" }}
                >
                  Teste (sandbox)
                </button>
                <button
                  onClick={() => setPbEnv("production")}
                  className="flex-1 py-1.5 rounded-sm border text-xs"
                  style={{ borderColor: pbEnv === "production" ? "var(--primary)" : "var(--border)", background: pbEnv === "production" ? "var(--secondary)" : "transparent" }}
                >
                  Produção
                </button>
              </div>
              <a href={PROVIDER_INFO.pagbank.helpUrl} target="_blank" rel="noreferrer" className="text-xs" style={{ color: "var(--accent)" }}>
                Criar conta / pegar token no PagBank →
              </a>
            </div>
          )}
        </>
      )}

      {err && <p className="text-xs text-red-600 mb-3">{err}</p>}

      <button
        onClick={save}
        disabled={saving || !provider}
        className="w-full py-4 rounded-sm text-primary-foreground text-sm tracking-widest uppercase transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
        style={{ background: "var(--primary)" }}
      >
        {saved ? (<><Check size={16} /> Salvo!</>) : saving ? "Salvando..." : (<><Save size={16} /> Salvar Pagamentos</>)}
      </button>
    </div>
  );
}