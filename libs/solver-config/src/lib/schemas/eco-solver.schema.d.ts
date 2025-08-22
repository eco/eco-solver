import { z } from 'zod'
export declare const SolverConfigSchema: z.ZodObject<
  {
    chainID: z.ZodNumber
    inboxAddress: z.ZodOptional<z.ZodString>
    network: z.ZodString
    targets: z.ZodRecord<
      z.ZodString,
      z.ZodObject<
        {
          contractType: z.ZodEnum<['erc20', 'erc721', 'erc1155']>
          selectors: z.ZodArray<z.ZodString, 'many'>
          minBalance: z.ZodNumber
          targetBalance: z.ZodOptional<z.ZodNumber>
        },
        'strip',
        z.ZodTypeAny,
        {
          contractType?: 'erc20' | 'erc721' | 'erc1155'
          selectors?: string[]
          minBalance?: number
          targetBalance?: number
        },
        {
          contractType?: 'erc20' | 'erc721' | 'erc1155'
          selectors?: string[]
          minBalance?: number
          targetBalance?: number
        }
      >
    >
    fee: z.ZodOptional<
      z.ZodObject<
        {
          limit: z.ZodObject<
            {
              tokenBase6: z.ZodBigInt
              nativeBase18: z.ZodBigInt
            },
            'strip',
            z.ZodTypeAny,
            {
              tokenBase6?: bigint
              nativeBase18?: bigint
            },
            {
              tokenBase6?: bigint
              nativeBase18?: bigint
            }
          >
          algorithm: z.ZodEnum<['linear', 'quadratic']>
          constants: z.ZodAny
        },
        'strip',
        z.ZodTypeAny,
        {
          limit?: {
            tokenBase6?: bigint
            nativeBase18?: bigint
          }
          algorithm?: 'linear' | 'quadratic'
          constants?: any
        },
        {
          limit?: {
            tokenBase6?: bigint
            nativeBase18?: bigint
          }
          algorithm?: 'linear' | 'quadratic'
          constants?: any
        }
      >
    >
    averageBlockTime: z.ZodNumber
    gasOverhead: z.ZodOptional<z.ZodNumber>
  },
  'strip',
  z.ZodTypeAny,
  {
    chainID?: number
    inboxAddress?: string
    network?: string
    targets?: Record<
      string,
      {
        contractType?: 'erc20' | 'erc721' | 'erc1155'
        selectors?: string[]
        minBalance?: number
        targetBalance?: number
      }
    >
    fee?: {
      limit?: {
        tokenBase6?: bigint
        nativeBase18?: bigint
      }
      algorithm?: 'linear' | 'quadratic'
      constants?: any
    }
    averageBlockTime?: number
    gasOverhead?: number
  },
  {
    chainID?: number
    inboxAddress?: string
    network?: string
    targets?: Record<
      string,
      {
        contractType?: 'erc20' | 'erc721' | 'erc1155'
        selectors?: string[]
        minBalance?: number
        targetBalance?: number
      }
    >
    fee?: {
      limit?: {
        tokenBase6?: bigint
        nativeBase18?: bigint
      }
      algorithm?: 'linear' | 'quadratic'
      constants?: any
    }
    averageBlockTime?: number
    gasOverhead?: number
  }
>
export declare const IntentSourceSchema: z.ZodObject<
  {
    network: z.ZodString
    chainID: z.ZodNumber
    sourceAddress: z.ZodOptional<z.ZodString>
    inbox: z.ZodOptional<z.ZodString>
    tokens: z.ZodArray<z.ZodString, 'many'>
    provers: z.ZodOptional<z.ZodArray<z.ZodString, 'many'>>
    config: z.ZodOptional<
      z.ZodObject<
        {
          ecoRoutes: z.ZodEnum<['append', 'replace']>
        },
        'strip',
        z.ZodTypeAny,
        {
          ecoRoutes?: 'append' | 'replace'
        },
        {
          ecoRoutes?: 'append' | 'replace'
        }
      >
    >
  },
  'strip',
  z.ZodTypeAny,
  {
    chainID?: number
    network?: string
    sourceAddress?: string
    inbox?: string
    tokens?: string[]
    provers?: string[]
    config?: {
      ecoRoutes?: 'append' | 'replace'
    }
  },
  {
    chainID?: number
    network?: string
    sourceAddress?: string
    inbox?: string
    tokens?: string[]
    provers?: string[]
    config?: {
      ecoRoutes?: 'append' | 'replace'
    }
  }
>
export declare const RedisConfigSchema: z.ZodObject<
  {
    connection: z.ZodOptional<
      z.ZodObject<
        {
          host: z.ZodString
          port: z.ZodNumber
        },
        'strip',
        z.ZodTypeAny,
        {
          port?: number
          host?: string
        },
        {
          port?: number
          host?: string
        }
      >
    >
    options: z.ZodOptional<
      z.ZodObject<
        {
          single: z.ZodOptional<
            z.ZodObject<
              {
                autoResubscribe: z.ZodBoolean
                autoResendUnfulfilledCommands: z.ZodBoolean
                tls: z.ZodRecord<z.ZodString, z.ZodAny>
              },
              'strip',
              z.ZodTypeAny,
              {
                autoResubscribe?: boolean
                autoResendUnfulfilledCommands?: boolean
                tls?: Record<string, any>
              },
              {
                autoResubscribe?: boolean
                autoResendUnfulfilledCommands?: boolean
                tls?: Record<string, any>
              }
            >
          >
          cluster: z.ZodOptional<
            z.ZodObject<
              {
                enableReadyCheck: z.ZodBoolean
                retryDelayOnClusterDown: z.ZodNumber
                retryDelayOnFailover: z.ZodNumber
                retryDelayOnTryAgain: z.ZodNumber
                slotsRefreshTimeout: z.ZodNumber
                clusterRetryStrategy: z.ZodFunction<
                  z.ZodTuple<[z.ZodNumber], z.ZodUnknown>,
                  z.ZodNumber
                >
                dnsLookup: z.ZodFunction<z.ZodTuple<[], z.ZodUnknown>, z.ZodUnknown>
              },
              'strip',
              z.ZodTypeAny,
              {
                enableReadyCheck?: boolean
                retryDelayOnClusterDown?: number
                retryDelayOnFailover?: number
                retryDelayOnTryAgain?: number
                slotsRefreshTimeout?: number
                clusterRetryStrategy?: (args_0: number, ...args: unknown[]) => number
                dnsLookup?: (...args: unknown[]) => unknown
              },
              {
                enableReadyCheck?: boolean
                retryDelayOnClusterDown?: number
                retryDelayOnFailover?: number
                retryDelayOnTryAgain?: number
                slotsRefreshTimeout?: number
                clusterRetryStrategy?: (args_0: number, ...args: unknown[]) => number
                dnsLookup?: (...args: unknown[]) => unknown
              }
            >
          >
        },
        'strip',
        z.ZodTypeAny,
        {
          single?: {
            autoResubscribe?: boolean
            autoResendUnfulfilledCommands?: boolean
            tls?: Record<string, any>
          }
          cluster?: {
            enableReadyCheck?: boolean
            retryDelayOnClusterDown?: number
            retryDelayOnFailover?: number
            retryDelayOnTryAgain?: number
            slotsRefreshTimeout?: number
            clusterRetryStrategy?: (args_0: number, ...args: unknown[]) => number
            dnsLookup?: (...args: unknown[]) => unknown
          }
        },
        {
          single?: {
            autoResubscribe?: boolean
            autoResendUnfulfilledCommands?: boolean
            tls?: Record<string, any>
          }
          cluster?: {
            enableReadyCheck?: boolean
            retryDelayOnClusterDown?: number
            retryDelayOnFailover?: number
            retryDelayOnTryAgain?: number
            slotsRefreshTimeout?: number
            clusterRetryStrategy?: (args_0: number, ...args: unknown[]) => number
            dnsLookup?: (...args: unknown[]) => unknown
          }
        }
      >
    >
    redlockSettings: z.ZodOptional<
      z.ZodObject<
        {
          driftFactor: z.ZodNumber
          retryCount: z.ZodNumber
          retryDelay: z.ZodNumber
          retryJitter: z.ZodNumber
        },
        'strip',
        z.ZodTypeAny,
        {
          driftFactor?: number
          retryCount?: number
          retryDelay?: number
          retryJitter?: number
        },
        {
          driftFactor?: number
          retryCount?: number
          retryDelay?: number
          retryJitter?: number
        }
      >
    >
    jobs: z.ZodOptional<
      z.ZodObject<
        {
          intentJobConfig: z.ZodOptional<
            z.ZodObject<
              {
                removeOnComplete: z.ZodBoolean
                removeOnFail: z.ZodBoolean
                attempts: z.ZodNumber
                backoff: z.ZodObject<
                  {
                    type: z.ZodString
                    delay: z.ZodNumber
                  },
                  'strip',
                  z.ZodTypeAny,
                  {
                    type?: string
                    delay?: number
                  },
                  {
                    type?: string
                    delay?: number
                  }
                >
              },
              'strip',
              z.ZodTypeAny,
              {
                removeOnComplete?: boolean
                removeOnFail?: boolean
                attempts?: number
                backoff?: {
                  type?: string
                  delay?: number
                }
              },
              {
                removeOnComplete?: boolean
                removeOnFail?: boolean
                attempts?: number
                backoff?: {
                  type?: string
                  delay?: number
                }
              }
            >
          >
          watchJobConfig: z.ZodOptional<
            z.ZodObject<
              {
                removeOnComplete: z.ZodBoolean
                removeOnFail: z.ZodBoolean
                attempts: z.ZodNumber
                backoff: z.ZodObject<
                  {
                    type: z.ZodString
                    delay: z.ZodNumber
                  },
                  'strip',
                  z.ZodTypeAny,
                  {
                    type?: string
                    delay?: number
                  },
                  {
                    type?: string
                    delay?: number
                  }
                >
              },
              'strip',
              z.ZodTypeAny,
              {
                removeOnComplete?: boolean
                removeOnFail?: boolean
                attempts?: number
                backoff?: {
                  type?: string
                  delay?: number
                }
              },
              {
                removeOnComplete?: boolean
                removeOnFail?: boolean
                attempts?: number
                backoff?: {
                  type?: string
                  delay?: number
                }
              }
            >
          >
        },
        'strip',
        z.ZodTypeAny,
        {
          intentJobConfig?: {
            removeOnComplete?: boolean
            removeOnFail?: boolean
            attempts?: number
            backoff?: {
              type?: string
              delay?: number
            }
          }
          watchJobConfig?: {
            removeOnComplete?: boolean
            removeOnFail?: boolean
            attempts?: number
            backoff?: {
              type?: string
              delay?: number
            }
          }
        },
        {
          intentJobConfig?: {
            removeOnComplete?: boolean
            removeOnFail?: boolean
            attempts?: number
            backoff?: {
              type?: string
              delay?: number
            }
          }
          watchJobConfig?: {
            removeOnComplete?: boolean
            removeOnFail?: boolean
            attempts?: number
            backoff?: {
              type?: string
              delay?: number
            }
          }
        }
      >
    >
  },
  'strip',
  z.ZodTypeAny,
  {
    options?: {
      single?: {
        autoResubscribe?: boolean
        autoResendUnfulfilledCommands?: boolean
        tls?: Record<string, any>
      }
      cluster?: {
        enableReadyCheck?: boolean
        retryDelayOnClusterDown?: number
        retryDelayOnFailover?: number
        retryDelayOnTryAgain?: number
        slotsRefreshTimeout?: number
        clusterRetryStrategy?: (args_0: number, ...args: unknown[]) => number
        dnsLookup?: (...args: unknown[]) => unknown
      }
    }
    connection?: {
      port?: number
      host?: string
    }
    redlockSettings?: {
      driftFactor?: number
      retryCount?: number
      retryDelay?: number
      retryJitter?: number
    }
    jobs?: {
      intentJobConfig?: {
        removeOnComplete?: boolean
        removeOnFail?: boolean
        attempts?: number
        backoff?: {
          type?: string
          delay?: number
        }
      }
      watchJobConfig?: {
        removeOnComplete?: boolean
        removeOnFail?: boolean
        attempts?: number
        backoff?: {
          type?: string
          delay?: number
        }
      }
    }
  },
  {
    options?: {
      single?: {
        autoResubscribe?: boolean
        autoResendUnfulfilledCommands?: boolean
        tls?: Record<string, any>
      }
      cluster?: {
        enableReadyCheck?: boolean
        retryDelayOnClusterDown?: number
        retryDelayOnFailover?: number
        retryDelayOnTryAgain?: number
        slotsRefreshTimeout?: number
        clusterRetryStrategy?: (args_0: number, ...args: unknown[]) => number
        dnsLookup?: (...args: unknown[]) => unknown
      }
    }
    connection?: {
      port?: number
      host?: string
    }
    redlockSettings?: {
      driftFactor?: number
      retryCount?: number
      retryDelay?: number
      retryJitter?: number
    }
    jobs?: {
      intentJobConfig?: {
        removeOnComplete?: boolean
        removeOnFail?: boolean
        attempts?: number
        backoff?: {
          type?: string
          delay?: number
        }
      }
      watchJobConfig?: {
        removeOnComplete?: boolean
        removeOnFail?: boolean
        attempts?: number
        backoff?: {
          type?: string
          delay?: number
        }
      }
    }
  }
