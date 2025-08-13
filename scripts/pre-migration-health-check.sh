#!/bin/bash
# pre-migration-health-check.sh - Must pass before starting migration

echo "🏥 Pre-Migration Health Check..."

# 1. CRITICAL: Zero circular dependencies required
echo "🔄 Checking for circular dependencies (MUST BE ZERO)..."
if ! npx madge --circular --extensions ts src/ > /tmp/madge_output.txt 2>&1; then
    echo "🚫 BLOCKER: Circular dependencies found"
    cat /tmp/madge_output.txt
    echo ""
    echo "Migration CANNOT proceed until ALL circular dependencies are resolved"
    exit 1
fi

# Check if the output contains "Found X circular dependencies"
if grep -q "Found.*circular" /tmp/madge_output.txt; then
    echo "🚫 BLOCKER: Circular dependencies found"
    cat /tmp/madge_output.txt
    echo ""
    echo "Migration CANNOT proceed until ALL circular dependencies are resolved"
    exit 1
fi

# 2. TypeScript health
echo "📝 TypeScript compilation check..."
npx tsc --noEmit --skipLibCheck || {
    echo "❌ TypeScript compilation failed"
    exit 1
}

# 3. Test suite health
echo "🧪 Test suite health check..."
npm test -- --passWithNoTests || {
    echo "❌ Test suite failed"
    exit 1
}

# 4. Build health
echo "📦 Build health check..."
npm run build || {
    echo "❌ Build failed"
    exit 1
}

echo "✅ Pre-migration health check PASSED - Safe to proceed with migration"