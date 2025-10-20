#!/usr/bin/env python3
"""
Cross-Chain Transaction Log Analyzer

Analyzes JSON log files from the eco-solver system to extract performance metrics,
identify bottlenecks, and provide optimization recommendations.
"""

import json
import sys
from collections import defaultdict
from datetime import datetime


def load_events(log_file_path):
    """Load and parse JSON log lines from file."""
    events = []
    with open(log_file_path, 'r') as f:
        for line_num, line in enumerate(f, 1):
            try:
                events.append(json.loads(line.strip()))
            except json.JSONDecodeError as e:
                print(f"Warning: Skipping invalid JSON at line {line_num}: {e}", file=sys.stderr)
                continue
    return events


def analyze_phases(events):
    """Group operations by type and calculate durations."""
    phases = defaultdict(list)

    for event in events:
        op = event.get('operation', {})
        op_type = op.get('type', 'unknown')
        phases[op_type].append({
            'time': event.get('time'),
            'status': op.get('status', event.get('status')),
            'duration_ms': op.get('duration_ms'),
            'message': event.get('message'),
            'level': op.get('level')
        })

    return phases


def calculate_phase_stats(phases):
    """Calculate statistics for each phase."""
    stats = {}

    for phase_name, phase_events in phases.items():
        completed = [e for e in phase_events if e.get('duration_ms')]
        if completed:
            durations = [e['duration_ms'] for e in completed]
            stats[phase_name] = {
                'count': len(completed),
                'avg_duration': sum(durations) / len(durations),
                'min_duration': min(durations),
                'max_duration': max(durations),
                'total_duration': sum(durations)
            }

    return stats


def extract_transaction_details(events):
    """Extract transaction-specific details."""
    details = {
        'chains': {},
        'fees': {},
        'amounts': {},
        'tokens': {},
        'blockchain': {},
        'quote': {},
        'validations': {}
    }

    # Extract chain info
    for event in events:
        eco = event.get('eco', {})
        if 'source_chain_id' in eco and 'destination_chain_id' in eco:
            details['chains'] = {
                'source_id': eco['source_chain_id'],
                'destination_id': eco['destination_chain_id']
            }
            break

    # Extract fee info
    for event in events:
        if event.get('message') == 'Fee Calculation':
            fee = event.get('fee', {})
            details['fees'] = {
                'token': fee.get('token'),
                'native': fee.get('native')
            }
            break

    # Extract amounts
    for event in events:
        if 'totalFillNormalized' in event:
            fill = event['totalFillNormalized']
            ask = event['totalAsk']
            details['amounts'] = {
                'fill_token_hex': fill['token']['hex'],
                'fill_token_amount': int(fill['token']['hex'], 16),
                'ask_token_hex': ask['token']['hex'],
                'ask_token_amount': int(ask['token']['hex'], 16)
            }
            break

    # Extract token addresses
    for event in events:
        if event.get('context') == 'FeeService' and 'srcTokens' in event:
            details['tokens'] = {
                'source': event.get('srcTokens', []),
                'destination': event.get('dstToken')
            }
            break

    # Extract blockchain events
    for event in events:
        if 'txHash' in event and 'intentHash' in event:
            details['blockchain'] = {
                'tx_hash': event['txHash'],
                'intent_hash': event.get('intentHash'),
                'block_num': int(event['blockNum']['hex'], 16) if 'blockNum' in event else None
            }
            break

    # Extract quote parameters
    for event in events:
        result = event.get('result', {})
        if isinstance(result, dict) and 'quoteEntries' in result and result['quoteEntries']:
            quote_entry = result['quoteEntries'][0]
            details['quote'] = {
                'estimated_fulfill_time_sec': quote_entry.get('estimatedFulfillTimeSec'),
                'expiry_time': quote_entry.get('expiryTime'),
                'intent_execution_type': quote_entry.get('intentExecutionType'),
                'gas_overhead': quote_entry.get('gasOverhead')
            }
            break

    # Extract validation results
    for event in events:
        if event.get('message') == 'intent_validation completed successfully':
            details['validations'] = event.get('result', {})
            break

    return details


def extract_key_timings(events):
    """Extract critical timing points in the transaction lifecycle."""
    timings = {}

    for event in events:
        msg = event.get('message', '')
        op = event.get('operation', {})
        time = event.get('time')

        if msg == 'quote_generation started' and 'quote_start' not in timings:
            timings['quote_start'] = time
        elif msg == 'quote_generation completed successfully' and op.get('level') == 0:
            timings['quote_complete'] = time
        elif 'Intent created event processed' in msg:
            timings['intent_created'] = time
        elif msg == 'intent_fulfillment started' and 'fulfill_start' not in timings:
            timings['fulfill_start'] = time
        elif msg == 'intent_fulfillment completed successfully':
            timings['fulfill_complete'] = time

    return timings


