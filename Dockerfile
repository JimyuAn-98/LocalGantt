FROM python:3.11-slim

WORKDIR /app

# Install curl for healthcheck
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Install dependencies (cached layer)
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy source
COPY . .

# VERSION file is copied from source (manual bump).
# If missing, fall back to git commit hash passed at build time.
ARG GIT_COMMIT=unknown
RUN test -f /app/VERSION || echo "${GIT_COMMIT}" > /app/VERSION

EXPOSE 1258

ENV FLASK_APP=app.py
ENV FLASK_RUN_HOST=0.0.0.0
ENV FLASK_RUN_PORT=1258

CMD ["python", "app.py"]
