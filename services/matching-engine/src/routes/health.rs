use axum::{extract::State, Json};
use serde_json::{json, Value};

use crate::state::AppState;

/// GET /health — Returns service health status including database connectivity.
pub async fn health(State(state): State<AppState>) -> Json<Value> {
    let db_ok = sqlx::query_scalar::<_, i32>("SELECT 1")
        .fetch_one(&state.db)
        .await
        .is_ok();

    Json(json!({
        "ok": db_ok,
        "db": if db_ok { "connected" } else { "unreachable" },
        "version": env!("CARGO_PKG_VERSION"),
    }))
}
