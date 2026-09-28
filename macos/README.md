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
├── Tests/
│   ├── Router/main.swift             读共用测试向量（22 条）
│   ├── Engine/main.swift             在 macOS 上真的跑一次引擎
│   ├── Install/main.swift            装进去，问系统看不看得到它
│   └── Probe/main.swift              问 runner 能看到什么
├── Resources/Info.plist              连线名称、输入模式、脚本
├── build.sh                          编出 PingZhu.app
├── install.sh                        在 Mac 上一行装好
├── probe.sh                          系统看不看得到它
├── diagnose.sh                       为什么看不到（逐项排除）
└── TESTING.md                        真机测试清单
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

**所以「它能编译」是事实，不是期望。**

而且不只编译 ✓ ——CI 还会**真的把引擎跑起来**，在 macOS 上解码：

```
ok    su3cl3: 你好
ok    w96j0: 台灣
ok    w96j0 in Simplified: 台湾
ok    the engine runs on macOS
```

**「link 得起来」和「跑得起来」是两件事** ✗ ——一个在 Darwin 上 link 得起来、
却因为读不到语言模型而回传空字串的核心，**和使用者打字之前都看起来一模一样** ✗。

### 状态：**真机上验证过，而系统不接受它**

这一节的原文写的是「还没在真机验证」。**那已经不对了**——在一台 Mac mini 上
（macOS、Aqua 工作阶段、真的登入）试过之后，事实是：

| 项目 | 结果 |
|---|---|
| 在真 macOS 上编译（arm64 + x86_64） | ✅ |
| bundle 结构（26 项检查） | ✅ |
| **引擎真的解码**（`su3cl3` → 你好） | ✅ |
| 安装到 `~/Library/Input Methods/` 与 `/Library/Input Methods/` | ✅ |
| 签名有效（ad-hoc）、执行档双架构 | ✅ |
| **执行档真的跑得起来** | ✅ |
| **LaunchServices 认识它**（22 条纪录） | ✅ |
| **系统把它列成输入来源** | ❌ **从来没有** |

输入法选单里只有 ABC、macOS 内建的繁体注音与简体拼音、以及**自然输入法 V13**
（同一台机器上的对照组 ✓ 它运作正常 ✓）。**没有平注。**

### 排除掉的六个假设

每一个都是**安静的失败**——没有一个会报错 ✗：

| # | 假设 | 怎么排除的 |
|---|---|---|
| 1 | `tsInputModeScriptKey` 应该是 `smRoman` | 改成 `smTradChinese`，一样不列 |
| 2 | 需要 `ComponentInputModeDict` | 补上，一样不列 |
| 3 | 应该装到 `/Library`（系统层） | 装了，一样不列 |
| 4 | 执行档一启动就崩 | 它跑得好好的（连续 3 秒） |
| 5 | LaunchServices 不认识它 | 它认识（22 条纪录） |
| 6 | `ComponentInputModeDict` 是旧格式所以被忽略 | 删掉，一样不列 |

而跟**同一台机器上正在运作的输入法**逐键比对之后，
「它有、我们没有」的键是**空的** ✓ ——我们的 `Info.plist` 有它有的每一个键 ✓

### 唯一还没测过的变量：**登入**

到目前为止**六次检查全部是「装完立刻看」**：CI ✓、`~/Library` ✓、`/Library` ✓、
删掉 `ComponentInputModeDict` 之后 ✓、用 `ditto` 重铺之后 ✓

**没有一次是「装完 → 登出 → 登入 → 再检查」** ✓

而自然输入法是**安装程式装的** ✓，机器从那之后一直登入着 ✓ ——
所以「新装的输入法在登入之后会不会出现」这一件事，**从来没有被观察过** ✓

macOS 在登入时读取 `~/Library/Input Methods` ✓；`lsregister` ✓、
重启输入源代理 ✓、`open` 一次 ✓ 都试过而无效 ✓ ——但那些都不是登入 ✗

**这是下一步。** 顺序写在 [TESTING.md](TESTING.md) 里，登出放在最后 ✓
（这台机器是透过向日葵连的，而向日葵不会在登出后自动登入 ✓）

### CI 仍然是主力

开发这个专案不需要 Mac ✓ 就能改引擎、Windows 外壳或 Android 外壳 ✓ ——
**但 Swift 打 InputMethodKit 需要** ✗，而另一个选择是「一份从来没被编译过的程式码」✗

这个 repo 是 public 的 ✓ 而 GitHub Actions 的 macOS runner 对 public repo 免费 ✓，
所以 `.github/workflows/macos.yml` 会编译两个架构、跑 22 条路由向量、
在 macOS 上真的跑一次引擎、检查 bundle 的 26 件事、并上传可下载的 `.app` ✓

**「它能编译」是事实，不是期望** ✓ ——而**「系统接不接受它」是另一件事** ✗，
那是 CI 结构上问不出来的 ✓

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

**两种人，两条路。** 之前这里只写了第一条，而下载 release 的人照着做会失败 ✗。

