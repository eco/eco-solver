# ANALYTICS TRACKING RULES

## Analytics Compliance Linter Rules

Use these rules to systematically audit and implement analytics tracking across the entire codebase:

### 🔍 **RULE 1: DEPENDENCY INJECTION CHECK**

**What to check:** Every `.service.ts`, `.controller.ts`, `.repository.ts`, and processor file
**Requirements:**

- [ ] Constructor has `private readonly ecoAnalytics: EcoAnalyticsService` injection
- [ ] Import statement: `import { EcoAnalyticsService } from '@/analytics'`
- [ ] Module provides EcoAnalyticsService in providers array

**Auto-fix pattern:**

```typescript
constructor(
  // other dependencies...
  private readonly ecoAnalytics: EcoAnalyticsService,
) {}
```

### 🔍 **RULE 2: OPERATION BOUNDARY TRACKING**

**What to check:** All public methods in services, controllers, repositories, processors
**Requirements:**

- [ ] Method start tracking (operation initiation)
- [ ] Method success tracking (successful completion)
- [ ] Method failure tracking (error/exception cases)
- [ ] Performance timing (processing duration)

**Auto-fix pattern:**

```typescript
async methodName(params: any) {
  const startTime = Date.now()

  // Track operation start
  this.ecoAnalytics.trackOperationStarted('methodName', params)

  try {
    const result = await // business logic

    // Track success
    this.ecoAnalytics.trackOperationSuccess('methodName', {
      params,
      result,
      processingTimeMs: Date.now() - startTime
    })

    return result
  } catch (error) {
    // Track failure
    this.ecoAnalytics.trackOperationError('methodName', error, {
      params,
      processingTimeMs: Date.now() - startTime
    })
    throw error
  }
}
```

### 🔍 **RULE 3: ERROR HANDLING INSTRUMENTATION**

**What to check:** All try/catch blocks and error handling
**Requirements:**

- [ ] Every catch block includes analytics tracking
- [ ] Complete error context captured (error object + operation context)
- [ ] Error type and message extraction handled by analytics service

**Auto-fix pattern:**

```typescript
try {
  // operation
} catch (error) {
  this.ecoAnalytics.trackError(ERROR_EVENTS.OPERATION_FAILED, error, {
    operationContext, // complete context objects
    additionalData,
  })
  // error handling logic
}
```

### 🔍 **RULE 4: OBJECT-BASED TRACKING COMPLIANCE**

**What to check:** All existing analytics calls for property extraction violations
**Requirements:**

- [ ] Pass complete objects instead of individual properties
- [ ] No nested property extraction (e.g., `object.nested.property`)
- [ ] No data extraction in business logic - move to analytics service
- [ ] No duplicate tracking (object + its properties in same call)
- [ ] Use event constants from `events.constants.ts`

**CRITICAL VIOLATIONS TO DETECT:**

- Property extraction patterns: `model.intent.hash`, `model.intent.route.source`, `model.status`
- Multiple individual properties instead of whole object
- Destructuring objects to extract properties for analytics

**Auto-fix pattern:**

```typescript
// ❌ INCORRECT - inline data extraction and nested property access
this.ecoAnalytics.track(EVENT_NAME, {
  intentHash: model.intent.hash,
  sourceChain: model.intent.route.source,
  destinationChain: model.intent.route.destination,
  status: model.status,
})

// ❌ INCORRECT - destructuring for analytics
const {
  intent: {
    hash,
    route: { source, destination },
  },
  status,
} = model
this.ecoAnalytics.track(EVENT_NAME, {
  intentHash: hash,
  sourceChain: source,
  destinationChain: destination,
  status,
})

// ✅ CORRECT - pass complete objects
this.ecoAnalytics.track(EVENT_NAME, {
  model, // complete model object
  solver, // complete solver object
  additionalContext,
})
```

**Detection commands:**

```bash
# Find property extraction in analytics calls
grep -r "ecoAnalytics\.track.*(" src/ --include="*.ts" -A 10 -B 2 | grep -E "(\.intent\.|\.route\.|\.reward\.|\.status|\.hash)"

# Find nested property access in analytics context objects
grep -r "ecoAnalytics\.track" src/ --include="*.ts" -A 15 | grep -E "[a-zA-Z]+\.[a-zA-Z]+\.[a-zA-Z]+"

# Find analytics calls with multiple individual properties instead of objects
grep -r "trackSuccess\|trackError" src/ --include="*.ts" -A 20 | grep -E "(Chain|Hash|Creator|Prover|Status):" | head -20
```

### 🔍 **RULE 5: CONTROLLER REQUEST/RESPONSE TRACKING**

**What to check:** All `@Controller` classes and their endpoints
**Requirements:**

- [ ] Track incoming requests with complete DTO/body
- [ ] Track response success with result data and processing time
- [ ] Track response errors with status codes and error details
- [ ] Track validation failures and malformed requests

**Auto-fix pattern:**

