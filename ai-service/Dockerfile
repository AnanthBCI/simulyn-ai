FROM python:3.12-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Build-time proxy plumbing. When the corporate network is in front of pypi
# we need the build container to route HTTP through host.docker.internal:3128
# (or whatever the user passes in via docker-compose build args). At runtime
# these are unset because the container only talks to other compose services.
ARG HTTP_PROXY=
ARG HTTPS_PROXY=
ARG NO_PROXY=
ENV HTTP_PROXY=$HTTP_PROXY \
    HTTPS_PROXY=$HTTPS_PROXY \
    NO_PROXY=$NO_PROXY \
    http_proxy=$HTTP_PROXY \
    https_proxy=$HTTPS_PROXY \
    no_proxy=$NO_PROXY

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Drop the proxy from the runtime environment — Ollama and the .NET API
# are reached over the docker network / host-gateway and must NOT proxy.
ENV HTTP_PROXY="" HTTPS_PROXY="" http_proxy="" https_proxy=""

COPY main.py .
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
