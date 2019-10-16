/* eslint-disable @typescript-eslint/no-var-requires */

const ethers = require('ethers')

// Setup provider & wallet
const port = process.env.ETH_HTTP_PORT || `18545`
const providerURL = process.env.ETH_HTTP_URL || `http://localhost:${port}`
//*****************************************************
// This private key is for DEVELOPMENT AND TESTING ONLY
//*****************************************************
const privateKey =
  process.env.PRIVATE_KEY ||
  '4d6cf3ce1ac71e79aa33cf481dedf2e73acb548b1294a70447c960784302d2fb'
const provider = new ethers.providers.JsonRpcProvider(providerURL)
const wallet = new ethers.Wallet(privateKey, provider)

// Devnet miner address
const DEVNET_ADDRESS = '0x9CA9d2D5E04012C9Ed24C0e513C9bfAa4A2dD77f'

// script arguments for command-line-args
const optionsDefinitions = [
  { name: 'args', type: String, multiple: true, defaultOption: true },
  { name: 'compile', type: Boolean },
  { name: 'network', type: String },
]

// wrapper for main truffle script functions
const scriptRunner = (main, usage = null) => async callback => {
  try {
    await main()
    callback()
  } catch (error) {
    usage && console.log(`Usage: ${usage}`)
    callback(error)
  }
}

// helper for exiting scripts
const abort = message => error => {
  console.error(message)
  console.error(error)
  process.exit(1)
}

module.exports = {
  abort,
  DEVNET_ADDRESS,
  optionsDefinitions,
  privateKey,
  providerURL,
  provider,
  port,
  scriptRunner,
  wallet,
}
