import { decodeAbiParameters, decodeFunctionData, Hex, parseAbiParameters } from 'viem';

import { ecoAdapterAbi } from '@/common/abis/eco-adapter.abi';
import { rhinestoneRouterAbi } from '@/common/abis/rhinestone-router.abi';

import { ClaimData, FillData } from '../types/rhinestone-order.types';

const ROUTER_DIRECT_SELECTORS = {
  singleCall: '0x9280836c',
  multiCall: '0xac9650d8',
};

export function decodeRouterCall(data: Hex) {
  return decodeFunctionData({ abi: rhinestoneRouterAbi, data });
}

function isDirectRouterCall(adapterCalldata: Hex): boolean {
  const selector = adapterCalldata.slice(0, 10);
  return Object.values(ROUTER_DIRECT_SELECTORS).includes(selector);
}

/**
 * Decodes optimized arbiter params from eco_permit2_handleClaim_optimized
 *
 * The optimized format encodes (address predictedVault, Order order, Signatures sigs)
 * as raw bytes for gas savings. This function decodes those bytes back into the
 * structured ClaimData format.
 */
function decodeOptimizedArbiterParams(encodedParams: Hex): ClaimData {
  const handlePermit2Params = parseAbiParameters(
    'address predictedVault, (address sponsor, address recipient, uint256 nonce, uint256 expires, uint256 fillDeadline, uint256 notarizedChainId, uint256 targetChainId, uint256[2][] tokenIn, uint256[2][] tokenOut, uint256 packedGasValues, (bytes data) preClaimOps, (bytes data) targetOps, bytes qualifier) order, (bytes notarizedClaimSig, bytes preClaimSig) sigs',
  );

  const decoded = decodeAbiParameters(handlePermit2Params, encodedParams);

  const [predictedVault, order, userSigs] = decoded as [
    `0x${string}`,
    {
      sponsor: `0x${string}`;
      recipient: `0x${string}`;
      nonce: bigint;
      expires: bigint;
      fillDeadline: bigint;
      notarizedChainId: bigint;
      targetChainId: bigint;
      tokenIn: readonly [bigint, bigint][];
      tokenOut: readonly [bigint, bigint][];
      packedGasValues: bigint;
      preClaimOps: { data: `0x${string}` };
      targetOps: { data: `0x${string}` };
      qualifier: `0x${string}`;
    },
    {
      notarizedClaimSig: `0x${string}`;
      preClaimSig: `0x${string}`;
    },
  ];

  return {
    predictedVault,
    order: {
      sponsor: order.sponsor,
      recipient: order.recipient,
      nonce: order.nonce,
      expires: order.expires,
      fillDeadline: order.fillDeadline,
      notarizedChainId: order.notarizedChainId,
      targetChainId: order.targetChainId,
      tokenIn: order.tokenIn,
      tokenOut: order.tokenOut,
      packedGasValues: order.packedGasValues,
      preClaimOps: order.preClaimOps,
      targetOps: order.targetOps,
      qualifier: order.qualifier,
    },
    userSigs: {
      notarizedClaimSig: userSigs.notarizedClaimSig,
      preClaimSig: userSigs.preClaimSig,
    },
    elementIndex: 0n,
    otherElements: [],
    allocatorData: '0x',
  } as ClaimData;
}

export function decodeAdapterClaim(data: Hex): ClaimData {
  const routerDecoded = decodeFunctionData({
    abi: rhinestoneRouterAbi,
    data,
  });

  if (routerDecoded.functionName !== 'routeClaim') {
    throw new Error(`Expected routeClaim, got ${routerDecoded.functionName}`);
  }

  const adapterCalldatas = routerDecoded.args[1] as readonly Hex[];

  for (let i = 0; i < adapterCalldatas.length; i++) {
    const calldata = adapterCalldatas[i];

    if (isDirectRouterCall(calldata)) {
      continue;
    }

    try {
      const adapterDecoded = decodeFunctionData({
        abi: ecoAdapterAbi,
        data: calldata,
      });

      if (adapterDecoded.functionName === 'eco_compact_handleClaim') {
        return adapterDecoded.args[0] as ClaimData;
      }

      if (adapterDecoded.functionName === 'eco_permit2_handleClaim') {
        return adapterDecoded.args[0] as ClaimData;
      }

      if (adapterDecoded.functionName === 'eco_permit2_handleClaim_optimized') {
        const encodedParams = adapterDecoded.args[0] as Hex;
        return decodeOptimizedArbiterParams(encodedParams);
      }

      throw new Error(
        `Unknown adapter function: ${adapterDecoded.functionName}. ` +
          'Expected eco_compact_handleClaim, eco_permit2_handleClaim, or eco_permit2_handleClaim_optimized',
      );
    } catch (error) {
      continue;
    }
  }

  throw new Error(
    'No valid adapter calldata found. All calldatas were either direct router calls or failed to decode.',
  );
}

export function decodeAdapterFill(data: Hex): FillData {
  const routerDecoded = decodeFunctionData({
    abi: rhinestoneRouterAbi,
    data,
  });

  const adapterCalldatas = routerDecoded.args[1] as readonly Hex[];
  const adapterCallData = adapterCalldatas[0];

  const adapterDecoded = decodeFunctionData({
    abi: ecoAdapterAbi,
    data: adapterCallData,
  });

  if (adapterDecoded.functionName === 'eco_permit2_handleClaim_optimized') {
    return adapterDecoded.args[0] as FillData;
  }

  throw new Error(
    `Unknown adapter function: ${adapterDecoded.functionName}. Expected eco_permit2_handleClaim_optimized`,
  );
}
