# Specification: Hourly Air Quality Data Pipeline with LSTM-based Imputation

## 1. Purpose and Scope

This document defines a **spec-driven technical specification** for implementing an hourly air quality data system. The system retrieves 30-day historical PM2.5 data from Air4Thai APIs, stores it in a relational time-series database, detects missing data, performs LSTM-based imputation, and validates imputed results.

The specification is intended for direct use by a **code agent editor** and assumes clear separation of concerns between ingestion, storage, modeling, and evaluation layers.

---

## 2. External Data Sources

### 2.1 Station Metadata API

**Endpoint**

```
http://air4thai.pcd.go.th/forappV2/getAQI_JSON.php
```

**Purpose**

* Retrieve all available station metadata
* Extract stationID, name, coordinates, and station type

**Required Fields**

* stationID (string, primary external key)
* nameEN / nameTH
* lat, long (float)
* stationType

**Agent Responsibilities**

* Fetch JSON
* Parse `stations[]`
* Persist station metadata into `stations` table
* De-duplicate by stationID

---

### 2.2 30-Day Historical PM2.5 API

**Endpoint Template**

```
http://air4thai.com/forweb/getHistoryData.php
  ?stationID={station_id}
  &param=PM25
  &type=hr
  &sdate={start_date}
  &edate={end_date}
  &stime=00
  &etime=23
```

**Temporal Constraint**

* Hourly data
* Maximum span: 30 days

**Expected Response Structure**

* result == "OK"
* stations[0].data[] containing:

  * DATETIMEDATA (YYYY-MM-DD HH:MM:SS)
  * PM25 (float or null)

**Agent Responsibilities**

* Iterate over stationID list
* Generate rolling 30-day window
* Convert DATETIMEDATA to UTC or system standard
* Handle missing PM25 values explicitly as NULL

---

## 3. Data Storage Layer (Step 1.2)

### 3.1 Database Technology

* PostgreSQL 15+
* TimescaleDB extension enabled

### 3.2 Tables

#### 3.2.1 stations

```
stations (
  station_id TEXT PRIMARY KEY,
  name_th TEXT,
  name_en TEXT,
  lat DOUBLE PRECISION,
  lon DOUBLE PRECISION,
  station_type TEXT
)
```

#### 3.2.2 aqi_hourly

```
aqi_hourly (
  station_id TEXT REFERENCES stations(station_id),
  datetime TIMESTAMP WITHOUT TIME ZONE,
  pm25 DOUBLE PRECISION,
  is_imputed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (station_id, datetime)
)
```

**Constraints**

* Unique hourly record per station
* Allow NULL pm25 at insert time

---

## 4. Data Ingestion & Validation (Step 2)

### 4.1 Time Index Normalization

* All stations must have a complete hourly index
* Expected frequency: 1 hour

**Rule**

* Missing timestamps must be explicitly inserted with pm25 = NULL

### 4.2 Missing Data Detection

**Definition of Missing**

* pm25 IS NULL
* Missing hourly timestamp in sequence

**Classification**

* Short gap: 1–3 hours
* Medium gap: 4–24 hours
* Long gap: >24 hours (flag only, no imputation)

---

## 5. LSTM Imputation Layer (Step 3)

### 5.1 Modeling Objective

* Predict missing PM2.5 values using temporal patterns
* One model per station (default)

### 5.2 Training Dataset Construction

**Input Features**

* pm25 (single-variable time series)

**Sequence Length**

* 24 hours (configurable)

**Training Rule**

* Use only contiguous sequences with no missing values

### 5.3 Model Architecture (Reference)

* LSTM (64 units)
* LSTM (32 units)
* Dense (1)

**Loss Function**

* Mean Squared Error (MSE)

---

## 6. Automated Imputation Workflow (Step 4)

### 6.1 Trigger Conditions

* New hourly ingestion completed
* Missing pm25 detected

### 6.2 Imputation Rules

1. Query previous 24 valid hours
2. Normalize using station-specific scaler
3. Run LSTM prediction
4. Insert predicted value
5. Set `is_imputed = TRUE`

**Exclusion Rule**

* Do not impute if insufficient historical context (<24 hours)

---

## 7. Scheduling and Execution

### 7.1 Batch Mode (Initial 30 Days)

* Sequential ingestion per station
* Imputation executed after full 30-day insert

### 7.2 Operational Mode

* Hourly cron / scheduler
* Order: ingest → detect → impute → commit

---

## 8. Validation and Evaluation (Step 5.1)

### 8.1 Offline Validation

**Method**

* Artificially mask known pm25 values
* Compare predicted vs actual

**Metrics**

* RMSE
* MAE

### 8.2 Baseline Comparison

* Linear interpolation
* Forward-fill (naive)

### 8.3 Acceptance Criteria

* LSTM RMSE < Linear interpolation RMSE
* No negative pm25 values

---

## 9. Logging and Auditability

* Log every imputation event
* Store timestamp, model version, input window
* Enable rollback of imputed values

---

## 10. Non-Functional Requirements

* Idempotent ingestion
* Re-runnable pipeline
* Station-level isolation
* Extendable to PM10, O3, NO2 in future

---

## 11. Explicit Out-of-Scope

* Forecasting beyond current time
* Spatial interpolation between stations
* Policy or alerting logic

---

**End of Specification**
