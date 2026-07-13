# Use Python 3.13 slim as base
FROM python:3.12-slim

# Install gcc and Python development headers (required to compile asyncpg and pydantic-core)
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

# Expose port
EXPOSE 8001

# Start the server
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]

