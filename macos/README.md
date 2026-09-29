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

## 结论：两件事都必须做（2026-09-28 实测）

**macOS 输入法要出现，需要同时满足两个条件。少一个都不会出现，而且都不会报错。**

### ① 应用必须自己向系统登记

放在 `~/Library/Input Methods` 不等于注册。每个能用的输入法都调用这个：

```swift
TISRegisterInputSource(Bundle.main.bundleURL as CFURL)   // 告訴系統這個 bundle 存在
TISEnableInputSource(source)                             // 把每個 mode 放進清單
```

| 谁 | 谁调用 |
|---|---|
| vChewing | app 启动时 |
| WeType | `WeTypeInstaller.app` |
| 自然输入法 | 它的 installer |
| **平注（0.9.0 及之前）** | **没有人** ← 一直缺的一半 |

0.9.1 加上了 `Sources/Registration.swift`。

### ② 签章必须是 Apple 签发的

**这一条是实测出来的，不是推断的。** 0.9.1 从 app 内部调用注册 API：

```
PingZhu: declared modes: ["tw.pingzhu.ime.Bopomofo"]
PingZhu: registering /Users/.../PingZhu.app with the system
PingZhu: after registering, the system lists 0 of our inputs     ← ★
```

**`TISRegisterInputSource` 返回 `noErr`，而系统列出了 0 个。**

所以 `noErr` 不代表成功——**系统接受了调用，然后在内部决定不登记**，
而它唯一不合格的地方是 `spctl -a -vvv -t exec` 返回 `rejected`。

### 两个变量都控制过了

| 组合 | 结果 |
|---|---|
| ad-hoc，不呼叫注册 API | ✗ 不出现 |
| 自签 ＋ 系统信任，不呼叫 API | ✗ 不出现 |
| 自签，呼叫 API（从 Python） | ✗ `noErr` 但看不到 |
| **ad-hoc，呼叫 API（从 app 内部）** | ✗ **`noErr`，列出 0 个** ← 0.9.1 |
| Apple 签发 ＋ 公证 ＋ 呼叫 API | ← 还没测，这是 `notarize.sh` |

### 所以

**`spctl` 是判官，而它要的是 Apple 签发的 Developer ID。**
免费 Apple ID 做不出 Developer ID——portal 对免费帐号不显示 Certificates
（实测）。Xcode 的 Personal Team 能签，但发的是 Apple Development 凭证，
`spctl` 对 `-t exec` 也不接受。

**付费入会是答案，不是变通。** 官方定价 99 USD／会员年（各区域以当地货币
在入会流程中显示）。付完之后跑 `macos/notarize.sh`。

### 入会的两个硬性条件（官方页面，2026-09 查核）

这两条不满足会**卡在审核** ✗，而它们和「写程式」完全无关 —— 所以值得先看：

```
· Apple Account 必须开启双重认证（two-factor authentication）
· 姓名栏必须是【法定姓名】✗ 不能用别名、昵称或公司名 ✓
    官方原文：Using an alias, nickname, or company name as your first or
    last name will cause a delay in the approval of your enrollment.
· 个人入会另需：电子邮件、电话、地址（★ 不接受 P.O. box 信箱）
· 组织入会另需：D-U-N-S Number、与组织网域一致的工作信箱、公开可用的网站
    个人自用不需要走组织这条路 ✗
```

来源：https://developer.apple.com/programs/enroll/

---

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

**★ 这一段原本写的是「免费 Apple ID 就能做 ✗ 不需要 Xcode ✗ 不需要 $99」✗
—— 那是还没实测之前的猜想 ✓，而上面「结论」一节已经推翻了它 ✗。**

推翻它的两件事，都是实测 ✓：

```
· portal 对免费帐号不显示 Certificates     ← README 上一节记录的
· Xcode Personal Team 发的是 Apple Development 凭证 ✓
  而 spctl -a -vvv -t exec 对它一样是 rejected ✗
```

**判官是 `spctl -a -t exec` ✗ 而它只接受 Apple 签发的 `Developer ID Application` ✓
—— Developer ID 只在付费会员的 portal 里 ✓ 所以绕不过入会 ✓**

```
① 入会（付费年费）
     https://developer.apple.com/programs/ → 右上 Enroll
     ★ 官方定价 99 USD／会员年，各区域以当地货币在入会流程中显示
       （原文：99 USD per membership year. Prices may vary by region and
        are listed in local currency during the enrollment process.）
     ★ 走网页，不一定要用 Apple Developer app（见下）
② Certificates, Identifiers & Profiles → Certificates → ＋
③ 选 Developer ID Application          ← ★ 不是 Apple Development
④ 它会要一个 CSR：
     Keychain Access → 凭证辅助程式 →
     从凭证授权要求凭证…  → 存到磁碟
⑤ 上传 .certSigningRequest，下载 .cer，双击汇入
⑥ security find-identity -v -p codesigning
     ← 应该看到 "Developer ID Application: … (TEAMID)"
     ★ 抄下括号里的 TEAMID，公证要用
⑦ 签章 ＋ 公证：bash macos/notarize.sh
     ← 一条命令走完，不要再手工 codesign
⑧ spctl -a -vvv -t exec PingZhu.app       ← 应该变成 accepted
```

**★ 为什么不能停在 ⑦ 的「签完就好」：** 表格里那一列「Apple 签发 ＋ 公证 ＋
呼叫 API」是**唯一还没测过的组合** ✗ —— 已知的三列（ad-hoc、自签、自签＋注册
API）全都不出现 ✓。所以公证那一步不是可选的收尾，**它是那个还没被验证过的
变量本身** ✓。

**然后 `install.sh` 会自己把这一步检查出来** ✓ ——**它现在会印 `REJECTED`
和这段修法** ✓（**★ 它印的内容跟着本节走 ✓ 所以这节写错，它就会把人指错 ✗**）

### ★ 入会不一定要用 Apple Developer app

iOS 上一个时刻只能有一个 App Store 帐号 ✗ —— 如果那个 app 当初是用另一个
Apple ID 装的 ✓，**更新它会要求登入那个旧帐号** ✗，而你要入会的可能是另一个 ✓。
两条途径是分开的：

| 途径 | 说明 |
|---|---|
| **网页** | https://developer.apple.com/programs/ → Enroll —— 主途径 ✓ 不碰 app 更新 |
| iOS app | Apple Developer app —— 会要求 app 所属的那个 Apple ID |

**★ 入会用哪个 Apple ID，决定证书与 Team ID 归属谁 ✗ 事后换帐号很痛苦 ✓
—— 先想清楚再用哪个登入 ✓**

## 已知限制

- **没有在真机上打过字** ✗——编译、bundle 结构、路由规则都验证过 ✓，
  但「装上之后打字正常」还没有 ✓
- **没有程式码签章与公证** ✗——第一次打开会有 Gatekeeper 警告 ✓。
  发行版需要 Developer ID ✓（见 [docs/03](../docs/03-platform-matrix.md)）
- 没有上架 Mac App Store ✗（输入法无法沙箱化 ✗）
- 尚未实作：符号表、联想词、快捷输入
