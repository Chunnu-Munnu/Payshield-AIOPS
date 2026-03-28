# FILE: Dockerfile
# ROLE: Build the Observability Brain service container
# INSPIRED BY: Production AIOps control-plane deployments
# PERFORMANCE TARGET: Boot healthy in under 30s with model artifacts persisted
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 9000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "9000"]
