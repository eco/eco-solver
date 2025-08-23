#!/bin/bash

# Fix @eco-solver/* imports to relative paths
# This script processes TypeScript files and converts imports

# Function to calculate relative path
get_relative_path() {
    local from_dir="$1"
    local to_path="$2"
    local src_base="/Users/stoyan/git/mono-solver/apps/eco-solver/src"
    
    # Remove the src base from both paths to get relative positions
    local from_rel="${from_dir#$src_base/}"
    local to_rel="${to_path#$src_base/}"
    
    # If from_rel is empty, we're in src root
    if [ -z "$from_rel" ]; then
        echo "./$to_rel"
        return
    fi
    
    # Count directory levels in from path
    local levels=$(echo "$from_rel" | tr '/' '\n' | wc -l)
    
    # Build relative path with appropriate number of ../
    local result=""
    for ((i=0; i<levels; i++)); do
        result="../$result"
    done
    
    echo "$result$to_rel"
}

# Function to fix imports in a file
fix_file_imports() {
    local file="$1"
    local file_dir=$(dirname "$file")
    
    echo "Processing: $file"
    
    # Create a temporary file for sed operations
    local temp_file="${file}.tmp"
    cp "$file" "$temp_file"
    
    # Fix each @eco-solver/* pattern
    while IFS= read -r line; do
        if [[ $line =~ @eco-solver/([^\'\"]*) ]]; then
            local import_path="${BASH_REMATCH[1]}"
            local target_path="/Users/stoyan/git/mono-solver/apps/eco-solver/src/$import_path"
            local relative_path=$(get_relative_path "$file_dir" "$target_path")
            
            # Use sed to replace the import
            sed -i "s|@eco-solver/$import_path|$relative_path|g" "$temp_file"
        fi
    done <<< "$(grep '@eco-solver/' "$file")"
    
    # Replace original file with fixed version
    mv "$temp_file" "$file"
}

# Get all TypeScript files with @eco-solver imports (excluding .d.ts and .spec.ts)
files=$(find /Users/stoyan/git/mono-solver/apps/eco-solver/src -name "*.ts" -not -name "*.d.ts" -not -name "*.spec.ts" -exec grep -l "@eco-solver/" {} \;)

# Process each file
echo "Found files to process:"
echo "$files"
echo ""

# Process files in batches to avoid overwhelming the system
echo "$files" | while read -r file; do
    if [ -n "$file" ]; then
        fix_file_imports "$file"
    fi
done

echo "Import fixing complete!"