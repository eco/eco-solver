#!/bin/bash
# validation-after-phase.sh - Run after each migration phase

echo "🔍 Phase Validation Starting..."

# 1. Critical: Check for circular dependencies (MUST BE ZERO)
echo "🔄 Checking for circular dependencies..."
if ! npx madge --circular --extensions ts src/ libs/ > /tmp/madge_output.txt 2>&1; then
    echo "❌ CRITICAL: Circular dependencies detected!"
    cat /tmp/madge_output.txt
    exit 1
fi

# Check if the output contains "Found X circular dependencies"
if grep -q "Found.*circular" /tmp/madge_output.txt; then
    echo "❌ CRITICAL: Circular dependencies found!"
    cat /tmp/madge_output.txt
    exit 1
fi

echo "✅ No circular dependencies found"

# 2. TypeScript compilation
echo "📝 Validating TypeScript compilation..."
npx tsc --noEmit --skipLibCheck || {
    echo "❌ TypeScript compilation failed"
    exit 1
}
echo "✅ TypeScript compilation successful"

# 3. Build all projects
echo "📦 Building all projects..."
if command -v nx > /dev/null && [ -d "libs" ] && [ "$(ls -A libs)" ]; then
    nx build --all --skip-nx-cache || {
        echo "❌ Build failed"
        exit 1
    }
else
    npm run build || {
        echo "❌ Build failed"
        exit 1
    }
fi
echo "✅ Build successful"

# 4. Lint check
echo "🔍 Running linter..."
if command -v nx > /dev/null && [ -d "libs" ]; then
    nx lint --all --skip-nx-cache || {
        echo "⚠️  Linter found issues"
        # Don't fail on lint issues during migration, just warn
    }
else
    echo "ℹ️  Skipping lint check (no libs directory or nx command found)"
fi

# 5. Generate dependency graph for monitoring
echo "🔗 Generating dependency graph..."
if command -v nx > /dev/null && [ -d "libs" ]; then
    nx graph --file=temp-graph.json --skip-nx-cache
    echo "📊 Dependency graph generated at temp-graph.json"
    rm -f temp-graph.json
else
    echo "ℹ️  Skipping dependency graph (no libs directory found)"
fi

echo "✅ Phase validation completed successfully!"