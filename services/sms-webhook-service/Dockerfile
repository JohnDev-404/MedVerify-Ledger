# 1. Use Python 3.13 (stable and fully supported)
FROM python:3.12-slim

# 2. Set the working directory inside the container
WORKDIR /app

# 3. Copy the requirements file first (to leverage Docker caching)
COPY requirements.txt .

# 4. Install dependencies (will use pre-built wheels for pydantic-core)
RUN pip install --no-cache-dir -r requirements.txt

# 5. Copy the rest of the application code
COPY app/ ./app/

# 6. Tell Docker which port the app listens on
EXPOSE 8001

# 7. Command to run the application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]