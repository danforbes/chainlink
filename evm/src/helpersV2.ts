import { ethers } from 'ethers'
import { Signer } from 'ethers/abstract-signer'
import { createFundedWallet } from './wallet'
import { assert } from 'chai'
import { Oracle } from './generated/Oracle'
import { CoordinatorFactory } from './generated/CoordinatorFactory'
import {
  CoordinatorInterfaceFactory
} from './generated/CoordinatorInterfaceFactory'
import { LinkToken } from './generated/LinkToken'
import { makeDebug } from './debug'
import cbor from 'cbor'
import { EmptyOracle } from './generated/EmptyOracle'

const debug = makeDebug('helpers')

export interface Roles {
  defaultAccount: ethers.Wallet
  oracleNode: ethers.Wallet
  oracleNode1: ethers.Wallet
  oracleNode2: ethers.Wallet
  oracleNode3: ethers.Wallet
  stranger: ethers.Wallet
  consumer: ethers.Wallet
}

export interface Personas {
  Default: ethers.Wallet
  Neil: ethers.Wallet
  Ned: ethers.Wallet
  Nelly: ethers.Wallet
  Carol: ethers.Wallet
  Eddy: ethers.Wallet
}

interface RolesAndPersonas {
  roles: Roles
  personas: Personas
}

/**
 * Generate roles and personas for tests along with their corrolated account addresses
 */
export async function initializeRolesAndPersonas(
  provider: ethers.providers.JsonRpcProvider,
): Promise<RolesAndPersonas> {
  const accounts = await Promise.all(
    Array(6)
      .fill(null)
      .map(async (_, i) => createFundedWallet(provider, i).then(w => w.wallet)),
  )

  const personas: Personas = {
    Default: accounts[0],
    Neil: accounts[1],
    Ned: accounts[2],
    Nelly: accounts[3],
    Carol: accounts[4],
    Eddy: accounts[5],
  }

  const roles: Roles = {
    defaultAccount: accounts[0],
    oracleNode: accounts[1],
    oracleNode1: accounts[1],
    oracleNode2: accounts[2],
    oracleNode3: accounts[3],
    stranger: accounts[4],
    consumer: accounts[5],
  }

  return { personas, roles }
}

type AsyncFunction = () => Promise<void>
export async function assertActionThrows(action: AsyncFunction) {
  let e: Error | undefined = undefined
  try {
    await action()
  } catch (error) {
    e = error
  }
  if (!e) {
    assert.exists(e, 'Expected an error to be raised')
    return
  }

  assert(e.message, 'Expected an error to contain a message')

  const ERROR_MESSAGES = ['invalid opcode', 'revert']
  const hasErrored = ERROR_MESSAGES.reduce(
    (prev, next) => prev || e!.message.includes(next),
    false,
  )

  assert(
    hasErrored,
    `expected following error message to include ${ERROR_MESSAGES.join(
      ' or ',
    )}. Got: "${e.message}"`,
  )
}

export function checkPublicABI(
  contract: ethers.Contract | ethers.ContractFactory,
  expectedPublic: string[],
) {
  const actualPublic = []
  for (const method of contract.interface.abi) {
    if (method.type === 'function') {
      actualPublic.push(method.name)
    }
  }

  for (const method of actualPublic) {
    const index = expectedPublic.indexOf(method)
    assert.isAtLeast(index, 0, `#${method} is NOT expected to be public`)
  }

  for (const method of expectedPublic) {
    const index = actualPublic.indexOf(method)
    assert.isAtLeast(index, 0, `#${method} is expected to be public`)
  }
}

export const { utils } = ethers
/**
 * Convert a value to a hex string
 * @param args Value to convert to a hex string
 */
export function toHex(
  ...args: Parameters<typeof utils.hexlify>
): ReturnType<typeof utils.hexlify> {
  return utils.hexlify(...args)
}

/**
 * Convert an Ether value to a wei amount
 * @param args Ether value to convert to an Ether amount
 */
export function toWei(
  ...args: Parameters<typeof utils.parseEther>
): ReturnType<typeof utils.parseEther> {
  return utils.parseEther(...args)
}

