#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Function to calculate relative path between two files
function getRelativePath(fromFile, toPath) {
    const srcBase = '/Users/stoyan/git/mono-solver/apps/eco-solver/src';
    const fromDir = path.dirname(fromFile);
    
    // Remove src base from both paths
    const fromRel = path.relative(srcBase, fromDir);
    const toRel = path.relative(srcBase, path.join(srcBase, toPath));
    
    // If we're in the src root
    if (fromRel === '') {
        return './' + toRel;
    }
    
    // Calculate relative path
    const relativePath = path.relative(fromDir, path.join(srcBase, toPath));
    
    // Ensure it starts with ./ or ../
    if (!relativePath.startsWith('.')) {
        return './' + relativePath;
    }
    
    return relativePath;
}

// Function to fix imports in a file
function fixImportsInFile(filePath) {
    console.log(`Processing: ${filePath}`);
    
    const content = fs.readFileSync(filePath, 'utf8');
    let updatedContent = content;
    
    // Find all @eco-solver/* imports
    const importRegex = /from ['"]@eco-solver\/([^'"]*)['"]/g;
    const matches = [...content.matchAll(importRegex)];
    
    let hasChanges = false;
    
    for (const match of matches) {
        const fullMatch = match[0];
        const importPath = match[1];
        
        // Calculate the relative path
        const relativePath = getRelativePath(filePath, importPath);
        
        // Replace the import
        const newImport = `from '${relativePath}'`;
        updatedContent = updatedContent.replace(fullMatch, newImport);
        hasChanges = true;
        
        console.log(`  ${fullMatch} -> ${newImport}`);
    }
    
    if (hasChanges) {
        fs.writeFileSync(filePath, updatedContent);
        console.log(`  ✅ Updated ${matches.length} imports in ${path.basename(filePath)}`);
    } else {
        console.log(`  ⚪ No changes needed in ${path.basename(filePath)}`);
    }
}

// Get all TypeScript files with @eco-solver imports
function findFilesWithEcoSolverImports(dir) {
    const files = [];
    
    function scanDirectory(currentDir) {
        const entries = fs.readdirSync(currentDir, { withFileTypes: true });
        
        for (const entry of entries) {
            const fullPath = path.join(currentDir, entry.name);
            
            if (entry.isDirectory()) {
                scanDirectory(fullPath);
            } else if (entry.isFile() && 
                       entry.name.endsWith('.ts') && 
                       !entry.name.endsWith('.d.ts') && 
                       !entry.name.endsWith('.spec.ts')) {
                
                // Check if file contains @eco-solver imports
                const content = fs.readFileSync(fullPath, 'utf8');
                if (content.includes('@eco-solver/')) {
                    files.push(fullPath);
                }
            }
        }
    }
    
    scanDirectory(dir);
    return files;
}

// Main execution
function main() {
    const srcDir = '/Users/stoyan/git/mono-solver/apps/eco-solver/src';
    
    console.log('🔍 Finding TypeScript files with @eco-solver/* imports...');
    const files = findFilesWithEcoSolverImports(srcDir);
    
    console.log(`📝 Found ${files.length} files to process\n`);
    
    if (files.length === 0) {
        console.log('✅ No files need processing!');
        return;
    }
    
    // Process each file
    files.forEach(file => {
        try {
            fixImportsInFile(file);
        } catch (error) {
            console.error(`❌ Error processing ${file}:`, error.message);
        }
        console.log('');
    });
    
    console.log('🎉 Import fixing complete!');
    
    // Final verification
    const remainingFiles = findFilesWithEcoSolverImports(srcDir);
    if (remainingFiles.length === 0) {
        console.log('✅ All @eco-solver/* imports have been successfully converted!');
    } else {
        console.log(`⚠️  ${remainingFiles.length} files still have @eco-solver/* imports:`);
        remainingFiles.forEach(file => console.log(`   ${file}`));
    }
}

if (require.main === module) {
    main();
}