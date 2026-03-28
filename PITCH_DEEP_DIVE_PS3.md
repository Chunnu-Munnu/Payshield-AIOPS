# PayShield AIOps PS3 Deep Dive

## 1. One-line pitch

PayShield AIOps is a real-time AI observability and self-healing system built on top of a live distributed payment-risk platform. It ingests metrics, logs, and traces from the running PayShield stack, performs multimodal root-cause analysis, and triggers service-aware remediation within a 15-second SLA window.

## 2. What problem we are actually solving

The original PayShield problem was transaction fraud detection.

For PS3, the main problem is different:

- detect when the distributed application itself is degrading
- identify which service is actually the root cause
- suppress weak or noisy alerts
- remediate automatically
- keep the business workflow alive while recovering

So the fraud platform is now the patient.
The observability layer is the doctor.

## 3. Why this is technically strong for PS3

This project is not just a dashboard.

It combines:

- a real distributed application
- real traffic generation
- Prometheus metrics
- Loki log ingestion
- Jaeger distributed traces
- multimodal AI-based root-cause analysis
- automated remediation
- a fallback layer that preserves service continuity
- an immutable blockchain evidence trail

That is exactly the shape PS3 is asking for.

## 4. System architecture

### 4.1 Business workload layer

These services form the live application under observation:

- `payshield-frontend`
- `payshield-backend`
- `payshield-ml-engine`
- `payshield-blockchain`
- `redis`
- `payshield-simulator`

These services are not fake demo nodes. They produce the telemetry the observability layer reasons over.

### 4.2 Observability infrastructure layer

- `prometheus`
- `loki`
- `promtail`
- `jaeger`
- `grafana`

### 4.3 AI control-plane layer

- `observability-brain`

This is the PS3 headline service. It is the component that:

- polls telemetry
- runs anomaly models
- correlates signals
- attributes root cause
- decides whether confidence is high enough
- triggers automated remediation
- broadcasts live anomaly and remediation events

## 5. Two different ensembles in this project

This project contains **two separate ensembles**.

Judges will care much more about the second one.

### 5.1 Fraud scoring ensemble

This is the workload ensemble used by the payment platform itself.

Defined in:

- [mlInference.js](D:/Amogh%20Projects/PAYSHIELD-AI/backend/src/services/mlInference.js)

It calls six model endpoints in parallel:

- `GNN`
- `BiLSTM`
- `Tree ensemble`
- `Behavioral biometrics`
- `AML graph/risk`
- `BEC text detector`

Current backend fusion weights:

- `gnn`: `0.28`
- `lstm`: `0.22`
- `ensemble`: `0.20`
- `biometrics`: `0.15`
- `aml`: `0.10`
- `bec`: `0.05`

Final fraud score:

```text
fraud_score =
  0.28 * gnn +
  0.22 * lstm +
  0.20 * ensemble +
  0.15 * biometrics +
  0.10 * aml +
  0.05 * bec
```

This ensemble exists to make the business stack realistic and telemetry-rich.

### 5.2 Observability RCA ensemble

This is the actual PS3 answer.

Defined primarily in:

- [root_cause_engine.py](D:/Amogh%20Projects/PAYSHIELD-AI/observability-brain/correlation/root_cause_engine.py)
- [orchestrator.py](D:/Amogh%20Projects/PAYSHIELD-AI/observability-brain/orchestrator.py)
- [log_anomaly_detector.py](D:/Amogh%20Projects/PAYSHIELD-AI/observability-brain/models/log_anomaly_detector.py)
- [lstm_detector.py](D:/Amogh%20Projects/PAYSHIELD-AI/observability-brain/models/lstm_detector.py)

This ensemble fuses:

- metric anomaly signal
- log anomaly signal
- trace anomaly signal
- service-topology adjustment
- temporal ordering bonus
- health and container-state heuristics
- consensus gating
- remediation cooldown

This is the part you should lead with in the demo.

## 5.3 What the judges can now see on screen

The observability dashboard is no longer just a score board. It now exposes the reasoning and the remediation sequence live.

The main visible panels are:

