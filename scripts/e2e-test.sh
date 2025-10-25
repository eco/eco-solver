#!/bin/bash

# E2E Test Helper Script
# This script starts all required services and runs E2E tests

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║          E2E Test Runner                                  ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if Docker is running
if ! docker ps > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running${NC}"
    echo "Please start Docker Desktop and try again"
    exit 1
fi

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ docker-compose is not installed${NC}"
    echo "Please install docker-compose and try again"
    exit 1
fi

echo -e "${GREEN}✓${NC} Docker is running"
echo ""

# Parse command line arguments
COMMAND=${1:-test}  # Default to 'test' if no argument provided

case $COMMAND in
    start)
        echo "📦 Starting E2E services..."
        docker-compose -f docker-compose.e2e.yml up -d
        echo ""
        echo -e "${GREEN}✅ Services started${NC}"
        echo ""
        echo "Services running:"
        docker-compose -f docker-compose.e2e.yml ps
        echo ""
        echo "Run tests with: pnpm test:e2e"
        echo "Stop services with: ./scripts/e2e-test.sh stop"
        ;;

    stop)
        echo "🛑 Stopping E2E services..."
        docker-compose -f docker-compose.e2e.yml down
        echo -e "${GREEN}✅ Services stopped${NC}"
        ;;

    restart)
        echo "🔄 Restarting E2E services..."
        docker-compose -f docker-compose.e2e.yml down
        docker-compose -f docker-compose.e2e.yml up -d
        echo -e "${GREEN}✅ Services restarted${NC}"
        ;;

    test)
        echo "📦 Starting E2E services..."
        docker-compose -f docker-compose.e2e.yml up -d

        echo "⏳ Waiting for services to be ready..."
        sleep 5

        echo ""
        echo "🧪 Running E2E tests..."
        echo ""

        # Run tests
        pnpm test:e2e
        TEST_EXIT_CODE=$?

        echo ""
        if [ $TEST_EXIT_CODE -eq 0 ]; then
            echo -e "${GREEN}✅ Tests passed${NC}"
        else
            echo -e "${RED}❌ Tests failed${NC}"
        fi

        # Ask if user wants to stop services
        echo ""
        read -p "Stop services? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            echo "🛑 Stopping E2E services..."
            docker-compose -f docker-compose.e2e.yml down
            echo -e "${GREEN}✅ Services stopped${NC}"
        else
            echo "Services are still running. Stop them with: ./scripts/e2e-test.sh stop"
        fi

        exit $TEST_EXIT_CODE
        ;;

    status)
        echo "📊 E2E Services Status:"
        echo ""
        docker-compose -f docker-compose.e2e.yml ps
        ;;

    logs)
        SERVICE=${2:-}
        if [ -z "$SERVICE" ]; then
            docker-compose -f docker-compose.e2e.yml logs --tail=50 --follow
        else
            docker-compose -f docker-compose.e2e.yml logs --tail=50 --follow $SERVICE
        fi
        ;;

    help|*)
        echo "Usage: ./scripts/e2e-test.sh [command]"
        echo ""
        echo "Commands:"
        echo "  test     Start services and run tests (default)"
        echo "  start    Start services without running tests"
        echo "  stop     Stop all services"
        echo "  restart  Restart all services"
        echo "  status   Show service status"
        echo "  logs     Show logs from all services"
        echo "  help     Show this help message"
        echo ""
        echo "Examples:"
        echo "  ./scripts/e2e-test.sh           # Start services and run tests"
        echo "  ./scripts/e2e-test.sh start     # Just start services"
        echo "  ./scripts/e2e-test.sh status    # Check service status"
        echo "  ./scripts/e2e-test.sh logs      # View logs"
        echo "  ./scripts/e2e-test.sh stop      # Stop all services"
        ;;
esac
