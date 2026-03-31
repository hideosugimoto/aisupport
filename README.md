# AI Support

[日本語版 / Japanese](README_ja.md)

An AI-powered decision support assistant that helps you prioritize tasks, compare options, and stay informed — all aligned with your personal goals and values.

## Core Features

- **Compass** — Register your goals, dreams, and values (text/URL/image). The compass is the central axis of all decisions — Decide, Compare, and Weekly Review all reference it.
- **Task Decision** — Input your tasks, energy level, and available time. AI recommends the optimal task aligned with your compass. Streaming responses include compass relevance and context metadata in real time.
- **Option Comparison** — Compare the same input across multiple AI engines (OpenAI, Gemini, Claude), all sharing the same compass context. See which compass items influenced the comparison.
- **Weekly Review** — AI analyzes your past week's decisions against your compass, highlights neglected goals, and suggests improvements.

## Supporting Features

- **Document RAG** — Upload PDFs and text files for AI to use as additional context in decisions.
- **News Feed** — Set keywords and receive curated news daily via Cron, with email digests.
- **Cost Dashboard** — Track LLM API usage and costs in real time with budget alerts.
- **Push Notifications** — Daily reminders and budget alerts via Web Push.
- **BYOK (Bring Your Own Key)** — Use your own API keys for OpenAI, Google AI, or Anthropic (encrypted at rest).
- **Stripe Billing** — Free and Pro plans with Stripe-powered subscriptions.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | [Next.js 16](https://nextjs.org/) (App Router) |
| Language | TypeScript |
| Database | PostgreSQL ([Supabase](https://supabase.com/)) via [Prisma](https://www.prisma.io/) |
| Auth | [Clerk](https://clerk.com/) |
| LLM | OpenAI (gpt-4o-mini) / Google AI (Gemini) / Anthropic (Claude) |
| Payments | [Stripe](https://stripe.com/) |
| Email | [Resend](https://resend.com/) |
| Push | Web Push (VAPID) |
| PDF Parsing | [unpdf](https://github.com/unjs/unpdf) |
| Testing | [Vitest](https://vitest.dev/) + [Playwright](https://playwright.dev/) |
| Styling | [Tailwind CSS v4](https://tailwindcss.com/) |
| Deployment | [Vercel](https://vercel.com/) |

## Architecture

```
src/
├── app/                    # Next.js App Router
│   ├── (app)/              # Authenticated pages
│   │   ├── dashboard/      # Main dashboard
│   │   ├── compare/        # Option comparison
│   │   ├── compass/        # Goals & values
│   │   ├── documents/      # Document management
│   │   ├── feed/           # News feed
│   │   ├── cost/           # Usage & cost tracking
│   │   ├── history/        # Decision history
│   │   └── settings/       # User settings
│   ├── (marketing)/        # Public pages (privacy, terms)
│   └── api/                # API routes
├── lib/                    # Business logic (framework-independent)
│   ├── llm/                # LLM client abstraction
│   ├── rag/                # RAG pipeline (embeddings + retrieval)
│   ├── feed/               # News fetcher & digest
│   ├── compass/            # Goals/values engine
│   ├── decision/           # Task decision logic
│   ├── compare/            # Comparison engine
│   ├── billing/            # Plan & usage management
│   ├── stripe/             # Stripe integration
│   └── ...
config/                     # Feature flags & configuration
prompts/                    # LLM prompt templates (externalized)
prisma/                     # Database schema
```

### Design Principles

- **Compass-Centric** — All decision features (Decide, Compare, Weekly Review) share the same compass context
- **Dependency Inversion** — All dependencies go through interfaces
- **Framework Independence** — Business logic in `src/lib/` has no Next.js dependency
- **Thin Controllers** — API routes are minimal wrappers around business logic
- **Externalized Prompts** — LLM prompts managed as files in `prompts/`, never hardcoded
- **Externalized Config** — Magic numbers live in `config/features.json`

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL (or [Supabase](https://supabase.com/) account)

### Required Accounts

| Service | Purpose | Required | Free Tier |
|---------|---------|:--------:|-----------|
| [Clerk](https://clerk.com) | Authentication | **Yes** | 10,000 MAU |
| [Supabase](https://supabase.com) | PostgreSQL database | **Yes** | 500MB |
| [OpenAI](https://platform.openai.com) | LLM + Embedding + Vision | **Yes** | Pay-as-you-go |
| [Vercel](https://vercel.com) | Hosting | **Yes** | Hobby plan free |
| [Stripe](https://stripe.com) | Billing (Pro plan) | Optional | Transaction fees only |
| [Google AI](https://aistudio.google.com) | Gemini models | Optional | Free tier available |
| [Anthropic](https://console.anthropic.com) | Claude models | Optional | Pay-as-you-go |
| [Resend](https://resend.com) | Email digests | Optional | 3,000 emails/month |

### Setup

```bash
# 1. Clone
git clone <repository-url>
cd aisupport

# 2. Install dependencies
npm install

# 3. Configure environment variables
cp .env.local.example .env.local
# Edit .env.local with your keys

# 4. Generate encryption key (for BYOK)
openssl rand -hex 32

# 5. Generate VAPID keys (for Web Push)
node scripts/generate-vapid-keys.js

# 6. Set up database
npx prisma db push

# 7. Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string (pooled, port 6543) |
| `DIRECT_URL` | PostgreSQL direct connection (port 5432) |
| `OPENAI_API_KEY` | OpenAI API key |
| `GOOGLE_AI_API_KEY` | Google AI API key (optional) |
| `ANTHROPIC_API_KEY` | Anthropic API key (optional) |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key |
| `CLERK_SECRET_KEY` | Clerk secret key |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `STRIPE_PRO_PRICE_ID` | Stripe Pro plan price ID |
| `NEXT_PUBLIC_APP_URL` | Application URL |
| `API_KEY_ENCRYPTION_KEY` | 64-char hex for BYOK encryption |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | VAPID public key |
| `VAPID_PRIVATE_KEY` | VAPID private key |
| `VAPID_EMAIL` | VAPID contact email |
| `RESEND_API_KEY` | Resend API key for email digests |
| `DIGEST_FROM_EMAIL` | Digest sender email address |

See `.env.local.example` for a complete template.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm start` | Start production server |
| `npm test` | Run unit tests (Vitest) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run dev:e2e` | Start dev server for E2E tests |
| `npm run test:e2e` | Run E2E tests (Playwright) |
| `npm run lint` | Run ESLint |
| `npm run db:push` | Push Prisma schema to database |

## Cron Jobs

Configured in `vercel.json` for Vercel deployment:

| Schedule | Endpoint | Description |
|----------|----------|-------------|
| Daily 6:00 UTC | `/api/feed/cron` | Fetch news articles |
| Daily 0:00 UTC | `/api/feed/digest-cron` | Send email digests |

## Deployment (Vercel)

1. Import the repository on [Vercel](https://vercel.com)
2. Set all environment variables in **Settings > Environment Variables**
3. Deploy — subsequent pushes auto-deploy
4. Configure Stripe webhook endpoint: `https://your-domain.vercel.app/api/stripe/webhook`
5. Switch Clerk to production instance and update keys

### Estimated Cost (Personal Use)

| Service | Monthly Cost |
|---------|-------------|
| Vercel (Hobby) | Free |
| Clerk | Free (under 10,000 MAU) |
| Supabase | Free (under 500MB) |
| OpenAI | ~$1–5 |
| **Total** | **~$1–5/month** |

## License

This project is licensed under a **proprietary license**. It is NOT open-source software.

- **Permitted:** Personal use, learning, modification for personal use
- **Prohibited:** Commercial use, SaaS/API offering, redistribution, competing services

See [LICENSE](LICENSE) for the full terms.
