import { BaseStructuredLogger } from './base-structured-logger'
import { DatadogLogStructure, EcoBusinessContext } from '../types'

/**
 * Smart wallet specific context extending business context
 */
export interface SmartWalletContext extends EcoBusinessContext {
  wallet_address: string
  chain_id: number
  wallet_type: 'safe' | 'biconomy' | 'kernel' | 'simple'
  owner_address?: string // Redacted in production for privacy
}

/**
 * Wallet deployment operation details
 */
export interface WalletDeployment {
  deployment_hash?: string
  factory_address: string
  salt?: string
  init_code_hash?: string
  predicted_address: string
  actual_address?: string
  gas_limit?: string
  gas_used?: string
  deployment_cost?: string
  status: 'pending' | 'confirmed' | 'failed'
  confirmation_blocks?: number
  error_reason?: string
}

/**
 * Signature verification operation details
 */
export interface SignatureResult {
  signature_hash: string
  message_hash: string
  signer_address: string
  verification_method: 'eip1271' | 'ecdsa' | 'multisig'
  is_valid: boolean
  verification_time_ms: number
  error_reason?: string
  chain_id: number
}

/**
 * Nonce management operation details
 */
export interface NonceOperation {
  current_nonce: number
  expected_nonce: number
  nonce_source: 'on_chain' | 'local_cache' | 'estimated'
  conflict_detected: boolean
  resolution_strategy?: 'increment' | 'sync' | 'reset'
  sync_time_ms?: number
}

/**
 * Gas estimation operation details
 */
export interface GasEstimation {
  operation_type: 'deploy' | 'execute' | 'batch'
  estimated_gas: string
  gas_limit: string
  gas_price?: string
  max_fee_per_gas?: string
  max_priority_fee_per_gas?: string
  estimation_method: 'eth_estimateGas' | 'simulation' | 'static'
  estimation_time_ms: number
  safety_multiplier?: number
  error_reason?: string
}

/**
 * Contract interaction operation details
 */
export interface ContractCall {
  contract_address: string
  function_name: string
  function_selector: string
  call_data: string
  value?: string
  success: boolean
  return_data?: string
  gas_used?: string
  execution_time_ms: number
  error_reason?: string
  revert_reason?: string
}

/**
 * Smart wallet specific business events
 */
export const SMART_WALLET_EVENTS = {
  WALLET_DEPLOYMENT_STARTED: 'wallet_deployment_started',
  WALLET_DEPLOYMENT_COMPLETED: 'wallet_deployment_completed',
  WALLET_DEPLOYMENT_FAILED: 'wallet_deployment_failed',
  SIGNATURE_VERIFICATION_SUCCESS: 'signature_verification_success',
  SIGNATURE_VERIFICATION_FAILED: 'signature_verification_failed',
  NONCE_CONFLICT_DETECTED: 'nonce_conflict_detected',
  NONCE_RECOVERY_ATTEMPTED: 'nonce_recovery_attempted',
  GAS_ESTIMATION_FAILED: 'gas_estimation_failed',
  CONTRACT_CALL_TIMEOUT: 'contract_call_timeout',
  WALLET_BALANCE_INSUFFICIENT: 'wallet_balance_insufficient',
  TRANSACTION_SIMULATION_FAILED: 'transaction_simulation_failed',
} as const

/**
 * Specialized logger for smart wallet operations with comprehensive structured logging
 */
export class SmartWalletLogger extends BaseStructuredLogger {
  constructor() {
    super('SmartWalletLogger')
  }

  /**
   * Log wallet deployment operation with comprehensive context
   */
  logWalletDeployment(
    context: SmartWalletContext,
    deployment: WalletDeployment,
    message?: string,
  ): void {
    const structure: DatadogLogStructure = {
      '@timestamp': new Date().toISOString(),
      message: message || `Wallet deployment ${deployment.status}: ${context.wallet_address}`,
      service: 'eco-solver',
      status: deployment.status === 'failed' ? 'error' : 'info',
      ddsource: 'nodejs',
      ddtags: `env:${process.env.NODE_ENV || 'development'},wallet_type:${context.wallet_type},chain:${context.chain_id}`,
      'logger.name': 'SmartWalletLogger',
      eco: {
        ...this.sanitizeWalletContext(context),
        event_type: this.getEventFromStatus(deployment.status, 'deployment'),
      },
      operation: {
        type: 'wallet_deployment',
        status: deployment.status,
        duration_ms: deployment.gas_used ? parseInt(deployment.gas_used) : undefined,
      },
      smart_wallet: {
        deployment_details: {
          factory_address: deployment.factory_address,
          predicted_address: deployment.predicted_address,
          actual_address: deployment.actual_address,
          salt: deployment.salt,
          gas_limit: deployment.gas_limit,
          gas_used: deployment.gas_used,
          deployment_cost: deployment.deployment_cost,
          confirmation_blocks: deployment.confirmation_blocks,
        },
        error: deployment.error_reason
          ? {
              reason: deployment.error_reason,
              category: 'deployment_error',
            }
          : undefined,
      },
    }

    this.logStructured(structure, deployment.status === 'failed' ? 'error' : 'info')
  }