def detect_log_type(events):
    """
    Detect if this is a quote-only, fulfillment-only, or full transaction lifecycle log.

    Returns a dict with:
    - type: 'quote_only', 'fulfillment_only', 'full_lifecycle', or 'unknown'
    - has_quote: boolean
    - has_intent_created: boolean
    - has_fulfillment: boolean
    - description: human-readable description
    """
    has_quote = any('quote_generation' in str(e.get('message', '')) for e in events)
    has_intent_created = any('Intent created event processed' in str(e.get('message', '')) for e in events)
    has_fulfillment = any('intent_fulfillment' in str(e.get('operation', {}).get('type', '')) for e in events)

    if has_quote and has_intent_created and has_fulfillment:
        log_type = 'full_lifecycle'
        description = 'Complete transaction lifecycle (quote → on-chain intent → fulfillment)'
    elif has_quote and not has_intent_created:
        log_type = 'quote_only'
        description = 'Quote generation only (no on-chain transaction or fulfillment)'
    elif has_intent_created and has_fulfillment:
        log_type = 'fulfillment_only'
        description = 'Intent fulfillment only (starts from on-chain transaction, no quote)'
    else:
        log_type = 'unknown'
        description = 'Unknown log type (missing expected events)'

    return {
        'type': log_type,
        'has_quote': has_quote,
        'has_intent_created': has_intent_created,
        'has_fulfillment': has_fulfillment,
        'description': description
    }


def calculate_effective_duration(timings, start_time, end_time):
    """
    Calculate effective duration excluding user wait time between quote and on-chain transaction.

    The time between quote completion and intent creation on blockchain is user action time
    (waiting for user to submit the transaction), not system processing time.
    """
    quote_complete = timings.get('quote_complete')
    intent_created = timings.get('intent_created')

    # If we have both quote completion and intent creation, calculate wait time
    if quote_complete and intent_created:
        user_wait_time_ms = intent_created - quote_complete
        effective_duration_ms = (end_time - start_time) - user_wait_time_ms

        return {
            'total_duration_ms': end_time - start_time,
            'user_wait_time_ms': user_wait_time_ms,
            'effective_duration_ms': effective_duration_ms,
            'total_duration_sec': (end_time - start_time) / 1000,
            'user_wait_time_sec': user_wait_time_ms / 1000,
            'effective_duration_sec': effective_duration_ms / 1000
        }
    else:
        # No user wait time, all time is effective
        total_ms = end_time - start_time
        return {
            'total_duration_ms': total_ms,
            'user_wait_time_ms': 0,
            'effective_duration_ms': total_ms,
            'total_duration_sec': total_ms / 1000,
            'user_wait_time_sec': 0,
            'effective_duration_sec': total_ms / 1000
        }


def count_operations(events):
    """Count operations by type."""
    counts = defaultdict(int)

    for event in events:
        op_type = event.get('operation', {}).get('type', 'other')
        counts[op_type] += 1

    return counts


def count_balance_queries(events):
    """Count balance query operations."""
    return sum(1 for e in events if 'fetchWalletTokenBalances' in str(e.get('message', '')))


def count_errors(events):
    """Count and categorize errors."""
    errors = [e for e in events if e.get('operation', {}).get('type') == 'processor_job_failed']
    return errors


def main():
    if len(sys.argv) != 2:
        print("Usage: python3 analyze.py <log-file-path>")
        sys.exit(1)

    log_file = sys.argv[1]

    try:
        # Load events
        events = load_events(log_file)

        if not events:
            print("Error: No valid events found in log file")
            sys.exit(1)

        # Calculate basic metrics
        start_time = events[0]['time']
        end_time = events[-1]['time']

        # Detect log type
        log_type = detect_log_type(events)

        # Analyze phases
        phases = analyze_phases(events)
        phase_stats = calculate_phase_stats(phases)

        # Extract details
        details = extract_transaction_details(events)
        timings = extract_key_timings(events)
        op_counts = count_operations(events)
        balance_queries = count_balance_queries(events)
        errors = count_errors(events)

        # Calculate duration metrics (with user wait time separation)
        duration_info = calculate_effective_duration(timings, start_time, end_time)

        # Output JSON for easy parsing
        output = {
            'log_type': log_type,
            'summary': {
                'start_time': start_time,
                'end_time': end_time,
                'total_events': len(events),
                'start_timestamp': datetime.fromtimestamp(start_time/1000).isoformat(),
                'end_timestamp': datetime.fromtimestamp(end_time/1000).isoformat(),
                **duration_info
            },
            'phases': phase_stats,
            'transaction': details,
            'timings': timings,
            'operation_counts': dict(op_counts),
            'balance_queries': balance_queries,
            'errors': {
                'count': len(errors),
                'details': [{'time': e.get('time'), 'context': e.get('context')} for e in errors[:5]]
            }
        }

        # Pretty print JSON
        print(json.dumps(output, indent=2))

    except FileNotFoundError:
        print(f"Error: File not found: {log_file}")
        sys.exit(1)
    except Exception as e:
        print(f"Error analyzing log file: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
