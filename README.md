# PayShield AI 🛡️
### Real-Time Fraud Intelligence Platform for Digital Payments

PayShield AI is a modular, production-grade fraud detection platform built for modern digital payment ecosystems. It combines machine learning, behavioral analytics, and graph-based intelligence to generate explainable, real-time fraud risk scores — designed with scalability, resilience, and extensibility in mind.

---

## Why PayShield AI?

Digital payment systems face increasingly sophisticated threats — account takeovers, transaction laundering, fraud rings, and social engineering attacks. PayShield AI addresses these with a multi-layered intelligence pipeline that works in real time, at scale, without sacrificing explainability.

---

## Features ✨

- **Real-Time Risk Scoring** — Ensemble ML models evaluate every transaction instantly
- **Behavioral Intelligence** — Detect unusual user patterns and temporal anomalies
- **Graph-Based Detection** — Identify fraud rings and shared entities via network analysis
- **BEC Detection (NLP)** — Analyze emails for Business Email Compromise signals
- **SMS Fraud Signals** — Parse and score incoming bank SMS alerts
- **Blockchain Audit Logging** — High-risk events logged to a tamper-resistant ledger
- **Fault-Tolerant Architecture** — Fallback scoring keeps the system running if ML services go down

---

## Architecture
Frontend (React + Vite)
↓
Backend API (Node.js + Express)
├── ML Engine     (FastAPI / Python)
├── Email Monitor (IMAP)
├── SMS Ingestion (HTTP)
└── Blockchain    (Hardhat / Ethereum)

A loosely coupled, microservices-inspired design — each component is independently deployable and replaceable.

---

## ML Pipeline 🤖

PayShield AI uses a hybrid ensemble combining supervised, unsupervised, and graph-based models:

| Model | Role |
|---|---|
| Graph Neural Network | Detect fraud rings and entity relationships |
| BiLSTM + Attention | Capture temporal transaction patterns |
| XGBoost | Structured tabular classification |
| LightGBM | Efficient gradient-boosted scoring |
| Isolation Forest | Unsupervised anomaly detection |
| NLP Classifier | Flag suspicious financial communications |

**Fraud patterns detected:** Smurfing, layering, circular transactions, fan-out behavior

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite |
| Backend | Node.js + Express |
| ML Engine | Python + FastAPI |
| Blockchain | Hardhat (local Ethereum node) |
| Real-Time Comms | WebSockets |
| Data Simulation | Python |

---

## Getting Started 🚀

### Prerequisites

- Node.js >= 18
- Python >= 3.10
- npm or yarn
- Git

### 1. Clone the Repository

```bash
git clone https://github.com/<your-username>/payshield-ai.git
cd payshield-ai
```

### 2. Start the Blockchain Node

```bash
cd Blockchain
npx hardhat node
```

### 3. Deploy Smart Contracts

```bash
npx hardhat compile
npx hardhat run scripts/deploy.js --network localhost
```

### 4. Start the ML Engine

```bash
cd ml-engine
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --port 8000
```

### 5. Start the Backend

```bash
cd backend
npm install
node src/server.js
```

### 6. Start the Frontend

```bash
cd frontend
npm install
npm run dev
```

Visit: [http://localhost:5173](http://localhost:5173)

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/transactions/submit` | Submit a transaction for fraud scoring |
| `GET` | `/api/transactions/history` | Retrieve transaction history |
| `POST` | `/api/email/test-bec` | Analyze an email for BEC signals |
| `POST` | `/api/sms/incoming` | Process an incoming SMS alert |
| `GET` | `/health` | Service health check |

---

## Design Principles

- **Explainability First** — Risk scores are transparent and interpretable, not black boxes
- **Resilience** — The system degrades gracefully under partial failure
- **Modularity** — Components are independently replaceable and scalable
- **Security-Conscious** — No credentials or sensitive data in the codebase

---

## Security

- Use environment variables for all secrets and API keys
- Never commit `.env` files to version control
- Do not use real financial or personal data in development or testing

---

## Contributing 🤝

Contributions are welcome across all areas:

- Machine learning improvements and experimentation
- Backend API design and optimization
- Frontend visualization and UX enhancements
- Fraud detection research and feature engineering

**Good first issues:**
- Improve model explainability outputs
- Add new fraud detection heuristics
- Enhance API validation and error handling
- Optimize real-time processing performance

---

## Roadmap 🗺️

- [ ] Cloud-native deployment (Docker + Kubernetes)
- [ ] Integration with real-world financial APIs
- [ ] Advanced explainability dashboards
- [ ] Event-driven streaming architecture (Kafka)

---

## License

This project is licensed under the [MIT License](LICENSE).