  /**
   * Log signature verification with security context
   */
  logSignatureVerification(
    context: SmartWalletContext,
    verification: SignatureResult,
    message?: string,
  ): void {
    const structure: DatadogLogStructure = {
      '@timestamp': new Date().toISOString(),
      message:
        message ||
        `Signature verification ${verification.is_valid ? 'success' : 'failed'}: ${context.wallet_address}`,
      service: 'eco-solver',
      status: verification.is_valid ? 'info' : 'warn',
      ddsource: 'nodejs',
      ddtags: `env:${process.env.NODE_ENV || 'development'},wallet_type:${context.wallet_type},verification_method:${verification.verification_method}`,
      'logger.name': 'SmartWalletLogger',
      eco: {
        ...this.sanitizeWalletContext(context),
        event_type: verification.is_valid
          ? SMART_WALLET_EVENTS.SIGNATURE_VERIFICATION_SUCCESS
          : SMART_WALLET_EVENTS.SIGNATURE_VERIFICATION_FAILED,
      },
      operation: {
        type: 'signature_verification',
        status: verification.is_valid ? 'completed' : 'failed',
        duration_ms: verification.verification_time_ms,
      },
      smart_wallet: {
        signature_details: {
          signature_hash: verification.signature_hash.substring(0, 10) + '...', // Truncate for security
          message_hash: verification.message_hash,
          signer_address: this.maskAddress(verification.signer_address),
          verification_method: verification.verification_method,
          is_valid: verification.is_valid,
          verification_time_ms: verification.verification_time_ms,
        },
        error: verification.error_reason
          ? {
              reason: verification.error_reason,
              category: 'signature_error',
            }
          : undefined,
      },
    }

    this.logStructured(structure, verification.is_valid ? 'info' : 'warn')
  }

  /**
   * Log nonce management operations with conflict resolution details
   */
  logNonceManagement(context: SmartWalletContext, nonce: NonceOperation, message?: string): void {
    const structure: DatadogLogStructure = {
      '@timestamp': new Date().toISOString(),
      message:
        message ||
        `Nonce ${nonce.conflict_detected ? 'conflict detected' : 'managed'}: ${context.wallet_address}`,
      service: 'eco-solver',
      status: nonce.conflict_detected ? 'warn' : 'info',
      ddsource: 'nodejs',
      ddtags: `env:${process.env.NODE_ENV || 'development'},wallet_type:${context.wallet_type},nonce_source:${nonce.nonce_source}`,
      'logger.name': 'SmartWalletLogger',
      eco: {
        ...this.sanitizeWalletContext(context),
        event_type: nonce.conflict_detected
          ? SMART_WALLET_EVENTS.NONCE_CONFLICT_DETECTED
          : 'nonce_managed',
      },
      operation: {
        type: 'nonce_management',
        status: nonce.conflict_detected ? 'conflict_resolved' : 'completed',
        duration_ms: nonce.sync_time_ms,
      },
      smart_wallet: {
        nonce_details: {
          current_nonce: nonce.current_nonce,
          expected_nonce: nonce.expected_nonce,
          nonce_source: nonce.nonce_source,
          conflict_detected: nonce.conflict_detected,
          resolution_strategy: nonce.resolution_strategy,
          sync_time_ms: nonce.sync_time_ms,
        },
      },
    }

    this.logStructured(structure, nonce.conflict_detected ? 'warn' : 'info')
  }

  /**
   * Log gas estimation with optimization details
   */
  logGasEstimation(context: SmartWalletContext, estimation: GasEstimation, message?: string): void {
    const structure: DatadogLogStructure = {
      '@timestamp': new Date().toISOString(),
      message:
        message ||
        `Gas estimation ${estimation.error_reason ? 'failed' : 'completed'}: ${estimation.estimated_gas}`,
      service: 'eco-solver',
      status: estimation.error_reason ? 'error' : 'info',
      ddsource: 'nodejs',
      ddtags: `env:${process.env.NODE_ENV || 'development'},wallet_type:${context.wallet_type},estimation_method:${estimation.estimation_method}`,
      'logger.name': 'SmartWalletLogger',
      eco: {
        ...this.sanitizeWalletContext(context),
        event_type: estimation.error_reason
          ? SMART_WALLET_EVENTS.GAS_ESTIMATION_FAILED
          : 'gas_estimation_success',
      },
      operation: {
        type: 'gas_estimation',
        status: estimation.error_reason ? 'failed' : 'completed',
        duration_ms: estimation.estimation_time_ms,
      },
      smart_wallet: {
        gas_details: {
          operation_type: estimation.operation_type,
          estimated_gas: estimation.estimated_gas,
          gas_limit: estimation.gas_limit,
          gas_price: estimation.gas_price,
          max_fee_per_gas: estimation.max_fee_per_gas,
          max_priority_fee_per_gas: estimation.max_priority_fee_per_gas,
          estimation_method: estimation.estimation_method,
          estimation_time_ms: estimation.estimation_time_ms,
          safety_multiplier: estimation.safety_multiplier,
        },
        error: estimation.error_reason
          ? {
              reason: estimation.error_reason,
              category: 'gas_estimation_error',
            }
          : undefined,
      },
    }

    this.logStructured(structure, estimation.error_reason ? 'error' : 'info')
  }

