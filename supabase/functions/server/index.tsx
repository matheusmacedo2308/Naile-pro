import { Hono } from 'npm:hono';
import { cors } from 'npm:hono/cors';
import { logger } from 'npm:hono/logger';
import { createClient } from 'npm:@supabase/supabase-js@2';
import * as kv from './kv_store.tsx';

const app = new Hono().basePath('/make-server-a3611da8');

app.use('*', logger(console.log));
app.use('*', cors());

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const PLATFORM_ADMIN_EMAIL = 'admin@maisonnaile.com';
const PLATFORM_ADMIN_PASSWORD = 'Naile@Admin2026';
const PHOTO_BUCKET = 'make-a3611da8-photos';

// Atomically reserves an appointment slot: unlike kv.set (which upserts and
// would silently let a second, near-simultaneous request overwrite the
// first), this does a plain INSERT and relies on the table's primary key
// constraint on `key` to reject a second insert for the same slot. This is
// what actually closes the double-booking race — the earlier
// check-then-write pattern (kv.get then kv.set) had a real gap if two
// requests for the exact same slot landed at nearly the same instant.
async function reserveAppointmentSlot(key: string, value: any): Promise<{ reserved: boolean }> {
  const { error } = await supabase.from('kv_store_a3611da8').insert({ key, value });
  if (error) {
    // Postgres unique_violation — someone else grabbed this slot first.
    if ((error as any).code === '23505') return { reserved: false };
    throw error;
  }
  return { reserved: true };
}

// Default catalog seeded for a business the first time its data is requested.
const DEFAULT_SERVICES = [
  { id: 1, category: 'Manicure', items: [
    { id: 'm1', name: 'Manicure Simples', duration: '45 min', price: 'R$ 45', description: 'Cutícula, limagem e esmaltação.' },
    { id: 'm2', name: 'Manicure em Gel', duration: '1h 30min', price: 'R$ 120', description: 'Aplicação de gel com longa duração.' },
    { id: 'm3', name: 'Unhas Acrílicas', duration: '2h', price: 'R$ 180', description: 'Modelagem completa em acrílico.' },
  ] },
  { id: 2, category: 'Pedicure', items: [
    { id: 'p1', name: 'Pedicure Clássica', duration: '1h', price: 'R$ 60', description: 'Tratamento completo dos pés.' },
    { id: 'p2', name: 'Pedicure Spa', duration: '1h 30min', price: 'R$ 95', description: 'Esfoliação, hidratação e esmaltação.' },
  ] },
  { id: 3, category: 'Nail Art', items: [
    { id: 'n1', name: 'Nail Art Básica', duration: '30 min', price: 'R$ 35', description: 'Desenhos simples e delicados.' },
    { id: 'n2', name: 'Nail Art Completa', duration: '1h', price: 'R$ 80', description: 'Designs elaborados e personalizados.' },
    { id: 'n3', name: 'Nail Art 3D', duration: '1h 30min', price: 'R$ 130', description: 'Arte em relevo com pedras e texturas.' },
  ] },
  { id: 4, category: 'Tratamentos', items: [
    { id: 't1', name: 'Hidratação Profunda', duration: '45 min', price: 'R$ 55', description: 'Hidratação intensiva para cutículas.' },
    { id: 't2', name: 'Blindagem', duration: '1h', price: 'R$ 90', description: 'Fortalecimento das unhas naturais.' },
  ] },
];

// New businesses start with no team at all — the owner adds their real
// professional from the Painel, instead of inheriting fake example names.
const DEFAULT_PROFESSIONALS: any[] = [];

// Default weekly hours — Mon–Sat 9h–18h with a lunch break, closed Sunday.
// Keyed by JS's Date.getDay() (0 = Sunday .. 6 = Saturday).
const DEFAULT_BUSINESS_HOURS = {
  0: { open: false },
  1: { open: true, start: '09:00', end: '18:00', breakStart: '12:00', breakEnd: '13:00' },
  2: { open: true, start: '09:00', end: '18:00', breakStart: '12:00', breakEnd: '13:00' },
  3: { open: true, start: '09:00', end: '18:00', breakStart: '12:00', breakEnd: '13:00' },
  4: { open: true, start: '09:00', end: '18:00', breakStart: '12:00', breakEnd: '13:00' },
  5: { open: true, start: '09:00', end: '18:00', breakStart: '12:00', breakEnd: '13:00' },
  6: { open: true, start: '09:00', end: '13:00' },
};

// Idempotently ensure the private photo bucket exists.
async function ensurePhotoBucket() {
  try {
    const { data: buckets } = await supabase.storage.listBuckets();
    const exists = buckets?.some((b) => b.name === PHOTO_BUCKET);
    if (!exists) {
      await supabase.storage.createBucket(PHOTO_BUCKET, { public: false });
    }
  } catch (error) {
    console.error('Error ensuring photo bucket exists:', error);
  }
}
ensurePhotoBucket();

// Idempotently ensure the platform admin account exists with a known password.
// IMPORTANT: this runs on every cold start of the function. Calling
// admin.updateUserById with a password revokes ALL of that user's active
// sessions, even when the password value doesn't change. That was silently
// logging the admin out mid-use (e.g. while editing services), which showed
// up as "Invalid or expired session" the next time they hit Save. So we only
// touch the password the first time the account is created, never again.
async function ensureAdminAccount() {
  try {
    const existing = await findUserByEmail(PLATFORM_ADMIN_EMAIL);
    if (existing) {
      // Already exists — make sure the profile is set, but never reset the
      // password here, since that would silently kill active sessions.
      const profile = await kv.get(`profile:${existing.id}`);
      if (!profile) {
        await kv.set(`profile:${existing.id}`, {
          userId: existing.id,
          name: 'Administrador',
          email: PLATFORM_ADMIN_EMAIL,
          role: 'superadmin',
          businessId: null,
        });
      }
      return;
    }

    const { data, error } = await supabase.auth.admin.createUser({
      email: PLATFORM_ADMIN_EMAIL,
      password: PLATFORM_ADMIN_PASSWORD,
      user_metadata: { name: 'Administrador' },
      // Auto-confirm since no email server is configured.
      email_confirm: true,
    });
    if (error) {
      console.log('Admin account could not be created:', error.message);
      return;
    }
    if (data?.user) {
      await kv.set(`profile:${data.user.id}`, {
        userId: data.user.id,
        name: 'Administrador',
        email: PLATFORM_ADMIN_EMAIL,
        role: 'superadmin',
        businessId: null,
      });
      console.log('Platform admin account created.');
    }
  } catch (error) {
    console.error('Error ensuring admin account exists:', error);
  }
}

// Look up an auth user by email (paginates through the admin user list).
async function findUserByEmail(email: string) {
  try {
    for (let page = 1; page <= 10; page++) {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
      if (error || !data?.users?.length) return null;
      const found = data.users.find((u: any) => u.email === email);
      if (found) return found;
      if (data.users.length < 200) return null;
    }
    return null;
  } catch (error) {
    console.error('Error finding user by email:', error);
    return null;
  }
}
ensureAdminAccount();

// True when Supabase reports the email is already registered, across auth-js versions.
function isEmailExistsError(error: any) {
  if (!error) return false;
  return (
    error.code === 'email_exists' ||
    error.status === 422 ||
    /already.*registered|email.*exists/i.test(error.message || '')
  );
}

// Helper: resolve the authenticated user's profile from the Authorization header
async function getAuthedProfile(c: any) {
  const accessToken = c.req.header('Authorization')?.split(' ')[1];
  if (!accessToken) return { error: 'Missing access token', status: 401 };
  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data?.user) return { error: 'Invalid or expired session', status: 401 };
  const profile = await kv.get(`profile:${data.user.id}`);
  return { user: data.user, profile };
}

// Returns { blocked: true, error } if the business's 14-day trial has ended
// and it isn't on a paid/active subscription. Businesses with no
// subscription info (e.g. legacy/"default") are treated as unrestricted.
async function checkSubscriptionActive(businessId: string): Promise<{ blocked: boolean; error?: string }> {
  const business = await kv.get(`business:${businessId}`);
  if (!business?.subscription) return { blocked: false };
  const { status, trialEndsAt } = business.subscription;

  // Allow-list, not a deny-list: only these two states grant access. Any
  // other status (pending, pending_payment, canceled, past_due, paused, or
  // anything unexpected in the future) is blocked by default — this closes
  // the gap where "pending" (payment still processing) was silently letting
  // people in because it matched none of the old explicit block cases.
  if (status === 'trialing' && trialEndsAt && new Date(trialEndsAt).getTime() >= Date.now()) {
    return { blocked: false };
  }
  if (status === 'authorized') {
    return { blocked: false };
  }

  if (status === 'trialing') {
    return { blocked: true, error: 'Seu período de teste gratuito acabou. Assine um plano para continuar usando o painel.' };
  }
  if (status === 'pending_payment') {
    return { blocked: true, error: 'Assine o plano mensal para começar a usar o painel (seu CPF/CNPJ já usou o teste gratuito antes).' };
  }
  if (status === 'pending') {
    return { blocked: true, error: 'Sua assinatura ainda está sendo confirmada pelo Mercado Pago. Isso costuma levar só alguns instantes — atualize a página em um minuto.' };
  }
  return { blocked: true, error: 'Sua assinatura não está ativa. Assine o plano mensal para continuar usando o painel.' };
}