>
export declare const RpcConfigSchema: z.ZodObject<
  {
    keys: z.ZodRecord<z.ZodString, z.ZodString>
    config: z.ZodOptional<
      z.ZodObject<
        {
          webSockets: z.ZodOptional<z.ZodBoolean>
        },
        'strip',
        z.ZodTypeAny,
        {
          webSockets?: boolean
        },
        {
          webSockets?: boolean
        }
      >
    >
    custom: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>
  },
  'strip',
  z.ZodTypeAny,
  {
    keys?: Record<string, string>
    custom?: Record<string, any>
    config?: {
      webSockets?: boolean
    }
  },
  {
    keys?: Record<string, string>
    custom?: Record<string, any>
    config?: {
      webSockets?: boolean
    }
  }
>
export declare const IntervalsConfigSchema: z.ZodObject<
  {
    retryInfeasableIntents: z.ZodOptional<
      z.ZodObject<
        {
          repeatOpts: z.ZodObject<
            {
              every: z.ZodNumber
            },
            'strip',
            z.ZodTypeAny,
            {
              every?: number
            },
            {
              every?: number
            }
          >
          jobTemplate: z.ZodObject<
            {
              name: z.ZodString
              data: z.ZodRecord<z.ZodString, z.ZodAny>
            },
            'strip',
            z.ZodTypeAny,
            {
              name?: string
              data?: Record<string, any>
            },
            {
              name?: string
              data?: Record<string, any>
            }
          >
        },
        'strip',
        z.ZodTypeAny,
        {
          repeatOpts?: {
            every?: number
          }
          jobTemplate?: {
            name?: string
            data?: Record<string, any>
          }
        },
        {
          repeatOpts?: {
            every?: number
          }
          jobTemplate?: {
            name?: string
            data?: Record<string, any>
          }
        }
      >
    >
    defaults: z.ZodOptional<
      z.ZodObject<
        {
          repeatOpts: z.ZodObject<
            {
              every: z.ZodNumber
            },
            'strip',
            z.ZodTypeAny,
            {
              every?: number
            },
            {
              every?: number
            }
          >
          jobTemplate: z.ZodObject<
            {
              name: z.ZodString
              data: z.ZodRecord<z.ZodString, z.ZodAny>
              opts: z.ZodObject<
                {
                  removeOnComplete: z.ZodBoolean
                  removeOnFail: z.ZodBoolean
                  attempts: z.ZodNumber
                  backoff: z.ZodObject<
                    {
                      type: z.ZodString
                      delay: z.ZodNumber
                    },
                    'strip',
                    z.ZodTypeAny,
                    {
                      type?: string
                      delay?: number
                    },
                    {
                      type?: string
                      delay?: number
                    }
                  >
                },
                'strip',
                z.ZodTypeAny,
                {
                  removeOnComplete?: boolean
                  removeOnFail?: boolean
                  attempts?: number
                  backoff?: {
                    type?: string
                    delay?: number
                  }
                },
                {
                  removeOnComplete?: boolean
                  removeOnFail?: boolean
                  attempts?: number
                  backoff?: {
                    type?: string
                    delay?: number
                  }
                }
              >
            },
            'strip',
            z.ZodTypeAny,
            {
              name?: string
              data?: Record<string, any>
              opts?: {
                removeOnComplete?: boolean
                removeOnFail?: boolean
                attempts?: number
                backoff?: {
                  type?: string
                  delay?: number
                }
              }
            },
            {
              name?: string
              data?: Record<string, any>
              opts?: {
                removeOnComplete?: boolean
                removeOnFail?: boolean
                attempts?: number
                backoff?: {
                  type?: string
                  delay?: number
                }
              }
            }
          >
        },
        'strip',
        z.ZodTypeAny,
        {
          repeatOpts?: {
            every?: number
          }
          jobTemplate?: {
            name?: string
            data?: Record<string, any>
            opts?: {
              removeOnComplete?: boolean
              removeOnFail?: boolean
              attempts?: number
              backoff?: {
                type?: string
                delay?: number
              }
            }
          }
        },
        {
          repeatOpts?: {
            every?: number
          }
          jobTemplate?: {
            name?: string
            data?: Record<string, any>
            opts?: {
              removeOnComplete?: boolean
              removeOnFail?: boolean
              attempts?: number
              backoff?: {
                type?: string
                delay?: number
              }
            }
          }
        }
      >
    >
  },
  'strip',
  z.ZodTypeAny,
  {
    retryInfeasableIntents?: {
      repeatOpts?: {
        every?: number
      }
      jobTemplate?: {
        name?: string
        data?: Record<string, any>
      }
    }
    defaults?: {
      repeatOpts?: {
        every?: number
      }
      jobTemplate?: {
        name?: string
        data?: Record<string, any>
        opts?: {
          removeOnComplete?: boolean
          removeOnFail?: boolean
          attempts?: number
          backoff?: {
            type?: string
            delay?: number
          }
        }
      }
    }
  },
  {
    retryInfeasableIntents?: {
      repeatOpts?: {
        every?: number
      }
      jobTemplate?: {
        name?: string
        data?: Record<string, any>
      }
    }
    defaults?: {
      repeatOpts?: {
        every?: number
      }
      jobTemplate?: {
        name?: string
        data?: Record<string, any>
        opts?: {
          removeOnComplete?: boolean
          removeOnFail?: boolean
          attempts?: number
          backoff?: {
            type?: string
            delay?: number
          }
        }
      }
    }
  }