  /**
   * Log contract interaction with execution details
   */
  logContractInteraction(
    context: SmartWalletContext,
    interaction: ContractCall,
    message?: string,
  ): void {
    const structure: DatadogLogStructure = {
      '@timestamp': new Date().toISOString(),
      message:
        message ||
        `Contract call ${interaction.success ? 'success' : 'failed'}: ${interaction.function_name}`,
      service: 'eco-solver',
      status: interaction.success ? 'info' : 'error',
      ddsource: 'nodejs',
      ddtags: `env:${process.env.NODE_ENV || 'development'},wallet_type:${context.wallet_type},function:${interaction.function_name}`,
      'logger.name': 'SmartWalletLogger',
      eco: {
        ...this.sanitizeWalletContext(context),
        event_type: interaction.success ? 'contract_call_success' : 'contract_call_failed',
        contract_address: interaction.contract_address,
      },
      operation: {
        type: 'contract_interaction',
        status: interaction.success ? 'completed' : 'failed',
        duration_ms: interaction.execution_time_ms,
      },
      smart_wallet: {
        contract_details: {
          contract_address: interaction.contract_address,
          function_name: interaction.function_name,
          function_selector: interaction.function_selector,
          call_data_length: interaction.call_data.length,
          value: interaction.value,
          success: interaction.success,
          gas_used: interaction.gas_used,
          execution_time_ms: interaction.execution_time_ms,
        },
        error:
          interaction.error_reason || interaction.revert_reason
            ? {
                reason: interaction.error_reason || interaction.revert_reason || 'Unknown error',
                category: interaction.revert_reason ? 'contract_revert' : 'execution_error',
                revert_reason: interaction.revert_reason,
              }
            : undefined,
      },
    }

    this.logStructured(structure, interaction.success ? 'info' : 'error')
  }

  /**
   * Log wallet balance and funding related operations
   */
  logWalletBalance(
    context: SmartWalletContext,
    balance: {
      token_address?: string
      balance: string
      required_balance?: string
      is_sufficient: boolean
      token_symbol?: string
      decimals?: number
    },
    message?: string,
  ): void {
    const structure: DatadogLogStructure = {
      '@timestamp': new Date().toISOString(),
      message:
        message ||
        `Wallet balance ${balance.is_sufficient ? 'sufficient' : 'insufficient'}: ${balance.balance} ${balance.token_symbol || 'ETH'}`,
      service: 'eco-solver',
      status: balance.is_sufficient ? 'info' : 'warn',
      ddsource: 'nodejs',
      ddtags: `env:${process.env.NODE_ENV || 'development'},wallet_type:${context.wallet_type},token:${balance.token_symbol || 'native'}`,
      'logger.name': 'SmartWalletLogger',
      eco: {
        ...this.sanitizeWalletContext(context),
        event_type: balance.is_sufficient
          ? 'balance_sufficient'
          : SMART_WALLET_EVENTS.WALLET_BALANCE_INSUFFICIENT,
        token_address: balance.token_address,
      },
      operation: {
        type: 'balance_check',
        status: balance.is_sufficient ? 'completed' : 'insufficient_funds',
      },
      smart_wallet: {
        balance_details: {
          token_address: balance.token_address,
          balance: balance.balance,
          required_balance: balance.required_balance,
          is_sufficient: balance.is_sufficient,
          token_symbol: balance.token_symbol,
          decimals: balance.decimals,
        },
      },
    }

    this.logStructured(structure, balance.is_sufficient ? 'info' : 'warn')
  }

  /**
   * Private: Sanitize wallet context for logging (remove sensitive data in production)
   */
  private sanitizeWalletContext(context: SmartWalletContext): SmartWalletContext {
    const sanitized = { ...context }

    // In production, mask owner address for privacy
    if (process.env.NODE_ENV === 'production' && sanitized.owner_address) {
      sanitized.owner_address = this.maskAddress(sanitized.owner_address)
    }

    return sanitized
  }

  /**
   * Private: Mask ethereum address for privacy (show first 6 and last 4 characters)
   */
  private maskAddress(address: string): string {
    if (!address || address.length < 10) {
      return address
    }
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`
  }

  /**
   * Private: Get appropriate event type based on operation status
   */
  private getEventFromStatus(status: string, operation: string): string {
    const statusMap: Record<string, string> = {
      pending: `${operation}_started`,
      confirmed: `${operation}_completed`,
      completed: `${operation}_completed`,
      failed: `${operation}_failed`,
    }
    return statusMap[status] || `${operation}_${status}`
  }
}
