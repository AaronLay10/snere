# Sentient Engine Observability

Complete monitoring and observability stack for development and debugging.

## 🎯 Quick Access

**Grafana Dashboards:** http://localhost:3200

- **Login:** `admin` / `admin` (change on first login)
- **Sentient Overview:** Service health, API metrics, resource usage
- **Device Monitoring:** MQTT device status, heartbeats, command rates

**Prometheus:** http://localhost:9090

- Raw metrics and PromQL queries
- Service discovery and targets
- Alert rules configuration

**Loki Logs:** Access via Grafana → Explore → Loki datasource

## 📊 Pre-configured Dashboards

### 1. Sentient Engine - Development Overview

**UID:** `sentient-overview`

**Panels:**

- Service health status (API, Executor, Device Monitor, PostgreSQL)
- API request rate and response time (95th percentile)
- Service memory and CPU usage
- PostgreSQL connection pool
- MQTT message rate

**Auto-refresh:** Every 10 seconds
**Time range:** Last 1 hour

### 2. Sentient Engine - Device Monitoring

**UID:** `sentient-devices`

**Panels:**

- Online/offline device count
- Commands per second
- Device status bar chart (online/offline by device)
- Last heartbeat age for each device
- Command rate by device
- Sensor reading rate by device
- Device status table with heartbeat timing

**Auto-refresh:** Every 10 seconds
**Time range:** Last 15 minutes

## 🔍 Available Metrics

### Service Metrics (Prometheus)

All services expose metrics on `/metrics` endpoint:

**API Service (port 3000):**

```
http_request_duration_seconds_bucket  # API response times
http_request_duration_seconds_count   # Request count
http_request_duration_seconds_sum     # Total time
process_resident_memory_bytes         # Memory usage
process_cpu_seconds_total             # CPU time
up{job="sentient-api"}                # Service health
```

**Executor Engine (port 3004):**

```
scene_execution_duration_seconds      # Scene runtime
timeline_events_executed_total        # Events processed
timeline_errors_total                 # Errors encountered
```

**Device Monitor (port 3003):**

```
mqtt_messages_published_total         # MQTT publishes
mqtt_messages_received_total          # MQTT receives
mqtt_device_online                    # Device online status
mqtt_device_heartbeat_age_seconds     # Time since last heartbeat
mqtt_commands_sent_total              # Commands sent per device
mqtt_sensor_readings_total            # Sensor data received
```

**PostgreSQL (via postgres_exporter):**

```
pg_up                                 # Database health
pg_stat_database_numbackends          # Active connections
pg_settings_max_connections           # Connection limit
pg_stat_database_xact_commit          # Transactions committed
pg_stat_database_blks_read            # Disk reads
```

### Log Aggregation (Loki)

All container logs are automatically collected by Promtail and sent to Loki.

**Query logs in Grafana:**

1. Go to Explore
2. Select Loki datasource
3. Use LogQL queries:

```logql
# All API logs
{container_name="sentient-api"}

# Errors only
{container_name="sentient-api"} |= "error"

# MQTT commands
{container_name="device-monitor"} |= "command"

# Scene executions
{container_name="executor-engine"} |= "scene"

# By log level
{container_name=~"sentient-.*"} | json | level="error"
```

## 🛠️ Custom Metrics

### Adding Metrics to Your Code

**TypeScript/Express:**

```typescript
import promClient from 'prom-client';

// Counter
const requestCounter = new promClient.Counter({
  name: 'my_requests_total',
  help: 'Total number of requests',
  labelNames: ['method', 'route', 'status'],
});

// Histogram
const responseTime = new promClient.Histogram({
  name: 'my_response_time_seconds',
  help: 'Response time in seconds',
  labelNames: ['route'],
  buckets: [0.1, 0.5, 1, 2, 5],
});

// Gauge
const activeConnections = new promClient.Gauge({
  name: 'my_active_connections',
  help: 'Number of active connections',
});

// Usage
requestCounter.inc({ method: 'GET', route: '/api/devices', status: '200' });

const timer = responseTime.startTimer();
// ... do work ...
timer({ route: '/api/devices' });

activeConnections.set(42);
```

## 📈 Creating Custom Dashboards

