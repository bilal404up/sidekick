# Sidekick: a support chatbot that only answers from your FAQ

A demo support assistant for a fictional shop (Fernbrook Garden Supply). It answers from the shop's own FAQ, says so when it does not know, and saves unanswered questions for the owner, who adds the missing answer in one step.

This is a demo. The shop, its 24 FAQ entries and the sample conversations are invented.

## What it does
- **Answers from the FAQ.** Each reply shows which entry it came from.
- **Does not guess.** If too few of the question's words appear in the best entry, it says it does not know. That path never reaches a language model, so it costs nothing.
- **Owner queue.** Unknown questions land in an admin tab. Adding an answer creates a FAQ entry, and the assistant knows it from then on.
- **Removes personal details.** Email addresses and phone numbers are stripped before a chat is stored.
- **Embeds anywhere.** One script line adds a chat button that opens the assistant in a frame.
- **Optional language model.** With an OpenAI-compatible key it rewrites the matching entry in plain words. It is given only that entry and told to answer `NOT_IN_FAQ` if the entry does not cover the question. Without a key it quotes the entry. The header shows which mode is on.

## How the matching works
1. Questions and entries are lowercased, stop words are removed and words are lightly stemmed.
2. Entries are ranked with BM25. The question counts three times, keywords twice and the answer once.
3. The best entry must also cover at least 60% of the question's meaningful words, weighted by how rare each word is. Words the FAQ has never seen weigh the most and can never match, so a question full of unknown words cannot pass on one common word.
4. Small talk (hello, thanks) is handled before any search.

## Stack
Next.js 14 (App Router, TypeScript), Tailwind, Supabase (Postgres, server-side access only), deployable on Vercel. No client-side database access: the tables have row-level security on and no policies.

## Setup
1. `npm install`
2. Create a Supabase project and run `supabase/schema.sql` in the SQL editor.
3. Copy `.env.example` to `.env.local` and fill it in.
4. `npm run seed` loads the sample FAQ and sample conversations.
5. `npm run dev`

## Environment
| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Database. The service key is server-only. |
| `ADMIN_PASSWORD` (8+ characters), `ADMIN_SECRET` (16+ characters) | Owner login and the signing key for its cookie. |
| `DEMO_MODE=true` | Lets visitors open the admin without a password. Only for a deployment that holds sample data. |
| `CRON_SECRET` | Authorizes the daily maintenance job. Without it the job answers 401. |
| `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL` | Optional. Any OpenAI-compatible endpoint. |
| `IP_SALT` | Salt for the hashed address used in rate limiting. |

## Embedding
```html
<script src="https://YOUR-DOMAIN/embed.js" async></script>
```
`/embed-demo.html` is a sample third-party page that uses it.

## Safeguards
- 20 questions per session and 60 per address per hour.
- Questions over 500 characters are cut; over 1,000 are refused.
- Every write checks the request origin. Admin writes also need a signed, expiring cookie, and login attempts are slowed after 5 wrong tries a minute.
- A daily job deletes visitor conversations older than 7 days and keeps the database active.
- The admin is read-only to the public unless `DEMO_MODE` is on.

## Tests
`npm test` runs 43 tests: retrieval on 12 answerable and 10 out-of-scope questions, the "never guess" gate, redaction, the model step with a mocked endpoint (including that unknown questions never call it), the admin cookie, login throttling, origin checks and the cron guard.

## Limits
The FAQ is small, and matching is keyword-based, not semantic. A paraphrase that shares no words with an entry will be treated as unknown, which is the safe failure, and the owner queue exists to close those gaps. The language-model path is written and tested against a mock, but this repository does not ship a key, so check it with yours.

## License
MIT
