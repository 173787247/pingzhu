# 在一台真的 Mac 上测试

CI 能验证的已经全部验证过了（[README](README.md) 有清单和那条边界）。
**剩下这一步只能由人来做。**

---

## 装

```bash
curl -fsSL https://raw.githubusercontent.com/173787247/pingzhu/main/macos/install.sh | bash
```

然后 **登出再登入**，再到 `系統設定 → 鍵盤 → 輸入方式 → 加入「平注」`。

手动安装的正确步骤见 [README](README.md#安装)——**那份文件曾经漏了
`xattr -dr com.apple.quarantine` ✗，也曾经教人从 CI artifact 下载** ✗
（artifact 会过期 ✓ 而且档名改过 ✓）。两处都已修正 ✓

---

## 这一段原本是一份「明天到公司」的清单

**它写着「从 actions/runs/36299727585 下载」** ✗ ——**而那个 run 的
artifact 叫 `PingZhu.app`** ✓ ——**现在的 CI 上传的叫
`PingZhu-0.9.0-macos.zip`** ✗ ——**照着旧的指令打会失败** ✓

**一份指向「某一次 CI run」的文件，从写下的那一刻就开始过期** ✗
——**而且它不会报错 ✓ 只会让人照着做然后卡住** ✓

要下载就从 [Releases](https://github.com/173787247/pingzhu/releases) 下 ✓

---

## 出问题时收集什么

```bash
# ① 系统到底看不看得到它
curl -fsSL https://raw.githubusercontent.com/173787247/pingzhu/main/macos/probe.sh | bash

# ② 直接跑那个执行档 —— 这一步最有用，而且一直没人做过
~/Library/Input\ Methods/PingZhu.app/Contents/MacOS/PingZhu
#   印出 "could not start the IMK server" → IMK 连不上
#   什么都不印、一直挂着              → server 起来了，问题在注册
#   崩                              → 崩在哪就是哪

# ③ 隔离标记还在吗
xattr -l ~/Library/Input\ Methods/PingZhu.app
#   什么都不印 = 没有 ✓
#   印 com.apple.quarantine = ★ 就是它

# ④ 系统日志
log show --last 5m --style compact 2>/dev/null \
  | grep -iE "pingzhu|IMKServer|TextInputSource" | tail -30

# ⑤ 跟这台机器上**正在运作**的输入法逐项比
plutil -p "/Library/Input Methods/GOING13.app/Contents/Info.plist" 2>/dev/null
```

**②和③是这份文件之前没有的** ✗ ——**而它们是最直接的两个问题** ✓：
**执行档到底起不起得来** ✓ **隔离标记在不在** ✓

---

## 已经排除的

六条，每一条都做过：

| 假设 | 结果 |
|---|---|
| `tsInputModeScriptKey` 的值 | ✗ 排除（`smTradChinese` 和 `smUnicode` 都试过） |
| `ComponentInputModeDict` 的位置与存在 | ✗ 排除（删掉也一样） |
| `/Library` vs `~/Library` | ✗ 排除（两边都试过） |
| 执行档崩溃 | ✗ 排除（跑得起来） |
| LaunchServices 缓存 | ✗ 排除（四种强制重扫都试过） |
| 别的输入法占了坑 | ✗ **排除（2026-09-27：把自然输入法完全移除后，318 个输入源、零个第三方，仍然不列）** |
| **登出再登入** | ⏳ **还没做** ← 唯一剩下的 |
