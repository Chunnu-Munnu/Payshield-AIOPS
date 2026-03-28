// FILE: kafkaProducer.js
// ROLE: Simulated event-stream producer for fraud pipeline events
// INSPIRED BY: Kafka-backed payment event buses
// PERFORMANCE TARGET: Non-blocking publish under 1ms
module.exports = {
  async publish(topic, payload) {
    return {
      topic,
      publishedAt: new Date().toISOString(),
      payload,
    };
  },
};
