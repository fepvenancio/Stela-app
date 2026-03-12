'use client'

import { useCallback, useState } from 'react'
import { useAccount } from '@starknet-react/core'
import { RpcProvider } from 'starknet'
import { InscriptionClient } from '@fepvenancio/stela-sdk'
import { getRenegotiationProposalTypedData } from '@/lib/offchain'
import { CONTRACT_ADDRESS, RPC_URL, CHAIN_ID } from '@/lib/config'
import { useWalletSign } from '@/hooks/useWalletSign'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/tx'

export function useRenegotiate() {
  const { address, account } = useAccount()
  const { signTypedData } = useWalletSign()
  const [isPending, setIsPending] = useState(false)

  /** Step 1: Create renegotiation proposal (off-chain) */
  const createProposal = useCallback(
    async (params: {
      inscriptionId: string
      newDuration: string
      newInterestAssets: Array<{ asset_address: string; asset_type: string; value: string; token_id?: string }>
      newInterestCount: number
      proposalDeadline: string
      nonce: bigint
    }) => {
      if (!address) throw new Error('Wallet not connected')
      setIsPending(true)
      try {
        const typedData = getRenegotiationProposalTypedData({
          inscriptionId: BigInt(params.inscriptionId),
          proposer: address,
          newDuration: BigInt(params.newDuration),
          newInterestAssets: params.newInterestAssets.map(a => ({
            asset_address: a.asset_address,
            asset_type: a.asset_type as 'ERC20' | 'ERC721' | 'ERC1155' | 'ERC4626',
            value: BigInt(a.value),
            token_id: BigInt(a.token_id ?? '0'),
          })),
          newInterestCount: params.newInterestCount,
          proposalDeadline: BigInt(params.proposalDeadline),
          nonce: params.nonce,
          chainId: CHAIN_ID,
        })

        const signature = await signTypedData(typedData)
        const proposalId = crypto.randomUUID()

        const res = await fetch('/api/renegotiations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: proposalId,
            inscription_id: params.inscriptionId,
            proposer: address,
            proposal_data: {
              inscriptionId: params.inscriptionId,
              proposer: address,
              newDuration: params.newDuration,
              newInterestAssets: params.newInterestAssets,
              newInterestCount: params.newInterestCount,
              proposalDeadline: params.proposalDeadline,
              nonce: params.nonce.toString(),
            },
            proposer_signature: signature.map(String),
            nonce: params.nonce.toString(),
            deadline: Number(params.proposalDeadline),
          }),
        })

        if (!res.ok) throw new Error(await res.text())
        toast.success('Renegotiation proposal created!')
        return proposalId
      } catch (err) {
        const msg = getErrorMessage(err)
        toast.error('Failed to create proposal', { description: msg })
        throw err
      } finally {
        setIsPending(false)
      }
    },
    [address, signTypedData],
  )

  /** Step 2: Counterparty commits renegotiation on-chain */
  const commitRenegotiation = useCallback(
    async (inscriptionId: bigint, proposalHash: string) => {
      if (!account) throw new Error('Wallet not connected')
      setIsPending(true)
      try {
        const provider = new RpcProvider({ nodeUrl: RPC_URL })
        const client = new InscriptionClient({ stelaAddress: CONTRACT_ADDRESS, provider })
        const call = client.buildCommitRenegotiation(inscriptionId, proposalHash)

        toast.info('Committing renegotiation...')
        const { transaction_hash } = await account.execute([call])
        toast.info('Waiting for confirmation...')
        await provider.waitForTransaction(transaction_hash)

        await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tx_hash: transaction_hash }),
        })

        toast.success('Renegotiation committed!')
        window.dispatchEvent(new Event('stela:sync'))
        return transaction_hash
      } catch (err) {
        const msg = getErrorMessage(err)
        toast.error('Failed to commit renegotiation', { description: msg })
        throw err
      } finally {
        setIsPending(false)
      }
    },
    [account],
  )

  /** Step 3: Execute renegotiation on-chain (after commit) */
  const executeRenegotiation = useCallback(
    async (params: {
      inscriptionId: bigint
      proposal: {
        inscriptionId: bigint
        proposer: string
        newDuration: bigint
        newInterestHash: string
        newInterestCount: number
        proposalDeadline: bigint
        nonce: bigint
      }
      proposerSig: string[]
      newInterestAssets: Array<{ asset_address: string; asset_type: 'ERC20' | 'ERC721' | 'ERC1155' | 'ERC4626'; value: bigint; token_id: bigint }>
    }) => {
      if (!account) throw new Error('Wallet not connected')
      setIsPending(true)
      try {
        const provider = new RpcProvider({ nodeUrl: RPC_URL })
        const client = new InscriptionClient({ stelaAddress: CONTRACT_ADDRESS, provider })
        const call = client.buildExecuteRenegotiation({
          inscriptionId: params.inscriptionId,
          proposal: params.proposal,
          proposerSig: params.proposerSig,
          newInterestAssets: params.newInterestAssets,
        })

        toast.info('Executing renegotiation...')
        const { transaction_hash } = await account.execute([call])
        toast.info('Waiting for confirmation...')
        await provider.waitForTransaction(transaction_hash)

        await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tx_hash: transaction_hash }),
        })

        toast.success('Renegotiation executed!')
        window.dispatchEvent(new Event('stela:sync'))
        return transaction_hash
      } catch (err) {
        const msg = getErrorMessage(err)
        toast.error('Failed to execute renegotiation', { description: msg })
        throw err
      } finally {
        setIsPending(false)
      }
    },
    [account],
  )

  return { createProposal, commitRenegotiation, executeRenegotiation, isPending }
}
