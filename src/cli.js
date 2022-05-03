#!/usr/bin/env node
// Temporary demo client
// Works both in browser and node.js

require('dotenv').config()
const fs = require('fs')
// const axios = require('axios')
const assert = require('assert')
const snarkjs = require('snarkjs')
const crypto = require('crypto')
const circomlib = require('circomlib')
const bigInt = snarkjs.bigInt
const merkleTree = require('fixed-merkle-tree')
const Web3 = require('web3')
const buildGroth16 = require('websnark/src/groth16')
const websnarkUtils = require('websnark/src/utils')
const { toWei, fromWei, toBN, BN } = require('web3-utils')
const config = require('./config')
const program = require('commander')

let web3, flexclub, flexnft, nftAddress, circuit, proving_key, groth16, erc20, erc721, senderAccount, netId
let MERKLE_TREE_HEIGHT, ETH_AMOUNT, PRIVATE_KEY, GENESIS_BLOCK

/** Whether we are in a browser or node.js */
const inBrowser = (typeof window !== 'undefined')
let isLocalRPC = false

/** Generate random number of specified byte length */
const rbigint = nbytes => snarkjs.bigInt.leBuff2int(crypto.randomBytes(nbytes))

/** Compute pedersen hash */
const pedersenHash = data => circomlib.babyJub.unpackPoint(circomlib.pedersenHash.hash(data))[0]

/** BigNumber to hex string of specified length */
function toHex(number, length = 32) {
  const str = number instanceof Buffer ? number.toString('hex') : bigInt(number).toString(16)
  return '0x' + str.padStart(length * 2, '0')
}

/** Display ETH account balance */
async function printETHBalance({ address, name }) {
  console.log(`${name} ETH balance is`, web3.utils.fromWei(await web3.eth.getBalance(address)))
}

/** Display ERC20 account balance */
async function printERC20Balance({ address, name, tokenAddress }) {
  const erc20ContractJson = require(__dirname + '/../build/contracts/ERC20Mock.json')
  erc20 = tokenAddress ? new web3.eth.Contract(erc20ContractJson.abi, tokenAddress) : erc20
  console.log(`${name} Token Balance is`, web3.utils.fromWei(await erc20.methods.balanceOf(address).call()))
}

/** Display ERC20 account balance */
async function printNFTBalance({ address, name }) {
  erc721 = flexnft
  console.log(`${name} NFT Balance is`, await erc721.methods.balanceOf(address).call())
}

/**
 * Create deposit object from secret and nullifier
 */
function createDeposit({ nullifier, secret }) {
  const deposit = { nullifier, secret }
  deposit.preimage = Buffer.concat([deposit.nullifier.leInt2Buff(31), deposit.secret.leInt2Buff(31)])
  deposit.commitment = pedersenHash(deposit.preimage)
  deposit.commitmentHex = toHex(deposit.commitment)
  deposit.nullifierHash = pedersenHash(deposit.nullifier.leInt2Buff(31))
  deposit.nullifierHex = toHex(deposit.nullifierHash)
  return deposit
}

/**
 * Make a deposit
 * @param currency Сurrency
 * @param amount Deposit amount
 */