// Health check
app.get('/', (c) => c.text('Minha Agenda Nail API is running!'));

// ─────────────────────────────────────────────────────────────────────────
// ENCRYPTION AT REST for payment provider credentials
//
// Payment access tokens/API keys are sensitive — anyone with database
// access could otherwise read them in plain text. If an ENCRYPTION_KEY
// secret (a 64-character hex string, e.g. from `openssl rand -hex 32`) is
// configured in this function's environment, all credentials are encrypted
// with it (AES-256-GCM) before being saved, and only decrypted in memory
// right when actually needed (creating a checkout, verifying a webhook).
// If no key is configured yet, values are stored as plain text and a
// warning is logged — this keeps the app working for businesses testing
// things before this step is done, but it should be set before going live
// with real payments.
// ─────────────────────────────────────────────────────────────────────────

async function getEncryptionKey(): Promise<CryptoKey | null> {
  const keyHex = Deno.env.get('ENCRYPTION_KEY');
  if (!keyHex || keyHex.length !== 64) return null;
  try {
    const keyBytes = new Uint8Array(keyHex.match(/.{2}/g)!.map((b) => parseInt(b, 16)));
    return await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
  } catch {
    return null;
  }
}

async function encryptSecret(plaintext: string): Promise<string> {
  const key = await getEncryptionKey();
  if (!key) {
    console.warn('ENCRYPTION_KEY not configured — storing a payment credential in plain text.');
    return plaintext;
  }
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plaintext));
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return 'enc:' + btoa(String.fromCharCode(...combined));
}

async function decryptSecret(value: string): Promise<string> {
  if (!value || !value.startsWith('enc:')) return value; // plain text (no key configured when saved)
  const key = await getEncryptionKey();
  if (!key) {
    throw new Error('ENCRYPTION_KEY não configurada — não é possível ler as credenciais de pagamento salvas.');
  }
  const combined = Uint8Array.from(atob(value.slice(4)), (ch) => ch.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const plainBuffer = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  return new TextDecoder().decode(plainBuffer);
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Validates a CPF (11 digits) using its official check-digit algorithm.
function isValidCPF(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;
  const calc = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += parseInt(digits[i]) * (len + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return calc(9) === parseInt(digits[9]) && calc(10) === parseInt(digits[10]);
}

// Validates a CNPJ (14 digits) using its official check-digit algorithm.
function isValidCNPJ(cnpj: string): boolean {
  const digits = cnpj.replace(/\D/g, '');
  if (digits.length !== 14 || /^(\d)\1{13}$/.test(digits)) return false;
  const calc = (len: number) => {
    const weights = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    for (let i = 0; i < len; i++) sum += parseInt(digits[i]) * weights[i];
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  return calc(12) === parseInt(digits[12]) && calc(13) === parseInt(digits[13]);
}

function isValidCpfOrCnpj(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 11) return isValidCPF(digits);
  if (digits.length === 14) return isValidCNPJ(digits);
  return false;
}

// ─────────────────────────────────────────────────────────────────────────
// PAYMENT PROVIDERS
//
// IMPORTANT (read before enabling real payments): each function below is
// written against that provider's publicly documented API, but has NOT been
// exercised against a real account from this environment (no test/sandbox
// credentials were available while writing this). Before letting real
// clients pay real money:
//   1. Connect the business's own sandbox/test credentials first.
//   2. Make one real test booking and confirm the money/webhook flow end to
//      end in that provider's dashboard.
//   3. Only then switch the business over to production credentials.
// ─────────────────────────────────────────────────────────────────────────

const BACKEND_BASE_URL = `${Deno.env.get('SUPABASE_URL') ?? ''}/functions/v1/make-server-a3611da8`;

// ─────────────────────────────────────────────────────────────────────────
// PLATFORM SUBSCRIPTION (the monthly fee businesses pay YOU to use the app)
//
// This is separate from the "Pagamentos" section businesses configure for
// THEIR OWN clients. Here, the money goes to the platform's own Mercado
// Pago account — set PLATFORM_MERCADOPAGO_ACCESS_TOKEN as a secret in this
// function's environment (Deno.env), using your own Access Token from
// mercadopago.com.br/developers/panel. Never a business owner's token.
// ─────────────────────────────────────────────────────────────────────────

const PLATFORM_SUBSCRIPTION_PRICE = 79.90;

// Creates a recurring monthly charge (Mercado Pago's "Preapproval"/
// Assinaturas API) against the OWNER'S card, paid to the PLATFORM's own
// account. Docs: mercadopago.com.br/developers/.../subscriptions/preapproval
async function createPlatformSubscription(opts: { businessId: string; payerEmail: string; backUrl: string }) {
  const platformToken = Deno.env.get('PLATFORM_MERCADOPAGO_ACCESS_TOKEN');
  if (!platformToken) {
    throw new Error('Assinatura da plataforma ainda não configurada (PLATFORM_MERCADOPAGO_ACCESS_TOKEN ausente).');
  }
  const res = await fetch('https://api.mercadopago.com/preapproval', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${platformToken}` },
    body: JSON.stringify({
      reason: 'Assinatura mensal — Minha Agenda Nail',
      external_reference: opts.businessId,
      payer_email: opts.payerEmail,
      back_url: opts.backUrl,
      auto_recurring: {
        frequency: 1,
        frequency_type: 'months',
        transaction_amount: PLATFORM_SUBSCRIPTION_PRICE,
        currency_id: 'BRL',
      },
      status: 'pending',
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || 'Falha ao criar assinatura da plataforma.');
  return { checkoutUrl: data.init_point as string, preapprovalId: data.id as string };
}

// Re-verifies a platform preapproval's real status directly with Mercado
// Pago (never trust the webhook body alone).
async function verifyPlatformSubscription(preapprovalId: string) {
  const platformToken = Deno.env.get('PLATFORM_MERCADOPAGO_ACCESS_TOKEN');
  if (!platformToken) throw new Error('PLATFORM_MERCADOPAGO_ACCESS_TOKEN ausente.');
  const res = await fetch(`https://api.mercadopago.com/preapproval/${preapprovalId}`, {
    headers: { Authorization: `Bearer ${platformToken}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || 'Falha ao verificar assinatura da plataforma.');
  // Mercado Pago preapproval status values: pending, authorized, paused, cancelled.
  return { status: data.status as string, externalReference: data.external_reference as string };
}

// --- Mercado Pago ----------------------------------------------------------
// Docs: https://www.mercadopago.com.br/developers/en/reference/preferences/_checkout_preferences/post
// The business owner pastes their OWN Access Token (from their Mercado Pago
// developer panel) — so the checkout is created "as them" and the money
// goes straight into their own account. No marketplace/OAuth approval needed.
async function createMercadoPagoCheckout(opts: {
  accessToken: string;
  title: string;
  amount: number; // in BRL, e.g. 45.5
  externalReference: string;
  backUrl: string;
  businessId: string;
}) {
  const res = await fetch('https://api.mercadopago.com/checkout/preferences', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${opts.accessToken}`,
    },
    body: JSON.stringify({
      items: [{ title: opts.title, quantity: 1, currency_id: 'BRL', unit_price: opts.amount }],
      external_reference: opts.externalReference,
      back_urls: { success: opts.backUrl, pending: opts.backUrl, failure: opts.backUrl },
      auto_return: 'approved',
      // Mercado Pago echoes any query params on notification_url back in
      // the webhook call, so we tuck the businessId in here — that's how
      // the webhook knows which business's access token to verify with,
      // since the initial webhook payload only contains a payment id.
      notification_url: `${BACKEND_BASE_URL}/webhooks/mercadopago?businessId=${encodeURIComponent(opts.businessId)}`,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || 'Falha ao criar checkout no Mercado Pago.');
  return { checkoutUrl: data.init_point as string };
}

// Verifies a Mercado Pago payment's status directly with their API (never
// trust the webhook payload's status field alone — always re-fetch it).
async function verifyMercadoPagoPayment(accessToken: string, paymentId: string) {
  const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || 'Falha ao verificar pagamento no Mercado Pago.');
  return { approved: data.status === 'approved', externalReference: data.external_reference as string };
}

// --- Asaas -------------------------------------------------------------
// Docs: https://docs.asaas.com/reference/create-new-payment
// Asaas requires a "customer" to exist before creating a payment.
async function createAsaasCheckout(opts: {
  apiKey: string;
  environment: 'sandbox' | 'production';
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  title: string;
  amount: number;
  externalReference: string;
}) {
  const base = opts.environment === 'production' ? 'https://api.asaas.com/v3' : 'https://sandbox.asaas.com/api/v3';
  const headers = { 'Content-Type': 'application/json', access_token: opts.apiKey };

  const customerRes = await fetch(`${base}/customers`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ name: opts.customerName, email: opts.customerEmail, mobilePhone: opts.customerPhone }),
  });
  const customer = await customerRes.json();
  if (!customerRes.ok) throw new Error(customer?.errors?.[0]?.description || 'Falha ao criar cliente no Asaas.');

  const dueDate = new Date().toISOString().slice(0, 10);
  const paymentRes = await fetch(`${base}/payments`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      customer: customer.id,
      billingType: 'PIX',
      value: opts.amount,
      dueDate,
      description: opts.title,
      externalReference: opts.externalReference,
    }),
  });
  const payment = await paymentRes.json();
  if (!paymentRes.ok) throw new Error(payment?.errors?.[0]?.description || 'Falha ao criar cobrança no Asaas.');
  return { checkoutUrl: payment.invoiceUrl as string, providerPaymentId: payment.id as string };
}