### A. 你下载了 release（推荐）

```bash
curl -fsSL https://raw.githubusercontent.com/173787247/pingzhu/main/macos/install.sh | bash
```

**它做完全部的事**：下载 → 校验 sha256 → 解压 → **解除隔离** →
装到 `~/Library/Input Methods/` → 问系统看到没。

**然后登出再登入** ✗——macOS 只在登入时扫描 `~/Library/Input Methods/` ✗。
最后到 `系統設定 → 鍵盤 → 輸入方式 → 加入「平注」`。

### B. 你手动下载了 zip

```bash
cd ~/Downloads
unzip -o pingzhu-0.9.0-macos-UNVERIFIED.zip

mkdir -p ~/Library/Input\ Methods
rm -rf ~/Library/Input\ Methods/PingZhu.app
cp -R PingZhu.app ~/Library/Input\ Methods/

# ★ 这一步不能省
xattr -dr com.apple.quarantine ~/Library/Input\ Methods/PingZhu.app
```

**`xattr` 那一行不能省** ✗✓ ——**浏览器下载的档案带隔离标记 ✓
带隔离的 bundle 装得上 ✓ 签章有效 ✓ 每一个检查都过 ✓ 但系统永远不列它** ✗
——**而且完全不会报错** ✓ 这份文件之前漏了它 ✓

### C. 你自己从原始码建置

```bash
bash macos/build.sh
cp -R dist/PingZhu.app ~/Library/Input\ Methods/
xattr -dr com.apple.quarantine ~/Library/Input\ Methods/PingZhu.app
```

**自己建置的不会有隔离标记** ✓ 但写上无害 ✓

---

## 不要从 CI 的 artifact 下载

**`macos/TESTING.md` 曾经指着一个具体的 CI run** ✗ ——artifact 会过期 ✓
而且上传的档名改过 ✓ 旧的指令照着打会失败 ✓

**要下载就从 [Releases](https://github.com/173787247/pingzhu/releases) 下** ✓

## 原因找到了（2026-09-28）

**macOS 26 不接受 ad-hoc 签名的输入法。**

```
$ spctl -a -vvv -t exec ~/Library/Input\ Methods/PingZhu.app
/Users/grandocean/Library/Input Methods/PingZhu.app: rejected

$ codesign -dv ~/Library/Input\ Methods/PingZhu.app
Signature=adhoc
TeamIdentifier=not set
```

**系统于是完全不注册它** ✗ ——**不是「注册被拒」✗ 是「根本没进列表」** ✓：

```
$ python3 -c "…TISCreateInputSourceList(NULL, True)…"
  the system has 318 input sources installed
  ✗ NOT INSTALLED — the system does not have it at all
```

### 为什么查了这么久

| 工具 | 它实际回答的问题 | 对本案的回答 |
|---|---|---|
| `codesign --verify` | 签章**内部一致**吗 | **valid** ✓ |
| `defaults read com.apple.HIToolbox` | 有哪些**已启用**的输入源 | 没有它（废话，还没加）✗ |
| `ls -la` | 档案在不在 | 在 ✓ |
| **`spctl -a`** | **Gatekeeper 认不认这个身分** | **rejected** ✗ ← 从来没人跑过 |
| **`TISCreateInputSourceList(NULL,True)`** | **系统装了哪些** | **NOT INSTALLED** ✗ ← 从来没人跑过 |

**前三个问题都问得很像 ✗ 而答案全都是「看起来没问题」** ✓

### 为什么 CI 一直是绿的

```
CI:   macos-14      ← ad-hoc 在這裡可以 ✓
真機:  macOS 26.5.1  ← 不行 ✗
```

### 修法

**免费 Apple ID 就能做 ✗ 不需要 Xcode ✗ 不需要 $99** ✓：

```
① 用 Apple ID 登入 https://developer.apple.com/account
② Certificates, Identifiers & Profiles → Certificates → ＋
③ 選 Apple Development
④ 它會要一個 CSR：
     Keychain Access → 憑證輔助程式 →
     從憑證授權要求憑證…  → 存到磁碟
⑤ 上傳 .certSigningRequest，下載 .cer，雙擊匯入
⑥ security find-identity -v -p codesigning     ← 看有沒有
⑦ codesign --force --deep --sign "Apple Development: …" PingZhu.app
⑧ spctl -a -vvv -t exec PingZhu.app            ← 應該變成 accepted
```

**然后 `install.sh` 会自己把这一步检查出来** ✓ ——**它现在会印 `REJECTED` 和上面这段修法** ✓

## 已知限制

- **没有在真机上打过字** ✗——编译、bundle 结构、路由规则都验证过 ✓，
  但「装上之后打字正常」还没有 ✓
- **没有程式码签章与公证** ✗——第一次打开会有 Gatekeeper 警告 ✓。
  发行版需要 Developer ID ✓（见 [docs/03](../docs/03-platform-matrix.md)）
- 没有上架 Mac App Store ✗（输入法无法沙箱化 ✗）
- 尚未实作：符号表、联想词、快捷输入