```typescript
@Post('/endpoint')
async handleRequest(@Body() dto: RequestDTO) {
  const startTime = Date.now()

  this.ecoAnalytics.trackRequestReceived('endpoint', dto)

  try {
    const result = await this.service.process(dto)

    this.ecoAnalytics.trackResponseSuccess('endpoint', {
      dto,
      result,
      processingTimeMs: Date.now() - startTime
    })

    return result
  } catch (error) {
    this.ecoAnalytics.trackResponseError('endpoint', error, {
      dto,
      processingTimeMs: Date.now() - startTime
    })
    throw error
  }
}
```

### 🔍 **RULE 6: REPOSITORY DATA ACCESS TRACKING**

**What to check:** All repository classes and database operations
**Requirements:**

- [ ] Track database queries with parameters and execution time
- [ ] Track connection issues and timeouts
- [ ] Track data access patterns and result sizes
- [ ] Track repository operation failures

**Auto-fix pattern:**

```typescript
async findEntity(criteria: any) {
  const startTime = Date.now()

  try {
    const result = await this.model.find(criteria)

    this.ecoAnalytics.trackDatabaseQuery('findEntity', {
      criteria,
      resultCount: result.length,
      queryTimeMs: Date.now() - startTime
    })

    return result
  } catch (error) {
    this.ecoAnalytics.trackDatabaseError('findEntity', error, {
      criteria,
      queryTimeMs: Date.now() - startTime
    })
    throw error
  }
}
```

### 🔍 **RULE 7: PROCESSOR/WORKER JOB TRACKING**

**What to check:** All job processors and worker classes
**Requirements:**

- [ ] Track job start with complete job data
- [ ] Track job completion with results and processing time
- [ ] Track job failures with retry information
- [ ] Track queue health and processing rates

**Auto-fix pattern:**

```typescript
@Process(JOB_NAME)
async processJob(job: Job<JobData>) {
  const startTime = Date.now()

  this.ecoAnalytics.trackJobStarted(JOB_NAME, {
    jobId: job.id,
    jobData: job.data,
    attemptNumber: job.attemptsMade
  })

  try {
    const result = await this.handleJob(job.data)

    this.ecoAnalytics.trackJobCompleted(JOB_NAME, {
      jobId: job.id,
      jobData: job.data,
      result,
      processingTimeMs: Date.now() - startTime
    })

    return result
  } catch (error) {
    this.ecoAnalytics.trackJobFailed(JOB_NAME, error, {
      jobId: job.id,
      jobData: job.data,
      attemptNumber: job.attemptsMade,
      processingTimeMs: Date.now() - startTime
    })
    throw error
  }
}
```

### 🔍 **RULE 8: ANALYTICS EVENT NAME CONSTANTS**

**What to check:** All analytics tracking calls and event name definitions
**Requirements:**

- [ ] All analytics event names MUST be defined as constants
- [ ] NO hardcoded strings in analytics tracking calls
- [ ] ALL event constants MUST be defined in `@/analytics/events.constants.ts`
- [ ] Use module-namespaced constants: `ANALYTICS_EVENTS.{MODULE}.{EVENT}`
- [ ] Constants MUST follow consistent naming conventions

**Auto-fix pattern:**

```typescript
// ❌ INCORRECT - hardcoded strings
this.ecoAnalytics.trackError('intent_creation_failed', error, context)
this.ecoAnalytics.trackError('watch_event_unsubscribe_error', error, context)

// ✅ CORRECT - using global constants from analytics directory
import { ANALYTICS_EVENTS } from '@/analytics/events.constants'

this.ecoAnalytics.trackError(ANALYTICS_EVENTS.INTENT.CREATION_FAILED, error, context)
this.ecoAnalytics.trackError(ANALYTICS_EVENTS.WATCH.UNSUBSCRIBE_ERROR, error, context)
this.ecoAnalytics.trackError(
  ANALYTICS_EVENTS.LIQUIDITY_MANAGER.STRATEGY_QUOTE_ERROR,
  error,
  context,
)
this.ecoAnalytics.trackError(ANALYTICS_EVENTS.HEALTH.CHECK_ERROR, error, context)
```

**Event constant management:**

1. **Only location**: All event constants are defined in `@/analytics/events.constants.ts`
2. **Module namespacing**: Events are organized by module under `ANALYTICS_EVENTS.{MODULE}`
3. **Adding new events**: Add new event constants to the appropriate module section in the global constants file
4. **New modules**: Create new module section in the global constants file and add to `ANALYTICS_EVENTS` export

**Constants naming conventions:**

- Global usage: `ANALYTICS_EVENTS.{MODULE}.{EVENT}` (e.g., `ANALYTICS_EVENTS.INTENT.CREATION_FAILED`)
- Event names: `SCREAMING_SNAKE_CASE` (e.g., `CREATION_FAILED`, `VALIDATION_STARTED`)
- Event values: `lowercase_snake_case` with module prefix (e.g., `'intent_creation_failed'`)
- Use `as const` for TypeScript type safety

### 🔍 **RULE 9: ANALYTICS DOCUMENTATION MAINTENANCE**

