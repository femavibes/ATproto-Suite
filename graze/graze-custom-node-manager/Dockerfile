FROM python:3.11-slim

WORKDIR /app

# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application files
COPY . .

# Create data directory
RUN mkdir -p /app/data

# Set environment variables
ENV FLASK_APP=web/app.py
ENV PORT=5000

# Expose port
EXPOSE 5000

# Run the application
CMD ["python", "web/app.py"]
