# Writer's Cube — Executive Document

**Prepared:** 2026-05-11
**For:** Elisa Penmar
**Status:** Pre-development strategy & scoping

---

## 0. TL;DR

Writer's Cube has a defensible position in a fragmented market if it commits to **a tight, high-impact V1** rather than competing feature-for-feature with incumbents. The branching narrative + customizable physical-feeling environments + tag-driven actionable highlighting + one signature AI agent are the four concepts that nothing on the market does well together. Recommended path: ship a V1 with **trustworthy writing foundation + branching narratives + the Story Bible AI agent + one wow-factor visual environment + cloud and local storage on day one**, then expand visuals, AI personas, and audio in subsequent releases. Build AI in-house and model-agnostic — no FYI partnership; the dependency risk and your stated UX dissatisfaction outweigh the speed benefit, and partnering through ASU triggers IP/conflict-of-interest complications that an independent build avoids. Plan a $5–10/mo solo-dev burn growing to ~$120/mo at beta and ~$300–700/mo at early growth on a Next.js + Supabase + Vercel stack with BYO-AI-key to keep variable costs off your P&L until pricing is validated.

---

## 1. Market Position: How Unique Is This?

### The competitive landscape (creative-writing-adjacent)

| Tool | Strength | Weakness vs. Writer's Cube vision |
| --- | --- | --- |
| **Scrivener** | Industry-standard binder/corkboard for novelists | Aging UX, weak collab, no AI, no branching, desktop-only feel |
| **Novelcrafter / Sudowrite** | Heavy AI for fiction | AI-first (not writing-first); little ambient/environmental design |
| **Ulysses / iA Writer** | Beautiful minimalist writing | No project structure, no branching, no AI |
| **Dabble / Plottr / Campfire** | Plot/outline visualization | Visualization is separate from drafting; clunky transitions |
| **Google Docs** | Real-time collab | Generic; no creative-writing scaffolding |
| **Coda / Notion / Obsidian** | Flexible | Power-user complexity; not designed for narrative drafting |
| **World Anvil** | Worldbuilding | Worldbuilding-first, not drafting-first |
| **Final Draft / WriterDuet** | Screenwriting standard | Format-locked to screenwriting |

### What no one else does well *together*

1. **Branching narrative as an in-line drafting view** — Plottr does outlines; Twine does interactive fiction; nothing lets a literary novelist say "branch this paragraph" inside a prose document and return to either path later. This is your most ownable concept and the namesake of the product.
2. **Customizable physical-feeling environments** — Apple's design language and tools like Cosmos, Arc, and recent worldbuilding apps have hinted at "spatial" interfaces, but no writing tool delivers the desk metaphor with manipulable objects. This is the "awe" moment.
3. **Highlight-to-actionable-tag** — close to Scrivener's labels but smarter: pulling tagged fragments into a focused micro-todo view is novel and concretely useful.
4. **AI agents tuned to a user's voice, beliefs, and source hierarchy** — most AI writing tools force one personality. Personalization via onboarding survey is differentiated.

### Verdict on market

**Yes, there is a market** — but the bar is the experience, not the feature list. Writers are loyal, vocal, and willing to pay (Scrivener is $60 one-time, Novelcrafter $14/mo, Sudowrite $19–59/mo). The risk isn't competition; it's scope creep that ships a mediocre version of five tools instead of a great version of one. The unique blend you've described is real, but it must be **felt** in the first 90 seconds of use.

---

## 2. Use Cases Beyond Creative Writers

The core concept (structured drafting + branching + research scaffolding + AI thought partners) generalizes well. None of the following require significant reworking — most are positioning, templates, and minor schema additions.

**Tier 1 — natural fits, minimal rework:**
- **Screenwriters & playwrights** — branching is huge for them; needs industry-standard formatting export (Final Draft `.fdx`).
- **Game writers / narrative designers** — branching is core to their job; could become a primary market.
- **Tabletop RPG designers & dungeon masters** — worldbuilding + branching scenarios.
- **Memoirists & long-form nonfiction** — research pane and timeline already mapped.

