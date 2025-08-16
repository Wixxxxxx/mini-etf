use std::collections::BTreeMap;
use std::time::{SystemTime, UNIX_EPOCH};

// FFI module for Node.js integration
pub mod ffi;

// Re-export FFI functions
pub use ffi::*;

// --------------------- Types ---------------------
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub enum Side {
    Buy,
    Sell,
}

// Custom price type that can be ordered
#[derive(Clone, Copy, Debug, PartialEq, PartialOrd)]
pub struct Price(pub f64);

impl Eq for Price {}

impl Ord for Price {
    fn cmp(&self, other: &Self) -> std::cmp::Ordering {
        self.partial_cmp(other).unwrap_or(std::cmp::Ordering::Equal)
    }
}

#[derive(Clone, Debug)]
pub struct Order {
    pub id: u64,
    pub user: String, // wallet address
    pub side: Side,
    pub price: Price, // 0.0-1.0 for binary market
    pub qty: f64,     // YES shares
    pub timestamp: u64,
}

#[derive(Clone, Debug)]
pub struct Trade {
    pub buyer: String,
    pub seller: String,
    pub qty: f64,
    pub price: Price,
    pub market_id: String,
    pub timestamp: u64,
}

// --------------------- Order Book ---------------------
pub struct OrderBook {
    pub yes: bool,
    pub bids: BTreeMap<Price, Vec<Order>>, // descending price
    pub asks: BTreeMap<Price, Vec<Order>>, // ascending price
    pub market_id: String,
}

impl OrderBook {
    pub fn new(market_id: &str, yes: bool) -> Self {
        Self {
            yes,
            bids: BTreeMap::new(),
            asks: BTreeMap::new(),
            market_id: market_id.to_string(),
        }
    }

    pub fn add_order(&mut self, order: Order) {
        // Add order to appropriate side with proper FIFO ordering
        match order.side {
            Side::Buy => {
                self.bids
                    .entry(order.price)
                    .or_insert_with(Vec::new)
                    .push(order);
            }
            Side::Sell => {
                self.asks
                    .entry(order.price)
                    .or_insert_with(Vec::new)
                    .push(order);
            }
        }
    }

    pub fn cancel_order(&mut self, order_id: u64) -> bool {
        // Cancel order from both sides (in case of any inconsistencies)
        let mut cancelled = false;
        
        // Cancel from bids
        for (_, orders) in self.bids.iter_mut() {
            if let Some(pos) = orders.iter().position(|o| o.id == order_id) {
                orders.remove(pos);
                cancelled = true;
                break;
            }
        }
        
        // Cancel from asks
        for (_, orders) in self.asks.iter_mut() {
            if let Some(pos) = orders.iter().position(|o| o.id == order_id) {
                orders.remove(pos);
                cancelled = true;
                break;
            }
        }
        
        // Clean up empty price levels
        self.bids.retain(|_, orders| !orders.is_empty());
        self.asks.retain(|_, orders| !orders.is_empty());
        
        cancelled
    }

    pub fn match_orders(&mut self) -> Vec<Trade> {
        let mut trades = Vec::new();

        loop {
            // Get the best bid and ask
            let (bid_price, bid_orders) = match self.bids.iter_mut().next_back() {
                Some((price, orders)) => (*price, orders),
                None => break, // No more bids
            };
            
            let (ask_price, ask_orders) = match self.asks.iter_mut().next() {
                Some((price, orders)) => (*price, orders),
                None => break, // No more asks
            };

            // Check if prices cross
            if bid_price < ask_price {
                break; // No more matches possible
            }

            // Get the first orders from each side
            let mut bid_order = bid_orders.first().unwrap().clone();
            let mut ask_order = ask_orders.first().unwrap().clone();

            // Calculate trade quantity (minimum of both orders)
            let trade_qty = bid_order.qty.min(ask_order.qty);
            
            // Price improvement: aggressive bid gets filled at ask price (better for buyer)
            let trade_price = ask_price;

            // Create trade
            trades.push(Trade {
                buyer: bid_order.user.clone(),
                seller: ask_order.user.clone(),
                qty: trade_qty,
                price: trade_price,
                market_id: self.market_id.clone(),
                timestamp: current_timestamp(),
            });

            // Update order quantities
            bid_order.qty -= trade_qty;
            ask_order.qty -= trade_qty;

            // Handle bid order quantity
            if bid_order.qty <= 0.0 {
                // Order fully filled, remove it
                bid_orders.remove(0);
            } else {
                // Order partially filled, update it
                bid_orders[0] = bid_order;
            }

            // Handle ask order quantity
            if ask_order.qty <= 0.0 {
                // Order fully filled, remove it
                ask_orders.remove(0);
            } else {
                // Order partially filled, update it
                ask_orders[0] = ask_order;
            }

            // Clean up empty price levels
            if bid_orders.is_empty() {
                self.bids.remove(&bid_price);
            }
            if ask_orders.is_empty() {
                self.asks.remove(&ask_price);
            }
        }

        trades
    }

