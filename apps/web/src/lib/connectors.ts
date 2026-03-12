import { argent, braavos } from '@starknet-react/core'
import { ControllerConnector } from '@cartridge/connector'
import type { SessionPolicies } from '@cartridge/presets'
import { CONTRACT_ADDRESS, GENESIS_ADDRESS, STRK_ADDRESS } from '@/lib/config'

const ETH_ADDRESS = '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7'

/** Session policies — pre-approved contract calls that skip pop-ups. */
const policies: SessionPolicies = {
  contracts: {
    [CONTRACT_ADDRESS]: {
      methods: [
        { name: 'Sign Inscription', entrypoint: 'sign_inscription' },
        { name: 'Fill Order', entrypoint: 'fill_signed_order' },
        { name: 'Cancel Inscription', entrypoint: 'cancel_inscription' },
        { name: 'Redeem', entrypoint: 'redeem' },
        { name: 'Batch Redeem', entrypoint: 'batch_redeem' },
        { name: 'Liquidate', entrypoint: 'liquidate' },
        { name: 'Return Collateral', entrypoint: 'return_collateral' },
        { name: 'Repay', entrypoint: 'repay' },
      ],
    },
    [STRK_ADDRESS]: {
      methods: [
        { name: 'Approve STRK', entrypoint: 'approve' },
      ],
    },
    [ETH_ADDRESS]: {
      methods: [
        { name: 'Approve ETH', entrypoint: 'approve' },
      ],
    },
    [GENESIS_ADDRESS]: {
      methods: [
        { name: 'Mint', entrypoint: 'mint' },
        { name: 'Batch Mint', entrypoint: 'mint_batch' },
        { name: 'Approve NFT', entrypoint: 'set_approval_for_all' },
      ],
    },
  },
}

/** Cartridge Controller — passkey/social login, session keys, no extension needed. */
const cartridge = new ControllerConnector({ policies })

/** Single source of truth for wallet connectors. */
export const connectors = [argent(), braavos(), cartridge]