export function decodeRunRequest(log?: ethers.providers.Log): RunRequest {
  if (!log) {
    throw Error('No logs found to decode')
  }

  const types = [
    'address',
    'bytes32',
    'uint256',
    'address',
    'bytes4',
    'uint256',
    'uint256',
    'bytes',
  ]
  const [
    requester,
    requestId,
    payment,
    callbackAddress,
    callbackFunc,
    expiration,
    version,
    data,
  ] = ethers.utils.defaultAbiCoder.decode(types, log.data)

  return {
    callbackAddr: callbackAddress,
    callbackFunc: toHex(callbackFunc),
    data: addCBORMapDelimiters(Buffer.from(stripHexPrefix(data), 'hex')),
    dataVersion: version.toNumber(),
    expiration: toHex(expiration),
    id: toHex(requestId),
    jobId: log.topics[1],
    payment: toHex(payment),
    requester: requester,
    topic: log.topics[0],
  }
}

/**
 * Decode a log into a run
 * @param log The log to decode
 * @todo Do we really need this?
 */
export function decodeRunABI(
  log: ethers.providers.Log,
): [string, string, string, string] {
  const d = debug.extend('decodeRunABI')
  d('params %o', log)

  const types = ['bytes32', 'address', 'bytes4', 'bytes']
  const decodedValue = ethers.utils.defaultAbiCoder.decode(types, log.data)
  d('decoded value %o', decodedValue)

  return decodedValue
}

/**
 * Decodes a CBOR hex string, and adds opening and closing brackets to the CBOR if they are not present.
 *
 * @param hexstr The hex string to decode
 */
export function decodeDietCBOR(hexstr: string) {
  const buf = hexToBuf(hexstr)

  return cbor.decodeFirstSync(addCBORMapDelimiters(buf))
}

export interface RunRequest {
  callbackAddr: string
  callbackFunc: string
  data: Buffer
  dataVersion: number
  expiration: string
  id: string
  jobId: string
  payment: string
  requester: string
  topic: string
}

/**
 * Add a starting and closing map characters to a CBOR encoding if they are not already present.
 */
function addCBORMapDelimiters(buffer: Buffer): Buffer {
  if (buffer[0] >> 5 === 5) {
    return buffer
  }

  /**
   * This is the opening character of a CBOR map.
   * @see https://en.wikipedia.org/wiki/CBOR#CBOR_data_item_header
   */
  const startIndefiniteLengthMap = Buffer.from([0xbf])
  /**
   * This is the closing character in a CBOR map.
   * @see https://en.wikipedia.org/wiki/CBOR#CBOR_data_item_header
   */
  const endIndefiniteLengthMap = Buffer.from([0xff])
  return Buffer.concat(
    [startIndefiniteLengthMap, buffer, endIndefiniteLengthMap],
    buffer.length + 2,
  )
}

export function stripHexPrefix(hex: string): string {
  if (!ethers.utils.isHexString(hex)) {
    throw Error(`Expected valid hex string, got: "${hex}"`)
  }

  return hex.replace('0x', '')
}

export function toUtf8(
  ...args: Parameters<typeof ethers.utils.toUtf8Bytes>
): ReturnType<typeof ethers.utils.toUtf8Bytes> {
  return ethers.utils.toUtf8Bytes(...args)
}

/**
 * Compute the keccak256 cryptographic hash of a value, returned as a hex string.
 * (Note: often Ethereum documentation refers to this, incorrectly, as SHA3)
 * @param args The data to compute the keccak256 hash of
 */
export function keccak(
  ...args: Parameters<typeof ethers.utils.keccak256>
): ReturnType<typeof ethers.utils.keccak256> {
  return utils.keccak256(...args)
}

export async function fulfillOracleRequest(
  oracleContract: Oracle | EmptyOracle,
  runRequest: RunRequest,
  response: string,
  options: Omit<ethers.providers.TransactionRequest, 'to' | 'from'> = {
    gasLimit: 1000000, // FIXME: incorrect gas estimation
  },
): ReturnType<typeof oracleContract.fulfillOracleRequest> {
  return oracleContract.fulfillOracleRequest(
    runRequest.id,
    runRequest.payment,
    runRequest.callbackAddr,
    runRequest.callbackFunc,
    runRequest.expiration,
    response,
    options,
  )
}