>
export declare const LoggerConfigSchema: z.ZodObject<
  {
    usePino: z.ZodBoolean
    pinoConfig: z.ZodOptional<
      z.ZodObject<
        {
          pinoHttp: z.ZodObject<
            {
              level: z.ZodString
              useLevelLabels: z.ZodBoolean
              redact: z.ZodObject<
                {
                  paths: z.ZodArray<z.ZodString, 'many'>
                  remove: z.ZodBoolean
                },
                'strip',
                z.ZodTypeAny,
                {
                  paths?: string[]
                  remove?: boolean
                },
                {
                  paths?: string[]
                  remove?: boolean
                }
              >
            },
            'strip',
            z.ZodTypeAny,
            {
              level?: string
              useLevelLabels?: boolean
              redact?: {
                paths?: string[]
                remove?: boolean
              }
            },
            {
              level?: string
              useLevelLabels?: boolean
              redact?: {
                paths?: string[]
                remove?: boolean
              }
            }
          >
        },
        'strip',
        z.ZodTypeAny,
        {
          pinoHttp?: {
            level?: string
            useLevelLabels?: boolean
            redact?: {
              paths?: string[]
              remove?: boolean
            }
          }
        },
        {
          pinoHttp?: {
            level?: string
            useLevelLabels?: boolean
            redact?: {
              paths?: string[]
              remove?: boolean
            }
          }
        }
      >
    >
  },
  'strip',
  z.ZodTypeAny,
  {
    usePino?: boolean
    pinoConfig?: {
      pinoHttp?: {
        level?: string
        useLevelLabels?: boolean
        redact?: {
          paths?: string[]
          remove?: boolean
        }
      }
    }
  },
  {
    usePino?: boolean
    pinoConfig?: {
      pinoHttp?: {
        level?: string
        useLevelLabels?: boolean
        redact?: {
          paths?: string[]
          remove?: boolean
        }
      }
    }
  }
>
export declare const IntentConfigSchema: z.ZodObject<
  {
    defaultFee: z.ZodObject<
      {
        limit: z.ZodObject<
          {
            tokenBase6: z.ZodBigInt
            nativeBase18: z.ZodBigInt
          },
          'strip',
          z.ZodTypeAny,
          {
            tokenBase6?: bigint
            nativeBase18?: bigint
          },
          {
            tokenBase6?: bigint
            nativeBase18?: bigint
          }
        >
        algorithm: z.ZodEnum<['linear', 'quadratic']>
        constants: z.ZodObject<
          {
            token: z.ZodObject<
              {
                baseFee: z.ZodBigInt
                tranche: z.ZodObject<
                  {
                    unitFee: z.ZodBigInt
                    unitSize: z.ZodBigInt
                  },
                  'strip',
                  z.ZodTypeAny,
                  {
                    unitFee?: bigint
                    unitSize?: bigint
                  },
                  {
                    unitFee?: bigint
                    unitSize?: bigint
                  }
                >
              },
              'strip',
              z.ZodTypeAny,
              {
                baseFee?: bigint
                tranche?: {
                  unitFee?: bigint
                  unitSize?: bigint
                }
              },
              {
                baseFee?: bigint
                tranche?: {
                  unitFee?: bigint
                  unitSize?: bigint
                }
              }
            >
            native: z.ZodObject<
              {
                baseFee: z.ZodBigInt
                tranche: z.ZodObject<
                  {
                    unitFee: z.ZodBigInt
                    unitSize: z.ZodBigInt
                  },
                  'strip',
                  z.ZodTypeAny,
                  {
                    unitFee?: bigint
                    unitSize?: bigint
                  },
                  {
                    unitFee?: bigint
                    unitSize?: bigint
                  }
                >
              },
              'strip',
              z.ZodTypeAny,
              {
                baseFee?: bigint
                tranche?: {
                  unitFee?: bigint
                  unitSize?: bigint
                }
              },
              {
                baseFee?: bigint
                tranche?: {
                  unitFee?: bigint
                  unitSize?: bigint
                }
              }
            >
          },
          'strip',
          z.ZodTypeAny,
          {
            token?: {
              baseFee?: bigint
              tranche?: {
                unitFee?: bigint
                unitSize?: bigint
              }
            }
            native?: {
              baseFee?: bigint
              tranche?: {
                unitFee?: bigint
                unitSize?: bigint
              }
            }
          },
          {
            token?: {
              baseFee?: bigint
              tranche?: {
                unitFee?: bigint
                unitSize?: bigint
              }
            }
            native?: {
              baseFee?: bigint
              tranche?: {
                unitFee?: bigint
                unitSize?: bigint
              }
            }
          }
        >
      },
      'strip',
      z.ZodTypeAny,
      {
        limit?: {
          tokenBase6?: bigint
          nativeBase18?: bigint
        }
        algorithm?: 'linear' | 'quadratic'
        constants?: {
          token?: {
            baseFee?: bigint
            tranche?: {
              unitFee?: bigint
              unitSize?: bigint
            }
          }
          native?: {
            baseFee?: bigint
            tranche?: {
              unitFee?: bigint
              unitSize?: bigint
            }
          }
        }
      },
      {
        limit?: {
          tokenBase6?: bigint
          nativeBase18?: bigint
        }
        algorithm?: 'linear' | 'quadratic'
        constants?: {
          token?: {
            baseFee?: bigint
            tranche?: {
              unitFee?: bigint
              unitSize?: bigint
            }
          }
          native?: {
            baseFee?: bigint
            tranche?: {
              unitFee?: bigint
              unitSize?: bigint
            }
          }
        }
      }
    >
    proofs: z.ZodObject<
      {
        hyperlane_duration_seconds: z.ZodNumber
        metalayer_duration_seconds: z.ZodNumber
      },
      'strip',
      z.ZodTypeAny,
      {
        hyperlane_duration_seconds?: number
        metalayer_duration_seconds?: number
      },
      {
        hyperlane_duration_seconds?: number
        metalayer_duration_seconds?: number
      }
    >
    intentFundedRetries: z.ZodNumber
    intentFundedRetryDelayMs: z.ZodNumber
    defaultGasOverhead: z.ZodNumber
  },
  'strip',
  z.ZodTypeAny,
  {
    defaultFee?: {
      limit?: {
        tokenBase6?: bigint
        nativeBase18?: bigint
      }
      algorithm?: 'linear' | 'quadratic'
      constants?: {
        token?: {
          baseFee?: bigint
          tranche?: {
            unitFee?: bigint
            unitSize?: bigint
          }
        }
        native?: {
          baseFee?: bigint
          tranche?: {
            unitFee?: bigint
            unitSize?: bigint
          }
        }
      }
    }
    proofs?: {
      hyperlane_duration_seconds?: number
      metalayer_duration_seconds?: number
    }
    intentFundedRetries?: number
    intentFundedRetryDelayMs?: number
    defaultGasOverhead?: number
  },
  {
    defaultFee?: {
      limit?: {
        tokenBase6?: bigint
        nativeBase18?: bigint
      }
      algorithm?: 'linear' | 'quadratic'
      constants?: {
        token?: {
          baseFee?: bigint
          tranche?: {
            unitFee?: bigint
            unitSize?: bigint
          }
        }
        native?: {
          baseFee?: bigint
          tranche?: {
            unitFee?: bigint
            unitSize?: bigint
          }
        }
      }
    }
    proofs?: {
      hyperlane_duration_seconds?: number
      metalayer_duration_seconds?: number
    }
    intentFundedRetries?: number
    intentFundedRetryDelayMs?: number
    defaultGasOverhead?: number
  }
>
export declare const CCTPConfigSchema: z.ZodObject<
  {
    apiUrl: z.ZodString
    chains: z.ZodArray<
      z.ZodObject<
        {
          chainId: z.ZodNumber
          domain: z.ZodNumber
          token: z.ZodString
          tokenMessenger: z.ZodString
          messageTransmitter: z.ZodString
        },
        'strip',
        z.ZodTypeAny,
        {
          token?: string
          chainId?: number
          domain?: number
          tokenMessenger?: string
          messageTransmitter?: string
        },
        {
          token?: string
          chainId?: number
          domain?: number
          tokenMessenger?: string
          messageTransmitter?: string
        }
      >,
      'many'
    >
  },
  'strip',
  z.ZodTypeAny,
  {
    apiUrl?: string
    chains?: {
      token?: string
      chainId?: number
      domain?: number
      tokenMessenger?: string
      messageTransmitter?: string
    }[]
  },
  {
    apiUrl?: string
    chains?: {
      token?: string
      chainId?: number
      domain?: number
      tokenMessenger?: string
      messageTransmitter?: string
    }[]
  }
>
export declare const EcoSolverDatabaseConfigSchema: z.ZodObject<
  {
    auth: z.ZodObject<
      {
        enabled: z.ZodBoolean
        username: z.ZodString
        password: z.ZodString
        type: z.ZodString
      },
      'strip',
      z.ZodTypeAny,
      {
        type?: string
        enabled?: boolean
        username?: string
        password?: string
      },
      {
        type?: string
        enabled?: boolean
        username?: string
        password?: string
      }
    >
    uriPrefix: z.ZodString
    uri: z.ZodString
    dbName: z.ZodString
    enableJournaling: z.ZodBoolean
  },
  'strip',
  z.ZodTypeAny,
  {
    auth?: {
      type?: string
      enabled?: boolean
      username?: string
      password?: string
    }
    uriPrefix?: string
    uri?: string
    dbName?: string
    enableJournaling?: boolean
  },
  {
    auth?: {
      type?: string
      enabled?: boolean
      username?: string
      password?: string
    }
    uriPrefix?: string
    uri?: string
    dbName?: string
    enableJournaling?: boolean
  }
