# See here for image contents: https://hub.docker.com/r/microsoft/devcontainers-typescript-node

FROM mcr.microsoft.com/devcontainers/typescript-node:22-bookworm

# Install more global node packages
RUN su node -c "npm install --location=global node-red pnpm @changesets/cli"
