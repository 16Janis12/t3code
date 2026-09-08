FROM node:22-slim

# Notwendige Build-Tools für native Node-Module (z.B. node-pty) und essentielle Utilities installieren
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    git \
    gh \
    curl \
    ca-certificates \
    procps \
    && rm -rf /var/lib/apt/lists/*

# 1. Git mit gh als Credential-Helper verbinden (nutzt automatisch GH_TOKEN)
# 2. Dubious-Ownership-Warnungen in gemounteten Volumes verhindern
# 3. SSH-URLs (git@github.com:...) automatisch auf HTTPS umleiten
RUN git config --global credential.https://github.com.helper "" && \
    git config --global --add credential.https://github.com.helper '!gh auth git-credential' && \
    git config --global credential.https://gist.github.com.helper "" && \
    git config --global --add credential.https://gist.github.com.helper '!gh auth git-credential' && \
    git config --global --add safe.directory "*" && \
    git config --global url."https://github.com/".insteadOf "git@github.com:"

# Optional: pnpm via Corepack aktivieren (falls Workspaces pnpm nutzen)
RUN corepack enable

# T3 Code CLI global installieren
RUN npm install -g t3

# Arbeitsverzeichnis auf das gemountete Workspaces-Volume legen
WORKDIR /workspaces

# T3 Code Standard-Port
EXPOSE 3773

# Server auf 0.0.0.0 starten, damit Anfragen über Tailscale akzeptiert werden
CMD ["t3", "serve", "--host", "0.0.0.0"]