async function deposit({ currency, amount }) {
  const deposit = createDeposit({ nullifier: rbigint(31), secret: rbigint(31) })
  const note = toHex(deposit.preimage, 62)
  const noteString = `flexclub-${currency}-${amount}-${netId}-${note}`
  console.log(`Your note: ${noteString}`)

  // if (currency === 'eth') {
  await printETHBalance({ address: flexclub._address, name: 'Tornado' })
  await printETHBalance({ address: senderAccount, name: 'Sender account' })
  const value = isLocalRPC ? ETH_AMOUNT : fromDecimals({ amount, decimals: 18 })
  console.log('Submitting deposit transaction')
  await flexclub.methods.deposit(toHex(deposit.commitment)).send({ value, from: senderAccount, gas: 2e6 }).on('transactionHash', function (txHash) {
    if (netId === 1 || netId === 42) {
      console.log(`View transaction on etherscan https://${getCurrentNetworkName()}etherscan.io/tx/${txHash}`)
    } else {
      console.log(`The transaction hash is ${txHash}`)
    }
    if (inBrowser) {
      document.getElementById('deposit-note-textarea').value = noteString
      alert('Store your note: ' + noteString)
    }
  }).on('error', function (e) {
    console.error('on transactionHash error', e.message)
    if (inBrowser) {
      alert('Failed to deposit!\n' + e.message)
    }
  })
  await printETHBalance({ address: flexclub._address, name: 'Tornado' })
  await printETHBalance({ address: senderAccount, name: 'Sender account' })
  // } else { // a token
  // await printERC20Balance({ address: flexclub._address, name: 'Tornado' })
  // await printERC20Balance({ address: senderAccount, name: 'Sender account' })
  // const decimals = isLocalRPC ? 18 : config.deployments[`netId${netId}`][currency].decimals
  // const tokenAmount = isLocalRPC ? TOKEN_AMOUNT : fromDecimals({ amount, decimals })
  // if (isLocalRPC) {
  //   console.log('Minting some test tokens to deposit')
  //   await erc20.methods.mint(senderAccount, tokenAmount).send({ from: senderAccount, gas: 2e6 })
  // }

  // const allowance = await erc20.methods.allowance(senderAccount, flexclub._address).call({ from: senderAccount })
  // console.log('Current allowance is', fromWei(allowance))
  // if (toBN(allowance).lt(toBN(tokenAmount))) {
  //   console.log('Approving tokens for deposit')
  //   await erc20.methods.approve(flexclub._address, tokenAmount).send({ from: senderAccount, gas: 1e6 })
  // }

  // console.log('Submitting deposit transaction')
  // await flexclub.methods.deposit(toHex(deposit.commitment)).send({ from: senderAccount, gas: 2e6 })
  // await printERC20Balance({ address: flexclub._address, name: 'Tornado' })
  // await printERC20Balance({ address: senderAccount, name: 'Sender account' })
  // }

  return noteString
}

/**
 * Generate merkle tree for a deposit.
 * Download deposit events from the flexclub, reconstructs merkle tree, finds our deposit leaf
 * in it and generates merkle proof
 * @param deposit Deposit object
 */
async function generateMerkleProof(deposit) {
  // Get all deposit events from smart contract and assemble merkle tree from them
  console.log('Getting current state from flexclub contract')
  const events = await flexclub.getPastEvents('Deposit', { fromBlock: GENESIS_BLOCK, toBlock: 'latest' })
  const leaves = events
    .sort((a, b) => a.returnValues.leafIndex - b.returnValues.leafIndex) // Sort events in chronological order
    .map(e => e.returnValues.commitment)
  const tree = new merkleTree(MERKLE_TREE_HEIGHT, leaves)

  // Find current commitment in the tree
  const depositEvent = events.find(e => e.returnValues.commitment === toHex(deposit.commitment))
  const leafIndex = depositEvent ? depositEvent.returnValues.leafIndex : -1

  // Validate that our data is correct
  const root = tree.root()
  const isValidRoot = await flexclub.methods.isKnownRoot(toHex(root)).call()
  const isSpent = await flexclub.methods.isSpent(toHex(deposit.nullifierHash)).call()
  assert(isValidRoot === true, 'Merkle tree is corrupted')
  assert(isSpent === false, 'The note is already spent')
  assert(leafIndex >= 0, 'The deposit is not found in the tree')

  // Compute merkle proof of our commitment
  const { pathElements, pathIndices } = tree.path(leafIndex)
  return { pathElements, pathIndices, root: tree.root() }
}

/**
 * Generate SNARK proof for withdrawal
 * @param deposit Deposit object
 * @param recipient Funds recipient
 * @param relayer Relayer address
 * @param fee Relayer fee
 * @param refund Receive ether for exchanged tokens
 */
async function generateProof({ deposit, recipient, relayerAddress = 0, fee = 0, refund = 0 }) {
  // Compute merkle proof of our commitment
  const { root, pathElements, pathIndices } = await generateMerkleProof(deposit)

  // Prepare circuit input
  const input = {
    // Public snark inputs
    root: root,
    nullifierHash: deposit.nullifierHash,
    recipient: bigInt(recipient),
    relayer: bigInt(relayerAddress),
    fee: bigInt(fee),
    refund: bigInt(refund),

    // Private snark inputs
    nullifier: deposit.nullifier,
    secret: deposit.secret,
    pathElements: pathElements,
    pathIndices: pathIndices,
  }

  console.log('Generating SNARK proof')
  console.time('Proof time')
  const proofData = await websnarkUtils.genWitnessAndProve(groth16, input, circuit, proving_key)
  const { proof } = websnarkUtils.toSolidityInput(proofData)
  console.timeEnd('Proof time')

  const args = [
    toHex(input.root),
    toHex(input.nullifierHash),
    toHex(input.recipient, 20),
    toHex(input.relayer, 20),
    toHex(input.fee),
    toHex(input.refund),
  ]

  return { proof, args }
}

