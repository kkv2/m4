<p align="center">
  <img src="docs/assets/banner.svg" alt="M4 — Multi Model, Multi Modal." width="100%">
</p>

<h1 align="center">M4</h1>
<p align="center"><strong>Multi Model, Multi Modal.</strong><br>One workspace. Many models. Any modality.</p>

---

## Overview

**M4** is a multi-tenant SaaS web application built for use by multiple companies on a shared platform.

Chatting with an LLM is the core experience, combined with **RAG search** over internal documents.
Knowledge that would otherwise stay scattered across people and formats — text, images, and more —
is turned into shared, accumulated knowledge. The effort of hunting for it is absorbed by RAG search.

### Behind the name

| Name | Meaning |
| --- | --- |
| **Multi Model** | Pick the LLM to use right from the UI (OpenAI, Gemini, and more) |
| **Multi Modal** | Handle modalities beyond text in one unified experience |

## Features

- **Multi-tenancy** — Multiple companies share one platform while staying isolated from each other
- **LLM chat** — Conversation is the primary interface; every exchange is kept as history
- **Model selection** — Switch the LLM in use from the screen
- **Multi-modal input and output** — Images and other modalities alongside text
- **RAG search** — Search internal documents across the tenant and ground answers in them
- **Tenant-wide knowledge** — Uploaded files are shared within the tenant. There is no private per-user space, because allowing one would let knowledge become siloed again

## Tech Stack

TypeScript everywhere. Backend and frontend live together in this single repository as a **monorepo**,
with a **BFF (Backend For Frontend)** layer between the frontend and the services behind it.

```
M4 (monorepo)
├── Next.js (App Router)
│   ├── React
│   ├── Tailwind CSS
│   │
│   └── BFF
│       └── tRPC
│
├── Prisma
│   └── PostgreSQL
│
├── LLM
│   ├── OpenAI
│   └── Gemini
│
├── Docker
│   └── PostgreSQL (local container)
│
└── Testing
    ├── Vitest
    └── Playwright
```

| Layer | Technology |
| --- | --- |
| Language | TypeScript |
| Frontend | Next.js (App Router) / React / Tailwind CSS |
| BFF | tRPC |
| ORM | Prisma |
| Database | PostgreSQL |
| LLM | OpenAI / Gemini |
| Local development | Docker (Docker Compose) |
| Testing | Vitest (unit and integration) / Playwright (E2E) |

> Infrastructure (AWS, GCP, and so on) is deferred. Local development with Docker Compose comes first.
> Installing and setting up each of the technologies above is left to upcoming tasks.

## Design

- Styling with **Tailwind CSS**
- A **dark** base tone throughout
- Everything else is decided as it comes up

## Development Rules

- Driven by **GitHub Spec Kit**, following **SDD (Spec Driven Development)** and **AI-DLC**
- **Humans write zero lines of code** — the implementation is entirely AI-authored

## Out of Scope

- No language support beyond Japanese and English
- Multi Modal is the goal, but **video is not supported for now** (it may be added later)
