package com.fieldforce;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.apache.flink.api.common.eventtime.WatermarkStrategy;
import org.apache.flink.api.common.serialization.SimpleStringSchema;
import org.apache.flink.connector.kafka.sink.KafkaRecordSerializationSchema;
import org.apache.flink.connector.kafka.sink.KafkaSink;
import org.apache.flink.connector.kafka.source.KafkaSource;
import org.apache.flink.connector.kafka.source.enumerator.initializer.OffsetsInitializer;
import org.apache.flink.streaming.api.datastream.DataStream;
import org.apache.flink.streaming.api.environment.StreamExecutionEnvironment;
import org.apache.flink.streaming.api.functions.KeyedProcessFunction;
import org.apache.flink.util.Collector;
import org.apache.flink.api.common.state.ValueState;
import org.apache.flink.api.common.state.ValueStateDescriptor;
import org.apache.flink.configuration.Configuration;

public class LocationPipelineJob {

    public static void main(String[] args) throws Exception {
        String brokers = System.getenv().getOrDefault("KAFKA_BROKERS", "localhost:9092");

        StreamExecutionEnvironment env = StreamExecutionEnvironment.getExecutionEnvironment();
        env.enableCheckpointing(60_000);

        KafkaSource<String> source = KafkaSource.<String>builder()
                .setBootstrapServers(brokers)
                .setTopics("location-events")
                .setGroupId("flink-location-pipeline")
                .setStartingOffsets(OffsetsInitializer.latest())
                .setValueOnlyDeserializer(new SimpleStringSchema())
                .build();

        KafkaSink<String> enrichedSink = KafkaSink.<String>builder()
                .setBootstrapServers(brokers)
                .setRecordSerializer(KafkaRecordSerializationSchema.builder()
                        .setTopic("location-enriched")
                        .setValueSerializationSchema(new SimpleStringSchema())
                        .build())
                .build();

        DataStream<String> raw = env.fromSource(source, WatermarkStrategy.noWatermarks(), "kafka-source");

        DataStream<String> enriched = raw
                .keyBy(LocationPipelineJob::extractUserId)
                .process(new EnrichmentFn());

        enriched.sinkTo(enrichedSink);

        env.execute("location-pipeline");
    }

    private static String extractUserId(String json) {
        try {
            return new ObjectMapper().readTree(json).path("userId").asText("unknown");
        } catch (Exception e) {
            return "unknown";
        }
    }

    public static class EnrichmentFn extends KeyedProcessFunction<String, String, String> {
        private transient ValueState<Long> lastTimestamp;
        private transient ValueState<Double> lastLat;
        private transient ValueState<Double> lastLng;
        private static final ObjectMapper M = new ObjectMapper();

        @Override
        public void open(Configuration cfg) {
            lastTimestamp = getRuntimeContext().getState(new ValueStateDescriptor<>("ts", Long.class));
            lastLat = getRuntimeContext().getState(new ValueStateDescriptor<>("lat", Double.class));
            lastLng = getRuntimeContext().getState(new ValueStateDescriptor<>("lng", Double.class));
        }

        @Override
        public void processElement(String value, Context ctx, Collector<String> out) throws Exception {
            JsonNode n = M.readTree(value);
            double lat = n.path("lat").asDouble();
            double lng = n.path("lng").asDouble();
            long now = System.currentTimeMillis();

            double distM = 0;
            long dtMs = 0;
            if (lastLat.value() != null) {
                distM = haversine(lastLat.value(), lastLng.value(), lat, lng);
                dtMs = now - lastTimestamp.value();
            }

            ObjectNode enriched = M.createObjectNode();
            enriched.setAll((ObjectNode) n);
            enriched.put("deltaMeters", distM);
            enriched.put("deltaMs", dtMs);
            boolean idle = distM < 10 && dtMs > 5 * 60_000;
            enriched.put("idle", idle);
            enriched.put("processedAt", now);

            lastLat.update(lat);
            lastLng.update(lng);
            lastTimestamp.update(now);

            out.collect(M.writeValueAsString(enriched));
        }

        private static double haversine(double lat1, double lng1, double lat2, double lng2) {
            double R = 6371000;
            double dLat = Math.toRadians(lat2 - lat1);
            double dLng = Math.toRadians(lng2 - lng1);
            double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                    + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                    * Math.sin(dLng / 2) * Math.sin(dLng / 2);
            return 2 * R * Math.asin(Math.sqrt(a));
        }
    }
}