async function verifyAsaasPayment(apiKey: string, environment: 'sandbox' | 'production', paymentId: string) {
  const base = environment === 'production' ? 'https://api.asaas.com/v3' : 'https://sandbox.asaas.com/api/v3';
  const res = await fetch(`${base}/payments/${paymentId}`, { headers: { access_token: apiKey } });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.errors?.[0]?.description || 'Falha ao verificar pagamento no Asaas.');
  return { approved: data.status === 'CONFIRMED' || data.status === 'RECEIVED', externalReference: data.externalReference as string };
}

// --- PagBank / PagSeguro -------------------------------------------------
// Docs: https://developer.pagbank.com.br/reference/criar-pedido
async function createPagBankCheckout(opts: {
  token: string;
  environment: 'sandbox' | 'production';
  title: string;
  amount: number; // in BRL
  externalReference: string;
  businessId: string;
}) {
  const base = opts.environment === 'production' ? 'https://api.pagseguro.com' : 'https://sandbox.api.pagseguro.com';
  const res = await fetch(`${base}/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${opts.token}` },
    body: JSON.stringify({
      reference_id: opts.externalReference,
      items: [{ name: opts.title, quantity: 1, unit_amount: Math.round(opts.amount * 100) }],
      qr_codes: [{ amount: { value: Math.round(opts.amount * 100) } }],
      notification_urls: [`${BACKEND_BASE_URL}/webhooks/pagbank?businessId=${encodeURIComponent(opts.businessId)}`],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error_messages?.[0]?.description || 'Falha ao criar pedido no PagBank.');
  const checkoutUrl = data.qr_codes?.[0]?.links?.find((l: any) => l.rel === 'QRCODE.PNG')?.href || data.links?.find((l: any) => l.rel === 'PAY')?.href;
  return { checkoutUrl, providerOrderId: data.id as string };
}

async function verifyPagBankPayment(token: string, environment: 'sandbox' | 'production', orderId: string) {
  const base = environment === 'production' ? 'https://api.pagseguro.com' : 'https://sandbox.api.pagseguro.com';
  const res = await fetch(`${base}/orders/${orderId}`, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error_messages?.[0]?.description || 'Falha ao verificar pedido no PagBank.');
  const paid = (data.charges || []).some((ch: any) => ch.status === 'PAID');
  return { approved: paid, externalReference: data.reference_id as string };
}

// Parses a displayed price like "R$ 120" or "R$ 45,50" into a plain number.
function parsePriceToNumber(price: string): number {
  const cleaned = String(price).replace(/[^\d,.-]/g, '').replace(',', '.');
  const value = parseFloat(cleaned);
  return isNaN(value) ? 0 : value;
}

// NOTE: a `/reset-password` endpoint used to live here that reset any
// account's password given only its email, with no proof of ownership —
// a full account-takeover vulnerability. It was already unused (the app's
// real "forgot password" flow uses Supabase's secure emailed recovery link,
// see supabase.auth.resetPasswordForEmail in the frontend), so it has been
// removed entirely rather than left as dead attack surface.

// Register a new BUSINESS (creates the owner account + a tenant record)
app.post('/register-business', async (c) => {
  try {
    const { businessName, ownerName, email, password, phone, cpfCnpj } = await c.req.json();
    if (!businessName || !ownerName || !email || !password || !cpfCnpj) {
      return c.json({ error: 'Preencha todos os campos da empresa, incluindo CPF/CNPJ.' }, 400);
    }
    if (!isValidCpfOrCnpj(cpfCnpj)) {
      return c.json({ error: 'CPF/CNPJ inválido. Confira os números digitados.' }, 400);
    }
    const documentDigits = cpfCnpj.replace(/\D/g, '');

    // One free trial per CPF/CNPJ — someone who already had a trial (on this
    // or a previous business) doesn't get a second one just by registering
    // again with a different email.
    const alreadyUsedTrial = await kv.get(`trial_used:${documentDigits}`);

    // Create the auth user. Auto-confirm the email since no email server is configured.
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: { name: ownerName },
      email_confirm: true,
    });
    if (error) {
      if (isEmailExistsError(error)) {
        console.log('Business registration blocked — email already registered:', email);
        return c.json({ error: 'Este email já está cadastrado. Faça login ou use outro email.' }, 409);
      }
      console.error('Error creating business owner user during business registration:', error);
      return c.json({ error: error.message }, 400);
    }

    const userId = data.user.id;
    const businessId = `biz_${Date.now()}`;

    // Generate a unique, URL-friendly slug from the business name (e.g.
    // "Maison Nailê" -> "maison-naile"), so each business gets its own
    // shareable booking link: seusite.com/{slug}.
    let slug = slugify(businessName) || 'salao';
    let suffix = 1;
    // Ensure uniqueness — if "maison-naile" is taken, try "maison-naile-2", etc.
    while (await kv.get(`slug:${slug}`)) {
      suffix += 1;
      slug = `${slugify(businessName) || 'salao'}-${suffix}`;
    }

    const business = {
      id: businessId,
      name: businessName,
      slug,
      ownerId: userId,
      ownerEmail: email,
      ownerPhone: phone || null,
      documentDigits,
      businessHours: DEFAULT_BUSINESS_HOURS,
      // A free 14-day trial only if this document hasn't had one before —
      // otherwise the business must subscribe right away.
      subscription: alreadyUsedTrial
        ? { plan: 'monthly', status: 'pending_payment', trialEndsAt: null }
        : { plan: 'trial', status: 'trialing', trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString() },
      createdAt: new Date().toISOString(),
    };
    if (!alreadyUsedTrial) {
      await kv.set(`trial_used:${documentDigits}`, { businessId, usedAt: new Date().toISOString() });
    }

    const profile = {
      userId,
      name: ownerName,
      email,
      phone: phone || null,
      role: 'owner',
      businessId,
    };

    await kv.set(`business:${businessId}`, business);
    await kv.set(`slug:${slug}`, businessId);
    await kv.set(`profile:${userId}`, profile);

    return c.json({ success: true, business, profile }, 201);
  } catch (error) {
    if (isEmailExistsError(error)) {
      return c.json({ error: 'Este email já está cadastrado. Faça login ou use outro email.' }, 409);
    }
    console.error('Error during business registration flow:', error);
    return c.json({ error: 'Falha ao registrar a empresa.' }, 500);
  }
});

// Register a new CLIENT account
app.post('/register-client', async (c) => {
  try {
    const { name, email, password, phone } = await c.req.json();
    if (!name || !email || !password) {
      return c.json({ error: 'Preencha nome, email e senha.' }, 400);
    }

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: { name },
      // Auto-confirm the email since no email server is configured.
      email_confirm: true,
    });
    if (error) {
      if (isEmailExistsError(error)) {
        console.log('Client registration blocked — email already registered:', email);
        return c.json({ error: 'Este email já está cadastrado. Faça login ou use outro email.' }, 409);
      }
      console.error('Error creating client user during client registration:', error);
      return c.json({ error: error.message }, 400);
    }

    const profile = {
      userId: data.user.id,
      name,
      email,
      phone: phone || null,
      role: 'client',
      businessId: null,
    };
    await kv.set(`profile:${data.user.id}`, profile);

    return c.json({ success: true, profile }, 201);
  } catch (error) {
    if (isEmailExistsError(error)) {
      return c.json({ error: 'Este email já está cadastrado. Faça login ou use outro email.' }, 409);
    }
    console.error('Error during client registration flow:', error);
    return c.json({ error: 'Falha ao registrar o cliente.' }, 500);
  }
});