- `Fallback Mode Active` banner
- `Detection confidence / Scoring mode / Evidence channels / Active remediation`
- `AI Explanation`
- `Remediation rationale`
- `Stabilization Plan`
- `Explainability Features`
- `Ensemble Breakdown`
- `Live Recovery Steps`
- `Runtime Status`
- `Remediation Timeline`

That matters because the demo now shows:

- why the brain thinks the ML engine is the root cause
- what evidence channels were used
- what exact recovery plan is being followed
- when fallback was activated
- when the container restart happened
- when health recovered
- when fallback was disabled

## 6. Exactly what models we are using

## 6.1 Fraud workload models

### GNN-style fraud scorer

Purpose:

- detect graph relationships such as shared devices, linked accounts, suspicious topology, or fraud-ring proximity

Why it exists:

- financial fraud is often relational, not just tabular
- a graph-oriented signal helps detect mule-account style patterns

### BiLSTM sequence anomaly model

Purpose:

- detect unusual transaction order or temporal behavior

Why it exists:

- fraud is often sequence-dependent
- a user doing a rare sequence of actions can be suspicious even if one transaction alone looks acceptable

### Tree ensemble model

Implemented in:

- [ensemble_model.py](D:/Amogh%20Projects/PAYSHIELD-AI/ml-engine/models/ensemble_model.py)

Current internal runtime components:

- `ExtraTreesClassifier`
- `HistGradientBoostingClassifier`
- `IsolationForest`

Even though some API field names still say `xgb_score` and `lgb_score`, the current runtime image uses lighter but still technically valid tree models for speed and demo reliability.

Why `ExtraTreesClassifier`:

- very fast at training and inference
- handles nonlinear tabular fraud features well
- robust to noisy synthetic data
- good ensemble baseline for mixed feature spaces
- less dependency-heavy than shipping full XGBoost inside the demo runtime

Why `HistGradientBoostingClassifier`:

- fast gradient boosting implementation in sklearn
- efficient for medium-size tabular data
- gives a second, structurally different tree learner
- preserves the “boosted tree” logic without forcing a huge external binary dependency

Why `IsolationForest`:

- novelty/outlier detection
- catches “this transaction is unlike normal history” style anomalies
- complements supervised models with unsupervised anomaly sensitivity

Why mix these three:

- `ExtraTrees` is strong on broad nonlinear classification
- `HistGradientBoosting` adds boosted decision boundaries
- `IsolationForest` catches outlier behavior that supervised labels may miss

The runtime fusion inside the tree ensemble is:

```text
ensemble_score =
  0.50 * extra_trees_score +
  0.30 * hist_gradient_boosting_score +
  0.20 * isolation_forest_score

## 6.2 Observability explainability layer

The observability-brain now produces a structured explanation bundle per confirmed incident.

The root-cause result includes:

- `root_cause_service`
- `failure_type`
- `confidence`
- `business_impact`
- `recommended_action`
- `explainability_summary`
- `remediation_rationale`
- `stabilization_steps`
- `evidence_channels`
- `shap_top_features`
- `composite_scores`
- `ensemble_breakdown`

This makes the RCA output judge-friendly:

- not just “something is wrong”
- but “ML latency spiked, fallback activated, backend symptoms followed, so the upstream ML engine is the dominant cause”

## 6.3 Why this explainability is technically credible

We are not claiming formal causal proof in the academic sense.

We are doing a practical, production-style explainability pipeline:

- metric ranking from degradation signals
- weighted multimodal score fusion
- supporting trace evidence
- business-impact mapping
- remediation reasoning tied to system state

That is exactly the kind of explainability a PS3 demo needs: interpretable, fast, and operationally useful.

## 6.4 What the live ML remediation actually does

For the strongest demo path, use `ml_engine_latency`.

When that is injected, the live sequence is:

1. ML engine enters slow mode
2. Backend starts timing out on ML sub-calls
3. Fraud scoring switches to `fallback`
4. Observability-brain attributes root cause to `payshield-ml-engine`
5. Observability-brain restarts the ML container
6. Health polling waits for `/health`
7. Full ensemble mode is restored
8. Remediation timeline records the action bundle

This is real remediation, not a static animation.

The current observed action bundle is:

- `fallback_activated`
- `container_restarted`
- `fallback_disabled`
- `transactions_during_outage_count=<n>`

## 6.5 Email and traffic noise controls

The demo runtime now intentionally reduces background noise so the observability story is readable.

Changes made:

- simulator traffic reduced to a calmer steady pace
- BEC generator frequency reduced
- simulator transactions suppress alert emails
- Gmail-ingested synthetic email submissions suppress alert emails
- alert email sending now has a cooldown window

Why this matters:

- fewer noisy alert messages
- lower chance of drowning the user inbox
- cleaner telemetry for the RCA demo
- easier to narrate the under-15-second remediation loop
```

