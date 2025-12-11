#!/bin/bash
set -e

# setup_antigravity.sh - The one-click launch button

echo "🪐 Initializing Antigravity Command Center..."

# 1. Build and tag the Docker image based on the Nix config
echo "📦 Building Docker image from Nix flake..."
# This builds the 'antigravity-docker-image' output from our flake.nix
# result symlink will point to the tarball
nix build .#antigravity-docker-image

# 2. Load the image into Docker
echo "🚚 Loading image into Docker..."
docker load < result

# 3. Launch the container
echo "🚀 Launching Antigravity Session..."
# We bind-mount the current directory to /app
# We use --net=host to allow agents to easily talk to local services if needed, 
# or standard bridge. Let's start with standard.
docker run -it \
    --rm \
    --name antigravity-session \
    -v "$(pwd):/app" \
    antigravity-hub-image:latest \
    /bin/bash -c "echo 'You are now inside the Antigravity Hub Container.'; echo 'Type \"ts-node agent_hub.ts\" to start the router.'; cd /app && exec /bin/bash"