    pub fn get_top_of_book(&self) -> (Price, Price) {
        let best_bid = self
            .bids
            .iter()
            .next_back()
            .map(|(p, _)| *p)
            .unwrap_or(Price(0.0));
        let best_ask = self
            .asks
            .iter()
            .next()
            .map(|(p, _)| *p)
            .unwrap_or(Price(1.0));
        (best_bid, best_ask)
    }

    pub fn get_order_book_depth(&self, levels: usize) -> (Vec<(Price, f64)>, Vec<(Price, f64)>) {
        let mut bids = Vec::new();
        let mut asks = Vec::new();
        
        // Get top bid levels with aggregated quantities
        for (price, orders) in self.bids.iter().rev().take(levels) {
            let total_qty: f64 = orders.iter().map(|o| o.qty).sum();
            bids.push((*price, total_qty));
        }
        
        // Get top ask levels with aggregated quantities
        for (price, orders) in self.asks.iter().take(levels) {
            let total_qty: f64 = orders.iter().map(|o| o.qty).sum();
            asks.push((*price, total_qty));
        }
        
        (bids, asks)
    }
}

fn current_timestamp() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs()
}

// --------------------- Matching Engine ---------------------
use std::collections::HashMap;

pub struct MatchingEngine {
    pub order_books: HashMap<String, OrderBook>, // market_id -> book
}

impl MatchingEngine {
    pub fn new() -> Self {
        Self {
            order_books: HashMap::new(),
        }
    }

    pub fn create_market(&mut self, market_id: &str) {
        // Create two order books for binary markets: YES and NO
        let yes_market_id = format!("{}_YES", market_id);
        let no_market_id = format!("{}_NO", market_id);

        self.order_books
            .entry(yes_market_id.clone())
            .or_insert(OrderBook::new(&yes_market_id, true));
        self.order_books
            .entry(no_market_id.clone())
            .or_insert(OrderBook::new(&no_market_id, false));
    }

    pub fn place_order(&mut self, market_id: &str, order: Order) -> Vec<Trade> {
        let book = self
            .order_books
            .get_mut(market_id)
            .expect("Market not found");
        book.add_order(order);
        book.match_orders()
    }

    pub fn cancel_order(&mut self, market_id: &str, order_id: u64) -> bool {
        // check
        if let Some(book) = self.order_books.get_mut(market_id) {
            book.cancel_order(order_id)
        } else {
            false
        }
    }

    pub fn get_top_of_book(&self, market_id: &str) -> (Price, Price) {
        let book = self.order_books.get(market_id).expect("Market not found");
        book.get_top_of_book()
    }

    // Helper methods for binary markets
    pub fn place_yes_order(&mut self, market_id: &str, order: Order) -> Vec<Trade> {
        let yes_market_id = format!("{}_YES", market_id);
        self.place_order(&yes_market_id, order)
    }

    pub fn place_no_order(&mut self, market_id: &str, order: Order) -> Vec<Trade> {
        let no_market_id = format!("{}_NO", market_id);
        self.place_order(&no_market_id, order)
    }

    pub fn get_yes_top_of_book(&self, market_id: &str) -> (Price, Price) {
        let yes_market_id = format!("{}_YES", market_id);
        self.get_top_of_book(&yes_market_id)
    }

    pub fn get_no_top_of_book(&self, market_id: &str) -> (Price, Price) {
        let no_market_id = format!("{}_NO", market_id);
        self.get_top_of_book(&no_market_id)
    }

    pub fn cancel_yes_order(&mut self, market_id: &str, order_id: u64) -> bool {
        let yes_market_id = format!("{}_YES", market_id);
        self.cancel_order(&yes_market_id, order_id)
    }