1. Open Grafana: http://localhost:3200
2. Login as `admin` / `admin`
3. Click `+` → Dashboard
4. Add panel
5. Select Prometheus datasource
6. Write PromQL query
7. Configure visualization
8. Save dashboard

**Example PromQL Queries:**

```promql
# Average API response time
rate(http_request_duration_seconds_sum[5m])
/
rate(http_request_duration_seconds_count[5m])

# 95th percentile response time
histogram_quantile(0.95,
  rate(http_request_duration_seconds_bucket[5m])
)

# Request rate by status code
sum by (status) (rate(http_request_duration_seconds_count[5m]))

# Memory usage trend
process_resident_memory_bytes{job="sentient-api"}

# Database connection pool utilization
pg_stat_database_numbackends / pg_settings_max_connections * 100

# Device uptime percentage
avg_over_time(mqtt_device_online[1h]) * 100
```

## 🔔 Alert Configuration

Create alert rules in Prometheus to get notified of issues.

**config/prometheus/alerts/sentient.yml:**

```yaml
groups:
  - name: sentient
    interval: 30s
    rules:
      - alert: ServiceDown
        expr: up == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: 'Service {{ $labels.job }} is down'

      - alert: HighAPILatency
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 2
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: 'API response time is high ({{ $value }}s)'

      - alert: DeviceOffline
        expr: mqtt_device_online == 0
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: 'Device {{ $labels.device_id }} is offline'
```

## 🐛 Troubleshooting

### Metrics Not Showing

1. **Check service is running:**

   ```bash
   docker compose ps
   ```

2. **Verify metrics endpoint:**

   ```bash
   curl http://localhost:3000/metrics
   ```

3. **Check Prometheus targets:**
   - Open http://localhost:9090/targets
   - Verify all services show "UP"

4. **Check Prometheus config:**
   ```bash
   docker compose logs prometheus | grep error
   ```

### Logs Not Appearing in Loki

1. **Verify Promtail is running:**

   ```bash
   docker compose ps promtail
   ```

2. **Check Promtail logs:**

   ```bash
   docker compose logs promtail
   ```

3. **Verify Loki datasource in Grafana:**
   - Configuration → Data Sources → Loki
   - Test connection

### Grafana Dashboard Not Loading

1. **Check dashboard provisioning:**

   ```bash
   docker compose logs grafana | grep dashboard
   ```

2. **Verify JSON syntax:**
   - JSON files in `config/grafana/dashboards/` must be valid
   - Use `jq` to validate: `cat dashboard.json | jq .`

3. **Restart Grafana:**
   ```bash
   docker compose restart grafana
   ```

## 📚 Resources

- **Prometheus Documentation:** https://prometheus.io/docs/
- **Grafana Documentation:** https://grafana.com/docs/
- **Loki Documentation:** https://grafana.com/docs/loki/
- **PromQL Tutorial:** https://prometheus.io/docs/prometheus/latest/querying/basics/
- **LogQL Tutorial:** https://grafana.com/docs/loki/latest/logql/

## 🔄 Retention and Storage

**Prometheus:**

- Retention: 15 days (configurable in `config/prometheus/prometheus.yml`)
- Storage: Docker volume `prometheus-data`

**Loki:**

- Retention: 7 days (configurable in `config/loki/loki-config-dev.yml`)
- Storage: Docker volume `loki-data`

**Grafana:**

- Dashboards: Provisioned from `config/grafana/dashboards/`
- Settings: Docker volume `grafana-data`

## 🎓 Best Practices

1. **Use labels consistently** - Same label names across all metrics
2. **Avoid high cardinality** - Don't use unique IDs in labels (use constant values like device types)
3. **Use histograms for latencies** - More accurate percentiles than gauges
4. **Name metrics clearly** - Follow Prometheus naming conventions (`<namespace>_<name>_<unit>`)
5. **Add help text** - Every metric should have a description
6. **Dashboard organization** - One dashboard per concern (overview, devices, performance, etc.)
7. **Set meaningful time ranges** - Short ranges for real-time, long ranges for trends
8. **Use variables** - Make dashboards reusable with template variables

---

**Need help?** Check the [System Architecture](../SYSTEM_ARCHITECTURE.md) or [Contributing Guide](../CONTRIBUTING.md)
