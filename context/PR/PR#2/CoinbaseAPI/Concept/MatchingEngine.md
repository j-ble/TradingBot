# Exchange Matching Engine

Coinbase Exchange operates with a continuous first-come, first-serve order book where transactions follow price-time priority based on matching engine receipt order.

## Self-Trade Prevention

The platform prohibits self-trading—orders from the same user cannot fill one another. Notably, the STP instruction on the taker order (latest order) takes precedence over the older/resting order.

Users can configure self-trade prevention when placing orders using these options:

| Prevention Method | Flag | Behavior |
|---|---|---|
| Decrement & cancel | `dc` | Reduces larger order by smaller amount; cancels both if equal |
| Cancel oldest | `co` | Eliminates resting order; executes new taking order |
| Cancel newest | `cn` | Removes taking order; preserves resting order |
| Cancel both | `cb` | Immediately cancels both orders |

## Market Orders

When market orders with decrement-and-cancel STP encounter limit orders, the outcome depends on specified parameters:

- With both `funds` and `size`: Market buy orders reduce size internally while preserving funds
- With only `funds`: Buy orders decrement funds; sell orders decrement size against existing limit orders

## Price Improvement

Orders are matched against existing order book orders at the price of the order on the book, not at the price of the taker order.

The documentation illustrates this: when User A's buy offer at $100 matches User B's sell offer at $80, the trade executes at User A's price due to arrival timing advantage.

## Order Lifecycle

Orders progress through three states:

- **Received**: Valid orders confirmed immediately by the matching engine
- **Open**: Unfilled portions remaining eligible for matching until cancellation or completion
- **Done**: Fully executed orders or canceled orders no longer available for matching