>
export declare const EcoSolverConfigSchema: z.ZodObject<
  {
    server: z.ZodOptional<
      z.ZodObject<
        {
          url: z.ZodOptional<z.ZodString>
          port: z.ZodOptional<z.ZodNumber>
          host: z.ZodOptional<z.ZodDefault<z.ZodString>>
          enableHttps: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>
          requestTimeout: z.ZodOptional<z.ZodDefault<z.ZodNumber>>
        },
        'strip',
        z.ZodTypeAny,
        {
          url?: string
          port?: number
          host?: string
          enableHttps?: boolean
          requestTimeout?: number
        },
        {
          url?: string
          port?: number
          host?: string
          enableHttps?: boolean
          requestTimeout?: number
        }
      >
    >
    aws: z.ZodOptional<
      z.ZodArray<
        z.ZodObject<
          {
            region: z.ZodString
            accessKeyId: z.ZodOptional<z.ZodString>
            secretAccessKey: z.ZodOptional<z.ZodString>
            secretID: z.ZodOptional<z.ZodString>
            secretsManager: z.ZodOptional<
              z.ZodObject<
                {
                  enabled: z.ZodDefault<z.ZodBoolean>
                  secrets: z.ZodDefault<z.ZodArray<z.ZodString, 'many'>>
                },
                'strip',
                z.ZodTypeAny,
                {
                  enabled?: boolean
                  secrets?: string[]
                },
                {
                  enabled?: boolean
                  secrets?: string[]
                }
              >
            >
          },
          'strip',
          z.ZodTypeAny,
          {
            region?: string
            accessKeyId?: string
            secretAccessKey?: string
            secretID?: string
            secretsManager?: {
              enabled?: boolean
              secrets?: string[]
            }
          },
          {
            region?: string
            accessKeyId?: string
            secretAccessKey?: string
            secretID?: string
            secretsManager?: {
              enabled?: boolean
              secrets?: string[]
            }
          }
        >,
        'many'
      >
    >
    cache: z.ZodOptional<
      z.ZodObject<
        {
          ttl: z.ZodDefault<z.ZodNumber>
          max: z.ZodOptional<z.ZodDefault<z.ZodNumber>>
        },
        'strip',
        z.ZodTypeAny,
        {
          ttl?: number
          max?: number
        },
        {
          ttl?: number
          max?: number
        }
      >
    >
    database: z.ZodOptional<
      z.ZodObject<
        {
          auth: z.ZodObject<
            {
              enabled: z.ZodBoolean
              username: z.ZodString
              password: z.ZodString
              type: z.ZodString
            },
            'strip',
            z.ZodTypeAny,
            {
              type?: string
              enabled?: boolean
              username?: string
              password?: string
            },
            {
              type?: string
              enabled?: boolean
              username?: string
              password?: string
            }
          >
          uriPrefix: z.ZodString
          uri: z.ZodString
          dbName: z.ZodString
          enableJournaling: z.ZodBoolean
        },
        'strip',
        z.ZodTypeAny,
        {
          auth?: {
            type?: string
            enabled?: boolean
            username?: string
            password?: string
          }
          uriPrefix?: string
          uri?: string
          dbName?: string
          enableJournaling?: boolean
        },
        {
          auth?: {
            type?: string
            enabled?: boolean
            username?: string
            password?: string
          }
          uriPrefix?: string
          uri?: string
          dbName?: string
          enableJournaling?: boolean
        }
      >
    >
    solvers: z.ZodOptional<
      z.ZodRecord<
        z.ZodNumber,
        z.ZodObject<
          {
            chainID: z.ZodNumber
            inboxAddress: z.ZodOptional<z.ZodString>
            network: z.ZodString
            targets: z.ZodRecord<
              z.ZodString,
              z.ZodObject<
                {
                  contractType: z.ZodEnum<['erc20', 'erc721', 'erc1155']>
                  selectors: z.ZodArray<z.ZodString, 'many'>
                  minBalance: z.ZodNumber
                  targetBalance: z.ZodOptional<z.ZodNumber>
                },
                'strip',
                z.ZodTypeAny,
                {
                  contractType?: 'erc20' | 'erc721' | 'erc1155'
                  selectors?: string[]
                  minBalance?: number
                  targetBalance?: number
                },
                {
                  contractType?: 'erc20' | 'erc721' | 'erc1155'
                  selectors?: string[]
                  minBalance?: number
                  targetBalance?: number
                }
              >
            >
            fee: z.ZodOptional<
              z.ZodObject<
                {
                  limit: z.ZodObject<
                    {
                      tokenBase6: z.ZodBigInt
                      nativeBase18: z.ZodBigInt
                    },
                    'strip',
                    z.ZodTypeAny,
                    {
                      tokenBase6?: bigint
                      nativeBase18?: bigint
                    },
                    {
                      tokenBase6?: bigint
                      nativeBase18?: bigint
                    }
                  >
                  algorithm: z.ZodEnum<['linear', 'quadratic']>
                  constants: z.ZodAny
                },
                'strip',
                z.ZodTypeAny,
                {
                  limit?: {
                    tokenBase6?: bigint
                    nativeBase18?: bigint
                  }
                  algorithm?: 'linear' | 'quadratic'
                  constants?: any
                },
                {
                  limit?: {
                    tokenBase6?: bigint
                    nativeBase18?: bigint
                  }
                  algorithm?: 'linear' | 'quadratic'
                  constants?: any
                }
              >
            >
            averageBlockTime: z.ZodNumber
            gasOverhead: z.ZodOptional<z.ZodNumber>
          },
          'strip',
          z.ZodTypeAny,
          {
            chainID?: number
            inboxAddress?: string
            network?: string
            targets?: Record<
              string,
              {
                contractType?: 'erc20' | 'erc721' | 'erc1155'
                selectors?: string[]
                minBalance?: number
                targetBalance?: number
              }
            >
            fee?: {
              limit?: {
                tokenBase6?: bigint
                nativeBase18?: bigint
              }
              algorithm?: 'linear' | 'quadratic'
              constants?: any
            }
            averageBlockTime?: number
            gasOverhead?: number
          },
          {
            chainID?: number
            inboxAddress?: string
            network?: string
            targets?: Record<
              string,
              {
                contractType?: 'erc20' | 'erc721' | 'erc1155'
                selectors?: string[]
                minBalance?: number
                targetBalance?: number
              }
            >
            fee?: {
              limit?: {
                tokenBase6?: bigint
                nativeBase18?: bigint
              }
              algorithm?: 'linear' | 'quadratic'
              constants?: any
            }
            averageBlockTime?: number
            gasOverhead?: number
          }
        >
      >
    >
    intentSources: z.ZodOptional<
      z.ZodArray<
        z.ZodObject<
          {
            network: z.ZodString
            chainID: z.ZodNumber
            sourceAddress: z.ZodOptional<z.ZodString>
            inbox: z.ZodOptional<z.ZodString>
            tokens: z.ZodArray<z.ZodString, 'many'>
            provers: z.ZodOptional<z.ZodArray<z.ZodString, 'many'>>
            config: z.ZodOptional<
              z.ZodObject<
                {
                  ecoRoutes: z.ZodEnum<['append', 'replace']>
                },
                'strip',
                z.ZodTypeAny,
                {
                  ecoRoutes?: 'append' | 'replace'
                },
                {
                  ecoRoutes?: 'append' | 'replace'
                }
              >
            >
          },
          'strip',
          z.ZodTypeAny,
          {
            chainID?: number
            network?: string
            sourceAddress?: string
            inbox?: string
            tokens?: string[]
            provers?: string[]
            config?: {
              ecoRoutes?: 'append' | 'replace'
            }
          },
          {
            chainID?: number
            network?: string
            sourceAddress?: string
            inbox?: string
            tokens?: string[]
            provers?: string[]
            config?: {
              ecoRoutes?: 'append' | 'replace'
            }
          }
        >,
        'many'
      >
    >
    rpcs: z.ZodOptional<
      z.ZodObject<
        {
          keys: z.ZodRecord<z.ZodString, z.ZodString>
          config: z.ZodOptional<
            z.ZodObject<
              {
                webSockets: z.ZodOptional<z.ZodBoolean>
              },
              'strip',
              z.ZodTypeAny,
              {
                webSockets?: boolean
              },
              {
                webSockets?: boolean
              }
            >
          >
          custom: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>
        },
        'strip',
        z.ZodTypeAny,
        {
          keys?: Record<string, string>
          custom?: Record<string, any>
          config?: {
            webSockets?: boolean
          }
        },
        {
          keys?: Record<string, string>
          custom?: Record<string, any>
          config?: {
            webSockets?: boolean
          }
        }
      >
    >
    redis: z.ZodOptional<
      z.ZodObject<
        {
          connection: z.ZodOptional<
            z.ZodObject<
              {
                host: z.ZodString
                port: z.ZodNumber
              },
              'strip',
              z.ZodTypeAny,
              {
                port?: number
                host?: string
              },
              {
                port?: number
                host?: string
              }
            >
          >
          options: z.ZodOptional<
            z.ZodObject<
              {
                single: z.ZodOptional<
                  z.ZodObject<
                    {
                      autoResubscribe: z.ZodBoolean
                      autoResendUnfulfilledCommands: z.ZodBoolean
                      tls: z.ZodRecord<z.ZodString, z.ZodAny>
                    },
                    'strip',
                    z.ZodTypeAny,
                    {
                      autoResubscribe?: boolean
                      autoResendUnfulfilledCommands?: boolean
                      tls?: Record<string, any>
                    },
                    {
                      autoResubscribe?: boolean
                      autoResendUnfulfilledCommands?: boolean
                      tls?: Record<string, any>
                    }
                  >
                >
                cluster: z.ZodOptional<
                  z.ZodObject<
                    {
                      enableReadyCheck: z.ZodBoolean
                      retryDelayOnClusterDown: z.ZodNumber
                      retryDelayOnFailover: z.ZodNumber
                      retryDelayOnTryAgain: z.ZodNumber
                      slotsRefreshTimeout: z.ZodNumber
                      clusterRetryStrategy: z.ZodFunction<
                        z.ZodTuple<[z.ZodNumber], z.ZodUnknown>,
                        z.ZodNumber
                      >
                      dnsLookup: z.ZodFunction<z.ZodTuple<[], z.ZodUnknown>, z.ZodUnknown>
                    },
                    'strip',
                    z.ZodTypeAny,
                    {
                      enableReadyCheck?: boolean
                      retryDelayOnClusterDown?: number
                      retryDelayOnFailover?: number
                      retryDelayOnTryAgain?: number
                      slotsRefreshTimeout?: number
                      clusterRetryStrategy?: (args_0: number, ...args: unknown[]) => number
                      dnsLookup?: (...args: unknown[]) => unknown
                    },
                    {
                      enableReadyCheck?: boolean
                      retryDelayOnClusterDown?: number
                      retryDelayOnFailover?: number
                      retryDelayOnTryAgain?: number
                      slotsRefreshTimeout?: number
                      clusterRetryStrategy?: (args_0: number, ...args: unknown[]) => number
                      dnsLookup?: (...args: unknown[]) => unknown
                    }
                  >
                >
              },
              'strip',
              z.ZodTypeAny,
              {
                single?: {
                  autoResubscribe?: boolean
                  autoResendUnfulfilledCommands?: boolean
                  tls?: Record<string, any>
                }
                cluster?: {
                  enableReadyCheck?: boolean
                  retryDelayOnClusterDown?: number
                  retryDelayOnFailover?: number
                  retryDelayOnTryAgain?: number
                  slotsRefreshTimeout?: number
                  clusterRetryStrategy?: (args_0: number, ...args: unknown[]) => number
                  dnsLookup?: (...args: unknown[]) => unknown
                }
              },
              {
                single?: {
                  autoResubscribe?: boolean
                  autoResendUnfulfilledCommands?: boolean
                  tls?: Record<string, any>
                }
                cluster?: {
                  enableReadyCheck?: boolean
                  retryDelayOnClusterDown?: number
                  retryDelayOnFailover?: number
                  retryDelayOnTryAgain?: number
                  slotsRefreshTimeout?: number
                  clusterRetryStrategy?: (args_0: number, ...args: unknown[]) => number
                  dnsLookup?: (...args: unknown[]) => unknown
                }
              }
            >
          >
          redlockSettings: z.ZodOptional<
            z.ZodObject<
              {
                driftFactor: z.ZodNumber
                retryCount: z.ZodNumber
                retryDelay: z.ZodNumber
                retryJitter: z.ZodNumber
              },
              'strip',
              z.ZodTypeAny,
              {
                driftFactor?: number
                retryCount?: number
                retryDelay?: number
                retryJitter?: number
              },
              {
                driftFactor?: number
                retryCount?: number
                retryDelay?: number
                retryJitter?: number
              }
            >
          >
          jobs: z.ZodOptional<
            z.ZodObject<
              {
                intentJobConfig: z.ZodOptional<
                  z.ZodObject<
                    {
                      removeOnComplete: z.ZodBoolean
                      removeOnFail: z.ZodBoolean
                      attempts: z.ZodNumber
                      backoff: z.ZodObject<
                        {
                          type: z.ZodString
                          delay: z.ZodNumber
                        },
                        'strip',
                        z.ZodTypeAny,
                        {
                          type?: string
                          delay?: number
                        },
                        {
                          type?: string
                          delay?: number
                        }
                      >
                    },
                    'strip',
                    z.ZodTypeAny,
                    {
                      removeOnComplete?: boolean
                      removeOnFail?: boolean
                      attempts?: number
                      backoff?: {
                        type?: string
                        delay?: number
                      }
                    },
                    {
                      removeOnComplete?: boolean
                      removeOnFail?: boolean
                      attempts?: number
                      backoff?: {
                        type?: string
                        delay?: number
                      }
                    }
                  >
                >
                watchJobConfig: z.ZodOptional<
                  z.ZodObject<
                    {
                      removeOnComplete: z.ZodBoolean
                      removeOnFail: z.ZodBoolean
                      attempts: z.ZodNumber
                      backoff: z.ZodObject<
                        {
                          type: z.ZodString
                          delay: z.ZodNumber
                        },
                        'strip',
                        z.ZodTypeAny,
                        {
                          type?: string
                          delay?: number
                        },
                        {
                          type?: string
                          delay?: number
                        }
                      >
                    },
                    'strip',
                    z.ZodTypeAny,
                    {
                      removeOnComplete?: boolean
                      removeOnFail?: boolean
                      attempts?: number
                      backoff?: {
                        type?: string
                        delay?: number
                      }
                    },
                    {
                      removeOnComplete?: boolean
                      removeOnFail?: boolean
                      attempts?: number
                      backoff?: {
                        type?: string
                        delay?: number
                      }
                    }
                  >
                >
              },
              'strip',
              z.ZodTypeAny,
              {
                intentJobConfig?: {
                  removeOnComplete?: boolean
                  removeOnFail?: boolean
                  attempts?: number
                  backoff?: {
                    type?: string
                    delay?: number
                  }
                }
                watchJobConfig?: {
                  removeOnComplete?: boolean
                  removeOnFail?: boolean
                  attempts?: number
                  backoff?: {
                    type?: string
                    delay?: number
                  }
                }
              },
              {
                intentJobConfig?: {
                  removeOnComplete?: boolean
                  removeOnFail?: boolean
                  attempts?: number
                  backoff?: {
                    type?: string
                    delay?: number
                  }
                }
                watchJobConfig?: {
                  removeOnComplete?: boolean
                  removeOnFail?: boolean
                  attempts?: number
                  backoff?: {
                    type?: string
                    delay?: number
                  }
                }
              }
            >
          >
        },
        'strip',
        z.ZodTypeAny,
        {
          options?: {
            single?: {
              autoResubscribe?: boolean
              autoResendUnfulfilledCommands?: boolean
              tls?: Record<string, any>
            }
            cluster?: {
              enableReadyCheck?: boolean
              retryDelayOnClusterDown?: number
              retryDelayOnFailover?: number
              retryDelayOnTryAgain?: number
              slotsRefreshTimeout?: number
              clusterRetryStrategy?: (args_0: number, ...args: unknown[]) => number
              dnsLookup?: (...args: unknown[]) => unknown
            }
          }
          connection?: {
            port?: number
            host?: string
          }
          redlockSettings?: {
            driftFactor?: number
            retryCount?: number
            retryDelay?: number
            retryJitter?: number
          }
          jobs?: {
            intentJobConfig?: {
              removeOnComplete?: boolean
              removeOnFail?: boolean
              attempts?: number
              backoff?: {
                type?: string
                delay?: number
              }
            }
            watchJobConfig?: {
              removeOnComplete?: boolean
              removeOnFail?: boolean
              attempts?: number
              backoff?: {
                type?: string
                delay?: number
              }
            }
          }
        },
        {
          options?: {
            single?: {
              autoResubscribe?: boolean
              autoResendUnfulfilledCommands?: boolean
              tls?: Record<string, any>
            }
            cluster?: {
              enableReadyCheck?: boolean
              retryDelayOnClusterDown?: number
              retryDelayOnFailover?: number
              retryDelayOnTryAgain?: number
              slotsRefreshTimeout?: number
              clusterRetryStrategy?: (args_0: number, ...args: unknown[]) => number
              dnsLookup?: (...args: unknown[]) => unknown
            }
          }
          connection?: {
            port?: number
            host?: string
          }
          redlockSettings?: {
            driftFactor?: number
            retryCount?: number
            retryDelay?: number
            retryJitter?: number
          }
          jobs?: {
            intentJobConfig?: {
              removeOnComplete?: boolean
              removeOnFail?: boolean
              attempts?: number
              backoff?: {
                type?: string
                delay?: number
              }
            }
            watchJobConfig?: {
              removeOnComplete?: boolean
              removeOnFail?: boolean
              attempts?: number
              backoff?: {
                type?: string
                delay?: number
              }
            }
          }
        }
      >
    >
    intervals: z.ZodOptional<
      z.ZodObject<
        {
          retryInfeasableIntents: z.ZodOptional<
            z.ZodObject<
              {
                repeatOpts: z.ZodObject<
                  {
                    every: z.ZodNumber
                  },
                  'strip',
                  z.ZodTypeAny,
                  {
                    every?: number
                  },
                  {
                    every?: number
                  }
                >
                jobTemplate: z.ZodObject<
                  {
                    name: z.ZodString
                    data: z.ZodRecord<z.ZodString, z.ZodAny>
                  },
                  'strip',
                  z.ZodTypeAny,
                  {
                    name?: string
                    data?: Record<string, any>
                  },
                  {
                    name?: string
                    data?: Record<string, any>
                  }
                >
              },
              'strip',
              z.ZodTypeAny,
              {
                repeatOpts?: {
                  every?: number
                }
                jobTemplate?: {
                  name?: string
                  data?: Record<string, any>
                }
              },
              {
                repeatOpts?: {
                  every?: number
                }
                jobTemplate?: {
                  name?: string
                  data?: Record<string, any>
                }
              }
            >
          >
          defaults: z.ZodOptional<
            z.ZodObject<
              {
                repeatOpts: z.ZodObject<
                  {
                    every: z.ZodNumber
                  },
                  'strip',
                  z.ZodTypeAny,
                  {
                    every?: number
                  },
                  {
                    every?: number
                  }
                >
                jobTemplate: z.ZodObject<
                  {
                    name: z.ZodString
                    data: z.ZodRecord<z.ZodString, z.ZodAny>
                    opts: z.ZodObject<
                      {
                        removeOnComplete: z.ZodBoolean
                        removeOnFail: z.ZodBoolean
                        attempts: z.ZodNumber
                        backoff: z.ZodObject<
                          {
                            type: z.ZodString
                            delay: z.ZodNumber
                          },
                          'strip',
                          z.ZodTypeAny,
                          {
                            type?: string
                            delay?: number
                          },
                          {
                            type?: string
                            delay?: number
                          }
                        >
                      },
                      'strip',
                      z.ZodTypeAny,
                      {
                        removeOnComplete?: boolean
                        removeOnFail?: boolean
                        attempts?: number
                        backoff?: {
                          type?: string
                          delay?: number
                        }
                      },
                      {
                        removeOnComplete?: boolean
                        removeOnFail?: boolean
                        attempts?: number
                        backoff?: {
                          type?: string
                          delay?: number
                        }
                      }
                    >
                  },
                  'strip',
                  z.ZodTypeAny,
                  {
                    name?: string
                    data?: Record<string, any>
                    opts?: {
                      removeOnComplete?: boolean
                      removeOnFail?: boolean
                      attempts?: number
                      backoff?: {
                        type?: string
                        delay?: number
                      }
                    }
                  },
                  {
                    name?: string
                    data?: Record<string, any>
                    opts?: {
                      removeOnComplete?: boolean
                      removeOnFail?: boolean
                      attempts?: number
                      backoff?: {
                        type?: string
                        delay?: number
                      }
                    }
                  }
                >
              },
              'strip',
              z.ZodTypeAny,
              {
                repeatOpts?: {
                  every?: number
                }
                jobTemplate?: {
                  name?: string
                  data?: Record<string, any>
                  opts?: {
                    removeOnComplete?: boolean
                    removeOnFail?: boolean
                    attempts?: number
                    backoff?: {
                      type?: string
                      delay?: number
                    }
                  }
                }
              },
              {
                repeatOpts?: {
                  every?: number
                }
                jobTemplate?: {
                  name?: string
                  data?: Record<string, any>
                  opts?: {
                    removeOnComplete?: boolean
                    removeOnFail?: boolean
                    attempts?: number
                    backoff?: {
                      type?: string
                      delay?: number
                    }
                  }
                }
              }
            >
          >
        },
        'strip',
        z.ZodTypeAny,
        {
          retryInfeasableIntents?: {
            repeatOpts?: {
              every?: number
            }
            jobTemplate?: {
              name?: string
              data?: Record<string, any>
            }
          }
          defaults?: {
            repeatOpts?: {
              every?: number
            }
            jobTemplate?: {
              name?: string
              data?: Record<string, any>
              opts?: {
                removeOnComplete?: boolean
                removeOnFail?: boolean
                attempts?: number
                backoff?: {
                  type?: string
                  delay?: number
                }
              }
            }
          }
        },
        {
          retryInfeasableIntents?: {
            repeatOpts?: {
              every?: number
            }
            jobTemplate?: {
              name?: string
              data?: Record<string, any>
            }
          }
          defaults?: {
            repeatOpts?: {
              every?: number
            }
            jobTemplate?: {
              name?: string
              data?: Record<string, any>
              opts?: {
                removeOnComplete?: boolean
                removeOnFail?: boolean
                attempts?: number
                backoff?: {
                  type?: string
                  delay?: number
                }
              }
            }
          }
        }
      >
    >
    logger: z.ZodOptional<
      z.ZodObject<
        {
          usePino: z.ZodBoolean
          pinoConfig: z.ZodOptional<
            z.ZodObject<
              {
                pinoHttp: z.ZodObject<
                  {
                    level: z.ZodString
                    useLevelLabels: z.ZodBoolean
                    redact: z.ZodObject<
                      {
                        paths: z.ZodArray<z.ZodString, 'many'>
                        remove: z.ZodBoolean
                      },
                      'strip',
                      z.ZodTypeAny,
                      {
                        paths?: string[]
                        remove?: boolean
                      },
                      {
                        paths?: string[]
                        remove?: boolean
                      }
                    >
                  },
                  'strip',
                  z.ZodTypeAny,
                  {
                    level?: string
                    useLevelLabels?: boolean
                    redact?: {
                      paths?: string[]
                      remove?: boolean
                    }
                  },
                  {
                    level?: string
                    useLevelLabels?: boolean
                    redact?: {
                      paths?: string[]
                      remove?: boolean
                    }
                  }
                >
              },
              'strip',
              z.ZodTypeAny,
              {
                pinoHttp?: {
                  level?: string
                  useLevelLabels?: boolean
                  redact?: {
                    paths?: string[]
                    remove?: boolean
                  }
                }
              },
              {
                pinoHttp?: {
                  level?: string
                  useLevelLabels?: boolean
                  redact?: {
                    paths?: string[]
                    remove?: boolean
                  }
                }
              }
            >
          >
        },
        'strip',
        z.ZodTypeAny,
        {
          usePino?: boolean
          pinoConfig?: {
            pinoHttp?: {
              level?: string
              useLevelLabels?: boolean
              redact?: {
                paths?: string[]
                remove?: boolean
              }
            }
          }
        },
        {
          usePino?: boolean
          pinoConfig?: {
            pinoHttp?: {
              level?: string
              useLevelLabels?: boolean
              redact?: {
                paths?: string[]
                remove?: boolean
              }
            }
          }
        }
      >
    >
    intentConfigs: z.ZodOptional<
      z.ZodObject<
        {
          defaultFee: z.ZodObject<
            {
              limit: z.ZodObject<
                {
                  tokenBase6: z.ZodBigInt
                  nativeBase18: z.ZodBigInt
                },
                'strip',
                z.ZodTypeAny,
                {
                  tokenBase6?: bigint
                  nativeBase18?: bigint
                },
                {
                  tokenBase6?: bigint
                  nativeBase18?: bigint
                }
              >
              algorithm: z.ZodEnum<['linear', 'quadratic']>
              constants: z.ZodObject<
                {
                  token: z.ZodObject<
                    {
                      baseFee: z.ZodBigInt
                      tranche: z.ZodObject<
                        {
                          unitFee: z.ZodBigInt
                          unitSize: z.ZodBigInt
                        },
                        'strip',
                        z.ZodTypeAny,
                        {
                          unitFee?: bigint
                          unitSize?: bigint
                        },
                        {
                          unitFee?: bigint
                          unitSize?: bigint
                        }
                      >
                    },
                    'strip',
                    z.ZodTypeAny,
                    {
                      baseFee?: bigint
                      tranche?: {
                        unitFee?: bigint
                        unitSize?: bigint
                      }
                    },
                    {
                      baseFee?: bigint
                      tranche?: {
                        unitFee?: bigint
                        unitSize?: bigint
                      }
                    }
                  >
                  native: z.ZodObject<
                    {
                      baseFee: z.ZodBigInt
                      tranche: z.ZodObject<
                        {
                          unitFee: z.ZodBigInt
                          unitSize: z.ZodBigInt
                        },
                        'strip',
                        z.ZodTypeAny,
                        {
                          unitFee?: bigint
                          unitSize?: bigint
                        },
                        {
                          unitFee?: bigint
                          unitSize?: bigint
                        }
                      >
                    },
                    'strip',
                    z.ZodTypeAny,
                    {
                      baseFee?: bigint
                      tranche?: {
                        unitFee?: bigint
                        unitSize?: bigint
                      }
                    },
                    {
                      baseFee?: bigint
                      tranche?: {
                        unitFee?: bigint
                        unitSize?: bigint
                      }
                    }
                  >
                },
                'strip',
                z.ZodTypeAny,
                {
                  token?: {
                    baseFee?: bigint
                    tranche?: {
                      unitFee?: bigint
                      unitSize?: bigint
                    }
                  }
                  native?: {
                    baseFee?: bigint
                    tranche?: {
                      unitFee?: bigint
                      unitSize?: bigint
                    }
                  }
                },
                {
                  token?: {
                    baseFee?: bigint
                    tranche?: {
                      unitFee?: bigint
                      unitSize?: bigint
                    }
                  }
                  native?: {
                    baseFee?: bigint
                    tranche?: {
                      unitFee?: bigint
                      unitSize?: bigint
                    }
                  }
                }
              >
            },
            'strip',
            z.ZodTypeAny,
            {
              limit?: {
                tokenBase6?: bigint
                nativeBase18?: bigint
              }
              algorithm?: 'linear' | 'quadratic'
              constants?: {
                token?: {
                  baseFee?: bigint
                  tranche?: {
                    unitFee?: bigint
                    unitSize?: bigint
                  }
                }
                native?: {
                  baseFee?: bigint
                  tranche?: {
                    unitFee?: bigint
                    unitSize?: bigint
                  }
                }
              }
            },
            {
              limit?: {
                tokenBase6?: bigint
                nativeBase18?: bigint
              }
              algorithm?: 'linear' | 'quadratic'
              constants?: {
                token?: {
                  baseFee?: bigint
                  tranche?: {
                    unitFee?: bigint
                    unitSize?: bigint
                  }
                }
                native?: {
                  baseFee?: bigint
                  tranche?: {
                    unitFee?: bigint
                    unitSize?: bigint
                  }
                }
              }
            }
          >
          proofs: z.ZodObject<
            {
              hyperlane_duration_seconds: z.ZodNumber
              metalayer_duration_seconds: z.ZodNumber
            },
            'strip',
            z.ZodTypeAny,
            {
              hyperlane_duration_seconds?: number
              metalayer_duration_seconds?: number
            },
            {
              hyperlane_duration_seconds?: number
              metalayer_duration_seconds?: number
            }
          >
          intentFundedRetries: z.ZodNumber
          intentFundedRetryDelayMs: z.ZodNumber
          defaultGasOverhead: z.ZodNumber
        },
        'strip',
        z.ZodTypeAny,
        {
          defaultFee?: {
            limit?: {
              tokenBase6?: bigint
              nativeBase18?: bigint
            }
            algorithm?: 'linear' | 'quadratic'
            constants?: {
              token?: {
                baseFee?: bigint
                tranche?: {
                  unitFee?: bigint
                  unitSize?: bigint
                }
              }
              native?: {
                baseFee?: bigint
                tranche?: {
                  unitFee?: bigint
                  unitSize?: bigint
                }
              }
            }
          }
          proofs?: {
            hyperlane_duration_seconds?: number
            metalayer_duration_seconds?: number
          }
          intentFundedRetries?: number
          intentFundedRetryDelayMs?: number
          defaultGasOverhead?: number
        },
        {
          defaultFee?: {
            limit?: {
              tokenBase6?: bigint
              nativeBase18?: bigint
            }
            algorithm?: 'linear' | 'quadratic'
            constants?: {
              token?: {
                baseFee?: bigint
                tranche?: {
                  unitFee?: bigint
                  unitSize?: bigint
                }
              }
              native?: {
                baseFee?: bigint
                tranche?: {
                  unitFee?: bigint
                  unitSize?: bigint
                }
              }
            }
          }
          proofs?: {
            hyperlane_duration_seconds?: number
            metalayer_duration_seconds?: number
          }
          intentFundedRetries?: number
          intentFundedRetryDelayMs?: number
          defaultGasOverhead?: number
        }
      >
    >
    fulfill: z.ZodOptional<z.ZodAny>
    kms: z.ZodOptional<z.ZodAny>
    safe: z.ZodOptional<z.ZodAny>
    launchDarkly: z.ZodOptional<z.ZodAny>
    analytics: z.ZodOptional<z.ZodAny>
    eth: z.ZodOptional<z.ZodAny>
    CCTP: z.ZodOptional<
      z.ZodObject<
        {
          apiUrl: z.ZodString
          chains: z.ZodArray<
            z.ZodObject<
              {
                chainId: z.ZodNumber
                domain: z.ZodNumber
                token: z.ZodString
                tokenMessenger: z.ZodString
                messageTransmitter: z.ZodString
              },
              'strip',
              z.ZodTypeAny,
              {
                token?: string
                chainId?: number
                domain?: number
                tokenMessenger?: string
                messageTransmitter?: string
              },
              {
                token?: string
                chainId?: number
                domain?: number
                tokenMessenger?: string
                messageTransmitter?: string
              }
            >,
            'many'
          >
        },
        'strip',
        z.ZodTypeAny,
        {
          apiUrl?: string
          chains?: {
            token?: string
            chainId?: number
            domain?: number
            tokenMessenger?: string
            messageTransmitter?: string
          }[]
        },
        {
          apiUrl?: string
          chains?: {
            token?: string
            chainId?: number
            domain?: number
            tokenMessenger?: string
            messageTransmitter?: string
          }[]
        }
      >
    >
    CCTPV2: z.ZodOptional<
      z.ZodObject<
        {
          apiUrl: z.ZodString
          chains: z.ZodArray<
            z.ZodObject<
              {
                chainId: z.ZodNumber
                domain: z.ZodNumber
                token: z.ZodString
                tokenMessenger: z.ZodString
                messageTransmitter: z.ZodString
              },
              'strip',
              z.ZodTypeAny,
              {
                token?: string
                chainId?: number
                domain?: number
                tokenMessenger?: string
                messageTransmitter?: string
              },
              {
                token?: string
                chainId?: number
                domain?: number
                tokenMessenger?: string
                messageTransmitter?: string
              }
            >,
            'many'
          >
        },
        'strip',
        z.ZodTypeAny,
        {
          apiUrl?: string
          chains?: {
            token?: string
            chainId?: number
            domain?: number
            tokenMessenger?: string
            messageTransmitter?: string
          }[]
        },
        {
          apiUrl?: string
          chains?: {
            token?: string
            chainId?: number
            domain?: number
            tokenMessenger?: string
            messageTransmitter?: string
          }[]
        }
      >
    >
    hyperlane: z.ZodOptional<
      z.ZodObject<
        {
          useHyperlaneDefaultHook: z.ZodBoolean
        },
        'strip',
        z.ZodTypeAny,
        {
          useHyperlaneDefaultHook?: boolean
        },
        {
          useHyperlaneDefaultHook?: boolean
        }
      >
    >
    quotesConfig: z.ZodOptional<
      z.ZodObject<
        {
          intentExecutionTypes: z.ZodArray<z.ZodString, 'many'>
        },
        'strip',
        z.ZodTypeAny,
        {
          intentExecutionTypes?: string[]
        },
        {
          intentExecutionTypes?: string[]
        }
      >
    >
    gaslessIntentdAppIDs: z.ZodOptional<z.ZodArray<z.ZodString, 'many'>>
    whitelist: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>
    fulfillmentEstimate: z.ZodOptional<
      z.ZodObject<
        {
          executionPaddingSeconds: z.ZodNumber
          blockTimePercentile: z.ZodNumber
          defaultBlockTime: z.ZodNumber
        },
        'strip',
        z.ZodTypeAny,
        {
          executionPaddingSeconds?: number
          blockTimePercentile?: number
          defaultBlockTime?: number
        },
        {
          executionPaddingSeconds?: number
          blockTimePercentile?: number
          defaultBlockTime?: number
        }
      >
    >
    gasEstimations: z.ZodOptional<
      z.ZodObject<
        {
          fundFor: z.ZodBigInt
          permit: z.ZodBigInt
          permit2: z.ZodBigInt
          defaultGasPriceGwei: z.ZodString
        },
        'strip',
        z.ZodTypeAny,
        {
          fundFor?: bigint
          permit?: bigint
          permit2?: bigint
          defaultGasPriceGwei?: string
        },
        {
          fundFor?: bigint
          permit?: bigint
          permit2?: bigint
          defaultGasPriceGwei?: string
        }
      >
    >
    indexer: z.ZodOptional<
      z.ZodObject<
        {
          url: z.ZodString
        },
        'strip',
        z.ZodTypeAny,
        {
          url?: string
        },
        {
          url?: string
        }
      >
    >
    withdraws: z.ZodOptional<
      z.ZodObject<
        {
          chunkSize: z.ZodNumber
          intervalDuration: z.ZodNumber
        },
        'strip',
        z.ZodTypeAny,
        {
          chunkSize?: number
          intervalDuration?: number
        },
        {
          chunkSize?: number
          intervalDuration?: number
        }
      >
    >
    sendBatch: z.ZodOptional<
      z.ZodObject<
        {
          chunkSize: z.ZodNumber
          intervalDuration: z.ZodNumber
          defaultGasPerIntent: z.ZodNumber
        },
        'strip',
        z.ZodTypeAny,
        {
          chunkSize?: number
          intervalDuration?: number
          defaultGasPerIntent?: number
        },
        {
          chunkSize?: number
          intervalDuration?: number
          defaultGasPerIntent?: number
        }
      >
    >
    externalAPIs: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>
    squid: z.ZodOptional<
      z.ZodObject<
        {
          baseUrl: z.ZodString
        },
        'strip',
        z.ZodTypeAny,
        {
          baseUrl?: string
        },
        {
          baseUrl?: string
        }
      >
    >
    everclear: z.ZodOptional<
      z.ZodObject<
        {
          baseUrl: z.ZodString
        },
        'strip',
        z.ZodTypeAny,
        {
          baseUrl?: string
        },
        {
          baseUrl?: string
        }
      >
    >
    solverRegistrationConfig: z.ZodOptional<
      z.ZodObject<
        {
          apiOptions: z.ZodObject<
            {
              baseUrl: z.ZodString
            },
            'strip',
            z.ZodTypeAny,
            {
              baseUrl?: string
            },
            {
              baseUrl?: string
            }
          >
        },
        'strip',
        z.ZodTypeAny,
        {
          apiOptions?: {
            baseUrl?: string
          }
        },
        {
          apiOptions?: {
            baseUrl?: string
          }
        }
      >
    >
  },
  'strip',
  z.ZodTypeAny,
  {
    database?: {
      auth?: {
        type?: string
        enabled?: boolean
        username?: string
        password?: string
      }
      uriPrefix?: string
      uri?: string
      dbName?: string
      enableJournaling?: boolean
    }
    server?: {
      url?: string
      port?: number
      host?: string
      enableHttps?: boolean
      requestTimeout?: number
    }
    aws?: {
      region?: string
      accessKeyId?: string
      secretAccessKey?: string
      secretID?: string
      secretsManager?: {
        enabled?: boolean
        secrets?: string[]
      }
    }[]
    cache?: {
      ttl?: number
      max?: number
    }
    solvers?: Record<
      number,
      {
        chainID?: number
        inboxAddress?: string
        network?: string
        targets?: Record<
          string,
          {
            contractType?: 'erc20' | 'erc721' | 'erc1155'
            selectors?: string[]
            minBalance?: number
            targetBalance?: number
          }
        >
        fee?: {
          limit?: {
            tokenBase6?: bigint
            nativeBase18?: bigint
          }
          algorithm?: 'linear' | 'quadratic'
          constants?: any
        }
        averageBlockTime?: number
        gasOverhead?: number
      }
    >
    intentSources?: {
      chainID?: number
      network?: string
      sourceAddress?: string
      inbox?: string
      tokens?: string[]
      provers?: string[]
      config?: {
        ecoRoutes?: 'append' | 'replace'
      }
    }[]
    rpcs?: {
      keys?: Record<string, string>
      custom?: Record<string, any>
      config?: {
        webSockets?: boolean
      }
    }
    redis?: {
      options?: {
        single?: {
          autoResubscribe?: boolean
          autoResendUnfulfilledCommands?: boolean
          tls?: Record<string, any>
        }
        cluster?: {
          enableReadyCheck?: boolean
          retryDelayOnClusterDown?: number
          retryDelayOnFailover?: number
          retryDelayOnTryAgain?: number
          slotsRefreshTimeout?: number
          clusterRetryStrategy?: (args_0: number, ...args: unknown[]) => number
          dnsLookup?: (...args: unknown[]) => unknown
        }
      }
      connection?: {
        port?: number
        host?: string
      }
      redlockSettings?: {
        driftFactor?: number
        retryCount?: number
        retryDelay?: number
        retryJitter?: number
      }
      jobs?: {
        intentJobConfig?: {
          removeOnComplete?: boolean
          removeOnFail?: boolean
          attempts?: number
          backoff?: {
            type?: string
            delay?: number
          }
        }
        watchJobConfig?: {
          removeOnComplete?: boolean
          removeOnFail?: boolean
          attempts?: number
          backoff?: {
            type?: string
            delay?: number
          }
        }
      }
    }
    intervals?: {
      retryInfeasableIntents?: {
        repeatOpts?: {
          every?: number
        }
        jobTemplate?: {
          name?: string
          data?: Record<string, any>
        }
      }
      defaults?: {
        repeatOpts?: {
          every?: number
        }
        jobTemplate?: {
          name?: string
          data?: Record<string, any>
          opts?: {
            removeOnComplete?: boolean
            removeOnFail?: boolean
            attempts?: number
            backoff?: {
              type?: string
              delay?: number
            }
          }
        }
      }
    }
    logger?: {
      usePino?: boolean
      pinoConfig?: {
        pinoHttp?: {
          level?: string
          useLevelLabels?: boolean
          redact?: {
            paths?: string[]
            remove?: boolean
          }
        }
      }
    }
    intentConfigs?: {
      defaultFee?: {
        limit?: {
          tokenBase6?: bigint
          nativeBase18?: bigint
        }
        algorithm?: 'linear' | 'quadratic'
        constants?: {
          token?: {
            baseFee?: bigint
            tranche?: {
              unitFee?: bigint
              unitSize?: bigint
            }
          }
          native?: {
            baseFee?: bigint
            tranche?: {
              unitFee?: bigint
              unitSize?: bigint
            }
          }
        }
      }
      proofs?: {
        hyperlane_duration_seconds?: number
        metalayer_duration_seconds?: number
      }
      intentFundedRetries?: number
      intentFundedRetryDelayMs?: number
      defaultGasOverhead?: number
    }
    fulfill?: any
    kms?: any
    safe?: any
    launchDarkly?: any
    analytics?: any
    eth?: any
    CCTP?: {
      apiUrl?: string
      chains?: {
        token?: string
        chainId?: number
        domain?: number
        tokenMessenger?: string
        messageTransmitter?: string
      }[]
    }
    CCTPV2?: {
      apiUrl?: string
      chains?: {
        token?: string
        chainId?: number
        domain?: number
        tokenMessenger?: string
        messageTransmitter?: string
      }[]
    }
    hyperlane?: {
      useHyperlaneDefaultHook?: boolean
    }
    quotesConfig?: {
      intentExecutionTypes?: string[]
    }
    gaslessIntentdAppIDs?: string[]
    whitelist?: Record<string, any>
    fulfillmentEstimate?: {
      executionPaddingSeconds?: number
      blockTimePercentile?: number
      defaultBlockTime?: number
    }
    gasEstimations?: {
      fundFor?: bigint
      permit?: bigint
      permit2?: bigint
      defaultGasPriceGwei?: string
    }
    indexer?: {
      url?: string
    }
    withdraws?: {
      chunkSize?: number
      intervalDuration?: number
    }
    sendBatch?: {
      chunkSize?: number
      intervalDuration?: number
      defaultGasPerIntent?: number
    }
    externalAPIs?: Record<string, any>
    squid?: {
      baseUrl?: string
    }
    everclear?: {
      baseUrl?: string
    }
    solverRegistrationConfig?: {
      apiOptions?: {
        baseUrl?: string
      }
    }
  },
  {
    database?: {
      auth?: {
        type?: string
        enabled?: boolean
        username?: string
        password?: string
      }
      uriPrefix?: string
      uri?: string
      dbName?: string
      enableJournaling?: boolean
    }
    server?: {
      url?: string
      port?: number
      host?: string
      enableHttps?: boolean
      requestTimeout?: number
    }
    aws?: {
      region?: string
      accessKeyId?: string
      secretAccessKey?: string
      secretID?: string
      secretsManager?: {
        enabled?: boolean
        secrets?: string[]
      }
    }[]
    cache?: {
      ttl?: number
      max?: number
    }
    solvers?: Record<
      number,
      {
        chainID?: number
        inboxAddress?: string
        network?: string
        targets?: Record<
          string,
          {
            contractType?: 'erc20' | 'erc721' | 'erc1155'
            selectors?: string[]
            minBalance?: number
            targetBalance?: number
          }
        >
        fee?: {
          limit?: {
            tokenBase6?: bigint
            nativeBase18?: bigint
          }
          algorithm?: 'linear' | 'quadratic'
          constants?: any
        }
        averageBlockTime?: number
        gasOverhead?: number
      }
    >
    intentSources?: {
      chainID?: number
      network?: string
      sourceAddress?: string
      inbox?: string
      tokens?: string[]
      provers?: string[]
      config?: {
        ecoRoutes?: 'append' | 'replace'
      }
    }[]
    rpcs?: {
      keys?: Record<string, string>
      custom?: Record<string, any>
      config?: {
        webSockets?: boolean
      }
    }
    redis?: {
      options?: {
        single?: {
          autoResubscribe?: boolean
          autoResendUnfulfilledCommands?: boolean
          tls?: Record<string, any>
        }
        cluster?: {
          enableReadyCheck?: boolean
          retryDelayOnClusterDown?: number
          retryDelayOnFailover?: number
          retryDelayOnTryAgain?: number
          slotsRefreshTimeout?: number
          clusterRetryStrategy?: (args_0: number, ...args: unknown[]) => number
          dnsLookup?: (...args: unknown[]) => unknown
        }
      }
      connection?: {
        port?: number
        host?: string
      }
      redlockSettings?: {
        driftFactor?: number
        retryCount?: number
        retryDelay?: number
        retryJitter?: number
      }
      jobs?: {
        intentJobConfig?: {
          removeOnComplete?: boolean
          removeOnFail?: boolean
          attempts?: number
          backoff?: {
            type?: string
            delay?: number
          }
        }
        watchJobConfig?: {
          removeOnComplete?: boolean
          removeOnFail?: boolean
          attempts?: number
          backoff?: {
            type?: string
            delay?: number
          }
        }
      }
    }
    intervals?: {
      retryInfeasableIntents?: {
        repeatOpts?: {
          every?: number
        }
        jobTemplate?: {
          name?: string
          data?: Record<string, any>
        }
      }
      defaults?: {
        repeatOpts?: {
          every?: number
        }
        jobTemplate?: {
          name?: string
          data?: Record<string, any>
          opts?: {
            removeOnComplete?: boolean
            removeOnFail?: boolean
            attempts?: number
            backoff?: {
              type?: string
              delay?: number
            }
          }
        }
      }
    }
    logger?: {
      usePino?: boolean
      pinoConfig?: {
        pinoHttp?: {
          level?: string
          useLevelLabels?: boolean
          redact?: {
            paths?: string[]
            remove?: boolean
          }
        }
      }
    }
    intentConfigs?: {
      defaultFee?: {
        limit?: {
          tokenBase6?: bigint
          nativeBase18?: bigint
        }
        algorithm?: 'linear' | 'quadratic'
        constants?: {
          token?: {
            baseFee?: bigint
            tranche?: {
              unitFee?: bigint
              unitSize?: bigint
            }
          }
          native?: {
            baseFee?: bigint
            tranche?: {
              unitFee?: bigint
              unitSize?: bigint
            }
          }
        }
      }
      proofs?: {
        hyperlane_duration_seconds?: number
        metalayer_duration_seconds?: number
      }
      intentFundedRetries?: number
      intentFundedRetryDelayMs?: number
      defaultGasOverhead?: number
    }
    fulfill?: any
    kms?: any
    safe?: any
    launchDarkly?: any
    analytics?: any
    eth?: any
    CCTP?: {
      apiUrl?: string
      chains?: {
        token?: string
        chainId?: number
        domain?: number
        tokenMessenger?: string
        messageTransmitter?: string
      }[]
    }
    CCTPV2?: {
      apiUrl?: string
      chains?: {
        token?: string
        chainId?: number
        domain?: number
        tokenMessenger?: string
        messageTransmitter?: string
      }[]
    }
    hyperlane?: {
      useHyperlaneDefaultHook?: boolean
    }
    quotesConfig?: {
      intentExecutionTypes?: string[]
    }
    gaslessIntentdAppIDs?: string[]
    whitelist?: Record<string, any>
    fulfillmentEstimate?: {
      executionPaddingSeconds?: number
      blockTimePercentile?: number
      defaultBlockTime?: number
    }
    gasEstimations?: {
      fundFor?: bigint
      permit?: bigint
      permit2?: bigint
      defaultGasPriceGwei?: string
    }
    indexer?: {
      url?: string
    }
    withdraws?: {
      chunkSize?: number
      intervalDuration?: number
    }
    sendBatch?: {
      chunkSize?: number
      intervalDuration?: number
      defaultGasPerIntent?: number
    }
    externalAPIs?: Record<string, any>
    squid?: {
      baseUrl?: string
    }
    everclear?: {
      baseUrl?: string
    }
    solverRegistrationConfig?: {
      apiOptions?: {
        baseUrl?: string
      }
    }
  }
>
export type EcoSolverConfigType = z.infer<typeof EcoSolverConfigSchema>
export type Solver = z.infer<typeof SolverConfigSchema>
export type IntentSource = z.infer<typeof IntentSourceSchema>
export type RpcConfig = z.infer<typeof RpcConfigSchema>
export type RedisConfig = z.infer<typeof RedisConfigSchema>
export type IntentConfig = z.infer<typeof IntentConfigSchema>
export type CCTPConfig = z.infer<typeof CCTPConfigSchema>
export type EcoSolverDatabaseConfig = z.infer<typeof EcoSolverDatabaseConfigSchema>
