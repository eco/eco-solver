import { Hex, keccak256 } from 'viem';

import { Intent } from '@/common/interfaces/intent.interface';
import { PortalHashUtils } from '@/common/utils/portal-hash.utils';

export function hashIntentSvm(intent: Intent): {
  routeHash: Hex;
  rewardHash: Hex;
  intentHash: Hex;
} {
  const routeHash = PortalHashUtils.computeRouteHash(intent.route);
  const rewardHash = PortalHashUtils.computeRewardHash(intent.reward);

  // Match Rust: destination.to_be_bytes() (u64 as big-endian bytes)
  const destinationBytes = new Uint8Array(8);
  const view = new DataView(destinationBytes.buffer);
  view.setBigUint64(0, intent.destination, false);

  // Match Rust: hasher.update(destination.to_be_bytes().as_slice());
  const routeHashBytes = new Uint8Array(Buffer.from(routeHash.slice(2), 'hex'));
  const rewardHashBytes = new Uint8Array(Buffer.from(rewardHash.slice(2), 'hex'));

  const combined = new Uint8Array(8 + 32 + 32);
  combined.set(destinationBytes, 0);
  combined.set(routeHashBytes, 8);
  combined.set(rewardHashBytes, 40);

  const intentHash = keccak256(`0x${Buffer.from(combined).toString('hex')}` as Hex);

  return {
    routeHash,
    rewardHash,
    intentHash,
  };
}
