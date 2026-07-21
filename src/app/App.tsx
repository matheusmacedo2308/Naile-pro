import { useState, useEffect, Component } from "react";
import { motion, useReducedMotion, AnimatePresence } from "motion/react";
import { createClient } from "@supabase/supabase-js";
import { projectId, publicAnonKey } from "../../utils/supabase/info";
import { ChevronLeft, ChevronRight, Clock, Star, Instagram, Phone, MapPin, X, Check, Sparkles, Scissors, Palette, Gem, LayoutDashboard } from "lucide-react";
import { AdminPanel } from "./components/AdminPanel";

const SERVER_URL = `https://${projectId}.supabase.co/functions/v1/make-server-a3611da8`;
const SERVER_HEADERS = { "Content-Type": "application/json", Authorization: `Bearer ${publicAnonKey}` };
const ADMIN_EMAIL = "admin@maisonnaile.com";

// Catches any unexpected rendering crash anywhere below it and shows a
// friendly recovery screen instead of a blank white page. This was added
// because save actions were occasionally hitting an uncaught error and
// blanking the whole app with no explanation.
class ErrorBoundary extends Component<{ children: any }, { hasError: boolean; message: string }> {
  constructor(props: { children: any }) {
    super(props);
    this.state = { hasError: false, message: "" };
  }
  static getDerivedStateFromError(err: any) {
    return { hasError: true, message: err?.message || "Erro inesperado." };
  }
  componentDidCatch(err: any, info: any) {
    console.error("App crashed:", err, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="size-full flex flex-col items-center justify-center text-center px-6" style={{ background: "var(--background)", fontFamily: "'DM Sans', sans-serif" }}>
          <p className="text-xs tracking-widest uppercase text-muted-foreground mb-2">Ops</p>
          <h2 className="text-xl mb-3" style={{ fontFamily: "'Cormorant', serif" }}>Algo deu errado</h2>
          <p className="text-sm text-muted-foreground mb-6 max-w-xs">{this.state.message}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 rounded-sm text-primary-foreground text-sm tracking-widest uppercase"
            style={{ background: "var(--primary)" }}
          >
            Recarregar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Single shared Supabase client. It persists the session, auto-refreshes the
// access token, and handles refresh-token rotation and recovery links for us.
const supabase = createClient(`https://${projectId}.supabase.co`, publicAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

const DEFAULT_SERVICES = [
  { id: 1, category: "Manicure", items: [
    { id: "m1", name: "Manicure Simples", duration: "45 min", price: "R$ 45", description: "Cutícula, limagem e esmaltação." },
    { id: "m2", name: "Manicure em Gel", duration: "1h 30min", price: "R$ 120", description: "Aplicação de gel com longa duração." },
    { id: "m3", name: "Unhas Acrílicas", duration: "2h", price: "R$ 180", description: "Modelagem completa em acrílico." },
  ] },
  { id: 2, category: "Pedicure", items: [
    { id: "p1", name: "Pedicure Clássica", duration: "1h", price: "R$ 60", description: "Tratamento completo dos pés." },
    { id: "p2", name: "Pedicure Spa", duration: "1h 30min", price: "R$ 95", description: "Esfoliação, hidratação e esmaltação." },
  ] },
  { id: 3, category: "Nail Art", items: [
    { id: "n1", name: "Nail Art Básica", duration: "30 min", price: "R$ 35", description: "Desenhos simples e delicados." },
    { id: "n2", name: "Nail Art Completa", duration: "1h", price: "R$ 80", description: "Designs elaborados e personalizados." },
    { id: "n3", name: "Nail Art 3D", duration: "1h 30min", price: "R$ 130", description: "Arte em relevo com pedras e texturas." },
  ] },
  { id: 4, category: "Tratamentos", items: [
    { id: "t1", name: "Hidratação Profunda", duration: "45 min", price: "R$ 55", description: "Hidratação intensiva para cutículas." },
    { id: "t2", name: "Blindagem", duration: "1h", price: "R$ 90", description: "Fortalecimento das unhas naturais." },
  ] },
];

// Same as the backend: no fake team by default — the owner adds their own.
const DEFAULT_PROFESSIONALS: any[] = [];

// Icons are attached on the client by category name (they can't be stored in the DB).
const CATEGORY_ICONS: Record<string, any> = {
  Manicure: Scissors,
  Pedicure: Sparkles,
  "Nail Art": Palette,
  Tratamentos: Gem,
};
function categoryIcon(category: string) {
  return CATEGORY_ICONS[category] || Sparkles;
}

// Professional photos can be a full URL (uploaded) or an Unsplash photo id (seeded).
function photoUrl(img: string, size = 300) {
  if (!img) return "";
  if (img.startsWith("http")) return img;
  return `https://images.unsplash.com/${img}?w=${size}&h=${size}&fit=crop&auto=format`;
}

// Generates 30-minute time slots for a given day, based on that business's
// configured working hours (open/closed, start/end, optional lunch break).
// Falls back to a sensible default if hours haven't loaded yet.
function timesForDay(
  date: { day: number; month: number; year: number } | null | undefined,
  businessHours: Record<number, { open: boolean; start?: string; end?: string; breakStart?: string; breakEnd?: string }>
): string[] {
  if (!date) return [];
  const dayOfWeek = new Date(date.year, date.month, date.day).getDay();
  const config = businessHours?.[dayOfWeek];
  if (!config || !config.open || !config.start || !config.end) return [];

  const toMinutes = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  const toHHMM = (mins: number) => `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;

  const startMin = toMinutes(config.start);
  const endMin = toMinutes(config.end);
  const breakStartMin = config.breakStart ? toMinutes(config.breakStart) : null;
  const breakEndMin = config.breakEnd ? toMinutes(config.breakEnd) : null;

  const slots: string[] = [];
  for (let t = startMin; t < endMin; t += 30) {
    if (breakStartMin !== null && breakEndMin !== null && t >= breakStartMin && t < breakEndMin) continue;
    slots.push(toHHMM(t));
  }
  return slots;
}



const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

type Step = "services" | "professional" | "date" | "confirm" | "success";

interface Booking {
  service: { id: string; name: string; duration: string; price: string } | null;
  professional: (typeof DEFAULT_PROFESSIONALS)[0] | null;
  date: { day: number; month: number; year: number } | null;
  time: string | null;
}

function AppInner() {
  const shouldReduceMotion = useReducedMotion();
  const [activeTab, setActiveTab] = useState<"home" | "book" | "appointments" | "admin">("home");
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [authMode, setAuthMode] = useState<"login" | "register" | "forgot">("login");
  const [accountType, setAccountType] = useState<"client" | "business">("client");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [recoveryToken, setRecoveryToken] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [recoverySaving, setRecoverySaving] = useState(false);

  // The business a CLIENT is booking with, resolved from the URL slug
  // (seusite.com/{slug}). Owners/admins ignore this and always use their own
  // profile.businessId instead.
  const [viewingBusiness, setViewingBusiness] = useState<{ businessId: string; businessName: string; address?: string | null; ownerPhone?: string | null } | null>(null);
  const [viewingBusinessError, setViewingBusinessError] = useState<string | null>(null);
  const [paymentReturnPending, setPaymentReturnPending] = useState(false);
  const [paymentJustConfirmed, setPaymentJustConfirmed] = useState(false);
  const [confirmedAppt, setConfirmedAppt] = useState<any>(null);

  const [step, setStep] = useState<Step>("services");
  const [booking, setBooking] = useState<Booking>({ service: null, professional: null, date: null, time: null });
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [activeCategory, setActiveCategory] = useState(0);
  const [myAppointments, setMyAppointments] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingAppts, setLoadingAppts] = useState(false);

  // Cancel / reschedule state
  const [cancelingKey, setCancelingKey] = useState<string | null>(null);
  const [resumingKey, setResumingKey] = useState<string | null>(null);
  const [reschedulingAppt, setReschedulingAppt] = useState<any>(null);
  const [reschedDate, setReschedDate] = useState<{ day: number; month: number; year: number } | null>(null);
  const [reschedTime, setReschedTime] = useState<string | null>(null);
  const [reschedMonth, setReschedMonth] = useState(new Date().getMonth());
  const [reschedYear, setReschedYear] = useState(new Date().getFullYear());
  const [reschedLoading, setReschedLoading] = useState(false);
  const [apptActionError, setApptActionError] = useState<string | null>(null);

  // Catalog (loaded from the database, editable by the business owner)
  const [services, setServices] = useState<any[]>(DEFAULT_SERVICES);
  const [professionals, setProfessionals] = useState<any[]>(DEFAULT_PROFESSIONALS);
  const DEFAULT_BUSINESS_HOURS: Record<number, { open: boolean; start?: string; end?: string; breakStart?: string; breakEnd?: string }> = {
    0: { open: false },
    1: { open: true, start: "09:00", end: "18:00", breakStart: "12:00", breakEnd: "13:00" },
    2: { open: true, start: "09:00", end: "18:00", breakStart: "12:00", breakEnd: "13:00" },
    3: { open: true, start: "09:00", end: "18:00", breakStart: "12:00", breakEnd: "13:00" },
    4: { open: true, start: "09:00", end: "18:00", breakStart: "12:00", breakEnd: "13:00" },
    5: { open: true, start: "09:00", end: "18:00", breakStart: "12:00", breakEnd: "13:00" },
    6: { open: true, start: "09:00", end: "13:00" },
  };
  const [businessHours, setBusinessHours] = useState(DEFAULT_BUSINESS_HOURS);
  const [notifications, setNotifications] = useState<any[]>([]);

  const isOwner = profile?.role === "owner" || isAdmin;
  // Owners/admins work with their OWN business's data (profile.businessId).
  // Clients booking an appointment use whichever business was resolved from
  // the URL slug (seusite.com/nome-do-salao). Falls back to "default" only
  // if no slug was in the URL (e.g. visiting the bare domain).
  const WORKSPACE_ID = isOwner ? (profile?.businessId || "default") : (viewingBusiness?.businessId || "default");

  // Returns a valid user access token, or null if the session is truly gone
  // (refresh token expired/rotated). No longer silently falls back to the
  // anon key, which is what caused the confusing "Invalid or expired
  // session" error from the server.
  const getToken = async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session) return null;
    return data.session.access_token;
  };

  // Fetch helper that attaches a valid access token to server requests.
  // If the session is actually gone, log the user out and surface a clear
  // message instead of sending an anon key the server will reject.
  const authedFetch = async (url: string, options: any = {}) => {
    const token = await getToken();
    if (!token) {
      await supabase.auth.signOut();
      setUser(null);
      setProfile(null);
      setIsAdmin(false);
      throw new Error("Sua sessão expirou. Faça login novamente para continuar.");
    }
    return fetch(url, {
      ...options,
      headers: { ...SERVER_HEADERS, ...(options.headers || {}), Authorization: `Bearer ${token}` },
    });
  };

  const today = new Date();
  const API_URL = `https://${projectId}.supabase.co/functions/v1/make-server-a3611da8/appointments`;

  useEffect(() => {
    // Restore any existing session and react to auth changes (login, logout,
    // token refresh, and the password-recovery link) via the official client.
    supabase.auth.getSession().then(({ data }) => {
      const session = data.session;
      setUser(session?.user ?? null);
      setIsAdmin(session?.user?.email === ADMIN_EMAIL);
      if (session?.user) loadProfile();
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setRecoveryToken("recovery");
        return;
      }
      setUser(session?.user ?? null);
      setIsAdmin(session?.user?.email === ADMIN_EMAIL);
      if (session?.user) {
        // Only redirect owners to their panel on a fresh sign-in/registration,
        // not on silent background token refreshes.
        loadProfile(event === "SIGNED_IN");
      } else {
        setProfile(null);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    // Read the salon slug from a query param, e.g. seusite.com/?salao=maison-naile.
    // Using a query param (instead of a path like /maison-naile) means this
    // always lands on the app's normal index.html — no server-side rewrite
    // rule is needed, so it works the same in the Figma Make preview, on
    // Vercel, or anywhere else this gets hosted.
    const slug = new URLSearchParams(window.location.search).get("salao");
    if (!slug) return;

    (async () => {
      try {
        const res = await fetch(`${SERVER_URL}/business-by-slug?slug=${encodeURIComponent(slug)}`, {
          headers: SERVER_HEADERS,
        });
        const data = await res.json();
        if (res.ok && data.businessId) {
          setViewingBusiness({ businessId: data.businessId, businessName: data.businessName, address: data.address, ownerPhone: data.ownerPhone });
          setAccountType("client");
        } else {
          setViewingBusinessError("Salão não encontrado. Confira o link com o estabelecimento.");
        }
      } catch (err) {
        console.error("Erro ao resolver o link do salão:", err);
      }
    })();
  }, []);

  useEffect(() => {
    // The client lands back here after paying the deposit. Confirmation
    // itself happens async via the payment provider's webhook, so instead of
    // making them click "Atualizar" forever, we poll quietly in the
    // background for up to a minute and surface a clear success message the
    // moment it's actually confirmed.
    const params = new URLSearchParams(window.location.search);
    if (params.get("pagamento") === "retorno") {
      setPaymentReturnPending(true);
      setActiveTab("appointments");
      params.delete("pagamento");
      const rest = params.toString();
      window.history.replaceState({}, "", window.location.pathname + (rest ? `?${rest}` : ""));
    }
  }, []);

  useEffect(() => {
    // The owner lands back here after paying (or trying to pay) the monthly
    // platform subscription. The real status update comes from the webhook,
    // so we just reload the profile/business record to pick it up — if it's
    // still "pending", the banner in the admin panel will keep showing that.
    const params = new URLSearchParams(window.location.search);
    if (params.get("assinatura") === "retorno") {
      params.delete("assinatura");
      const rest = params.toString();
      window.history.replaceState({}, "", window.location.pathname + (rest ? `?${rest}` : ""));
      setActiveTab("admin");
      setTimeout(() => loadProfile(), 1500);
    }
  }, []);

  useEffect(() => {
    if (!paymentReturnPending) return;
    const waitingKey = sessionStorage.getItem("pendingApptKey");
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts += 1;
      const res = await authedFetch(`${API_URL}?businessId=${WORKSPACE_ID}`);
      const data = await res.json().catch(() => ({}));
      const appts = data.appointments || [];

      // Only celebrate once THIS specific appointment is actually marked
      // "confirmado" — not just whenever nothing is "aguardando_pagamento"
      // anymore, since that can also be true for unrelated reasons (e.g. a
      // different pending booking, or this one still processing).
      const thisAppt = waitingKey
        ? appts.find((a: any) => apptKey(a) === waitingKey)
        : [...appts].filter((a: any) => a.paid && a.paidAt).sort((a: any, b: any) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime())[0];

      if (thisAppt && thisAppt.status === "confirmado" && thisAppt.paid) {
        await fetchAppointments();
        setConfirmedAppt(thisAppt);
        setPaymentReturnPending(false);
        setPaymentJustConfirmed(true);
        sessionStorage.removeItem("pendingApptKey");
        clearInterval(interval);
      } else if (attempts >= 15) {
        // Stop polling after ~1 minute; the manual "Atualizar" button in the
        // banner still works if it takes longer than that.
        clearInterval(interval);
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [paymentReturnPending]);

  const handleSetNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoverySaving(true);
    setAuthError(null);
    try {
      // The recovery link established a session; update the password on it.
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw new Error(error.message || "Erro ao redefinir a senha. O link pode ter expirado.");
      await supabase.auth.signOut();
      setRecoveryToken(null);
      setNewPassword("");
      setAuthMode("login");
      setAuthNotice("Senha alterada com sucesso! Faça login com a nova senha.");
    } catch (err: any) {
      setAuthError(err.message || "Erro ao redefinir a senha.");
    } finally {
      setRecoverySaving(false);
    }
  };

  const [myBusiness, setMyBusiness] = useState<{ id: string; name: string; slug: string; address?: string | null; ownerPhone?: string | null; subscription?: { plan: string; status: string; trialEndsAt?: string } } | null>(null);

  const [profileLoadFailed, setProfileLoadFailed] = useState(false);

  const loadProfile = async (redirectIfOwner = false, attempt = 1) => {
    try {
      const res = await authedFetch(`${SERVER_URL}/profile`);
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.profile) {
        setProfile(data.profile);
        setMyBusiness(data.business ?? null);
        setProfileLoadFailed(false);
        if (data.profile.role === "owner" || data.profile.role === "superadmin") {
          loadPaymentSettings();
        }
        if (redirectIfOwner && (data.profile.role === "owner" || data.profile.role === "superadmin")) {
          setActiveTab("admin");
        }
      } else {
        console.log("Não foi possível carregar o perfil:", data?.error);
        // Right after a fresh page load (e.g. returning from an external
        // checkout redirect), a transient hiccup here used to leave the
        // person "logged in" with no profile data at all, silently. Retry
        // a couple of times before giving up.
        if (attempt < 3) {
          setTimeout(() => loadProfile(redirectIfOwner, attempt + 1), 1200 * attempt);
        } else {
          setProfileLoadFailed(true);
        }
      }
    } catch (err) {
      console.log("Erro ao carregar perfil do usuário:", err);
      if (attempt < 3) {
        setTimeout(() => loadProfile(redirectIfOwner, attempt + 1), 1200 * attempt);
      } else {
        setProfileLoadFailed(true);
      }
    }
  };

  const signIn = async () => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message || "Email ou senha inválidos.");
    // onAuthStateChange updates the user, admin flag and profile.
  };

  useEffect(() => {
    // Re-fires whenever WORKSPACE_ID actually settles on its real value
    // (not just when user/isOwner change) — WORKSPACE_ID itself depends on
    // profile.businessId (owner) or viewingBusiness (client via ?salao=),
    // both of which resolve asynchronously AFTER user becomes truthy. Without
    // WORKSPACE_ID in this dependency list, the very first fetch could run
    // against the wrong ("default") business and never get corrected.
    if (user && (activeTab === "appointments" || activeTab === "book" || activeTab === "admin")) {
      fetchAppointments();
    }
  }, [activeTab, user, isOwner, WORKSPACE_ID]);

  // Load catalog and notifications once the user AND the correct business
  // (WORKSPACE_ID) are both known.
  useEffect(() => {
    if (!user) return;
    fetchBusinessData();
    if (!isOwner) fetchNotifications();
  }, [user, isOwner, WORKSPACE_ID]);

  const [takenSlots, setTakenSlots] = useState<any[]>([]);

  const fetchAppointments = async () => {
    try {
      setLoadingAppts(true);
      const res = await authedFetch(`${API_URL}?businessId=${WORKSPACE_ID}`);
      const data = await res.json();
      if (data.appointments) {
        // Owners/admins get every appointment for their business, in full.
        // Clients get their own bookings in full, plus a PII-free list of
        // which other slots are taken (no other client's contact info).
        if (isOwner) {
          setMyAppointments(data.appointments.filter((a: any) => a.status !== "aguardando_pagamento"));
          setTakenSlots([]);
        } else {
          setMyAppointments(data.appointments);
          setTakenSlots(data.takenSlots || []);
        }
      }
    } catch (err) {
      console.error("Erro ao buscar agendamentos:", err);
    } finally {
      setLoadingAppts(false);
    }
  };

  const fetchBusinessData = async () => {
    try {
      const res = await fetch(`${SERVER_URL}/business-data?businessId=${WORKSPACE_ID}`, {
        headers: SERVER_HEADERS,
      });
      const data = await res.json();
      if (res.ok && data.data) {
        setServices(data.data.services || DEFAULT_SERVICES);
        setProfessionals(data.data.professionals || DEFAULT_PROFESSIONALS);
      }
    } catch (err) {
      console.error("Erro ao carregar dados da empresa:", err);
    }

    try {
      const hoursRes = await fetch(`${SERVER_URL}/business/hours?businessId=${WORKSPACE_ID}`, {
        headers: SERVER_HEADERS,
      });
      const hoursData = await hoursRes.json();
      if (hoursRes.ok && hoursData.businessHours) {
        setBusinessHours(hoursData.businessHours);
      }
    } catch (err) {
      console.error("Erro ao carregar horários da empresa:", err);
    }
  };

  const fetchNotifications = async () => {
    try {
      const res = await authedFetch(`${SERVER_URL}/notifications`);
      const data = await res.json();
      if (res.ok && data.notifications) setNotifications(data.notifications);
    } catch (err) {
      console.error("Erro ao carregar notificações:", err);
    }
  };

  const dismissNotification = async (key: string) => {
    setNotifications(prev => prev.filter(n => n.key !== key));
    try {
      await authedFetch(`${SERVER_URL}/notifications/dismiss`, {
        method: "POST",
        body: JSON.stringify({ key }),
      });
    } catch (err) {
      console.error("Erro ao dispensar notificação:", err);
    }
  };

  // Save catalog changes (services and/or professionals) to the database.
  const saveBusinessData = async (payload: { services?: any[]; professionals?: any[] }) => {
    const res = await authedFetch(`${SERVER_URL}/business-data`, {
      method: "PUT",
      body: JSON.stringify({ businessId: WORKSPACE_ID, ...payload }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Erro ao salvar.");
    if (data.data) {
      setServices(data.data.services || []);
      setProfessionals(data.data.professionals || []);
    }
  };

  // Change the business's shareable link (slug), e.g. "maison-naile".
  const updateBusinessSlug = async (newSlug: string) => {
    const res = await authedFetch(`${SERVER_URL}/business/slug`, {
      method: "PUT",
      body: JSON.stringify({ slug: newSlug }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Erro ao atualizar o link.");
    setMyBusiness(data.business);
  };

  const updateBusinessAddress = async (address: string) => {
    const res = await authedFetch(`${SERVER_URL}/business/address`, {
      method: "PUT",
      body: JSON.stringify({ address }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Erro ao atualizar o endereço.");
    setMyBusiness(data.business);
  };

  const updateBusinessHours = async (hours: typeof businessHours) => {
    const res = await authedFetch(`${SERVER_URL}/business/hours`, {
      method: "PUT",
      body: JSON.stringify({ businessHours: hours }),
    });
    const raw = await res.text();
    let data: any = {};
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      // The server didn't return valid JSON — surface exactly what it did
      // return (truncated) instead of a confusing generic parse error, so
      // this is diagnosable from the message shown on screen.
      throw new Error(`Resposta inesperada do servidor: ${raw.slice(0, 200)}`);
    }
    if (!res.ok) throw new Error(data.error || "Erro ao atualizar os horários.");
    setBusinessHours(hours);
  };

  const [paymentSettings, setPaymentSettings] = useState<any>(null);

  const loadPaymentSettings = async () => {
    try {
      const res = await authedFetch(`${SERVER_URL}/business/payment-settings`);
      const data = await res.json();
      if (res.ok) setPaymentSettings(data.paymentSettings);
    } catch (err) {
      console.log("Erro ao carregar configurações de pagamento:", err);
    }
  };

  const savePaymentSettings = async (payload: any) => {
    const res = await authedFetch(`${SERVER_URL}/business/payment-settings`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Erro ao salvar configurações de pagamento.");
    await loadPaymentSettings();
  };

  // Starts the owner's monthly platform subscription and redirects them to
  // pay it (this is the fee THEY pay to use the app — separate from the
  // deposit their own clients pay for bookings).
  const subscribeToPlatform = async () => {
    const res = await authedFetch(`${SERVER_URL}/business/subscribe`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Erro ao iniciar assinatura.");
    if (data.checkoutUrl) window.location.href = data.checkoutUrl;
  };

  // Upload a photo (data URL) and return its stored URL.
  const uploadPhoto = async (dataUrl: string) => {
    const res = await authedFetch(`${SERVER_URL}/upload-photo`, {
      method: "POST",
      body: JSON.stringify({ businessId: WORKSPACE_ID, dataUrl }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Erro ao enviar foto.");
    return data.url as string;
  };

  // Turns whatever format the phone was typed in into the digits-only,
  // country-code-prefixed format WhatsApp's wa.me links expect.
  const formatPhoneForWhatsApp = (rawPhone: string): string | null => {
    const digits = rawPhone.replace(/\D/g, "");
    if (!digits) return null;
    // Already has a country code (13 digits: 55 + DDD + 9-digit cell number).
    if (digits.length >= 12) return digits;
    // Local Brazilian number (10-11 digits: DDD + number) — add country code.
    if (digits.length === 10 || digits.length === 11) return `55${digits}`;
    return digits;
  };

  const cancelWithMessage = async (appt: any, message: string) => {
    const res = await authedFetch(`${SERVER_URL}/appointments/cancel`, {
      method: "POST",
      body: JSON.stringify({ key: apptKey(appt), message }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Erro ao cancelar.");
    await fetchAppointments();

    // Open WhatsApp with the cancellation message pre-filled for the client,
    // so the salon just has to hit send — no paid API/integration needed.
    const phone = formatPhoneForWhatsApp(appt.userPhone || "");
    if (phone) {
      const text = message?.trim()
        ? `Olá! Seu agendamento foi cancelado. Motivo: ${message}`
        : "Olá! Informamos que seu agendamento foi cancelado.";
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, "_blank");
    }
  };

  // Client left the payment page without finishing — this asks the backend
  // for a fresh checkout link on the SAME pending appointment, so we send
  // them back to pay instead of making them book again.
  const resumeCheckout = async (appt: any) => {
    const res = await fetch(`${SERVER_URL}/appointments/resume-checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: apptKey(appt), returnUrl: window.location.href }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Não foi possível reabrir o pagamento.");
    if (data.checkoutUrl) {
      // Remember exactly which appointment we're paying for, so when the
      // client comes back we only celebrate once THIS one is confirmed —
      // not just whenever something in the list stops being pending.
      sessionStorage.setItem("pendingApptKey", apptKey(appt));
      window.location.href = data.checkoutUrl;
    }
  };

  // Marks an appointment as done (client already had her nails done). Keeps
  // the record — it just flips status so it drops into the history list
  // instead of the upcoming agenda.
  const completeAppointment = async (appt: any) => {
    const res = await authedFetch(`${SERVER_URL}/appointments/complete`, {
      method: "POST",
      body: JSON.stringify({ key: apptKey(appt) }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Erro ao finalizar.");
    await fetchAppointments();
  };

  // Opens WhatsApp with a day-before reminder pre-filled, so the owner just
  // has to glance at the "amanhã" list once a day and tap send for each.
  const sendReminder = (appt: any) => {
    const phone = formatPhoneForWhatsApp(appt.userPhone || "");
    if (!phone) return;
    const dateStr = `${String(appt.date?.day).padStart(2, "0")}/${String((appt.date?.month ?? 0) + 1).padStart(2, "0")}/${appt.date?.year}`;
    const address = myBusiness?.address ? `\nEndereço: ${myBusiness.address}` : "";
    const text = `Olá! Passando pra lembrar do seu agendamento de ${appt.service?.name} amanhã, dia ${dateStr} às ${appt.time}.${address}\nAté lá!`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, "_blank");
  };

  // Catches malformed addresses the basic HTML5 email input lets through —
  // e.g. "nome@gmail.com.2222" looks email-shaped but that final ".2222"
  // isn't a real domain ending, so we require the last label to be letters.
  const isValidEmail = (value: string) => {
    const trimmed = value.trim();
    return /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(trimmed);
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);
    setAuthNotice(null);
    try {
      if (!isValidEmail(email)) {
        throw new Error("Digite um email válido (ex: nome@provedor.com).");
      }
      if (authMode === "forgot") {
        // Production-grade recovery: Supabase emails a secure link that brings
        // the user back to the app to set a new password.
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + window.location.pathname,
        });
        if (error) throw new Error(error.message || "Erro ao enviar o email de recuperação.");
        setAuthMode("login");
        setAuthNotice("Enviamos um link de recuperação para o seu email. Verifique a caixa de entrada (e o spam).");
      } else if (authMode === "register") {
        // Registration is handled by our server so the email is auto-confirmed
        // and a profile (with role/businessId) is created in the database.
        if (accountType === "business") {
          const res = await fetch(`${SERVER_URL}/register-business`, {
            method: "POST",
            headers: SERVER_HEADERS,
            body: JSON.stringify({ businessName, ownerName: fullName, email, password, phone, cpfCnpj }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Erro ao registrar a empresa.");
        } else {
          const res = await fetch(`${SERVER_URL}/register-client`, {
            method: "POST",
            headers: SERVER_HEADERS,
            body: JSON.stringify({ name: fullName, email, password, phone }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Erro ao criar conta.");
        }
        // Account created and confirmed — sign in immediately.
        await signIn();
      } else {
        await signIn();
      }
    } catch (err: any) {
      setAuthError(err.message || "Erro na autenticação.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    // onAuthStateChange clears the user; ensure local state resets too.
    setUser(null);
    setProfile(null);
    setIsAdmin(false);
  };

  const handleConfirm = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${publicAnonKey}`
        },
        body: JSON.stringify({ ...booking, userId: user.id, userEmail: user.email, userPhone: profile?.phone || null, businessId: WORKSPACE_ID, returnUrl: window.location.href })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao agendar.");

      if (data.checkoutUrl) {
        // A deposit is required — send the client to pay. The appointment
        // only becomes "confirmado" (and appears on the salon's agenda)
        // once the payment webhook confirms it.
        if (data.appointment?.key) sessionStorage.setItem("pendingApptKey", data.appointment.key);
        window.location.href = data.checkoutUrl;
        return;
      }

      setStep("success");
      fetchAppointments(); // Refresh the list
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reconstruct the KV key when an older appointment lacks one.
  const apptKey = (appt: any) => {
    if (appt.key) return appt.key;
    const scope = appt.businessId || "default";
    return `appt_${scope}_${appt.professional.id}_${appt.date.year}_${appt.date.month}_${appt.date.day}_${appt.time}`;
  };

  const handleCancel = async (appt: any) => {
    const key = apptKey(appt);
    setCancelingKey(key);
    setApptActionError(null);
    try {
      const res = await authedFetch(`${API_URL}/${encodeURIComponent(key)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao cancelar.");
      await fetchAppointments();
    } catch (err: any) {
      setApptActionError(err.message || "Erro ao cancelar agendamento.");
    } finally {
      setCancelingKey(null);
    }
  };

  const handleResumeCheckout = async (appt: any) => {
    const key = apptKey(appt);
    setResumingKey(key);
    setApptActionError(null);
    try {
      await resumeCheckout(appt);
    } catch (err: any) {
      setApptActionError(err.message || "Erro ao reabrir o pagamento.");
      setResumingKey(null);
    }
    // No `finally` clearing resumingKey on success: the page is about to
    // navigate away to the checkout, so leaving the button in its "loading"
    // state avoids a flash back to normal right before the redirect fires.
  };


  const openReschedule = (appt: any) => {
    setReschedulingAppt(appt);
    setReschedDate(appt.date);
    setReschedTime(appt.time);
    setReschedMonth(appt.date.month);
    setReschedYear(appt.date.year);
    setApptActionError(null);
  };

  const closeReschedule = () => {
    setReschedulingAppt(null);
    setReschedDate(null);
    setReschedTime(null);
    setApptActionError(null);
  };

  const handleReschedule = async () => {
    if (!reschedulingAppt || !reschedDate || !reschedTime) return;
    setReschedLoading(true);
    setApptActionError(null);
    try {
      const res = await authedFetch(`${SERVER_URL}/appointments/reschedule`, {
        method: "PUT",
        body: JSON.stringify({ key: apptKey(reschedulingAppt), date: reschedDate, time: reschedTime }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao reagendar.");
      await fetchAppointments();

      const dateStr = `${String(reschedDate.day).padStart(2, "0")}/${String((reschedDate.month ?? 0) + 1).padStart(2, "0")}/${reschedDate.year}`;
      const isMyOwnBooking = reschedulingAppt.userId === user.id;

      if (isMyOwnBooking) {
        // The client rescheduled their own appointment — let the salon know,
        // opened from the client's own WhatsApp since they're the one here.
        const ownerPhone = formatPhoneForWhatsApp(viewingBusiness?.ownerPhone || myBusiness?.ownerPhone || "");
        if (ownerPhone) {
          const text = `Olá! Alterei meu agendamento de ${reschedulingAppt.service?.name} para o dia ${dateStr} às ${reschedTime}.`;
          window.open(`https://wa.me/${ownerPhone}?text=${encodeURIComponent(text)}`, "_blank");
        }
      } else {
        // The owner rescheduled it on the client's behalf — notify the
        // client with the new date/time, same pattern as the cancellation
        // notice.
        const clientPhone = formatPhoneForWhatsApp(reschedulingAppt.userPhone || "");
        if (clientPhone) {
          const text = `Olá! Seu agendamento de ${reschedulingAppt.service?.name} foi remarcado para o dia ${dateStr} às ${reschedTime}.`;
          window.open(`https://wa.me/${clientPhone}?text=${encodeURIComponent(text)}`, "_blank");
        }
      }

      closeReschedule();
    } catch (err: any) {
      setApptActionError(err.message || "Erro ao reagendar.");
    } finally {
      setReschedLoading(false);
    }
  };

  // Is a slot taken by any appointment (excludes the one being rescheduled)?
  const isSlotTakenFor = (professionalId: any, date: { day: number; month: number; year: number }, time: string, ignoreKey?: string) => {
    const inMine = myAppointments.some(a =>
      apptKey(a) !== ignoreKey &&
      a.professional.id === professionalId &&
      a.date.year === date.year &&
      a.date.month === date.month &&
      a.date.day === date.day &&
      a.time === time
    );
    if (inMine) return true;
    return takenSlots.some((a: any) =>
      a.professional.id === professionalId &&
      a.date.year === date.year &&
      a.date.month === date.month &&
      a.date.day === date.day &&
      a.time === time
    );
  };

  const isSlotBooked = (time: string) => {
    if (!booking.date || !booking.professional) return false;
    return myAppointments.some(a => 
      a.professional.id === booking.professional?.id &&
      a.date.year === booking.date?.year &&
      a.date.month === booking.date?.month &&
      a.date.day === booking.date?.day &&
      a.time === time
    );
  };


  function resetBooking() {
    setBooking({ service: null, professional: null, date: null, time: null });
    setStep("services");
  }

  const daysInMonth = getDaysInMonth(calYear, calMonth);
  const firstDay = getFirstDayOfMonth(calYear, calMonth);

  const isPastDay = (day: number) => {
    const d = new Date(calYear, calMonth, day);
    const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return d < t;
  };

  const inputClass = "w-full px-4 py-3 bg-card border border-border rounded-sm focus:outline-none focus:border-primary transition-colors";

  // Recovery link landing: let the user set a new password.
  if (recoveryToken) {
    return (
      <div className="size-full flex flex-col items-center justify-center p-6" style={{ fontFamily: "'DM Sans', sans-serif", background: "var(--background)" }}>
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <p className="text-xs tracking-[0.3em] uppercase text-accent mb-2">Recuperação de conta</p>
            <h1 className="text-4xl mb-2" style={{ fontFamily: "'Cormorant', serif", fontWeight: 300 }}>Nova senha</h1>
            <p className="text-sm text-muted-foreground">Defina uma nova senha para sua conta</p>
          </div>
          <form onSubmit={handleSetNewPassword} className="space-y-4">
            {authError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-sm">{authError}</div>
            )}
            <div>
              <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-1">Nova senha</label>
              <input type="password" required minLength={6} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={inputClass} placeholder="••••••••" />
            </div>
            <button
              type="submit"
              disabled={recoverySaving}
              className="w-full py-4 mt-2 rounded-sm text-primary-foreground text-sm tracking-widest uppercase transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ background: "var(--primary)" }}
            >
              {recoverySaving ? "Salvando..." : "Salvar Nova Senha"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="size-full flex flex-col items-center justify-center p-6 overflow-y-auto" style={{ fontFamily: "'DM Sans', sans-serif", background: "var(--background)" }}>
        <div className="w-full max-w-sm py-8">
          <div className="text-center mb-8">
            <p className="text-xs tracking-[0.3em] uppercase text-accent mb-2">Plataforma de Agendamento</p>
            <h1 className="text-4xl mb-2" style={{ fontFamily: "'Cormorant', serif", fontWeight: 300 }}>
              {viewingBusiness?.businessName || "Minha Agenda Nail"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {authMode === "login"
                ? "Acesse sua conta"
                : authMode === "forgot"
                ? "Redefina sua senha"
                : accountType === "business"
                ? "Cadastre seu estúdio e comece grátis"
                : "Crie sua conta de cliente"}
            </p>
          </div>

          {viewingBusinessError && (
            <div className="mb-5 p-3 border text-sm rounded-sm" style={{ background: "var(--secondary)", borderColor: "var(--border)", color: "var(--foreground)" }}>
              {viewingBusinessError}
            </div>
          )}

          {/* Account type toggle — only shown when NOT arriving via a
              specific salon's link. Someone who clicked a salon's shared
              link is clearly that salon's customer, not someone trying to
              register their own business. */}
          {authMode === "register" && !viewingBusiness && (
            <div className="flex gap-1 p-1 mb-5 rounded-sm" style={{ background: "var(--secondary)" }}>
              {([
                { key: "client", label: "Sou Cliente" },
                { key: "business", label: "Sou Empresa" },
              ] as const).map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setAccountType(opt.key)}
                  className="flex-1 py-2 rounded-sm text-sm transition-colors"
                  style={{
                    background: accountType === opt.key ? "var(--primary)" : "transparent",
                    color: accountType === opt.key ? "var(--primary-foreground)" : "var(--foreground)",
                    fontWeight: accountType === opt.key ? 500 : 400,
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-4">
            {authError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-sm">
                {authError}
              </div>
            )}
            {authNotice && (
              <div className="p-3 border text-sm rounded-sm" style={{ background: "var(--secondary)", borderColor: "var(--border)", color: "var(--foreground)" }}>
                {authNotice}
              </div>
            )}

            {authMode === "register" && accountType === "business" && (
              <div>
                <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-1">Nome do Estúdio</label>
                <input type="text" required value={businessName} onChange={(e) => setBusinessName(e.target.value)} className={inputClass} placeholder="Ex: Estúdio Bella Unhas" />
              </div>
            )}

            {authMode === "register" && accountType === "business" && (
              <div>
                <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-1">CPF ou CNPJ</label>
                <input type="text" required value={cpfCnpj} onChange={(e) => setCpfCnpj(e.target.value)} className={inputClass} placeholder="000.000.000-00" />
                <p className="text-xs text-muted-foreground mt-1">
                  Usado só pra liberar seu teste grátis uma única vez por documento.
                </p>
              </div>
            )}

            {authMode === "register" && (
              <div>
                <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-1">
                  {accountType === "business" ? "Seu Nome (responsável)" : "Nome completo"}
                </label>
                <input type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputClass} placeholder="Seu nome" />
              </div>
            )}

            {authMode === "register" && (
              <div>
                <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-1">
                  WhatsApp
                </label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={inputClass}
                  placeholder="(11) 91234-5678"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Usamos esse número para avisos sobre seus agendamentos.
                </p>
              </div>
            )}

            <div>
              <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-1">Email</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} placeholder="seu@email.com" />
            </div>

            {authMode !== "forgot" && (
              <div>
                <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-1">Senha</label>
                <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} placeholder="••••••••" />
              </div>
            )}

            {authMode === "forgot" && (
              <p className="text-xs text-muted-foreground leading-relaxed">
                Enviaremos um link seguro para o seu email. Ao clicar nele, você poderá definir uma nova senha.
              </p>
            )}

            {authMode === "login" && (
              <div className="text-right -mt-2">
                <button
                  type="button"
                  onClick={() => { setAuthMode("forgot"); setAuthError(null); setAuthNotice(null); setPassword(""); }}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Esqueci a senha
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={authLoading}
              className="w-full py-4 mt-4 rounded-sm text-primary-foreground text-sm tracking-widest uppercase transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ background: "var(--primary)" }}
            >
              {authLoading
                ? "Aguarde..."
                : authMode === "login"
                ? "Entrar"
                : authMode === "forgot"
                ? "Enviar Link de Recuperação"
                : accountType === "business"
                ? "Cadastrar Estúdio"
                : "Criar Conta"}
            </button>
          </form>

          {authMode === "register" && accountType === "business" && (
            <p className="text-xs text-muted-foreground text-center mt-4 leading-relaxed">
              14 dias grátis · Sem cartão de crédito · Cancele quando quiser
            </p>
          )}

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => { setAuthMode(m => m === "login" ? "register" : "login"); setAuthError(null); setAuthNotice(null); setPassword(""); }}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {authMode === "login"
                ? "Não tem conta? Cadastre-se"
                : authMode === "forgot"
                ? "Voltar para o login"
                : "Já tem conta? Entre aqui"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="size-full flex flex-col overflow-hidden"
      style={{ fontFamily: "'DM Sans', sans-serif", background: "var(--background)" }}
    >
      {/* Payment confirmed overlay — shown on top of whatever screen the
          person is on, and only once the bank/provider has actually
          confirmed the payment (never before). Stays until dismissed. */}
      {paymentJustConfirmed && (
        <motion.div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center text-center px-6"
          style={{ background: "var(--background)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <motion.div
            className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
            style={{ background: "var(--secondary)" }}
            initial={shouldReduceMotion ? false : { scale: 0, rotate: -90 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ duration: 0.5, delay: 0.1, ease: [0.34, 1.56, 0.64, 1] }}
          >
            <Check size={36} style={{ color: "var(--primary)" }} />
          </motion.div>
          <p className="text-xs tracking-widest uppercase text-muted-foreground mb-2">Pagamento confirmado</p>
          <h2 className="text-2xl mb-3" style={{ fontFamily: "'Cormorant', serif", fontWeight: 400 }}>
            Agendamento confirmado!
          </h2>
          {confirmedAppt && (
            <>
              <p className="text-sm text-foreground mb-1">{confirmedAppt.service?.name}</p>
              <p className="text-sm mb-1" style={{ fontFamily: "'DM Mono', monospace", color: "var(--accent)" }}>
                {String(confirmedAppt.date?.day).padStart(2, "0")}/{String((confirmedAppt.date?.month ?? 0) + 1).padStart(2, "0")}/{confirmedAppt.date?.year} · {confirmedAppt.time}
              </p>
              {(viewingBusiness?.address || myBusiness?.address) && (
                <p className="text-xs text-muted-foreground mb-6 max-w-xs">{viewingBusiness?.address || myBusiness?.address}</p>
              )}
            </>
          )}
          <button
            onClick={() => setPaymentJustConfirmed(false)}
            className="mt-4 px-8 py-3 rounded-sm text-primary-foreground text-sm tracking-widest uppercase"
            style={{ background: "var(--primary)" }}
          >
            Continuar
          </button>
        </motion.div>
      )}

      {/* Header */}
      <header className="shrink-0 px-6 pt-8 pb-4 flex items-center justify-between">
        <div>
          <p className="text-xs tracking-[0.2em] uppercase text-muted-foreground">
            {isAdmin ? "Administração" : profile?.businessId ? "Meu Estúdio" : (viewingBusiness?.businessName || "Minha Agenda Nail")}
          </p>
          <h1
            className="text-2xl text-foreground leading-tight"
            style={{ fontFamily: "'Cormorant', serif", fontWeight: 300, letterSpacing: "0.02em" }}
          >
            {profile?.name?.split(" ")[0] ? `Olá, ${profile.name.split(" ")[0]}` : "Minha Agenda Nail"}
          </h1>
        </div>
        <div className="flex items-center gap-1">
          <button className="p-2 rounded-full hover:bg-secondary transition-colors">
            <Instagram size={18} className="text-muted-foreground" />
          </button>
          <button className="p-2 rounded-full hover:bg-secondary transition-colors">
            <Phone size={18} className="text-muted-foreground" />
          </button>
          <button onClick={handleLogout} className="p-2 ml-1 text-xs text-red-400 hover:text-red-500 transition-colors uppercase tracking-widest">
            Sair
          </button>
        </div>
      </header>

      {profileLoadFailed && (
        <div className="shrink-0 mx-6 mb-3 p-3 rounded-sm border text-sm flex items-center justify-between gap-3" style={{ background: "#fef3c7", borderColor: "#fde68a", color: "#92400e" }}>
          <p>Não conseguimos carregar seus dados agora.</p>
          <button
            onClick={() => { setProfileLoadFailed(false); loadProfile(); }}
            className="shrink-0 text-xs px-3 py-1.5 rounded-sm bg-primary text-primary-foreground"
          >
            Tentar de novo
          </button>
        </div>
      )}

      {/* Content */}
      <main className="flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {/* HOME */}
        {activeTab === "home" && (
          <div className="pb-28">
            {/* Hero */}
            <motion.div
              className="mx-4 rounded-lg overflow-hidden relative h-48 mb-8"
              style={{ transformPerspective: 1000, transformOrigin: "top center" }}
              initial={shouldReduceMotion ? false : { opacity: 0, rotateX: -14, y: 18 }}
              animate={{ opacity: 1, rotateX: 0, y: 0 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            >
              <img
                src="https://images.unsplash.com/photo-1604654894610-df63bc536371?w=800&h=400&fit=crop&auto=format"
                alt="Nail art elegante"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-foreground/60 to-transparent" />
              <div className="absolute bottom-4 left-5 right-5">
                <p className="text-white/80 text-xs tracking-widest uppercase mb-1">Reserve seu horário</p>
                <p
                  className="text-white text-xl leading-snug"
                  style={{ fontFamily: "'Cormorant', serif", fontWeight: 400 }}
                >
                  Arte nas suas mãos, <br />cuidado em cada detalhe.
                </p>
              </div>
            </motion.div>

            <div className="naile-gold-rule mb-8" style={{ width: 64, margin: "0 auto 2rem" }} />

            {/* Quick Book */}
            <div className="px-4 mb-8">
              <button
                onClick={() => { setActiveTab("book"); resetBooking(); }}
                className="w-full py-4 rounded-sm text-primary-foreground text-sm tracking-widest uppercase transition-opacity hover:opacity-90 active:scale-[0.99]"
                style={{ background: "var(--primary)", fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}
              >
                Agendar Agora
              </button>
            </div>

            {/* Services preview */}
            <div className="px-4 mb-8">
              <div className="flex items-baseline justify-between mb-4">
                <h2 className="text-base font-medium text-foreground">Nossos Serviços</h2>
                <button
                  className="text-xs text-accent"
                  style={{ fontFamily: "'DM Mono', monospace" }}
                  onClick={() => { setActiveTab("book"); resetBooking(); }}
                >
                  ver todos →
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3" style={{ transformPerspective: 1000 }}>
                {services.map((cat, i) => {
                  const Icon = categoryIcon(cat.category);
                  return (
                    <motion.div
                      key={cat.id}
                      className="bg-card rounded-sm p-4 border border-border cursor-pointer"
                      style={{ transformOrigin: "top center" }}
                      initial={shouldReduceMotion ? false : { opacity: 0, rotateX: -10, y: 14 }}
                      whileInView={{ opacity: 1, rotateX: 0, y: 0 }}
                      viewport={{ once: true, margin: "-40px" }}
                      whileHover={shouldReduceMotion ? undefined : { y: -3, borderColor: "var(--primary)" }}
                      whileTap={{ scale: 0.98 }}
                      transition={{ duration: 0.55, delay: i * 0.07, ease: [0.16, 1, 0.3, 1] }}
                      onClick={() => { setActiveTab("book"); resetBooking(); }}
                    >
                      <Icon size={18} className="mb-2" style={{ color: "var(--accent)" }} />
                      <p className="text-sm font-medium text-foreground">{cat.category}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{cat.items.length} opções</p>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* Team */}
            {professionals.length > 0 && (
              <div className="mb-8">
                <div className="px-4 mb-4">
                  <h2 className="text-base font-medium text-foreground">Nossa Equipe</h2>
                </div>
                <div className="flex gap-3 px-4 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden pb-1" style={{ transformPerspective: 1000 }}>
                  {professionals.map((p, i) => (
                    <motion.div
                      key={p.id}
                      className="shrink-0 w-36"
                      initial={shouldReduceMotion ? false : { opacity: 0, rotateX: -10, y: 14 }}
                      whileInView={{ opacity: 1, rotateX: 0, y: 0 }}
                      viewport={{ once: true, margin: "-40px" }}
                      transition={{ duration: 0.55, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                    >
                      <motion.div
                        className="w-36 h-36 rounded-sm overflow-hidden mb-2 bg-secondary"
                        animate={shouldReduceMotion ? undefined : { y: [0, -4, 0] }}
                        transition={shouldReduceMotion ? undefined : { duration: 5 + i * 0.4, repeat: Infinity, ease: "easeInOut", delay: i * 0.3 }}
                      >
                        <img
                          src={photoUrl(p.img, 300)}
                          alt={p.name}
                          className="w-full h-full object-cover"
                        />
                      </motion.div>
                      <p className="text-sm font-medium text-foreground">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.specialty}</p>
                      <div className="flex items-center gap-1 mt-1">
                        <Star size={10} fill="currentColor" className="text-accent" />
                        <span className="text-xs" style={{ fontFamily: "'DM Mono', monospace" }}>{p.rating}</span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Location */}
            <div className="mx-4 bg-card border border-border rounded-sm p-4">
              <div className="flex items-start gap-3">
                <MapPin size={16} className="mt-0.5 shrink-0" style={{ color: "var(--accent)" }} />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {(isOwner ? myBusiness?.address : viewingBusiness?.address) || "Endereço a definir pelo estabelecimento"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* BOOKING FLOW */}
        {activeTab === "book" && (
          <div className="pb-28">
            {/* Steps indicator */}
            <div className="px-4 mb-6">
              <div className="flex items-center gap-1">
                {(["services", "professional", "date", "confirm"] as Step[]).map((s, i) => (
                  <div key={s} className="flex items-center gap-1">
                    <div
                      className="h-1 rounded-full transition-all duration-300"
                      style={{
                        width: step === s ? "32px" : "12px",
                        background: ["services", "professional", "date", "confirm", "success"].indexOf(step) >= i ? "var(--primary)" : "var(--muted)",
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Step: Services */}
            <AnimatePresence mode="wait">
            {step === "services" && (
              <motion.div
                key="services"
                className="px-4"
                style={{ transformPerspective: 1200 }}
                initial={shouldReduceMotion ? false : { opacity: 0, rotateY: 10, x: 24 }}
                animate={{ opacity: 1, rotateY: 0, x: 0 }}
                exit={shouldReduceMotion ? undefined : { opacity: 0, rotateY: -10, x: -24 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              >
                <p className="text-xs tracking-widest uppercase text-muted-foreground mb-1">Passo 1</p>
                <h2
                  className="text-2xl text-foreground mb-6"
                  style={{ fontFamily: "'Cormorant', serif", fontWeight: 400 }}
                >
                  Escolha o serviço
                </h2>

                <div className="flex gap-2 mb-5 overflow-x-auto [scrollbar-width:none] pb-1">
                  {services.map((cat, i) => (
                    <button
                      key={cat.id}
                      onClick={() => setActiveCategory(i)}
                      className="shrink-0 px-4 py-1.5 rounded-full text-sm transition-colors"
                      style={{
                        background: activeCategory === i ? "var(--primary)" : "var(--secondary)",
                        color: activeCategory === i ? "var(--primary-foreground)" : "var(--foreground)",
                        fontWeight: activeCategory === i ? 500 : 400,
                      }}
                    >
                      {cat.category}
                    </button>
                  ))}
                </div>

                <div className="space-y-3">
                  {(services[activeCategory]?.items || []).map((item) => (
                    <div
                      key={item.id}
                      onClick={() => {
                        setBooking((b) => ({ ...b, service: item }));
                        setStep("professional");
                      }}
                      className="bg-card border rounded-sm p-4 cursor-pointer transition-all hover:border-primary/40 active:scale-[0.99]"
                      style={{
                        borderColor: booking.service?.id === item.id ? "var(--primary)" : "var(--border)",
                      }}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="font-medium text-foreground">{item.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                        </div>
                        <div className="text-right ml-4">
                          <p className="text-sm font-medium" style={{ color: "var(--primary)" }}>{item.price}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end mt-0.5">
                            <Clock size={10} />{item.duration}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
            </AnimatePresence>

            {/* Step: Professional */}
            <AnimatePresence mode="wait">
            {step === "professional" && (
              <motion.div
                key="professional"
                className="px-4"
                style={{ transformPerspective: 1200 }}
                initial={shouldReduceMotion ? false : { opacity: 0, rotateY: 10, x: 24 }}
                animate={{ opacity: 1, rotateY: 0, x: 0 }}
                exit={shouldReduceMotion ? undefined : { opacity: 0, rotateY: -10, x: -24 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              >
                <button onClick={() => setStep("services")} className="flex items-center gap-1 text-muted-foreground text-sm mb-4 hover:text-foreground transition-colors">
                  <ChevronLeft size={16} /> voltar
                </button>
                <p className="text-xs tracking-widest uppercase text-muted-foreground mb-1">Passo 2</p>
                <h2
                  className="text-2xl text-foreground mb-6"
                  style={{ fontFamily: "'Cormorant', serif", fontWeight: 400 }}
                >
                  Escolha a profissional
                </h2>

                <div className="space-y-3">
                  {professionals.map((pro) => (
                    <div
                      key={pro.id}
                      onClick={() => {
                        setBooking((b) => ({ ...b, professional: pro }));
                        setStep("date");
                      }}
                      className="bg-card border rounded-sm p-4 flex items-center gap-4 cursor-pointer transition-all hover:border-primary/40 active:scale-[0.99]"
                      style={{
                        borderColor: booking.professional?.id === pro.id ? "var(--primary)" : "var(--border)",
                      }}
                    >
                      <div className="w-14 h-14 rounded-sm overflow-hidden shrink-0 bg-secondary">
                        <img
                          src={photoUrl(pro.img, 120)}
                          alt={pro.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-foreground">{pro.name}</p>
                        <p className="text-xs text-muted-foreground">{pro.specialty}</p>
                        <div className="flex items-center gap-1 mt-1">
                          <Star size={10} fill="currentColor" className="text-accent" />
                          <span className="text-xs text-muted-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>
                            {pro.rating} · {pro.reviews} avaliações
                          </span>
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-muted-foreground" />
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
            </AnimatePresence>

            {/* Step: Date & Time */}
            <AnimatePresence mode="wait">
            {step === "date" && (
              <motion.div
                key="date"
                className="px-4"
                style={{ transformPerspective: 1200 }}
                initial={shouldReduceMotion ? false : { opacity: 0, rotateY: 10, x: 24 }}
                animate={{ opacity: 1, rotateY: 0, x: 0 }}
                exit={shouldReduceMotion ? undefined : { opacity: 0, rotateY: -10, x: -24 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              >
                <button onClick={() => setStep("professional")} className="flex items-center gap-1 text-muted-foreground text-sm mb-4 hover:text-foreground transition-colors">
                  <ChevronLeft size={16} /> voltar
                </button>
                <p className="text-xs tracking-widest uppercase text-muted-foreground mb-1">Passo 3</p>
                <h2
                  className="text-2xl text-foreground mb-6"
                  style={{ fontFamily: "'Cormorant', serif", fontWeight: 400 }}
                >
                  Data e horário
                </h2>

                {/* Calendar */}
                <div className="bg-card border border-border rounded-sm p-4 mb-5">
                  <div className="flex items-center justify-between mb-4">
                    <button
                      onClick={() => {
                        if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); }
                        else setCalMonth(m => m - 1);
                      }}
                      className="p-1 rounded hover:bg-secondary transition-colors"
                    >
                      <ChevronLeft size={16} className="text-muted-foreground" />
                    </button>
                    <p className="text-sm font-medium text-foreground" style={{ fontFamily: "'Cormorant', serif", fontSize: "1.1rem" }}>
                      {MONTHS[calMonth]} {calYear}
                    </p>
                    <button
                      onClick={() => {
                        if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); }
                        else setCalMonth(m => m + 1);
                      }}
                      className="p-1 rounded hover:bg-secondary transition-colors"
                    >
                      <ChevronRight size={16} className="text-muted-foreground" />
                    </button>
                  </div>

                  <div className="grid grid-cols-7 gap-0 mb-2">
                    {WEEKDAYS.map(d => (
                      <div key={d} className="text-center text-xs text-muted-foreground py-1" style={{ fontFamily: "'DM Mono', monospace" }}>
                        {d}
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-7 gap-0">
                    {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
                    {Array.from({ length: daysInMonth }).map((_, i) => {
                      const day = i + 1;
                      const past = isPastDay(day);
                      const selected = booking.date?.day === day && booking.date?.month === calMonth && booking.date?.year === calYear;
                      const isToday = day === today.getDate() && calMonth === today.getMonth() && calYear === today.getFullYear();
                      return (
                        <button
                          key={day}
                          disabled={past}
                          onClick={() => setBooking(b => ({ ...b, date: { day, month: calMonth, year: calYear }, time: null }))}
                          className="aspect-square flex items-center justify-center text-sm rounded-sm transition-colors"
                          style={{
                            background: selected ? "var(--primary)" : "transparent",
                            color: past ? "var(--muted-foreground)" : selected ? "var(--primary-foreground)" : isToday ? "var(--accent)" : "var(--foreground)",
                            opacity: past ? 0.4 : 1,
                            fontWeight: isToday && !selected ? 600 : 400,
                          }}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Time slots */}
                {booking.date && (
                  <div>
                    <p className="text-sm font-medium text-foreground mb-3">Horários disponíveis</p>
                    {(() => {
                      const dayTimes = timesForDay(booking.date, businessHours);
                      if (dayTimes.length === 0) {
                        return <p className="text-sm text-muted-foreground">Fechado neste dia. Escolha outra data.</p>;
                      }
                      return (
                        <div className="grid grid-cols-4 gap-2">
                          {dayTimes.map(t => (
                            <button
                              key={t}
                              disabled={isSlotBooked(t)}
                              onClick={() => setBooking(b => ({ ...b, time: t }))}
                              className="py-2 text-sm rounded-sm border transition-colors"
                              style={{
                                background: booking.time === t ? "var(--primary)" : isSlotBooked(t) ? "var(--secondary)" : "var(--card)",
                                color: booking.time === t ? "var(--primary-foreground)" : isSlotBooked(t) ? "var(--muted-foreground)" : "var(--foreground)",
                                borderColor: booking.time === t ? "var(--primary)" : isSlotBooked(t) ? "transparent" : "var(--border)",
                                opacity: isSlotBooked(t) ? 0.5 : 1,
                                fontFamily: "'DM Mono', monospace",
                                fontSize: "0.75rem",
                              }}
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                      );
                    })()}

                    {booking.time && (
                      <button
                        onClick={() => setStep("confirm")}
                        className="w-full mt-6 py-4 rounded-sm text-primary-foreground text-sm tracking-widest uppercase transition-opacity hover:opacity-90"
                        style={{ background: "var(--primary)" }}
                      >
                        Continuar
                      </button>
                    )}
                  </div>
                )}
              </motion.div>
            )}
            </AnimatePresence>

            {/* Step: Confirm */}
            <AnimatePresence mode="wait">
            {step === "confirm" && (
              <motion.div
                key="confirm"
                className="px-4"
                style={{ transformPerspective: 1200 }}
                initial={shouldReduceMotion ? false : { opacity: 0, rotateY: 10, x: 24 }}
                animate={{ opacity: 1, rotateY: 0, x: 0 }}
                exit={shouldReduceMotion ? undefined : { opacity: 0, rotateY: -10, x: -24 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              >
                <button onClick={() => setStep("date")} className="flex items-center gap-1 text-muted-foreground text-sm mb-4 hover:text-foreground transition-colors">
                  <ChevronLeft size={16} /> voltar
                </button>
                <p className="text-xs tracking-widest uppercase text-muted-foreground mb-1">Passo 4</p>
                <h2
                  className="text-2xl text-foreground mb-6"
                  style={{ fontFamily: "'Cormorant', serif", fontWeight: 400 }}
                >
                  Confirmar agendamento
                </h2>

                <div className="bg-card border border-border rounded-sm overflow-hidden mb-5">
                  <div className="p-4 border-b border-border">
                    <p className="text-xs tracking-widest uppercase text-muted-foreground mb-3">Resumo</p>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Serviço</span>
                        <span className="text-sm font-medium text-foreground">{booking.service?.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Profissional</span>
                        <span className="text-sm font-medium text-foreground">{booking.professional?.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Data</span>
                        <span className="text-sm font-medium text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>
                          {booking.date?.day}/{(booking.date?.month ?? 0) + 1}/{booking.date?.year}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Horário</span>
                        <span className="text-sm font-medium text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>
                          {booking.time}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Duração</span>
                        <span className="text-sm font-medium text-foreground">{booking.service?.duration}</span>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 flex justify-between items-center" style={{ background: "var(--secondary)" }}>
                    <span className="text-sm text-muted-foreground">Total</span>
                    <span className="text-lg font-medium" style={{ color: "var(--primary)", fontFamily: "'Cormorant', serif" }}>
                      {booking.service?.price}
                    </span>
                  </div>
                </div>

                <div className="bg-card border border-border rounded-sm p-4 mb-6">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Ao confirmar, você concorda com nossa política de cancelamento. Cancelamentos com menos de 24h de antecedência estão sujeitos à cobrança de 50% do valor.
                  </p>
                </div>

                {error && (
                  <div className="mb-4 p-3 rounded-sm bg-red-50 border border-red-200 text-red-600 text-sm">
                    {error}
                  </div>
                )}
                <button
                  onClick={handleConfirm}
                  disabled={isSubmitting}
                  className="w-full py-4 rounded-sm text-primary-foreground text-sm tracking-widest uppercase transition-opacity hover:opacity-90 disabled:opacity-50"
                  style={{ background: "var(--primary)" }}
                >
                  {isSubmitting ? "Confirmando..." : "Confirmar Agendamento"}
                </button>
              </motion.div>
            )}
            </AnimatePresence>

            {/* Step: Success */}
            <AnimatePresence mode="wait">
            {step === "success" && (
              <motion.div
                key="success"
                className="px-4 flex flex-col items-center text-center pt-10"
                initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              >
                <motion.div
                  className="w-16 h-16 rounded-full flex items-center justify-center mb-6"
                  style={{ background: "var(--secondary)" }}
                  initial={shouldReduceMotion ? false : { scale: 0, rotate: -90 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ duration: 0.5, delay: 0.15, ease: [0.34, 1.56, 0.64, 1] }}
                >
                  <Check size={28} style={{ color: "var(--primary)" }} />
                </motion.div>
                <p className="text-xs tracking-widest uppercase text-muted-foreground mb-2">Agendamento confirmado</p>
                <h2
                  className="text-3xl text-foreground mb-3"
                  style={{ fontFamily: "'Cormorant', serif", fontWeight: 300 }}
                >
                  Até breve!
                </h2>
                <p className="text-sm text-muted-foreground mb-2">
                  {booking.service?.name} com {booking.professional?.name}
                </p>
                <p
                  className="text-sm mb-2"
                  style={{ fontFamily: "'DM Mono', monospace", color: "var(--accent)" }}
                >
                  {booking.date?.day}/{(booking.date?.month ?? 0) + 1}/{booking.date?.year} · {booking.time}
                </p>
                {(viewingBusiness?.address || myBusiness?.address) ? (
                  <p className="text-xs text-muted-foreground mb-10 max-w-xs">
                    {viewingBusiness?.address || myBusiness?.address}
                  </p>
                ) : (
                  <div className="mb-8" />
                )}
                <button
                  onClick={() => { resetBooking(); setActiveTab("appointments"); }}
                  className="w-full py-4 rounded-sm text-primary-foreground text-sm tracking-widest uppercase mb-3 transition-opacity hover:opacity-90"
                  style={{ background: "var(--primary)" }}
                >
                  Ver Agendamentos
                </button>
                <button
                  onClick={() => { resetBooking(); setActiveTab("home"); }}
                  className="w-full py-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Voltar ao início
                </button>
              </motion.div>
            )}
            </AnimatePresence>
          </div>
        )}

        {/* APPOINTMENTS */}
        {activeTab === "appointments" && (
          <div className="px-4 pb-28">
            <p className="text-xs tracking-widest uppercase text-muted-foreground mb-1 pt-2">Meus</p>
            <h2
              className="text-2xl text-foreground mb-6"
              style={{ fontFamily: "'Cormorant', serif", fontWeight: 400 }}
            >
              Agendamentos
            </h2>

            {paymentReturnPending && (
              <div className="mb-6 p-3 rounded-sm border text-sm flex items-start justify-between gap-3" style={{ background: "var(--secondary)", borderColor: "var(--border)" }}>
                <p className="text-foreground">
                  Estamos confirmando seu pagamento. Isso pode levar alguns instantes — assim que confirmado, seu agendamento aparece aqui.
                </p>
                <button
                  onClick={() => { fetchAppointments(); setPaymentReturnPending(false); }}
                  className="shrink-0 text-xs px-3 py-1.5 rounded-sm bg-primary text-primary-foreground"
                >
                  Atualizar
                </button>
              </div>
            )}

            {/* Notifications from the studio (e.g. cancellations) */}
            {notifications.length > 0 && (
              <div className="space-y-2 mb-6">
                {notifications.map((n) => (
                  <div key={n.key} className="p-3 rounded-sm border flex items-start gap-3" style={{ background: "var(--secondary)", borderColor: "var(--border)" }}>
                    <div className="flex-1">
                      <p className="text-xs uppercase tracking-widest mb-1" style={{ color: "var(--primary)" }}>
                        Aviso do estúdio
                      </p>
                      <p className="text-sm text-foreground">{n.message}</p>
                      {n.appointment && (
                        <p className="text-xs text-muted-foreground mt-1" style={{ fontFamily: "'DM Mono', monospace" }}>
                          {n.appointment.service?.name} · {n.appointment.professional?.name} ·{" "}
                          {`${String(n.appointment.date?.day).padStart(2, "0")}/${String(n.appointment.date?.month + 1).padStart(2, "0")}`} às {n.appointment.time}
                        </p>
                      )}
                    </div>
                    <button onClick={() => dismissNotification(n.key)} className="p-1 rounded-full hover:bg-background/50 transition-colors shrink-0">
                      <X size={14} className="text-muted-foreground" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Upcoming */}
            {loadingAppts ? (
              <div className="py-10 text-center text-muted-foreground text-sm">Carregando agendamentos...</div>
            ) : (
              <div className="px-4 pb-28">
                <p className="text-xs tracking-widest uppercase text-muted-foreground mb-3">Próximos</p>
                {apptActionError && (
                  <div className="mb-3 p-3 rounded-sm bg-red-50 border border-red-200 text-red-600 text-sm">
                    {apptActionError}
                  </div>
                )}
                <div className="space-y-3 mb-8">
                  {myAppointments.length === 0 ? (
                    <div className="py-4 text-sm text-muted-foreground text-center">Nenhum agendamento encontrado.</div>
                  ) : myAppointments.map((appt) => {
                    const key = apptKey(appt);
                    return (
                    <div key={key} className="bg-card border border-border rounded-sm p-4">
                      <div className="flex justify-between items-start mb-3">
                        <p className="font-medium text-foreground">{appt.service.name}</p>
                        <span
                          className="text-xs px-2 py-0.5 rounded-full"
                          style={
                            appt.status === "aguardando_pagamento"
                              ? { background: "#fef3c7", color: "#92400e" }
                              : { background: "var(--secondary)", color: "var(--primary)" }
                          }
                        >
                          {appt.status === "aguardando_pagamento" ? "aguardando pagamento" : appt.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>{appt.professional.name}</span>
                        <span style={{ fontFamily: "'DM Mono', monospace" }}>{`${String(appt.date.day).padStart(2, "0")}/${String(appt.date.month + 1).padStart(2, "0")}/${appt.date.year}`} · {appt.time}</span>
                      </div>
                      {isOwner && appt.userEmail && (
                        <p className="text-xs text-muted-foreground mt-1">Cliente: {appt.userEmail}</p>
                      )}
                      <div className="flex justify-between items-center mt-3 pt-3 border-t border-border">
                        <span className="text-sm font-medium" style={{ color: "var(--primary)" }}>{appt.service.price}</span>
                        <div className="flex items-center gap-4">
                          {appt.status === "aguardando_pagamento" && !isOwner && (
                            <button
                              onClick={() => handleResumeCheckout(appt)}
                              disabled={resumingKey === key}
                              className="flex items-center gap-1 text-xs disabled:opacity-50 transition-colors"
                              style={{ color: "var(--primary)" }}
                            >
                              {resumingKey === key ? "abrindo..." : "continuar pagamento"}
                            </button>
                          )}
                          <button
                            onClick={() => openReschedule(appt)}
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <Clock size={12} /> {appt.paid && !isOwner ? "remarcar" : "editar"}
                          </button>
                          {(!appt.paid || isOwner) && (
                            <button
                              onClick={() => handleCancel(appt)}
                              disabled={cancelingKey === key}
                              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-red-500 transition-colors disabled:opacity-50"
                            >
                              <X size={12} /> {cancelingKey === key ? "cancelando..." : "cancelar"}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ADMIN PANEL (business owner / platform admin) */}
        {activeTab === "admin" && isOwner && (
          <AdminPanel
            businessName={profile?.businessId ? (profile?.name ? `Estúdio de ${profile.name.split(" ")[0]}` : "Meu Estúdio") : "Minha Agenda Nail"}
            businessLink={myBusiness?.slug ? `${window.location.origin}${window.location.pathname}?salao=${myBusiness.slug}` : null}
            currentSlug={myBusiness?.slug ?? null}
            onChangeSlug={updateBusinessSlug}
            currentAddress={myBusiness?.address ?? null}
            onChangeAddress={updateBusinessAddress}
            businessHours={businessHours}
            onSaveHours={updateBusinessHours}
            paymentSettings={paymentSettings}
            onSavePaymentSettings={savePaymentSettings}
            businessId={profile?.businessId ?? null}
            webhookBaseUrl={`https://${projectId}.supabase.co/functions/v1/make-server-a3611da8`}
            subscription={myBusiness?.subscription ?? null}
            onSubscribe={subscribeToPlatform}
            services={services}
            professionals={professionals}
            appointments={myAppointments}
            loadingAppts={loadingAppts}
            saveBusinessData={saveBusinessData}
            uploadPhoto={uploadPhoto}
            cancelWithMessage={cancelWithMessage}
            onComplete={completeAppointment}
            sendReminder={sendReminder}
            onReschedule={openReschedule}
            apptKey={apptKey}
          />
        )}
      </main>

      {/* Reschedule Modal */}
      {reschedulingAppt && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6" style={{ background: "rgba(42,31,26,0.45)" }}>
          <div className="w-full max-w-sm bg-background rounded-t-2xl sm:rounded-lg max-h-[90vh] overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="sticky top-0 flex items-center justify-between px-5 pt-5 pb-3" style={{ background: "var(--background)" }}>
              <div>
                <p className="text-xs tracking-widest uppercase text-muted-foreground mb-0.5">Reagendar</p>
                <h3 className="text-xl text-foreground" style={{ fontFamily: "'Cormorant', serif", fontWeight: 400 }}>
                  {reschedulingAppt.service.name}
                </h3>
              </div>
              <button onClick={closeReschedule} className="p-2 rounded-full hover:bg-secondary transition-colors">
                <X size={18} className="text-muted-foreground" />
              </button>
            </div>

            <div className="px-5 pb-6">
              <p className="text-xs text-muted-foreground mb-4">
                com {reschedulingAppt.professional.name}
              </p>

              {apptActionError && (
                <div className="mb-4 p-3 rounded-sm bg-red-50 border border-red-200 text-red-600 text-sm">
                  {apptActionError}
                </div>
              )}

              {/* Calendar */}
              <div className="bg-card border border-border rounded-sm p-4 mb-5">
                <div className="flex items-center justify-between mb-4">
                  <button
                    onClick={() => {
                      if (reschedMonth === 0) { setReschedMonth(11); setReschedYear(y => y - 1); }
                      else setReschedMonth(m => m - 1);
                    }}
                    className="p-1 rounded hover:bg-secondary transition-colors"
                  >
                    <ChevronLeft size={16} className="text-muted-foreground" />
                  </button>
                  <p className="text-foreground" style={{ fontFamily: "'Cormorant', serif", fontSize: "1.1rem" }}>
                    {MONTHS[reschedMonth]} {reschedYear}
                  </p>
                  <button
                    onClick={() => {
                      if (reschedMonth === 11) { setReschedMonth(0); setReschedYear(y => y + 1); }
                      else setReschedMonth(m => m + 1);
                    }}
                    className="p-1 rounded hover:bg-secondary transition-colors"
                  >
                    <ChevronRight size={16} className="text-muted-foreground" />
                  </button>
                </div>

                <div className="grid grid-cols-7 gap-0 mb-2">
                  {WEEKDAYS.map(d => (
                    <div key={d} className="text-center text-xs text-muted-foreground py-1" style={{ fontFamily: "'DM Mono', monospace" }}>
                      {d}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-0">
                  {Array.from({ length: getFirstDayOfMonth(reschedYear, reschedMonth) }).map((_, i) => <div key={`re${i}`} />)}
                  {Array.from({ length: getDaysInMonth(reschedYear, reschedMonth) }).map((_, i) => {
                    const day = i + 1;
                    const d = new Date(reschedYear, reschedMonth, day);
                    const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                    const past = d < t;
                    const selected = reschedDate?.day === day && reschedDate?.month === reschedMonth && reschedDate?.year === reschedYear;
                    return (
                      <button
                        key={day}
                        disabled={past}
                        onClick={() => { setReschedDate({ day, month: reschedMonth, year: reschedYear }); setReschedTime(null); }}
                        className="aspect-square flex items-center justify-center text-sm rounded-sm transition-colors"
                        style={{
                          background: selected ? "var(--primary)" : "transparent",
                          color: past ? "var(--muted-foreground)" : selected ? "var(--primary-foreground)" : "var(--foreground)",
                          opacity: past ? 0.4 : 1,
                        }}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Time slots */}
              {reschedDate && (
                <div className="mb-5">
                  <p className="text-sm font-medium text-foreground mb-3">Horários disponíveis</p>
                  {(() => {
                    const dayTimes = timesForDay(reschedDate, businessHours);
                    if (dayTimes.length === 0) {
                      return <p className="text-sm text-muted-foreground">Fechado neste dia. Escolha outra data.</p>;
                    }
                    return (
                      <div className="grid grid-cols-4 gap-2">
                        {dayTimes.map(t => {
                          const taken = isSlotTakenFor(reschedulingAppt.professional.id, reschedDate, t, apptKey(reschedulingAppt));
                          return (
                            <button
                              key={t}
                              disabled={taken}
                              onClick={() => setReschedTime(t)}
                              className="py-2 rounded-sm border transition-colors"
                              style={{
                                background: reschedTime === t ? "var(--primary)" : taken ? "var(--secondary)" : "var(--card)",
                                color: reschedTime === t ? "var(--primary-foreground)" : taken ? "var(--muted-foreground)" : "var(--foreground)",
                                borderColor: reschedTime === t ? "var(--primary)" : taken ? "transparent" : "var(--border)",
                                opacity: taken ? 0.5 : 1,
                                fontFamily: "'DM Mono', monospace",
                                fontSize: "0.75rem",
                              }}
                            >
                              {t}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              )}

              <button
                onClick={handleReschedule}
                disabled={reschedLoading || !reschedDate || !reschedTime}
                className="w-full py-4 rounded-sm text-primary-foreground text-sm tracking-widest uppercase transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ background: "var(--primary)" }}
              >
                {reschedLoading ? "Salvando..." : "Salvar Alterações"}
              </button>
              <button
                onClick={closeReschedule}
                className="w-full py-3 mt-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Nav */}
      <nav
        className="shrink-0 fixed bottom-0 left-0 right-0 flex border-t border-border"
        style={{ background: "var(--background)", paddingBottom: "env(safe-area-inset-bottom, 16px)" }}
      >
        {([
          { key: "home", label: "Início" },
          { key: "book", label: "Agendar" },
          { key: "appointments", label: isOwner ? "Agenda" : "Meus Agend." },
          ...(isOwner ? [{ key: "admin", label: "Painel" }] : []),
        ] as const).map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); if (tab.key === "book") resetBooking(); }}
            className="flex-1 py-4 flex flex-col items-center gap-1 transition-colors"
            style={{ color: activeTab === tab.key ? "var(--primary)" : "var(--muted-foreground)" }}
          >
            {tab.key === "home" && <Sparkles size={18} />}
            {tab.key === "book" && <Scissors size={18} />}
            {tab.key === "appointments" && <Clock size={18} />}
            {tab.key === "admin" && <LayoutDashboard size={18} />}
            <span
              className="text-xs"
              style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: "0.65rem",
                fontWeight: activeTab === tab.key ? 500 : 400,
              }}
            >
              {tab.label}
            </span>
          </button>
        ))}
      </nav>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppInner />
    </ErrorBoundary>
  );
}