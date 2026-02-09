FROM ubuntu:22.04

LABEL maintainer="Fixurelabs"
LABEL description="LAS/LAZ to Potree + 3D Tiles converter"

# Set non-interactive mode for apt
ENV DEBIAN_FRONTEND=noninteractive

# System dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    wget \
    curl \
    unzip \
    pdal \
    liblaszip-dev \
    && rm -rf /var/lib/apt/lists/*

# PotreeConverter 2.1.1
RUN wget -q https://github.com/potree/PotreeConverter/releases/download/2.1.1/PotreeConverter_2.1.1_x64_linux.zip \
    && unzip -q PotreeConverter_2.1.1_x64_linux.zip -d /opt/potree_temp \
    && mkdir -p /opt/potree \
    && find /opt/potree_temp -name PotreeConverter -type f -exec cp {} /opt/potree/ \; \
    && find /opt/potree_temp -name "*.so*" -type f -exec cp {} /opt/potree/ \; \
    && chmod +x /opt/potree/PotreeConverter \
    && rm -rf /opt/potree_temp PotreeConverter_2.1.1_x64_linux.zip

# Add PotreeConverter to PATH and LD_LIBRARY_PATH
ENV PATH="/opt/potree:${PATH}"
ENV LD_LIBRARY_PATH="/opt/potree:${LD_LIBRARY_PATH}"

# Python dependencies
RUN pip3 install --no-cache-dir \
    py3dtiles[las] \
    boto3 \
    supabase \
    requests

# Create app directory
WORKDIR /app

# Copy converter script
COPY converter.py /app/converter.py

# Make script executable
RUN chmod +x /app/converter.py

ENTRYPOINT ["python3", "/app/converter.py"]
