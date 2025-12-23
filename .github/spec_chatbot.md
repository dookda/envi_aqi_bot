# Specification

## Local Air Quality AI Query Layer with Guardrails and Multimodal Output (Docker-Based)

---

## 1. Objective

Define an **AI Layer** that enables querying and presentation of **air quality information only**, using a **local LLM running in Docker**, with **strict guardrails** and **API-mediated data access**, producing **structured and visualizable outputs**.

---

## 2. Scope

The system SHALL:

* Accept natural-language queries (Thai and English)
* Process **only air quality–related queries**
* Convert valid queries into **structured API requests**
* Access data **exclusively via Backend APIs**
* Produce responses that may include:

  * Text summaries
  * Charts (time-series)
  * Maps
  * Infographic-ready data structures
* Operate fully **offline / on-premise**

The system SHALL NOT:

* Allow the AI or LLM to directly access any database
* Generate or execute SQL
* Perform filesystem or network access beyond approved APIs
* Act as a general-purpose conversational agent

---

## 3. System Architecture

```
User / UI
   │
   ▼
AI Layer (FastAPI)
   │
   ├─ Air-Quality Guardrail Module
   │   ├─ Keyword Filter
   │   ├─ Domain Enforcement
   │   └─ Intent Validation
   │
   ├─ Local LLM Adapter
   │
   ├─ API Orchestrator
   │
   ▼
Backend Air Quality API
   │
   ▼
Time-Series Database
```

**Critical Rule**
The AI Layer and LLM **MUST NOT** connect to the database under any circumstance.
All data exchange **MUST occur via documented APIs only**.

---

## 4. Deployment Requirements

* Docker and docker-compose are mandatory
* Services MUST be isolated:

  * AI Layer
  * Local LLM runtime
  * Backend API
* Runtime MUST function without internet access
* All inter-service communication MUST occur over internal Docker networking

---

## 5. Local LLM Specification

### 5.1 Runtime

* HTTP-based inference server (e.g., Ollama)
* Stateless inference
* No external tool or plugin access

### 5.2 Model Capabilities

The LLM MUST support:

* Instruction following
* Deterministic JSON output
* Thai and English comprehension

Recommended models:

* llama3.1:8b
* qwen2.5:7b
* mistral:7b

---

## 6. Air-Quality Guardrail Module (Mandatory)

### 6.1 Purpose

Prevent non–air-quality usage and eliminate prompt injection risks by enforcing domain constraints **before and after LLM execution**.

---

### 6.2 Guardrail Layer 1: Keyword Filter (Pre-LLM)

Before invoking the LLM, the raw user query MUST be scanned.

**Accepted keywords (case-insensitive):**

* pm25, pm10, aqi
* air quality, pollution
* ozone, o3
* no2, so2, co
* dust
* คุณภาพอากาศ, ฝุ่น

**Rule**

* If no keyword is found:

  * Reject the request
  * Do not call the LLM

**Response**

```json
{
  "status": "out_of_scope",
  "message": "This system answers air quality–related questions only."
}
```

---

### 6.3 Guardrail Layer 2: Domain-Restricted LLM Prompt

The LLM MUST be invoked with the following **mandatory system instruction**:

```
You are an Air Quality Assistant.

You are allowed to handle ONLY:
- Air quality data
- Air pollutants (PM2.5, PM10, AQI, O3, NO2, SO2, CO)
- Monitoring stations
- Historical or aggregated air quality information
- Data intended for charts, maps, or infographics

If the query is not related to air quality,
return ONLY:

{
  "status": "out_of_scope"
}

Do not add explanations.
```

---

### 6.4 Guardrail Layer 3: Intent Validation (Post-LLM)

LLM output MUST be validated before API invocation.

The system MUST reject output that:

* Is not valid JSON
* Contains fields outside the approved schema
* Includes SQL, code, or instructions
* References non-air-quality concepts

---

## 7. Intent Specification (API-Oriented)

### 7.1 Intent Output (JSON Only)

```json
{
  "station_id": "string",
  "pollutant": "pm25 | pm10 | aqi | o3 | no2 | so2 | co",
  "start_date": "ISO-8601 datetime",
  "end_date": "ISO-8601 datetime",
  "interval": "15min | hour | day",
  "output_type": "text | chart | map | infographic"
}
```

### 7.2 Constraints

* All fields are REQUIRED
* No additional fields permitted
* All temporal expressions MUST be resolved to absolute datetimes
* `output_type` defines **presentation intent only**, not data access

---

## 8. Temporal Aggregation Rules

The AI Layer MUST automatically assign aggregation:

| Time Span  | Interval |
| ---------- | -------- |
| ≤ 24 hours | 15min    |
| 1–7 days   | hour     |
| > 7 days   | day      |

Users MUST NOT control aggregation logic directly.

---

## 9. Backend API Contract (Exclusive Data Access)

### Endpoint

```
GET /api/aqi/history
```

### Parameters

* station_id
* pollutant
* start_date
* end_date
* interval

### Response

```json
[
  {
    "time": "ISO-8601 datetime",
    "value": number
  }
]
```

The AI Layer MUST treat this API as the **sole data source**.

---

## 10. Response Composition Rules

The AI Layer MAY produce:

### 10.1 Text Summary

* Trend description
* Min / max values
* Time-of-day patterns

### 10.2 Chart Payload

* Time-series data
* Axis labels
* Threshold annotations

### 10.3 Map Payload

* Station location
* Latest or aggregated value
* Classification level (AQI class)

### 10.4 Infographic Payload

* Key indicators
* Comparison periods
* Highlighted anomalies

**The AI Layer MUST NOT embed raw database records or SQL output.**

---

## 11. Error Handling

### Out-of-Scope

```json
{
  "status": "out_of_scope",
  "message": "This system answers air quality–related questions only."
}
```

### Invalid Intent

```json
{
  "status": "invalid_request",
  "message": "Unable to interpret air quality parameters."
}
```

No explanatory or conversational fallback is permitted.

---

## 12. Security Constraints

* LLM MUST NOT access databases
* LLM MUST NOT generate SQL or code
* AI Layer MUST whitelist API endpoints
* Maximum query length: 300 characters

---

## 13. Logging Requirements

The system MUST log:

* User query
* Guardrail decision
* Parsed intent
* API endpoint called
* Timestamp

Sensitive prompt content MUST NOT be logged.

---

## 14. Acceptance Criteria

The implementation is accepted if:

1. AI never accesses the database directly
2. All data retrieval occurs via APIs only
3. Non–air-quality queries are rejected deterministically
4. Outputs support text, chart, map, or infographic rendering
5. The system runs fully offline in Docker

---

## 15. Explicit Exclusions

* General chatbot behavior
* Non–air-quality environmental data
* Health, policy, or advisory recommendations
* Direct visualization rendering (handled by frontend)

---

**End of AI chatbot Specification**
