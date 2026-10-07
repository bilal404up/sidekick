-- Sidekick demo tables. All rows are sample data or visitor chats from the demo.
-- Access is server-side only (service role). RLS is on with no policies, so the public key can read nothing.

create table if not exists public.sk_faq (
  id uuid primary key default gen_random_uuid(),
  category text not null default 'General',
  question text not null check (char_length(question) between 3 and 300),
  answer text not null check (char_length(answer) between 3 and 1200),
  keywords text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.sk_conversations (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  ip_hash text,
  is_sample boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists sk_conversations_session on public.sk_conversations (session_id);
create index if not exists sk_conversations_created on public.sk_conversations (created_at desc);

create table if not exists public.sk_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.sk_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'bot')),
  content text not null,
  kind text check (kind in ('answer', 'unknown', 'smalltalk')),
  mode text check (mode in ('faq', 'model', 'model-fallback', 'none')),
  faq_id uuid references public.sk_faq(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists sk_messages_conv on public.sk_messages (conversation_id, created_at);

create table if not exists public.sk_unanswered (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.sk_conversations(id) on delete cascade,
  question text not null,
  status text not null default 'open' check (status in ('open', 'added', 'dismissed')),
  resolved_faq_id uuid references public.sk_faq(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists sk_unanswered_status on public.sk_unanswered (status, created_at desc);

alter table public.sk_faq enable row level security;
alter table public.sk_conversations enable row level security;
alter table public.sk_messages enable row level security;
alter table public.sk_unanswered enable row level security;
