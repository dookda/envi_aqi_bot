# Specification

## Local Air Quality AI Query Layer with Guardrail (Docker-Based)

---

## 1. Objective

Define a software component (“AI Layer”) that enables **natural-language querying of air quality data only**, using a **local Large Language Model (LLM)** running in Docker, with **strict domain guardrails** to prevent non–air-quality usage.

---

## 2. Scope

The system SHALL:

* Accept user queries in natural language (Thai and English)
* Process **only air quality–related queries**
* Convert valid queries into **structured query parameters**
* Retrieve historical air quality data via a backend API
* Return results suitable for **time-series visualization**
* Operate entirely **on-premise / offline**

The system SHALL NOT:

* Act as a general-purpose chatbot
* Answer questions outside the air quality domain
* Allow the LLM to access databases or external services
* Execute or generate code, SQL, or scripts

---

## 3. System Architecture

```
Client / UI
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
   ▼
Backend Air Quality API
   │
   ▼
Time-Series Database
```

---

## 4. Deployment Requirements

* MUST be deployed using Docker and docker-compose
* MUST run without internet connectivity
* MUST use a **local LLM server** (e.g., Ollama)
* MUST isolate services into separate containers:

  * AI Layer
  * Local LLM
  * Backend API

---

## 5. Local LLM Specification

### 5.1 Runtime

* LLM runtime MUST expose an HTTP API
* Ollama is the reference implementation

### 5.2 Supported Models

Minimum requirements:

* Instruction-following
* Deterministic JSON output
* Multilingual (Thai / English)

Recommended:

* llama3.1:8b
* qwen2.5:7b
* mistral:7b

---

## 6. Air-Quality Guardrail Module (Mandatory)

### 6.1 Purpose

Ensure the AI Layer responds **exclusively** to air quality–related queries and deterministically rejects all others.

---

### 6.2 Guardrail Layer 1: Keyword Filter (Pre-LLM)

The system MUST evaluate the raw user query before invoking the LLM.

**Accepted keyword set (case-insensitive):**

* pm25
* pm10
* aqi
* air quality
* pollution
* ozone / o3
* no2
* so2
* co
* dust
* คุณภาพอากาศ
* ฝุ่น

**Rules**

* If none of the keywords are present:

  * The query MUST be rejected
  * The LLM MUST NOT be invoked

**Response**

```json
{
  "status": "out_of_scope",
  "message": "This system answers air quality–related questions only."
}
```

---

### 6.3 Guardrail Layer 2: Domain-Restricted LLM Prompt

The LLM MUST receive a system instruction enforcing domain restriction.

**Mandatory System Prompt**

```
You are an Air Quality Assistant.

You are allowed to process ONLY queries related to:
- Air quality
- Air pollutants (PM2.5, PM10, AQI, O3, NO2, SO2, CO)
- Air quality monitoring stations
- Historical or aggregated air quality data
- Time-series visualization of air quality

If the query is not related to air quality,
return ONLY the following JSON:

{
  "status": "out_of_scope"
}

Do not add explanations.
```

---

### 6.4 Guardrail Layer 3: Intent Validation (Post-LLM)

All LLM outputs MUST be validated before use.

The system MUST reject any output that:

* Is not valid JSON
* Contains fields outside the approved schema
* References non-air-quality concepts
* Contains executable code, SQL, or free-form text

---

## 7. Intent Output Specification

### 7.1 Output Format (JSON Only)

```json
{
  "station_id": "string",
  "pollutant": "pm25 | pm10 | aqi | o3 | no2 | so2 | co",
  "start_date": "ISO-8601 datetime",
  "end_date": "ISO-8601 datetime",
  "interval": "15min | hour | day"
}
```

### 7.2 Constraints

* All fields are REQUIRED
* No additional fields are permitted
* Relative time expressions MUST be resolved to absolute datetimes
* Output MUST be deterministic

---

## 8. Temporal Aggregation Rules

The AI Layer MUST determine aggregation automatically:

| Time Span  | Interval |
| ---------- | -------- |
| ≤ 24 hours | 15min    |
| 1–7 days   | hour     |
| > 7 days   | day      |

Users MUST NOT be required to specify the interval.

---

## 9. Backend API Contract

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

---

## 10. Error Handling

### Out-of-Scope Query

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

The system MUST NOT provide explanatory or conversational text.

---

## 11. Security Constraints

* LLM MUST NOT access the database
* LLM MUST NOT generate SQL or executable code
* No external HTTP requests from the LLM
* Maximum query length: 300 characters

---

## 12. Logging Requirements

The system MUST log:

* User query
* Guardrail decision (accepted / rejected)
* Parsed intent (if valid)
* Timestamp

Sensitive prompt content MUST NOT be logged.

---

## 13. Non-Functional Requirements

* Stateless AI Layer
* Response latency ≤ 2 seconds (local GPU)
* Horizontal scalability via Docker
* Deterministic behavior

---

## 14. Acceptance Criteria

The implementation is accepted if:

1. All non-air-quality queries are rejected
2. Valid air-quality queries produce valid JSON intents
3. The LLM never directly accesses data sources
4. The system runs fully offline in Docker
5. Outputs are suitable for time-series chart rendering

---

## 15. Explicit Exclusions

* General chatbot functionality
* Weather forecasting beyond air quality
* Health advice or policy recommendations
* Conversational or narrative responses

---

**End of Specification**