/**
 * Do a mint NFT
 */
async function mintNFT({ deposit, currency, recipient, relayerURL = '', refund = '0' }) {
  if (currency === 'eth' && refund !== '0') {
    throw new Error('The ETH purchase is supposed to be 0 for ETH withdrawals')
  }
  refund = toWei(refund)
  if (relayerURL) {
    throw new Error('Relayers are coming soon!')
  } else { // using private key
    const { proof, args } = await generateProof({ deposit, recipient, refund })

    console.log('Submitting mintNFT transaction')
    await flexclub.methods.mintNFT(proof, ...args).send({ from: senderAccount, value: refund.toString(), gas: 1e6 })
      .on('transactionHash', function (txHash) {
        if (netId === 1 || netId === 42) {
          console.log(`View transaction on etherscan https://${getCurrentNetworkName()}etherscan.io/tx/${txHash}`)
        } else {
          console.log(`The transaction hash is ${txHash}`)
        }
      }).on('error', function (e) {
        console.error('on transactionHash error', e.message)
        if (inBrowser) {
          alert('Failed to mint!\n' + e.message)
        }
      })
  }
  console.log('Done')
}


/**
 * Do ETH withdrawal
 */
async function withdraw({ currency = 'eth', relayerURL = '', refund = '0' }) {
  if (currency === 'eth' && refund !== '0') {
    throw new Error('The ETH purchase is supposed to be 0 for ETH withdrawals')
  }
  refund = toWei(refund)
  if (relayerURL) {
    throw new Error('Relayers are coming soon!')
  } else { // using private key
    console.log('Submitting withdraw transaction')
    await flexclub.methods.withdraw().send({ from: senderAccount, value: refund.toString(), gas: 1e6 })
      .on('transactionHash', function (txHash) {
        if (netId === 1 || netId === 42) {
          console.log(`View transaction on etherscan https://${getCurrentNetworkName()}etherscan.io/tx/${txHash}`)
        } else {
          console.log(`The transaction hash is ${txHash}`)
        }
      }).on('error', function (e) {
        console.error('on transactionHash error', e.message)
        if (inBrowser) {
          alert('Failed to withdraw!\n' + e.message)
        }
      })
  }
  console.log('Done')
}


function fromDecimals({ amount, decimals }) {
  amount = amount.toString()
  let ether = amount.toString()
  const base = new BN('10').pow(new BN(decimals))
  const baseLength = base.toString(10).length - 1 || 1

  const negative = ether.substring(0, 1) === '-'
  if (negative) {
    ether = ether.substring(1)
  }

  if (ether === '.') {
    throw new Error('[ethjs-unit] while converting number ' + amount + ' to wei, invalid value')
  }

  // Split it into a whole and fractional part
  const comps = ether.split('.')
  if (comps.length > 2) {
    throw new Error(
      '[ethjs-unit] while converting number ' + amount + ' to wei,  too many decimal points',
    )
  }

  let whole = comps[0]
  let fraction = comps[1]

  if (!whole) {
    whole = '0'
  }
  if (!fraction) {
    fraction = '0'
  }
  if (fraction.length > baseLength) {
    throw new Error(
      '[ethjs-unit] while converting number ' + amount + ' to wei, too many decimal places',
    )
  }

  while (fraction.length < baseLength) {
    fraction += '0'
  }

  whole = new BN(whole)
  fraction = new BN(fraction)
  let wei = whole.mul(base).add(fraction)

  if (negative) {
    wei = wei.mul(negative)
  }

  return new BN(wei.toString(10), 10)
}

function toDecimals(value, decimals, fixed) {
  const zero = new BN(0)
  const negative1 = new BN(-1)
  decimals = decimals || 18
  fixed = fixed || 7

  value = new BN(value)
  const negative = value.lt(zero)
  const base = new BN('10').pow(new BN(decimals))
  const baseLength = base.toString(10).length - 1 || 1

  if (negative) {
    value = value.mul(negative1)
  }

  let fraction = value.mod(base).toString(10)
  while (fraction.length < baseLength) {
    fraction = `0${fraction}`
  }
  fraction = fraction.match(/^([0-9]*[1-9]|0)(0*)/)[1]

  const whole = value.div(base).toString(10)
  value = `${whole}${fraction === '0' ? '' : `.${fraction}`}`

  if (negative) {
    value = `-${value}`
  }

  if (fixed) {
    value = value.slice(0, fixed)
  }

  return value
}

