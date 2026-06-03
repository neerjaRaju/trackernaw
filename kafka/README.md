# Streaming Pipeline — Kafka + Flink

```
Flutter App ──► POST /location/update ──► Node Backend
                                             │
                                             ▼
                                       Kafka topic: location-events
                                             │
                                             ▼
                                  Apache Flink job (enrichment, anomaly detection, geofence)
                                             │
                                             ▼
                                  Kafka topic: location-enriched
                                             │
                                             ▼
                                  Node Socket.IO Gateway ──► React Dashboard
```

## Topics

| Topic | Partitions | Producer | Consumer |
|-------|------------|----------|----------|
| `location-events` | 12 | Backend API (`/location/update`) | Flink job |
| `location-enriched` | 12 | Flink job | Backend gateway → Socket.IO |
| `alerts` | 3 | Flink job | Notification service |

## Local run

```bash
docker compose -f ../infrastructure/docker/docker-compose.yml up -d kafka zookeeper
# inside backend: KAFKA_BROKERS=localhost:9092 is set in .env
```

## Flink job

See `flink-jobs/` — a Java/Maven project that defines a `KeyedStream<userId>` pipeline doing:

1. Deduplication by `userId + recordedAt`
2. Speed/idle classification
3. Geofence entry/exit detection against company fences (lookup via JDBC sink)
4. Emit enriched event to `location-enriched`
5. Emit `alert` events on geofence breach or excessive idle time