### Behavioral biometrics model

Purpose:

- compare current behavioral signal with expected user behavior

Examples:

- typing rhythm
- click cadence
- navigation timing
- device/session consistency

Why it exists:

- a normal credential can still be used by the wrong human
- behavioral drift is useful as a trust signal

### AML risk model

Purpose:

- elevate risk for suspicious fund-routing, threshold gaming, laundering-like structures, or beneficiary novelty

Why it exists:

- not all risky transactions are card-style fraud
- AML signals matter for transfers and audit positioning

### BEC text model

Purpose:

- detect coercive or manipulative language in email/memo/SMS content

Why it exists:

- payment fraud often starts from language
- urgency, secrecy, “new account”, “do not call”, or IBAN change language are strong indicators

## 6.2 Observability models

### Metric degradation model

Implemented in:

- [lstm_detector.py](D:/Amogh%20Projects/PAYSHIELD-AI/observability-brain/models/lstm_detector.py)

Research-grade profile:

- `2-layer BiLSTM`
- input window: `30 timesteps`
- feature count: `12`
- output: anomaly probability for `6 services`

Feature set:

- `ml_engine_latency_p95`
- `backend_error_rate`
- `fraud_score_mean`
- `ensemble_confidence_mean`
- `blockchain_write_latency_p95`
- `websocket_connections`
- `transaction_rate`
- `cpu_usage_backend`
- `cpu_usage_ml`
- `memory_usage_backend`
- `memory_usage_ml`
- `bec_detection_rate`

Why BiLSTM:

- degradation is temporal
- PS3 wants real-time RCA, not static thresholding only
- bidirectional sequence modeling is useful during training because it learns patterns of how incidents evolve across a short window
- cascade failures are better captured by temporal models than point thresholds

Why these 12 features:

- they mix system health, business workload, and model-confidence behavior
- this allows the detector to distinguish infrastructure degradation from normal transaction spikes

Current runtime behavior:

- if trained LSTM weights exist and torch support is available, the actual BiLSTM is used
- otherwise the detector falls back to a deterministic heuristic degradation layer

Why the heuristic fallback still makes technical sense:

- it preserves PS3 functionality in constrained environments
- it is based on domain metrics, not random logic
- it still produces service probabilities from observed degradation metrics

### Log anomaly model

Implemented in:

- [log_anomaly_detector.py](D:/Amogh%20Projects/PAYSHIELD-AI/observability-brain/models/log_anomaly_detector.py)

Research-grade profile:

- `DistilBERT` for binary log classification

Runtime profile:

- `TF-IDF + LogisticRegression` lightweight classifier
- plus heuristic pattern scoring
- plus severity scoring

Why DistilBERT in the design:

- semantic understanding of log lines
- better than keyword matching for anomalous log language
- can separate normal operational phrases from real failure semantics

Why TF-IDF + LogisticRegression exists in runtime:

- starts faster
- lower RAM
- still technically valid for demo
- keeps the pipeline reliable while preserving the same RCA architecture

Why add heuristics and severity on top:

- because raw text models alone can miss operational urgency
- words like `OOM`, `timeout`, `ECONNREFUSED`, `contract revert`, `fallback`, and `cache` are high-signal operational features
- severity words such as `warning`, `error`, `critical`, `fatal` matter for fast RCA

Current anomaly score for each log line:

```text
anomaly_probability =
  0.60 * text_model_probability +
  0.25 * heuristic_pattern_score +
  0.15 * severity_score
```

Classification threshold:

- anomalous if `>= 0.68`

### Trace anomaly layer

Trace signals come from Jaeger-polling logic.

Purpose:

- detect error spans
- detect slow distributed requests
- identify which service is producing failing or high-latency spans first

Why this matters:

