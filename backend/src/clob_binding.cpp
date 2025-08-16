#include <napi.h>
#include <string>
#include <vector>

// External C functions from Rust library
extern "C"
{
    int clob_init();
    int clob_create_market(const char *market_id);
    void *clob_place_order(const void *order);
    int clob_cancel_order(const char *market_id, uint64_t order_id);
    void *clob_get_top_of_book(const char *market_id, const char *market);
    void clob_free_trade(void *trade);
    void *clob_get_order_book_depth(const char *market_id, const char *market);
    void clob_free_order_book(void *order_book);
}

// FFI structures matching Rust
struct FFIOrder
{
    uint64_t id;
    char *user;
    uint8_t side; // 0 = Buy, 1 = Sell
    double price;
    double qty;
    uint64_t timestamp;
    char *market; // "YES" or "NO"
    char *market_id;
};

struct FFITrade
{
    uint64_t id;
    char *buyer;
    char *seller;
    double qty;
    double price;
    char *market;
    char *market_id;
    uint64_t timestamp;
};

struct FFIOrderBook
{
    double best_bid;
    double best_ask;
    uint32_t bid_count;
    uint32_t ask_count;
};

class CLOBBinding : public Napi::ObjectWrap<CLOBBinding>
{
public:
    static Napi::Object Init(Napi::Env env, Napi::Object exports)
    {
        Napi::Function func = DefineClass(env, "CLOBBinding", {
                                                                  InstanceMethod("init", &CLOBBinding::Init),
                                                                  InstanceMethod("createMarket", &CLOBBinding::CreateMarket),
                                                                  InstanceMethod("placeOrder", &CLOBBinding::PlaceOrder),
                                                                  InstanceMethod("cancelOrder", &CLOBBinding::CancelOrder),
                                                                  InstanceMethod("getTopOfBook", &CLOBBinding::GetTopOfBook),
                                                                  InstanceMethod("getOrderBookDepth", &CLOBBinding::GetOrderBookDepth),
                                                              });

        exports.Set("CLOBBinding", func);
        return exports;
    }

    CLOBBinding(const Napi::CallbackInfo &info) : Napi::ObjectWrap<CLOBBinding>(info) {}

private:
    Napi::Value Init(const Napi::CallbackInfo &info)
    {
        Napi::Env env = info.Env();

        int result = clob_init();
        if (result == 0)
        {
            return Napi::Boolean::New(env, true);
        }
        else
        {
            return Napi::Boolean::New(env, false);
        }
    }

    Napi::Value CreateMarket(const Napi::CallbackInfo &info)
    {
        Napi::Env env = info.Env();

        if (info.Length() < 1)
        {
            Napi::TypeError::New(env, "Wrong number of arguments").ThrowAsJavaScriptException();
            return env.Null();
        }

        if (!info[0].IsString())
        {
            Napi::TypeError::New(env, "Wrong arguments").ThrowAsJavaScriptException();
            return env.Null();
        }

        std::string market_id = info[0].As<Napi::String>();
        int result = clob_create_market(market_id.c_str());

        return Napi::Boolean::New(env, result == 0);
    }

    Napi::Value PlaceOrder(const Napi::CallbackInfo &info)
    {
        Napi::Env env = info.Env();

        if (info.Length() < 1)
        {
            Napi::TypeError::New(env, "Wrong number of arguments").ThrowAsJavaScriptException();
            return env.Null();
        }

        if (!info[0].IsObject())
        {
            Napi::TypeError::New(env, "Wrong arguments").ThrowAsJavaScriptException();
            return env.Null();
        }

        Napi::Object order_obj = info[0].As<Napi::Object>();

        // Create FFI order
        FFIOrder order;
        order.id = order_obj.Get("id").As<Napi::Number>().Uint32Value();
        order.side = order_obj.Get("side").As<Napi::String>().Utf8Value() == "Buy" ? 0 : 1;
        order.price = order_obj.Get("price").As<Napi::Number>().DoubleValue();
        order.qty = order_obj.Get("qty").As<Napi::Number>().DoubleValue();
        order.timestamp = order_obj.Get("timestamp").As<Napi::Number>().Uint32Value();

        // Convert strings to C strings
        std::string user_str = order_obj.Get("user").As<Napi::String>().Utf8Value();
        std::string market_str = order_obj.Get("market").As<Napi::String>().Utf8Value();
        std::string market_id_str = order_obj.Get("marketId").As<Napi::String>().Utf8Value();

        order.user = const_cast<char *>(user_str.c_str());
        order.market = const_cast<char *>(market_str.c_str());
        order.market_id = const_cast<char *>(market_id_str.c_str());

        // Place order
        void *trade_ptr = clob_place_order(&order);

        if (trade_ptr == nullptr)
        {
            return env.Null();
        }

        // Convert trade to JavaScript object
        FFITrade *trade = static_cast<FFITrade *>(trade_ptr);
        Napi::Object trade_obj = Napi::Object::New(env);

        trade_obj.Set("id", Napi::Number::New(env, trade->id));
        trade_obj.Set("buyer", Napi::String::New(env, trade->buyer));
        trade_obj.Set("seller", Napi::String::New(env, trade->seller));
        trade_obj.Set("qty", Napi::Number::New(env, trade->qty));
        trade_obj.Set("price", Napi::Number::New(env, trade->price));
        trade_obj.Set("market", Napi::String::New(env, trade->market));
        trade_obj.Set("marketId", Napi::String::New(env, trade->market_id));
        trade_obj.Set("timestamp", Napi::Number::New(env, trade->timestamp));

        // Free the trade memory
        clob_free_trade(trade_ptr);

        return trade_obj;
    }

