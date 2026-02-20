import { Account, RpcProvider } from 'starknet'
import { toU256 } from '@stela/core'
import { CONTRACT_ADDRESS, RPC_URL, BOT_ADDRESS, TX_TIMEOUT_MS } from './config.js'

const provider = new RpcProvider({ nodeUrl: RPC_URL })

// Read private key directly — never exported as a module constant
const account = new Account(provider, BOT_ADDRESS, process.env.BOT_PRIVATE_KEY!)

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Transaction timed out after ${ms}ms`)), ms)
    ),
  ])
}

export async function liquidate(inscriptionId: string): Promise<string> {
  const { transaction_hash } = await account.execute({
    contractAddress: CONTRACT_ADDRESS,
    entrypoint: 'liquidate',
    calldata: [...toU256(BigInt(inscriptionId))],
  })

  await withTimeout(provider.waitForTransaction(transaction_hash), TX_TIMEOUT_MS)
  return transaction_hash
}