- logs tell you what was said
- metrics tell you that something is drifting
- traces tell you where the request path is actually breaking

This is critical for separating symptom service from source service.

## 7. How the observability ensemble actually makes a decision

Inside [root_cause_engine.py](D:/Amogh%20Projects/PAYSHIELD-AI/observability-brain/correlation/root_cause_engine.py), each service gets a composite anomaly score.

Services tracked:

- `payshield-frontend`
- `payshield-backend`
- `payshield-ml-engine`
- `payshield-blockchain`
- `payshield-simulator`
- `redis`

### 7.1 Main signal families

- `metric_score`
- `log_score`
- `trace_score`

Base design weights:

- metric: `0.45`
- logs: `0.35`
- traces: `0.20`

### 7.2 Adaptive weighting

The engine does not blindly keep fixed weights.

It re-normalizes them based on signal strength.

Why this is smart:

- if traces are strong but logs are weak, traces deserve more influence
- if metrics dominate but traces are absent, metrics should lead
- this is more realistic than one static formula

### 7.3 Consensus logic

Each service gets a `signal_consensus` vote count.

A vote is added if:

- metric probability `>= 0.72`
- log ratio `>= 0.20`
- trace ratio `>= 0.15`

Consensus bonus:

- if at least two modalities agree, add a `0.05` composite bonus

Why this matters:

- reduces false positives
- rewards multimodal agreement
- makes remediation safer

### 7.4 Topology adjustment

The engine also understands service dependencies:

- frontend depends on backend
- simulator depends on backend
- backend depends on ML engine, blockchain, and Redis

Why this matters:

- downstream symptoms should not always be blamed
- if backend is noisy because ML engine degraded first, the RCA should still choose ML engine

### 7.5 Temporal bonus

If a service shows the earliest failing or slow trace span, it gets a temporal bonus.

Why:

- root cause often appears earlier in time than downstream symptoms
- temporal ordering is critical for cascade analysis

## 8. Current RCA output fields you can talk about

The RCA engine produces:

- `root_cause_service`
- `failure_type`
- `confidence`
- `signal_consensus`
- `composite_scores`
- `ensemble_breakdown`
- `adaptive_weights`
- `metric_evidence`
- `log_evidence`
- `trace_evidence`
- `business_impact`
- `shap_top_features`
- `supporting_services`
- `recommended_action`
- `suppression_reason`

This is useful in the pitch because you can say:

“we do not just flag a service unhealthy; we return evidence, confidence, modality agreement, business impact, and the recommended remediation.”

## 9. Failure modes currently covered

Current root-cause categories:

- `ML_ENGINE_DEGRADATION`
- `CASCADE_FAILURE`
- `BLOCKCHAIN_HANG`
- `BACKEND_ERROR_BURST`
- `FRONTEND_OUTAGE`
- `LOAD_GENERATOR_STOPPED`
- `CACHE_PRESSURE`
- `SUPPRESSED`

This is important for judges because it proves we are not only detecting a single canned incident.

## 10. How cascade detection works

The engine explicitly checks for a common payment-stack cascade:

- ML engine score is high
- backend score is also high
- timeout/fallback evidence is present

Then it upgrades the incident to:

- `CASCADE_FAILURE`
- root cause becomes `payshield-ml-engine`

Why this is technically strong:

- it does not treat the backend as the source just because it also shows errors
- it models upstream degradation causing downstream symptoms

This is one of the strongest things to say in the demo.

## 11. False-alert suppression logic

This is one of the most important reliability features.

The system does **not** remediate every anomaly.

Suppression rules:

- if confidence `<= 0.65`, the event is suppressed
- if consensus is weak and confidence is not very high, it may require confirmation across consecutive cycles
- cooldown logic prevents repeated restart storms

Why this matters:

- real observability platforms must avoid flapping
- restarting containers on noisy signals is dangerous
- this makes the system look operationally mature

## 12. The fallback layer

This is the part you called the “fallback layer thingy.”

It is one of the best features in the entire project.

Defined in:

- [server.js](D:/Amogh%20Projects/PAYSHIELD-AI/backend/src/server.js)
- [runtimeState.js](D:/Amogh%20Projects/PAYSHIELD-AI/backend/src/services/runtimeState.js)
- [remediation_engine.py](D:/Amogh%20Projects/PAYSHIELD-AI/observability-brain/remediation/remediation_engine.py)