function getCurrentNetworkName() {
  switch (netId) {
    case 1:
      return ''
    case 42:
      return 'kovan.'
  }

}


/**
 * Parses Tornado.cash note
 * @param noteString the note
 */
function parseNote(noteString) {
  const noteRegex = /flexclub-(?<currency>\w+)-(?<amount>[\d.]+)-(?<netId>\d+)-0x(?<note>[0-9a-fA-F]{124})/g
  const match = noteRegex.exec(noteString)
  if (!match) {
    if (inBrowser) {
      alert('The note has invalid format')
    }
    throw new Error('The note has invalid format')
  }


  const buf = Buffer.from(match.groups.note, 'hex')
  const nullifier = bigInt.leBuff2int(buf.slice(0, 31))
  const secret = bigInt.leBuff2int(buf.slice(31, 62))
  const deposit = createDeposit({ nullifier, secret })
  const netId = Number(match.groups.netId)

  return { currency: match.groups.currency, amount: match.groups.amount, netId, deposit }
}

async function loadDepositData({ deposit }) {
  try {
    const eventWhenHappened = await flexclub.getPastEvents('Deposit', {
      filter: {
        commitment: deposit.commitmentHex,
      },
      fromBlock: 0,
      toBlock: 'latest',
    })
    if (eventWhenHappened.length === 0) {
      throw new Error('There is no related deposit, the note is invalid')
    }

    const { timestamp } = eventWhenHappened[0].returnValues
    const txHash = eventWhenHappened[0].transactionHash
    const isSpent = await flexclub.methods.isSpent(deposit.nullifierHex).call()
    const receipt = await web3.eth.getTransactionReceipt(txHash)

    return { timestamp, txHash, isSpent, from: receipt.from, commitment: deposit.commitmentHex }
  } catch (e) {
    console.error('loadDepositData', e)
  }
  return {}
}
async function loadWithdrawalData({ amount, currency, deposit }) {
  try {
    const events = await flexclub.getPastEvents('Withdrawal', {
      fromBlock: 0,
      toBlock: 'latest',
    })

    const withdrawEvent = events.filter((event) => {
      return event.returnValues.nullifierHash === deposit.nullifierHex
    })[0]

    const fee = withdrawEvent.returnValues.fee
    const decimals = config.deployments[`netId${netId}`][currency].decimals
    const withdrawalAmount = toBN(fromDecimals({ amount, decimals })).sub(
      toBN(fee),
    )
    const { timestamp } = await web3.eth.getBlock(withdrawEvent.blockHash)
    return {
      amount: toDecimals(withdrawalAmount, decimals, 9),
      txHash: withdrawEvent.transactionHash,
      to: withdrawEvent.returnValues.to,
      timestamp,
      nullifier: deposit.nullifierHex,
      fee: toDecimals(fee, decimals, 9),
    }
  } catch (e) {
    console.error('loadWithdrawalData', e)
  }
}

/**
 * Init web3, contracts, and snark
 */
