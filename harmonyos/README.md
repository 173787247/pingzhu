# HarmonyOS 外壳

平注的 HarmonyOS 输入法。**解码不在这里**——按这个专案一贯的做法，
每一个按键都要送到共用的 Rust 核心，这样四个平台的选字结果一致。

# ✅ 在真的鸿蒙手机上打出了中文

**2026-09-27，HUAWEI Mate XT（HarmonyOS 6.1，API 20）** ✓：

```
s u 3 c l 3   →   你好   →   備忘錄
```

**完整的路径** ✓：

```
鴻蒙鍵盤 → ArkTS → NAPI → Rust 核心（core-rs）→ 解碼
                                          ↓
備忘錄 ← InputClient.insertTextSync ← Session ← 送出
```

**这不是模拟器** ✗ ——是真的手机、真的系统输入法框架、
真的从零交叉编译的 Rust 核心 ✓

## 结构

```
harmonyos/
├── AppScope/app.json5              bundleName: tw.pingzhu.ime
├── keyboard/                       ← 輸入法本體（feature 模組）
│   └── src/main/
│       ├── module.json5            IME 的宣告
│       └── ets/
│           ├── InputMethodExtensionAbility.ets
│           └── components/Keyboard.ets
├── entry/                          ← 設定 App（引導使用者啟用）
├── build-profile.json5             模組清單
├── hvigorfile.ts
├── oh-package.json5
└── hvigor/hvigor-config.json5
```

## 在 CI 上构建

**HarmonyOS 没有自己的 runner，SDK 也不是 `apt-get` 装得到的。**
让这件事可行的，是一个已经装好整套工具链的容器映像
（`ohpm`、`hvigorw`、ArkTS 编译器），跑在普通的 ubuntu runner 上。

```
ghcr.io/sanchuanhehe/harmony-next-pipeline-docker/harmonyos-ci-image:v5.0.4
```

### 两件必须讲清楚的事

**一、映像是第三方的。** 不是华为官方。用它意味着**别人的映像在我们的
CI 里执行这个 repo 的程式码**——所以钉在确切的版本而不是浮动标签，
而且这个建置只产出 HAP，不发布、不安装、不被任何人信任。
哪天有官方路径，这段注释应该跟着映像一起换掉。

**二、能编译不等于能跑。** HAP 编得过只证明 ArkTS 语法正确、
模组宣告了框架期待的东西。**它不证明键盘打得出字**——
那需要鸿蒙装置或模拟器，而这里两者都没有。

## 建置路上踩到的四个坑

每一个都是**安静或有误导性的失败** ✓：

| # | 问题 | 症状 |
|---|---|---|
| 1 | 容器里没有 `python3` | 检查脚本死在 `not found`，而它要检查的工具链就在 `/opt` |
| 2 | 容器里 `node` 也不在 PATH 上 | 同上。它在 `/opt/harmonyos-tools/command-line-tools/tool/node/bin/node` |
| 3 | 容器的 shell 是 **dash**，不是 bash | `${PIPESTATUS[0]}` → `Bad substitution`，**而且是在 hvigor 已经印出 BUILD SUCCESSFUL 之后** |
| 4 | `@ohos.inputMethod.*` 在 API 12 里不存在 | 网路上大部分范例——包括我参照的那个——还是旧写法 |

**第 4 个最有教育意义** ✓ ——HarmonyOS NEXT 改成了 **Kit 风格** ✓：

```typescript
import { InputMethodExtensionAbility } from '@kit.IMEKit';
import { Want } from '@kit.AbilityKit';
import { hilog } from '@kit.PerformanceAnalysisKit';
```

**而 `onCreate` 的签名也和 `UIAbility` 不一样** ✗：

```typescript
onCreate(want: Want): void                                    // IME ✓
onCreate(want: Want, launchParam: AbilityConstant.LaunchParam) // UIAbility ✗
```

照 UIAbility 的形状抄，编译器会说：

```
Type '(want: any, launchParam: any) => void'
is not assignable to type '(want: Want) => void'
```

**与其猜第二次**，CI 里有一步骤直接问 SDK：

```bash
find /opt -name '@kit.IMEKit.d.ts' | head -1 | xargs grep -E "^export"
# export { InputMethodExtensionAbility, InputMethodExtensionContext, ... }
```

## 还没有做的

