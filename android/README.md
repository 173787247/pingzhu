# Android 外壳

平注的 Android 输入法。**解码不在这里**——每一个按键都送到共用的 Rust 核心，
所以 Android 与 Windows 的选字结果一致。这个模块只负责「怎么当一支 Android 输入法」。

```
android/
├── rust/              JNI 绑定：把 Rust 核心接成 tw.pingzhu.ime.Engine
├── app/               InputMethodService ＋ 自绘键盘 ＋ 候选列
├── build-rust.sh      交叉编译 .so（NDK linker、每个 ABI）
└── setup-sdk.sh       从零装好 SDK／NDK
```

## 建置

```bash
bash android/setup-sdk.sh          # 只需一次
bash android/build-rust.sh --release
cd android && ./gradlew assembleDebug   # 版本由 wrapper 钉住，不用先装 gradle
```

产物：`android/app/build/outputs/apk/debug/app-debug.apk`

`gradlew` 会自己下 Gradle 8.9（AGP 8.5.2 要求 8.7 以上）。用 wrapper 而不是系统的
`gradle`，是因为「先装一个恰好对版本的 Gradle」是这台机器上的巧合，不是别人的机器上
也成立的前提。

## 为什么是这些选择

### 引擎走 JNI，不重写

Kotlin 这边**没有**读字格、没有分词、没有候选排序。`Engine.kt` 是一层薄到可以一眼
看完的转发，`android/rust/src/lib.rs` 是它唯一的另一端。任何在 Kotlin 里「顺手」
重写的解码逻辑，都会变成第二个实作，然后两个实作慢慢不一样——而使用者只会发现
「手机选的词跟电脑不一样」，不会知道为什么。

### 键盘的键面来自引擎，不是这里的一张表

`Engine.keyboardRows()` 从**解码用的同一张表**推导出该画什么。手写的键盘图是会
一个键一个键走样的东西，而且只有「已经把大千式背下来的人」才会发现——**而那正是
不需要看图的人**。

Rust 那边有两个测试把两者钉在一起：
`the_drawn_keyboard_matches_the_decoder`、`every_composing_key_is_drawn`。

### 按键路由是可测的纯逻辑

`Router.kt` 不依赖 Android，所以 `RouterTest` 在 JVM 上跑，不需要模拟器、不需要
APK、不需要装置。

这些规则不是重新设计的——它们和 Windows 的 router 逐条对应，因为**真正重要的规则
跟平台无关**：空白键在组字中、单还没开时开单，单开着时送出整句；翻页归浏览键管
（桌面版是 ↓，手机上是底排的 ▼）；数字键在选字单打开前是注音键。最后一条 Windows 版
曾经做错过一个版本，代价是**所有以 ㄅㄉㄓㄚㄞㄢ 开头的字都打不出来**。

### 零权限

输入法不需要任何权限：没有网路、没有储存空间、没有通讯录。语言模型在 APK 里，
使用者词库在应用自己的目录里，**没有任何东西会被送到任何地方**。

```
<uses-permission> 一個都沒有
```

### 语言模型不重复进版本库

`data/bopomofo-lm.tsv` 已经在仓库里了。Gradle 的 `copyEngineData` 任务在 `preBuild`
时把它复制进 `assets/`，所以 `android/app/src/main/assets/` 是 gitignore 的——
**第二份 6.4 MB 就是第二个会不同步的东西**。

## 装上之后

Android 不允许输入法自己启用，所以 App 里有两个按钮直接跳到系统的两个开关：

1. **启用输入法** → 系统设定里的输入法清单
2. **选择输入法** → 系统选择器

> 不提供这两条路，使用者就得自己在设定里挖三层。**常见的结局是这套输入法从来没被用过。**

## 怎么打

```
su3cl3        → 你好
ji394su3      → 我愛你
w96j0         → 台灣
```

| 键 | 行为 |
|---|---|
| 空白 | 组字中、单没开、有候选 → **开候选单**；单开着或没有候选 → 送出整句；没组字 → 空白 |
| ▼ | **开候选单／翻页**：单没开就开，开着就翻十笔（桌面版的 ↓ 键在手机上就这一个键）|
| 数字 | 选字单开着 → 选字；否则 → 照打（1 是 ㄅ、2 是 ㄉ） |
| ⌫ | 退回一个读音成分；组字中为空时交给应用程式 |
| ↵ | 送出 |
| 繁／简 | 切换输出字形（显示的是**当前**字形） |

## 简体输出

和 Windows 版一样：引擎内部全程繁体（读音、语言模型、词库），简体是**输出边界**的
转换。两者共用同一个词频库，所以**选字顺序不会因为字形而改变**。

## 已知限制

- **只在模拟器上验证过**（见下）。实机行为、各家 OEM 的输入法框架差异尚未确认。
- ~~候选列永远不会显示~~ —— **已修**（2026-10-12）。原本有两个各自独立的毛病：
  1. `CandidateBar` 建在 `onCreateCandidatesView()` 里、点选回调也接了，但全仓没有一处
     调用 `setCandidatesViewShown(true)`，而 Android 的 candidates view 预设是隐藏的；
  2. 就算叫了也没用：视窗在 `onCreate` 里被钉成整屏（那是为了修「视窗量到 0」），
     框架的候选列容器因此拿不到位置 —— 实测 `isShown=false`、`vis=VISIBLE`、1080x551，
     量得好好的、就是不上屏。
     现在候选列是**输入视图自己的一部分**（`onCreateInputView` 里一个垂直 `LinearLayout`：
     候选列在上、键盘在下、整体贴底），不经过框架那块容器。
- ~~候选单开出来之后不能翻页~~ —— **已修**（2026-10-13）。翻页在共享路由里是 ↓ 的职责
  （`ArrowDown`：单没开就开，开了就翻十笔），而手机键盘上没有 ↓，空白在单开着时又是
  「送出」，第一页十个之后的候选因此取不到。现在底排多了一个 **▼** 键（`'\u000b'`，
  正是 `Router.kt` 一直当作 ↓ 读的那个字符），`Router.kt` 的那一格也补成和桌面版一致：
  开着 → `NextPage`，没开 → `OpenCandidates`。JVM 测试加了
  `theDownArrowPagesOnceTheListIsOpen` 盯着它。
- 尚未实作：手写、语音、表情符号、自订词库介面、主题。
- 只做 64 位（`arm64-v8a`、`x86_64`）。32 位装置不支援。
- 没有上架 Google Play。**签的不是 debug key**：已发布的 APK（v0.10.3 起）
  凭证是 `CN=PingZhu, OU=PingZhu, O=PingZhu, L=Shanghai, C=CN`（可以自己复核：
  `apksigner verify --print-certs pingzhu-<版本>-android.apk`）。签名金钥与
  `keystore.properties` 都不在仓库里（`.gitignore` 挡着），所以要自己发版得先有自己的
  keystore。
