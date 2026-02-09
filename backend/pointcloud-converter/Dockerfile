FROM ubuntu:22.04

LABEL maintainer="Fixurelabs"
LABEL description="LAS/LAZ to Potree octree converter"

ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1

# System dependencies (keep minimal)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    wget \
    curl \
    unzip \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# PotreeConverter 2.1.1
RUN wget -q https://github.com/potree/PotreeConverter/releases/download/2.1.1/PotreeConverter_2.1.1_x64_linux.zip \
    && unzip -q PotreeConverter_2.1.1_x64_linux.zip -d /opt/potree_temp \
    && mkdir -p /opt/potree \
    && BIN_PATH="$(find /opt/potree_temp -type f -name PotreeConverter | head -n 1)" \
    && test -n "$BIN_PATH" \
    && cp -r "$(dirname "$BIN_PATH")"/* /opt/potree/ \
    && chmod +x /opt/potree/PotreeConverter \
    && rm -rf /opt/potree_temp PotreeConverter_2.1.1_x64_linux.zip \
    && test -x /opt/potree/PotreeConverter

ENV PATH="/opt/potree:${PATH}"
ENV LD_LIBRARY_PATH="/opt/potree:${LD_LIBRARY_PATH}"

# Python dependencies (no 3D Tiles)
RUN pip3 install --no-cache-dir \
    boto3 \
    supabase

WORKDIR /app

COPY converter.py /app/converter.py
RUN chmod +x /app/converter.py

ENTRYPOINT ["python3", "/app/converter.py"]
