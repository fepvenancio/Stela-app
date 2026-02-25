use matching_engine::services::scoring::{
    aggregate_orders, score_order, OrderScoreInput, ScoredOrderResult, ScoringAction, MAX_BPS,
};

// ============================================================
// score_order tests
// ============================================================

#[test]
fn borrow_lower_rate_scores_higher() {
    let low_rate = OrderScoreInput {
        rate_bps: 500,
        total_bps: 10_000,
        filled_bps: 0,
    };
    let high_rate = OrderScoreInput {
        rate_bps: 800,
        total_bps: 10_000,
        filled_bps: 0,
    };
    let intent_bps = 5_000;

    let score_low = score_order(&low_rate, &ScoringAction::Borrow, intent_bps);
    let score_high = score_order(&high_rate, &ScoringAction::Borrow, intent_bps);

    assert!(
        score_low > score_high,
        "Borrow: lower rate ({score_low}) should score higher than higher rate ({score_high})"
    );
}

#[test]
fn lend_higher_rate_scores_higher() {
    let low_rate = OrderScoreInput {
        rate_bps: 500,
        total_bps: 10_000,
        filled_bps: 0,
    };
    let high_rate = OrderScoreInput {
        rate_bps: 800,
        total_bps: 10_000,
        filled_bps: 0,
    };
    let intent_bps = 5_000;

    let score_low = score_order(&low_rate, &ScoringAction::Lend, intent_bps);
    let score_high = score_order(&high_rate, &ScoringAction::Lend, intent_bps);

    assert!(
        score_high > score_low,
        "Lend: higher rate ({score_high}) should score higher than lower rate ({score_low})"
    );
}

#[test]
fn full_coverage_scores_higher_than_partial() {
    let full_coverage = OrderScoreInput {
        rate_bps: 500,
        total_bps: 10_000,
        filled_bps: 0,
    };
    let partial_coverage = OrderScoreInput {
        rate_bps: 500,
        total_bps: 5_000,
        filled_bps: 0,
    };
    let intent_bps = 10_000;

    let score_full = score_order(&full_coverage, &ScoringAction::Borrow, intent_bps);
    let score_partial = score_order(&partial_coverage, &ScoringAction::Borrow, intent_bps);

    assert!(
        score_full > score_partial,
        "Full coverage ({score_full}) should score higher than 50% coverage ({score_partial})"
    );
}

#[test]
fn zero_available_bps_scores_zero_fill_fit() {
    let fully_filled = OrderScoreInput {
        rate_bps: 500,
        total_bps: 10_000,
        filled_bps: 10_000, // fully filled => 0 available
    };
    let intent_bps = 5_000;

    let score = score_order(&fully_filled, &ScoringAction::Borrow, intent_bps);
    assert_eq!(score, 0, "Zero available bps should score 0");
}

#[test]
fn borrow_zero_rate_gives_max_rate_score() {
    let zero_rate = OrderScoreInput {
        rate_bps: 0,
        total_bps: 10_000,
        filled_bps: 0,
    };
    let intent_bps = 10_000;

    let score = score_order(&zero_rate, &ScoringAction::Borrow, intent_bps);

    // rate_score = MAX_BPS - 0 = 10_000
    // fill_fit = MAX_BPS = 10_000 (full coverage)
    // composite = (10_000 * 8 + 10_000 * 2) / 10 = 10_000
    assert_eq!(score, MAX_BPS, "Borrow with 0 rate and full coverage should be max score");
}

#[test]
fn lend_max_rate_gives_max_rate_score() {
    let max_rate = OrderScoreInput {
        rate_bps: MAX_BPS,
        total_bps: 10_000,
        filled_bps: 0,
    };
    let intent_bps = 10_000;

    let score = score_order(&max_rate, &ScoringAction::Lend, intent_bps);

    // rate_score = 10_000 (Lend: rate_bps directly)
    // fill_fit = 10_000 (full coverage)
    // composite = (10_000 * 8 + 10_000 * 2) / 10 = 10_000
    assert_eq!(score, MAX_BPS, "Lend with max rate and full coverage should be max score");
}

#[test]
fn score_is_in_valid_range() {
    let test_cases = vec![
        (0, 10_000, 0),
        (5_000, 10_000, 0),
        (MAX_BPS, 10_000, 0),
        (500, 500, 0),
        (500, 10_000, 5_000),
    ];

    for (rate, total, filled) in test_cases {
        let input = OrderScoreInput {
            rate_bps: rate,
            total_bps: total,
            filled_bps: filled,
        };
        for action in [ScoringAction::Borrow, ScoringAction::Lend] {
            let score = score_order(&input, &action, 5_000);
            assert!(
                score <= MAX_BPS,
                "Score {score} exceeds MAX_BPS for rate={rate}, total={total}, filled={filled}, action={action:?}"
            );
        }
    }
}

