# Circular Dependency Detection Guide

## Overview

This project has been configured with comprehensive circular dependency detection using [madge](https://github.com/pahen/madge) to maintain code quality and prevent circular imports that can cause runtime errors and build issues.

**Current Status**: ⚠️ **73 circular dependencies detected** in the apps directory (as of last scan)

## Quick Start

```bash
# Basic circular dependency check
npm run circular:check

# Check only applications
npm run circular:check:apps

# Check only libraries (currently clean!)
npm run circular:check:libs

# CI-friendly check (won't fail the build)
npm run circular:check:ci
```

## Available Scripts

| Script | Purpose | Usage |
|--------|---------|-------|
| `circular:check` | Main check for all circular dependencies | Development & CI |
| `circular:check:ci` | CI-friendly check (won't fail build) | CI/CD pipelines |
| `circular:check:strict` | Strict check with detailed output | Development |
| `circular:check:apps` | Check only apps directory | Focused analysis |
| `circular:check:libs` | Check only libs directory | Focused analysis |
| `circular:check:json` | Generate JSON report | Analysis & tooling |
| `circular:check:with-graph` | Generate visual graph (SVG) | Documentation |
| `circular:check:detailed` | Detailed output with warnings | Development |
| `circular:analyze` | Generate DOT graph file | Architecture review |
| `circular:orphans` | Find orphaned modules | Cleanup |
| `circular:leaves` | Find leaf modules | Architecture analysis |
| `circular:summary` | Show dependency summary stats | Overview |

## Integration with CI/CD

### Recommended CI Integration

Add to your CI pipeline to track but not fail builds:

```yaml
# Example GitHub Actions
- name: Check Circular Dependencies
  run: npm run circular:check:ci
  continue-on-error: true

# Or fail the build on new circular deps
- name: Strict Circular Dependency Check
  run: npm run circular:check:strict
```

### For Build Systems

```bash
# Generate reports for analysis
npm run circular:check:json
npm run circular:summary > dependency-report.txt
```

## Understanding the Output

### Circular Dependency Example
```
apps/eco-solver/common/errors/eco-error.ts > 
apps/eco-solver/contracts/index.ts > 
apps/eco-solver/contracts/ERC20.contract.ts
```

This shows a circular dependency where:
1. `eco-error.ts` imports from `contracts/index.ts`
2. `contracts/index.ts` imports from `ERC20.contract.ts`
3. `ERC20.contract.ts` eventually imports back to `eco-error.ts`

### Current Problem Areas

1. **Error Handling**: Core error classes creating cycles with contract utilities
2. **Job Processors**: Queue jobs and processors importing each other
3. **Service Dependencies**: Services with bi-directional dependencies
4. **Type Definitions**: Shared types creating import cycles

## Resolving Circular Dependencies

### Common Patterns & Solutions

#### 1. Extract Shared Interfaces/Types
```typescript
// ❌ Bad: Circular dependency
// serviceA.ts
import { ServiceB } from './serviceB';

// serviceB.ts  
import { ServiceA } from './serviceA';

// ✅ Good: Shared interface
// interfaces/services.ts
export interface IServiceA { /* ... */ }
export interface IServiceB { /* ... */ }

// serviceA.ts
import { IServiceB } from './interfaces/services';

// serviceB.ts
import { IServiceA } from './interfaces/services';
```

#### 2. Use Dependency Injection
```typescript
// ❌ Bad: Direct circular import
import { OtherService } from './other.service';

// ✅ Good: Dependency injection
constructor(
  @Inject('OTHER_SERVICE') private otherService: IOtherService
) {}
```

#### 3. Event-Driven Architecture
```typescript
// ❌ Bad: Direct service calls creating cycles
serviceA.callServiceB();
serviceB.callServiceA();

// ✅ Good: Event-driven communication  
eventEmitter.emit('serviceAEvent', data);
eventEmitter.on('serviceBEvent', handler);
```

#### 4. Create Facade Services
```typescript
// ❌ Bad: Multiple services importing each other
// ✅ Good: Single facade coordinating multiple services
export class CoordinatorService {
  constructor(
    private serviceA: ServiceA,
    private serviceB: ServiceB
  ) {}
  
  orchestrate() {
    // Coordinate without circular deps
  }
}
```

## Project-Specific Recommendations

### High Priority Fixes

1. **Error Handling Refactor**
   - Extract error interfaces to `@shared/types`
   - Create error factory pattern
   - Remove direct imports from core contracts

2. **Job Queue Decoupling** 
   - Separate job definitions from processors
   - Use event-driven job coordination
   - Extract shared job interfaces

3. **Service Architecture**
   - Implement proper dependency injection
   - Use interfaces for service contracts
   - Consider service orchestration pattern

### Library Architecture (Keep Clean!)

The `libs/` directory is currently **circular dependency free** - maintain this by:

- Always define interfaces before implementations
- Keep libraries focused on single responsibilities  
- Use dependency injection for cross-library communication
- Regular monitoring with `npm run circular:check:libs`

## Monitoring & Maintenance

### Regular Checks
```bash
# Daily check during development
npm run circular:check:apps

# Weekly full analysis
npm run circular:summary > weekly-deps-$(date +%Y%m%d).txt

# Before releases
npm run circular:check:strict
```

### Tracking Progress
1. Run `npm run circular:check:json` to generate baseline
2. Track reduction in circular dependency count over time
3. Set up alerts if new circular dependencies are introduced

### IDE Integration

For VSCode, consider installing:
- **Circular Dependency Detector** extension
- **TypeScript Importer** for better import management
- **Auto Import - ES6, TS, JSX, TSX** for consistent imports

## Best Practices

### Prevention
- **Code Review**: Check imports in every PR
- **Architecture Review**: Regular architecture sessions
- **Linting Rules**: Consider eslint rules for import patterns
- **Training**: Team education on circular dependency patterns

### Development Workflow
1. Before starting new features: `npm run circular:check:libs`
2. During development: Check specific modules for cycles
3. Before commits: Run relevant circular dependency checks
4. Pre-deployment: Full circular dependency audit

## Tooling Configuration

### Madge Configuration
The detection is configured to:
- Check TypeScript and JavaScript files
- Exclude build artifacts and dependencies
- Support both CLI and programmatic usage
- Generate multiple output formats

### Exclusions
Currently excluding:
- `node_modules/` - External dependencies
- `dist/` - Build output
- `coverage/` - Test coverage files  
- `tmp/` - Temporary files
- `.nx/` - NX cache

## Future Improvements

1. **Automated Detection**: Pre-commit hooks for new circular deps
2. **Visualization**: Regular dependency graphs for architecture review
3. **Metrics**: Track circular dependency trends over time
4. **Integration**: Connect with NX dependency graph features
5. **Documentation**: Auto-generate architecture documentation from dependencies

## Resources

- [Madge Documentation](https://github.com/pahen/madge)
- [Circular Dependency Patterns](https://en.wikipedia.org/wiki/Circular_dependency)
- [TypeScript Module Resolution](https://www.typescriptlang.org/docs/handbook/module-resolution.html)
- [NX Dependency Graph](https://nx.dev/features/explore-graph)

## Support

For questions about circular dependency detection:
1. Check this guide first
2. Run diagnostic commands: `npm run circular:summary`
3. Generate detailed report: `npm run circular:check:detailed`
4. Review project architecture with team