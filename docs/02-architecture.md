# 02 · 架构决策

> 这份文件记录「为什么这样做」，而不只是「做了什么」。每一条决策都附上被否决的选项与否决理由。

## 决策 1：自己做解码引擎，而不是包一层 RIME

**否决：以 RIME schema 出货。** 这是台湾社群最常见的做法，成本也最低：写一份
`bopomofo.schema.yaml`，Windows 用小狼毫、macOS 用鼠须管、Android 用同文、Linux 用 fcitx5-rime，
一到两周就能「五个平台都有」。

否决理由：

1. **它到不了 HarmonyOS。** 本专案的四个目标平台里，鸿蒙没有 RIME 前端，而且鸿蒙的输入法
   只能透过官方 IME Kit 以 `InputMethodExtensionAbility` 实作——那是一段必须自己写的
   ArkTS 程式码。既然无论如何都要写一个原生外壳，外壳背后的引擎就没有理由外包。
2. **授权会传染。** librime 本身是 BSD-3-Clause（宽松），但**官方五个平台前端全部是 GPL-3.0**
   （weasel、squirrel、trime、ibus-rime）。用它们出货等于整个产品必须 GPL-3.0。
   本专案希望核心能被宽松授权地嵌入，因此不能站在那条链上。
3. **RIME 的注音不是原生注音。** `rime-bopomofo` 的 `translator.dictionary` 指向
   `terra_pinyin`（汉语拼音词库），再用 `zhuyin.yaml` 的拼写代数把拼音转写成注音。
   这条路径对注音的破音字、轻声、ㄦ化处理是绕道而行，除错时要跨越两层转换。
4. **控制权。** 候选排序、学习行为、简繁转换、符号表这些「使用体验」正是平替要竞争的地方，
   隔著一层 schema 表达不出来。

**保留的相容性**：不排斥未来**额外**输出 RIME schema，让已经在用 RIME 的使用者也能吃到
本专案的词库与排序成果。这是加值，不是架构基础。

## 决策 2：核心必须有 C ABI，且不碰任何平台 API

五个平台的输入法框架要求的介面高度一致：

```
按鍵 → [引擎] → 組字中的注音 ＋ 最佳句子 ＋ 候選清單 → 平台負責顯示與送字
```

| 平台 | 进入点 | 需要什么 |
|---|---|---|
| Windows TSF | `ITfTextInputProcessor` | 一组 COM 介面实作（in-proc DLL） |
| macOS IMK | `IMKInputController` + `IMKServerInput` | 一个 Objective-C/Swift 类别 |
| Android | `InputMethodService` | 一个 Service 子类 |
| HarmonyOS | `InputMethodExtensionAbility` | 一个 ArkTS ExtensionAbility |

四者语言、记忆体模型、执行绪模型都不同，但**介面形状相同**。因此核心的对外合约被设计成
最小公倍数：

```
engine_feed_key(key)      → 新狀態
engine_backspace()        → 新狀態
engine_candidates()       → 候選陣列
engine_commit()           → 輸出字串
engine_reset()
```

这个合约用 C ABI 表达，任何语言都能绑：

| 平台 | 绑定方式 |
|---|---|
| Windows TSF | 直接连结 C ABI（C++ 外壳） |
| macOS IMK | Swift Package Manager 包一层 Swift 绑定，或直接 C interop |
| Android | JNI（Kotlin 外壳） |
| HarmonyOS | NAPI（ArkTS 外壳呼叫 C/C++） |

**否决 Flutter。** 输入法不是「画一个键盘」而已：Android 的输入法必须是
`InputMethodService`（Flutter 只能当其中的一个 View），Windows 的输入法必须是 TSF COM 元件
（Flutter 无法注册为 TSF 文字服务），macOS 的 IMK 也必须是原生 `IMKInputController`。
Flutter 能做的只有「键盘 UI」这一小块，而那一块每个平台本来就有原生做法。
用 Flutter 只会多一层启动成本与记忆体开销，却省不掉任何一个原生外壳。

