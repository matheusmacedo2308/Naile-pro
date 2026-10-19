#!/usr/bin/env node
// teste-seguranca.mjs
// Testes automáticos de segurança para o SEU app (Supabase + Edge Function).
// Cria contas e agendamentos de TESTE (prefixo "sectest-") e tenta acessos
// indevidos entre salões, clientes e usuários anônimos.
//
// Uso (na raiz do projeto, onde existe utils/supabase/info.tsx):
//   node teste-seguranca.mjs
// Opcional:
//   WRITE_TEST=1 node teste-seguranca.mjs   (testa também escrita anônima no banco)
// Requer Node 18 ou superior.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { randomBytes } from "node:crypto";

// ---------------------------------------------------------------
// Configuração (lê do próprio projeto; a chave anon é pública)
// ---------------------------------------------------------------
let PROJECT = process.env.PROJECT_ID;
let ANON = process.env.ANON_KEY;
for (const p of ["./utils/supabase/info.tsx", "../utils/supabase/info.tsx"]) {
  if ((!PROJECT || !ANON) && existsSync(p)) {
    const t = readFileSync(p, "utf8");
    PROJECT ||= t.match(/projectId\s*=\s*"([^"]+)"/)?.[1];
    ANON ||= t.match(/publicAnonKey\s*=\s*"([^"]+)"/)?.[1];
  }
}
if (!PROJECT || !ANON) {
  console.error(
    "Não achei o projectId / chave anon.\n" +
      "Coloque este arquivo na raiz do projeto (onde existe utils/supabase/info.tsx)\n" +
      "ou rode com: PROJECT_ID=xxxx ANON_KEY=eyJ... node teste-seguranca.mjs"
  );
  process.exit(1);
}

const BASE = `https://${PROJECT}.supabase.co`;
const FN = `${BASE}/functions/v1/make-server-a3611da8`;
const KV_TABLE = "kv_store_a3611da8";

// ---------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------
const lines = [];
const out = (s = "") => {
  console.log(s);
  lines.push(s);
};
const counts = { PASS: 0, FAIL: 0, WARN: 0, INFO: 0, SKIP: 0 };
const fails = [];
const rec = (level, name, detail = "") => {
  counts[level]++;
  if (level === "FAIL") fails.push(name);
  out(`[${level}] ${name}${detail ? " — " + detail : ""}`);
};
const title = (s) => out(`\n== ${s} ==`);
const cut = (s, n = 160) => (s.length > n ? s.slice(0, n) + "…" : s);

async function http(url, { method = "GET", token, body, headers = {} } = {}) {
  try {
    const res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        apikey: ANON,
        Authorization: `Bearer ${token || ANON}`,
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {}
    return { status: res.status, text, json, headers: res.headers };
  } catch (e) {
    return { status: 0, text: String(e), json: null, headers: new Headers() };
  }
}
const fn = (path, opts) => http(FN + path, opts);
const ok = (r) => r.status >= 200 && r.status < 300 && !(r.json && r.json.error);

const RUN = randomBytes(3).toString("hex");
const GOOD_PASS = `Sec!${randomBytes(6).toString("hex")}Aa1`;
const mkEmail = (tag) => `sectest-${tag}-${RUN}@example.com`;
const PHONE = "21988880000";
const createdEmails = [];

function genCPF() {
  const n = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));
  const dv = (arr) => {
    const m = arr.length + 1;
    const s = arr.reduce((a, d, i) => a + d * (m - i), 0);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  n.push(dv(n));
  n.push(dv(n));
  return n.join("");
}

async function registerBusiness(tag) {
  const email = mkEmail(tag);
  createdEmails.push(email);
  const r = await fn("/register-business", {
    method: "POST",
    body: {
      businessName: `SECTEST Salao ${tag} ${RUN}`,
      ownerName: `SecTest ${tag}`,
      email,
      password: GOOD_PASS,
      phone: "21999990000",
      cpfCnpj: genCPF(),
    },
  });
  return { r, email };
}

async function registerClient(tag, password = GOOD_PASS) {
  const email = mkEmail(tag);
  createdEmails.push(email);
  const r = await fn("/register-client", {
    method: "POST",
    body: { name: `SecTest ${tag}`, email, password, phone: PHONE },
  });
  return { r, email };
}

async function login(email, password = GOOD_PASS) {
  const r = await http(`${BASE}/auth/v1/token?grant_type=password`, {
    method: "POST",
    body: { email, password },
  });
  if (r.status === 200 && r.json?.access_token) {
    return { ok: true, token: r.json.access_token, id: r.json.user?.id, email };
  }
  return { ok: false, r, email };
}

