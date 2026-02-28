#!/usr/bin/env node
/**
 * End-to-end test for the Stela off-chain order flow:
 *
 *   1. Check balances & approve tokens
 *   2. Borrower signs SNIP-12 InscriptionOrder off-chain
 *   3. POST order to API
 *   4. Lender signs SNIP-12 LendOffer off-chain
 *   5. POST offer to API
 *   6. Bot account calls settle() on-chain
 *   7. Verify inscription exists on-chain
 */

import {
  Account,
  RpcProvider,
  Contract,
  hash,
  typedData as starknetTypedData,
  uint256,
  stark,
  CallData,
} from 'starknet'

// ─── Config ───────────────────────────────────────────────────────────────────

const RPC_URL = 'https://rpc.starknet-testnet.lava.build'
const STELA_ADDRESS = '0x076ca0af65ad05398076ddc067dc856a43dc1c665dc2898aea6b78dd3e120822'
const API_BASE = 'https://stela-dapp.xyz'

// Sepolia tokens
const ETH_ADDRESS  = '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7'
const STRK_ADDRESS = '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d'

// Accounts
const BORROWER = {
  address: '0x005441affcd25fe95554b13690346ebec62a27282327dd297cab01a897b08310',
  privateKey: '0x4b1f6975b16676007b2fb0a87debe5a8c6fdd4f79bf1060931bcfbb5f33218f',
}
const LENDER = {
  address: '0x024a7abe720dabf8fc221f9bca11e6d5ada55589028aa6655099289e87dffb1b',
  privateKey: '0x49671d3072bea599eddbcb0f9a34e2c8c21a0ecf20e4e36ff3c33895eac721c',
}
const BOT = {
  address: '0x05f9b3f0bf7a3231bc4c34fc53624b2b016d9a819813d6161c9aec13dc8a379a',
  privateKey: '0x2291ff0a5478d67ec8856fcd89e77505c78602e6736f6710c181fa3fd2fc5f6',
}

// Asset type enum values (matches Cairo)
const ASSET_TYPE = { ERC20: 0, ERC721: 1, ERC1155: 2, ERC4626: 3 }

// ─── Helpers ──────────────────────────────────────────────────────────────────

const provider = new RpcProvider({ nodeUrl: RPC_URL })
const borrowerAccount = new Account(provider, BORROWER.address, BORROWER.privateKey)
const lenderAccount = new Account(provider, LENDER.address, LENDER.privateKey)
const botAccount = new Account(provider, BOT.address, BOT.privateKey)

const ERC20_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    inputs: [{ name: 'account', type: 'felt' }],
    outputs: [{ name: 'balance', type: 'Uint256' }],
    stateMutability: 'view',
  },
  {
    name: 'balance_of',
    type: 'function',
    inputs: [{ name: 'account', type: 'core::starknet::contract_address::ContractAddress' }],
    outputs: [{ name: 'balance', type: 'core::integer::u256' }],
    stateMutability: 'view',
  },
  {
    name: 'approve',
    type: 'function',
    inputs: [
      { name: 'spender', type: 'core::starknet::contract_address::ContractAddress' },
      { name: 'amount', type: 'core::integer::u256' },
    ],
    outputs: [{ name: 'success', type: 'core::bool' }],
  },
  {
    name: 'allowance',
    type: 'function',
    inputs: [
      { name: 'owner', type: 'core::starknet::contract_address::ContractAddress' },
      { name: 'spender', type: 'core::starknet::contract_address::ContractAddress' },
    ],
    outputs: [{ name: 'remaining', type: 'core::integer::u256' }],
    stateMutability: 'view',
  },
]

function toU256(n) {
  const { low, high } = uint256.bnToUint256(n)
  return [low.toString(), high.toString()]
}

