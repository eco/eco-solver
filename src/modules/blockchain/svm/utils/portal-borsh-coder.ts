import { BorshCoder } from '@coral-xyz/anchor';

import { portalIdl } from '@/modules/blockchain/svm/targets/idl/portal.idl';
import { PortalIdlTypes } from '@/modules/blockchain/svm/targets/types/portal-idl.type';

export const portalBorshCoder = new BorshCoder<string, keyof PortalIdlTypes>(portalIdl);
