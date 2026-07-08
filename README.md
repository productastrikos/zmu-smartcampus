# ZMU Smart Digital Campus — Enterprise Platform POC

Full-stack demo dashboard for the **Zayed Military University Integrated Digital Campus RFP**
(ZMU-MSI-RFP-2026), built for the Astrikos S!aP technical preparation session.
All data is **synthetic**, generated deterministically into CSV files that act as the
system-of-record — mirroring the RFP's governed data-flow architecture.

## Run

```bash
npm install
npm run dev        # starts API (:5051) + Vite client (:5173) together
```

Open http://localhost:5173. To regenerate fresh demo data (timestamps re-anchor to "now"):

```bash
npm run generate
```

## Architecture

```
data/*.csv                  ← 29 synthetic datasets (system-of-record)
server/generate/            ← seeded data generator (npm run generate)
server/index.js             ← Express API: aggregates CSVs → module JSON
client/ (React + Vite)      ← 8 dashboard modules, Tailwind + design tokens
```

- **Design standard**: tokens, KPI cards, nav and panel styles ported from
  `productastrikos/UserInterface` (CSS custom properties, dark/light themes, Inter, 16px-radius panels).
- **Charts**: Recharts, themed to the standard's palette.
- **API proxy**: Vite proxies `/api/*` → Express on port 5051.

## Modules ↔ RFP mapping

| Route | Module | RFP coverage |
|---|---|---|
| `/` | Command Center | Cross-domain KPIs, agentic AI actions, alert correlation |
| `/digital-twin` | Campus Digital Twin | BIM-derived site plan, per-building telemetry, MEP assets, incident overlay |
| `/academic` | Domain A | SIS/LMS, partner integration (KU/Rabdan/SUAD), AI learning, labs, library, order of merit |
| `/readiness` | Domain B | HPO 5 readiness domains, Garmin Health API wearables, ACWR injury risk, human digital twin per cadet |
| `/enterprise` | Domain C | ERP finance (Muwazana), procurement, HRMS/manpower, master scheduling, DoF interface |
| `/campus-ops` | Domain D | BMS supervisory layer, EMS energy, CCTV/access, WMS weapons, parking/ANPR, fire & life safety |
| `/security` | Security Ops | Split-SIEM, RFC 5424 feed, four-network model (RED/YELLOW/ORANGE/GREY), PAM/NDR |
| `/integration` | Integration & Data | Data flows 1–8, single cadet ID master data, ICDs, MFT gateway, DR/Core42 posture |

## Key data flows implemented (per architecture slide)

1. SIS ↔ LMS/Library/Labs (single cadet ID)
2. ERP ↔ SIS/Scheduling + DoF statutory interface
3. IAM → all systems provisioning
4. Wearables/HPO ↔ analytics → readiness to SIS
5. OT → IT **one-way via data diode** (BMS/IoT telemetry)
6. Partner & DoF exchange via controlled MFT gateway
7. All platforms → **split-SIEM** (syslog RFC 5424)
8. Replication → DR ≥ 50 km; backup → Core42 via FedNet

## Demo storylines baked into the data

- **AHU-02 fault** in Academic Block B — temp drift, BMS alarm, agentic-AI work order (twin + campus ops).
- **Credential-stuffing burst** on IAM ~6h ago — visible in SIEM timeline and feed.
- **12 cadets ACWR > 1.4** — early-intervention queue ahead of "Exercise Desert Shield".
- **Library CO₂ spike** midday; **dining energy spike** yesterday evening.
- **2 weapons overdue** in WMS; **flow 5 diode** elevated error rate (schema drift).

> Restricted RFP — synthetic demonstration data only. Keep confidential.