async function makeUser(kind, tag) {
  const { r, email } = kind === "business" ? await registerBusiness(tag) : await registerClient(tag);
  if (!ok(r)) {
    return { fail: `cadastro de ${tag} falhou: HTTP ${r.status} ${cut(r.text)}` };
  }
  const l = await login(email);
  if (!l.ok) return { fail: `login de ${tag} falhou: HTTP ${l.r.status} ${cut(l.r.text)}` };
  return l;
}

// ---------------------------------------------------------------
// Execução
// ---------------------------------------------------------------
async function main() {
  out(`Teste de segurança — ${new Date().toLocaleString("pt-BR")}`);
  out(`Projeto: ${PROJECT}  |  execução: ${RUN}`);

  const health = await fn("/health");
  if (health.status === 0) {
    out("\nSem conexão com o servidor. Verifique sua internet e tente de novo.");
    out(cut(health.text, 200));
    return finish(true);
  }

  // -------------------------------------------------------------
  title("1. Criando contas de teste");
  const A = await makeUser("business", "A");
  const B = await makeUser("business", "B");
  const C = await makeUser("client", "C");
  const D = await makeUser("client", "D");
  for (const [n, u] of [["Salão A", A], ["Salão B", B], ["Cliente C", C], ["Cliente D", D]]) {
    if (u.fail) {
      rec("FAIL", `Criar ${n}`, u.fail);
    } else {
      rec("PASS", `Criar ${n}`, "conta criada e login feito");
    }
  }
  if ([A, B, C, D].some((u) => u.fail)) {
    out(
      "\nNão deu para criar todas as contas, então os testes de autorização foram pulados.\n" +
        "Se o erro for de validação (CPF, telefone, etc.), me envie a mensagem acima."
    );
    return finish(true);
  }
  rec("WARN", "E-mail sem confirmação", "contas ficam utilizáveis logo após o cadastro, sem verificar o e-mail");

  for (const [n, u] of [["Salão A", A], ["Salão B", B]]) {
    const p = await fn("/profile", { token: u.token });
    u.bid = p.json?.profile?.businessId || p.json?.business?.id;
    if (!u.bid) {
      rec("FAIL", `Perfil do ${n}`, `sem businessId (HTTP ${p.status} ${cut(p.text)})`);
      return finish(true);
    }
  }
  rec("INFO", "Salões criados", `A=${A.bid}  B=${B.bid}`);

  // -------------------------------------------------------------
  title("2. Endpoints protegidos sem login (chave anon)");
  const protectedPaths = [
    "/profile",
    "/notifications",
    "/business/payment-settings",
    `/appointments?businessId=${B.bid}`,
  ];
  for (const p of protectedPaths) {
    const r = await fn(p);
    if (r.status === 401 || r.status === 403) rec("PASS", `Anônimo em ${p.split("?")[0]}`, `HTTP ${r.status}`);
    else if (r.status === 200) rec("FAIL", `Anônimo em ${p.split("?")[0]}`, "respondeu 200 sem login");
    else rec("INFO", `Anônimo em ${p.split("?")[0]}`, `HTTP ${r.status}`);
  }

  // -------------------------------------------------------------
  title("3. Cliente acessando áreas de dono");
  const ps = await fn("/business/payment-settings", { token: C.token });
  if (ps.status === 401 || ps.status === 403) {
    rec("PASS", "Cliente lendo configurações de pagamento", `HTTP ${ps.status}`);
  } else if (ps.status === 200 && ps.json?.paymentSettings) {
    rec("FAIL", "Cliente lendo configurações de pagamento", "cliente recebeu dados de pagamento");
  } else {
    rec("WARN", "Cliente lendo configurações de pagamento", `HTTP ${ps.status} — confira manualmente`);
  }

  // -------------------------------------------------------------
  title("4. Agendamento e isolamento entre salões");
  const bd = await fn(`/business-data?businessId=${B.bid}`);
  const service = bd.json?.data?.services?.[0]?.items?.[0] || { id: "m1", name: "Manicure Simples", duration: "45 min", price: "R$ 45" };
  const professional = bd.json?.data?.professionals?.[0] || { id: 1, name: "Ana Luiza" };

  const d = new Date();
  d.setDate(d.getDate() + 10);
  while (d.getDay() !== 3) d.setDate(d.getDate() + 1); // próxima quarta-feira
  const date = { day: d.getDate(), month: d.getMonth(), year: d.getFullYear() };
  const mk = (who, bid, time, extra = {}) => ({
    service, professional, date, time,
    userId: who.id, userEmail: who.email, userPhone: PHONE,
    businessId: bid, returnUrl: "https://example.com/", ...extra,
  });

  // Agendamento legítimo do cliente D (do mesmo jeito que o app faz hoje)
  const bookD = await fn("/appointments", { method: "POST", body: mk(D, B.bid, "09:00") });
  if (!ok(bookD)) {
    rec("WARN", "Agendamento legítimo do Cliente D", `falhou: HTTP ${bookD.status} ${cut(bookD.text)}`);
    rec("SKIP", "Testes 4a a 4c", "dependem de um agendamento criado");
  } else {
    rec("PASS", "Agendamento legítimo do Cliente D", "criado");

    // 4a. Salão A lê dados do Salão B
    const r5 = await fn(`/appointments?businessId=${B.bid}`, { token: A.token });
    const listA = r5.json?.appointments;
    const leakA = r5.text.includes(D.email) || (r5.status === 200 && Array.isArray(listA) && listA.length > 0);
    if (leakA) rec("FAIL", "Salão A lendo agendamentos do Salão B", "dados de outro salão vazaram");
    else rec("PASS", "Salão A lendo agendamentos do Salão B", `HTTP ${r5.status}, nada de B retornado`);

    // 4b. Cliente C vê dados pessoais de outro cliente?
    const r6 = await fn(`/appointments?businessId=${B.bid}`, { token: C.token });
    if (r6.text.includes(D.email)) rec("FAIL", "Cliente C vendo dados do Cliente D", "e-mail de outro cliente exposto");
    else rec("PASS", "Cliente C vendo dados do Cliente D", `HTTP ${r6.status}, sem dados pessoais de outros`);

    // 4c. Cliente C agenda em nome de D usando o próprio token
    const spoof = await fn("/appointments", { method: "POST", token: C.token, body: mk(D, B.bid, "09:30") });
    if (!ok(spoof)) {
      rec("PASS", "Agendar em nome de outro usuário (com login)", `recusado: HTTP ${spoof.status}`);
    } else {
      const rd = await fn(`/appointments?businessId=${B.bid}`, { token: D.token });
      const found = rd.json?.appointments?.some((a) => a.time === "09:30");
      if (found) rec("FAIL", "Agendar em nome de outro usuário (com login)", "o servidor aceitou o userId enviado pelo navegador");
      else rec("PASS", "Agendar em nome de outro usuário (com login)", "aceito, mas não atribuído à vítima");
    }
  }

  // 4d. Agendamento sem login e com userId inventado (é como o app envia hoje)
  const anonBook = await fn("/appointments", {
    method: "POST",
    body: mk({ id: crypto.randomUUID(), email: "sectest-fantasma@example.com" }, B.bid, "10:00"),
  });
  if (ok(anonBook)) {
    rec("FAIL", "Agendamento sem login e com userId inventado", "aceito. Hoje o app envia a chave anon (App.tsx ~linha 738); corrija os dois lados");
  } else {
    rec("PASS", "Agendamento sem login e com userId inventado", `recusado: HTTP ${anonBook.status}`);
  }

  // 4e. Dois agendamentos simultâneos no mesmo horário
  const [r1, r2] = await Promise.all([
    fn("/appointments", { method: "POST", body: mk(C, B.bid, "11:00") }),
    fn("/appointments", { method: "POST", body: mk(D, B.bid, "11:00") }),
  ]);
  const wins = [r1, r2].filter(ok).length;
  if (wins === 2) rec("FAIL", "Horário duplicado (corrida)", "os dois agendamentos simultâneos foram aceitos");
  else if (wins === 1) rec("PASS", "Horário duplicado (corrida)", "só um foi aceito");
  else rec("WARN", "Horário duplicado (corrida)", `nenhum aceito (${r1.status}/${r2.status}); teste inconclusivo`);

  // -------------------------------------------------------------
  title("5. Cadastro e senha");
  const weak = await registerClient("fraca", "123456");
  if (ok(weak.r)) rec("WARN", "Senha fraca aceita", "senha '123456' foi aceita no cadastro");
  else rec("PASS", "Senha fraca aceita", `recusada: HTTP ${weak.r.status}`);

  // -------------------------------------------------------------
  title("6. CORS da API");
  const cors = await http(`${FN}/appointments`, { method: "OPTIONS", headers: { Origin: "https://evil.example" } });
  const acao = cors.headers.get("access-control-allow-origin");
  if (acao === "*" || acao === "https://evil.example") {
    rec("INFO", "CORS da API", `aceita qualquer origem (${acao}). Baixo risco com token Bearer; restrinja ao seu domínio quando puder`);
  } else {
    rec("PASS", "CORS da API", acao ? `origem permitida: ${acao}` : "sem CORS aberto");
  }

  // -------------------------------------------------------------
  title("7. Banco de dados (tabelas acessíveis pela chave anon)");
  for (const [label, token] of [["anônimo", ANON], ["cliente logado", C.token]]) {
    const r = await http(`${BASE}/rest/v1/${KV_TABLE}?select=key&limit=5`, { token });
    if (r.status === 200 && Array.isArray(r.json) && r.json.length > 0) {
      rec("FAIL", `Leitura de ${KV_TABLE} (${label})`, `${r.json.length}+ linhas legíveis. Rode: alter table ${KV_TABLE} enable row level security;`);
    } else if (r.status === 200 && Array.isArray(r.json)) {
      rec("PASS", `Leitura de ${KV_TABLE} (${label})`, "retornou vazio mesmo com dados criados (RLS ativo)");
    } else if (r.status === 404) {
      rec("INFO", `Leitura de ${KV_TABLE} (${label})`, "tabela não encontrada com esse nome");
    } else {
      rec("PASS", `Leitura de ${KV_TABLE} (${label})`, `bloqueado: HTTP ${r.status}`);
    }
  }

  const spec = await http(`${BASE}/rest/v1/`);
  const tables = spec.json?.paths
    ? Object.keys(spec.json.paths).filter((p) => p !== "/" && !p.startsWith("/rpc/")).map((p) => p.slice(1))
    : null;
  if (!tables) {
    rec("INFO", "Lista de tabelas expostas", "o Supabase não listou tabelas para a chave anon");
  } else {
    rec("INFO", "Tabelas visíveis para a chave anon", tables.join(", ") || "(nenhuma)");
    for (const t of tables) {
      const r = await http(`${BASE}/rest/v1/${t}?select=*&limit=1`);
      if (r.status === 200 && Array.isArray(r.json) && r.json.length > 0) {
        rec("FAIL", `Tabela "${t}" legível sem login`, "ative o RLS nessa tabela");
      }
    }
  }

  if (process.env.WRITE_TEST === "1") {
    const w = await http(`${BASE}/rest/v1/${KV_TABLE}`, {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: { key: `__sectest__${RUN}`, value: { teste: true } },
    });
    if (w.status === 201 || w.status === 204) {
      await http(`${BASE}/rest/v1/${KV_TABLE}?key=eq.__sectest__${RUN}`, { method: "DELETE" });
      rec("FAIL", "Escrita anônima no banco", "a chave anon conseguiu gravar (linha de teste removida)");
    } else {
      rec("PASS", "Escrita anônima no banco", `bloqueada: HTTP ${w.status}`);
    }
  } else {
    rec("SKIP", "Escrita anônima no banco", "rode com WRITE_TEST=1 para incluir");
  }

  // -------------------------------------------------------------
  title("8. Força bruta no login");
  const tries = await Promise.all(
    Array.from({ length: 15 }, () => login(A.email, "senha-errada-" + Math.random()))
  );
  const limited = tries.filter((t) => !t.ok && t.r.status === 429).length;
  if (limited > 0) rec("PASS", "Limite de tentativas de login", `${limited} de 15 tentativas bloqueadas (HTTP 429)`);
  else rec("INFO", "Limite de tentativas de login", "nenhuma das 15 tentativas foi bloqueada; considere CAPTCHA");

  title("Não testado automaticamente");
  out("- admin@maisonnaile.com: confirme que a conta existe, tem senha forte e que você controla o domínio.");
  out("- O servidor deve checar o papel (role) no banco, não o e-mail fixo do front-end.");
  return finish();
}