function hashAssets(assets) {
  const elements = [String(assets.length)]
  for (const asset of assets) {
    elements.push(asset.asset_address)
    elements.push(String(ASSET_TYPE[asset.asset_type]))
    const [vLow, vHigh] = toU256(asset.value)
    elements.push(vLow, vHigh)
    const [tidLow, tidHigh] = toU256(asset.token_id)
    elements.push(tidLow, tidHigh)
  }
  return hash.computePoseidonHashOnElements(elements)
}

function log(step, msg) {
  console.log(`\n[${'✓'.padEnd(2)}] Step ${step}: ${msg}`)
}

function logDetail(msg) {
  console.log(`    ${msg}`)
}

function fail(step, msg) {
  console.error(`\n[✗] Step ${step}: ${msg}`)
  process.exit(1)
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════════════')
  console.log('  Stela E2E Test — Off-chain Order → Settlement Flow')
  console.log('═══════════════════════════════════════════════════════════')
  console.log(`  Contract: ${STELA_ADDRESS}`)
  console.log(`  API:      ${API_BASE}`)
  console.log(`  Borrower: ${BORROWER.address}`)
  console.log(`  Lender:   ${LENDER.address}`)
  console.log(`  Bot:      ${BOT.address}`)
  console.log('═══════════════════════════════════════════════════════════')

  // ── Step 1: Check balances ──────────────────────────────────────────────

  log(1, 'Checking token balances...')

  const ethContract = new Contract(ERC20_ABI, ETH_ADDRESS, provider)
  const strkContract = new Contract(ERC20_ABI, STRK_ADDRESS, provider)

  const borrowerEth = await ethContract.call('balance_of', [BORROWER.address])
  const borrowerStrk = await strkContract.call('balance_of', [BORROWER.address])
  const lenderEth = await ethContract.call('balance_of', [LENDER.address])
  const lenderStrk = await strkContract.call('balance_of', [LENDER.address])
  const botStrk = await strkContract.call('balance_of', [BOT.address])

  const formatBal = (b) => {
    const val = typeof b === 'bigint' ? b : (b.balance ?? b)
    return `${(Number(val) / 1e18).toFixed(6)}`
  }

  logDetail(`Borrower — ETH: ${formatBal(borrowerEth)} | STRK: ${formatBal(borrowerStrk)}`)
  logDetail(`Lender   — ETH: ${formatBal(lenderEth)} | STRK: ${formatBal(lenderStrk)}`)
  logDetail(`Bot      — STRK: ${formatBal(botStrk)} (for gas)`)

  // Use small amounts for the test
  // Borrower wants to borrow 0.0001 ETH, offering 0.0001 STRK as collateral,
  // with 0.00001 ETH as interest
  const DEBT_AMOUNT     = BigInt('100000000000000')    // 0.0001 ETH
  const COLLATERAL_AMT  = BigInt('100000000000000')    // 0.0001 STRK
  const INTEREST_AMOUNT = BigInt('10000000000000')     // 0.00001 ETH

  // ── Step 2: Approve tokens ──────────────────────────────────────────────

  log(2, 'Approving tokens for Stela contract...')

  // Borrower approves STRK (collateral) for the Stela contract
  const MAX_U128 = (1n << 128n) - 1n
  const approvalAmount = MAX_U128

  try {
    const borrowerApproveTx = await borrowerAccount.execute({
      contractAddress: STRK_ADDRESS,
      entrypoint: 'approve',
      calldata: CallData.compile({
        spender: STELA_ADDRESS,
        amount: uint256.bnToUint256(approvalAmount),
      }),
    })
    await provider.waitForTransaction(borrowerApproveTx.transaction_hash)
    logDetail(`Borrower approved STRK for collateral — tx: ${borrowerApproveTx.transaction_hash}`)
  } catch (err) {
    fail(2, `Borrower STRK approval failed: ${err.message}`)
  }

  // Lender approves ETH (debt) for the Stela contract
  try {
    const lenderApproveTx = await lenderAccount.execute({
      contractAddress: ETH_ADDRESS,
      entrypoint: 'approve',
      calldata: CallData.compile({
        spender: STELA_ADDRESS,
        amount: uint256.bnToUint256(approvalAmount),
      }),
    })
    await provider.waitForTransaction(lenderApproveTx.transaction_hash)
    logDetail(`Lender approved ETH for debt — tx: ${lenderApproveTx.transaction_hash}`)
  } catch (err) {
    fail(2, `Lender ETH approval failed: ${err.message}`)
  }

  // ── Step 3: Read nonces from contract ───────────────────────────────────

  log(3, 'Reading on-chain nonces...')

  const stelaContract = new Contract(
    [
      {
        name: 'nonces',
        type: 'function',
        inputs: [{ name: 'owner', type: 'core::starknet::contract_address::ContractAddress' }],
        outputs: [{ name: 'nonce', type: 'core::felt252' }],
        stateMutability: 'view',
      },
      {
        name: 'get_relayer_fee',
        type: 'function',
        inputs: [],
        outputs: [{ name: 'fee', type: 'core::integer::u256' }],
        stateMutability: 'view',
      },
    ],
    STELA_ADDRESS,
    provider,
  )

  const borrowerNonce = await stelaContract.call('nonces', [BORROWER.address])
  const lenderNonce = await stelaContract.call('nonces', [LENDER.address])
  const relayerFee = await stelaContract.call('get_relayer_fee')

  const bnonce = typeof borrowerNonce === 'bigint' ? borrowerNonce : BigInt(String(borrowerNonce))
  const lnonce = typeof lenderNonce === 'bigint' ? lenderNonce : BigInt(String(lenderNonce))
  const rfee = typeof relayerFee === 'bigint' ? relayerFee : BigInt(String(relayerFee))

  logDetail(`Borrower nonce: ${bnonce}`)
  logDetail(`Lender nonce:   ${lnonce}`)
  logDetail(`Relayer fee:    ${rfee} BPS`)

  // ── Step 4: Borrower signs InscriptionOrder off-chain ───────────────────

  log(4, 'Borrower signing InscriptionOrder off-chain...')

  const debtAssets = [
    { asset_address: ETH_ADDRESS, asset_type: 'ERC20', value: DEBT_AMOUNT, token_id: 0n },
  ]
  const interestAssets = [
    { asset_address: ETH_ADDRESS, asset_type: 'ERC20', value: INTEREST_AMOUNT, token_id: 0n },
  ]
  const collateralAssets = [
    { asset_address: STRK_ADDRESS, asset_type: 'ERC20', value: COLLATERAL_AMT, token_id: 0n },
  ]

  const duration = 3600n  // 1 hour
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 7200) // 2 hours from now

  const debtHash = hashAssets(debtAssets)
  const interestHash = hashAssets(interestAssets)
  const collateralHash = hashAssets(collateralAssets)

  logDetail(`Debt hash:       ${debtHash}`)
  logDetail(`Interest hash:   ${interestHash}`)
  logDetail(`Collateral hash: ${collateralHash}`)

  const chainId = await provider.getChainId()
  logDetail(`Chain ID: ${chainId}`)

  const orderTypedData = {
    types: {
      StarknetDomain: [
        { name: 'name', type: 'shortstring' },
        { name: 'version', type: 'shortstring' },
        { name: 'chainId', type: 'shortstring' },
        { name: 'revision', type: 'shortstring' },
      ],
      InscriptionOrder: [
        { name: 'borrower', type: 'ContractAddress' },
        { name: 'debt_hash', type: 'felt' },
        { name: 'interest_hash', type: 'felt' },
        { name: 'collateral_hash', type: 'felt' },
        { name: 'debt_count', type: 'u128' },
        { name: 'interest_count', type: 'u128' },
        { name: 'collateral_count', type: 'u128' },
        { name: 'duration', type: 'u128' },
        { name: 'deadline', type: 'u128' },
        { name: 'multi_lender', type: 'bool' },
        { name: 'nonce', type: 'felt' },
      ],
    },
    primaryType: 'InscriptionOrder',
    domain: { name: 'Stela', version: 'v1', chainId, revision: '1' },
    message: {
      borrower: BORROWER.address,
      debt_hash: debtHash,
      interest_hash: interestHash,
      collateral_hash: collateralHash,
      debt_count: '1',
      interest_count: '1',
      collateral_count: '1',
      duration: duration.toString(),
      deadline: deadline.toString(),
      multi_lender: false,
      nonce: bnonce.toString(),
    },
  }

  const borrowerSig = await borrowerAccount.signMessage(orderTypedData)
  const borrowerSigArr = stark.formatSignature(borrowerSig)
  logDetail(`Borrower signature: [${borrowerSigArr[0].slice(0, 16)}..., ${borrowerSigArr[1].slice(0, 16)}...]`)

  // Compute the SNIP-12 message hash (this is the order_hash for the offer)
  const orderHash = starknetTypedData.getMessageHash(orderTypedData, BORROWER.address)
  logDetail(`Order hash (SNIP-12): ${orderHash}`)

  // ── Step 5: POST order to API ───────────────────────────────────────────

  log(5, 'Posting order to API...')

  const orderId = `e2e-test-${Date.now()}`
  const orderData = {
    borrower: BORROWER.address,
    debtAssets: debtAssets.map(a => ({
      asset_address: a.asset_address,
      asset_type: a.asset_type,
      value: a.value.toString(),
      token_id: a.token_id.toString(),
    })),
    interestAssets: interestAssets.map(a => ({
      asset_address: a.asset_address,
      asset_type: a.asset_type,
      value: a.value.toString(),
      token_id: a.token_id.toString(),
    })),
    collateralAssets: collateralAssets.map(a => ({
      asset_address: a.asset_address,
      asset_type: a.asset_type,
      value: a.value.toString(),
      token_id: a.token_id.toString(),
    })),
    duration: duration.toString(),
    deadline: deadline.toString(),
    multiLender: false,
    nonce: bnonce.toString(),
    debtHash,
    interestHash,
    collateralHash,
    orderHash,
  }

  const orderPayload = {
    id: orderId,
    borrower: BORROWER.address,
    order_data: orderData,
    borrower_signature: JSON.stringify({ r: borrowerSigArr[0], s: borrowerSigArr[1] }),
    nonce: bnonce.toString(),
    deadline: Number(deadline),
  }

  const postOrderRes = await fetch(`${API_BASE}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(orderPayload),
  })

  const postOrderBody = await postOrderRes.json()
  if (!postOrderRes.ok) {
    fail(5, `POST /api/orders failed: ${postOrderRes.status} — ${JSON.stringify(postOrderBody)}`)
  }
  logDetail(`Order created: ${JSON.stringify(postOrderBody)}`)

  // Verify order via GET
  const getOrderRes = await fetch(`${API_BASE}/api/orders/${orderId}`)
  const getOrderBody = await getOrderRes.json()
  if (!getOrderRes.ok) {
    fail(5, `GET /api/orders/${orderId} failed: ${getOrderRes.status}`)
  }
  logDetail(`Order retrieved: status=${getOrderBody.data?.status ?? getOrderBody.status}`)

  // ── Step 6: Lender signs LendOffer off-chain ────────────────────────────

  log(6, 'Lender signing LendOffer off-chain...')

  const bps = 10000n // 100% — lender takes the full debt

  const offerTypedData = {
    types: {
      StarknetDomain: [
        { name: 'name', type: 'shortstring' },
        { name: 'version', type: 'shortstring' },
        { name: 'chainId', type: 'shortstring' },
        { name: 'revision', type: 'shortstring' },
      ],
      LendOffer: [
        { name: 'order_hash', type: 'felt' },
        { name: 'lender', type: 'ContractAddress' },
        { name: 'issued_debt_percentage', type: 'u256' },
        { name: 'nonce', type: 'felt' },
      ],
      u256: [
        { name: 'low', type: 'u128' },
        { name: 'high', type: 'u128' },
      ],
    },
    primaryType: 'LendOffer',
    domain: { name: 'Stela', version: 'v1', chainId, revision: '1' },
    message: {
      order_hash: orderHash,
      lender: LENDER.address,
      issued_debt_percentage: {
        low: (bps & ((1n << 128n) - 1n)).toString(),
        high: (bps >> 128n).toString(),
      },
      nonce: lnonce.toString(),
    },
  }

  const lenderSig = await lenderAccount.signMessage(offerTypedData)
  const lenderSigArr = stark.formatSignature(lenderSig)
  logDetail(`Lender signature: [${lenderSigArr[0].slice(0, 16)}..., ${lenderSigArr[1].slice(0, 16)}...]`)

  // ── Step 7: POST offer to API ───────────────────────────────────────────

  log(7, 'Posting lender offer to API...')

  const offerId = `e2e-offer-${Date.now()}`
  const offerPayload = {
    id: offerId,
    lender: LENDER.address,
    bps: Number(bps),
    lender_signature: JSON.stringify({ r: lenderSigArr[0], s: lenderSigArr[1] }),
    nonce: lnonce.toString(),
  }

  const postOfferRes = await fetch(`${API_BASE}/api/orders/${orderId}/offer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(offerPayload),
  })

  const postOfferBody = await postOfferRes.json()
  if (!postOfferRes.ok) {
    fail(7, `POST offer failed: ${postOfferRes.status} — ${JSON.stringify(postOfferBody)}`)
  }
  logDetail(`Offer created: ${JSON.stringify(postOfferBody)}`)

  // Verify order is now matched
  const matchedRes = await fetch(`${API_BASE}/api/orders/${orderId}`)
  const matchedBody = await matchedRes.json()
  const matchedOrder = matchedBody.data ?? matchedBody
  logDetail(`Order status after offer: ${matchedOrder.status}`)

  if (matchedOrder.status !== 'matched') {
    fail(7, `Expected order status 'matched', got '${matchedOrder.status}'`)
  }

  // ── Step 8: Bot calls settle() on-chain ─────────────────────────────────

  log(8, 'Bot calling settle() on-chain...')

  // Build the settle calldata exactly like the bot does
  const orderCalldata = [
    BORROWER.address,
    debtHash,
    interestHash,
    collateralHash,
    '1', '1', '1',  // debt_count, interest_count, collateral_count
    duration.toString(),
    deadline.toString(),
    '0',  // multi_lender = false
    bnonce.toString(),
  ]

  const serializeAssetCalldata = (assets) => {
    const cd = [String(assets.length)]
    for (const a of assets) {
      cd.push(a.asset_address)
      cd.push(String(ASSET_TYPE[a.asset_type]))
      const [vL, vH] = toU256(a.value)
      cd.push(vL, vH)
      const [tL, tH] = toU256(a.token_id)
      cd.push(tL, tH)
    }
    return cd
  }

  const debtCalldata = serializeAssetCalldata(debtAssets)
  const interestCalldata = serializeAssetCalldata(interestAssets)
  const collateralCalldata = serializeAssetCalldata(collateralAssets)

  const borrowerSigCalldata = [String(borrowerSigArr.length), ...borrowerSigArr]

  const [bpsLow, bpsHigh] = toU256(bps)
  const offerCalldata = [
    orderHash,
    LENDER.address,
    bpsLow,
    bpsHigh,
    lnonce.toString(),
  ]

  const lenderSigCalldata = [String(lenderSigArr.length), ...lenderSigArr]

  const calldata = [
    ...orderCalldata,
    ...debtCalldata,
    ...interestCalldata,
    ...collateralCalldata,
    ...borrowerSigCalldata,
    ...offerCalldata,
    ...lenderSigCalldata,
  ]

  logDetail(`Calldata length: ${calldata.length} felts`)

  try {
    const { transaction_hash } = await botAccount.execute({
      contractAddress: STELA_ADDRESS,
      entrypoint: 'settle',
      calldata,
    })

    logDetail(`settle() tx submitted: ${transaction_hash}`)
    logDetail('Waiting for confirmation...')

    const receipt = await provider.waitForTransaction(transaction_hash)
    logDetail(`Transaction status: ${receipt.statusReceipt || receipt.execution_status}`)
    logDetail(`Block: ${receipt.block_number}`)
    logDetail(`Starkscan: https://sepolia.starkscan.co/tx/${transaction_hash}`)

    if (receipt.execution_status === 'REVERTED') {
      fail(8, `Transaction reverted: ${receipt.revert_reason}`)
    }

    // Check events
    const events = receipt.events || []
    logDetail(`Events emitted: ${events.length}`)

    // Look for OrderSettled event
    const settledEvent = events.find(e => {
      try {
        return e.keys && e.keys.length > 0 &&
          e.keys[0] === hash.getSelectorFromName('OrderSettled')
      } catch { return false }
    })

    if (settledEvent) {
      logDetail('OrderSettled event found!')
    }

  } catch (err) {
    fail(8, `settle() failed: ${err.message}`)
  }

  // ── Step 9: Verify inscription on-chain ─────────────────────────────────

  log(9, 'Verifying inscription on-chain...')

  // Read the nonces again — they should have incremented
  const newBorrowerNonce = await stelaContract.call('nonces', [BORROWER.address])
  const newLenderNonce = await stelaContract.call('nonces', [LENDER.address])

  const newBn = typeof newBorrowerNonce === 'bigint' ? newBorrowerNonce : BigInt(String(newBorrowerNonce))
  const newLn = typeof newLenderNonce === 'bigint' ? newLenderNonce : BigInt(String(newLenderNonce))

  logDetail(`Borrower nonce: ${bnonce} → ${newBn} ${newBn > bnonce ? '✓ incremented' : '✗ NOT incremented'}`)
  logDetail(`Lender nonce:   ${lnonce} → ${newLn} ${newLn > lnonce ? '✓ incremented' : '✗ NOT incremented'}`)

  if (newBn <= bnonce || newLn <= lnonce) {
    fail(9, 'Nonces did not increment — settle may not have executed correctly')
  }

  // ── Step 10: Update order status in D1 (simulating bot post-settle) ─────

  log(10, 'Verifying API reflects settlement...')

  // The live bot would update status, but since we called settle() directly,
  // the D1 status may still be 'matched'. That's expected — the bot cron
  // normally handles this. What matters is the on-chain state.
  const finalOrderRes = await fetch(`${API_BASE}/api/orders/${orderId}`)
  const finalOrder = await finalOrderRes.json()
  logDetail(`Final order status in D1: ${(finalOrder.data ?? finalOrder).status}`)
  logDetail('(Bot cron would update this to "settled" on next run)')

  // ── Summary ─────────────────────────────────────────────────────────────

  console.log('\n═══════════════════════════════════════════════════════════')
  console.log('  ✓ ALL STEPS PASSED — E2E test complete!')
  console.log('═══════════════════════════════════════════════════════════')
  console.log('  Flow verified:')
  console.log('    1. Token approvals     ✓')
  console.log('    2. Nonces read         ✓')
  console.log('    3. Borrower SNIP-12    ✓ (off-chain sign)')
  console.log('    4. Order stored in D1  ✓')
  console.log('    5. Lender SNIP-12      ✓ (off-chain sign)')
  console.log('    6. Offer stored in D1  ✓')
  console.log('    7. Bot settle() tx     ✓ (on-chain)')
  console.log('    8. Nonces incremented  ✓')
  console.log('═══════════════════════════════════════════════════════════\n')
}

main().catch(err => {
  console.error('\n[FATAL]', err)
  process.exit(1)
})
