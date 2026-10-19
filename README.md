# Minha agenda Nail

Plataforma SaaS multi-tenant de agendamentos para salões de beleza e estúdios de unhas, com experiência visual premium e arquitetura escalável.

---

## Visão Geral

Minha agenda Nail é um sistema completo de gestão e agendamento online voltado para o mercado de beleza. A plataforma suporta múltiplos estúdios (tenants), onde cada empresa gerencia de forma independente seu catálogo de serviços, equipe de profissionais e agenda — enquanto os clientes finais podem marcar, remarcar e cancelar horários com zero conflito de horários.

### Diferenciais

- **Multi-tenant** — cada estúdio opera em ambiente isolado com dados e configurações próprias
- **Design premium editorial** — estética "warm editorial" com glassmorphism, animações 3D e efeitos de scroll sofisticados
- **Responsivo total** — experiência consistente em mobile, tablet e desktop
- **Controle de acesso granular** — três níveis de permissão: superadmin, admin da empresa e cliente

---

## Stack Tecnológica

| Camada | Tecnologia |
|---|---|
| Frontend | React 18 + Vite 6 |
| Estilização | Tailwind CSS v4 |
| Animações | Motion (Framer Motion v12) |
| Componentes | Radix UI + shadcn/ui |
| Roteamento | React Router v7 |
| Backend / DB | Supabase (PostgreSQL) |
| Autenticação | Supabase Auth |
| Storage | Supabase Storage |
| Formulários | React Hook Form |
| Gráficos | Recharts |
| Notificações | Sonner |
| Ícones | Lucide React |
| Tipografia | Cormorant · DM Sans · DM Mono |

---

## Estrutura do Projeto

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

## Design System

### Paleta de Cores

| Token | Valor | Uso |
|---|---|---|
| `--background` | `#FDF8F5` | Fundo principal (creme quente) |
| `--foreground` | `#2C1810` | Texto principal |
| `--primary` | `#C4956A` | Ações primárias (caramelo) |
| `--accent` | `#E8C4B8` | Destaques (rosa velho claro) |
| `--muted` | `#F5EDE8` | Fundos secundários |

### Tipografia

- **Cormorant Garamond** — títulos editoriais, headings de luxo
- **DM Sans** — corpo de texto, interface funcional
- **DM Mono** — dados, horários, códigos

---

## Arquitetura Multi-Tenant

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
| **Superadmin** | Gerencia todos os tenants, visualiza métricas globais, configura planos |
| **Admin** | Gerencia seu estúdio: serviços, profissionais, agenda, relatórios |
| **Cliente** | Agenda, reagenda e cancela horários; acessa seu histórico |

---

## Funcionalidades Principais

### Para Clientes
- Agendamento online com seleção de serviço, profissional, data e horário
- Reagendamento e cancelamento com política configurável pelo estúdio
- Histórico de atendimentos e favoritos

### Para Admins do Estúdio
- Gestão completa da agenda com detecção automática de conflitos
- Cadastro de serviços com duração, preço e fotos
- Gerenciamento de profissionais com horários e especialidades
- Relatórios de faturamento e ocupação

### Para Superadmin
- Painel de controle de todos os tenants cadastrados
- Métricas globais da plataforma
- Gerenciamento de planos e limites por tenant

---

## Configuração Local

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

## Segurança

- Credenciais nunca expostas em tela ou código-fonte
- Autenticação gerenciada pelo Supabase Auth (JWT)
- Row Level Security (RLS) no banco para isolamento por tenant
- Variáveis sensíveis exclusivamente via `.env.local` (fora do controle de versão)

---

## Roadmap

- [ ] Notificações por WhatsApp (confirmação e lembrete de agendamento)
- [ ] Pagamento online integrado (Stripe / Pagar.me)
- [ ] App mobile (React Native)
- [ ] Programa de fidelidade e pacotes de serviços
- [ ] Integração com Google Calendar
- [ ] Relatórios avançados com exportação PDF/CSV
