# 03 · 五平台输入法框架与限制

> 每一条都标明可信度：**【已查证】**＝官方文件／官方原始码原文；**【推测】**＝基于已查证
> 事实的工程推论；**【需查证】**＝尚未取得可信来源，不可当作结论。
> 完整取证与 URL 见 [research/03-platform-ime-frameworks.md](../research/03-platform-ime-frameworks.md)。

## 结论速览

| 平台 | 官方框架 | 第三方可否自研 | 主要卡点 | 散布路径 |
|---|---|---|---|---|
| **Windows** | Text Services Framework (TSF)，COM in-proc DLL | **可以**，完全开放 | COM 注册 + 语言设定；TSF 本身的复杂度 | 官网下载；建议签章 |
| **macOS** | InputMethodKit (IMK) | **可以**，完全开放 | Info.plist 遗留 key 无现代文件；App Store 沙箱与 IME 安装模型冲突 | Developer ID + **公证**（非 App Store） |
| **Android** | `InputMethodService` | **可以**，完全开放 | 需引导使用者手动启用与切换 | Google Play / F-Droid 皆可 |
| **HarmonyOS NEXT** | IME Kit | **框架明文支持三方输入法**，但受安全管控与华为商业流程双重约束 | ①基础模式禁网路 ②签章／AGC／侧载 ③部分能力仅系统预设输入法可用 | AppGallery（资质要求**【需查证】**） |

**一句话**：前三个平台技术上完全可行且路径成熟；**HarmonyOS 是四者中唯一
「技术可用 ≠ 商业可交付」的平台**——难点不在 API，而在治理。

---

## Windows · Text Services Framework

### 框架定位【已查证】