// Return the authenticated user's profile (role, businessId, etc.)
app.get('/profile', async (c) => {
  try {
    const { user, profile, error, status } = await getAuthedProfile(c);
    if (error) return c.json({ error }, status);

    // The platform admin is derived from a fixed email, not from stored data.
    if (user.email === PLATFORM_ADMIN_EMAIL) {
      return c.json({
        profile: profile ?? { userId: user.id, name: 'Administrador', email: user.email, role: 'superadmin', businessId: null },
      });
    }

    // A user may exist in auth but have no profile (e.g. created before this flow).
    if (!profile) {
      const fallback = { userId: user.id, name: user.user_metadata?.name ?? user.email, email: user.email, role: 'client', businessId: null };
      await kv.set(`profile:${user.id}`, fallback);
      return c.json({ profile: fallback });
    }

    // Include the business record (with its shareable slug) so the owner can
    // find their booking link (seusite.com/{slug}) from the admin panel.
    let business = null;
    if (profile.businessId) {
      business = await kv.get(`business:${profile.businessId}`);
      // Backfill: some businesses (e.g. set up manually before this feature
      // existed) have a businessId on the profile but no business record at
      // all. Create a minimal one so the link/trial features work for them.
      if (!business) {
        business = {
          id: profile.businessId,
          name: profile.name ? `Estúdio de ${profile.name.split(' ')[0]}` : 'Meu Estúdio',
          ownerId: profile.userId,
          ownerEmail: profile.email,
          ownerPhone: profile.phone || null,
          businessHours: DEFAULT_BUSINESS_HOURS,
          subscription: { plan: 'trial', status: 'trialing', trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString() },
          createdAt: new Date().toISOString(),
        };
      }
      // Backfill: businesses created before the slug feature existed don't
      // have one yet. Generate and persist it the first time we see this.
      if (!business.slug) {
        let slug = slugify(business.name) || 'salao';
        let suffix = 1;
        while (await kv.get(`slug:${slug}`)) {
          suffix += 1;
          slug = `${slugify(business.name) || 'salao'}-${suffix}`;
        }
        business.slug = slug;
        await kv.set(`slug:${slug}`, business.id);
      }
      // Backfill: businesses created before the phone field existed.
      if (!business.ownerPhone && profile.phone && business.ownerId === profile.userId) {
        business.ownerPhone = profile.phone;
      }
      // Backfill: businesses created before working-hours were configurable.
      if (!business.businessHours) {
        business.businessHours = DEFAULT_BUSINESS_HOURS;
      }
      await kv.set(`business:${business.id}`, business);
    }

    return c.json({ profile, business });
  } catch (error) {
    console.error('Error fetching profile:', error);
    return c.json({ error: 'Failed to fetch profile' }, 500);
  }
});

// List all businesses (platform admin only)
app.get('/businesses', async (c) => {
  try {
    const { user, error, status } = await getAuthedProfile(c);
    if (error) return c.json({ error }, status);
    if (user.email !== PLATFORM_ADMIN_EMAIL) {
      return c.json({ error: 'Acesso restrito ao administrador da plataforma.' }, 403);
    }
    const businesses = await kv.getByPrefix('business:');
    return c.json({ businesses: businesses || [] });
  } catch (error) {
    console.error('Error fetching businesses:', error);
    return c.json({ error: 'Failed to fetch businesses' }, 500);
  }
});

// Resolve a business's shareable link (e.g. seusite.com/maison-naile) to its
// businessId. Public — a client needs this before logging in to know which
// salon's booking page they're looking at.
app.get('/business-by-slug', async (c) => {
  try {
    const slug = c.req.query('slug');
    if (!slug) return c.json({ error: 'Missing slug' }, 400);
    const businessId = await kv.get(`slug:${slug}`);
    if (!businessId) return c.json({ error: 'Salão não encontrado.' }, 404);
    const business = await kv.get(`business:${businessId}`);
    if (!business) return c.json({ error: 'Salão não encontrado.' }, 404);
    return c.json({ businessId: business.id, businessName: business.name, slug: business.slug, address: business.address || null, ownerPhone: business.ownerPhone || null });
  } catch (error) {
    console.error('Error resolving business slug:', error);
    return c.json({ error: 'Failed to resolve business' }, 500);
  }
});

// Start (or resume) the owner's monthly platform subscription — creates a
// Mercado Pago recurring charge against their own card, paid to YOUR account.
app.post('/business/subscribe', async (c) => {
  try {
    const { user, profile, error, status } = await getAuthedProfile(c);
    if (error) return c.json({ error }, status);
    if (profile?.role !== 'owner' && user.email !== PLATFORM_ADMIN_EMAIL) {
      return c.json({ error: 'Apenas a empresa pode assinar o plano.' }, 403);
    }
    const businessId = profile?.businessId;
    if (!businessId) return c.json({ error: 'Nenhuma empresa associada a esta conta.' }, 400);

    const backUrl = `${(c.req.header('origin') || '')}/?assinatura=retorno`;
    const { checkoutUrl, preapprovalId } = await createPlatformSubscription({
      businessId,
      payerEmail: user.email,
      backUrl,
    });

    const business = await kv.get(`business:${businessId}`);
    business.subscription = { ...business.subscription, plan: 'monthly', status: 'pending', preapprovalId };
    await kv.set(`business:${businessId}`, business);

    return c.json({ checkoutUrl });
  } catch (error) {
    console.error('Error starting platform subscription:', error);
    return c.json({ error: (error as Error).message || 'Falha ao iniciar assinatura.' }, 500);
  }
});

// Platform subscription webhook — Mercado Pago calls this when the
// preapproval's status changes (authorized after the first successful
// charge, or cancelled/paused later).
app.post('/webhooks/platform-subscription', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const preapprovalId = body?.data?.id || c.req.query('id');
    if (!preapprovalId) return c.json({ received: true });

    const result = await verifyPlatformSubscription(preapprovalId);
    if (!result.externalReference) return c.json({ received: true });

    const business = await kv.get(`business:${result.externalReference}`);
    if (!business) return c.json({ received: true });

    const statusMap: Record<string, string> = {
      authorized: 'authorized',
      paused: 'paused',
      cancelled: 'canceled',
      pending: 'pending',
    };
    business.subscription = {
      ...business.subscription,
      status: statusMap[result.status] || result.status,
      trialEndsAt: null, // a real subscription supersedes the trial
    };
    await kv.set(`business:${result.externalReference}`, business);

    return c.json({ received: true });
  } catch (error) {
    console.error('Error processing platform subscription webhook:', error);
    return c.json({ received: true });
  }
});

// Public: get a business's working hours (used by clients to compute
// available booking slots for a given date).
app.get('/business/hours', async (c) => {
  try {
    const businessId = c.req.query('businessId') || 'default';
    const business = await kv.get(`business:${businessId}`);
    return c.json({ businessHours: business?.businessHours || DEFAULT_BUSINESS_HOURS });
  } catch (error) {
    console.error('Error fetching business hours:', error);
    return c.json({ error: 'Failed to fetch business hours' }, 500);
  }
});

// Let the owner set their weekly working hours.
app.put('/business/hours', async (c) => {
  try {
    const { user, profile, error, status } = await getAuthedProfile(c);
    if (error) return c.json({ error }, status);
    const isPlatformAdmin = user.email === PLATFORM_ADMIN_EMAIL;
    if (!isPlatformAdmin && profile?.role !== 'owner') {
      return c.json({ error: 'Apenas a empresa pode alterar os horários.' }, 403);
    }
    const businessId = profile?.businessId;
    if (!businessId) return c.json({ error: 'Nenhuma empresa associada a esta conta.' }, 400);
    if (!isPlatformAdmin) {
      const sub = await checkSubscriptionActive(businessId);
      if (sub.blocked) return c.json({ error: sub.error }, 402);
    }

    const { businessHours } = await c.req.json();
    if (!businessHours || typeof businessHours !== 'object') {
      return c.json({ error: 'Horários inválidos.' }, 400);
    }

    const business = await kv.get(`business:${businessId}`);
    if (!business) return c.json({ error: 'Empresa não encontrada.' }, 404);
    business.businessHours = businessHours;
    await kv.set(`business:${businessId}`, business);

    return c.json({ business });
  } catch (error) {
    console.error('Error updating business hours:', error);
    return c.json({ error: 'Falha ao atualizar os horários.' }, 500);
  }
});

// Let the owner set/update their business's physical address, shown to
// clients in booking confirmations.
app.put('/business/address', async (c) => {
  try {
    const { user, profile, error, status } = await getAuthedProfile(c);
    if (error) return c.json({ error }, status);
    const isPlatformAdmin = user.email === PLATFORM_ADMIN_EMAIL;
    if (!isPlatformAdmin && profile?.role !== 'owner') {
      return c.json({ error: 'Apenas a empresa pode alterar o endereço.' }, 403);
    }
    const businessId = profile?.businessId;
    if (!businessId) return c.json({ error: 'Nenhuma empresa associada a esta conta.' }, 400);
    if (!isPlatformAdmin) {
      const sub = await checkSubscriptionActive(businessId);
      if (sub.blocked) return c.json({ error: sub.error }, 402);
    }

    const { address } = await c.req.json();
    const business = await kv.get(`business:${businessId}`);
    if (!business) return c.json({ error: 'Empresa não encontrada.' }, 404);
    business.address = address || null;
    await kv.set(`business:${businessId}`, business);

    return c.json({ business });
  } catch (error) {
    console.error('Error updating business address:', error);
    return c.json({ error: 'Falha ao atualizar o endereço.' }, 500);
  }
});

