# FILE: Dockerfile
# ROLE: Build the FastAPI ML engine container
# INSPIRED BY: JP Morgan Project AIKYA deployment topology
# PERFORMANCE TARGET: Cold start under 30s with persisted model reuse
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