function finish(incomplete = false) {
  title("RESUMO");
  out(
    `PASS: ${counts.PASS}  FAIL: ${counts.FAIL}  WARN: ${counts.WARN}  INFO: ${counts.INFO}  SKIP: ${counts.SKIP}`
  );
  if (incomplete) {
    out("\nResultado: TESTES INTERROMPIDOS. Não dá para concluir nada ainda; veja a mensagem acima.");
  } else if (counts.FAIL > 0) {
    out("\nResultado: NÃO LANCE AINDA. Falhas encontradas:");
    for (const f of fails) out(`  - ${f}`);
  } else if (counts.WARN > 0) {
    out("\nResultado: sem falhas graves, mas com ressalvas (WARN). Veja acima.");
  } else {
    out("\nResultado: nenhuma falha encontrada nestes testes.");
  }

  if (createdEmails.length) {
    out("\nLIMPEZA: apague os dados de teste.");
    out("Painel do Supabase > Authentication > Users: busque por 'sectest-' e apague.");
    out("SQL Editor, primeiro confira com:");
    out(`  select key from ${KV_TABLE} where value::text ilike '%sectest%';`);
    out("e se a lista só tiver itens de teste, apague com:");
    out(`  delete from ${KV_TABLE} where value::text ilike '%sectest%';`);
    out("Contas criadas: " + createdEmails.join(", "));
  }

  writeFileSync("relatorio-testes.txt", lines.join("\n") + "\n");
  out("\nRelatório salvo em relatorio-testes.txt");
}

main().catch((e) => {
  console.error("Erro inesperado:", e);
  finish();
});