### 12.1 What fallback means

Fallback means:

- the payment system keeps operating even when the ML engine is degraded
- instead of failing every transaction submission, the backend switches from `full_ensemble` mode to `fallback` mode

Backend state:

- `fraudScoringMode = "full_ensemble"` normally
- `fraudScoringMode = "fallback"` during ML remediation

### 12.2 Why fallback exists

Without fallback:

- ML engine fails
- backend requests time out
- transaction flow breaks
- user sees service outage

With fallback:

- observability brain detects ML degradation
- backend enters fallback scoring mode
- transactions continue flowing
- ML engine is restarted safely
- once healthy, backend returns to full ensemble mode

So the fallback layer is not only “recovery.”
It is **business continuity during recovery**.

### 12.3 What triggers fallback

In remediation for ML-engine or cascade incidents:

1. backend `POST /api/fallback/enable`
2. wait `2 seconds`
3. restart `payshield-ml-engine`
4. poll `http://payshield-ml-engine:8000/health`
5. backend `POST /api/fallback/disable`

That logic is in:

- [remediation_engine.py](D:/Amogh%20Projects/PAYSHIELD-AI/observability-brain/remediation/remediation_engine.py)

### 12.4 Why this is impressive to judges

Many demos stop at “we detected a problem.”

This system does more:

- preserves transaction flow
- repairs the failed dependency
- restores the normal mode automatically

That is much closer to real AIOps behavior.

## 13. Other remediation actions currently implemented

### ML engine / cascade

- activate backend fallback
- restart ML engine
- wait for health
- disable fallback

### Blockchain

- restart blockchain container
- poll RPC port
- redeploy observability contract

### Backend

- restart backend container
- poll `/health`

### Redis

- keep memory fallback active
- restart Redis
- restore Redis-backed mode when healthy

### Frontend

- restart frontend container
- poll frontend URL

### Simulator

- restart load generator container

## 14. Why the blockchain evidence trail exists

The contract logs:

- anomaly detection
- remediation execution
- fallback activation
- fallback deactivation

Why this matters:

- it creates tamper-evident operational evidence
- it makes the observability layer itself auditable
- it fits the fintech domain naturally

This is not blockchain-for-hype.
It is blockchain-for-incident evidence.

## 15. Why the backend and ML endpoints show “Not Found” or “Cannot GET /”

This confused you earlier, and it is normal.

### Backend

If you open:

- `http://localhost:3001/`

and previously saw:

- `Cannot GET /`

that just meant the backend had no root route at `/`.
It did **not** mean the service was broken.

The actual useful endpoints are:

- `/health`
- `/metrics`
- `/api/...`

We already added a root route so it now returns service info.

### ML engine

If you open:

- `http://localhost:8000/`

and saw:

- `{"detail":"Not Found"}`

that meant FastAPI had no root route defined.

Again, it did **not** mean the service was broken.

The useful endpoints are:

- `/health`
- `/metrics`
- model routes such as `/features/extract`, `/ensemble/score`, `/gnn/score`, `/lstm/score`

We added a root route there too so the container is easier to validate in Docker.

## 16. Why we have runtime and research profiles

This is important if judges ask:

“Are you really using DistilBERT and LSTM, or did you simplify it?”

The honest answer is:

- the architecture is designed around those models
- the repo supports the research-grade path
- for the demo runtime, we use lighter execution profiles where needed so the whole stack starts reliably on commodity hardware

This is the right engineering tradeoff.

Why:

- PS3 is about end-to-end real-time observability
- a demo that starts reliably and performs real RCA is better than a fragile research image that never becomes healthy

## 17. Demo narrative to use

Use this story:

1. PayShield is running as a live distributed payment-risk system.
2. k6/simulator traffic is continuously pushing transactions through backend, ML engine, Redis, and blockchain.
3. Prometheus collects service metrics.
4. Loki collects structured logs.
5. Jaeger collects distributed traces.
6. Observability-brain polls those streams every 2 seconds.
7. The observability ensemble scores each service.
8. If a real anomaly crosses confidence and consensus thresholds, the brain identifies the root-cause service.
9. The remediation engine triggers the correct service-aware action.
10. Fallback mode preserves business continuity during recovery.
11. Every anomaly and remediation is recorded for audit, including blockchain logging.

