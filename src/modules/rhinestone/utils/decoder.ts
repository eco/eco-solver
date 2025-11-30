import { decodeAbiParameters, decodeFunctionData, Hex, parseAbiParameters } from 'viem';

import { ecoAdapterAbi } from '@/common/abis/eco-adapter.abi';
import { rhinestoneRouterAbi } from '@/common/abis/rhinestone-router.abi';

import { ClaimData, FillData } from '../types/rhinestone-order.types';

import { isValidHexData } from './validation';

const ROUTER_DIRECT_SELECTORS = {
  singleCall: '0x9280836c',
  multiCall: '0xac9650d8',
  routeClaim: '0x0fbb12dc', // Nested routeClaim should be skipped
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

  const [predictedVault, order, userSigs] = decoded;

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
  };
}

export function decodeAdapterClaim(data: Hex): ClaimData {
  const routerDecoded = decodeFunctionData({
    abi: rhinestoneRouterAbi,
    data,
  });

  if (routerDecoded.functionName !== 'routeClaim') {
    throw new Error(`Expected routeClaim, got ${routerDecoded.functionName}`);
  }

  const adapterCalldatas = routerDecoded.args[1];

  for (let i = 0; i < adapterCalldatas.length; i++) {
    const calldata = adapterCalldatas[i];

    if (!isValidHexData(calldata) || isDirectRouterCall(calldata)) {
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

/**
 * Decodes ALL eco_handleFill calls from a batched Rhinestone fill transaction
 *
 * Rhinestone batches multiple eco_handleFill calls into a single router transaction.
 * This function extracts all of them, not just the first one.
 *
 * @param data - The fill transaction calldata (router.optimized_routeFill921336808)
 * @returns Array of FillData, one per batched eco_handleFill call
 */
export function decodeAdapterFills(data: Hex): FillData[] {
  const routerDecoded = decodeFunctionData({
    abi: rhinestoneRouterAbi,
    data,
  });

  const encodedAdapterCalldatas = routerDecoded.args[1] as Hex;

  const adapterCalldatasArray = decodeAbiParameters(
    parseAbiParameters('bytes[] adapterCalldatas'),
    encodedAdapterCalldatas,
  )[0];

  const fills: FillData[] = [];

  for (let i = 0; i < adapterCalldatasArray.length; i++) {
    const calldata = adapterCalldatasArray[i];

    if (!isValidHexData(calldata) || isDirectRouterCall(calldata)) {
      continue;
    }

    try {
      const adapterDecoded = decodeFunctionData({
        abi: ecoAdapterAbi,
        data: calldata,
      });

      if (adapterDecoded.functionName === 'eco_handleFill') {
        fills.push(adapterDecoded.args[0]);
      }
    } catch (error) {
      continue;
    }
  }

  if (fills.length === 0) {
    throw new Error(
      'No valid eco_handleFill calls found in batched transaction. All calldatas were either direct router calls or failed to decode.',
    );
  }

  return fills;
}

/**
 * Decodes the first eco_handleFill call from a Rhinestone fill transaction
 *
 * For backwards compatibility with single-claim flows.
 * For multiclaim support, use decodeAdapterFills() to get all batched fills.
 *
 * @param data - The fill transaction calldata
 * @returns First FillData from the batched transaction
 */
export function decodeAdapterFill(data: Hex): FillData {
  const fills = decodeAdapterFills(data);
  return fills[0];
}
