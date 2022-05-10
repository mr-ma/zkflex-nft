const fs = require('fs')
const { buildBabyjub, buildPedersenHash } = require('circomlibjs')
const snarkjs = require('snarkjs')
const bigInt = require('./bigint.js')
const Bn128 = require("./bn128.js");
const bn128 = new Bn128()
const crypto = require('crypto')
const buildCalculator = require('../build/circuits/withdraw_js/witness_calculator')
const { stringifyBigInts, unstringifyBigInts } = require('websnark/tools/stringifybigint')
const { toBN, randomHex, hexToBytes, bytesToHex } = require('web3-utils')
const rbigint = (nbytes) => bigInt.leBuff2int(crypto.randomBytes(nbytes))
const MerkleTree = require('fixed-merkle-tree')
const wasm = fs.readFileSync('build/circuits/withdraw_js/withdraw.wasm')
const zkey = fs.readFileSync('build/circuits/zkeys/withdraw.zkey')

function snarkVerify(proof) {
    // proof = unstringifyBigInts2(proof)
    // const verification_key = unstringifyBigInts2(require('../build/circuits/withdraw_verification_key.json'))
    return snarkjs.groth16.verify(zkey, proof, proof.publicSignals)
}

function generateDeposit() {
    let deposit = {
        secret: rbigint(31),
        nullifier: rbigint(31),
    }
    const preimage = Buffer.concat([
        deposit.nullifier.leInt2Buff(31),
        deposit.secret.leInt2Buff(31),
    ])
    deposit.commitment = bigInt.leBuff2int(pedersenHash(preimage))
    return deposit
}
async function generateProof(input) {
    console.log(input)
    const wtns = await calculator.calculateWTNSBin(input, 0)
    const { proof } = await snarkjs.groth16.prove(zkey, wtns)
    return {
        a: [proof.pi_a[0], proof.pi_a[1]],
        b: [proof.pi_b[0].reverse(), proof.pi_b[1].reverse()],
        c: [proof.pi_c[0], proof.pi_c[1]],
    }
}

function vfunpackPoint(_buff) {
    exports.p = bn128.r
    exports.A = bigInt("168700")
    exports.D = bigInt("168696")
    
    const F = bn128.Fr

    const buff = Buffer.from(_buff);
    let sign = false;
    const P = new Array(2);
    if (buff[31] & 0x80) {
        sign = true;
        buff[31] = buff[31] & 0x7F;
    }
    P[1] = bigInt.leBuff2int(buff);
    if (P[1].greaterOrEquals(exports.p)) return null;

    console.log(F.square)
    const y2 = F.square(P[1]);

    console.log(exports.D, y2)
    let x = F.sqrt(F.div(
        F.sub(F.one, y2),
        F.sub(exports.A, F.mul(exports.D, y2))));

    if (x == null) return null;

    if (sign) x = F.neg(x);

    P[0] = F.affine(x);

    return P;
}

let pedersenHash, calculator
async function runTest() {
    console.log(bn128)
    calculator = await buildCalculator(wasm)
    const babyJub = await buildBabyjub()
    const builderHash = await buildPedersenHash()
    pedersenHash = (data) => vfunpackPoint(builderHash.hash(data))[0]
    const tree = new MerkleTree(20)
    // const fee = 1e17 //BigInt(ETH_AMOUNT).shr(1) || bigInt(1e17)
    // const refund = 1e17 //bigInt(0)
    // const recipient = "101598740759196034883615384533344528490047850726"

    const deposit = generateDeposit()
    console.log(deposit)
    tree.insert(deposit.commitment)
    const { pathElements, pathIndices } = tree.path(0)

    const input = stringifyBigInts({
    // const input = {
        root: tree.root(),
        nullifierHash: pedersenHash(deposit.nullifier.leInt2Buff(31)),
        nullifier: deposit.nullifier,
        // relayer: "0x6620aFc6Df24cBef6b81793169CF85Cf3eACD861",
        // recipient,
        // fee,
        // refund,
        secret: deposit.secret,
        pathElements: pathElements,
        pathIndices: pathIndices,
    })

    // let proofData = await websnarkUtils.genWitnessAndProve(groth16, input, circuit, proving_key)
    let proofData = await generateProof(input)
    // const originalProof = JSON.parse(JSON.stringify(proofData))
    let result = snarkVerify(proofData)
    result.should.be.equal(true)

    // // nullifier
    // proofData.publicSignals[1] =
    //     '133792158246920651341275668520530514036799294649489851421007411546007850802'
    // result = snarkVerify(proofData)
    // result.should.be.equal(false)
    // proofData = originalProof

    // // try to cheat with recipient
    // proofData.publicSignals[2] = '133738360804642228759657445999390850076318544422'
    // result = snarkVerify(proofData)
    // result.should.be.equal(false)
    // proofData = originalProof

    // // fee
    // proofData.publicSignals[3] = '1337100000000000000000'
    // result = snarkVerify(proofData)
    // result.should.be.equal(false)
    // proofData = originalProof
}

runTest()