    pub fn cancel_no_order(&mut self, market_id: &str, order_id: u64) -> bool {
        let no_market_id = format!("{}_NO", market_id);
        self.cancel_order(&no_market_id, order_id)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // Helper function to create test orders
    fn create_test_order(id: u64, user: &str, side: Side, price: f64, qty: f64) -> Order {
        Order {
            id,
            user: user.to_string(),
            side,
            price: Price(price),
            qty,
            timestamp: current_timestamp(),
        }
    }

    #[test]
    fn test_order_creation() {
        let order = create_test_order(1, "alice", Side::Buy, 0.6, 100.0);

        println!("{:?}", order);

        assert_eq!(order.id, 1);
        assert_eq!(order.user, "alice");
        assert_eq!(order.price, Price(0.6));
        assert_eq!(order.qty, 100.0);
    }

    #[test]
    fn test_order_book_creation() {
        let book = OrderBook::new("test_market", true);
        assert_eq!(book.market_id, "test_market");
        assert!(book.bids.is_empty());
        assert!(book.asks.is_empty());
    }

    #[test]
    fn test_add_buy_order() {
        let mut book = OrderBook::new("test_market", true);
        let order = create_test_order(1, "alice", Side::Buy, 0.6, 100.0);

        book.add_order(order);
        assert_eq!(book.bids.len(), 1);
        assert_eq!(book.bids.get(&Price(0.6)).unwrap().len(), 1);
        assert_eq!(book.asks.len(), 0);
    }

    #[test]
    fn test_add_sell_order() {
        let mut book = OrderBook::new("test_market", true);
        let order = create_test_order(1, "alice", Side::Sell, 0.7, 100.0);

        for key in book.asks.keys() {
            println!("Ask key: {:?}", key.0);
        }

        book.add_order(order);
        assert_eq!(book.asks.len(), 1);
        println!("hey");

        for i in book.asks.keys() {
            print!("{}", i.0)
        }

        assert_eq!(book.asks.get(&Price(0.7)).unwrap().len(), 1);
        println!("hey again");
        assert_eq!(book.bids.len(), 0);
    }

    #[test]
    fn test_order_matching_simple() {
        let mut book = OrderBook::new("test_market", true);

        // Add buy order at 0.6
        let buy_order = create_test_order(1, "alice", Side::Buy, 0.6, 100.0);
        book.add_order(buy_order);

        // Add sell order at 0.5 (should match with buy at 0.6)
        let sell_order = create_test_order(2, "bob", Side::Sell, 0.5, 100.0);
        book.add_order(sell_order);

        let trades = book.match_orders();
        assert_eq!(trades.len(), 1);

        let trade = &trades[0];
        assert_eq!(trade.buyer, "alice");
        assert_eq!(trade.seller, "bob");
        assert_eq!(trade.qty, 100.0);
        assert_eq!(trade.price, Price(0.5));
    }

    #[test]
    fn test_order_matching_partial_fill() {
        let mut book = OrderBook::new("test_market", true);

        // Add buy order for 100 shares
        let buy_order = create_test_order(1, "alice", Side::Buy, 0.6, 100.0);
        book.add_order(buy_order);

        // Add sell order for 60 shares (partial fill)
        let sell_order = create_test_order(2, "bob", Side::Sell, 0.5, 60.0);
        book.add_order(sell_order);

        let trades = book.match_orders();
        assert_eq!(trades.len(), 1);

        let trade = &trades[0];
        assert_eq!(trade.qty, 60.0);
        assert_eq!(trade.price, Price(0.5)); // Price improvement: buyer gets filled at ask price

        // Check that buy order still has 40 shares remaining
        assert_eq!(book.bids.get(&Price(0.6)).unwrap()[0].qty, 40.0);
        
        // Check that sell order is fully filled and removed
        assert!(book.asks.is_empty());
    }

    #[test]
    fn test_order_matching_large_quantities() {
        let mut book = OrderBook::new("test_market", true);

        // Add buy order for 1000 shares
        let buy_order = create_test_order(1, "alice", Side::Buy, 0.6, 1000.0);
        book.add_order(buy_order);

        // Add sell order for 300 shares (partial fill)
        let sell_order = create_test_order(2, "bob", Side::Sell, 0.5, 300.0);
        book.add_order(sell_order);

        let trades = book.match_orders();
        assert_eq!(trades.len(), 1);

        let trade = &trades[0];
        assert_eq!(trade.qty, 300.0);
        assert_eq!(trade.price, Price(0.5)); // Price improvement for buyer

        // Check that buy order still has 700 shares remaining
        assert_eq!(book.bids.get(&Price(0.6)).unwrap()[0].qty, 700.0);
        
        // Check that sell order is fully filled and removed
        assert!(book.asks.is_empty());
    }

    #[test]
    fn test_price_improvement_for_aggressive_orders() {
        let mut book = OrderBook::new("test_market", true);

        // Add sell order at 0.7
        let sell_order = create_test_order(1, "alice", Side::Sell, 0.7, 100.0);
        book.add_order(sell_order);

        // Add aggressive buy order at 0.8 (should get filled at 0.7 - price improvement)
        let buy_order = create_test_order(2, "bob", Side::Buy, 0.8, 100.0);
        book.add_order(buy_order);

        let trades = book.match_orders();
        assert_eq!(trades.len(), 1);

        let trade = &trades[0];
        assert_eq!(trade.qty, 100.0);
        assert_eq!(trade.price, Price(0.7)); // Aggressive buyer gets filled at ask price (better)
        assert_eq!(trade.buyer, "bob");
        assert_eq!(trade.seller, "alice");
        
        // Both orders should be fully filled and removed
        assert!(book.bids.is_empty());
        assert!(book.asks.is_empty());
    }

    #[test]
    fn test_multiple_orders_same_price() {
        let mut book = OrderBook::new("test_market", true);
        let order1 = create_test_order(1, "alice", Side::Buy, 0.6, 100.0);
        let order2 = create_test_order(2, "bob", Side::Buy, 0.6, 50.0);

        book.add_order(order1);
        book.add_order(order2);

        assert_eq!(book.bids.get(&Price(0.6)).unwrap().len(), 2);
    }

    #[test]
    fn test_order_matching_multiple_levels() {
        let mut book = OrderBook::new("test_market", true);

        // Add multiple buy orders at different prices
        book.add_order(create_test_order(1, "alice", Side::Buy, 0.6, 100.0));
        book.add_order(create_test_order(2, "bob", Side::Buy, 0.5, 50.0));

        // Add sell order that should match both
        book.add_order(create_test_order(3, "charlie", Side::Sell, 0.4, 120.0));

        let trades = book.match_orders();
        assert_eq!(trades.len(), 2);

        // Verify both trades occurred with correct quantities
        assert_eq!(trades[0].qty, 100.0);
        assert_eq!(trades[1].qty, 20.0);
        
        // Verify the total quantity traded matches the sell order
        let total_traded: f64 = trades.iter().map(|t| t.qty).sum();
        assert_eq!(total_traded, 120.0);
        
        // Verify orders were processed (basic check)
        assert!(trades.len() > 0);
    }

    #[test]
    fn test_no_matching_when_prices_dont_cross() {
        let mut book = OrderBook::new("test_market", true);

        // Buy order at 0.4 -> buy yes at 0.4 -> sell no at 0.6
        book.add_order(create_test_order(1, "alice", Side::Buy, 0.4, 100.0));

        // Sell order at 0.6 (no crossing) -> buy no at 0.4 -> sell yes at 0.6
        book.add_order(create_test_order(2, "bob", Side::Sell, 0.6, 100.0)); // sell order price is flipped

        for bid in book.bids.iter() {
            println!("{:?}", bid);
        }

        for bid in book.asks.iter() {
            println!("{:?}", bid);
        }

        let trades = book.match_orders();
        for trade in trades {
            println!("{:?}", trade.price);
        }

        // assert_eq!(trades.len(), 0);
        // println!("hey");
        // // Both orders should still be in the book
        assert_eq!(book.bids.get(&Price(0.4)).unwrap().len(), 1);
        // assert_eq!(book.asks.get(&Price(0.6)).unwrap().len(), 1);
    }

    #[test]
    fn test_get_top_of_book() {
        let mut book = OrderBook::new("test_market", true);

        // Add orders at different prices
        book.add_order(create_test_order(1, "alice", Side::Buy, 0.5, 100.0));
        book.add_order(create_test_order(2, "bob", Side::Buy, 0.6, 50.0));
        book.add_order(create_test_order(3, "charlie", Side::Sell, 0.7, 100.0));
        book.add_order(create_test_order(4, "dave", Side::Sell, 0.8, 50.0));

        let (best_bid, best_ask) = book.get_top_of_book();

        let raw: f64 = best_ask.0;
        let raw2: f64 = best_bid.0;

        println!("best bid {}", raw);
        println!("best ask {}", raw2);

        assert_eq!(best_bid, Price(0.6)); // Highest buy price
        print!("hey");
        assert_eq!(best_ask, Price(0.7)); // Lowest sell price
    }

    #[test]
    fn test_empty_order_book() {
        let book = OrderBook::new("test_market", true);
        let (best_bid, best_ask) = book.get_top_of_book();
        assert_eq!(best_bid, Price(0.0));
        assert_eq!(best_ask, Price(1.0));
    }

    #[test]
    fn test_matching_engine_creation() {
        let engine = MatchingEngine::new();
        assert!(engine.order_books.is_empty());
    }

    #[test]
    fn test_create_market() {
        let mut engine = MatchingEngine::new();
        engine.create_market("test_market");

        assert!(engine.order_books.contains_key("test_market_YES"));
        assert!(engine.order_books.contains_key("test_market_NO"));
    }

    #[test]
    fn test_place_order_through_engine() {
        let mut engine = MatchingEngine::new();
        engine.create_market("test_market");

        let order = create_test_order(1, "alice", Side::Buy, 0.6, 100.0);
        let trades = engine.place_order("test_market_YES", order);

        // No trades should occur since there are no matching orders
        assert_eq!(trades.len(), 0);
        
        // Order should be in the book
        let (best_bid, _) = engine.get_top_of_book("test_market_YES");
        assert_eq!(best_bid, Price(0.6));
    }

    #[test]
    fn test_binary_markets_separate() {
        let mut engine = MatchingEngine::new();
        engine.create_market("test_market");

        // Test that we have two separate markets
        assert!(engine.order_books.contains_key("test_market_YES"));
        assert!(engine.order_books.contains_key("test_market_NO"));

        // Test YES market orders
        let yes_buy_order = create_test_order(1, "alice", Side::Buy, 0.6, 100.0);
        let yes_trades = engine.place_yes_order("test_market", yes_buy_order);
        assert_eq!(yes_trades.len(), 0); // No matching orders yet

        // Test NO market orders
        let no_sell_order = create_test_order(2, "bob", Side::Sell, 0.4, 100.0);
        let no_trades = engine.place_no_order("test_market", no_sell_order);
        assert_eq!(no_trades.len(), 0); // No matching orders yet

        // Check that orders are in separate books
        let (yes_bid, yes_ask) = engine.get_yes_top_of_book("test_market");
        let (no_bid, no_ask) = engine.get_no_top_of_book("test_market");

        assert_eq!(yes_bid, Price(0.6)); // Alice's YES buy order
        assert_eq!(yes_ask, Price(1.0)); // Default ask price
        assert_eq!(no_bid, Price(0.0)); // Default bid price
        assert_eq!(no_ask, Price(0.4)); // Bob's NO sell order
    }

    #[test]
    fn test_arbitrage_relationship() {
        let mut engine = MatchingEngine::new();
        engine.create_market("test_market");

        // Add orders that should create arbitrage opportunities
        // YES buy at 0.6 and NO buy at 0.3 (total = 0.9, should be 1.0)
        let yes_buy = create_test_order(1, "alice", Side::Buy, 0.6, 100.0);
        let no_buy = create_test_order(2, "bob", Side::Buy, 0.3, 100.0);

        engine.place_yes_order("test_market", yes_buy);
        engine.place_no_order("test_market", no_buy);

        // Add matching sell orders
        let yes_sell = create_test_order(3, "charlie", Side::Sell, 0.6, 100.0);
        let no_sell = create_test_order(4, "dave", Side::Sell, 0.3, 100.0);

        let yes_trades = engine.place_yes_order("test_market", yes_sell);
        let no_trades = engine.place_no_order("test_market", no_sell);

        // Both should match
        assert_eq!(yes_trades.len(), 1);
        assert_eq!(no_trades.len(), 1);

        // Verify the arbitrage relationship: YES + NO should equal 1.0
        // Alice bought YES at 0.6, Bob bought NO at 0.3
        // Total cost: 0.6 + 0.3 = 0.9, which is less than 1.0
        // This represents an arbitrage opportunity
        let (yes_bid, _) = engine.get_yes_top_of_book("test_market");
        let (no_bid, _) = engine.get_no_top_of_book("test_market");

        // After trades, the books should be empty, so we get default prices
        assert_eq!(yes_bid, Price(0.0));
        assert_eq!(no_bid, Price(0.0));
    }

    #[test]
    fn test_cancel_order() {
        let mut book = OrderBook::new("test_market", true);
        let order = create_test_order(1, "alice", Side::Buy, 0.6, 100.0);

        book.add_order(order);
        assert_eq!(book.bids.get(&Price(0.6)).unwrap().len(), 1);

        let cancelled = book.cancel_order(1);
        assert!(cancelled);
        assert_eq!(book.bids.get(&Price(0.6)).map(|v| v.len()), None); // Price level removed
    }
}
