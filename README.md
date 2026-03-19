# 🧠 AI Context: Airplus Smart Home Dashboard (ThingsBoard Backend)

## 1. System Overview

You are working with an **Airplus Smart Home Dashboard** project.

* Backend platform: **ThingsBoard**
* Server URL: https://smarthome.lh.co.th/
* Architecture constraint: **No external database**
* System purpose:

  * Control smart home devices (e.g., Air Purifier, Fan, Light, HVAC)
  * Monitor **PM2.5 air quality inside the home**
* All data (telemetry, attributes, control states) must remain inside ThingsBoard
* For API access use: https://smarthome.lh.co.th/swagger-ui/

Your role is to assist with:

* Smart device data modeling
* PM2.5 monitoring logic
* Device control design (on/off, modes)
* Dashboard UI/UX
* API usage
* Rule Chain automation

---

## 2. Core Constraints (IMPORTANT)

* ❌ Do NOT use external databases (MySQL, PostgreSQL, MongoDB, etc.)
* ❌ Do NOT suggest external IoT or analytics platforms
* ✅ Use only ThingsBoard features:

  * Telemetry
  * Attributes
  * Rule Chains
  * Dashboards
* ✅ Assume ThingsBoard is the single source of truth

---

## 3. Smart Home + Air Quality Definition

### PM2.5 Monitoring

* PM2.5 represents fine particulate matter (≤ 2.5 µm)
* Key indoor air quality metric for health

### Air Quality Levels (Example)

| PM2.5 (µg/m³) | Level     | Status |
| ------------- | --------- | ------ |
| 0–12          | Good      | 🟢     |
| 13–35         | Moderate  | 🟡     |
| 36–55         | Unhealthy | 🟠     |
| >55           | Hazardous | 🔴     |

---

## 4. Data Model (Telemetry)

Devices send telemetry to ThingsBoard using:

### 🌫 Air Quality Sensor

* pm25 → PM2.5 value (µg/m³)
* temperature → °C
* humidity → %

### ⚙️ Device Control (Airplus Devices)

* power → "ON" / "OFF"
* mode → "AUTO" / "MANUAL" / "SLEEP"
* fan_speed → 1–5
* filter_status → % remaining

### 🏠 System Status

* room → room name (living room, bedroom, etc.)
* device_status → "ONLINE" / "OFFLINE"

All values are time-series telemetry.

---

## 5. Expected AI Behavior

### ✔ Follow These Rules

* Use ThingsBoard APIs and built-in capabilities
* Prefer real-time telemetry-driven logic
* Keep solutions simple and scalable
* Align with IoT smart home architecture

### ✔ When Suggesting Solutions

* Use:

  * Rule Chains for automation
  * Attributes for configuration (e.g., thresholds)
  * Dashboard widgets for control + monitoring

### ❌ Avoid

* External automation systems
* Cloud functions outside ThingsBoard
* Complex distributed architectures

---

## 6. Example API Usage

### HTTP Telemetry Upload

POST /api/v1/{ACCESS_TOKEN}/telemetry

Example payload:

```json
{
  "pm25": 28,
  "temperature": 26,
  "humidity": 60,
  "power": "ON",
  "mode": "AUTO"
}
```

---

## 7. Dashboard Requirements

The dashboard should include:

### 🌫 Air Quality

* Real-time PM2.5 value
* Air quality level (color indicator)
* Historical trends (time-series)

### ⚙️ Device Control

* Power ON/OFF toggle
* Mode selector (AUTO / MANUAL / SLEEP)
* Fan speed control

### 🏠 Smart Overview

* Room-based device grouping
* Device online/offline status
* Filter health monitoring

### 🎛 UX Features

* Thai / English switch
* Dark / Light mode
* Mobile-friendly UI

---

## 8. Output Style Guidelines

* Be concise and technical
* Provide step-by-step instructions
* Use structured formats (sections, bullets)
* Focus on practical implementation

---

## 9. Optional Enhancements (If Asked)

* Auto-control Air Purifier based on PM2.5 threshold
* Air quality alerts (LINE / Notification via ThingsBoard)
* Predictive filter replacement
* Multi-room air quality aggregation

---

## 10. Summary

This project is a **ThingsBoard-only Smart Home + Air Quality Monitoring system**.

All recommendations must:

* Stay within ThingsBoard
* Use telemetry-driven logic
* Avoid external dependencies

---

## 11. Required Tech Stack

* Framework: **Next.js 16 + React 19 + TypeScript**
* AI Orchestration: **Vercel AI SDK**
* Styling: **Tailwind CSS v4**
* Component System: **shadcn/ui**
* Data Layer: **TanStack Query v5 + Next.js cache**
* Data Grid: **TanStack Table v8**
* Validation: **Zod + React Hook Form**

---

## 12. Speed Optimization & Performance

To reduce latency and improve responsiveness:

### ⚡ Edge Calculation via Rule Chains

* Use Rule Chain nodes:

  * **Threshold detection (PM2.5 levels)**
  * **Auto device control (e.g., turn ON purifier when PM2.5 > threshold)**

### 📉 Reduce Payload

* Devices send only:

  * PM2.5 changes
  * Device state changes

### 🚀 Frontend Optimization

* Use TanStack Query:

  * `staleTime: 30000`
* Use Next.js `use cache` for API calls

---

## 13. Background Tasks (Within ThingsBoard)

### ⏰ Scheduler

* Periodically evaluate:

  * Air quality trends
  * Device usage

### 🧠 State Persistence

* Store:

  * Last PM2.5 alert timestamp
  * Last device state

### 🧹 Data Retention

* Apply TTL:

  * Keep raw sensor data short-term
  * Keep aggregated air quality metrics long-term

---

## 14. Security Hardening

* Use unique **Device Access Tokens** per device
* Validate all inputs using Zod
* Use Next.js Middleware for JWT validation
* Store sensitive configs (thresholds) in **Server Attributes**
* Enable ThingsBoard rate limits

---

## 15. User Roles & Access Control

### Hierarchy

* Tenant Administrator → full system control
* Customer Administrator → manage home/devices
* Customer User → view dashboard + control devices

---
