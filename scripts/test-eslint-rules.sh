#!/bin/bash

# Test script to verify ESLint circular dependency rules are working
# This script tests specific files that are known to have circular dependencies

echo "🔍 Testing ESLint circular dependency detection..."
echo ""

# Test files with known circular dependencies
test_files=(
    "apps/eco-solver/common/errors/eco-error.ts"
    "apps/eco-solver/contracts/ERC20.contract.ts"
    "apps/eco-solver/intent/utils-intent.service.ts"
)

total_violations=0

for file in "${test_files[@]}"; do
    echo "Testing: $file"
    
    # Count circular dependency violations
    violations=$(npx eslint "$file" --no-ignore 2>&1 | grep -c "import/no-cycle" || echo "0")
    total_violations=$((total_violations + violations))
    
    if [ "$violations" -gt 0 ]; then
        echo "  ✅ Found $violations circular dependency violation(s)"
        # Show the actual violations
        npx eslint "$file" --no-ignore 2>&1 | grep "import/no-cycle" | head -3
    else
        echo "  ❌ No circular dependencies detected"
    fi
    echo ""
done

echo "📊 Summary: Found $total_violations total circular dependency violations"

if [ "$total_violations" -gt 0 ]; then
    echo "🎉 ESLint circular dependency rules are working correctly!"
    exit 0
else
    echo "⚠️  ESLint may not be detecting circular dependencies. Check configuration."
    exit 1
fi