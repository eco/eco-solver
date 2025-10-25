#!/bin/bash

# E2E Test Cleanup Script
# This script forcefully cleans up all E2E test resources

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${YELLOW}║          E2E Test Cleanup                                 ║${NC}"
echo -e "${YELLOW}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""

# Kill all Anvil processes
echo "🔨 Killing Anvil processes..."
if pkill -9 anvil 2>/dev/null; then
    echo -e "${GREEN}  ✓ Killed Anvil processes${NC}"
else
    echo "  ℹ No Anvil processes found"
fi

# Kill processes on specific ports
echo ""
echo "🔌 Cleaning up ports 8545 and 9545..."
for port in 8545 9545; do
    if lsof -ti:$port >/dev/null 2>&1; then
        lsof -ti:$port | xargs kill -9 2>/dev/null || true
        echo -e "${GREEN}  ✓ Cleaned up port $port${NC}"
    else
        echo "  ℹ Port $port is already free"
    fi
done

# Stop and remove Docker containers
echo ""
echo "🐳 Cleaning up Docker containers..."
if command -v docker-compose &> /dev/null; then
    if docker-compose -f docker-compose.e2e.yml ps -q 2>/dev/null | grep -q .; then
        docker-compose -f docker-compose.e2e.yml down 2>/dev/null || true
        echo -e "${GREEN}  ✓ Stopped Docker Compose services${NC}"
    else
        echo "  ℹ No Docker Compose services running"
    fi
fi

# Remove E2E containers by name
#for container in solver-e2e-mongo solver-e2e-redis solver-e2e-anvil-base solver-e2e-anvil-op; do
#    if docker ps -a --format '{{.Names}}' | grep -q "^${container}$"; then
#        docker rm -f $container 2>/dev/null || true
#        echo -e "${GREEN}  ✓ Removed container: $container${NC}"
#    fi
#done

# Clean up temporary test files
echo ""
echo "🗑️  Cleaning up temporary files..."
if [ -f "test/.e2e-setup-state.json" ]; then
    rm test/.e2e-setup-state.json
    echo -e "${GREEN}  ✓ Removed .e2e-setup-state.json${NC}"
fi

if [ -f "anvil-base.log" ]; then
    rm anvil-base.log
    echo -e "${GREEN}  ✓ Removed anvil-base.log${NC}"
fi

if [ -f "anvil-op.log" ]; then
    rm anvil-op.log
    echo -e "${GREEN}  ✓ Removed anvil-op.log${NC}"
fi

if [ -f "anvil-base.pid" ]; then
    rm anvil-base.pid
    echo -e "${GREEN}  ✓ Removed anvil-base.pid${NC}"
fi

if [ -f "anvil-op.pid" ]; then
    rm anvil-op.pid
    echo -e "${GREEN}  ✓ Removed anvil-op.pid${NC}"
fi

echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║          Cleanup Complete                                 ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "You can now run E2E tests with: pnpm test:e2e"