#[test]
fn zero_intent_bps_returns_zero() {
    let input = OrderScoreInput {
        rate_bps: 500,
        total_bps: 10_000,
        filled_bps: 0,
    };
    let score = score_order(&input, &ScoringAction::Borrow, 0);
    assert_eq!(score, 0, "Zero intent bps should return 0");
}

// ============================================================
// aggregate_orders tests
// ============================================================

#[test]
fn single_order_covers_full_intent() {
    let candidates = vec![ScoredOrderResult {
        index: 0,
        score: 8_000,
        available_bps: 10_000,
    }];

    let result = aggregate_orders(candidates, 5_000);
    assert_eq!(result.len(), 1, "Single order should cover full intent");
    assert_eq!(result[0].index, 0);
}

#[test]
fn multiple_orders_needed_to_cover_intent() {
    let candidates = vec![
        ScoredOrderResult {
            index: 0,
            score: 9_000,
            available_bps: 3_000,
        },
        ScoredOrderResult {
            index: 1,
            score: 7_000,
            available_bps: 3_000,
        },
        ScoredOrderResult {
            index: 2,
            score: 8_000,
            available_bps: 3_000,
        },
    ];

    let result = aggregate_orders(candidates, 8_000);
    assert_eq!(result.len(), 3, "Three orders needed to cover 8000 bps");

    // Should be sorted by score descending: 9000, 8000, 7000
    assert_eq!(result[0].score, 9_000);
    assert_eq!(result[1].score, 8_000);
    assert_eq!(result[2].score, 7_000);
}

#[test]
fn empty_candidates_returns_empty() {
    let result = aggregate_orders(vec![], 5_000);
    assert!(result.is_empty(), "Empty candidates should return empty result");
}

#[test]
fn all_orders_insufficient_returns_all() {
    let candidates = vec![
        ScoredOrderResult {
            index: 0,
            score: 8_000,
            available_bps: 1_000,
        },
        ScoredOrderResult {
            index: 1,
            score: 7_000,
            available_bps: 1_000,
        },
    ];

    let result = aggregate_orders(candidates, 10_000);
    assert_eq!(
        result.len(),
        2,
        "All orders returned when combined still insufficient (best effort)"
    );
}

#[test]
fn aggregation_stops_when_intent_satisfied() {
    let candidates = vec![
        ScoredOrderResult {
            index: 0,
            score: 9_000,
            available_bps: 5_000,
        },
        ScoredOrderResult {
            index: 1,
            score: 8_000,
            available_bps: 5_000,
        },
        ScoredOrderResult {
            index: 2,
            score: 7_000,
            available_bps: 5_000,
        },
    ];

    let result = aggregate_orders(candidates, 5_000);
    assert_eq!(
        result.len(),
        1,
        "Should stop after first order satisfies intent"
    );
    assert_eq!(result[0].score, 9_000, "Should pick highest score first");
}

#[test]
fn zero_available_contributes_nothing() {
    let candidates = vec![
        ScoredOrderResult {
            index: 0,
            score: 9_000,
            available_bps: 0,
        },
        ScoredOrderResult {
            index: 1,
            score: 5_000,
            available_bps: 10_000,
        },
    ];

    let result = aggregate_orders(candidates, 5_000);
    // Zero available order is included but doesn't contribute, then the 10_000 covers it
    assert!(
        result.len() <= 2,
        "Result should have at most 2 orders"
    );
    // The second order should definitely be in the result since it covers the intent
    assert!(
        result.iter().any(|o| o.index == 1),
        "Order with 10_000 available should be in result"
    );
}

#[test]
fn zero_intent_returns_empty() {
    let candidates = vec![ScoredOrderResult {
        index: 0,
        score: 8_000,
        available_bps: 10_000,
    }];

    let result = aggregate_orders(candidates, 0);
    assert!(result.is_empty(), "Zero intent should return empty result");
}

#[test]
fn aggregation_respects_score_ordering() {
    // Intentionally out of order
    let candidates = vec![
        ScoredOrderResult {
            index: 0,
            score: 3_000,
            available_bps: 5_000,
        },
        ScoredOrderResult {
            index: 1,
            score: 9_000,
            available_bps: 5_000,
        },
        ScoredOrderResult {
            index: 2,
            score: 6_000,
            available_bps: 5_000,
        },
    ];

    let result = aggregate_orders(candidates, 10_000);
    assert_eq!(result.len(), 2, "Two highest-scoring orders should cover 10_000");
    assert_eq!(result[0].score, 9_000, "Highest score first");
    assert_eq!(result[1].score, 6_000, "Second highest score second");
}
