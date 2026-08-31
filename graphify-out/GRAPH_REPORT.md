# Graph Report - jamin-depth  (2026-08-31)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 1145 nodes · 3687 edges · 56 communities (40 shown, 11 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 20 edges (avg confidence: 0.84)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `c3d20245`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Community 0
- Community 1
- Community 2
- Community 3
- Community 4
- Community 5
- Community 6
- Community 7
- Community 8
- Community 9
- Community 10
- Community 11
- Community 12
- Community 13
- Community 14
- Community 15
- Community 16
- Community 17
- Community 18
- Community 19
- Community 20
- Community 21
- Community 22
- Community 23
- Community 24
- Community 25
- Community 26
- Community 27
- Community 28
- Community 29
- Community 30
- Community 31
- Community 32
- Community 33
- Community 34
- Community 35
- Community 36
- Community 37
- Community 38
- Community 39
- Community 40
- Community 41
- Community 43
- Community 44
- Community 45
- Community 46
- Community 47
- Community 48
- Community 49
- Community 50
- Community 51

## God Nodes (most connected - your core abstractions)
1. `Locale` - 47 edges
2. `pathFor()` - 34 edges
3. `buildWaLink()` - 30 edges
4. `createRuntime()` - 28 edges
5. `Dictionary` - 26 edges
6. `Venture` - 25 edges
7. `createCommandRuntime()` - 25 edges
8. `ProposedAction` - 24 edges
9. `runCommand()` - 24 edges
10. `QueuedItem` - 23 edges

## Surprising Connections (you probably didn't know these)
- `crmWith()` --calls--> `createMockCrm()`  [EXTRACTED]
  src/command/brief.test.ts → src/agents/adapters/index.ts
- `storeWith()` --calls--> `createTaskStore()`  [EXTRACTED]
  src/command/notify.test.ts → src/command/tasks.ts
- `briefBody()` --calls--> `pathFor()`  [EXTRACTED]
  src/agents/roles/content.ts → src/content/routes.ts
- `runCommand()` --indirect_call--> `buildEveningReport()`  [INFERRED]
  src/command/commands.ts → src/command/brief.ts
- `runCommand()` --indirect_call--> `buildMorningBrief()`  [INFERRED]
  src/command/commands.ts → src/command/brief.ts

## Import Cycles
- None detected.

## Communities (56 total, 11 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.05
Nodes (67): CONFIRMED_FEES, findOffer(), formatTHB(), Offer, OFFERS, offersFor(), PRICE_CAVEAT, Approver (+59 more)

### Community 1 - "Community 1"
Cohesion: 0.08
Nodes (44): RecapLine, generateMetadata(), LocaleLayout(), oswald, plexMono, plexSans, viewport, generateMetadata() (+36 more)

### Community 2 - "Community 2"
Cohesion: 0.08
Nodes (43): AvailabilityAnswer, AvailabilityPort, AvailabilityStatus, CalendarEvent, CalendarEventInput, CalendarPort, DUPLICATE_WINDOW_MS, Lead (+35 more)

### Community 3 - "Community 3"
Cohesion: 0.09
Nodes (33): KpiRow, TaskRow, BriefDeps, JournalFilter, isKpiMetric(), KpiDraft, KpiEntry, KpiFilter (+25 more)

### Community 4 - "Community 4"
Cohesion: 0.11
Nodes (37): createMockCalendar(), createMockCrm(), createMockMessaging(), createMockSeenStore(), createPartnerMessageAvailability(), createRoutedMessaging(), SendResult, createSupabaseAuditSink() (+29 more)

### Community 5 - "Community 5"
Cohesion: 0.09
Nodes (42): audit(), briefDeps(), CommandName, commandNames, contentCalendar(), deadlineFrom(), decide(), delegate() (+34 more)

### Community 6 - "Community 6"
Cohesion: 0.12
Nodes (30): ContactForm(), onSubmit(), FormsCopy, Honeypot(), TextArea(), TextField(), FormStatus(), Status (+22 more)

### Community 7 - "Community 7"
Cohesion: 0.21
Nodes (21): NotFound(), Faq(), FinalCta(), PageHeader(), Testimonials(), WhyUs(), Button(), ButtonLink() (+13 more)

