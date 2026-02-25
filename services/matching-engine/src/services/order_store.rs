use crate::db::queries;
use crate::error::AppError;
use crate::models::OrderRecord;
use crate::services::signature;
use crate::state::AppState;
use uuid::Uuid;

/// Submit a new signed order: validate signature, check duplicates, persist.
pub async fn submit_order(
    state: &AppState,
    order: &crate::models::SignedOrder,
    sig: &[String; 2],
) -> Result<OrderRecord, AppError> {
    // 1. Compute deterministic order hash
    let order_hash = signature::compute_order_hash(&state.config.chain_id, order)?;

    // 2. Check for duplicate (same hash already exists)
    if queries::get_order_by_hash(&state.db, &order_hash)
        .await?
        .is_some()
    {
        return Err(AppError::Conflict("Order already exists".to_string()));
    }

    // 3. Verify SNIP-12 signature via RPC
    let valid = signature::verify_signature(
        &state.starknet_provider,
        &state.config.chain_id,
        order,
        sig,
    )
    .await?;

    if !valid {
        return Err(AppError::InvalidSignature);
    }

    // 4. Check expiry
    let now = chrono::Utc::now().timestamp();
    if order.deadline <= now as u64 {
        return Err(AppError::OrderExpired);
    }

    // 5. Insert into database
    let record = queries::insert_order(
        &state.db,
        &order_hash,
        &order.maker,
        &order.allowed_taker,
        &order.inscription_id,
        &order.bps,
        order.deadline as i64,
        &order.nonce,
        &order.min_fill_bps,
        &sig[0],
        &sig[1],
    )
    .await?;

    Ok(record)
}

/// Get an order by UUID.
pub async fn get_order(state: &AppState, id: Uuid) -> Result<OrderRecord, AppError> {
    queries::get_order_by_id(&state.db, id)
        .await?
        .ok_or(AppError::NotFound)
}

/// Soft-cancel an order. Only the maker can cancel their own orders.
pub async fn cancel_order(
    state: &AppState,
    id: Uuid,
    maker_address: &str,
) -> Result<(), AppError> {
    // 1. Check order exists
    let record = queries::get_order_by_id(&state.db, id)
        .await?
        .ok_or(AppError::NotFound)?;

    // 2. Verify maker ownership
    if record.maker != maker_address {
        return Err(AppError::Unauthorized);
    }

    // 3. Verify order is open
    if record.status != "open" {
        return Err(AppError::Conflict(format!(
            "Order is not open (current status: {})",
            record.status
        )));
    }

    // 4. Perform soft cancel
    queries::soft_cancel_order(&state.db, id, maker_address).await?;

    Ok(())
}
