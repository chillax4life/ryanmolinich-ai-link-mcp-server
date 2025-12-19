#!/bin/bash
# start_manifest_validator.sh
# Starts the Manifest "Lightweight Validator" for Strategy Testing

echo "Initializing Manifest Validator Environment..."

# Path to Manifest Project (based on user info)
MANIFEST_DIR="/Users/ryanmolinich/manifest"

# Ensure binaries exist
if [ ! -f "$MANIFEST_DIR/target/deploy/manifest.so" ]; then
    echo "Error: manifest.so not found. Cannot start validator."
    exit 1
fi

echo "Starting solana-test-validator with Manifest Programs pre-loaded..."
echo "Simulating 'Real World' High Performance Environment..."

# Run Validator with Mainnet Mirroring (Account Cloning)
# Clones Kamino Scope Oracle so we have REAL prices locally.
# Url: 127.0.0.1:8899

cd $MANIFEST_DIR

solana-test-validator \
    --url https://api.mainnet-beta.solana.com \
    --clone 3NJYftD5sjVfxSnUdZ1wVML8f3aC6mp1CXCL6L7TnU8C \
    --bpf-program MNFSTqtC93rEfYHB6hF82sKdZpUDFWkViLByLd1k1Ms target/deploy/manifest.so \
    --bpf-program UMnFStVeG1ecZFc2gc5K3vFy3sMpotq8C91mXBQDGwh target/deploy/ui_wrapper.so \
    --bpf-program wMNFSTkir3HgyZTsB7uqu3i7FA73grFCptPXgrZjksL target/deploy/wrapper.so \
    --reset --quiet &

VALIDATOR_PID=$!
echo "Validator Process ID: $VALIDATOR_PID"
echo "Waiting 10s for boot..."
sleep 10

echo "Validator is UP! (http://127.0.0.1:8899)"
echo "Use 'pkill solana-test-v' to stop."
