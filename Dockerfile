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

# GitHub Token für den Zugriff auf GitHub Packages (@16janis12)
ARG GH_TOKEN

# T3 Code CLI aus GitHub Packages (@16janis12/t3) global installieren
RUN if [ -z "${GH_TOKEN}" ]; then \
      echo "ERROR: GH_TOKEN build argument is required to install @16janis12/t3 from GitHub Packages." >&2; \
      exit 1; \
    fi && \
    npm config set @16janis12:registry https://npm.pkg.github.com && \
    npm config set //npm.pkg.github.com/:_authToken "${GH_TOKEN}" && \
    npm install -g @16janis12/t3 && \
    npm config delete //npm.pkg.github.com/:_authToken && \
    rm -rf /root/.npm

# Entrypoint-Skript für automatische Updates und Prozessüberwachung installieren
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh && \
    ln -s /usr/local/bin/entrypoint.sh /usr/local/bin/t3-update

# Arbeitsverzeichnis auf das gemountete Workspaces-Volume legen
WORKDIR /workspaces

# T3 Code Standard-Port
EXPOSE 3773

# Entrypoint für Auto-Update und saubere Signalweiterleitung
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]

# Server auf 0.0.0.0 starten, damit Anfragen über Tailscale akzeptiert werden
CMD ["t3", "serve", "--host", "0.0.0.0"]