**否决 Electron／WebView。** 同上，且输入法对延迟极敏感，多一层 JS bridge 毫无益处。

**否决 Kotlin Multiplatform。** 对 Android 很好，但 Windows TSF 与 macOS IMK 上 KMP 没有
可用的产出形式（Kotlin/Native 没有 TSF 或 IMK 的绑定），会变成「Android 用 KMP、其他三个平台另写」，
等于多维护一套。

## 决策 3：先做 TypeScript 参考实作，再移植 Rust

本仓库的 `engine/` 是 **TypeScript 参考实作**，不是最终出货形态。

理由：

1. **零建置成本可验证。** Node 24 内建型别剥离，`node engine/cli.ts su3cl3` 直接跑，
   不需要编译器、不需要依赖、不需要 CI 就能重现。这让「引擎到底能不能用」这件事
   在专案第一天就能被任何人验证，而不是等 Rust 工具链就绪。
2. **演算法先于语言。** 真正难的是切分与读字格评分（见 [06](06-engine-design.md)），
   这些逻辑用 TS 写最快、最好除错，且有 11 项测试钉住行为。
3. **移植有明确的验收标准。** Rust 版只要对同一批输入产生同样输出，就算移植成功——
   测试案例已经写好了。

Rust 版是**出货形态**，且**已于 M3 完成**（`core-rs/`）。四个佐证：

1. crates.io 已有 `chewing` 0.14（libchewing 的 Rust 重写）证明 Rust 核心在输入法场景可行，
   且它同时提供 C API 与官方 Swift Package。
2. **唯一被实证的跨平台输入法架构是「C/C++ 核心 + 各平台原生壳」**（librime →
   Weasel／Squirrel／Trime／fcitx5-rime 全生态）。Rust + C ABI 在这个架构里
   与 C++ 核心**等价**——风险相同，语言更好。
3. **但要记得一个差异**：HarmonyOS **没有 Rust target**。鸿蒙端仍必须自己写 NAPI 桥接层
   呼叫 C ABI。这不改变架构，但是 M7 的一个已知工作量。
4. **移植没有变快**（16.5 µs vs TS 的 15.2 µs），这不是问题：Rust 的价值在于能被嵌进
   别人的行程（TSF 是 in-proc DLL），而不是速度。详见 [core-rs/README](../core-rs/README.md)。

**否决「一开始就写 Rust」。** 没有 `rustc` 的环境要先装工具链，且演算法还在变动期，
编译—测试回圈会拖慢探索。语言选择不该挡住演算法验证。

**否决「只用 TypeScript 出货」。** 没有 C ABI 就绑不进 TSF／IMK／JNI／NAPI 六个外壳；
用 Node 当执行环境会让每个输入法实例多揹一个 VM 的启动时间与记忆体。

## 决策 4：语言模型用纯文字 TSV，不用二进位格式

`data/bopomofo-lm.tsv` 是 `讀音<TAB>詞<TAB>log10機率` 的纯文字。6.4 MB、169,604 行。

理由：

1. **可审计。** 使用者可以 `grep` 看「为什么我的输入法选了这个字」。
2. **可携。** Rust 版、ArkTS 版、未来的任何版本读同一份位元组，没有格式谈判。
3. **可 diff。** 词库更新在 git 里看得见差异，而不是「二进位档案已变更」。
4. **代价可接受。** 读取 6.4 MB 纯文字耗时 273 ms，且只在启动时发生一次；
   解码热路径是 15.2 µs/键。若未来记忆体吃紧，再另外产生一份排序过的二进位索引即可，
   届时 TSV 仍可作为规格与 fallback。

## 决策 5：切分与选字联合评分

见 [06-engine-design.md](06-engine-design.md) 的完整推导。一句话版本：

> `ji394su3` 可以合法切成「我爱你」，也可以切成「我奈以」。
> 任何「先切音节、再选字」的两段式设计都会在第一步就丢掉正确答案，
> 因为两个切分在第一阶段看起来一样合理。