app.put('/business/slug', async (c) => {
  try {
    const { user, profile, error, status } = await getAuthedProfile(c);
    if (error) return c.json({ error }, status);

    const isPlatformAdmin = user.email === PLATFORM_ADMIN_EMAIL;
    if (!isPlatformAdmin && profile?.role !== 'owner') {
      return c.json({ error: 'Apenas a empresa pode alterar o link.' }, 403);
    }

    const businessId = profile?.businessId;
    if (!businessId) return c.json({ error: 'Nenhuma empresa associada a esta conta.' }, 400);
    if (!isPlatformAdmin) {
      const sub = await checkSubscriptionActive(businessId);
      if (sub.blocked) return c.json({ error: sub.error }, 402);
    }

    const { slug: desiredSlug } = await c.req.json();
    const cleanSlug = slugify(desiredSlug || '');
    if (!cleanSlug || cleanSlug.length < 3) {
      return c.json({ error: 'O link precisa ter pelo menos 3 letras (sem espaços ou símbolos).' }, 400);
    }

    const business = await kv.get(`business:${businessId}`);
    if (!business) return c.json({ error: 'Empresa não encontrada.' }, 404);

    if (cleanSlug !== business.slug) {
      const existingOwner = await kv.get(`slug:${cleanSlug}`);
      if (existingOwner && existingOwner !== businessId) {
        return c.json({ error: 'Esse link já está em uso por outra empresa. Escolha outro.' }, 409);
      }
      // Free the old slug and claim the new one.
      if (business.slug) await kv.del(`slug:${business.slug}`);
      await kv.set(`slug:${cleanSlug}`, businessId);
      business.slug = cleanSlug;
      await kv.set(`business:${businessId}`, business);
    }

    return c.json({ business });
  } catch (error) {
    console.error('Error updating business slug:', error);
    return c.json({ error: 'Falha ao atualizar o link.' }, 500);
  }
});

// Get the business's payment settings. Credentials are masked (only the
// last 4 characters returned) — the owner sees which provider is connected
// without the full secret being sent back down every time.
app.get('/business/payment-settings', async (c) => {
  try {
    const { user, profile, error, status } = await getAuthedProfile(c);
    if (error) return c.json({ error }, status);
    const businessId = profile?.businessId;
    if (!businessId) return c.json({ error: 'Nenhuma empresa associada a esta conta.' }, 400);

    const business = await kv.get(`business:${businessId}`);
    const settings = business?.paymentSettings || null;
    const mask = async (v?: string | null) => {
      if (!v) return null;
      try {
        const plain = await decryptSecret(v);
        return `••••${plain.slice(-4)}`;
      } catch {
        return '•••• (não foi possível ler — verifique a ENCRYPTION_KEY)';
      }
    };

    return c.json({
      paymentSettings: settings && {
        provider: settings.provider,
        depositPercent: settings.depositPercent ?? 50,
        mercadopago: settings.mercadopago
          ? { accessTokenMasked: await mask(settings.mercadopago.accessToken), hasWebhookSecret: !!settings.mercadopago.webhookSecret }
          : null,
        asaas: settings.asaas ? { apiKeyMasked: await mask(settings.asaas.apiKey), environment: settings.asaas.environment } : null,
        pagbank: settings.pagbank ? { tokenMasked: await mask(settings.pagbank.token), environment: settings.pagbank.environment } : null,
      },
    });
  } catch (error) {
    console.error('Error fetching payment settings:', error);
    return c.json({ error: 'Failed to fetch payment settings' }, 500);
  }
});

// Let the owner connect/update their payment provider credentials.
app.put('/business/payment-settings', async (c) => {
  try {
    const { user, profile, error, status } = await getAuthedProfile(c);
    if (error) return c.json({ error }, status);
    const isPlatformAdmin = user.email === PLATFORM_ADMIN_EMAIL;
    if (!isPlatformAdmin && profile?.role !== 'owner') {
      return c.json({ error: 'Apenas a empresa pode configurar pagamentos.' }, 403);
    }
    const businessId = profile?.businessId;
    if (!businessId) return c.json({ error: 'Nenhuma empresa associada a esta conta.' }, 400);

    const body = await c.req.json();
    const { provider, depositPercent, mercadopago, asaas, pagbank } = body;
    if (provider && !['mercadopago', 'asaas', 'pagbank'].includes(provider)) {
      return c.json({ error: 'Provedor de pagamento inválido.' }, 400);
    }

    const business = await kv.get(`business:${businessId}`);
    if (!business) return c.json({ error: 'Empresa não encontrada.' }, 404);

    const current = business.paymentSettings || {};
    const mergedMercadoPago = mercadopago
      ? {
          accessToken: mercadopago.accessToken ? await encryptSecret(mercadopago.accessToken) : current.mercadopago?.accessToken,
          webhookSecret: mercadopago.webhookSecret ? await encryptSecret(mercadopago.webhookSecret) : current.mercadopago?.webhookSecret ?? null,
        }
      : current.mercadopago ?? null;
    const mergedAsaas = asaas?.apiKey
      ? { apiKey: await encryptSecret(asaas.apiKey), environment: asaas.environment || 'sandbox' }
      : current.asaas ?? null;
    const mergedPagbank = pagbank?.token
      ? { token: await encryptSecret(pagbank.token), environment: pagbank.environment || 'sandbox' }
      : current.pagbank ?? null;
    business.paymentSettings = {
      provider: provider ?? current.provider ?? null,
      depositPercent: depositPercent ?? current.depositPercent ?? 50,
      mercadopago: mergedMercadoPago,
      asaas: mergedAsaas,
      pagbank: mergedPagbank,
    };
    await kv.set(`business:${businessId}`, business);

    return c.json({ success: true });
  } catch (error) {
    console.error('Error updating payment settings:', error);
    return c.json({ error: 'Falha ao salvar as configurações de pagamento.' }, 500);
  }
});

// Get a business's catalog (services + professionals), seeding defaults on first access
app.get('/business-data', async (c) => {
  try {
    const businessId = c.req.query('businessId') || 'default';
    let data = await kv.get(`bizdata:${businessId}`);
    if (!data) {
      data = { businessId, services: DEFAULT_SERVICES, professionals: DEFAULT_PROFESSIONALS };
      await kv.set(`bizdata:${businessId}`, data);
    }
    return c.json({ data });
  } catch (error) {
    console.error('Error fetching business data:', error);
    return c.json({ error: 'Failed to fetch business data' }, 500);
  }
});

// Update a business's catalog (owner or platform admin only)
app.put('/business-data', async (c) => {
  try {
    const { user, profile, error, status } = await getAuthedProfile(c);
    if (error) return c.json({ error }, status);

    const body = await c.req.json();
    const businessId = body.businessId || 'default';

    const isPlatformAdmin = user.email === PLATFORM_ADMIN_EMAIL;
    const isOwner = profile?.role === 'owner';
    if (!isPlatformAdmin && !isOwner) {
      return c.json({ error: 'Apenas a empresa pode alterar o catálogo.' }, 403);
    }

    if (!isPlatformAdmin) {
      const sub = await checkSubscriptionActive(businessId);
      if (sub.blocked) return c.json({ error: sub.error }, 402);
    }

    const current = (await kv.get(`bizdata:${businessId}`)) || { businessId, services: DEFAULT_SERVICES, professionals: DEFAULT_PROFESSIONALS };
    const updated = {
      ...current,
      businessId,
      services: body.services ?? current.services,
      professionals: body.professionals ?? current.professionals,
      updatedAt: new Date().toISOString(),
    };
    await kv.set(`bizdata:${businessId}`, updated);
    return c.json({ data: updated });
  } catch (error) {
    console.error('Error updating business data:', error);
    return c.json({ error: 'Failed to update business data' }, 500);
  }
});

