import * as h from '../src/helpersV2'
import { GetterSetterFactory } from 'contracts/GetterSetterFactory'
import { EmptyOracleFactory } from 'contracts/EmptyOracleFactory'
import { OracleFactory } from 'contracts/OracleFactory'
import { ConcreteChainlinkedFactory } from 'contracts/ConcreteChainlinkedFactory'
import { assert } from 'chai'
import { ethers } from 'ethers'
import { LinkTokenFactory } from 'contracts/LinkTokenFactory'
import { Instance } from 'src/contract'
import env from '@nomiclabs/buidler'
import { EthersProviderWrapper } from '../src/provider'

const concreteChainlinkedFactory = new ConcreteChainlinkedFactory()
const emptyOracleFactory = new EmptyOracleFactory()
const getterSetterFactory = new GetterSetterFactory()
const oracleFactory = new OracleFactory()
const linkTokenFactory = new LinkTokenFactory()

const provider = new EthersProviderWrapper(env.ethereum)

let roles: h.Roles

beforeAll(async () => {
  const rolesAndPersonas = await h.initializeRolesAndPersonas(provider)

  roles = rolesAndPersonas.roles
})

describe('ConcreteChainlinked', () => {
  const specId =
    '0x4c7b7ffb66b344fbaa64995af81e355a00000000000000000000000000000000'
  let cc: Instance<ConcreteChainlinkedFactory>
  let gs: Instance<GetterSetterFactory>
  let oc: Instance<OracleFactory | EmptyOracleFactory>
  let newoc: Instance<OracleFactory>
  let link: Instance<LinkTokenFactory>

  beforeEach(async () => {
    link = await linkTokenFactory.connect(roles.defaultAccount).deploy()
    oc = await oracleFactory.connect(roles.defaultAccount).deploy(link.address)
    newoc = await oracleFactory
      .connect(roles.defaultAccount)
      .deploy(link.address)
    gs = await getterSetterFactory.connect(roles.defaultAccount).deploy()
    cc = await concreteChainlinkedFactory
      .connect(roles.defaultAccount)
      .deploy(link.address, oc.address)
  })

  describe('#newRequest', () => {
    it('forwards the information to the oracle contract through the link token', async () => {
      const tx = await cc.publicNewRequest(
        specId,
        gs.address,
        ethers.utils.toUtf8Bytes('requestedBytes32(bytes32,bytes32)'),
      )
      const receipt = await tx.wait()

      assert.equal(1, receipt.logs!.length)
      const [jId, cbAddr, cbFId, cborData] = h.decodeRunABI(receipt.logs![0])
      const params = h.decodeDietCBOR(cborData)

      assert.equal(specId, jId)
      assert.equal(gs.address, cbAddr)
      assert.equal('0xed53e511', cbFId)
      assert.deepEqual({}, params)
    })
  })

  describe('#chainlinkRequest(Request)', () => {
    it('emits an event from the contract showing the run ID', async () => {
      const tx = await cc.publicRequest(
        specId,
        cc.address,
        ethers.utils.toUtf8Bytes('fulfillRequest(bytes32,bytes32)'),
        0,
      )

      const { events, logs } = await tx.wait()

      assert.equal(4, events!.length)

      assert.equal(logs![0].address, cc.address)
      assert.equal(events![0].event, 'ChainlinkRequested')
    })
  })

  describe('#chainlinkRequestTo(Request)', () => {
    it('emits an event from the contract showing the run ID', async () => {
      const tx = await cc.publicRequestRunTo(
        newoc.address,
        specId,
        cc.address,
        ethers.utils.toUtf8Bytes('fulfillRequest(bytes32,bytes32)'),
        0,
      )
      const { events } = await tx.wait()

      assert.equal(4, events!.length)
      assert.equal(events![0].event, 'ChainlinkRequested')
    })

    it('emits an event on the target oracle contract', async () => {
      const tx = await cc.publicRequestRunTo(
        newoc.address,
        specId,
        cc.address,
        ethers.utils.toUtf8Bytes('fulfillRequest(bytes32,bytes32)'),
        0,
      )
      const { logs } = await tx.wait()
      const event = newoc.interface.parseLog(logs![3])

      assert.equal(4, logs!.length)
      assert.equal(event.name, 'OracleRequest')
    })

    it('does not modify the stored oracle address', async () => {
      await cc.publicRequestRunTo(
        newoc.address,
        specId,
        cc.address,
        ethers.utils.toUtf8Bytes('fulfillRequest(bytes32,bytes32)'),
        0,
      )

      const actualOracleAddress = await cc.publicOracleAddress()
      assert.equal(oc.address, actualOracleAddress)
    })
  })

  describe('#cancelChainlinkRequest', () => {
    let requestId: string

    beforeEach(async () => {
      oc = await emptyOracleFactory.connect(roles.defaultAccount).deploy()
      cc = await concreteChainlinkedFactory
        .connect(roles.defaultAccount)
        .deploy(link.address, oc.address)

      const tx = await cc.publicRequest(
        specId,
        cc.address,
        ethers.utils.toUtf8Bytes('fulfillRequest(bytes32,bytes32)'),
        0,
      )
      const { events } = await tx.wait()
      requestId = (events![0].args as any).id
    })

    it('emits an event from the contract showing the run was cancelled', async () => {
      const tx = await cc.publicCancelRequest(
        requestId,
        0,
        ethers.utils.hexZeroPad('0x', 4),
        0,
      )
      const { events } = await tx.wait()

      assert.equal(1, events!.length)
      assert.equal(events![0].event, 'ChainlinkCancelled')
      assert.equal(requestId, (events![0].args! as any).id)
    })

    it('throws if given a bogus event ID', async () => {
      await h.assertActionThrows(async () => {
        await cc.publicCancelRequest(
          ethers.utils.formatBytes32String('bogusId'),
          0,
          ethers.utils.hexZeroPad('0x', 4),
          0,
        )
      })
    })
  })

  describe('#recordChainlinkFulfillment(modifier)', () => {
    let request: h.RunRequest

    beforeEach(async () => {
      const tx = await cc.publicRequest(
        specId,
        cc.address,
        ethers.utils.toUtf8Bytes('fulfillRequest(bytes32,bytes32)'),
        0,
      )
      const { logs } = await tx.wait()

      request = h.decodeRunRequest(logs![3])
    })

    it('emits an event marking the request fulfilled', async () => {
      const tx = await h.fulfillOracleRequest(
        oc,
        request,
        ethers.utils.formatBytes32String('hi mom!'),
      )
      const { logs } = await tx.wait()

      const event = cc.interface.parseLog(logs![0])

      assert.equal(1, logs!.length)
      assert.equal(event.name, 'ChainlinkFulfilled')
      assert.equal(request.id, event.values.id)
    })
  })

  describe('#fulfillChainlinkRequest(function)', () => {
    let request: h.RunRequest

    beforeEach(async () => {
      const tx = await cc.publicRequest(
        specId,
        cc.address,
        ethers.utils.toUtf8Bytes(
          'publicFulfillChainlinkRequest(bytes32,bytes32)',
        ),
        0,
      )
      const { logs } = await tx.wait()

      request = h.decodeRunRequest(logs![3])
    })

    it('emits an event marking the request fulfilled', async () => {
      const tx = await h.fulfillOracleRequest(
        oc,
        request,
        ethers.utils.formatBytes32String('hi mom!'),
      )
      const { logs } = await tx.wait()
      const event = cc.interface.parseLog(logs![0])

      assert.equal(1, logs!.length)
      assert.equal(event.name, 'ChainlinkFulfilled')
      assert.equal(request.id, event.values.id)
    })
  })

  describe('#chainlinkToken', () => {
    it('returns the Link Token address', async () => {
      const addr = await cc.publicChainlinkToken()
      assert.equal(addr, link.address)
    })
  })

  describe('#addExternalRequest', () => {
    let mock: Instance<ConcreteChainlinkedFactory>
    let request: h.RunRequest

    beforeEach(async () => {
      mock = await concreteChainlinkedFactory
        .connect(roles.defaultAccount)
        .deploy(link.address, oc.address)

      const tx = await cc.publicRequest(
        specId,
        mock.address,
        ethers.utils.toUtf8Bytes('fulfillRequest(bytes32,bytes32)'),
        0,
      )
      const receipt = await tx.wait()

      request = h.decodeRunRequest(receipt.logs![3])
      await mock.publicAddExternalRequest(oc.address, request.id)
    })

    it('allows the external request to be fulfilled', async () => {
      await h.fulfillOracleRequest(
        oc,
        request,
        ethers.utils.formatBytes32String('hi mom!'),
      )
    })

    it('does not allow the same requestId to be used', async () => {
      await h.assertActionThrows(async () => {
        await cc.publicAddExternalRequest(newoc.address, request.id)
      })
    })
  })
})
