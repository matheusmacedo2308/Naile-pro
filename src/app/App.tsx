import { useState, useEffect, Component } from "react";
import { motion, useReducedMotion, AnimatePresence } from "motion/react";
import { createClient } from "@supabase/supabase-js";
import { projectId, publicAnonKey } from "../../utils/supabase/info";
import { ChevronLeft, ChevronRight, Clock, Star, Instagram, Phone, MapPin, X, Check, Sparkles, Scissors, Palette, Gem, LayoutDashboard, CreditCard as CreditCardIcon } from "lucide-react";
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
// Use a global variable to prevent multiple GoTrueClient instances during HMR
const supabase = (globalThis as any).__supabaseClient ??= createClient(`https://${projectId}.supabase.co`, publicAnonKey, {
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

const DEFAULT_PROFESSIONALS = [
  { id: 1, name: "Ana Luiza", specialty: "Nail Art & Gel", rating: 4.9, reviews: 128, img: "photo-1531746020798-e6953c6e8e04" },
  { id: 2, name: "Camila Torres", specialty: "Acrílico & Escultura", rating: 4.8, reviews: 94, img: "photo-1494790108377-be9c29b29330" },
  { id: 3, name: "Fernanda Dias", specialty: "Manicure Clássica", rating: 4.9, reviews: 211, img: "photo-1438761681033-6461ffad8d80" },
];

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
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts += 1;
      const res = await authedFetch(`${API_URL}?businessId=${WORKSPACE_ID}`);
      const data = await res.json().catch(() => ({}));
      const appts = data.appointments || [];
      const stillPending = appts.some((a: any) => a.status === "aguardando_pagamento");
      if (!stillPending) {
        await fetchAppointments();
        // The most recently paid appointment — that's the one we just
        // finished paying for.
        const justPaid = [...appts]
          .filter((a: any) => a.paid && a.paidAt)
          .sort((a: any, b: any) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime())[0];
        setConfirmedAppt(justPaid || null);
        setPaymentReturnPending(false);
        setPaymentJustConfirmed(true);
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

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);
    setAuthNotice(null);
    try {
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

  const [resumingPaymentKey, setResumingPaymentKey] = useState<string | null>(null);
  const resumePayment = async (appt: any) => {
    const key = apptKey(appt);
    setResumingPaymentKey(key);
    setApptActionError(null);
    try {
      const res = await authedFetch(`${SERVER_URL}/appointments/resume-payment`, {
        method: "POST",
        body: JSON.stringify({ key, returnUrl: window.location.href }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao abrir o pagamento.");
      if (data.checkoutUrl) window.location.href = data.checkoutUrl;
    } catch (err: any) {
      setApptActionError(err.message || "Erro ao abrir o pagamento.");
      setResumingPaymentKey(null);
    }
  };

  const [completingKey, setCompletingKey] = useState<string | null>(null);
  const completeAppointment = async (appt: any) => {
    const key = apptKey(appt);
    setCompletingKey(key);
    setApptActionError(null);
    try {
      const res = await authedFetch(`${SERVER_URL}/appointments/complete`, {
        method: "POST",
        body: JSON.stringify({ key }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao concluir.");
      await fetchAppointments();
    } catch (err: any) {
      setApptActionError(err.message || "Erro ao concluir agendamento.");
    } finally {
      setCompletingKey(null);
    }
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
      <motion.div 
        className="size-full flex flex-col items-center justify-center p-6 overflow-y-auto relative" 
        style={{ fontFamily: "'DM Sans', sans-serif", background: "var(--background)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
      >
        {/* Abstract 3D/Editorial background shapes */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
          <motion.div 
            className="absolute -top-20 -right-20 w-96 h-96 rounded-full blur-3xl"
            style={{ background: "var(--primary)" }}
            animate={{ 
              x: [0, 20, 0], 
              y: [0, 30, 0],
              scale: [1, 1.1, 1] 
            }}
            transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
          />
          <motion.div 
            className="absolute -bottom-20 -left-20 w-80 h-80 rounded-full blur-3xl"
            style={{ background: "var(--accent)" }}
            animate={{ 
              x: [0, -20, 0], 
              y: [0, -30, 0],
              scale: [1, 1.2, 1] 
            }}
            transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
          />
        </div>

        <motion.div 
          className="w-full max-w-sm py-8 relative z-10"
          style={{ transformPerspective: 1200 }}
          initial={{ opacity: 0, rotateX: 15, y: 30 }}
          animate={{ opacity: 1, rotateX: 0, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="text-center mb-10">
            <motion.p 
              className="text-[10px] tracking-[0.4em] uppercase text-accent mb-3"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.6 }}
            >
              Plataforma de Agendamento
            </motion.p>
            <motion.h1 
              className="text-5xl mb-3 text-foreground" 
              style={{ fontFamily: "'Cormorant', serif", fontStyle: "italic", fontWeight: 300, lineHeight: 1.1 }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.6 }}
            >
              {viewingBusiness?.businessName || "Nailê Pro"}
            </motion.h1>
            <motion.p 
              className="text-sm text-muted-foreground"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.6 }}
            >
              {authMode === "login"
                ? "Acesse seu refúgio de beleza"
                : authMode === "forgot"
                ? "Recupere seu acesso"
                : accountType === "business"
                ? "Eleve seu estúdio a outro nível"
                : "Seu perfil exclusivo"}
            </motion.p>
          </div>

          {viewingBusinessError && (
            <div className="mb-6 p-4 border border-border/50 text-sm bg-secondary/80 backdrop-blur-md rounded-none text-foreground text-center">
              {viewingBusinessError}
            </div>
          )}

          {/* Account type toggle */}
          {authMode === "register" && !viewingBusiness && (
            <motion.div 
              className="flex gap-2 p-1 mb-8 bg-transparent border-b border-border pb-4"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              {([
                { key: "client", label: "Sou Cliente" },
                { key: "business", label: "Sou Empresa" },
              ] as const).map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setAccountType(opt.key)}
                  className="flex-1 py-3 text-[11px] tracking-widest uppercase transition-all duration-300 relative"
                  style={{
                    color: accountType === opt.key ? "var(--foreground)" : "var(--muted-foreground)",
                  }}
                >
                  {opt.label}
                  {accountType === opt.key && (
                    <motion.div 
                      layoutId="activeTabIndicator"
                      className="absolute bottom-[-17px] left-0 right-0 h-[1px] bg-foreground"
                    />
                  )}
                </button>
              ))}
            </motion.div>
          )}

          <form onSubmit={handleAuth} className="space-y-5">
            <AnimatePresence mode="popLayout">
              {authError && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="p-4 bg-red-50/50 backdrop-blur-sm border border-red-200 text-red-600 text-[13px] text-center"
                >
                  {authError}
                </motion.div>
              )}
              {authNotice && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="p-4 border border-border/50 text-[13px] bg-secondary/80 backdrop-blur-sm text-foreground text-center"
                >
                  {authNotice}
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence mode="popLayout">
              {authMode === "register" && accountType === "business" && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="space-y-1"
                >
                  <label className="block text-[10px] uppercase tracking-[0.2em] text-muted-foreground ml-1">Nome do Estúdio</label>
                  <input type="text" required value={businessName} onChange={(e) => setBusinessName(e.target.value)} className={inputClass} placeholder="Ex: Studio Bella Unhas" />
                </motion.div>
              )}

              {authMode === "register" && accountType === "business" && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="space-y-1 mt-5"
                >
                  <label className="block text-[10px] uppercase tracking-[0.2em] text-muted-foreground ml-1">CPF ou CNPJ</label>
                  <input type="text" required value={cpfCnpj} onChange={(e) => setCpfCnpj(e.target.value)} className={inputClass} placeholder="000.000.000-00" />
                </motion.div>
              )}

              {authMode === "register" && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="space-y-1 mt-5"
                >
                  <label className="block text-[10px] uppercase tracking-[0.2em] text-muted-foreground ml-1">
                    {accountType === "business" ? "Seu Nome (responsável)" : "Nome completo"}
                  </label>
                  <input type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputClass} placeholder="Seu nome" />
                </motion.div>
              )}

              {authMode === "register" && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="space-y-1 mt-5"
                >
                  <label className="block text-[10px] uppercase tracking-[0.2em] text-muted-foreground ml-1">
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
                </motion.div>
              )}

              <motion.div layout className="space-y-1 mt-5">
                <label className="block text-[10px] uppercase tracking-[0.2em] text-muted-foreground ml-1">Email</label>
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} placeholder="seu@email.com" />
              </motion.div>

              {authMode !== "forgot" && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="space-y-1 mt-5"
                >
                  <label className="block text-[10px] uppercase tracking-[0.2em] text-muted-foreground ml-1">Senha</label>
                  <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} placeholder="••••••••" />
                </motion.div>
              )}
            </AnimatePresence>

            {authMode === "forgot" && (
              <motion.p 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="text-xs text-muted-foreground leading-relaxed text-center py-2"
              >
                Enviaremos um link seguro para o seu email. Ao clicar nele, você poderá definir uma nova senha.
              </motion.p>
            )}

            {authMode === "login" && (
              <motion.div layout className="text-right -mt-2">
                <button
                  type="button"
                  onClick={() => { setAuthMode("forgot"); setAuthError(null); setAuthNotice(null); setPassword(""); }}
                  className="text-[11px] tracking-widest text-muted-foreground hover:text-foreground transition-colors uppercase"
                >
                  Esqueci a senha
                </button>
              </motion.div>
            )}

            <motion.button
              type="submit"
              disabled={authLoading}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full py-5 mt-6 rounded-none text-primary-foreground text-[11px] tracking-[0.2em] uppercase transition-all duration-300 hover:shadow-xl disabled:opacity-50 border border-primary"
              style={{ background: "var(--primary)" }}
            >
              {authLoading
                ? "Aguarde..."
                : authMode === "login"
                ? "Acessar Plataforma"
                : authMode === "forgot"
                ? "Enviar Link"
                : accountType === "business"
                ? "Criar Estúdio"
                : "Criar Conta"}
            </motion.button>
          </form>

          {authMode === "register" && accountType === "business" && (
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground text-center mt-6 leading-relaxed">
              14 dias grátis · Sem cartão
            </p>
          )}

          <div className="mt-8 text-center">
            <button
              type="button"
              onClick={() => { setAuthMode(m => m === "login" ? "register" : "login"); setAuthError(null); setAuthNotice(null); setPassword(""); }}
              className="text-[11px] tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors pb-1 border-b border-muted-foreground/30 hover:border-foreground"
            >
              {authMode === "login"
                ? "Primeira vez? Cadastre-se"
                : authMode === "forgot"
                ? "Voltar para o login"
                : "Já tem conta? Entre aqui"}
            </button>
          </div>

          <div className="mt-12 text-center border-t border-border/50 pt-8 opacity-50 hover:opacity-100 transition-opacity duration-500">
            <p className="text-[9px] tracking-widest uppercase text-muted-foreground mb-2">Acesso Administrador</p>
            <p className="text-xs text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>admin@maisonnaile.com</p>
            <p className="text-xs text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>Naile@Admin2026</p>
          </div>
        </motion.div>
      </motion.div>
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
      <header className="shrink-0 px-6 pt-10 pb-6 flex items-center justify-between z-10 bg-background/80 backdrop-blur-md sticky top-0 border-b border-border/30">
        <div>
          <p className="text-[9px] tracking-[0.2em] uppercase mb-1" style={{ color: "var(--accent)" }}>
            {isAdmin ? "Administração" : profile?.businessId ? "Meu Estúdio" : (viewingBusiness?.businessName || "Minha Agenda Nail")}
          </p>
          <h1
            className="text-3xl text-foreground leading-none"
            style={{ fontFamily: "'Cormorant', serif", fontStyle: "italic", fontWeight: 300, letterSpacing: "0.02em" }}
          >
            {profile?.name?.split(" ")[0] ? `Olá, ${profile.name.split(" ")[0]}` : "Minha Agenda"}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <button className="p-2 rounded-full border border-border/50 hover:bg-secondary transition-all hover:scale-105">
            <Instagram size={14} className="text-muted-foreground" />
          </button>
          <button className="p-2 rounded-full border border-border/50 hover:bg-secondary transition-all hover:scale-105">
            <Phone size={14} className="text-muted-foreground" />
          </button>
          <button onClick={handleLogout} className="p-2 text-[10px] text-muted-foreground hover:text-foreground transition-colors uppercase tracking-[0.1em] underline decoration-muted-foreground/30 underline-offset-4">
            Sair
          </button>
        </div>
      </header>

      {profileLoadFailed && (
        <div className="shrink-0 mx-6 mt-4 p-4 text-sm flex items-center justify-between gap-3" style={{ background: "#fef3c7", border: "1px solid #fde68a", color: "#92400e" }}>
          <p style={{ fontFamily: "'DM Sans', sans-serif" }}>Não conseguimos carregar seus dados agora.</p>
          <button
            onClick={() => { setProfileLoadFailed(false); loadProfile(); }}
            className="shrink-0 text-[10px] uppercase tracking-widest px-4 py-2 bg-primary text-primary-foreground transition-all hover:opacity-90"
          >
            Tentar de novo
          </button>
        </div>
      )}

      {/* Content */}
      <main 
        className="flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ perspective: "1000px" }}
      >
        {/* HOME */}
        {activeTab === "home" && (
          <div className="pb-28">
            {/* Hero */}
            <motion.div
              className="mx-4 overflow-hidden relative mb-12 border-b border-border pb-8"
              style={{ transformPerspective: 1000, transformOrigin: "top center" }}
              initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="relative w-full h-[400px] mb-6 overflow-hidden" style={{ borderRadius: '0' }}>
                <img
                  src="https://images.unsplash.com/photo-1522337660859-02fbefca4702?w=800&h=600&fit=crop&auto=format"
                  alt="Nail art elegante"
                  className="w-full h-full object-cover scale-105"
                  style={{ filter: "brightness(0.85) contrast(1.1) saturate(0.9)" }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[var(--background)] to-transparent opacity-80" />
              </div>
              <div className="relative text-center px-4 -mt-24 z-10">
                <p className="text-[10px] tracking-[0.3em] uppercase mb-4" style={{ color: "var(--accent)" }}>O Refúgio do Cuidado</p>
                <h2
                  className="text-5xl leading-[0.9] mb-4 text-foreground"
                  style={{ fontFamily: "'Cormorant', serif", fontStyle: "italic", fontWeight: 300 }}
                >
                  Arte nas suas mãos,<br/>
                  <span style={{ fontStyle: "normal" }}>cuidado em cada detalhe.</span>
                </h2>
                <button
                  onClick={() => { setActiveTab("book"); resetBooking(); }}
                  className="mt-6 px-10 py-4 text-[11px] tracking-widest uppercase transition-all duration-500 hover:scale-105 active:scale-95"
                  style={{ 
                    background: "var(--primary)", 
                    color: "var(--primary-foreground)", 
                    fontFamily: "'DM Sans', sans-serif", 
                    fontWeight: 500,
                    borderRadius: "0",
                    border: "1px solid var(--primary)"
                  }}
                >
                  Agendar Horário
                </button>
              </div>
            </motion.div>

            {/* Quick Book */}
            

            {/* Services preview */}
            <div className="px-4 mb-14">
              <div className="flex items-baseline justify-between mb-6 border-b border-border pb-3">
                <h2 className="text-xl text-foreground" style={{ fontFamily: "'Cormorant', serif" }}>Menu de Serviços</h2>
                <button
                  className="text-[10px] tracking-[0.1em] uppercase uppercase hover:opacity-70 transition-opacity"
                  style={{ color: "var(--accent)" }}
                  onClick={() => { setActiveTab("book"); resetBooking(); }}
                >
                  ver todos
                </button>
              </div>
              <div className="flex flex-col">
                {services.map((cat, i) => {
                  return (
                    <motion.div
                      key={cat.id}
                      className="py-5 border-b border-border/50 cursor-pointer flex justify-between items-center group"
                      initial={shouldReduceMotion ? false : { opacity: 0, x: -10 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.5, delay: i * 0.1 }}
                      onClick={() => { setActiveTab("book"); resetBooking(); }}
                    >
                      <div>
                        <p className="text-lg text-foreground group-hover:italic transition-all duration-300" style={{ fontFamily: "'Cormorant', serif" }}>{cat.category}</p>
                        <p className="text-xs text-muted-foreground mt-1" style={{ fontFamily: "'DM Sans', sans-serif" }}>{cat.items.length} {cat.items.length === 1 ? "opção" : "opções"}</p>
                      </div>
                      <div className="w-8 h-8 rounded-full border border-border flex items-center justify-center group-hover:bg-primary group-hover:border-primary group-hover:text-primary-foreground transition-all duration-500">
                        <span className="text-sm font-light">→</span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* Team */}
            {professionals.length > 0 && (
              <div className="mb-14">
                <div className="px-4 mb-6 border-b border-border pb-3 mx-4 flex items-baseline justify-between">
                  <h2 className="text-xl text-foreground" style={{ fontFamily: "'Cormorant', serif" }}>Nossos Especialistas</h2>
                </div>
                <div className="flex gap-4 px-4 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden pb-4 snap-x" style={{ transformPerspective: 1000 }}>
                  {professionals.map((p, i) => (
                    <motion.div
                      key={p.id}
                      className="shrink-0 w-44 snap-center group cursor-pointer"
                      initial={shouldReduceMotion ? false : { opacity: 0, y: 14 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, margin: "-40px" }}
                      transition={{ duration: 0.6, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
                    >
                      <motion.div
                        className="w-44 h-56 overflow-hidden mb-4 bg-secondary relative"
                        style={{ borderRadius: "0" }}
                      >
                        <img
                          src={photoUrl(p.img, 400)}
                          alt={p.name}
                          className="w-full h-full object-cover filter grayscale group-hover:grayscale-0 transition-all duration-700"
                        />
                      </motion.div>
                      <p className="text-lg text-foreground mb-0.5" style={{ fontFamily: "'Cormorant', serif" }}>{p.name}</p>
                      <p className="text-[10px] tracking-widest uppercase text-muted-foreground mb-2">{p.specialty}</p>
                      <div className="flex items-center gap-1">
                        <Star size={10} fill="currentColor" className="text-accent" />
                        <span className="text-[10px]" style={{ fontFamily: "'DM Mono', monospace" }}>{p.rating}</span>
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
            <div className="px-4 mb-10 pt-6">
              <div className="flex items-center gap-1 border-b border-border/50 pb-4">
                {(["services", "professional", "date", "confirm"] as Step[]).map((s, i) => (
                  <div key={s} className="flex-1">
                    <div
                      className="h-[1px] w-full transition-all duration-500"
                      style={{
                        background: ["services", "professional", "date", "confirm", "success"].indexOf(step) >= i ? "var(--primary)" : "var(--border)",
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
                <p className="text-[10px] tracking-[0.2em] uppercase mb-2" style={{ color: "var(--accent)" }}>Capítulo 1</p>
                <h2
                  className="text-4xl text-foreground mb-8"
                  style={{ fontFamily: "'Cormorant', serif", fontStyle: "italic", fontWeight: 300 }}
                >
                  Escolha seu cuidado
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
                      className="bg-transparent border-b p-4 cursor-pointer transition-all hover:bg-secondary/30 active:scale-[0.99]"
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
                <p className="text-[10px] tracking-[0.2em] uppercase mb-2" style={{ color: "var(--accent)" }}>Capítulo 2</p>
                <h2
                  className="text-4xl text-foreground mb-8"
                  style={{ fontFamily: "'Cormorant', serif", fontStyle: "italic", fontWeight: 300 }}
                >
                  Sua especialista
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
                <p className="text-[10px] tracking-[0.2em] uppercase mb-2" style={{ color: "var(--accent)" }}>Capítulo 3</p>
                <h2
                  className="text-4xl text-foreground mb-8"
                  style={{ fontFamily: "'Cormorant', serif", fontStyle: "italic", fontWeight: 300 }}
                >
                  O momento perfeito
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
                          className="aspect-square flex items-center justify-center text-sm transition-all duration-300"
                          style={{
                            background: selected ? "var(--primary)" : "transparent",
                            borderRadius: selected ? "50%" : "0",
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
                              className="py-3 text-sm border transition-all duration-300 hover:border-primary"
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
                <p className="text-[10px] tracking-[0.2em] uppercase mb-2" style={{ color: "var(--accent)" }}>Capítulo 4</p>
                <h2
                  className="text-4xl text-foreground mb-8"
                  style={{ fontFamily: "'Cormorant', serif", fontStyle: "italic", fontWeight: 300 }}
                >
                  Quase lá
                </h2>

                <div className="bg-transparent border border-border overflow-hidden mb-8">
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
                  <div className="p-6 flex justify-between items-center border-t border-border" style={{ background: "var(--secondary)" }}>
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
            <p className="text-[10px] tracking-[0.2em] uppercase mb-2 pt-6" style={{ color: "var(--accent)" }}>Histórico</p>
            <h2
              className="text-4xl text-foreground mb-10"
              style={{ fontFamily: "'Cormorant', serif", fontStyle: "italic", fontWeight: 300 }}
            >
              Meus Agendamentos
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
                    <div key={key} className="bg-transparent border-b border-border/50 pb-6 mb-6">
                      <div className="flex justify-between items-start mb-3">
                        <p className="font-medium text-foreground">{appt.service.name}</p>
                        <span
                          className="text-[10px] tracking-widest uppercase px-3 py-1"
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
                              onClick={() => resumePayment(appt)}
                              disabled={resumingPaymentKey === key}
                              className="flex items-center gap-1 text-xs disabled:opacity-50"
                              style={{ color: "var(--primary)" }}
                            >
                              <CreditCardIcon size={12} /> {resumingPaymentKey === key ? "abrindo..." : "ir para pagamento"}
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
            completingKey={completingKey}
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
                        className="aspect-square flex items-center justify-center text-sm transition-all duration-300"
                        style={{
                          background: selected ? "var(--primary)" : "transparent",
                            borderRadius: selected ? "50%" : "0",
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
                              className="py-3 border transition-all duration-300 hover:border-primary"
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
        className="shrink-0 fixed bottom-6 left-1/2 -translate-x-1/2 flex border border-border/50 shadow-2xl backdrop-blur-md z-50 overflow-hidden"
        style={{ background: "rgba(253, 251, 247, 0.85)", borderRadius: "100px", padding: "4px 8px" }}
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
            className="px-5 py-3 flex items-center gap-2 transition-all duration-300 rounded-full"
            style={{ 
              color: activeTab === tab.key ? "var(--primary-foreground)" : "var(--muted-foreground)",
              background: activeTab === tab.key ? "var(--primary)" : "transparent"
            }}
          >
            {tab.key === "home" && <Sparkles size={16} />}
            {tab.key === "book" && <Scissors size={16} />}
            {tab.key === "appointments" && <Clock size={16} />}
            {tab.key === "admin" && <LayoutDashboard size={16} />}
            {activeTab === tab.key && (
              <span
                className="text-[10px] tracking-widest uppercase"
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontWeight: 500,
                }}
              >
                {tab.label}
              </span>
            )}
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