# FILE: Dockerfile
# ROLE: Build the k6 load generation container for PayShield
# INSPIRED BY: Distributed systems load simulation for observability testing
# PERFORMANCE TARGET: Stable synthetic traffic generation with predictable spikes
FROM grafana/k6:0.52.0

WORKDIR /scripts
COPY payshield_load.js /scripts/payshield_load.js

CMD ["run", "/scripts/payshield_load.js"]
