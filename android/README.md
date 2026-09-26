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
cd android && gradle assembleDebug
```

产物：`android/app/build/outputs/apk/debug/app-debug.apk`

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
跟平台无关**：空白键在没有选字单时送出整句、有选字单时翻页；数字键在选字单打开前
是注音键。第二条 Windows 版曾经做错过一个版本，代价是**所有以 ㄅㄉㄓㄚㄞㄢ 开头的字
都打不出来**。

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
| 空白 | 有选字单 → 下一页；组字中 → 送出整句；否则 → 空白 |
| 数字 | 选字单开着 → 选字；否则 → 照打（1 是 ㄅ、2 是 ㄉ） |
| ⌫ | 退回一个读音成分；组字中为空时交给应用程式 |
| ↵ | 送出 |
| 繁／简 | 切换输出字形（显示的是**当前**字形） |

## 简体输出

和 Windows 版一样：引擎内部全程繁体（读音、语言模型、词库），简体是**输出边界**的
转换。两者共用同一个词频库，所以**选字顺序不会因为字形而改变**。

## 已知限制

- **只在模拟器上验证过**（见下）。实机行为、各家 OEM 的输入法框架差异尚未确认。
- 尚未实作：手写、语音、表情符号、自订词库介面、主题。
- 只做 64 位（`arm64-v8a`、`x86_64`）。32 位装置不支援。
- 没有上架 Google Play，也没有签名金钥——release 用的是 debug 签名。