## 决策 6：授权策略——宽松核心 ＋ 自写外壳

| 层 | 授权 | 理由 |
|---|---|---|
| 本专案程式码 | **MIT** | 与上游资料授权一致、与 GPL-2.0-only 相容、贡献门槛最低 |
| 语言模型资料 | MIT（衍生自 McBopomofo） | 上游即是 MIT，不可也无须重新授权 |
| 平台外壳 | 跟随本专案 MIT | 不引入 GPL 外壳，避免传染 |

### 为什么最后选 MIT 而不是 Apache-2.0

专案最初以 Apache-2.0 起步，后来改为 MIT。理由是具体的，不是偏好：

| 考量 | Apache-2.0 | MIT |
|---|---|---|
| 专利授权条款 | ✅ 明示授权（§3）＋专利报复条款 | ❌ 未提及 |
| 修改标示义务 | 需标示修改（§4b）、NOTICE 机制 | 无 |
| **与 GPL-2.0-only 相容** | ❌ **不相容** | ✅ 相容 |
| 与 GPL-3.0 相容 | ✅ | ✅ |
| 与上游一致性 | 资料是 MIT，形成双授权 | ✅ 整包单一授权 |
| 档案长度 | 202 行 | 21 行 |

决定性因素是**相容性**：`chewing/chewing-editor` 是 **GPL-2.0**，
Linux 生态的 `ibus-chewing` 也是 GPL-2.0。若未来想从这些专案取用任何程式码，
Apache-2.0 会直接挡住，MIT 不会。

（注：libchewing 本身是 **LGPL-2.1-or-later**，可依 LGPL-3.0 取用，
与 Apache-2.0 相容——所以它不是问题。真正的问题是它旁边那些 GPL-2.0-only 的邻居。）

**唯一的损失是专利授权条款。** 评估如下：
1990–2000 年代的中文输入法专利（含自然输入法「脉络会意法」时代的相关专利）
依 20 年专利期早已届满；而本专案使用的技术——读字格上的 Viterbi 解码、
n-gram 语言模型——其学术前案可追溯至 1980–90 年代。实务风险低。

**若未来有企业采用需求**（企业法务通常偏好 Apache-2.0 的专利条款），
可以重新评估；但要记得已经发布的版本（v0.1.0）依 Apache-2.0 授权，
取得者对该版本的权利不会因后续换证而消失。

**明确避开的地雷**（详见 [04](04-data-and-licensing.md)）：

- 不使用 GPL-3.0 的 RIME 官方前端（weasel／squirrel／trime／ibus-rime）
- 不静态连结 LGPL-2.1 的 libchewing 而不提供替换机制
- 不使用**没有授权档**的资料集（无授权＝保留所有权利，例如 CWN、moedict-data、bpmfvs）
- 教育部辞典为 CC BY-**ND** 3.0 TW（禁改作），不可径自简化字或改编
- 繁化姬是闭源服务且条款限制多，简繁转换一律走 **OpenCC（Apache-2.0）**

## 决策 7：平台外壳的优先顺序

| 顺序 | 平台 | 理由 |
|---|---|---|
| 1 | Windows TSF | 使用者基数最大，且 Microsoft 官方 samples 为 MIT，有正当参考来源 |
| 2 | Android | 缺口最大（商业竞品完全缺席），`InputMethodService` 是四个框架里最简单的 |
| 3 | macOS IMK | 与 Windows 同属桌面主力；社群已有 MIT 的 McBopomofo 可对照 |
| 4 | HarmonyOS | 技术未知数最大，先完成可行性验证再排程 |
| 5 | Linux | 生态现成（fcitx5 addon），成本低但使用者少，选配 |

顺序不是「先易后难」，而是**「使用者价值 ÷ 未知数」**：Windows 与 Android 的未知数接近零，
HarmonyOS 的未知数最大，所以鸿蒙先做研究、不先进排程。
