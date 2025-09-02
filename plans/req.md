Context:

By ensuring every log entry is a machine-parsable JSON object with a consistent schema, we unlock the ability to easily search, filter, and build powerful dashboards and alerts in Datadog. This ticket replaces free-form string logging with a structured approach.

Suggested Solution:

Define a core LogContext interface that includes essential, queryable fields. At a minimum, this should include: rebalanceId, walletAddress, strategy, sourceChainId, destinationChainId.

Create a new, lightweight LiquidityManagerLogger class that wraps the existing EcoLogger.

This wrapper's methods (e.g., log, error, warn) will require the LogContext as an argument. It will merge this context with the message and any additional properties before passing a single, structured EcoLogMessage object to the underlying logger.

Refactor key areas of the Liquidity Manager—particularly liquidity-manager.service, liquidity-provider.service, and the *JobManager classes—to use this new LiquidityManagerLogger and provide the required context for every log entry.

Acceptance Criteria:

[ ] A LiquidityManagerLogger class exists and is used in the core LM services.

[ ] All log outputs from the Liquidity Manager appearing in Datadog are in a valid JSON format.

[ ] Logs related to a specific rebalancing operation can be found in Datadog by filtering on a single rebalanceId.

[ ] Logs can be effectively filtered by walletAddress and strategy.