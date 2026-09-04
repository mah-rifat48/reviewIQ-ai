# 🧠 ReviewIQ — NestJS AI Microservice

The **ReviewIQ AI Microservice** is a high-performance **NestJS (TypeScript)** backend responsible for Google Places integration, customer review sentiment analysis, category score calculations, competitor benchmark insights, and OpenAI LLM completions.

---

## 🚀 Features

- **OpenAI Integration**: Powered by `gpt-4o-mini` with strict JSON schema outputs.
- **LLM Caching**: SHA-256 query digest caching in SQLite to prevent duplicate OpenAI API charges.
- **Google Places API Integration**: New Places API (`v1/places:searchText`, `v1/places:searchNearby`), legacy Maps photo proxying, and URL expansion.
- **Competitor Analysis**: Radar charts, performance comparison, category difference analysis, and strategic recommendation generation.
- **Swagger Documentation**: Live interactive OpenAPI documentation at `/docs`.

---

## ⚡ Quick Start

### 1. Environment Configuration
Ensure `.env` exists in `aimalya_ai_nestjs/`:
```env
PORT=8000
OPENAI_MODEL=gpt-4o-mini
OPENAI_API_KEY=your_openai_api_key_here
GOOGLE_PLACE_API=your_google_place_api_key_here
DATABASE_URL=postgresql://aimalya_user:secure_password_here@localhost:5433/aimalya_db?schema=public
```

### 2. Run Locally
```powershell
npm install
npm run start:dev
```
Access the server at `http://localhost:8000` and Swagger docs at `http://localhost:8000/docs`.

### 3. Run in Docker
```powershell
docker build -t reviewiq-ai:latest .
docker run -d -p 8000:8000 --env-file .env --name reviewiq_ai reviewiq-ai:latest
```

---

## 📁 File Structure

```
src/
├── controllers/                     # REST API Controllers
│   ├── business-setup.controller.ts # /businesses (fetch, locations, names, user)
│   ├── goals-setup.controller.ts    # /goals_set_up_py
│   ├── overview.controller.ts       # /dashboard/overview
│   ├── reviews.controller.ts        # /reviews/analysis
│   ├── ai-insights.controller.ts    # /insights (recommendations, place-photo)
│   ├── monthly-report.controller.ts # /reports/monthly
│   ├── competitor.controller.ts     # /competitors/analysis
│   ├── business-management.controller.ts # /businesses/management
│   └── business-profile.controller.ts    # /business-profile
│
├── services/                        # Business & AI Services
│   ├── openai.service.ts            # OpenAI chat completions & cache wrapper
│   ├── google-places.service.ts     # Google Places API integration & photo stream
│   ├── dashboard-analysis.service.ts# Review sentiment & criteria score analysis
│   ├── overview.service.ts          # Dashboard metrics & sentiment trends
│   ├── review-analysis.service.ts   # Formatted review analysis page builder
│   ├── ai-insights.service.ts       # Insights & actionable recommendation prompts
│   ├── monthly-report.service.ts    # Date filtering, KPIs & AI monthly summary
│   ├── competitor-analysis.service.ts # Competitor radar, advantages & AI strategy
│   └── business-management.service.ts # Business management detail views & categories
│
├── db/                              # Database & Persistence Layer
│   ├── database.service.ts          # SQLite connection manager (WAL mode)
│   ├── cache.service.ts             # LLM response cache (llm_cache table)
│   ├── business-store.service.ts    # User business records
│   ├── place-store.service.ts       # Places, photos, reviews & rating snapshots
│   ├── business-context-store.service.ts # Business contexts & goals
│   ├── recommendation-store.service.ts   # Actionable recommendations
│   ├── route-hit-store.service.ts        # Route hit logging
│   └── user-data-store.service.ts        # Cascade user data deletion
│
├── app.module.ts                    # Root NestJS Module
└── main.ts                          # Server Bootstrap & Swagger Setup
```

---

## 🗄️ SQLite Database Schema

- **`llm_cache`**: `(cache_key PRIMARY KEY, kind, model, prompt_version, payload, created_at)`
- **`user_businesses`**: `(id, user_id, context_id, business_name, business_category, phone_no, website, business_address, input_address, place_id, place_payload, raw_input, account_status, created_at, updated_at)`
- **`places`**: `(place_id PRIMARY KEY, name, business_status, types, formatted_address, rating, user_ratings_total, price_level, opening_hours_open_now, opening_hours_weekday_text, formatted_phone_number, international_phone_number, website, geometry_location_lat, geometry_location_lng, updated_at)`
- **`photos`**: `(id, place_id, height, width, photo_reference UNIQUE, html_attributions)`
- **`reviews`**: `(id, place_id, author_name, rating, text, time, relative_time_description, language, review_hash UNIQUE)`
- **`place_rating_snapshots`**: `(id, place_id, rating, user_ratings_total, recorded_at)`
- **`actionable_recommendations`**: `(id, user_id, title, title_key, status, payload, created_at, updated_at, read_at)`
