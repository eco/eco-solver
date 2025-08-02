import * as Joi from 'joi';

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3000),

  MONGODB_URI: Joi.string().required(),

  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').optional(),

  EVM_RPC_URL: Joi.string().required(),
  EVM_WEBSOCKET_URL: Joi.string().required(),
  EVM_CHAIN_ID: Joi.number().required(),
  EVM_PRIVATE_KEY: Joi.string().required(),
  EVM_INTENT_SOURCE_ADDRESS: Joi.string().required(),
  EVM_INBOX_ADDRESS: Joi.string().required(),

  SOLANA_RPC_URL: Joi.string().required(),
  SOLANA_WEBSOCKET_URL: Joi.string().required(),
  SOLANA_SECRET_KEY: Joi.string().required(),
  SOLANA_PROGRAM_ID: Joi.string().required(),

  QUEUE_CONCURRENCY: Joi.number().default(5),
  QUEUE_RETRY_ATTEMPTS: Joi.number().default(3),
  QUEUE_RETRY_DELAY: Joi.number().default(5000),
});
