import { Account, RpcProvider } from 'starknet'
import { STELA_ADDRESS, toU256 } from '@stela/core'

const provider = new RpcProvider({ nodeUrl: process.env.RPC_URL! })
const account = new Account(
  provider,
  process.env.BOT_ADDRESS!,
  process.env.BOT_PRIVATE_KEY!
)

export async function liquidate(agreementId: string): Promise<string> {
  const { transaction_hash } = await account.execute({
    contractAddress: STELA_ADDRESS.sepolia,
    entrypoint: 'liquidate',
    calldata: [...toU256(BigInt(agreementId))],
  })

  await provider.waitForTransaction(transaction_hash)
  return transaction_hash
}
