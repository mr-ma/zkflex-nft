require('dotenv').config()
// const { TruffleProvider } = require("@harmony-js/core")

const HDWalletProvider = require('@truffle/hdwallet-provider')
const utils = require('web3-utils')


//Local
const local_mnemonic = process.env.LOCAL_MNEMONIC
const local_private_key = process.env.LOCAL_PRIVATE_KEY
const local_url = process.env.LOCAL_0_URL

//Testnet
const testnet_mnemonic = process.env.TESTNET_MNEMONIC
const testnet_private_key = process.env.TESTNET_PRIVATE_KEY
const testnet_url = process.env.TESTNET_0_URL

//GAS - Currently using same GAS accross all environments
const gasLimit = process.env.GAS_LIMIT
const gasPrice = process.env.GAS_PRICE

module.exports = {
  /**
   * Networks define how you connect to your ethereum client and let you set the
   * defaults web3 uses to send transactions. If you don't specify one truffle
   * will spin up a development blockchain for you on port 9545 when you
   * run `develop` or `test`. You can ask a truffle command to use a specific
   * network from the command line, e.g
   *
   * $ truffle test --network <network-name>
   */

  networks: {
    development: {
      host: '127.0.0.1', // Localhost (default: none)
      port: 8545, // Standard Ethereum port (default: none)
      network_id: '*', // Any network (default: none)
    },
    // local: {
    //   network_id: '2', // Any network (default: none)
    //   provider: () => {
    //     const truffleProvider = new TruffleProvider(
    //       local_url,
    //       { memonic: local_mnemonic },
    //       { shardID: 0, chainId: 2 },
    //       { gasLimit: gasLimit, gasPrice: gasPrice },
    //     )
    //     const newAcc = truffleProvider.addByPrivateKey(local_private_key)
    //     truffleProvider.setSigner(newAcc)
    //     return truffleProvider
    //   },
    // },
    local: {
      provider: () => {
        return new HDWalletProvider({
          local_mnemonic,
          providerOrUrl: local_url, // https://api.s0.t.hmny.io for mainnet
          derivationPath: `m/44'/1023'/0'/0/`
        })
      },
      network_id: 1666700000, // 1666600000 for mainnet
    },
    testnetHar: {
      provider: () => {
        if (!local_private_key.trim()) {
          throw new Error (
            'Please enter a private key with funds, you can use the default one'
          )
        }
        return new HDWalletProvider({
          privateKeys: [testnet_private_key],
          providerOrUrl: testnet_url,
          gasLimit: gasLimit,
          gasPrice: gasPrice,
        })
      },
      network_id: 1666700000,
    },
    // testnet: {
    //   network_id: '2', // Any network (default: none)
    //   provider: () => {
    //     const truffleProvider = new TruffleProvider(
    //       testnet_url,
    //       { memonic: testnet_mnemonic },
    //       { shardID: 0, chainId: 2 },
    //       { gasLimit: gasLimit * 9000, gasPrice: gasPrice * 9000 },
    //     )
    //     const newAcc = truffleProvider.addByPrivateKey(testnet_private_key)
    //     truffleProvider.setSigner(newAcc)
    //     return truffleProvider
    //   },
    // },
    kovan: {
      provider: () =>
        new HDWalletProvider(
          process.env.PRIVATE_KEY,
          'https://kovan.infura.io/v3/97c8bf358b9942a9853fab1ba93dc5b3',
        ),
      network_id: 42,
      gas: 6000000,
      gasPrice: utils.toWei('1', 'gwei'),
      // confirmations: 0,
      // timeoutBlocks: 200,
      skipDryRun: true,
    },
    goerli: {
      provider: () =>
        new HDWalletProvider(
          process.env.PRIVATE_KEY,
          'https://goerli.infura.io/v3/d34c08f2cb7c4111b645d06ac7e35ba8',
        ),
      network_id: 5,
      gas: 6000000,
      gasPrice: utils.toWei('1', 'gwei'),
      // confirmations: 0,
      // timeoutBlocks: 200,
      skipDryRun: true,
    },
    rinkeby: {
      provider: () =>
        new HDWalletProvider(
          process.env.PRIVATE_KEY,
          'https://rinkeby.infura.io/v3/97c8bf358b9942a9853fab1ba93dc5b3',
        ),
      network_id: 4,
      gas: 6000000,
      gasPrice: utils.toWei('1', 'gwei'),
      // confirmations: 0,
      // timeoutBlocks: 200,
      skipDryRun: true,
    },
    mainnet: {
      provider: () => new HDWalletProvider(process.env.PRIVATE_KEY, 'http://ethereum-rpc.trustwalletapp.com'),
      network_id: 1,
      gas: 6000000,
      gasPrice: utils.toWei('2', 'gwei'),
      // confirmations: 0,
      // timeoutBlocks: 200,
      skipDryRun: true,
    },
  },

  mocha: {
    // timeout: 100000
  },

  // Configure your compilers
  compilers: {
    solc: {
      version: '0.7.6',
      settings: {
        optimizer: {
          enabled: true,
          runs: 200,
        },
      },
    },
    external: {
      command: 'node ./scripts/compileHasher.js',
      targets: [
        {
          path: './build/Hasher.json',
        },
      ],
    },
  },

  plugins: ['solidity-coverage'],
}
