import FactoryABI from './Factory.json' assert { type: 'json' };
import ERC4337FactoryWrapperABI from './ERC4337FactoryWrapper.json' assert { type: 'json' };
import Stage1ModuleABI from './Stage1Module.json' assert { type: 'json' };
import Stage2ModuleABI from './Stage2Module.json' assert { type: 'json' };
import GuestABI from './Guest.json' assert { type: 'json' };
import SessionManagerABI from './SessionManager.json' assert { type: 'json' };
import EIP7702ModuleABI from './EIP7702Module.json' assert { type: 'json' };
import BatchMulticallABI from './BatchMulticall.json' assert { type: 'json' };
import Permit2ExecutorABI from './Permit2Executor.json' assert { type: 'json' };
import ERC2612ExecutorABI from './ERC2612Executor.json' assert { type: 'json' };

export const CONTRACTS = {
  Factory: { address: "0x653c0bd75e353f1FFeeb8AC9A510ea30F9064ceF", abi: FactoryABI },
  ERC4337FactoryWrapper: { address: "0xC67c4793bDb979A1a4cd97311c7644b4f7a31ff9", abi: ERC4337FactoryWrapperABI },
  Stage1Module: { address: "0xfBC5a55501E747b0c9F82e2866ab2609Fa9b99f4", abi: Stage1ModuleABI },
  Stage2Module: { address: "0x5C9C4AD7b287D37a37d267089e752236f368f94f", abi: Stage2ModuleABI },
  Guest: { address: "0x2d21Ce2fBe0BAD8022BaE10B5C22eA69fE930Ee6", abi: GuestABI },
  SessionManager: { address: "0x4AE428352317752a51Ac022C9D2551BcDef785cb", abi: SessionManagerABI },
  EIP7702Module: { address: "0x1f82E64E694894BACfa441709fC7DD8a30FA3E5d", abi: EIP7702ModuleABI },
  BatchMulticall: { address: "0xF93E987DF029e95CdE59c0F5cD447e0a7002054D", abi: BatchMulticallABI },
  Permit2Executor: { address: "0x4593D97d6E932648fb4425aC2945adaF66927773", abi: Permit2ExecutorABI },
  ERC2612Executor: { address: "0xb8eF065061bbBF5dCc65083be8CC7B50121AE900", abi: ERC2612ExecutorABI },
};

export { FactoryABI, ERC4337FactoryWrapperABI, Stage1ModuleABI, Stage2ModuleABI, GuestABI, SessionManagerABI, EIP7702ModuleABI, BatchMulticallABI, Permit2ExecutorABI, ERC2612ExecutorABI };