// Upload a professional photo, returns a long-lived signed URL
app.post('/upload-photo', async (c) => {
  try {
    const { user, profile, error, status } = await getAuthedProfile(c);
    if (error) return c.json({ error }, status);
    if (user.email !== PLATFORM_ADMIN_EMAIL && profile?.role !== 'owner') {
      return c.json({ error: 'Apenas a empresa pode enviar fotos.' }, 403);
    }
    if (user.email !== PLATFORM_ADMIN_EMAIL && profile?.businessId) {
      const sub = await checkSubscriptionActive(profile.businessId);
      if (sub.blocked) return c.json({ error: sub.error }, 402);
    }

    const { dataUrl, businessId } = await c.req.json();
    if (!dataUrl) return c.json({ error: 'Imagem ausente.' }, 400);

    // dataUrl format: data:image/png;base64,xxxx
    const match = /^data:(.+?);base64,(.*)$/.exec(dataUrl);
    if (!match) return c.json({ error: 'Formato de imagem inválido.' }, 400);
    const contentType = match[1];
    const ext = contentType.split('/')[1] || 'png';
    const bytes = Uint8Array.from(atob(match[2]), (ch) => ch.charCodeAt(0));

    const path = `${businessId || 'default'}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from(PHOTO_BUCKET).upload(path, bytes, { contentType, upsert: true });
    if (upErr) {
      console.error('Error uploading professional photo to storage:', upErr);
      return c.json({ error: 'Falha ao enviar a foto.' }, 500);
    }

    // Sign for ~1 year so it can be stored directly on the professional record.
    const { data: signed, error: signErr } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrl(path, 60 * 60 * 24 * 365);
    if (signErr || !signed) {
      console.error('Error creating signed URL for professional photo:', signErr);
      return c.json({ error: 'Falha ao gerar URL da foto.' }, 500);
    }
    return c.json({ url: signed.signedUrl });
  } catch (error) {
    console.error('Error in photo upload flow:', error);
    return c.json({ error: 'Falha ao enviar a foto.' }, 500);
  }
});

// Cancel an appointment and optionally leave a message for the client.
// Only the business's own owner (or the platform admin) can do this.
app.post('/appointments/cancel', async (c) => {
  try {
    const { user, profile, error, status } = await getAuthedProfile(c);
    if (error) return c.json({ error }, status);

    const { key, message } = await c.req.json();
    if (!key) return c.json({ error: 'Agendamento não informado.' }, 400);

    const appt = await kv.get(key);
    if (!appt) return c.json({ error: 'Agendamento não encontrado.' }, 404);

    const isPlatformAdmin = user.email === PLATFORM_ADMIN_EMAIL;
    const isOwnerOfThisBusiness = profile?.role === 'owner' && profile.businessId === appt.businessId;
    if (!isPlatformAdmin && !isOwnerOfThisBusiness) {
      return c.json({ error: 'Você não tem permissão para cancelar este agendamento.' }, 403);
    }
    if (!isPlatformAdmin && isOwnerOfThisBusiness) {
      const sub = await checkSubscriptionActive(appt.businessId);
      if (sub.blocked) return c.json({ error: sub.error }, 402);
    }

    await kv.del(key);

    // Leave a notification for the client if a message was provided.
    if (appt.userId) {
      const notifKey = `notif:${appt.userId}:${Date.now()}`;
      await kv.set(notifKey, {
        key: notifKey,
        userId: appt.userId,
        type: 'cancelled',
        message: message || 'Seu agendamento foi cancelado pelo estúdio.',
        appointment: { service: appt.service, professional: appt.professional, date: appt.date, time: appt.time },
        createdAt: new Date().toISOString(),
      });
    }

    return c.json({ success: true });
  } catch (error) {
    console.error('Error cancelling appointment with message:', error);
    return c.json({ error: 'Falha ao cancelar o agendamento.' }, 500);
  }
});

// Client left the payment page before finishing — this regenerates a fresh
// checkout link for the SAME pending appointment (same deposit amount, same
// slot) so they don't have to book again from scratch.
app.post('/appointments/resume-checkout', async (c) => {
  try {
    const { key, returnUrl } = await c.req.json();
    if (!key) return c.json({ error: 'Agendamento não informado.' }, 400);

    const appt = await kv.get(key);
    if (!appt) return c.json({ error: 'Agendamento não encontrado.' }, 404);
    if (appt.status !== 'aguardando_pagamento') {
      return c.json({ error: 'Este agendamento não está mais aguardando pagamento.' }, 400);
    }

    const business = await kv.get(`business:${appt.businessId}`);
    const paymentSettings = business?.paymentSettings;
    if (!paymentSettings?.provider) {
      return c.json({ error: 'Este estúdio não tem um provedor de pagamento configurado.' }, 400);
    }

    const origin = c.req.header('origin') || '';
    let backUrl: string;
    if (returnUrl && typeof returnUrl === 'string' && origin && returnUrl.startsWith(origin)) {
      const sep = returnUrl.includes('?') ? '&' : '?';
      backUrl = `${returnUrl}${sep}pagamento=retorno`;
    } else {
      const refererPath = c.req.header('referer')?.replace(/^https?:\/\/[^/]+/, '') || '/';
      backUrl = `${origin}${refererPath}${refererPath.includes('?') ? '&' : '?'}pagamento=retorno`;
    }

    let checkout: { checkoutUrl: string };
    if (paymentSettings.provider === 'mercadopago') {
      checkout = await createMercadoPagoCheckout({
        accessToken: await decryptSecret(paymentSettings.mercadopago.accessToken),
        title: `Sinal — ${appt.service.name}`,
        amount: appt.depositAmount,
        externalReference: key,
        backUrl,
        businessId: appt.businessId,
      });
    } else if (paymentSettings.provider === 'asaas') {
      checkout = await createAsaasCheckout({
        apiKey: await decryptSecret(paymentSettings.asaas.apiKey),
        environment: paymentSettings.asaas.environment,
        customerName: appt.userEmail || 'Cliente',
        customerEmail: appt.userEmail,
        customerPhone: appt.userPhone,
        title: `Sinal — ${appt.service.name}`,
        amount: appt.depositAmount,
        externalReference: key,
      });
    } else if (paymentSettings.provider === 'pagbank') {
      checkout = await createPagBankCheckout({
        token: await decryptSecret(paymentSettings.pagbank.token),
        environment: paymentSettings.pagbank.environment,
        title: `Sinal — ${appt.service.name}`,
        amount: appt.depositAmount,
        externalReference: key,
        businessId: appt.businessId,
      });
    } else {
      return c.json({ error: 'Provedor de pagamento não reconhecido.' }, 400);
    }

    return c.json({ success: true, checkoutUrl: checkout.checkoutUrl });
  } catch (error) {
    console.error('Error resuming checkout:', error);
    return c.json({ error: `Não foi possível reabrir o pagamento: ${(error as Error).message}` }, 500);
  }
});

// Mark an appointment as done ("a cliente já fez a unha"). Unlike cancel,
// this keeps the record — it just flips its status so the frontend can
// move it out of the upcoming agenda and into the history list.
app.post('/appointments/complete', async (c) => {
  try {
    const { user, profile, error, status } = await getAuthedProfile(c);
    if (error) return c.json({ error }, status);

    const { key } = await c.req.json();
    if (!key) return c.json({ error: 'Agendamento não informado.' }, 400);

    const appt = await kv.get(key);
    if (!appt) return c.json({ error: 'Agendamento não encontrado.' }, 404);

    const isPlatformAdmin = user.email === PLATFORM_ADMIN_EMAIL;
    const isOwnerOfThisBusiness = profile?.role === 'owner' && profile.businessId === appt.businessId;
    if (!isPlatformAdmin && !isOwnerOfThisBusiness) {
      return c.json({ error: 'Você não tem permissão para finalizar este agendamento.' }, 403);
    }

    const updated = {
      ...appt,
      status: 'concluido',
      completedAt: new Date().toISOString(),
    };
    await kv.set(key, updated);

    return c.json({ success: true, appointment: updated });
  } catch (error) {
    console.error('Error completing appointment:', error);
    return c.json({ error: 'Falha ao finalizar o agendamento.' }, 500);
  }
});

// Get notifications for the authenticated user
app.get('/notifications', async (c) => {
  try {
    const { user, error, status } = await getAuthedProfile(c);
    if (error) return c.json({ error }, status);
    const notifications = await kv.getByPrefix(`notif:${user.id}:`);
    return c.json({ notifications: notifications || [] });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return c.json({ error: 'Failed to fetch notifications' }, 500);
  }
});

// Dismiss (delete) a notification
app.post('/notifications/dismiss', async (c) => {
  try {
    const { user, error, status } = await getAuthedProfile(c);
    if (error) return c.json({ error }, status);
    const { key } = await c.req.json();
    // Only allow dismissing your own notifications.
    if (!key || !key.startsWith(`notif:${user.id}:`)) {
      return c.json({ error: 'Notificação inválida.' }, 400);
    }
    await kv.del(key);
    return c.json({ success: true });
  } catch (error) {
    console.error('Error dismissing notification:', error);
    return c.json({ error: 'Failed to dismiss notification' }, 500);
  }
});

// Get appointments (scoped per business via ?businessId=). Owners/platform
// admin see full details for their own business. Everyone else only gets
// their own bookings in full, plus a PII-free slot map of other people's
// bookings (professional+date+time only) so the booking UI can grey out
// times that are already taken without leaking anyone's contact info.
app.get('/appointments', async (c) => {
  try {
    const { user, profile, error, status } = await getAuthedProfile(c);
    if (error) return c.json({ error }, status);

    const businessId = c.req.query('businessId') || 'default';
    const all = (await kv.getByPrefix(`appt_${businessId}_`)) || [];

    const isPlatformAdmin = user.email === PLATFORM_ADMIN_EMAIL;
    const isOwnerOfThisBusiness = profile?.role === 'owner' && profile.businessId === businessId;

    if (isPlatformAdmin || isOwnerOfThisBusiness) {
      return c.json({ appointments: all });
    }

    const mine = all.filter((a: any) => a.userId === user.id);
    const takenSlots = all
      .filter((a: any) => a.userId !== user.id)
      .map((a: any) => ({ professional: { id: a.professional.id }, date: a.date, time: a.time, status: a.status }));

    return c.json({ appointments: mine, takenSlots });
  } catch (error) {
    console.error('Error fetching appointments:', error);
    return c.json({ error: 'Failed to fetch appointments' }, 500);
  }
});

// Create a new appointment (scoped per business)
app.post('/appointments', async (c) => {
  try {
    const body = await c.req.json();
    const { service, professional, date, time, userId, userEmail, userPhone, businessId, returnUrl } = body;

    if (!service || !professional || !date || !time) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    const { day, month, year } = date;
    const scope = businessId || 'default';

    // Key format: appt_{businessId}_{professional.id}_{year}_{month}_{day}_{time}
    const key = `appt_${scope}_${professional.id}_${year}_${month}_${day}_${time}`;

    // If the salon's own monthly platform subscription isn't active, block
    // new bookings entirely — clients shouldn't be able to book with a
    // salon whose account is suspended.
    const platformSub = await checkSubscriptionActive(scope);
    if (platformSub.blocked) {
      return c.json({ error: 'Este estúdio está temporariamente indisponível para novos agendamentos.' }, 402);
    }

    const business = await kv.get(`business:${scope}`);
    const paymentSettings = business?.paymentSettings;
    const hasPaymentProvider = paymentSettings?.provider && paymentSettings[paymentSettings.provider];

    // No payment provider connected yet — keep the old behavior so
    // businesses that haven't set up payments aren't blocked.
    if (!hasPaymentProvider) {
      const appointmentData = {
        id: Date.now().toString(),
        key,
        service,
        professional,
        date,
        time,
        status: 'confirmado',
        paid: false,
        userId,
        userEmail,
        userPhone: userPhone || null,
        businessId: scope,
        createdAt: new Date().toISOString(),
      };
      // Atomic reservation — closes the race where two people booking the
      // exact same slot at nearly the same instant could both succeed.
      const { reserved } = await reserveAppointmentSlot(key, appointmentData);
      if (!reserved) {
        return c.json({ error: 'Este horário já está ocupado com esta profissional.' }, 409);
      }
      return c.json({ success: true, appointment: appointmentData }, 201);
    }

    // A payment provider IS connected — the appointment is only confirmed,
    // and only shows up in the owner's agenda, once the deposit is paid.
    const depositPercent = paymentSettings.depositPercent ?? 50;
    const fullPrice = parsePriceToNumber(service.price);
    const depositAmount = Math.round(fullPrice * (depositPercent / 100) * 100) / 100;

    const appointmentData = {
      id: Date.now().toString(),
      key,
      service,
      professional,
      date,
      time,
      status: 'aguardando_pagamento',
      paid: false,
      depositAmount,
      userId,
      userEmail,
      userPhone: userPhone || null,
      businessId: scope,
      createdAt: new Date().toISOString(),
    };
    const { reserved } = await reserveAppointmentSlot(key, appointmentData);
    if (!reserved) {
      return c.json({ error: 'Este horário já está ocupado com esta profissional.' }, 409);
    }

    // Build the URL to send the client back to after paying. Prefer the
    // exact URL the client told us they were on (returnUrl) — this
    // correctly preserves things like ?salao=nome-do-salao. The Referer
    // header is NOT reliable here: this request goes cross-origin (app
    // domain -> Supabase functions domain), and browsers strip query
    // strings/paths from Referer on cross-origin requests by default.
    const origin = c.req.header('origin') || '';
    let backUrl: string;
    if (returnUrl && typeof returnUrl === 'string' && origin && returnUrl.startsWith(origin)) {
      const sep = returnUrl.includes('?') ? '&' : '?';
      backUrl = `${returnUrl}${sep}pagamento=retorno`;
    } else {
      const refererPath = c.req.header('referer')?.replace(/^https?:\/\/[^/]+/, '') || '/';
      backUrl = `${origin}${refererPath}${refererPath.includes('?') ? '&' : '?'}pagamento=retorno`;
    }

    try {
      let checkout: { checkoutUrl: string };
      if (paymentSettings.provider === 'mercadopago') {
        checkout = await createMercadoPagoCheckout({
          accessToken: await decryptSecret(paymentSettings.mercadopago.accessToken),
          title: `Sinal — ${service.name}`,
          amount: depositAmount,
          externalReference: key,
          backUrl,
          businessId: scope,
        });
      } else if (paymentSettings.provider === 'asaas') {
        checkout = await createAsaasCheckout({
          apiKey: await decryptSecret(paymentSettings.asaas.apiKey),
          environment: paymentSettings.asaas.environment,
          customerName: userEmail || 'Cliente',
          customerEmail: userEmail,
          customerPhone: userPhone,
          title: `Sinal — ${service.name}`,
          amount: depositAmount,
          externalReference: key,
        });
      } else if (paymentSettings.provider === 'pagbank') {
        checkout = await createPagBankCheckout({
          token: await decryptSecret(paymentSettings.pagbank.token),
          environment: paymentSettings.pagbank.environment,
          title: `Sinal — ${service.name}`,
          amount: depositAmount,
          externalReference: key,
          businessId: scope,
        });
      } else {
        throw new Error('Provedor de pagamento não reconhecido.');
      }

      return c.json({ success: true, appointment: appointmentData, checkoutUrl: checkout.checkoutUrl, depositAmount }, 201);
    } catch (paymentError) {
      // Roll back the pending appointment slot if we couldn't even create
      // the checkout, so it doesn't block the time slot for nothing.
      await kv.del(key);
      console.error('Error creating payment checkout:', paymentError);
      return c.json({ error: `Não foi possível iniciar o pagamento: ${(paymentError as Error).message}` }, 502);
    }
  } catch (error) {
    console.error('Error creating appointment:', error);
    return c.json({ error: 'Failed to create appointment' }, 500);
  }
});

// Shared logic: once a payment is confirmed by any provider, mark the
// matching appointment paid+confirmado so it shows up in the owner's agenda.
async function confirmAppointmentByExternalReference(externalReference: string) {
  const appt = await kv.get(externalReference);
  if (!appt) {
    console.log('[confirm] no appointment found for reference', externalReference);
    return;
  }
  if (appt.status === 'confirmado' && appt.paid) {
    console.log('[confirm] already confirmed, skipping', externalReference);
    return;
  }
  appt.status = 'confirmado';
  appt.paid = true;
  appt.paidAt = new Date().toISOString();
  await kv.set(externalReference, appt);
  console.log('[confirm] appointment confirmed and marked paid:', externalReference);
}

// Verifies the x-signature header Mercado Pago sends on every webhook call,
// so we only trust notifications that were genuinely signed by them (using
// the webhook secret the business owner generated in their own "Suas
// integrações" panel). Docs: mercadopago.com.br/developers/.../notifications/webhooks
async function verifyMercadoPagoSignature(opts: {
  xSignature: string | null;
  xRequestId: string | null;
  dataId: string;
  webhookSecret: string;
}): Promise<boolean> {
  if (!opts.xSignature) return false;
  const parts = Object.fromEntries(
    opts.xSignature.split(',').map((p) => {
      const [k, v] = p.split('=');
      return [k?.trim(), v?.trim()];
    })
  );
  const ts = parts['ts'];
  const v1 = parts['v1'];
  if (!ts || !v1) return false;

  const manifest = `id:${opts.dataId.toLowerCase()};${opts.xRequestId ? `request-id:${opts.xRequestId};` : ''}ts:${ts};`;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(opts.webhookSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBuffer = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(manifest));
  const computed = Array.from(new Uint8Array(sigBuffer)).map((b) => b.toString(16).padStart(2, '0')).join('');

  return computed === v1;
}

// --- Mercado Pago webhook ---
app.post('/webhooks/mercadopago', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const paymentId = body?.data?.id || c.req.query('id');
    const topic = body?.type || c.req.query('topic');
    console.log(`[MP webhook] received topic=${topic} paymentId=${paymentId} query=${c.req.url}`);
    if (topic !== 'payment' || !paymentId) {
      console.log('[MP webhook] ignoring — not a payment topic or missing paymentId');
      return c.json({ received: true });
    }

    let businessId = c.req.query('businessId');
    let accessToken: string | null = null;
    let result: { approved: boolean; externalReference: string } | null = null;

    if (businessId) {
      console.log(`[MP webhook] businessId present in URL: ${businessId}`);
      const business = await kv.get(`business:${businessId}`);
      const mpSettings = business?.paymentSettings?.mercadopago;
      if (mpSettings?.accessToken) {
        accessToken = await decryptSecret(mpSettings.accessToken);
        try {
          result = await verifyMercadoPagoPayment(accessToken, paymentId);
          console.log(`[MP webhook] verified via URL businessId — status=${result.approved ? 'approved' : 'not approved'} externalReference=${result.externalReference}`);
        } catch (e) {
          console.log(`[MP webhook] verification via URL businessId FAILED: ${(e as Error).message}`);
          result = null;
        }
      } else {
        console.log(`[MP webhook] business ${businessId} has no mercadopago accessToken configured`);
      }
    } else {
      console.log('[MP webhook] no businessId in URL — will try the fallback scan');
    }

    if (!result) {
      // No businessId came through (e.g. a webhook configured manually in
      // the Mercado Pago dashboard, which doesn't carry our per-checkout
      // query param) — try every connected business's own credentials
      // until one can actually see this payment. Whichever token succeeds
      // IS the right business, since a payment can only be read back using
      // the same account's own credentials it was created under.
      const allBusinesses = (await kv.getByPrefix('business:')) || [];
      console.log(`[MP webhook] fallback scan: ${allBusinesses.length} businesses total`);
      let candidates = 0;
      for (const b of allBusinesses) {
        const mp = b?.paymentSettings?.mercadopago;
        if (!mp?.accessToken) continue;
        candidates += 1;
        try {
          const token = await decryptSecret(mp.accessToken);
          const attempt = await verifyMercadoPagoPayment(token, paymentId);
          businessId = b.id;
          accessToken = token;
          result = attempt;
          console.log(`[MP webhook] fallback scan MATCHED business ${b.id} — status=${attempt.approved ? 'approved' : 'not approved'} externalReference=${attempt.externalReference}`);
          break;
        } catch (e) {
          console.log(`[MP webhook] fallback scan: business ${b.id} did not match (${(e as Error).message})`);
          continue; // not this business's payment — try the next one
        }
      }
      if (!result) {
        console.log(`[MP webhook] fallback scan exhausted — ${candidates} businesses had mercadopago credentials, none matched this payment`);
      }
    }

    if (!result || !businessId || !accessToken) {
      console.log('[MP webhook] giving up — could not identify the business for this payment');
      return c.json({ received: true });
    }

    // If the owner has set up a webhook secret, require a valid signature.
    const business = await kv.get(`business:${businessId}`);
    const webhookSecret = business?.paymentSettings?.mercadopago?.webhookSecret
      ? await decryptSecret(business.paymentSettings.mercadopago.webhookSecret)
      : null;
    if (webhookSecret) {
      const valid = await verifyMercadoPagoSignature({
        xSignature: c.req.header('x-signature'),
        xRequestId: c.req.header('x-request-id'),
        dataId: String(paymentId),
        webhookSecret,
      });
      if (!valid) {
        console.warn(`[MP webhook] signature mismatch for business ${businessId} — refusing to process`);
        return c.json({ received: true }); // ack without processing
      }
      console.log(`[MP webhook] signature verified OK for business ${businessId}`);
    } else {
      console.log(`[MP webhook] no webhook secret configured for business ${businessId} — skipping signature check`);
    }

    if (result.approved && result.externalReference) {
      console.log(`[MP webhook] CONFIRMING appointment ${result.externalReference}`);
      await confirmAppointmentByExternalReference(result.externalReference);
    } else {
      console.log(`[MP webhook] payment not approved (or no externalReference) — nothing to confirm. approved=${result.approved} externalReference=${result.externalReference}`);
    }
    return c.json({ received: true });
  } catch (error) {
    console.error('Error processing Mercado Pago webhook:', error);
    return c.json({ received: true }); // ack anyway so the provider doesn't retry forever
  }
});

// --- Asaas webhook ---
// IMPORTANT: never trust the webhook body's status/externalReference
// directly — anyone can POST arbitrary JSON to this URL. We only trust
// what we get back from re-querying Asaas's own API with the business's
// stored key, matching the pattern used for Mercado Pago above.
app.post('/webhooks/asaas', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const event = body?.event;
    const paymentId = body?.payment?.id;
    const businessId = c.req.query('businessId');
    if ((event !== 'PAYMENT_CONFIRMED' && event !== 'PAYMENT_RECEIVED') || !paymentId || !businessId) {
      return c.json({ received: true });
    }

    const business = await kv.get(`business:${businessId}`);
    const asaasSettings = business?.paymentSettings?.asaas;
    if (!asaasSettings?.apiKey) return c.json({ received: true });

    const result = await verifyAsaasPayment(await decryptSecret(asaasSettings.apiKey), asaasSettings.environment, paymentId);
    if (result.approved && result.externalReference) {
      await confirmAppointmentByExternalReference(result.externalReference);
    }
    return c.json({ received: true });
  } catch (error) {
    console.error('Error processing Asaas webhook:', error);
    return c.json({ received: true });
  }
});

// --- PagBank webhook ---
// Same rule as the others: never trust the webhook body directly — always
// re-verify the order status with PagBank's own API first.
app.post('/webhooks/pagbank', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const orderId = body?.id;
    const businessId = c.req.query('businessId');
    if (!orderId || !businessId) return c.json({ received: true });

    const business = await kv.get(`business:${businessId}`);
    const pbSettings = business?.paymentSettings?.pagbank;
    if (!pbSettings?.token) return c.json({ received: true });

    const result = await verifyPagBankPayment(await decryptSecret(pbSettings.token), pbSettings.environment, orderId);
    if (result.approved && result.externalReference) {
      await confirmAppointmentByExternalReference(result.externalReference);
    }
    return c.json({ received: true });
  } catch (error) {
    console.error('Error processing PagBank webhook:', error);
    return c.json({ received: true });
  }
});

// Reschedule an existing appointment (change day/time) — only the client
// who booked it, or that business's owner/platform admin, may do this.
app.put('/appointments/reschedule', async (c) => {
  try {
    const { user, profile, error, status } = await getAuthedProfile(c);
    if (error) return c.json({ error }, status);

    const { key, date, time } = await c.req.json();
    if (!key || !date || !time) {
      return c.json({ error: 'Dados insuficientes para reagendar.' }, 400);
    }

    const existing = await kv.get(key);
    if (!existing) {
      return c.json({ error: 'Agendamento não encontrado.' }, 404);
    }

    const isPlatformAdmin = user.email === PLATFORM_ADMIN_EMAIL;
    const isOwnerOfThisBusiness = profile?.role === 'owner' && profile.businessId === existing.businessId;
    const isTheClientWhoBookedIt = existing.userId === user.id;
    if (!isPlatformAdmin && !isOwnerOfThisBusiness && !isTheClientWhoBookedIt) {
      return c.json({ error: 'Você não tem permissão para reagendar este agendamento.' }, 403);
    }
    if (!isPlatformAdmin && isOwnerOfThisBusiness && !isTheClientWhoBookedIt) {
      const sub = await checkSubscriptionActive(existing.businessId);
      if (sub.blocked) return c.json({ error: sub.error }, 402);
    }

    const { day, month, year } = date;
    const scope = existing.businessId || 'default';
    const newKey = `appt_${scope}_${existing.professional.id}_${year}_${month}_${day}_${time}`;

    // If the slot actually changed, make sure the new slot is free.
    if (newKey !== key) {
      const clash = await kv.get(newKey);
      if (clash) {
        return c.json({ error: 'Este horário já está ocupado com esta profissional.' }, 409);
      }
    }

    const updated = {
      ...existing,
      key: newKey,
      date,
      time,
      updatedAt: new Date().toISOString(),
    };

    // Remove the old entry first, then write the new one.
    if (newKey !== key) await kv.del(key);
    await kv.set(newKey, updated);

    return c.json({ success: true, appointment: updated });
  } catch (error) {
    console.error('Error rescheduling appointment:', error);
    return c.json({ error: 'Falha ao reagendar.' }, 500);
  }
});

// Delete appointment — only the client who booked it, or that business's
// owner/platform admin, may do this. Appointment keys are predictable
// (professional/date/time based), so this must never be open to anyone
// who merely guesses or enumerates a key.
app.delete('/appointments/:key', async (c) => {
  try {
    const { user, profile, error, status } = await getAuthedProfile(c);
    if (error) return c.json({ error }, status);

    const key = c.req.param('key');
    const appt = await kv.get(key);
    if (!appt) return c.json({ error: 'Agendamento não encontrado.' }, 404);

    const isPlatformAdmin = user.email === PLATFORM_ADMIN_EMAIL;
    const isOwnerOfThisBusiness = profile?.role === 'owner' && profile.businessId === appt.businessId;
    const isTheClientWhoBookedIt = appt.userId === user.id;
    if (!isPlatformAdmin && !isOwnerOfThisBusiness && !isTheClientWhoBookedIt) {
      return c.json({ error: 'Você não tem permissão para cancelar este agendamento.' }, 403);
    }
    // Once the client has paid the deposit, they can no longer cancel it
    // themselves — only reschedule. The salon (owner/platform admin) can
    // still cancel a paid appointment if needed.
    if (isTheClientWhoBookedIt && !isOwnerOfThisBusiness && !isPlatformAdmin && appt.paid) {
      return c.json({ error: 'Este agendamento já foi pago e não pode mais ser cancelado — você pode remarcar a data ou horário.' }, 403);
    }
    // A client cancelling their own booking is unaffected by the salon's
    // SaaS subscription status — only block the OWNER's side of this action.
    if (!isPlatformAdmin && isOwnerOfThisBusiness && !isTheClientWhoBookedIt) {
      const sub = await checkSubscriptionActive(appt.businessId);
      if (sub.blocked) return c.json({ error: sub.error }, 402);
    }

    await kv.del(key);
    return c.json({ success: true });
  } catch (error) {
    console.error('Error deleting appointment:', error);
    return c.json({ error: 'Failed to delete appointment' }, 500);
  }
});

Deno.serve(app.fetch);