/**
 * The solidity function selector for the given signature
 */
export function functionSelector(signature: string): string {
  const fullHash = ethers.utils.id(signature)
  assert(fullHash.startsWith('0x'))
  return fullHash.slice(0, 2 + (4 * 2)) // '0x' + initial 4 bytes, in hex
}

export function requestDataBytes(
  specId: string,
  to: string,
  fHash: string,
  nonce: number,
  data: string,
): any {
  const types = [
    'address',
    'uint256',
    'bytes32',
    'address',
    'bytes4',
    'uint256',
    'uint256',
    'bytes',
  ]

  const values = [
    ethers.constants.AddressZero,
    0,
    specId,
    to,
    fHash,
    nonce,
    1,
    data,
  ]
  const encoded = ethers.utils.defaultAbiCoder.encode(types, values)
  const funcSelector = functionSelector(
    'oracleRequest(address,uint256,bytes32,address,bytes4,uint256,uint256,bytes)',
  )
  return `${funcSelector}${stripHexPrefix(encoded)}`
}

// link param must be from linkContract(), if amount is a BN
export function requestDataFrom(
  oc: Oracle,
  link: LinkToken,
  amount: number,
  args: string,
  options: Omit<ethers.providers.TransactionRequest, 'to' | 'from'> = {},
): ReturnType<typeof link.transferAndCall> {
  if (!options) {
    options = { value: 0 }
  }

  return link.transferAndCall(oc.address, amount, args, options)
}

export async function increaseTime5Minutes(
  provider: ethers.providers.JsonRpcProvider,
): Promise<void> {
  await provider.send('evm_increaseTime', [300])
}

/**
 * Convert a buffer to a hex string
 * @param hexstr The hex string to convert to a buffer
 */
export function hexToBuf(hexstr: string): Buffer {
  return Buffer.from(stripHexPrefix(hexstr), 'hex')
}

interface ParamType { name: string, type: string }

/**
 * Names and types of the ServiceAgreement struct components
 *
 * Retrieves the struct fields from the ethers.js representation of
 * CoordinatorInterface.sol, so it should silently adapt to changes in the
 * struct, as long as the ethers.js representation is up to date.
 */
export function serviceAgreementFieldTypes(): ParamType[] {
  // TODO: Use a function in CoordinatorFactory().interface.abi with a
  // ServiceAgreement parameter, here. Don't use the output of
  // serviceAgreements() directly, because abi outputs elide dynamic types (like
  // `oracles`, in this case.)
  const dummyCoordinatorInterface = CoordinatorInterfaceFactory.connect(
    '0x0000000000000000000000000000000000000000',  // Dummy address & signer
    new (Signer as any /* Brutally instantiates an abstract class */ )()
  )
  const { abi } = dummyCoordinatorInterface.interface
  const param = abi[0].inputs[0]
  if (param.name !== '_agreement' || param.type !== 'tuple') {
    throw Error(`extracted wrong version of struct tuple: ${param} from ${abi}`)
  }
  const sAABI = param.components as ParamType[]
  if (!sAABI.every(p => p.name && p.type)) {
    throw Error(`ServiceAgreement types aren't all ParamType: ${sAABI}`)
  }
  return sAABI
}

type Hash = ReturnType<typeof ethers.utils.keccak256>
type Coordinator = ReturnType<CoordinatorFactory['attach']>
type ServiceAgreement = Parameters<Coordinator['initiateServiceAgreement']>[0]

  /**
   * Digest of the ServiceAgreement.
   *
   * NB: Changes this function may necessitate changes in tandem to
   * service_agreement.go/Encumberance.ABI, and Coordinator#getId, because this
   * digest is used by oracles to sign the agreement, and used by the coordinator
   * to index the agreement.
   */
  export const calculateSAID2 = (sa: ServiceAgreement): Hash => {
    const abi = serviceAgreementFieldTypes()
    type SAKey = keyof ServiceAgreement
    const typeStrings = abi.map((p:ParamType) => p.type) 
    const inputs = abi.map((p:ParamType) => sa[p.name as SAKey])
    return ethers.utils.solidityKeccak256(typeStrings, inputs)
  }