## 18. The strongest 6 sentences to say out loud

1. “PayShield itself is the distributed application under observation; we did not build a toy microservice app just for the observability demo.”
2. “Our AI observability layer is a multimodal ensemble that combines metric degradation scoring, semantic log anomaly detection, trace anomaly analysis, topology reasoning, and temporal correlation.”
3. “We do not remediate on weak signals; we use confidence thresholds, consensus checks, and repeat-cycle confirmation to suppress false alerts.”
4. “The system supports cascade analysis, so if the ML engine causes backend degradation, it still attributes the true root cause to the ML engine.”
5. “Our fallback layer keeps transaction scoring alive while the failed service is being recovered, which gives us business continuity, not just restart automation.”
6. “Every anomaly and remediation action is preserved in an immutable evidence trail, which is especially relevant in a financial-risk system.”

## 19. Likely judge questions and clean answers

### Q: Why not just use thresholds?

Because thresholds only tell you something is high or low. They do not reliably identify which service caused the issue, especially during cascades. We use multimodal fusion with topology and temporal reasoning so we can attribute the actual source.

### Q: Why use multiple models instead of one?

Metrics, logs, and traces carry different failure semantics. Metrics capture drift, logs capture semantic error context, and traces capture path-level latency and failures. A single model would miss part of the picture.

### Q: Why ExtraTrees and HistGradientBoosting in the fraud runtime?

They preserve a strong tabular ensemble signal with much lower runtime overhead than heavy external boosting dependencies inside the demo container. That keeps the full stack operational while still giving us diverse supervised tree learners plus an unsupervised novelty detector.

### Q: Why is fallback useful?

Because in production, restarting a dependency is not enough if it causes the whole business workflow to stop. Fallback mode keeps the payment system operational while the bad dependency is recovered.

### Q: What makes this better than a monitoring dashboard?

This system detects, attributes, suppresses false alerts, remediates automatically, and records evidence. A dashboard only visualizes; it does not close the loop.

## 20. What to emphasize most in the pitch

Lead with these:

- multimodal observability ensemble
- cascade-aware root-cause attribution
- fallback-based business continuity
- automated remediation
- under-15-second control loop
- immutable evidence trail

Do not lead with these:

- fraud model AUC
- blockchain details first
- frontend polish
- implementation library names before the high-level idea

## 21. The honest positioning to use

Say this clearly:

“PayShield remains a real payment-risk platform, but for PS3 the main innovation is the observability doctor we built on top of it. That doctor watches the live stack, identifies the real failing service from metrics, logs, and traces, suppresses false alerts, keeps the business workflow alive through fallback, and automatically restores the system.”

## 22. Final summary

This project is technically sound because it has:

- a real distributed workload
- an explicit multimodal RCA ensemble
- service-aware remediation
- a continuity-preserving fallback layer
- false-alert suppression
- cascade detection
- immutable incident evidence

That is a strong PS3 story.

## 23. Demo-mode realities

This section is important because it reflects the system exactly as it runs on the presentation laptop.

### Gmail mode

There are two valid modes:

- real Gmail mode
- internal simulation mode

If Gmail SMTP and IMAP credentials are configured in `.env`, the system can:

- send real BEC test mails to the Gmail inbox
- monitor the Gmail inbox in near real time

If those credentials are not configured, the demo still works by:

- injecting the email content directly into the fraud pipeline

This is not cheating. It is a deterministic fallback for presentation reliability.

### Grafana mode

Grafana is configured for anonymous viewer access in the demo runtime.

If the browser still shows a login screen because of an old session, the fallback credentials are:

- username: `admin`
- password: `payshield`

### Simulator mode

The load generator is intentionally slowed down for presentation clarity:

- 2 constant VUs
- no spike load by default
- BEC scenario every 60 seconds
- 2.5 second sleep between transaction loops

That still counts as real load, but it keeps the dashboard readable.

## 24. Exact Windows startup flow

Use these commands from PowerShell on Windows:

```powershell
cd "D:\Amogh Projects\PAYSHIELD-AI"
docker compose up -d
docker compose ps
```