| | |
|---|---|
| **Rust 核心接上（NAPI）** | ✅ **完成**——`libpingzhu.so` 在 HAP 里 |
| **键盘 UI（大千式布局）** | ✅ **完成**——键面从引擎来 |
| 候选列 | ✅ 画得出来 |
| **把字送进编辑器** | ✅ **完成**——`InputClient.insertTextSync` |
| **语言模型** | ✅ **在 HAP 里**（6.4 MB 的 `bopomofo-lm.tsv`） |
| **在真机打字** | ✅ **完成**——`su3cl3` → 你好 |
| 候选翻页、组字上屏显示 | ⚠️ 可用但不完整 |
| 符号表、联想词 | ❌ 尚未实作 |
| 签名与上架（AGC） | ❌ 治理问题 |
| 签章与上架（AGC） | ❌ 治理问题，不是 API 问题（见 [docs/03](../docs/03-platform-matrix.md)） |

## 引擎怎么进去的

**两半，两个 job** ✓ ——因为这个容器只有鸿蒙工具链 ✓：

```yaml
engine:  ubuntu-latest               ← 普通 runner：有 rust、有 curl
  docker cp <image>:/opt/.../native  ← 從同一個映像取出 NDK
  cargo build --target aarch64-unknown-linux-ohos
  cargo test --release
  upload-artifact: libpingzhu_core.a (24 MB)

build:   container: <harmonyos image> ← SDK 在這裡
  download-artifact
  hvigorw assembleHap
  unzip -l | grep '\.so'             ← 驗證，不是猜測
```

**这也是诚实的对半切** ✓ ——交叉编译核心跟鸿蒙的建置系统毫无关系 ✓，
放在普通 runner 上意味着**这里失败就是 Rust 的问题，不是容器的问题** ✓

`aarch64-unknown-linux-ohos` 是**有预编译 std 的 rustup 目标** ✓ ——
不需要 nightly ✓、不需要 `build-std` ✓

## 键盘的键面从引擎来

**不是写在 ArkTS 里的表** ✓ ——面板向引擎要 ✓：

```typescript
const raw: string = pingzhu.keyboardRows('standard');
// "1:ㄅ|2:ㄉ|3:ˇ|…\nq:ㄆ|w:ㄊ|…"
```

`core-rs` 本来就有 `key_rows()` ✓（从解码用的同一张表推导 ✓），
但**没有 C ABI 出口** ✗ ——只有 C++ 链接标头的外壳拿不到 ✓。
加了 `engine_keyboard_rows()` ✓ 再从 NAPI 曝露 ✓。

**这就是 v0.6.0 那个数字键回归的防呆** ✓：画出来的键和看得懂的键
来自同一张表 ✓，**不可能各写一份而有一份是错的** ✓

### 写这个格式时，测试抓到两件事

**一、倚天（ETen）的第一排有 11 个键，只有 9 个有注音成分。**
我原本的格式是「键一串、标签一串」✓，假设两者等长 ✗ ——
**而它不成立，而且没有任何东西说得出是哪个键少了标签** ✗。
改成 `key:label` 配对 ✓，空标签是有意义的资讯 ✓。

**二、分隔符本身是合法的键。** 最自然的选择是逗号 ✓，
**而第四排就是 `zxcvbnm,./`** ✓ ——逗号是键 ✗。改成 `|` 与 `:` ✓。

两个都是「安静的失败」的形状 ✓：格式看起来对 ✓、资料也看起来对 ✓，
**错的是它们之间的假设** ✗ ——所以测试把它们钉住了 ✓。

## 建置路上踩到的**十个**坑

全部都是安静或有误导性的失败 ✓：

| # | 问题 | 症状 |
|---|---|---|
| 1 | 容器里没有 `python3` | 检查脚本死在 `not found`，**而它要检查的工具链就在 `/opt`** |
| 2 | `node` 也不在 PATH 上 | 同上 |
| 3 | 容器的 shell 是 **dash** | `${PIPESTATUS[0]}` → `Bad substitution`，**而且在 BUILD SUCCESSFUL 之后** |
| 4 | `@ohos.inputMethod.*` 在 API 12 不存在 | 大部分网路范例都是旧写法 |
| 5 | `onCreate` 的签名和 `UIAbility` 不同 | IME 收 `(want)`、UIAbility 收 `(want, launchParam)` |
| 6 | 容器没有 `curl` 也没有 `wget` | 装 Rust 的两种办法都死了 |
| 7 | CMake 里的 `../` 手数差了一层 | 症状是**「档案不存在」**，不是「路径错了」 |
| 8 | `engine_create` 收三个参数 | 编 C++ 会报错；**动态载入的外壳不会** |