async function init({ rpc, noteNetId, currency }) {
  let contractJson, configsJson, contractNFTJson, erc20ContractJson, /*erc20flexclubJson,*/ flexclubAddress, tokenAddress
  // TODO do we need this? should it work in browser really?

  if (inBrowser) {
    // Initialize using injected web3 (Metamask)
    // To assemble web version run `npm run browserify`
    if (window.ethereum) {
      await window.ethereum.request({ method: 'eth_requestAccounts' })
      web3 = new Web3(window.ethereum)
    } else {
      console.log('Not connected to metamask!!')
      return
    }

    // web3 = new Web3(window.web3.currentProvider, null, { transactionConfirmationBlocks: 1 })
    configsJson = await (await fetch('config.json')).json()
    contractJson = await (await fetch('assets/json/ETHFlexClub.json')).json()
    contractNFTJson = await (await fetch('assets/json/FlexNFT.json')).json()
    circuit = await (await fetch('assets/json/withdraw.json')).json()
    proving_key = await (await fetch('assets/bin/withdraw_proving_key.bin')).arrayBuffer()
    MERKLE_TREE_HEIGHT = 20
    ETH_AMOUNT = configsJson.eth_amount
    GENESIS_BLOCK = configsJson.genesis_block
    senderAccount = (await web3.eth.getAccounts())[0]
    nftAddress = configsJson.nft_address
    flexclubAddress = configsJson.flexclub_address
  } else {
    // Initialize from local node
    web3 = new Web3(rpc, null, { transactionConfirmationBlocks: 1 })
    netId = await web3.eth.net.getId()
    GENESIS_BLOCK = 0
    contractJson = require(__dirname + '/../build/contracts/ETHFlexClub.json')
    contractNFTJson = require(__dirname + '/../build/contracts/FlexNFT.json')
    circuit = require(__dirname + '/../build/circuits/withdraw.json')
    proving_key = fs.readFileSync(__dirname + '/../build/circuits/withdraw_proving_key.bin').buffer
    MERKLE_TREE_HEIGHT = process.env.MERKLE_TREE_HEIGHT || 20
    ETH_AMOUNT = process.env.ETH_AMOUNT
    PRIVATE_KEY = process.env.PRIVATE_KEY
    if (PRIVATE_KEY) {
      const account = web3.eth.accounts.privateKeyToAccount('0x' + PRIVATE_KEY)
      web3.eth.accounts.wallet.add('0x' + PRIVATE_KEY)
      web3.eth.defaultAccount = account.address
      senderAccount = account.address
    } else {
      console.log('Warning! PRIVATE_KEY not found. Please provide PRIVATE_KEY in .env file if you deposit')
    }
    erc20ContractJson = require(__dirname + '/../build/contracts/ERC20Mock.json')
    console.log(netId)
    flexclubAddress = contractJson.networks[netId].address
    nftAddress = contractNFTJson.networks[netId].address
  }
  netId = await web3.eth.net.getId()
  // groth16 initialises a lot of Promises that will never be resolved, that's why we need to use process.exit to terminate the CLI
  groth16 = await buildGroth16()

  if (noteNetId && Number(noteNetId) !== netId) {
    throw new Error('This note is for a different network. Specify the --rpc option explicitly')
  }
  console.log('netId:', netId)
  isLocalRPC = netId > 42

  senderAccount = (await web3.eth.getAccounts())[0]

  flexclub = new web3.eth.Contract(contractJson.abi, flexclubAddress)
  erc20 = currency !== 'eth' ? new web3.eth.Contract(erc20ContractJson.abi, tokenAddress) : {}
  flexnft = new web3.eth.Contract(contractNFTJson.abi, nftAddress)
  console.log('nftAddress:', nftAddress)
}

