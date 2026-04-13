<!--
FILE: README.md
ROLE: Project overview and complete local runbook for PayShield AI
INSPIRED BY: Production fintech architecture docs and hackathon demo playbooks
PERFORMANCE TARGET: Full local stack up and demo-ready in under 20 minutes
-->

# PayShield AI
## Real-Time Fraud Intelligence Platform for Digital Payments

PayShield AI is a real-time fraud detection and risk intelligence system designed for modern digital payment ecosystems. It combines machine learning, behavioral analytics, graph-based risk detection, and communication analysis to identify fraudulent activity and provide explainable decisions.

## 🚀 Overview

PayShield AI monitors transactions, user behavior, emails, and SMS signals to generate a comprehensive fraud risk score in real time.

It is built to emulate a production-grade fintech security system with:

- Multi-model AI ensemble
- Live data ingestion (transactions, Gmail, SMS)
- Explainable AI outputs
- Tamper-resistant audit logging

## 🧠 Key Features

### 1. Real-Time Risk Scoring
- Multi-model ensemble evaluates every transaction
- Combines anomaly detection, behavioral signals, and AML patterns

### 2. Explainable AI
- Human-readable reasoning behind every fraud decision
- Feature-level contribution (SHAP-style interpretation)

### 3. Email Fraud Detection (BEC)
- Detects Business Email Compromise patterns
- Flags urgency, account-change requests, and suspicious instruction tone

### 4. SMS-Based Fraud Signals
- Parses Indian bank SMS alerts
- Extracts transaction details and evaluates risk

### 5. Fraud Graph Detection
- Identifies fraud rings using shared entities
- Detects suspicious transaction networks in real time

### 6. Blockchain Audit Logging
- High-risk events stored on a local blockchain
- Ensures tamper-proof audit trails

### 7. Fault-Tolerant Pipeline
- Backend continues operating even if ML service is down
- Uses resilient fallback scoring logic

## 🏗️ System Architecture

```text
Frontend Dashboard  →  Backend API (Node.js)
                           ↓
        ┌──────────────┬──────────────┬──────────────┬──────────────┐
        ↓              ↓              ↓              ↓
   ML Engine      Gmail Monitor   SMS Ingestion   Blockchain
  (FastAPI)         (IMAP)         (HTTP)         (Hardhat)
```

## 🤖 AI Models Used

The platform uses a 6-model ensemble system:

### 1. Graph Neural Network (GNN)
- Detects fraud rings and shared entity relationships

### 2. Sequence Model (BiLSTM + Attention)
- Captures temporal fraud patterns (including warmup-to-drain behavior)

### 3. Tabular Models (XGBoost + LightGBM + Isolation Forest)
- Handles structured transaction data and anomaly detection

### 4. Behavioral Biometrics
- Evaluates user session trust patterns

### 5. BEC NLP Detector
- Identifies suspicious payment-instruction language in emails/memos

### 6. AML Pattern Engine
- Detects:
  - Smurfing
  - Layering
  - Circular transactions
  - Fan-out behavior

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite |
| Backend | Node.js + Express |
| ML Engine | Python + FastAPI |
| Blockchain | Hardhat (Ethereum local node) |
| Data Stream | Python |
| Realtime | WebSockets |

## ⚙️ Local Setup

Run each service in a separate terminal.

### 1. Blockchain Node
```powershell
cd "D:\Amogh Projects\PAYSHIELD-AI\Blockchain"
npx hardhat node
```

### 2. Deploy Smart Contracts
```powershell
cd "D:\Amogh Projects\PAYSHIELD-AI\Blockchain"
npx hardhat compile
npx hardhat run scripts/deploy.js --network localhost
```

### 3. ML Engine
```powershell
cd "D:\Amogh Projects\PAYSHIELD-AI\ml-engine"
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Health check:
```powershell
curl http://localhost:8000/health
```

### 4. Backend Server
```powershell
cd "D:\Amogh Projects\PAYSHIELD-AI\backend"
npm install
node src/server.js
```

Health check:
```powershell
curl http://localhost:3001/health
```

### 5. Frontend
```powershell
cd "D:\Amogh Projects\PAYSHIELD-AI\frontend"
npm install
npm run dev
```

Open:

- `http://localhost:5173`

### 6. (Optional) Data Stream Preload
```powershell
cd "D:\Amogh Projects\PAYSHIELD-AI\data-simulator"
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
python stream_generator.py --stop-after 200
```

## 📡 API Endpoints

| Method | Endpoint |
|---|---|
| POST | `/api/transactions/submit` |
| GET | `/api/transactions/history` |
| POST | `/api/email/test-bec` |
| GET | `/api/email/status` |
| POST | `/api/sms/incoming` |
| POST | `/api/sms/test` |
| GET | `/health` |

## 📱 SMS Forwarder Setup (Android)

Configure your SMS forwarder app:

- Method: `HTTP POST`
- URL: `http://<YOUR-IP>:3001/api/sms/incoming`
- Sender Filters: `HDFCBK`, `ICICIB`, `SBIPSG`, `AXISBK`, `KOTAKB`

## 🧪 Demo Usage

- Submit transactions from the frontend PaymentForm
- Send test emails for BEC detection
- Trigger SMS test endpoint
- Observe:
  - Risk scores
  - Model breakdown
  - Alerts
  - Blockchain logs

## 🔒 Security Notes

- Never commit `.env` files
- Do not store real credentials in the repo
- Use environment variables for all secrets

## 📌 Notes

- Designed as a real-time fintech fraud intelligence system for hackathon demonstration and technical evaluation
- Focused on modularity, explainability, and scalability
- Can be extended with:
  - Real banking APIs
  - Cloud deployment
  - Production-grade data pipelines



