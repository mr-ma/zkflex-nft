# ZKFlex NFT (built from [tornado-core](https://github.com/tornadocash/tornado-core))
This is a decentralized application that allows users to mint wealth-flex NFTs without revealing their identity.

## Application type
zkDAO

## Overview
AnonyFlex enables users to flex their wealth with privacy. Users deposit 100 ETH (ONE) into the mixer in exchange of which they get a credit note (secret note) to mint wealth-flex NFTs. Any wallet presenting a valid credit note will be able to mint a flex NFT club token (FNC). FNC tokens are non transferable making deposits to the mixer a must for users. User balances are redeemable almost immediately (after 2 blocks) after deposit.

## Use Cases
This application will serve as a DAO tool to allow decentralized organizations to authenticate users based upon their net worth without violating their privacy. According to the Messari Report, DAO tooling is an existential need right now across crypto communities and privacy has always been a major concern in the blockchain space. A major problem when joining blockchain communities is privacy. On the one hand, it is important for a community to know the newcomers' merits. On the other hand, it is important for new members to be able to protect their privacy. The problem here is how can a new member prove their merits without revealing their identity.

In this project we realize one aspect of new members' merit, i.e., net worth, with full privacy guarantees


## Requirements

1. `node v11.15.0`
2. `npm install -g npx`

## Usage

You can see example usage in cli.js, it works both in the console and in the browser.

1. `npm install`
1. `cp .env.example .env`
1. `npm run build` - this may take 10 minutes or more
1. `npx ganache-cli`
1. `npm run test` - optionally runs tests. It may fail on the first try, just run it again.

Use browser version on Kovan:

1. `vi .env` - add your Kovan private key to deploy contracts
1. `npm run migrate`
1. `npx http-server` - serve current dir, you can use any other static http server
1. Open `localhost:8080`

Use the command-line version. Works for Ganache, Kovan, and Mainnet:

### Initialization

1. `cp .env.example .env`
1. `npm run download`
1. `npm run build:contract`

### Ganache

1. make sure you complete steps from Initialization
1. `ganache-cli -i 1337`
1. `npm run migrate:dev`
1. `./cli.js test`
1. `./cli.js --help`

### CLI

```bash
./cli.js deposit ETH 0.1 --rpc http://127.0.0.1:8545
```

> Your note: flexclub-eth-0.1-42-0xf73dd6833ccbcc046c44228c8e2aa312bf49e08389dadc7c65e6a73239867b7ef49c705c4db227e2fadd8489a494b6880bdcb6016047e019d1abec1c7652
> FlexClub ETH balance is 8.9
> Sender account ETH balance is 1004873.470619891361352542
> Submitting deposit transaction
> FlexClub ETH balance is 9
> Sender account ETH balance is 1004873.361652048361352542

```bash
./cli.js withdraw flexclub-eth-0.1-42-0xf73dd6833ccbcc046c44228c8e2aa312bf49e08389dadc7c65e6a73239867b7ef49c705c4db227e2fadd8489a494b6880bdcb6016047e019d1abec1c7652 0x8589427373D6D84E98730D7795D8f6f8731FDA16 --rpc http://127.0.0.1:8545
```

> Getting current state from FlexClub contract
> Generating SNARK proof
> Proof time: 9117.051ms
> Transaction submitted 
> Transaction mined in block 17036120
> Done

## Deploy ETH FlexClub Cash

1. `cp .env.example .env`
1. Tune all necessary params
1. `npx truffle migrate --network kovan --reset --f 2 --to 4`

## Credits

Special thanks to @barryWhiteHat and @kobigurk for valuable input,
and @jbaylina for awesome [Circom](https://github.com/iden3/circom) & [Websnark](https://github.com/iden3/websnark) framework

## Minimal demo example

1. `npm i`
1. `ganache-cli -d`
1. `npm run download`
1. `npm run build:contract`
1. `cp .env.example .env`
1. `npm run migrate:dev`
1. `node minimal-demo.js`

## Run tests/coverage

Prepare test environment:

```
   yarn install
   yarn download
   cp .env.example .env
   npx ganache-cli > /dev/null &
   npm run migrate:dev
```

Run tests:

```
   yarn test
```

Run coverage:

```
   yarn coverage
```

## Emulate MPC trusted setup ceremony

```bash
cargo install zkutil
npx circom circuits/withdraw.circom -o build/circuits/withdraw.json
zkutil setup -c build/circuits/withdraw.json -p build/circuits/withdraw.params
zkutil export-keys -c build/circuits/withdraw.json -p build/circuits/withdraw.params -r build/circuits/withdraw_proving_key.json -v build/circuits/withdraw_verification_key.json
zkutil generate-verifier -p build/circuits/withdraw.params -v build/circuits/Verifier.sol
sed -i -e 's/pragma solidity \^0.6.0/pragma solidity 0.5.17/g' ./build/circuits/Verifier.sol
```