async function main() {
  if (inBrowser) {
    let instance = { currency: 'eth' }
    await init(instance)
    instance = { currency: 'eth', amount: ETH_AMOUNT }
    window.connect = async () => {
      if (window.ethereum) {
        await window.ethereum.request({ method: 'eth_requestAccounts' })
        web3 = new Web3(window.ethereum)
      } else {
        alert('Not able to connect to metamask!!')
        return
      }
    }
    window.deposit = async () => {
      await deposit(instance)
    }
    window.mintNFT = async () => {
      // const noteString = prompt('Enter the note to mintNFT')
      const noteString = document.getElementById('mint-note-textarea').value
      const recipient = (await web3.eth.getAccounts())[0]

      const { currency, amount, netId, deposit } = parseNote(noteString)
      await init({ noteNetId: netId, currency, amount })
      await mintNFT({ deposit, currency, recipient })
    }
    window.withdraw = async () => {
      const noteString = prompt('Wait the minimum block numbers to withdraw (type OK)')
      if (noteString.toLowerCase() === 'ok') {
        await withdraw(instance)
      }
    }
  } else {
    program
      .option('-r, --rpc <URL>', 'The RPC, CLI should interact with', 'http://localhost:8545')
      .option('-R, --relayer <URL>', 'Withdraw via relayer')
    program
      .command('deposit <currency> <amount>')
      .description('Submit a deposit of specified currency and amount from default eth account and return the resulting note. The currency is one of (ETH|DAI|cDAI|USDC|cUSDC|USDT). The amount depends on currency, see config.js file or visit https://flexclub.cash.')
      .action(async (currency, amount) => {
        currency = currency.toLowerCase()
        await init({ rpc: program.rpc, currency, amount })
        await deposit({ currency, amount })
      })
    program
      .command('mintNFT <note> <recipient> [ETH_purchase]')
      .description('mintNFT a note to a recipient account using relayer or specified private key. You can exchange some of your deposit`s tokens to ETH during the withdrawal by specifing ETH_purchase (e.g. 0.01) to pay for gas in future transactions. Also see the --relayer option.')
      .action(async (noteString, recipient, refund) => {
        const { currency, amount, netId, deposit } = parseNote(noteString)
        await init({ rpc: program.rpc, noteNetId: netId, currency, amount })
        await mintNFT({ deposit, currency, recipient, refund, relayerURL: program.relayer })
      })
    program
      .command('withdraw ')
      .description('Withdraw balance amount using specified private key. You can exchange some of your deposit`s tokens to ETH during the withdrawal by specifing ETH_purchase (e.g. 0.01) to pay for gas in future transactions. Also see the --relayer option.')
      .action(async (noteString, recipient, refund) => {
        await init({ rpc: program.rpc, noteNetId: netId })
        await withdraw({ refund, relayerURL: program.relayer })
      })
    program
      .command('balance <address> [token_address]')
      .description('Check ETH and ERC20 balance')
      .action(async (address, tokenAddress) => {
        await init({ rpc: program.rpc })
        await printETHBalance({ address, name: '' })
        if (tokenAddress) {
          await printERC20Balance({ address, name: '', tokenAddress })
        }
      })
    program
      .command('balance-nft <address> [token_address]')
      .description('Check NFT balance')
      .action(async (address) => {
        await init({ rpc: program.rpc })
        await printETHBalance({ address, name: '' })
        if (flexnft) {
          await printNFTBalance({ address, name: '' })
        } else {
          console.log('failed to initialize nft contract')
        }
      })
    program
      .command('compliance <note>')
      .description('Shows the deposit and withdrawal of the provided note. This might be necessary to show the origin of assets held in your withdrawal address.')
      .action(async (noteString) => {
        const { currency, amount, netId, deposit } = parseNote(noteString)
        await init({ rpc: program.rpc, noteNetId: netId, currency, amount })
        const depositInfo = await loadDepositData({ deposit })
        const depositDate = new Date(depositInfo.timestamp * 1000)
        console.log('\n=============Deposit=================')
        console.log('Deposit     :', amount, currency)
        console.log('Date        :', depositDate.toLocaleDateString(), depositDate.toLocaleTimeString())
        console.log('From        :', `https://${getCurrentNetworkName()}etherscan.io/address/${depositInfo.from}`)
        console.log('Transaction :', `https://${getCurrentNetworkName()}etherscan.io/tx/${depositInfo.txHash}`)
        console.log('Commitment  :', depositInfo.commitment)
        if (deposit.isSpent) {
          console.log('The note was not spent')
        }

        const withdrawInfo = await loadWithdrawalData({ amount, currency, deposit })
        const withdrawalDate = new Date(withdrawInfo.timestamp * 1000)
        console.log('\n=============Withdrawal==============')
        console.log('Withdrawal  :', withdrawInfo.amount, currency)
        console.log('Relayer Fee :', withdrawInfo.fee, currency)
        console.log('Date        :', withdrawalDate.toLocaleDateString(), withdrawalDate.toLocaleTimeString())
        console.log('To          :', `https://${getCurrentNetworkName()}etherscan.io/address/${withdrawInfo.to}`)
        console.log('Transaction :', `https://${getCurrentNetworkName()}etherscan.io/tx/${withdrawInfo.txHash}`)
        console.log('Nullifier   :', withdrawInfo.nullifier)
      })
    program
      .command('test')
      .description('Perform an automated test. It deposits and withdraws one ETH and one ERC20 note. Uses ganache.')
      .action(async () => {
        console.log('Start performing ETH deposit-withdraw test')
        let currency = 'eth'
        let amount = '0.1'
        await init({ rpc: program.rpc, currency, amount })
        let noteString = await deposit({ currency, amount })
        let parsedNote = parseNote(noteString)
        await withdraw({ deposit: parsedNote.deposit, currency, amount, recipient: senderAccount, relayerURL: program.relayer })

        console.log('\nStart performing DAI deposit-withdraw test')
        currency = 'dai'
        amount = '100'
        await init({ rpc: program.rpc, currency, amount })
        noteString = await deposit({ currency, amount })
        (parsedNote = parseNote(noteString))
        await withdraw({ deposit: parsedNote.deposit, currency, amount, recipient: senderAccount, refund: '0.02', relayerURL: program.relayer })
      })
    try {
      await program.parseAsync(process.argv)
      process.exit(0)
    } catch (e) {
      console.log('Error:', e)
      process.exit(1)
    }
  }
}

main()
