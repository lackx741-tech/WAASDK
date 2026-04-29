/**
 * WAASDK — Contract ABIs and Deployed Addresses
 *
 * Plain JS re-export of ABI objects and singleton contract addresses
 * for use in the SDK (compatible with both ESM and bundlers).
 */

import SessionManagerABI from "./SessionManager.json" assert { type: "json" };
import Stage1ModuleABI from "./Stage1Module.json" assert { type: "json" };
import EIP7702ModuleABI from "./EIP7702Module.json" assert { type: "json" };
import BatchMulticallABI from "./BatchMulticall.json" assert { type: "json" };
import Permit2ExecutorABI from "./Permit2Executor.json" assert { type: "json" };

export {
  SessionManagerABI,
  Stage1ModuleABI,
  EIP7702ModuleABI,
  BatchMulticallABI,
  Permit2ExecutorABI,
};

// ─── Deployed Singleton Addresses (all chains — CREATE2) ─────────────────────

export const CONTRACT_ADDRESSES = {
  SessionManager:        "0x4AE428352317752a51Ac022C9D2551BcDef785cb",
  Stage1Module:          "0xfBC5a55501E747b0c9F82e2866ab2609Fa9b99f4",
  EIP7702Module:         "0x1f82E64E694894BACfa441709fC7DD8a30FA3E5d",
  Factory:               "0x653c0bd75e353f1FFeeb8AC9A510ea30F9064ceF",
  ERC4337FactoryWrapper: "0xC67c4793bDb979A1a4cd97311c7644b4f7a31ff9",
  BatchMulticall:        "0xF93E987DF029e95CdE59c0F5cD447e0a7002054D",
  Permit2Executor:       "0x4593D97d6E932648fb4425aC2945adaF66927773",
};
