# Use Python 3.12 slim as base (since 3.13 gave us trouble)
FROM python:3.12-slim

# Install gcc and Python development headers (required to compile asyncpg)
RUN apt-get update && apt-get install -y \
    gcc \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements first (to leverage Docker caching)
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY app/ ./app/

# Expose port (Admin runs on 8002)
EXPOSE 8002

# Start the server (note the port is 8002)
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8001}"]