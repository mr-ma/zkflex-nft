// Generates Hasher artifact at compile-time using Truffle's external compiler
// mechanism
const path = require('path')
const fs = require('fs')
const { mimcSpongecontract } = require('circomlibjs')

// where Truffle will expect to find the results of the external compiler
// command
const outputPath = path.join(__dirname, '..', 'build', 'Hasher.json')

function main() {
  const contract = {
    contractName: 'Hasher',
    abi: mimcSpongecontract.abi,
    bytecode: mimcSpongecontract.createCode('mimcsponge', 220),
  }

  fs.writeFileSync(outputPath, JSON.stringify(contract))
}

main()