> "Text Services Framework is designed for use by **Component Object Model (COM) programmers
> using the C/C++ programming languages**."
> — [learn.microsoft.com/windows/win32/tsf](https://learn.microsoft.com/en-us/windows/win32/tsf/text-services-framework)

**关键含义**：TSF 文字服务是一个 **in-proc COM 伺服器（DLL）**，不是独立 exe。
它被载入到使用者的应用程式行程内，因此核心引擎必须是**执行绪安全、低延迟、可重入**的。

### 核心介面【已查证】

| 介面 | 职责 |
|---|---|
| `ITfTextInputProcessor` / `ITfTextInputProcessorEx` | 进入点，`Activate`／`Deactivate` |
| `ITfThreadMgr`（`CLSID_TF_ThreadMgr`） | 执行绪层管理器 |
| `ITfThreadMgrEventSink` | 焦点与文件切换 |
| `ITfKeyEventSink`（6 个方法） | 拦截按键，经 `ITfKeystrokeMgr::AdviseKeyEventSink` 安装 |
| `ITfComposition` / `ITfContextComposition` | 组字中字串 |
| `ITfDisplayAttributeProvider` | 组字字串外观 |

### 注册流程【已查证】——安装第三方 IME 的核心

```
1. ITfInputProcessorProfiles::Register          註冊 CLSID 與描述
2. ITfInputProcessorProfiles::AddLanguageProfile 加入語言設定檔
                                                 （zh-TW 必填，否則語言列不會出現）
3. ITfCategoryMgr::RegisterCategory              註冊到 TSF 分類
```

再加上 COM in-proc server 的标准注册（`HKLM\SOFTWARE\Microsoft\CTF\TIP\{CLSID}`）。

### 签章【已查证】

官方原文：**"Text service providers *should* provide digital signatures with their binary
executables."** —— 用词是 *should*，不是 *must*。

- **没有 EV 凭证的强制规定。**
- **查无任何「Microsoft 限制非市集 IME」的政策。** Windows 11／12 对第三方输入法没有封锁。

**但这不等于不需要签章**：未签章的 DLL 会触发 SmartScreen 警告，实务上仍应签章。
这是**使用者体验问题，不是平台限制**。

### 真机实测到的（2026-09-27，HUAWEI Mate XT，HarmonyOS 6.1 / API 20）

**这三条之前都是【需查证】，现在都是实测结果：**

**① 侧载第三方输入法：可行。** 完整通路走通了，没有遇到任何审批：

```
hdc install -r keyboard-default-signed.hap     → install bundle successfully
hdc shell ime -e tw.pingzhu.ime                → Succeeded, status: BASIC_MODE
hdc shell ime -s tw.pingzhu.ime                → Succeeded
hdc shell ime -l                               → tw.pingzhu.ime, BASIC_MODE
```

**② 签章材料：DevEco 的「自动签名」会全部办妥。** 只要帐号登录
+ 勾上 `Associate with registered application`，它就会生成并下载：

```
~/.ohos/config/default_harmonyos_<hash>.p12    金鑰庫
~/.ohos/config/default_harmonyos_<hash>.cer    憑證
~/.ohos/config/default_harmonyos_<hash>.p7b    Profile（AGC 發的）
```

**那个勾选框是关键**——第一次没勾，于是没有 `.p7b`，
安装时报 `error: no signature file.`（code 9568320）。

**③ 已有第三方鸿蒙输入法上架，而且是活的。** 同一台手机上：

```
com.iflytek.inputmethod.iFlytekInputIME    status: BASIC_MODE
com.huawei.hmos.inputmethod                （系統內建）
```

**讯飞跑在 BASIC_MODE**——和我们完全一样。所以「第三方输入法能上架
HarmonyOS NEXT、而且能在基础访问模式下正常工作」不是推测，是既有事实。

### 先例：shunti Japanese IME——一个人做的跨平台输入法，已在 AppGallery

**这是目前查到最贴近本专案的一个案例**，比讯飞有用得多——讯飞是大公司。

```
repo:   github.com/shuntilettuce/Japanese-IME-for-HarmonyOS-next
```

| | **shunti** | **平注** |
|---|---|---|
| 语言 | 日文 | **注音（Bopomofo）** |
| 平台 | HarmonyOS ＋ Android ＋ Windows | HarmonyOS ＋ Android ＋ Windows ＋ macOS ＋ Linux |
| 授权 | MIT | MIT |
| 规模 | **一个人**（README 写「个人开発」） | 一个人 |
| 连网 | 不连网（转换在装置上完成） | **不连网**（基础访问模式的要求） |
| **AppGallery** | ✅ **已上架** | ← 目标 |

**它证明了**：个人开发者、开源、**非中文**输入法，能上 AppGallery，
而且用同样的启用路径：

```
設定 → システム → 入力方法 → 選 shunti Japanese IME
```

### 它的 repo 结构（可作参考）

```
AppScope/   entry/   hvigor/   android/   desktop/   docs/   .github/
build-profile.json5   hvigorfile.ts   oh-package.json5
NOTICE   THIRD_PARTY_NOTICES.md   DATA_SOURCES.md   CHANGELOG.md
```

**两个可以学的：**

**① HarmonyOS 工程放在 repo 根目录。** 它在根目录直接有
`build-profile.json5` / `hvigorfile.ts` / `entry/`，所以 DevEco 可以
**直接开整个 repo**。本专案放在 `harmonyos/` 子目录，DevEco 必须开到
那一层（而 `core-rs/` 还要是它的兄弟目录，CMake 才找得到）。

**② `THIRD_PARTY_NOTICES.md` 逐项列出衍伸资料。** 本专案已有
[NOTICE](../NOTICE)，且 [04-data-and-licensing.md](04-data-and-licensing.md)
把每一份资料的授权都查证过；但它的写法更细——连「哪些文件是衍伸作品、
受哪一条条款约束」都点名。

### 上架 AppGallery 还缺什么【待办】

**技术通路已经打通，剩下的是治理流程：**

| 项 | 状态 |
|---|---|
| 企业开发者帐号 | ✅ 已有（`大洋晶典商业集团有限公司`） |
| 测试签名与真机安装 | ✅ 今天完成 |
| **软著（软件著作权登记）** | ⏳ 通常 1–3 个月，可加急 |
| **AppGallery 的应用类别与资质要求** | ⏳ **待查**——输入法是否属特殊类别 |
| 隐私政策与资料安全表单 | ⏳ 本专案不连网、不上传，表单极简 |

**注意**：本专案的输入法**在基础访问模式下不连任何网络**，
这既是框架的要求，也让它在上架的资料安全审查上非常简单。

### 风险评估

仍是五平台里最重的一段。COM apartment 模型、TSF 的非同步编辑工作阶段
（`ITfEditSession::DoEditSession` 回呼）、组字状态机的边界情况，是这类专案常见的超支来源。

**但有一个重要的降低风险因素**：TSF 的注册与生命周期已被 RIME 小狼毫等开源专案走通多年，
且 Microsoft 官方范例为 MIT。**未知数低，工作量高**——这与 HarmonyOS 正好相反。

---

## macOS · InputMethodKit

> ⚠️ **本节修正了常见的错误说法。** 网路上的 IMK 教学常把方法挂错协定，
> 以下逐字核对 Apple 官方 JSON 文件。

### 核心介面【已查证】

| 元件 | 所属 | 职责 |
|---|---|---|
| `IMKServer` | class | 建立连线。**只有两个 initializer**：`init(name:bundleIdentifier:)` 与 `init(name:controllerClass:delegateClass:)`——**没有四参数版本** |
| `handle(_:client:)` | **`IMKServerInput`** protocol | 收按键 |
| `inputText(_:client:)` | **`IMKServerInput`** | 送出字串 |
| `commitComposition(_:)` | **`IMKServerInput`** | 提交组字 |
| `candidates(_:)` | **`IMKServerInput`** | 候选 |
| `activateServer(_:)` / `deactivateServer(_:)` | **`IMKStateSetting`** protocol | 启用／停用 |
| `IMKTextInput`（client 协定） | protocol | 对目前文字栏位送字、取游标位置 |

**注意**：`handle(_:client:)`、`activateServer` 等**不在 `IMKInputController` 上**，
而是在 `IMKServerInput` / `IMKStateSetting` 这两个协定中。
照著错误的教学写会出现「方法没被呼叫」的鬼打墙。

### Info.plist【已查证，以实际产品还原】

`tsInputModeListKey` 与 `ComponentInputModeDict` 是**关键的遗留 key**，
**Apple 现代文件只列出 2 个常数**，等于没有官方文件。
研究方式是直接读取实际产品的 `Info.plist`（McBopomofo、Squirrel）逐字还原。
`research/03` §3.3 附有可用的最小骨架。

### 安装、沙箱与公证【已查证】

- 安装位置：`/Library/Input Methods/` 或 `~/Library/Input Methods/`
- **App Store 与输入法模型冲突**：App Store 审核指南 2.4.5(i)(ii) 要求
  应用必须沙箱化、**且不得安装到 shared location**。而输入法**必须**安装到
  `/Library/Input Methods/`。两者不相容。
- **实证**：Squirrel 与 McBopomofo **都不透过 Mac App Store 发布**，
  走 Developer ID 签章 + `notarytool` 公证。
- macOS 26：**查无新版输入法 API**，IMK 仍是唯一路径。

### 风险评估

中。IMK 相对稳定，且有一个 MIT、活跃、840★ 的完整同类产品（McBopomofo）可逐一对照。
**主要风险在打包与公证流程，不在程式逻辑。**

---

## Android · Input Method Framework

### 核心介面【已查证】

| 元件 | 职责 |
|---|---|
| `InputMethodService` | 输入法 Service，`onCreateInputView()` 回传键盘 View |
| `onStartInput` / `onFinishInput` | 焦点栏位切换 |
| `InputConnection` | `setComposingText()` 组字、`commitText()` 送出 |
| `InputMethodManager` | 系统端管理；使用者需手动启用并选为预设 |
| `method.xml`（`<subtype>`） | 宣告语言／模式 |

### ⚠️ 更正：候选字视窗并没有 deprecated

网路上常见「`CandidatesView` 已 deprecated」的说法。**这是错的。**

- Android 官方 reference 对 `onCreateCandidatesView()` **没有 deprecated 标记**
- AOSP master 原始码中该方法**没有 `@Deprecated`**

真正被 deprecated 的是别的方法（`onUpdateCursor` → 改用 `onUpdateCursorAnchorInfo`、
`onViewClicked` → 改用 `onUpdateEditorToolType`、
`getInputMethodWindowRecommendedHeight` 等），清单见 `research/03` §4.2。

**实务建议仍然是自绘候选列**，但理由不是「API 被废弃」，而是
**候选列与键盘需要在同一套布局里协调高度**，用 `CandidatesView` 反而难控。

### targetSdk 与上架【已查证】

- **Google Play 自 2026-08-31 起强制 targetSdk 36（Android 16）**
- **查无 IME 专属的 Play 政策**。反证：Trime 同时在 Google Play 与 F-Droid 上架。
- 输入法类别需填写资料安全表单——本专案不连网、不上传，表单极简。

### 风险评估

低—中，**五平台中最低**。UI 才是难点：37 键注音加声调键在手机直向萤幕的排列
需要真正的设计工作。这是**设计问题不是工程问题**，但会决定成败。

**这是投报率最高的一段**：商业竞品在此完全缺席（见 [01](01-competitive-analysis.md)），
而技术风险最低。

---

## HarmonyOS NEXT · IME Kit

### 技术可行性：**可行**【已查证】

官方 OpenHarmony 文件（与华为 `@kit.IMEKit` API 同源，且为可下载的纯 Markdown）
提供了五项直接证据：

| 证据 | 原文／位置 |
|---|---|
| IME 引擎模组明文面向三方 | `@ohos.inputMethodEngine` 自述「面向输入法应用（包括系统输入法应用、**三方输入法应用**）」 |
| hdc 明文支持三方 | `hdc shell ime -e <bundle> [-f]`：「支持启用**三方输入法**到基础模式或者完整体验模式」 |
| Extension 对所有开发者开放 | `InputMethodExtensionAbility`（非 system-only） |
| 官方完整开发指南 | `inputmethod-application-guide.md` |
| **官方范例 App** | **KikaInput**（完整 IME 实作，ArkTS） |

开发路径：

```
module.json5  extensionAbilities: type = "inputMethod"
              metadata: ohos.extension.input_method
      ▼
InputMethodExtensionAbility
      ▼
inputMethodEngine.getInputMethodAbility() / getKeyboardDelegate()
      ▼
createPanel() + setUiContent() 載入 ArkUI 頁面（鍵盤 UI 必須是 ArkUI）
```

### ⚠️ 真正的限制：基础访问模式（官方明文）

> 「为了降低 InputMethodExtensionAbility 能力被三方应用滥用的风险，现通过**基础访问模式**
> 的功能约束对输入法应用进行安全管控。**说明：** 严格遵从基础访问模式的功能约束。
> 在此模式下，开发者应**仅提供基础打字功能，不应提供任何形式与网络交互相关的功能**。
> 系统会**逐步增加**基础访问模式的安全管控能力，包括但不限于：**以独立进程和沙箱的方式
> 运行 Extension 进程；禁止 Extension 进程创建子进程；进程间通信与网络访问**等。
> 因此未遵从此约定可能会导致功能异常。」

这段话对架构有**直接且强制**的影响：

| 官方限制 | 对本专案的影响 |
|---|---|
| 禁止网路互动 | **云端词库、云端联想不可行**。本专案本来就不做云端同步——这里从「设计选择」变成「平台要求」 |
| 未来禁止子进程、限制 IPC | 核心引擎必须 **in-process**，不能是独立守护进程 |
| 未来独立沙箱 | 不能依赖跨应用共享的档案路径 |
| 部分能力仅系统预设输入法可用（错误码 `12800010`） | 某些进阶能力（如 `privateCommand`、`exitCurrentInputType`）第三方拿不到 |

**好消息**：本专案的核心本来就是**纯本地、同步、in-process 的 C ABI 函式库**
（见 [02](02-architecture.md) 决策 2），这些限制几乎不造成架构改动。
**唯一被排除的是云端同步——而我们本来就不做。**

### 尚待查证（**这是目前最大的未知数**）

| 项目 | 状态 |
|---|---|
| 签章材料（`.p12` / `.cer` / `.p7b`）与 AGC 凭证流程细节 | ✅ **已查证（2026-09-27，真机）** |
| **侧载（sideload）第三方输入法是否可行、有无装置数上限** | ✅ **已查证：可行**（见下） |
| AppGallery 上架审核、输入法类别是否需特殊资质 | ⏳ 待办（见下） |
| **是否已有第三方鸿蒙输入法上架** | ✅ **已查证：有，而且是活的** |
| ~~是否已有第三方鸿蒙输入法上架~~（搜狗／百度／讯飞鸿蒙版） | ~~**【需查证】**~~——工具限制，不代表不存在 |
| 是否有 RIME／Trime 的鸿蒙移植 | **【已查证：查无】**，但同样受工具限制 |

### 难度评估【推测】

| 面向 | 难度 | 说明 |
|---|---|---|
| 让 IME Extension 跑起来（示范级软键盘） | **低—中** | 有官方指南与 KikaInput 范例 |
| 做出可用的注音输入法 | **中—高** | 注音组字与词库；ArkTS 限制增加移植成本 |
| 纯本地高效能词库引擎（C ABI） | **中** | NDK/NAPI 可用，但须遵守上述限制 |
| 上架审核 | **【需查证】** | 取决于资质要求 |
| 让使用者真的能选用 | **中** | 需引导手动启用；锁屏／密码情境系统不允许切换 |

### 验证计划（两周，先做再说）

**第一步不是写程式，是确认市场是否已经有答案**：

1. **确认 AppGallery 上是否已有第三方注音／中文输入法**（最关键的一项，若已有，
   商业可行性立即确认；若无，则是先行者机会）
2. 用 DevEco Studio 建一个最小 `InputMethodExtensionAbility`，在实机上被系统列为可选输入法
3. 用 ArkTS 写死一个小词表，打出「你好」
4. 确认 NAPI 能否载入自带的 C ABI 静态库

**成功** → M7 立项。
**失败** → 改为「把引擎与词库开放给鸿蒙开发者」，不自建外壳。

---

## 跨平台核心策略

| 方案 | 评价 | 理由 |
|---|---|---|
| **(a) C/C++ 核心 + 各平台原生壳** | ★★★★★ | **唯一被实证的路径**：librime → Weasel／Squirrel／Trime／fcitx5-rime 全生态 |
| **(b) Rust 核心 + uniffi／cbindgen** | ★★★★ | 安全、现代；但**HarmonyOS 没有 Rust target**，仍需手写 NAPI 层 |
| (c) Kotlin Multiplatform | ★★ | Android 很好，Windows TSF／macOS IMK 无可用产出形式 |
| (d) Flutter | ★ | 输入法必须寄生在 OS 框架上，Flutter 模型根本冲突 |
| (e) WASM 核心 | ★★ | 需要宿主 runtime，增加启动成本，输入法无此需求 |

**本专案的选择：Rust 核心 + C ABI**（见 [02](02-architecture.md) 决策 3）。
理由：Rust 的安全性与现代工具链胜过 C++，而 C ABI 这一层让五个平台的外壳
与 (a) 方案完全等价——**风险与被实证的路径相同，语言却更好**。
唯一要记得的是：HarmonyOS 上仍要自己写 NAPI 桥接。

### 词库索引技术

RIME 的做法可供参考：**libmarisa 静态 trie + LevelDB**。
marisa 官方 benchmark（980 万 key）：**50.7 MB**，而 darts-clone 376 MB、
tx-trie 127 MB。

**本专案目前不需要**：6.4 MB 的 TSV 在启动时载入只要 273 ms，解码 15.2 µs/键。
移动端若记忆体吃紧再引入（见 [06](06-engine-design.md)）。

### 延迟目标

**【推测】** 目标 <16 ms／按键（一个 60 Hz 影格）。查无可引用的官方或学术来源，
这个数字是工程惯例而非标准。

---

## 六个外壳共用的 C ABI

```c
EngineHandle* engine_create(const char* data_dir, const char* layout, const char* candidate_order);
void         engine_destroy(EngineHandle);
void         engine_feed_key(EngineHandle, const char* key);   // UTF-8，單一按鍵
void         engine_backspace(EngineHandle);
void         engine_reset(EngineHandle);
const char*  engine_composing(EngineHandle);
const char*  engine_best_sentence(EngineHandle);
int          engine_candidate_count(EngineHandle);
const char*  engine_candidate_at(EngineHandle, int index);
const char*  engine_commit(EngineHandle);
const char*  engine_choose(EngineHandle, int index);
```

三个设计约束：

1. **回传字串的所有权固定在引擎**，呼叫端不负责释放——避免六个外壳各写一套记忆体管理。
2. **按键以 UTF-8 字元传入，而非 keycode**——键盘排列的知识留在核心，
   新增许氏键盘不需要改五个平台。
3. **没有非同步介面**。解码是 15.2 µs 的纯函式计算，同步呼叫即可；
   引入非同步只会让六个外壳各写一套 callback 生命周期。
