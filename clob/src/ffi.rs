use crate::{MatchingEngine, Order, Price, Side};
use std::convert::AsRef;
use std::ffi::{CStr, CString};
use std::os::raw::c_char;
use std::ptr;
use std::sync::atomic::{AtomicU64, Ordering};

// FFI-safe order structure
#[repr(C)]
pub struct FFIOrder {
    pub id: u64,
    pub user: *mut c_char,
    pub side: u8, // 0 = Buy, 1 = Sell
    pub price: f64,
    pub qty: f64,
    pub timestamp: u64,
    pub market: *mut c_char, // "YES" or "NO"
    pub market_id: *mut c_char,
}

// FFI-safe trade structure
#[repr(C)]
pub struct FFITrade {
    pub id: u64,
    pub buyer: *mut c_char,
    pub seller: *mut c_char,
    pub qty: f64,
    pub price: f64,
    pub market: *mut c_char,
    pub market_id: *mut c_char,
    pub timestamp: u64,
}

// FFI-safe order book structure
#[repr(C)]
pub struct FFIOrderBook {
    pub best_bid: f64,
    pub best_ask: f64,
    pub bid_count: u32,
    pub ask_count: u32,
}

// Global matching engine instance
static mut ENGINE: Option<MatchingEngine> = None;

// Static counter for generating unique trade IDs
static TRADE_ID_COUNTER: AtomicU64 = AtomicU64::new(1);

// Initialize the matching engine
#[no_mangle]
pub extern "C" fn clob_init() -> i32 {
    unsafe {
        ENGINE = Some(MatchingEngine::new());
        0 // Success
    }
}

// Create a market
#[no_mangle]
pub extern "C" fn clob_create_market(market_id: *const c_char) -> i32 {
    unsafe {
        if let Some(engine) = &mut ENGINE {
            let market_id_str = CStr::from_ptr(market_id).to_string_lossy();
            engine.create_market(&market_id_str);
            0 // Success
        } else {
            -1 // Engine not initialized
        }
    }
}

// Place an order
#[no_mangle]
pub extern "C" fn clob_place_order(ffi_order: FFIOrder) -> *mut FFITrade {
    unsafe {
        if let Some(engine) = &mut ENGINE {
            // Convert FFI order to Rust order
            let rust_order = Order {
                id: ffi_order.id,
                user: CStr::from_ptr(ffi_order.user).to_string_lossy().to_string(),
                side: if ffi_order.side == 0 {
                    Side::Buy
                } else {
                    Side::Sell
                },
                price: Price(ffi_order.price),
                qty: ffi_order.qty,
                timestamp: ffi_order.timestamp,
            };

            let market_id = CStr::from_ptr(ffi_order.market_id).to_string_lossy();
            let market = CStr::from_ptr(ffi_order.market).to_string_lossy();

            // Ensure market exists before placing order
            engine.create_market(&market_id);

            // Place order based on market type
            let trades = if market == "YES" {
                engine.place_yes_order(&market_id, rust_order)
            } else {
                engine.place_no_order(&market_id, rust_order)
            };

            // Convert first trade to FFI format (if any)
            if let Some(trade) = trades.first() {
                let ffi_trade = Box::new(FFITrade {
                    id: TRADE_ID_COUNTER.fetch_add(1, Ordering::SeqCst), // Generate a unique ID for the trade
                    buyer: CString::new(AsRef::<str>::as_ref(&trade.buyer))
                        .unwrap()
                        .into_raw(),
                    seller: CString::new(AsRef::<str>::as_ref(&trade.seller))
                        .unwrap()
                        .into_raw(),
                    qty: trade.qty,
                    price: trade.price.0,
                    market: CString::new(AsRef::<str>::as_ref(&market))
                        .unwrap()
                        .into_raw(), // Use the market parameter
                    market_id: CString::new(AsRef::<str>::as_ref(&trade.market_id))
                        .unwrap()
                        .into_raw(),
                    timestamp: trade.timestamp,
                });
                Box::into_raw(ffi_trade)
            } else {
                ptr::null_mut()
            }
        } else {
            ptr::null_mut()
        }
    }
}

// Cancel an order
#[no_mangle]
pub extern "C" fn clob_cancel_order(market_id: *const c_char, order_id: u64) -> i32 {
    unsafe {
        if let Some(engine) = &mut ENGINE {
            let market_id_str = CStr::from_ptr(market_id).to_string_lossy();
            
            // Try to cancel from the specific market
            let result = engine.cancel_order(&market_id_str, order_id);
            
            if result {
                0 // Success
            } else {
                -1 // Order not found or cancellation failed
            }
        } else {
            -1 // Engine not initialized
        }
    }
}

// Get top of book for a market
#[no_mangle]
pub extern "C" fn clob_get_top_of_book(
    market_id: *const c_char,
    market: *const c_char,
) -> FFIOrderBook {
    unsafe {
        if let Some(engine) = &mut ENGINE {
            let market_id_str = CStr::from_ptr(market_id).to_string_lossy();
            let market_str = CStr::from_ptr(market).to_string_lossy();

            // Ensure market exists before accessing it
            engine.create_market(&market_id_str);

            let (best_bid, best_ask) = if market_str == "YES" {
                engine.get_yes_top_of_book(&market_id_str)
            } else {
                engine.get_no_top_of_book(&market_id_str)
            };

            FFIOrderBook {
                best_bid: best_bid.0,
                best_ask: best_ask.0,
                bid_count: 0, // TODO: Implement order counting
                ask_count: 0,
            }
        } else {
            FFIOrderBook {
                best_bid: 0.0,
                best_ask: 1.0,
                bid_count: 0,
                ask_count: 0,
            }
        }
    }
}

// Free FFI trade memory
#[no_mangle]
pub extern "C" fn clob_free_trade(trade: *mut FFITrade) {
    if !trade.is_null() {
        unsafe {
            let trade = Box::from_raw(trade);
            // Free the CStrings
            let _ = CString::from_raw(trade.buyer);
            let _ = CString::from_raw(trade.seller);
            let _ = CString::from_raw(trade.market);
            let _ = CString::from_raw(trade.market_id);
        }
    }
}

// Get order book depth
#[no_mangle]
pub extern "C" fn clob_get_order_book_depth(
    market_id: *const c_char,
    market: *const c_char,
) -> *mut FFIOrderBook {
    unsafe {
        if let Some(engine) = &mut ENGINE {
            let market_id_str = CStr::from_ptr(market_id).to_string_lossy();
            let market_str = CStr::from_ptr(market).to_string_lossy();

            // Ensure market exists before accessing it
            engine.create_market(&market_id_str);

            // Get the order book
            let order_book = if market_str == "YES" {
                engine.order_books.get(&format!("{}_YES", market_id_str))
            } else {
                engine.order_books.get(&format!("{}_NO", market_id_str))
            };

            if let Some(book) = order_book {
                let ffi_book = Box::new(FFIOrderBook {
                    best_bid: book.get_top_of_book().0 .0,
                    best_ask: book.get_top_of_book().1 .0,
                    bid_count: book.bids.len() as u32,
                    ask_count: book.asks.len() as u32,
                });
                Box::into_raw(ffi_book)
            } else {
                ptr::null_mut()
            }
        } else {
            ptr::null_mut()
        }
    }
}

// Free order book memory
#[no_mangle]
pub extern "C" fn clob_free_order_book(order_book: *mut FFIOrderBook) {
    if !order_book.is_null() {
        unsafe {
            let _ = Box::from_raw(order_book);
        }
    }
}