Do not use `docker compose up` without `-d` during the demo, because it attaches the terminal to streaming logs. If you press `Ctrl + C` in attached mode, Docker may stop the services.

Expected healthy services:

- `payshield-frontend`
- `payshield-backend`
- `payshield-ml-engine`
- `payshield-blockchain`
- `redis`
- `payshield-simulator`
- `prometheus`
- `loki`
- `promtail`
- `jaeger`
- `grafana`
- `observability-brain`

## 25. Exact live demo flow

Open these tabs:

- `http://localhost:5173`
- `http://localhost:5173/observability`
- `http://localhost:3000`
- `http://localhost:16686`

Optional:

- `http://localhost:9090`

### Step 1: Show the observability dashboard

Start on:

- `http://localhost:5173/observability`

Point at:

- service health grid
- anomaly feed
- root cause detail panel
- remediation timeline
- 15-second SLA meter

Say:

“PayShield is the live distributed payment-risk platform. The Observability Brain ingests metrics, logs, and traces from this running stack, performs multimodal root-cause analysis, suppresses weak alerts, and triggers automated remediation under 15 seconds.”

### Step 2: Show Grafana

Open:

- `http://localhost:3000`

Focus on these panels:

- ML Engine Inference Latency
- Backend HTTP Error Rate
- Blockchain Write Latency
- Anomaly Events per Minute
- 15s SLA Compliance
- Log volume by level

Say:

“Grafana is the visualization layer for the live metrics and logs. The intelligence is not in Grafana; it is in the Observability Brain.”

### Step 3: Show Jaeger

Open:

- `http://localhost:16686`

Say:

“Jaeger gives us the distributed trace path. This is how we distinguish upstream root cause from downstream symptoms.”

### Step 4: Trigger the PS3 demo

Open a second PowerShell window and run:

```powershell
cd "D:\Amogh Projects\PAYSHIELD-AI"
powershell -ExecutionPolicy Bypass -File .\scripts\demo_15s.ps1
```

This script:

- injects a cascade failure
- waits for anomaly detection
- waits for root-cause attribution
- waits for remediation
- waits for recovery confirmation
- prints total elapsed time

### Step 5: What to say while it runs

Use this exact explanation:

1. “I’m injecting a controlled cascade failure.”
2. “The observability-brain polls telemetry every 2 seconds.”
3. “The RCA ensemble combines metric degradation, log anomaly scoring, trace anomalies, topology reasoning, and consensus gating.”
4. “Weak or noisy signals are suppressed below confidence thresholds.”
5. “If the ML engine is the true root cause, the backend enters fallback mode so transaction flow continues during recovery.”
6. “The system then restarts the failed dependency, verifies health, and restores full mode automatically.”

### Step 6: Read the result

When the script prints:

- anomaly detected
- root cause attributed
- remediation triggered
- recovery confirmed
- total elapsed time

Say:

“This is the full PS3 control loop: detect, attribute, remediate, and recover.”

If it completes under 15 seconds, say:

“We satisfied the end-to-end SLA.”

## 26. Optional Gmail/BEC demo

If Gmail SMTP and IMAP credentials are configured, the system can send and monitor real Gmail traffic.

If you want a presentation-safe email attack demo regardless of external mail reliability, run:

```powershell
Invoke-RestMethod -Method Post -Uri "http://localhost:3001/api/email/test-bec" -ContentType "application/json" -Body '{"scenario":"standard"}'
```

This will:

- send a real Gmail message if SMTP is configured
- otherwise inject the malicious email content directly into the fraud pipeline

Either way, the fraud pipeline and observability telemetry will react.

If judges ask why email delivery is optional, say:

“External email infrastructure is not required for the PS3 observability loop. We support real Gmail integration when credentials are present, and we also support deterministic internal attack injection for reliable demos.”

## 27. What to say if someone asks, “What exactly is the innovation?”

Say this:

“The fraud models are the workload. The innovation is the AI observability doctor on top of them. That doctor watches the running system, fuses metrics, logs, and traces into a multimodal RCA ensemble, suppresses false positives, activates fallback to preserve business continuity, remediates the real failing service, and verifies recovery under a strict SLA.”