**Tier 2 — adjacent, light rework (templates + export formats):**
- **Academic writers (theses, dissertations, lit reviews)** — needs citation manager integration (Zotero), footnotes/endnotes, BibTeX export.
- **Journalists doing long-form features** — needs source tracking and quote attribution.
- **Lyricists / songwriters** — needs simpler structural primitives (verse/chorus/bridge).

**Tier 3 — adjacent, more rework but interesting market:**
- **Instructional designers building branching scenarios** *(directly relevant to your day job)* — the branching feature is exactly what ID's struggle to build today. This could be a serious B2B angle for ASU and other ed institutions.
- **Marketing/content teams running campaigns** — would need CMS-style publishing and multi-author roles.
- **Interactive fiction authors / ARG designers** — branching natively fits; needs export to Twee or similar.

**Strategic recommendation:** Lead with creative writers (clearest narrative, easiest marketing). At V2.0+, ship **templates** for screenwriting, academic, and instructional design — same product, different opening experience. Don't dilute V1 messaging by being everything to everyone.

---

## 3. Features You May Be Missing

### Obvious gaps in the current dev table

- **Export formats** — DOCX, PDF, EPUB, Markdown, Final Draft, plain text. Writers will not adopt a tool they can't get their work *out* of. Make this loud and visible — call it "Your Work Is Always Yours."
- **Project templates** — novel (three-act, save the cat, hero's journey), short story, screenplay, poetry collection, memoir. Reduces blank-page paralysis.
- **Daily goals + streaks + writing sessions** — word/time targets with gentle (not gamified) progress.
- **Pomodoro / sprint timer** — built-in or as a widget.
- **Search & replace across the whole project** — non-negotiable for revision.
- **Footnotes & endnotes** — required for nonfiction/academic adjacency.
- **Find-in-project semantic search** — "where did I last mention the locket?"
- **Mobile/tablet capture app** — even read-only at first; writers think on the go.
- **Offline mode + conflict-free sync** — the single biggest trust signal you can give writers.
- **Beta reader / share-with-limited-access** — already in your table; emphasize that comments don't require an account.
- **Submission tracker** — log which agents/publishers/journals received which version. Underserved across the entire market.
- **Accessibility** — OpenDyslexic font, screen reader support, color-blind-safe highlight palette.
- **Data export & "death plan"** — explicit promise that if the company shuts down, users get a full local export. Writers have been burned (Evernote, Storyist) and pay attention to this.
- **Privacy stance on AI training** — explicit, contractual promise that user text is never used to train models. This is becoming table stakes.

### Creative / non-obvious features

- **Character interview mode** — chat *as* one of your characters via the AI agent (which has full project context). Surprisingly effective for development.
- **Sensory prompt cards** — when you click into a scene, the AI offers 3 sensory details for that location based on your research pane. Drop them in or dismiss.
- **Emotional arc visualizer** — plot the emotional intensity of each scene; spot pacing problems at a glance.
- **Pacing heatmap** — scene length, dialogue-to-prose ratio, action density across chapters.
- **"Time capsule" notes to future-self** — leave a note that surfaces when you reopen this chapter tomorrow.
- **Writing rituals** — customizable startup routine (music + ambient + greeting + opens to where you left off, mid-sentence).
- **Inspiration mailbox** — daily prompts delivered like physical letters in the desk metaphor.
- **Lock mode** — commit to a draft for N days; the app *physically gates* your ability to delete or edit certain sections. Surprisingly motivating.
- **Cube view** — literal 3D representation of the manuscript: chapters as floors, scenes as rooms, branches as side doors. Navigable. This is the brand made literal.
- **Collaborative branch voting** — share a branch point with beta readers; they vote on which path. Could go viral on TikTok/BookTok.
- **Browser clipper extension** — capture research from the web into the research pane.
- **Print-on-demand integration** — at the end, ship a hardcover to yourself via Lulu/BookBaby. Emotional ROI for finishers.
- **Ambient environments tied to scene mood** — the desk skin subtly shifts (lighting, sound) based on what scene you're writing. Goes deep on the "physical space" promise.

### Questions to consider (thought-partner mode)

1. **Local-first vs. cloud-first?** A CRDT-backed local-first architecture (Yjs/Automerge) would make Writer's Cube the only tool in this space that works offline by default with perfect sync. Massive trust signal. Higher upfront engineering cost.
2. **Web app or desktop (Electron/Tauri)?** Writers strongly prefer "real apps." Recommend ship web first, wrap in Tauri for desktop at V2.0.
3. **Pricing model?** $12–18/mo subscription is the modern standard. Consider a "lifetime" pricing tier early to fund development (Setapp-style).
4. **Free tier shape?** Single project, no AI, no branching? Or full features capped at 30 days? Free tier shape will define adoption curve.
5. **AI cost absorption vs. BYO key?** Strongly recommend BYO API key for V2.0 to validate willingness-to-pay before eating AI margin. Hosted AI as a premium tier in V3.0.
6. **Open vs. closed source?** Partially open-sourcing the editor core can buy massive goodwill in the writing community (think: Logseq, Obsidian's plugin model).
7. **Community angle?** Critique circles, writing sprints, public branch voting — Writer's Cube could anchor a creative community. But community is a separate product; do not start there.
8. **Education positioning?** Your ASU role is a natural distribution channel for the academic + ID variant — but see §7 on IP.

---

## 4. Rollout Timeline

The dev table is reorganized below into versioned releases. Principle: **each release should have one headline that gives a journalist a reason to write about you.**

### V1.0 — "The Cube Opens" (MVP, launch)

**Headline:** *A writing space that thinks alongside you — and lets you branch your story without losing the thread.*

**Must-haves:**
- Dashboard + nested project folders
- Word processor + side navigation (chapters, scenes, characters, places, research, notes)
- Rich text editing, dictionary/thesaurus, word count, undo/redo with history, spell check
- **Storage: link to Google Drive AND/OR local hard drive at first run** (user-sovereign by default; versioned `.md` snapshots with timestamps in their chosen location)
- Auto-save + cloud-synced working state
- Side-by-side revision compare
- Highlight-to-tag actionable status system *(signature)*
- Typewriter mode *(signature)*
- **Branching narratives** — in-line flow-chart view of "what-if" paths *(signature, the namesake)*
- **Story Bible AI Agent** — auto-extracts characters, places, timeline, relationships, and event log from your draft; populates the navigation pane; answers questions like "did this character ever meet this character?" *(signature, highest-ROI AI feature)*
- Highlight + right-click + ask AI (chat-mode, project-context-aware)
- BYO AI API key (Anthropic, OpenAI) — model-agnostic from day one
- Page layout options (printer paper, book spread, continuous flow)
- One immersive visual environment: **the Vintage Writer's Desk** *(the awe moment)*
- Project templates for all three audience tiers: novel/short-story/memoir (creative), screenplay/stage-play (adjacent creative), academic article/dissertation (academic) — see §1A
- Share project with non-subscribers (read + comment access only)
- Onboarding walkthrough with contextual help
- Export to DOCX, PDF, MD, plain text
- Explicit privacy stance: user text never used to train AI

**Deliberately cut from V1:** AI thought-partner persona, AI research assistant persona, audio, widgets beyond essentials, additional environments. Each gets its own dedicated release moment.

### V1.5 — "Your Space, Your Way" (3–6 months post-launch)

**Headline:** *Make the room your own.*

- Second immersive environment: **Futuristic Studio**
- Customizable widgets (motivational quotes, ambient sound, location visualizers, pomodoro timer)
- Outline-to-detail flow (start with plot points, click in to write)
- Multi-monitor window support
- Daily goals, streaks, writing-session targets
- Expanded templates (interactive fiction, narrative game design, journalism long-form)

### V2.0 — "Your AI Collaborators" (9–12 months)

**Headline:** *AI that knows your voice — because you taught it.*

- AI persona onboarding survey (voice, beliefs, source hierarchy)
- In-page AI research assistant persona (hierarchical source-finding)
- AI thought-partner persona (listens, responds briefly and thoughtfully)
- Character interview mode (chat *as* one of your characters)
- Hosted AI option (premium tier — for users who don't want to BYO key)

### V2.5 — "Voice and Sound" (12–18 months)

**Headline:** *Hear your work the way readers will.*

- Native speech-to-text dictation
- TTS playback with synchronized text highlighting
- AI voice generation integration (ElevenLabs)
- Self-recorded narration
- Background ambience library
- Genre/scene-mood ambient profiles

### V3.0 — "Beyond the Page" (18–24 months)

**Headline:** *Your writing lives where you do.*

- Mobile/tablet companion (capture + light editing + sync)
- Desktop wrapper (Tauri) for true native feel
- Pacing heatmap, emotional arc visualizer, sentence rhythm analysis
- Submission tracker
- Beta reader branch voting
- Print-on-demand integration
- Cube View (3D manuscript navigation)
- **SCORM export from branching scenarios** *(instructional-design vertical — AI auto-builds SCORM-conformant interactive lessons from branching narratives; first vertical-specific monetization)*

### V4.0+ — "Spatial Writing" (24+ months, exploratory)

- VR/AR (Apple Vision Pro) writing environments
- Collaborative real-time multi-author mode
- Additional vertical exports: Twine for IF designers, Articulate Storyline for ID, BibTeX/Word with full citation handling for academics

---

## 5. Storage

### How much do we actually need?

Plain text is tiny. The variable storage cost comes from generated media.

| Asset type | Per project (avg) | Per project (heavy user) |
| --- | --- | --- |
| Manuscript text (100k-word novel) | ~600 KB | ~1.5 MB |
| Structured metadata (characters, notes, tags) | ~1–5 MB | ~20 MB |
| Version history snapshots (1/day for 1 yr) | ~200 MB | ~1 GB |
| Research images | ~10 MB | ~500 MB |
| Generated audio (TTS, full novel) | — | ~5 GB |

**Realistic averages:**
- Text-only writer: ~5–50 MB per project
- Power user with audio + images: ~5–10 GB per project

**At scale:**
- 1,000 active users × 10 projects × avg 100 MB = **~1 TB**
- 10,000 users × similar = **~10 TB**

### Recommended storage architecture

A hybrid, **user-sovereign-by-default** model:

1. **Working data (text, metadata, structure)** — Supabase Postgres. Small, fast, queryable.
2. **Generated media (audio, images)** — Object storage (Supabase Storage on top of S3, or Cloudflare R2 for cheaper egress). Lazy-load.
3. **Google Drive integration** — User-owned snapshots as Markdown + JSON manifest. Their storage, their backup, their portability.
4. **Local hard drive integration (V2+)** — Optional local-first sync via filesystem access API or desktop wrapper. Writers love this.
5. **"Death plan" export** — One-click download of everything as a portable zip. Build trust early.

This architecture means **we own the operational layer (small, fast) and users own the bulk media layer (cheap, portable).** Storage is therefore a manageable cost rather than a runaway one — even at 10k users, expect to pay ~$50–200/mo for storage *if* we keep media in Drive by default.

---

## 6. Platforms & Monthly Costs

### Recommended stack

| Layer | Platform | Why |
| --- | --- | --- |
| Frontend hosting | **Vercel** | Next.js native, generous free tier, fast iteration |
| Database + Auth + Storage | **Supabase** | Postgres + auth + object storage + realtime in one |
| Background jobs / cron | **Supabase Edge Functions** or **Railway** | Pick one; Edge Functions cheaper at small scale |
| AI APIs | **User BYO key** (V2), then **Anthropic** for hosted | Defers margin risk |
| Code & CI | **GitHub** + **GitHub Actions** | Standard |
| Error tracking | **Sentry** | Standard |
| Product analytics | **PostHog** | Generous free tier, self-hostable later |
| Transactional email | **Resend** | Cheap, modern, dev-friendly |
| Payments | **Stripe** | Standard |
| CDN / DNS | **Cloudflare** | Free tier excellent |
| Domain | **Cloudflare Registrar** or **Namecheap** | ~$10–15/yr |

### Monthly cost projection

*Note: prices reflect public pricing pages as of writing; verify directly before budgeting.*

#### Stage 1 — Solo dev / pre-launch
| Service | Tier | Cost |
| --- | --- | --- |
| Vercel | Hobby | $0 |
| Supabase | Free | $0 |
| Railway | Hobby ($5 credit) | $0–5 |
| GitHub | Free | $0 |
| Sentry | Free | $0 |
| Resend | Free (3k/mo) | $0 |
| PostHog | Free (1M events) | $0 |
| Domain (amortized) | ~$12/yr | ~$1 |
| Cloudflare DNS | Free | $0 |
| **Total** | | **~$5–10/mo** |

#### Stage 2 — Closed beta / first 100–500 users
| Service | Tier | Cost |
| --- | --- | --- |
| Vercel | Pro | $20 |
| Supabase | Pro (8 GB DB, 100 GB bandwidth, 100 GB storage) | $25 |
| Railway | Hobby | $5–20 |
| Sentry | Team | $26 |
| Resend | Pro | $20 |
| PostHog | Free still | $0 |
| Stripe | Per-transaction (2.9% + $0.30) | variable |
| Domain | | ~$1 |
| **Total** | | **~$100–130/mo** |

#### Stage 3 — Growth (1k–10k users)
| Service | Tier | Cost |
| --- | --- | --- |
| Vercel | Pro + usage overage | $50–200 |
| Supabase | Pro + storage/bandwidth overage | $50–150 |
| Object storage (R2 or Supabase) | Usage-based | $10–80 |
| Sentry | Business | $80 |
| PostHog | Paid | $50–100 |
| Resend | Scale | $30–80 |
| **Total (no hosted AI)** | | **~$300–700/mo** |

#### Stage 4 — Scale (10k+ MAU, hosted AI premium tier)
| Service | Tier | Cost |
| --- | --- | --- |
| Vercel Team or self-hosted Next.js | | $300–800 |
| Supabase Team | $599 baseline | $599 |
| Storage + bandwidth overage | | $200–800 |
| Sentry Business | | $80–200 |
| PostHog | | $200–500 |
| Anthropic API (Haiku for summaries, Sonnet for thought partner) | Variable | $500–3,000+ |
| **Total** | | **~$2,000–6,000/mo** |

### Key cost-control levers
- **BYO API keys for AI** through V2.0 — defers your biggest variable cost
- **User-side storage via Drive** — caps your media storage liability
- **Local-first architecture** — reduces server compute load
- **Cloudflare R2** over S3 — no egress fees, important if you serve audio
- **Self-host PostHog** at scale — large savings once events exceed 1M/day

---

## 7. FYI Partnership & Custom Agents

### ⚠️ This section is strategic analysis, not legal advice. Confirm specifics with ASU's Office of General Counsel, Office for Research and Sponsored Projects Administration (ORSPA), and/or Skysong Innovations before signing anything or making external commitments.

### The ASU FTE complication

As an ASU full-time employee (instructional designer), three policies apply to outside ventures and likely shape what you can do here:

1. **IP assignment** — ASU's IP policy (ACD 401, *Intellectual Property Policy*) generally claims rights to works created **within the scope of employment** or **using significant ASU resources** (time, equipment, networks, students). Where Writer's Cube falls depends on:
   - Was it developed on personal time, personal equipment, personal accounts?
   - Does it relate to your job duties as an instructional designer? Writing tools used by educators or with branching-scenario potential for ID's blurs this line.
   - Did any ASU colleague contribute?
2. **Conflict of commitment / outside employment** — ACD 204-08 requires disclosure of outside professional activities. Building a commercial product likely qualifies; partnering with a vendor connected to your ASU role triggers a conflict-of-interest review.
3. **Conflict of interest** — If FYI is an ASU vendor or partner and you would benefit financially from a relationship between them and Writer's Cube, that's a textbook COI scenario requiring formal disclosure and possibly recusal.

### Recommended next steps before pursuing FYI

1. **Contact ASU's Office of Knowledge Enterprise / Skysong Innovations** to clarify whether Writer's Cube is yours or ASU's. Get this in writing.
2. **File an outside-activity disclosure** through ASU's COI portal so the activity is on record.
3. **Develop strictly on personal equipment, personal time, personal accounts.** Document this.
4. **Treat FYI as a vendor, not a colleague.** Approach them via their normal partnership channel as Writer's Cube the founder, not as Elisa the ASU employee. Keep the two relationships separate on paper.
5. If ASU has claims on the IP, consider whether you want to negotiate a license (ASU sometimes will, via Skysong) before building.

### FYI partnership vs. building your own agents

| Dimension | Partner with FYI | Build in-house (model-agnostic) |
| --- | --- | --- |
| **Time to first AI feature** | Faster (pre-built agents) | Slower (prompt engineering) |
| **UX control** | Limited — and you already dislike theirs | Full control |
| **Data privacy & training stance** | Bound by their policy | You set it (a competitive advantage) |
| **Vendor dependency** | High — their uptime, their roadmap, their pricing | Low — swap providers freely |
| **Margin at scale** | Worse — rev share or licensing | Better — direct API costs only |
| **Brand independence** | "Powered by FYI" baggage | Your brand, your story |
| **Strategic optionality** | Reduced (lock-in) | Preserved |
| **Legal/COI exposure for you personally** | Material — see above | Minimal |
| **AI agent personalization (your survey concept)** | Constrained by FYI's framework | Fully customizable |

**Recommendation: build your own, model-agnostic.** Use the Anthropic SDK (or an abstraction layer like Vercel AI SDK) so users can plug in any provider. Prompt engineering for your three personas (research assistant, thought partner, project summarizer) is a few weeks of focused work — meaningful but not a moat-buster. The strategic flexibility you keep, the privacy promise you can make, and the COI exposure you avoid are worth more than the time savings.

If you still want a relationship with FYI, the right shape is probably a **distribution/marketing partnership**, not a technical integration — keep your tech stack independent.

---

## 8. Open Questions for You

These are the decisions that most shape what gets built first:

1. **Local-first architecture (CRDTs)?** It's a big upfront engineering bet but it's the trust-and-differentiation play that fits your "writers must trust this absolutely" requirement.
2. **Web-only V1 or web + desktop wrapper?** Writers prefer desktop. Tauri is light. We could ship both from one codebase.
3. **Pricing model and free-tier shape?** Drives both adoption math and what V1 must include.
4. **Education / B2B angle?** ASU could be both an IP complication *and* a first customer for the instructional-design variant. Worth deciding early.
5. **Are you the sole founder/developer, or building a team?** Solo dev → tighter scope on V1; team → V1.5 branching could ship sooner.
6. **What's the brand voice?** "Awe and wonder" implies a marketing identity (visuals, copy, launch film) that's as important as the product itself. Worth budgeting for from day one.
7. **Launch geography & community?** Are you tapping into BookTok, NaNoWriMo, MFA programs, or all of the above? Each implies different V1 features and partnerships.

Decisions on 1–4 most directly affect the V1 spec and budget. Suggest tackling them next.

---
