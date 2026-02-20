'use client'

import { useSendTransaction } from '@starknet-react/core'
import { STELA_ADDRESS } from '@stela/core'
import type { Asset } from '@stela/core'
import { toU256 } from '@/lib/u256'

const ASSET_TYPE_ENUM: Record<string, number> = {
  ERC20: 0,
  ERC721: 1,
  ERC1155: 2,
  ERC4626: 3,
}

function serializeAssetArray(assets: Asset[]): string[] {
  const calldata: string[] = [String(assets.length)]
  for (const a of assets) {
    calldata.push(a.asset)
    calldata.push(String(ASSET_TYPE_ENUM[a.asset_type]))
    calldata.push(...toU256(a.value))
    calldata.push(...toU256(a.token_id))
  }
  return calldata
}

interface CreateParams {
  isBorrow: boolean
  debtAssets: Asset[]
  interestAssets: Asset[]
  collateralAssets: Asset[]
  duration: bigint
  deadline: bigint
  multiLender: boolean
}

export function useCreateAgreement(params: CreateParams) {
  const calldata = [
    params.isBorrow ? '1' : '0',
    ...serializeAssetArray(params.debtAssets),
    ...serializeAssetArray(params.interestAssets),
    ...serializeAssetArray(params.collateralAssets),
    String(params.duration),
    String(params.deadline),
    params.multiLender ? '1' : '0',
  ]

  const { sendAsync, isPending, error } = useSendTransaction({
    calls: [
      {
        contractAddress: STELA_ADDRESS.sepolia,
        entrypoint: 'create_agreement',
        calldata,
      },
    ],
  })

  return { create: sendAsync, isPending, error }
}