### Community 8 - "Community 8"
Cohesion: 0.08
Nodes (30): detectLanguage(), EN_MARKERS, FR_MARKERS, frenchAccentBonus(), LanguageVerdict, OTHER_MARKERS, score(), SCRIPTS (+22 more)

### Community 9 - "Community 9"
Cohesion: 0.10
Nodes (24): ContentRow, createSupabaseContentStore(), toContent(), buildContent(), bySchedule(), CALENDAR_HORIZON_MS, ContentDraft, ContentFilter (+16 more)

### Community 10 - "Community 10"
Cohesion: 0.06
Nodes (33): dom, dom.iterable, ES2022, next-env.d.ts, .next/types/**/*.ts, node_modules, tests-e2e, **/*.ts (+25 more)

### Community 11 - "Community 11"
Cohesion: 0.12
Nodes (19): createSupabaseJournal(), createSupabaseStateStore(), createSupabaseKpiStore(), createSupabaseTaskStore(), crmWith(), CommandDeps, deps(), createContentStore() (+11 more)

### Community 12 - "Community 12"
Cohesion: 0.10
Nodes (22): PostgrestError, request(), actionTypes, EventRow, StateRow, buildEvent(), byRecency(), DEDUPE_WINDOW_MS (+14 more)

### Community 13 - "Community 13"
Cohesion: 0.14
Nodes (27): answerCallback(), api(), call(), callbackData(), formatCard(), isAllowed(), parseCallbackData(), PRIORITY_LABEL (+19 more)

### Community 14 - "Community 14"
Cohesion: 0.11
Nodes (28): ACTIVITY_RULES, addDays(), BEGINNER_PATTERNS, CERTIFIED_PATTERNS, COURSE_INTENT, detectPolicyQuestions(), EN_MONTHS, extract() (+20 more)

### Community 15 - "Community 15"
Cohesion: 0.09
Nodes (21): authorised(), dynamic, GET(), maxDuration, POST(), runtime, IngestResult, priorities (+13 more)

### Community 16 - "Community 16"
Cohesion: 0.10
Nodes (18): contactKey(), Ports, AuditLog, executeAction(), ExecuteContext, ExecuteResult, stageFor(), OrchestratorDeps (+10 more)

### Community 17 - "Community 17"
Cohesion: 0.18
Nodes (23): Footer(), Header(), LocaleSwitcher(), MobileNav(), BaptismPage(), DivingPage(), AnalyticsListener(), onClick() (+15 more)

### Community 18 - "Community 18"
Cohesion: 0.16
Nodes (21): createMockPorts(), MessagingPort, createAuditLog(), BlockedAction, classify(), createOrchestrator(), fingerprint(), readSignals() (+13 more)

### Community 19 - "Community 19"
Cohesion: 0.12
Nodes (19): chatFor(), TelegramConfig, ContentDeps, DraftedContent, Journal, chatForEvent(), createNotifier(), formatDeadlines() (+11 more)

### Community 20 - "Community 20"
Cohesion: 0.14
Nodes (25): PRIORITY_ORDER, buildEveningReport(), buildMorningBrief(), buildWeeklyReport(), byPriority(), decisionFor(), declared(), firstActionFor() (+17 more)

### Community 21 - "Community 21"
Cohesion: 0.17
Nodes (22): Decision, defaultImpact(), facet(), FACET_KEYS, facets(), formatAction(), formatAlert(), formatApproval() (+14 more)

### Community 22 - "Community 22"
Cohesion: 0.12
Nodes (21): GraphError, InstagramComment, InstagramConfig, instagramFromEnv(), InstagramMedia, InstagramWriteResult, lastPublishedAt(), mediaComments() (+13 more)

### Community 23 - "Community 23"
Cohesion: 0.16
Nodes (15): Msg, Role, Logo(), ArrowDownIcon(), base, ChatIcon(), CheckIcon(), CloseIcon() (+7 more)

### Community 24 - "Community 24"
Cohesion: 0.15
Nodes (18): anthropicDraftGenerator(), parseOutput(), systemPrompt(), userPrompt(), briefBody(), CONTENT_PILLARS, ContentPillar, NEVER_CLAIM (+10 more)

### Community 25 - "Community 25"
Cohesion: 0.15
Nodes (21): quotablePrices(), approverFor(), ACTION_RULES, ActionClass, actionRisk(), ActionRule, auditDraft(), detectSensitiveTopics() (+13 more)

### Community 26 - "Community 26"
Cohesion: 0.16
Nodes (20): BADGE, clamp01(), coverage(), isLettering(), isStrayLetter(), LETTER_BANDS, LINE_LOCKUP, LINE_MASTER (+12 more)

### Community 27 - "Community 27"
Cohesion: 0.22
Nodes (15): note(), CHASEABLE, deliver(), dueFollowUps(), gateAndDispatch(), inQuietHours(), Job, JobResult (+7 more)

### Community 28 - "Community 28"
Cohesion: 0.15
Nodes (14): dynamicParams, generateMetadata(), generateStaticParams(), Page(), PAGES, resolve(), ChatWidget(), AboutPage() (+6 more)

### Community 29 - "Community 29"
Cohesion: 0.16
Nodes (9): alt, contentType, size, BRAND, contrast(), css, luminance(), READABLE_PAIRS (+1 more)

### Community 30 - "Community 30"
Cohesion: 0.13
Nodes (15): eslint, eslint-config-next, @eslint/eslintrc, devDependencies, eslint, eslint-config-next, @eslint/eslintrc, @playwright/test (+7 more)

### Community 31 - "Community 31"
Cohesion: 0.24
Nodes (10): APPROVAL_REQUIRED_CONFIDENCE_CAP, computeConfidence(), ConfidenceInputs, RELEVANT_SIGNAL_FIELDS, signalCompleteness(), CLEARED, COMPLETE_SIGNALS, NEEDS_APPROVAL (+2 more)

### Community 32 - "Community 32"
Cohesion: 0.18
Nodes (11): scripts, brand:logo, build, dev, e2e, lint, media:import, start (+3 more)

### Community 33 - "Community 33"
Cohesion: 0.22
Nodes (9): @anthropic-ai/sdk, next, dependencies, @anthropic-ai/sdk, next, react, react-dom, react (+1 more)

### Community 34 - "Community 34"
Cohesion: 0.42
Nodes (7): findAnswer(), keywordsOf(), knowledgeBase(), KnowledgeEntry, KnowledgeMatch, normalise(), STOPWORDS

### Community 35 - "Community 35"
Cohesion: 0.43
Nodes (7): missingPorts(), openGaps(), countBy(), opsAgent, PARTNER_QUESTIONS, partnerPolicyQuestions(), weeklyReport()

### Community 36 - "Community 36"
Cohesion: 0.36
Nodes (7): isJob(), authorised(), dynamic, GET(), maxDuration, runtime, isCommandJob()

### Community 37 - "Community 37"
Cohesion: 0.29
Nodes (6): description, name, overrides, postcss, private, version

### Community 39 - "Community 39"
Cohesion: 0.60
Nodes (4): pendingConsentCount(), publishedTestimonials(), Testimonial, TESTIMONIALS

### Community 40 - "Community 40"
Cohesion: 0.40
Nodes (4): compat, __dirname, eslintConfig, __filename

## Knowledge Gaps
- **225 isolated node(s):** `ChannelAutomation`, `MissingFact`, `Widen`, `FaqItem`, `EventRow` (+220 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 314 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **11 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Locale` connect `Community 1` to `Community 0`, `Community 34`, `Community 2`, `Community 4`, `Community 7`, `Community 8`, `Community 16`, `Community 17`, `Community 18`, `Community 23`, `Community 24`, `Community 27`, `Community 28`?**
  _High betweenness centrality (0.082) - this node is a cross-community bridge._
- **Why does `createCommandRuntime()` connect `Community 11` to `Community 3`, `Community 4`, `Community 36`, `Community 9`, `Community 13`, `Community 15`, `Community 19`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **What connects `ChannelAutomation`, `MissingFact`, `Widen` to the rest of the system?**
  _225 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.05289450484866295 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.08182349503214495 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.07616892911010557 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.09224489795918367 - nodes in this community are weakly interconnected._