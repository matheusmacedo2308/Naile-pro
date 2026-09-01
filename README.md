<div align="center">

# 💅 Nailê Pro

**Plataforma SaaS multi-tenant de agendamentos para salões de beleza e estúdios de unhas**

*Experiência visual premium · Arquitetura escalável · Provador virtual em CSS puro*

![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-6-646CFF?style=flat-square&logo=vite&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=flat-square&logo=supabase&logoColor=white)
![License](https://img.shields.io/badge/status-em_desenvolvimento-C4956A?style=flat-square)

</div>

---

## ✨ Visão Geral

**Nailê Pro** é um sistema completo de gestão e agendamento online voltado para o mercado de beleza. A plataforma suporta múltiplos estúdios (*tenants*), onde cada empresa gerencia de forma independente seu catálogo de serviços, equipe de profissionais e agenda — enquanto os clientes finais podem marcar, remarcar e cancelar horários com **zero conflito de horários**.

## 🚀 Diferenciais

| | |
|---|---|
| 🏢 **Multi-tenant** | Cada estúdio opera em ambiente isolado, com dados e configurações próprias |
| 💅 **Provador Virtual Realista** | Simulação hiper-realista de esmaltes em CSS puro — 24 cores, 6 tons de pele, 3 formatos de unha |
| 🎨 **Design premium editorial** | Estética *warm editorial* com glassmorphism, animações 3D e efeitos de scroll sofisticados |
| 📱 **Responsivo total** | Experiência consistente em mobile, tablet e desktop |
| 🔐 **Controle de acesso granular** | Três níveis de permissão: superadmin, admin da empresa e cliente |

---

## 🛠️ Stack Tecnológica

| Camada | Tecnologia |
|---|---|
| **Frontend** | React 18 + Vite 6 |
| **Estilização** | Tailwind CSS v4 |
| **Animações** | Motion (Framer Motion v12) |
| **Componentes** | Radix UI + shadcn/ui |
| **Roteamento** | React Router v7 |
| **Backend / DB** | Supabase (PostgreSQL) |
| **Autenticação** | Supabase Auth |
| **Storage** | Supabase Storage |
| **Formulários** | React Hook Form |
| **Gráficos** | Recharts |
| **Notificações** | Sonner |
| **Ícones** | Lucide React |
| **Tipografia** | Cormorant · DM Sans · DM Mono |

---

## 📁 Estrutura do Projeto

```
src/
├── app/
│   ├── App.tsx                   # Componente raiz e roteamento
│   └── components/
│       ├── AdminPanel.tsx        # Painel de administração da plataforma
│       ├── ui/                   # Primitivos de UI (shadcn/ui)
│       └── figma/                # Utilitários de imagem com fallback
├── styles/
│   ├── fonts.css                 # Imports do Google Fonts
│   ├── theme.css                 # Tokens de design (cores, raios, sombras)
│   ├── globals.css               # Estilos globais
│   ├── index.css                 # Mapeamento @theme inline do Tailwind
│   └── tailwind.css              # Entrada do Tailwind
supabase/
└── functions/                    # Edge Functions do Supabase
```

---

## 🎨 Design System

### Paleta de Cores

<table>
<tr><th>Token</th><th>Valor</th><th>Uso</th></tr>
<tr><td><code>--background</code></td><td>🟤 <code>#FDF8F5</code></td><td>Fundo principal (creme quente)</td></tr>
<tr><td><code>--foreground</code></td><td>⬛ <code>#2C1810</code></td><td>Texto principal</td></tr>
<tr><td><code>--primary</code></td><td>🟠 <code>#C4956A</code></td><td>Ações primárias (caramelo)</td></tr>
<tr><td><code>--accent</code></td><td>🌸 <code>#E8C4B8</code></td><td>Destaques (rosa velho claro)</td></tr>
<tr><td><code>--muted</code></td><td>⚪ <code>#F5EDE8</code></td><td>Fundos secundários</td></tr>
</table>

### Tipografia

- **Cormorant Garamond** — títulos editoriais, headings de luxo
- **DM Sans** — corpo de texto, interface funcional
- **DM Mono** — dados, horários, códigos

---

## 🏗️ Arquitetura Multi-Tenant

```
Platform (Superadmin)
└── Tenant / Estúdio (Admin)
    ├── Serviços
    ├── Profissionais
    ├── Agenda
    └── Clientes
```

### Níveis de Acesso

| Perfil | Capacidades |
|---|---|
| 🛡️ **Superadmin** | Gerencia todos os tenants, visualiza métricas globais, configura planos |
| 🏪 **Admin** | Gerencia seu estúdio: serviços, profissionais, agenda, relatórios |
| 👤 **Cliente** | Agenda, reagenda e cancela horários; acessa histórico e provador virtual |

---

## ⚙️ Funcionalidades Principais

<details open>
<summary><strong>💁‍♀️ Para Clientes</strong></summary>
<br>

- Agendamento online com seleção de serviço, profissional, data e horário
- Reagendamento e cancelamento com política configurável pelo estúdio
- Provador virtual de esmaltes antes do agendamento
- Histórico de atendimentos e favoritos

</details>

<details>
<summary><strong>🏪 Para Admins do Estúdio</strong></summary>
<br>

- Gestão completa da agenda com detecção automática de conflitos
- Cadastro de serviços com duração, preço e fotos
- Gerenciamento de profissionais com horários e especialidades
- Relatórios de faturamento e ocupação

</details>

<details>
<summary><strong>🛡️ Para Superadmin</strong></summary>
<br>

- Painel de controle de todos os tenants cadastrados
- Métricas globais da plataforma
- Gerenciamento de planos e limites por tenant

</details>

---

## 💅 Provador Virtual

O **Provador Virtual** é um diferencial exclusivo da plataforma, renderizado inteiramente em **CSS puro**, sem dependências externas:

- 🎨 **24 cores profissionais** organizadas em 5 categorias (Neutros, Nude, Rosa, Vermelhos, Especiais)
- 🖐️ **6 tons de pele** (porcelana ao chocolate)
- 💎 **3 formatos de unha** (amendoada, quadrada, stiletto)
- ✨ Renderização hiper-realista com cutícula, reflexos de gel e linhas de articulação
- 👀 Permite ao cliente visualizar o resultado antes de agendar

---

## 🧑‍💻 Configuração Local

### Pré-requisitos

- Node.js 18+
- pnpm 8+
- Projeto Supabase configurado

### Instalação

```bash
# Instalar dependências
pnpm install

# Configurar variáveis de ambiente
cp .env.example .env.local
# Preencher VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY

# Iniciar em desenvolvimento
pnpm dev

# Build de produção
pnpm build
```

### Variáveis de Ambiente

```env
VITE_SUPABASE_URL=https://<projeto>.supabase.co
VITE_SUPABASE_ANON_KEY=<chave-anon-publica>
```

---

## 🔒 Segurança

- ✅ Credenciais nunca expostas em tela ou código-fonte
- ✅ Autenticação gerenciada pelo Supabase Auth (JWT)
- ✅ Row Level Security (RLS) no banco para isolamento por tenant
- ✅ Variáveis sensíveis exclusivamente via `.env.local` (fora do controle de versão)

---

## 🗺️ Roadmap

- [ ] Notificações por WhatsApp (confirmação e lembrete de agendamento)
- [ ] Pagamento online integrado (Stripe / Pagar.me)
- [ ] App mobile (React Native)
- [ ] Programa de fidelidade e pacotes de serviços
- [ ] Integração com Google Calendar
- [ ] Relatórios avançados com exportação PDF/CSV

---

<div align="center">

*Feito com 🤎 para transformar a gestão de estúdios de beleza*

</div>