**第 7 个的修法**：不再手数 ✓ ——从 `CMakeLists.txt` 往上走直到找到
`core-rs/Cargo.toml` ✓ **这样不可能差一层** ✓

**第 8 个是第三个「一份描述不是那个函式库的东西」** ✗ ——前两个是
`pingzhu.h` 少了两个宣告 ✓、`docs/03` 写着两个参数的签名 ✓
（后者顺手一起修了 ✓）

| # | 问题 | 症状 |
|---|---|---|
| 9 | 倚天布局的第一排**键比标签多** | 两串字元不等长，**说不出哪个键少了标签** |
| 10 | **`engine_abi_version` 没有 `#[no_mangle]`** | `ld.lld: undefined symbol` |

**第 10 个是我自己造成的，而且 28 个测试全过** ✗ ——
我把新函式插在 `pub extern "C" fn engine_abi_version` 那一行之前 ✓，
**而它的 `#[no_mangle]` 与 doc comment 就在上面** ✗ ——
属性和它的函式被拆开了 ✓。

> **插入点选在「函式」而不是「项目」之前，就是这个下场。**

现在有测试了 ✓：`every_exported_function_has_no_mangle` 读 `ffi.rs` 自己 ✓，
对每个 `extern "C"` 往上找属性 ✓，**碰到非属性、非 doc 的行就停** ✓。
**而且验证过它会红** ✓。Rust 测试 27 → 29 ✓

## 连到编辑器

**API 是问 SDK 得到的，不是猜的** ✓ ——因为参照的 mingkey 做的是翻译 ✓，
没有编辑器连线可以抄 ✓：

```typescript
insertText(text: string): Promise<boolean>;
insertTextSync(text: string): void;
insertTextSync(text: string): void;
deleteBackwardSync(length: number): void;

on('inputStart', (kbController: KeyboardController, inputClient: InputClient) => void)
on('inputStop', () => void)
```

```bash
find /opt -name '@ohos.inputMethodEngine.d.ts' | xargs grep -A2 "interface InputClient"
```

### 三个刻意的决定

**`inputStart` 是唯一拿得到 client 的时刻** ✓ ——`inputStop` 之后留着它 ✗，
等于往一个已经不存在的东西写字 ✓

**引擎在 `inputStart` 时才载入模型** ✓ ——模型要从 HAP 解到 `filesDir` ✓
（原生端读不到 HAP ✓），而且只解一次 ✓

**commit 没有编辑器时回传文字、但仍然警告** ✓ ——
**空的回传值代表「没有东西可送」，不是「送失败了」** ✓ ——两者不该长得一样 ✓

模型档由 CI 复制进 `rawfile/` ✓，**不签进 repo** ✓ ——
那是其他三个平台在用的同一批 `.tsv` ✓，repo 里再放一份就是第二个版本 ✓

## CI 会挡住哪些错

`tools/check-harmonyos-project.mjs`（61 项检查）在每次 push 时跑，
**而且可以在本机先跑**：

```bash
node tools/check-harmonyos-project.mjs harmonyos
```

它检查的是**今天每一个花过时间的结构性失败** ✓：

| 检查 | 对应的失败 |
|---|---|
| `extensionAbilities` 里有 `type: "inputMethod"` | 系统看不到键盘（花了几小时那个） |
| metadata 指向的 profile 存在、subtypes 非空 | 宣告了却什么都提供不了 |
| `main_pages.json` 列的页面存在 | `setUiContent` 载不到 → 空白面板 |
| `index.d.ts` ↔ `napi_init.cpp` 互相吻合 | `@State` 收到 function，元件拒绝渲染 |
| 每个 `$media:` / `$string:` 都能解析 | 缺图示是建置失败，缺字串是执行时的空白标签 |

**而且验证过它会红** ✓ ——故意拿掉 `extensionAbilities`、少一个宣告、
删掉 profile ✓ ——三种都会 FAIL ✓。

> **它自己也曾经是个空壳。** 检查器原本写在 workflow 里，
> 后来一次重写把它换成了一行 `node --version`，
> **而没有人发现——因为一个悄悄停掉的检查，看起来和通过的检查一模一样。**

## 启用的方式

HarmonyOS 跟 Android 一样，装好之后要使用者自己启用：

```
設定 → 系統與更新 → 輸入法 → 更多輸入法設定 → 選擇「平注」
```

开发者可以用 `hdc` 直接启用：

```bash
hdc shell ime -e tw.pingzhu.ime
```
