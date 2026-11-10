# v0.10.12 — 手机上真的能用短语了

## 一句话

v0.10.10 说修好了 Android 的快捷输入。**它只修了一半** —— APK 里有了短语表，但没有人把它
解到引擎实际读的那个目录。这一版补上中间那一环，并在模拟器上验了。

## 一、上一版修了什么、漏了什么

v0.10.10 做了两件事：

1. 让 APK 带上 `assets/shortcuts.tsv` ✓
2. 让引擎找 `data_dir/shortcuts.tsv` ✓

**中间少了一环** ✗：`PingZhuImeService.ensureData()` 只解 `bopomofo-lm.tsv` 与
`ts-conversion.tsv` 两个模型档，短语表从来没被复制到 `filesDir/data/`。

于是 0.10.10 与 0.10.11 在手机上都是「看起来修好了、功能依然是死的」：APK 里明明有那份档，
引擎却读不到。打短语什么也不会发生。

## 二、改法

抽一个 `extractIfMissing(target, name)`，三个档都走它。**策略有意不同**：

| 档 | 策略 |
|---|---|
| `bopomofo-lm.tsv`、`ts-conversion.tsv` | 缺了就补 |
| `shortcuts.tsv` | **只在缺失时解、绝不覆盖** —— 它是给使用者改的 |
| APK 里没有 `shortcuts.tsv` | 不算错，那是一个「没有短语」的正常安装 |

第三条很重要：一个裁剪过的包（比如去掉短语表减体积）不该让输入法起不来。

## 三、模拟器实测

release 包不可调试（`run-as` 用不了），所以用 debug 包验同一段代码：

```
$ adb shell run-as tw.pingzhu.ime ls -l files/data/
-rw-------  bopomofo-lm.tsv   6443958
-rw-------  shortcuts.tsv         707   ← 这一行是这次修好的
-rw-------  ts-conversion.tsv   34552
```

**这一步非做不可。** 编译过、单测过、CI 绿 —— 功能仍然是死的。解档这类错只有真跑才看得见。

## 四、验证到哪

| 平台 | 验证 |
|---|---|
| Android | **模拟器实测**：三个档都落在 `filesDir/data/`；CI 绿 |
| 其余五个前端 | 本版未改动；CI 按路径未触发 |
| macOS / HarmonyOS 真机 | 仍未验证 |

## 五、下载

- Windows：`pingzhu-0.10.12-setup.exe` 或 `pingzhu-0.10.12-win-x64.zip`
- Android：`pingzhu-0.10.12-android.apk`（`versionCode` 14）—— **这一版它才是真的能用**
- Linux：`fcitx5-pingzhu_0.10.12_amd64.deb` 或 `fcitx5-pingzhu-0.10.12-1.x86_64.rpm`
- HarmonyOS：`pingzhu-0.10.12-harmonyos-project.zip`
- 引擎：`pingzhu-engine-0.10.12.tgz`

**Windows 升级**：TSF DLL 档名**不变**（`pingzhu-tsf-0.10.11.dll`）—— 本版没动
`windows/src` 或 `windows/tsf`，DLL 的字节没有变化。
