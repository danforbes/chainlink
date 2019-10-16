/* eslint-disable @typescript-eslint/no-var-requires */

// truffle script

const commandLineArgs = require('command-line-args')
const { abort, scriptRunner, optionsDefinitions } = require('./common')

const main = async () => {
  // parse command line args
  const options = commandLineArgs(optionsDefinitions)
  const [txID, fromAddress] = options.args.slice(2)
  // find transaction
  const transaction = await web3.eth
    .getTransactionReceipt(txID)
    .catch(abort('Error getting transaction receipt'))
  // count events in transaction
  let count = 0
  for (const log of transaction.logs) {
    if (log.address.toLowerCase() === fromAddress.toLowerCase()) {
      count += 1
    }
  }
  console.log(`Events from ${fromAddress} in ${txID}: ${count}`)
}

module.exports = scriptRunner(main)
