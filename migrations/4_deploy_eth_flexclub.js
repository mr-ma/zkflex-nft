/* global artifacts */
require('dotenv').config({ path: '../.env' })
var fs = require('fs')

const ETHFlexClub = artifacts.require('ETHFlexClub')
const FlexNFT = artifacts.require('FlexNFT')
const Verifier = artifacts.require('Verifier')
const Hasher = artifacts.require('Hasher')

module.exports = function (deployer) {
  return deployer.then(async () => {
    const {
      Token_Base_URI,
      Token_Name,
      Token_Symbol,
      Minimum_Wait_Blocks,
      MERKLE_TREE_HEIGHT,
      ETH_AMOUNT,
    } = process.env
    const verifier = await Verifier.deployed()
    const hasher = await Hasher.deployed()
    const flexnft = await deployer.deploy(FlexNFT, Token_Base_URI, Token_Name, Token_Symbol)
    console.log('FlexNFT address', flexnft.address)
    const flexclub = await deployer.deploy(
      ETHFlexClub,
      verifier.address,
      hasher.address,
      ETH_AMOUNT,
      MERKLE_TREE_HEIGHT,
      flexnft.address,
      Minimum_Wait_Blocks,
    )
    await flexnft.initialize(flexclub.address)
    console.log('ETHFlexClub address', flexclub.address)
    var obj = {
      flexclub_address: flexclub.address,
      flexnft_address: flexnft.address,
      eth_amount: ETH_AMOUNT,
      genesis_block: 24808523, //merkle root computed from here on
    }
    fs.writeFileSync('config.json', JSON.stringify(obj))
  })
}
