# pingzhu-core — Rust 核心与 C ABI

这是四个平台外壳**唯一需要依赖的东西**。

| 平台 | 外壳 | 如何接到这里 |
|---|---|---|
| Windows 10/11 | TSF 文字服务（in-proc COM DLL） | 连结 C ABI（C++） |
| macOS 12+ | InputMethodKit | Swift `@_silgen_name` 或一层 C shim |
| Android 8+ | `InputMethodService` | JNI |
| HarmonyOS NEXT | `InputMethodExtensionAbility` | NAPI |

## 为什么是 Rust，而不是「因为 Rust 比较快」

先讲清楚：**移植并没有让它变快。**

| | TypeScript 参考实作 | Rust 核心 |
|---|---|---|
| 每按键解码 | 15.2 µs | 16.5 µs |
| 吞吐 | 65,934 键/秒 | 60,731 键/秒 |
| 语言模型载入 | 273 ms | **154 ms** |

两者都在同一个数量级，因为时间几乎都花在同一个演算法上（每个切分都要建一次读字格）。
Rust 的价值不在速度，而在**能被嵌进别人的行程里**：

- Windows 的 TSF 文字服务是 **in-proc DLL**，被载入应用程式的行程。它没有地方放一个 VM。
- macOS 的输入法是一个 `.app` bundle，启动延迟直接影响使用者在每个文字框的第一个字。
- Android 与 HarmonyOS 需要 `.so` 加 JNI／NAPI 桥接。

而 16.5 µs 距离输入法 10 ms 的体验门槛还有**三个数量级**，所以没有任何理由为了速度
去最佳化（例如把 `String` 换成 `Rc<str>`）。这是刻意的决定，不是疏忽。

## 建置

```bash
cd core-rs
cargo build --release
# 產出：
#   target/release/libpingzhu_core.a    ← 靜態，外殼最可能用這個
#   target/release/libpingzhu_core.so   ← 動態
#   target/release/libpingzhu_core.rlib ← Rust 呼叫端
```

## 验证

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

## 这个移植怎么被信任

**TypeScript 版是规格书。** 它背后有 37 个测试、两套评测工具，以及写在注解里的推理。
在第二种语言里重新推导「什么叫正确」，正是移植会悄悄分歧的方式——而那些分歧的角落，
就是输入法打错字的地方。

所以 `tests/differential.rs` 重播一份从参考实作汇出的 fixture：

```bash
cd engine && node dump-fixture.mjs 1500 > ../core-rs/tests/fixture.tsv
```

1,529 个真实按键字串，逐项比对 composing／sentence／score／usedFallback／断词／候选第一页。

**这个绿色是有意义的，因为它会红。** 突变测试：

| 突变 | 结果 |
|---|---|
| 关闭 promotion | ❌ 20+ 处不一致（`u6tp6`：`一陳` ≠ `遺臣`） |
| 候选排序改成纯词频 | ❌ 不一致（`su3cl3` 第一页变成 `你\|妳\|擬\|你好…`） |
| 还原 | ✅ 通过 |

## C ABI 的三个设计约束

1. **回传字串的所有权固定在引擎**，呼叫端不负责释放。否则 TSF DLL、Swift 的
   `IMKInputController`、Kotlin 的 `InputMethodService`、ArkTS 的
   `InputMethodExtensionAbility` 要各自写一套配对的 free——四个执行环境，四次泄漏或
   重复释放的机会。字串放在执行绪区域缓冲区，直到同一执行绪的下一次呼叫前有效。
2. **按键以 UTF-8 文字传入，不是 keycode。** 键盘排列的知识留在核心，
   所以日后补上许氏键盘不需要动四个平台。
3. **没有非同步介面。** 解码是 16.5 µs 的同步纯计算；引入非同步只会让四个外壳
   各自发明一套 callback 生命周期。

```c
EngineHandle *engine_create(const char *data_dir, const char *layout, const char *candidate_order);
bool  engine_feed_key(EngineHandle *, const char *key);   /* false = 這個鍵不屬於輸入法 */
const char *engine_composing(EngineHandle *);
const char *engine_best_sentence(EngineHandle *);
const char *engine_candidate_at(EngineHandle *, size_t index);
const char *engine_select_candidate(EngineHandle *, size_t one_based);  /* 1..10 */
const char *engine_commit(EngineHandle *);
```

完整介面见 [`include/pingzhu.h`](include/pingzhu.h)。

`engine_abi_version()` 让外壳可以拒绝载入版本不符的函式库，而不是直接损坏记忆体。

## 授权

MIT。语言模型资料衍生自 McBopomofo（MIT），见仓库根目录 [NOTICE](../NOTICE)。
