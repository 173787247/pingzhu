# macOS 外壳

平注的 macOS 输入法。**解码不在这里**——每一个按键都送到共用的 Rust 核心，
所以 macOS 与 Windows、Android 的选字结果一致。

```
macos/
├── Sources/
│   ├── main.swift                    IMKServer 启动
│   ├── PingZhuInputController.swift  IMKInputController：按键、组字、送出
│   ├── CandidateWindow.swift         候选视窗（NSPanel）
│   ├── Engine.swift                  C ABI 的 Swift 包装
│   ├── Router.swift                  按键路由（纯逻辑，可测）
│   └── PingZhu-Bridging-Header.h     pingzhu.h
├── Tests/main.swift                  读共用测试向量的自我测试
├── Resources/Info.plist              tsInputModeListKey、连线名称
└── build.sh                          编出 PingZhu.app
```

## 建置

**必须在一台 Mac 上**（Swift ＋ InputMethodKit ＋ Darwin 的 Rust 目标，
这三样在别的地方都不存在）：

```bash
bash macos/build.sh
```

## 但 CI 上有一台 Mac

开发这个专案的人不需要 Mac 就能改引擎、Windows 外壳或 Android 外壳。
**但 Swift 打 InputMethodKit 需要** ✗——而另一个选择是「一份从来没被编译过的程式码」✗。

这个 repo 是 public 的，**而 GitHub Actions 的 macOS runner 对 public repo 免费** ✓，
所以 `.github/workflows/macos.yml` 会：

```
1. 為 arm64 與 x86_64 編譯 Rust 核心，再 lipo 成 universal
2. 為兩個架構編譯 Swift，再 lipo
3. 跑 22 條路由向量
4. 檢查 bundle 的四件事（見下）
5. 上傳可下載的 PingZhu.app
```

**所以「它能编译」是事实，不是期望。** 唯一还是测不了的是**真的打字**——
那需要一个人坐在一台 Mac 前面 ✓。

## CI 检查的四件「不会报错」的事

一个输入法 bundle 有很多种坏法，**每一种都是安静地坏掉**：

| 检查 | 错了会怎样 |
|---|---|
| `CFBundlePackageType` = `APPL` | 装进 `~/Library/Input Methods` 之后永远不出现在清单里 |
| `InputMethodConnectionName` 与 `main.swift` 一致 | **伺服器启动了，系统找不到它——输入法会安装、会出现在清单里、然后什么都不做** |
| `InputMethodServerControllerClass` 与 `@objc(...)` 一致 | 同上，但更难查 |
| 执行档同时有 `arm64` 与 `x86_64` | Intel Mac 上装得起来、出现在清单里、打不开 |

最后一条是**第一次建置真的犯过的错** ✗：Rust 那一半是 universal ✓，Swift 那一半
只有 arm64 ✗（我用了 `$(uname -m)` ✗），而 CI 没抱怨 ✗——因为它当时只检查
「编译成功」，没检查「产物是什么」✗。

> **「建置成功」和「产物是对的」是两件事，而 CI 预设只验证前者。**

## 设计取舍

### 键盘的键面来自引擎——但 macOS 没有自绘键盘

macOS 的输入法**不画键盘** ✗——使用者用实体键盘 ✓。所以这个外壳里
`Router.swift` 是纯逻辑 ✓，没有对应的 `KeyboardView` ✓（Android 有，因为那里
需要画 ✓）。

**路由规则仍然和另外三个外壳逐条对应** ✓，而测试向量是共用的 ✓
（`tools/routing-vectors.tsv` ✓）。

### 组字中显示的是解码结果

打的字母**不会**进到应用程式 ✗——显示的是「如果现在送出会得到什么」✓。
那是所有有词库的输入法的重点 ✓。替代方案是看着「我奈以」出现然后变成「我爱你」✗。

猜测（非忠实解码）会**变淡** ✓，让使用者知道什么时候该看选字单 ✓。

### 候选视窗不抢焦点

`canBecomeKey = false` ✓ ——抢走键盘焦点的候选视窗会**中断组字** ✗。

### 选字与切换

| 键 | 行为 |
|---|---|
| 空白 | 有选字单 → 下一页；组字中 → 送出整句；否则 → 空白 |
| 数字 | 选字单开着 → 选字；否则 → 照打（1 是 ㄅ、2 是 ㄉ） |
| ⌫ | 退回一个读音成分 |
| ↓ / ↑ | 开／关选字单 |
| Esc | 放弃组字 |

繁简切换在**输入法选单**里（右上角输入法图示点开 →「平注」子选单）✓。

## 安装

```bash
cp -R dist/PingZhu.app ~/Library/Input\ Methods/
# 然后登出再登入，到
# 系統設定 → 鍵盤 → 輸入方式 → 加入「平注」
```

**必须登出再登入** ✗——macOS 只在登入时扫描 `~/Library/Input Methods/` ✗。

## 已知限制

- **没有在真机上打过字** ✗——编译、bundle 结构、路由规则都验证过 ✓，
  但「装上之后打字正常」还没有 ✓
- **没有程式码签章与公证** ✗——第一次打开会有 Gatekeeper 警告 ✓。
  发行版需要 Developer ID ✓（见 [docs/03](../docs/03-platform-matrix.md)）
- 没有上架 Mac App Store ✗（输入法无法沙箱化 ✗）
- 尚未实作：符号表、联想词、快捷输入