    Napi::Value CancelOrder(const Napi::CallbackInfo &info)
    {
        Napi::Env env = info.Env();

        if (info.Length() < 2)
        {
            Napi::TypeError::New(env, "Wrong number of arguments").ThrowAsJavaScriptException();
            return env.Null();
        }

        if (!info[0].IsString() || !info[1].IsNumber())
        {
            Napi::TypeError::New(env, "Wrong arguments").ThrowAsJavaScriptException();
            return env.Null();
        }

        std::string market_id = info[0].As<Napi::String>();
        uint64_t order_id = info[1].As<Napi::Number>().Uint32Value();

        int result = clob_cancel_order(market_id.c_str(), order_id);

        return Napi::Boolean::New(env, result == 0);
    }

    Napi::Value GetTopOfBook(const Napi::CallbackInfo &info)
    {
        Napi::Env env = info.Env();

        if (info.Length() < 2)
        {
            Napi::TypeError::New(env, "Wrong number of arguments").ThrowAsJavaScriptException();
            return env.Null();
        }

        if (!info[0].IsString() || !info[1].IsString())
        {
            Napi::TypeError::New(env, "Wrong arguments").ThrowAsJavaScriptException();
            return env.Null();
        }

        std::string market_id = info[0].As<Napi::String>();
        std::string market = info[1].As<Napi::String>();

        void *order_book_ptr = clob_get_top_of_book(market_id.c_str(), market.c_str());

        if (order_book_ptr == nullptr)
        {
            return env.Null();
        }

        FFIOrderBook *order_book = static_cast<FFIOrderBook *>(order_book_ptr);
        Napi::Object book_obj = Napi::Object::New(env);

        book_obj.Set("bestBid", Napi::Number::New(env, order_book->best_bid));
        book_obj.Set("bestAsk", Napi::Number::New(env, order_book->best_ask));
        book_obj.Set("bidCount", Napi::Number::New(env, order_book->bid_count));
        book_obj.Set("askCount", Napi::Number::New(env, order_book->ask_count));

        // Free the order book memory
        clob_free_order_book(order_book_ptr);

        return book_obj;
    }

    Napi::Value GetOrderBookDepth(const Napi::CallbackInfo &info)
    {
        Napi::Env env = info.Env();

        if (info.Length() < 2)
        {
            Napi::TypeError::New(env, "Wrong number of arguments").ThrowAsJavaScriptException();
            return env.Null();
        }

        if (!info[0].IsString() || !info[1].IsString())
        {
            Napi::TypeError::New(env, "Wrong arguments").ThrowAsJavaScriptException();
            return env.Null();
        }

        std::string market_id = info[0].As<Napi::String>();
        std::string market = info[1].As<Napi::String>();

        void *order_book_ptr = clob_get_order_book_depth(market_id.c_str(), market.c_str());

        if (order_book_ptr == nullptr)
        {
            return env.Null();
        }

        FFIOrderBook *order_book = static_cast<FFIOrderBook *>(order_book_ptr);
        Napi::Object book_obj = Napi::Object::New(env);

        book_obj.Set("bestBid", Napi::Number::New(env, order_book->best_bid));
        book_obj.Set("bestAsk", Napi::Number::New(env, order_book->best_ask));
        book_obj.Set("bidCount", Napi::Number::New(env, order_book->bid_count));
        book_obj.Set("askCount", Napi::Number::New(env, order_book->ask_count));

        // Free the order book memory
        clob_free_order_book(order_book_ptr);

        return book_obj;
    }
};

Napi::Object Init(Napi::Env env, Napi::Object exports)
{
    return CLOBBinding::Init(env, exports);
}

NODE_API_MODULE(clob_binding, Init)