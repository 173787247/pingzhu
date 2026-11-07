# v0.10.10 — 手机上也能用自订短语了

## 一句话

v0.10.9 说快捷输入「零外壳改动」。**对五个前端成立，对 Android 不成立** —— 它在手机上
静默失效，没有任何地方报错。这一版把它修好，并给那个 crate 补上第一批测试。

## 一、Android 上短语表从来没被读过

Android 有自己的一份 Rust 外壳（`android/rust/src/lib.rs`），它**不走** C ABI 的
`engine_create`，而是在 `nativeCreate` 里**自己调** `Dictionary::load`。

v0.10.9 给 `ffi.rs` 加 `load_with_shortcuts` 时，它没有跟着动。结果：

| 平台 | 短语表 |
|---|---|
| Windows / Linux / macOS / HarmonyOS / 网页试打版 | ✓ 能用 |
| **Android** | ✗ **静默失效** —— 不报错、不崩溃，就是打不出短语 |

HarmonyOS 那侧走的是 `engine_create`，所以自动就好了。

修法一行：改成 `load_with_shortcuts`，与桌面 FFI 同一段逻辑 —— 从数据目录找**可选**的
`shortcuts.tsv`，找不到就是「没有短语」的正常安装。

## 二、给那个 crate 补上第一批测试

`android/rust` 此前**零测试**（`cargo test` 报 `0 passed`）。这类错误本该被测试挡住。

新增两条：

- 出货的 `data/` 目录里确实有短语表
- 用这个目录建出来的引擎读得到它（`ㄉㄧˋ-ㄓˇ` 的第一条候选是整条地址，语言模型原本的
  「地址」还在后面）

⚠️ **诚实地说**：这两条**守的是规则，不是那个调用点**。要挡住原错，得让 `nativeCreate`
本身可测 —— 那要注入 `JNIEnv`，不值得。这次是靠人眼审出来的；测试是让「下次这类错至少
有一条会亮」。

## 三、两处文档修正

来自 AtomGit 上那个 Code Review 任务的 PR（`!1`）：

- `docs/06` 里「六种前端各有一页全形标点」说准成「五个外壳与网页试打版」—— 原文容易被
  读成六种外壳，而外壳只有五个
- README 补上**自订短语的使用说明** —— 功能发了，但使用者面向的文档一个字都没有

## 四、验证到哪

| 平台 | 验证 |
|---|---|
| TS 引擎 | 72 项测试全过 |
| Rust 核心 | 32 单元 + 6 个测试档全过（1,532 行差分、225 条场景）|
| Android | **2 条新测试**全过；CI 绿 |
| 五个外壳 | CI 全绿 |
| macOS / HarmonyOS 真机 | **仍未验证**（需要 Apple Developer ID 与真机）|

## 五、下载

- Windows：`pingzhu-0.10.10-setup.exe` 或 `pingzhu-0.10.10-win-x64.zip`
- Android：`pingzhu-0.10.10-android.apk`（`versionCode` 12）—— **这一版它才有用**，上一版
  装上去也打不出短语
- Linux：`fcitx5-pingzhu_0.10.10_amd64.deb` 或 `fcitx5-pingzhu-0.10.10-1.x86_64.rpm`
- HarmonyOS：`pingzhu-0.10.10-harmonyos-project.zip`
- 引擎：`pingzhu-engine-0.10.10.tgz`

**Windows 升级**：TSF DLL 档名不变（`pingzhu-tsf-0.10.6.dll`）—— 本版 `windows/src`
与 `windows/tsf` 零改动，按 `RELEASING.md` 第二节的判据，DLL 的字节没有变化。