**What to maintain:** Analytics module README.md documentation
**Requirements:**

- [ ] README.md exists in `src/analytics/` directory
- [ ] Module-by-module analytics coverage is documented
- [ ] Event constants reference is up-to-date
- [ ] Implementation guidelines include current best practices
- [ ] Coverage statistics reflect actual codebase analytics usage
- [ ] Update README whenever new analytics tracking is added

**Documentation generation workflow:**

```bash
# 1. Analyze current analytics usage across all modules
grep -r "ecoAnalytics\." src/ --include="*.ts" | grep -v test | grep -v spec

# 2. Update module coverage sections in README
# - List all analytics methods being called per module
# - Document what operations/events are being tracked
# - Provide sample usage examples

# 3. Update event constants reference
# - Count events per category (INTENT_EVENTS, QUOTE_EVENTS, etc.)
# - Verify event constant usage examples
# - Update usage patterns with current imports

# 4. Update coverage statistics
# - Count total services instrumented
# - Count total analytics method calls
# - Update coverage assessment table

# 5. Verify maintenance section links to linter rules
```

**Auto-maintenance pattern:**

```typescript
// When adding new analytics tracking, update README.md sections:
// 1. Add service to appropriate module coverage table
// 2. Update event constants count if new events added
// 3. Update coverage statistics
// 4. Add sample usage if introducing new patterns
```

## 🚀 **IMPLEMENTATION WORKFLOW**

1. **AUDIT PHASE**: Run through each rule systematically across all files
2. **IDENTIFY GAPS**: Mark files/methods missing required analytics
3. **IMPLEMENT FIXES**: Apply auto-fix patterns for each violation
4. **VERIFY COVERAGE**: Ensure no component operates without analytics visibility
5. **TEST INTEGRATION**: Verify analytics calls don't break business logic
6. **UPDATE DOCUMENTATION**: Generate and update analytics module README.md

## 📊 **COMPLIANCE CHECKLIST**

- [ ] All services have EcoAnalyticsService injection
- [ ] All controllers track requests/responses
- [ ] All repositories track database operations
- [ ] All processors track job lifecycle
- [ ] All catch blocks include error tracking
- [ ] All analytics calls use object-based patterns
- [ ] No inline data extraction in business logic
- [ ] All tracking uses event constants (no hardcoded strings)
- [ ] Event constants centralized in `@/analytics/events.constants.ts`
- [ ] Consistent naming conventions for event constants
- [ ] Analytics module README.md is comprehensive and up-to-date

## 🔧 **LINTER AUTOMATION COMMANDS**

```bash
# Find files missing EcoAnalyticsService injection
grep -r "class.*Service\|class.*Controller\|class.*Repository" src/ --include="*.ts" | grep -v "ecoAnalytics"

# Find methods missing error tracking in catch blocks
grep -r "catch.*{" src/ --include="*.ts" -A 5 | grep -v "ecoAnalytics"

# Find analytics calls with inline data extraction (anti-pattern)
grep -r "trackEvent\|track.*(" src/ --include="*.ts" -A 10 | grep -E "(\.id|\.name|\.status)"

# Find controllers missing request/response tracking
grep -r "@Post\|@Get\|@Put\|@Delete" src/ --include="*.ts" -A 20 | grep -v "ecoAnalytics"

# Find hardcoded event name strings in analytics calls (Rule 8 violations)
grep -r "\.track.*(" src/ --include="*.ts" | grep -E "'[a-z_]+'" | grep -v "EVENTS\."

# Find missing module-specific event constants files
find src/ -type d -name "*" | while read dir; do
  if ls "$dir"/*.service.ts "$dir"/*.controller.ts "$dir"/*.repository.ts 2>/dev/null | grep -q "ecoAnalytics"; then
    if [ ! -f "$dir"/*.events.ts ]; then
      echo "Missing events constants file in: $dir"
    fi
  fi
done

# Validate event constant naming conventions
grep -r "export const.*EVENTS.*=" src/ --include="*.events.ts" | grep -v "SCREAMING_SNAKE_CASE"

# Find modules using global events when they should have module-specific events
grep -r "import.*ANALYTICS_EVENTS" src/ --include="*.ts" | grep -v "analytics/"

# Generate analytics usage summary for README maintenance (Rule 9)
echo "=== Analytics Usage Summary for README.md ===" && \
echo "Total analytics calls:" && grep -r "ecoAnalytics\." src/ --include="*.ts" | grep -v test | grep -v spec | wc -l && \
echo -e "\nAnalytics calls by module:" && \
for module in api intent quote watch health bullmq liquidity-manager; do \
  count=$(grep -r "ecoAnalytics\." src/$module/ --include="*.ts" 2>/dev/null | grep -v test | grep -v spec | wc -l); \
  if [ "$count" -gt 0 ]; then echo "$module: $count calls"; fi; \
done && \
echo -e "\nEvent constants usage:" && \
grep -r "ANALYTICS_EVENTS\." src/ --include="*.ts" | grep -v test | grep -v spec | wc -l
```
