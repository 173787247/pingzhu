# pingzhu-core — Rust 核心與 C ABI

這是四個平台外殼**唯一需要依賴的東西**。

| 平台 | 外殼 | 如何接到這裡 |
|---|---|---|
| Windows 10/11 | TSF 文字服務（in-proc COM DLL） | 連結 C ABI（C++） |
| macOS 12+ | InputMethodKit | Swift `@_silgen_name` 或一層 C shim |
| Android 8+ | `InputMethodService` | JNI |
| HarmonyOS NEXT | `InputMethodExtensionAbility` | NAPI |

## 為什麼是 Rust，而不是「因為 Rust 比較快」

先講清楚：**移植並沒有讓它變快。**

| | TypeScript 參考實作 | Rust 核心 |
|---|---|---|
| 每按鍵解碼 | 15.2 µs | 16.5 µs |
| 吞吐 | 65,934 鍵/秒 | 60,731 鍵/秒 |
| 語言模型載入 | 273 ms | **154 ms** |

兩者都在同一個數量級，因為時間幾乎都花在同一個演算法上（每個切分都要建一次讀字格）。
Rust 的價值不在速度，而在**能被嵌進別人的行程裡**：

- Windows 的 TSF 文字服務是 **in-proc DLL**，被載入應用程式的行程。它沒有地方放一個 VM。
- macOS 的輸入法是一個 `.app` bundle，啟動延遲直接影響使用者在每個文字框的第一個字。
- Android 與 HarmonyOS 需要 `.so` 加 JNI／NAPI 橋接。

而 16.5 µs 距離輸入法 10 ms 的體驗門檻還有**三個數量級**，所以沒有任何理由為了速度
去最佳化（例如把 `String` 換成 `Rc<str>`）。這是刻意的決定，不是疏忽。

## 建置

```bash
cd core-rs
cargo build --release
# 產出：
#   target/release/libpingzhu_core.a    ← 靜態，外殼最可能用這個
#   target/release/libpingzhu_core.so   ← 動態
#   target/release/libpingzhu_core.rlib ← Rust 呼叫端
```

## 驗證

```bash
cargo test                      # 16 個單元測試 + 差異化測試
cargo run --release --example bench

# C ABI 端到端：一個純 C 程式驅動引擎
cargo build --release
gcc -Wall -I include tests/c_abi_smoke.c -o /tmp/smoke \
    target/release/libpingzhu_core.a -lm -lpthread -ldl
/tmp/smoke ../data
```

```
abi version: 1
  ok   composing = "ㄋㄧˇ ㄏㄠˇ"
  ok   sentence = "你好"
  ok   candidate 1 = "你好"
  page 0/4
  ok   commit = "你好"
  ok   sentence (ambiguous) = "我愛你"
  ok   composing (tone migration) = "ㄨㄢˋ ㄉㄢ"
  ok   sentence (tone migration) = "萬丹"

all C ABI checks passed
```

## 這個移植怎麼被信任

**TypeScript 版是規格書。** 它背後有 37 個測試、兩套評測工具，以及寫在註解裡的推理。
在第二種語言裡重新推導「什麼叫正確」，正是移植會悄悄分歧的方式——而那些分歧的角落，
就是輸入法打錯字的地方。

所以 `tests/differential.rs` 重播一份從參考實作匯出的 fixture：

```bash
cd engine && node dump-fixture.mjs 1500 > ../core-rs/tests/fixture.tsv
```

1,529 個真實按鍵字串，逐項比對 composing／sentence／score／usedFallback／斷詞／候選第一頁。

**這個綠色是有意義的，因為它會紅。** 突變測試：

| 突變 | 結果 |
|---|---|
| 關閉 promotion | ❌ 20+ 處不一致（`u6tp6`：`一陳` ≠ `遺臣`） |
| 候選排序改成純詞頻 | ❌ 不一致（`su3cl3` 第一頁變成 `你\|妳\|擬\|你好…`） |
| 還原 | ✅ 通過 |

## C ABI 的三個設計約束

1. **回傳字串的所有權固定在引擎**，呼叫端不負責釋放。否則 TSF DLL、Swift 的
   `IMKInputController`、Kotlin 的 `InputMethodService`、ArkTS 的
   `InputMethodExtensionAbility` 要各自寫一套配對的 free——四個執行環境，四次洩漏或
   重複釋放的機會。字串放在執行緒區域緩衝區，直到同一執行緒的下一次呼叫前有效。
2. **按鍵以 UTF-8 文字傳入，不是 keycode。** 鍵盤排列的知識留在核心，
   所以日後補上許氏鍵盤不需要動四個平台。
3. **沒有非同步介面。** 解碼是 16.5 µs 的同步純計算；引入非同步只會讓四個外殼
   各自發明一套 callback 生命週期。

```c
EngineHandle *engine_create(const char *data_dir, const char *layout, const char *candidate_order);
bool  engine_feed_key(EngineHandle *, const char *key);   /* false = 這個鍵不屬於輸入法 */
const char *engine_composing(EngineHandle *);
const char *engine_best_sentence(EngineHandle *);
const char *engine_candidate_at(EngineHandle *, size_t index);
const char *engine_select_candidate(EngineHandle *, size_t one_based);  /* 1..10 */
const char *engine_commit(EngineHandle *);
```

完整介面見 [`include/pingzhu.h`](include/pingzhu.h)。

`engine_abi_version()` 讓外殼可以拒絕載入版本不符的函式庫，而不是直接損壞記憶體。

## 授權

MIT。語言模型資料衍生自 McBopomofo（MIT），見倉庫根目錄 [NOTICE](../NOTICE)。
