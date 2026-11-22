# Backend changes for review (branch `fix/security-ai-hardening`)

For Lemuel — nothing here is merged, pushed or deployed. Your structure (routes → controller → services, RAG
module, prompts) is unchanged; these are hardening changes on top of it. Run the tests with `npm test`.

| Area | Change | Files |
|---|---|---|
| Auth | Strict mode when `REQUIRE_AUTH=true`: no/invalid token → 401; Supabase not configured → **503 (fail closed)**. Can verify tokens with the **public** `SUPABASE_ANON_KEY` (service-role key still works as fallback). Local dev without `REQUIRE_AUTH` still allows guests. `/knowledge/*` now behind `requireAuth`. | `middleware/auth.js`, `routes/chatRoutes.js` |
| Input limits | message ≤ 2000 chars; history ≤ 40 turns, each ≤ 4000 chars; roles normalised (**unknown roles become `user`, never `model`**); JSON/urlencoded body limit 10 MB → 1 MB; patient name sanitised. | `middleware/validateChat.js` (new), `controllers/chatController.js`, `app.js` |
| Uploads | File signature (magic bytes) checked for JPEG/PNG/WebP; verified type replaces the client-declared MIME type; multer errors → 400/413 with friendly messages (were 500). | `middleware/upload.js` |
| Errors | 5xx never return internal messages; upstream Gemini errors mapped to 429/503/422; 404 no longer echoes the URL; request log no longer logs query strings. | `app.js`, `controllers/chatController.js` (`toClientError`) |
| CORS | localhost origins trusted only when `NODE_ENV !== 'production'`. | `app.js` |
| RAG | Default embedding model `text-embedding-004` (retired) → `gemini-embedding-001`; documents embedded in one batch call and cached; after 3 consecutive failures embeddings pause for 5 min (keyword-only) instead of retrying every document each turn; `retrievalMode` / `embeddingsCoolingDown` exposed in `/knowledge/stats`; cosine similarity rescaled (`SEMANTIC_FLOOR`/`SEMANTIC_CEIL`) so unrelated docs are not injected. Floor/ceil (0.60/0.80) were calibrated on 2026-11-22 against live `gemini-embedding-001` scores (relevant ~0.69–0.71, unrelated ~0.55–0.63). RAG context wording now also forbids naming conditions/medications. | `services/ragService.js`, `config/aiConfig.js` |
| Summary | Output validated (`services/summaryValidator.js`): known keys only, empty → "Not reported", length caps, screened for diagnosis/medication language. **Fabricated fallback removed**: invalid JSON/validation failure → one retry → HTTP 502 (UI shows retry). Model-written `fullText` is no longer trusted or returned; downloads are built from the validated fields. Summary prompt rewritten: document only what the patient said, never invent. | `services/aiService.js`, `services/summaryValidator.js`, `services/reportService.js`, `prompts/systemPrompt.js` |
| No diagnosis / no prescribing | Prompt tightened (never name/hint at conditions; never recommend medications; general skin-health information allowed). New output screen `services/safetyFilter.js`: if a reply names a condition the user did not mention, uses diagnostic phrasing, recommends a medication or gives a dosage → regenerate once with a corrective instruction → otherwise a safe neutral reply. **The term lists are editable and need your review.** | `services/safetyFilter.js` (new), `services/aiService.js`, `prompts/systemPrompt.js` |

## Behaviour changes that affect the product (please confirm)
1. The assistant may now give *general* skin-health information (sun protection, moisturising, ...) per the intended behaviour.
2. The summary's old "image observations" field now only contains patient-described appearance or a "photo attached, not interpreted" note.
3. `/api/chat/download` re-validates the posted summary and ignores any `fullText`.
4. `npm test` runs `test/*.test.js` (37 tests, no network). `test-rag.js` is unchanged and still makes real embedding calls when a key is set.

## Render settings to apply after review (by the project owner; values never go in the repo)
`REQUIRE_AUTH=true`, `NODE_ENV=production`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `GEMINI_EMBEDDING_MODEL=gemini-embedding-001`.

## Follow-up fix: reference text leaked into saved chat history
**Symptom:** a consultation's title in the history panel was a row of `=` characters (`====…`).
**Cause (pre-existing, also on `main`):** `sendChatMessage` passed its `formattedHistory` array to `model.startChat({ history })`. The Gemini SDK (0.24.x) keeps a reference to that array and appends every turn to it, including our user turn with the retrieved knowledge-base text wrapped around the message, plus the reply. The history we returned (and the browser saved) therefore had **4 turns per exchange instead of 2**, with the reference text stored as a user message. It started with the 70-character `=====` banner of `formatRagContext`, which became the title. Side effects: history grew twice as fast, the reference text was re-sent to the model every turn, it counted as "words the user wrote" in the safety filter and in summaries, and a stored wrapped turn (up to ~3.9 KB plus the message) could exceed the 4,000-character per-turn limit and make the next request return 400.
**Fix:** `aiService.js` now passes a **copy** of the history to `startChat`. `validateChat.js` (`normalizeHistory`, `dropReferenceArtifacts`) also removes such turns (and the duplicate reply that follows) from histories saved by older versions, **before** the length limits are applied. The frontend does the same when it loads saved or open histories (`history-store.js`, `chat-ui.js`, `chat.js`) and repairs a stored `====` title.
**Tests:** `test/history-integrity.test.js` (8 tests, network stubbed, no key needed).
**Please check:** the polluted-history cleaning keys on the banner text from `formatRagContext`; if you change that banner, update `REFERENCE_BANNER` in `validateChat.js` and `history-store.js`.
