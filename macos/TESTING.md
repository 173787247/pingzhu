# 在一台真的 Mac 上测试

CI 能验证的已经全部验证过了（[README](README.md) 里有清单和那条边界）。
**剩下这一步只能由人来做**，而这份清单的目的是让它花十分钟，而不是一小时。

## 0. 一行装好（推荐）

在这台 Mac 上打开「终端」，贴这一行：

```bash
curl -fsSL https://raw.githubusercontent.com/173787247/pingzhu/main/macos/install.sh | bash
```

它会下载、检查签章、装进 `~/Library/Input Methods/`，
**然后问系统看不看得到它**——那正是 CI 问不出来的那件事。

跑完它会把还需要手动做的三件事印在最后。

---

## 1. 或者手动拿 `.app`

**浏览器**（最简单）：打开下面这个网址，页面最下方下载 `PingZhu.app`

```
https://github.com/173787247/pingzhu/actions/runs/36299727585
```

**或者在这台 Mac 上**：

```bash
gh run download 36299727585 --repo 173787247/pingzhu --name PingZhu.app --dir ~/Downloads
```

## 2. 装进去

```bash
cp -R ~/Downloads/PingZhu.app ~/Library/Input\ Methods/
```

**然后登出再登入。** 这一步不能省 ✗ ——CI 上试过四件事都无法让系统在
同一个 session 里看到它 ✗，而**原因不明** ✓（见 README 里那段诚实的说明 ✗）。

对**人**来说这只是一次登出登入 ✓，所以照做就好 ✓。

## 3. 加进输入方式

```
系統設定 → 鍵盤 → 輸入方式 → 編輯… → ＋ → 繁體中文 → 平注
```

## 4. 打四个字

在任何一个能打字的地方（TextEdit 就行）：

```
su3cl3      按空白      → 你應該看到「你好」
ji394su3    按空白      → 我愛你
w96j0       按空白      → 台灣
```

**组字过程中**应该看到候选视窗，里面有：

```
[su3cl3]
你好
1 你好   2 妳好   3 你   4 妳   5 擬
```

## 5. 四项检查

| # | 看什么 | 预期 |
|---|---|---|
| 1 | 打字 | `su3cl3` → 你好 |
| 2 | 候选视窗 | 出现在光标附近，不是萤幕角落 |
| 3 | 繁简切换 | 右上角输入法图示 →「平注」→ 简体输出 → 再打 `w96j0` → 台湾 |
| 4 | 没有当掉 | 切换 App、切换输入法之后还能继续打 |

## 6. 回报什么

**成功的部分直接说「第几项过了」就好。**

**失败的话，这份记录最有用**：

```bash
# 输入法有没有在跑
pgrep -fl PingZhu

# 系统日志里我们的讯息（引擎载入失败会写在这里）
log show --last 5m --predicate 'process == "PingZhu"' --style compact

# 输入源有没有被登记
# （这会印出所有非 Apple 的输入源）
swift -e 'import Carbon; let s = TISCreateInputSourceList(nil,true)?.takeRetainedValue() as? [TISInputSource] ?? []; for x in s { if let r = TISGetInputSourceProperty(x, kTISPropertyBundleID) { let b = Unmanaged<CFString>.fromOpaque(r).takeUnretainedValue() as String; if !b.hasPrefix("com.apple.") { print(b) } } }'
```

## 已知会看到的东西

| 现象 | 为什么 | 要不要紧 |
|---|---|---|
| 第一次打开警告「未识别的开发者」 | 没有 Developer ID 签章与公证 | 不要紧，右键 → 打开 |
| 安装后要登出才看得到 | macOS 只在登入时扫描 | 不要紧，预期行为 |
| 找不到图示 | 目前没有宣告图示键 | 不要紧，看得见名字 |

## 回报之后我会做的

- **全部通过** → 把 macOS 从 ⚠️ 改成 ✅，放进 release
- **部分通过** → 照着你贴的日志修
- **完全不行** → 大概率是 IMK 那一层，那需要重看 `PingZhuInputController`
  跟 `main.swift` 的接线（CI 测不到那一段）
