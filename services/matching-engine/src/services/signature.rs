use crate::error::AppError;
use crate::models::SignedOrder;
use serde_json::json;
use starknet::core::types::typed_data::TypedData;
use starknet::core::types::{BlockId, BlockTag, Felt, FunctionCall};
use starknet::macros::selector;
use starknet::providers::jsonrpc::{HttpTransport, JsonRpcClient};
use starknet::providers::Provider;

/// The `VALID` magic value returned by `is_valid_signature` on StarkNet account contracts.
/// Equivalent to the short string "VALID".
const VALIDATED: Felt = Felt::from_hex_unchecked("0x56414c4944");

/// Build SNIP-12 V1 TypedData JSON for a SignedOrder and deserialize into the starknet-rs type.
fn build_typed_data(chain_id: &str, order: &SignedOrder) -> Result<TypedData, AppError> {
    let typed_data_json = json!({
        "types": {
            "StarknetDomain": [
                { "name": "name", "type": "shortstring" },
                { "name": "version", "type": "shortstring" },
                { "name": "chainId", "type": "shortstring" },
                { "name": "revision", "type": "shortstring" }
            ],
            "SignedOrder": [
                { "name": "maker", "type": "ContractAddress" },
                { "name": "allowed_taker", "type": "ContractAddress" },
                { "name": "inscription_id", "type": "u256" },
                { "name": "bps", "type": "u256" },
                { "name": "deadline", "type": "u128" },
                { "name": "nonce", "type": "felt" },
                { "name": "min_fill_bps", "type": "u256" }
            ]
        },
        "primaryType": "SignedOrder",
        "domain": {
            "name": "Stela",
            "version": "1",
            "chainId": chain_id,
            "revision": "1"
        },
        "message": {
            "maker": &order.maker,
            "allowed_taker": &order.allowed_taker,
            "inscription_id": build_u256_value(&order.inscription_id)?,
            "bps": build_u256_value(&order.bps)?,
            "deadline": &order.deadline.to_string(),
            "nonce": &order.nonce,
            "min_fill_bps": build_u256_value(&order.min_fill_bps)?
        }
    });

    serde_json::from_value::<TypedData>(typed_data_json)
        .map_err(|e| AppError::Internal(format!("Failed to build TypedData: {e}")))
}

/// Convert a decimal string u256 value into the { low, high } JSON object
/// that starknet-rs TypedData expects for u256 preset types.
fn build_u256_value(decimal_str: &str) -> Result<serde_json::Value, AppError> {
    let val: u128 = decimal_str
        .parse()
        .map_err(|e| AppError::BadRequest(format!("Invalid u256 value '{decimal_str}': {e}")))?;
    // For values fitting in u128, high is 0
    Ok(json!({
        "low": val.to_string(),
        "high": "0"
    }))
}

/// Compute the deterministic SNIP-12 message hash for an order.
/// This hash uniquely identifies the order across the engine and on-chain contract.
pub fn compute_order_hash(chain_id: &str, order: &SignedOrder) -> Result<String, AppError> {
    let typed_data = build_typed_data(chain_id, order)?;
    let maker_felt = Felt::from_hex(&order.maker)
        .map_err(|e| AppError::BadRequest(format!("Invalid maker address: {e}")))?;

    let hash = typed_data
        .message_hash(maker_felt)
        .map_err(|e| AppError::Internal(format!("Failed to compute message hash: {e}")))?;

    Ok(format!("{:#066x}", hash))
}

/// Verify a signed order's signature by calling `is_valid_signature` on the maker's
/// account contract via StarkNet JSON-RPC.
///
/// **CRITICAL:** Always use `is_valid_signature` RPC call, never raw ECDSA verify.
/// This correctly handles Argent/Braavos account abstraction.
pub async fn verify_signature(
    provider: &JsonRpcClient<HttpTransport>,
    chain_id: &str,
    order: &SignedOrder,
    signature: &[String; 2],
) -> Result<bool, AppError> {
    let typed_data = build_typed_data(chain_id, order)?;

    let maker_felt = Felt::from_hex(&order.maker)
        .map_err(|e| AppError::BadRequest(format!("Invalid maker address: {e}")))?;

    let message_hash = typed_data
        .message_hash(maker_felt)
        .map_err(|e| AppError::Internal(format!("Failed to compute message hash: {e}")))?;

    // Parse signature components
    let r_felt = Felt::from_hex(&signature[0])
        .map_err(|_| AppError::InvalidSignature)?;
    let s_felt = Felt::from_hex(&signature[1])
        .map_err(|_| AppError::InvalidSignature)?;

    // Build calldata for is_valid_signature:
    // [message_hash, array_len(2), r, s]
    let calldata = vec![message_hash, Felt::from(2u64), r_felt, s_felt];

    let result = provider
        .call(
            FunctionCall {
                contract_address: maker_felt,
                entry_point_selector: selector!("is_valid_signature"),
                calldata,
            },
            BlockId::Tag(BlockTag::Latest),
        )
        .await
        .map_err(|e| {
            let err_str = e.to_string();
            if err_str.contains("ContractNotFound") || err_str.contains("contract not found") {
                AppError::UndeployedAccount(order.maker.clone())
            } else {
                AppError::StarknetRpc(err_str)
            }
        })?;

    // Check result: VALIDATED = "VALID" short string or Felt::ONE
    if let Some(first) = result.first() {
        Ok(*first == VALIDATED || *first == Felt::ONE)
    } else {
        Ok(false)
    }
}
