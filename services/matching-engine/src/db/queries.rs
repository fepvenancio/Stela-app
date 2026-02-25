use crate::models::OrderRecord;
use sqlx::PgPool;
use uuid::Uuid;

/// Insert a new order and return the full record.
pub async fn insert_order(
    db: &PgPool,
    order_hash: &str,
    maker: &str,
    allowed_taker: &str,
    inscription_id: &str,
    bps: &str,
    deadline: i64,
    nonce: &str,
    min_fill_bps: &str,
    signature_r: &str,
    signature_s: &str,
) -> Result<OrderRecord, sqlx::Error> {
    sqlx::query_as::<_, OrderRecord>(
        r#"
        INSERT INTO signed_orders (order_hash, maker, allowed_taker, inscription_id, bps, deadline, nonce, min_fill_bps, signature_r, signature_s)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id, order_hash, maker, allowed_taker, inscription_id, bps, deadline, nonce, min_fill_bps, signature_r, signature_s, status, filled_bps, reserved_until, created_at, updated_at
        "#,
    )
    .bind(order_hash)
    .bind(maker)
    .bind(allowed_taker)
    .bind(inscription_id)
    .bind(bps)
    .bind(deadline)
    .bind(nonce)
    .bind(min_fill_bps)
    .bind(signature_r)
    .bind(signature_s)
    .fetch_one(db)
    .await
}

/// Get an order by its UUID.
pub async fn get_order_by_id(
    db: &PgPool,
    id: Uuid,
) -> Result<Option<OrderRecord>, sqlx::Error> {
    sqlx::query_as::<_, OrderRecord>(
        r#"
        SELECT id, order_hash, maker, allowed_taker, inscription_id, bps, deadline, nonce, min_fill_bps, signature_r, signature_s, status, filled_bps, reserved_until, created_at, updated_at
        FROM signed_orders
        WHERE id = $1
        "#,
    )
    .bind(id)
    .fetch_optional(db)
    .await
}

/// Get an order by its deterministic hash.
pub async fn get_order_by_hash(
    db: &PgPool,
    hash: &str,
) -> Result<Option<OrderRecord>, sqlx::Error> {
    sqlx::query_as::<_, OrderRecord>(
        r#"
        SELECT id, order_hash, maker, allowed_taker, inscription_id, bps, deadline, nonce, min_fill_bps, signature_r, signature_s, status, filled_bps, reserved_until, created_at, updated_at
        FROM signed_orders
        WHERE order_hash = $1
        "#,
    )
    .bind(hash)
    .fetch_optional(db)
    .await
}

/// Soft-cancel an order. Returns true if a row was updated.
pub async fn soft_cancel_order(
    db: &PgPool,
    id: Uuid,
    maker: &str,
) -> Result<bool, sqlx::Error> {
    let result = sqlx::query(
        r#"
        UPDATE signed_orders
        SET status = 'soft_cancelled', updated_at = NOW()
        WHERE id = $1 AND maker = $2 AND status = 'open'
        "#,
    )
    .bind(id)
    .bind(maker)
    .execute(db)
    .await?;

    Ok(result.rows_affected() > 0)
}

/// Query open orders for a given inscription that are eligible for matching.
/// Includes orders that are open, or reserved but with expired reservations.
/// Excludes orders past their deadline.
pub async fn query_open_orders(
    db: &PgPool,
    inscription_id: &str,
    now_epoch: i64,
) -> Result<Vec<OrderRecord>, sqlx::Error> {
    sqlx::query_as::<_, OrderRecord>(
        r#"
        SELECT id, order_hash, maker, allowed_taker, inscription_id, bps, deadline, nonce, min_fill_bps, signature_r, signature_s, status, filled_bps, reserved_until, created_at, updated_at
        FROM signed_orders
        WHERE inscription_id = $1
          AND (status = 'open' OR (status = 'reserved' AND reserved_until < NOW()))
          AND deadline > $2
        ORDER BY created_at ASC
        "#,
    )
    .bind(inscription_id)
    .bind(now_epoch)
    .fetch_all(db)
    .await
}

/// Reserve a set of orders by setting status to 'reserved' with a TTL.
/// Only reserves orders that are currently 'open'.
/// Returns the IDs of orders that were actually reserved.
pub async fn reserve_orders(
    db: &PgPool,
    ids: &[Uuid],
    ttl_secs: u64,
) -> Result<Vec<Uuid>, sqlx::Error> {
    if ids.is_empty() {
        return Ok(vec![]);
    }

    // Build a dynamic query for the IN clause
    let placeholders: Vec<String> = (1..=ids.len()).map(|i| format!("${i}")).collect();
    let in_clause = placeholders.join(", ");
    let ttl_param_idx = ids.len() + 1;

    let query_str = format!(
        r#"
        UPDATE signed_orders
        SET status = 'reserved', reserved_until = NOW() + (${ttl_param_idx} || ' seconds')::INTERVAL, updated_at = NOW()
        WHERE id IN ({in_clause}) AND status = 'open'
        RETURNING id
        "#,
    );

    let mut query = sqlx::query_scalar::<_, Uuid>(&query_str);
    for id in ids {
        query = query.bind(id);
    }
    query = query.bind(ttl_secs.to_string());

    query.fetch_all(db).await
}

/// Update the status of an order by its hash. Returns true if updated.
pub async fn update_order_status(
    db: &PgPool,
    order_hash: &str,
    new_status: &str,
) -> Result<bool, sqlx::Error> {
    let result = sqlx::query(
        r#"
        UPDATE signed_orders
        SET status = $2, updated_at = NOW()
        WHERE order_hash = $1
        "#,
    )
    .bind(order_hash)
    .bind(new_status)
    .execute(db)
    .await?;

    Ok(result.rows_affected() > 0)
}

/// Update the filled_bps of an order by its hash. Returns true if updated.
pub async fn update_filled_bps(
    db: &PgPool,
    order_hash: &str,
    new_filled_bps: &str,
) -> Result<bool, sqlx::Error> {
    let result = sqlx::query(
        r#"
        UPDATE signed_orders
        SET filled_bps = $2, updated_at = NOW()
        WHERE order_hash = $1
        "#,
    )
    .bind(order_hash)
    .bind(new_filled_bps)
    .execute(db)
    .await?;

    Ok(result.rows_affected() > 0)
}

/// Bulk cancel all open orders from a maker with nonce below min_nonce.
/// Returns the number of orders cancelled.
pub async fn bulk_cancel_by_maker_nonce(
    db: &PgPool,
    maker: &str,
    min_nonce: &str,
) -> Result<u64, sqlx::Error> {
    let result = sqlx::query(
        r#"
        UPDATE signed_orders
        SET status = 'cancelled', updated_at = NOW()
        WHERE maker = $1 AND nonce < $2 AND status = 'open'
        "#,
    )
    .bind(maker)
    .bind(min_nonce)
    .execute(db)
    .await?;

    Ok(result.rows_affected())
}
