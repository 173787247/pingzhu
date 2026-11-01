# v0.10.7 — 手机上能打标点了，也看得见自己在打什么

## 一句话

六种前端都有了标点页 —— 大千式的每个键都是注音，`, ` 是 ㄝ，桌面上 `Shift+,` 能过去，
手机没有 Shift。另外 Android 上键盘弹起时不再把 app 整块盖住：打进去的字终于看得见。

## 一、打不出标点

大千式（以及所有注音布局）的每个键都是读音，`,` 是 ㄝ。桌面上这不是问题 —— 输入法
不认识的键会原样交给应用；**手机没有 Shift**，于是 Android 与 HarmonyOS 的用户此前
一个标点都打不出来，除非先切到英文盘。

现在六种前端都有一页全形标点（37 个）：

| 前端 | 怎么打开 |
|---|---|
| Windows / Linux / macOS | 不需要页 —— `Shift+,` 本来就能过 |
| Android | 功能列的「符」键 |
| HarmonyOS | 功能列的「符」键 |
| 网页试打版 | 键盘每行末尾的「符」键 |

**表只有一份**，在 `core-rs/src/symbols.rs`。Android 原来的 Kotlin 表、HarmonyOS 的
`，` 键、试打版的手抄表都换成了它 —— 这个项目反复吃亏的地方就是「同一个东西两处各有一份」
（键盘表复制过三次，画出来的键面复制过两次）。试打版没有 C ABI 可问（那是它存在的意义），
所以它有一份 TS 副本，由 `core-rs/tests/symbols.tsv` 对着，两份不能悄悄漂移。

## 二、Android：看不见自己打的字

输入视窗是整屏的（10-12 为解「视窗量到 0」把 `onMeasure` 钉成屏幕高度），但
`onComputeInsets` 没跟着改。框架按「输入视窗的顶端」算内容的起点，于是 **app 的窗口高度
被算成 0** —— app 什么都不画，连标题都没有；使用者只看得见候选列里的那一句。

判据很硬：截图里 app 区域（离键盘很远的顶部）**非白像素只有状态栏那几十行**。

修法是让内容从**候选列或键盘的上缘**开始（`getLocationOnScreen`），并给 `ImeTheme`
补上 `windowIsTranslucent` —— 只把 `windowBackground` 设成透明不够，不透明的视窗一样会
把底下的 app 抹掉。

## 三、单字打不出来之后的一连串

修标点的时候顺出一个反复出现的形状：**`feedKey` / `press` 的返回值被丢掉**，
于是布局里没有的字符**消失**。

| 前端 | 情形 |
|---|---|
| Android | 走路由，`Pass` 时 `commitText` —— 本来就对 |
| 网页试打版 | `engine.press` 返回 false 时已经 `preventDefault()` 了 → 吞掉（本版修） |
| HarmonyOS | `pingzhu.feedKey(letter)` 不看返回值（本版修，组字中先送出整句） |
| 桌面三壳 | 路由把非注音键原样交给应用 |

判据：凡是「喂一个字符给引擎」的地方，都要问一句「它拒绝了怎么办」。

## 四、网页试打版

- **手机上的版面**：41 个键按 46px 固定宽排在四行里，11 个键那一排 604px，比手机屏还宽
  （flex 的默认收缩把它压扁，所以看起来不是溢出，而是每个键都窄到读不清）。加了
  `@media (max-width: 560px)`，键改成按行均分。
- **构建脚本的模块清单**：原来是一张手写的 `MODULES`，每加一个引擎模块都要记得改它。
  `symbols.ts` 就漏了 —— 构建报成功，页面在浏览器里 404。现在清单是试打版自身 import
  的传递闭包：用到的会被复制，导入但不存在的会明确报错。

## 五、验证到哪

| 平台 | 验证 |
|---|---|
| Windows | 本地构建（`windows/` 自 v0.10.6 起零改动，TSF 档名不变） |
| Linux | `dpkg-buildpackage` / `rpmbuild`，装到 `fcitx5/` 会找的位置 |
| Android | 模拟器实测：键盘弹起时 app 可见、打 `nefhwf` 框里出现「你好」、符号页插三个标点 ✓ |
| 网页试打版 | headless 实测：点「符」→ 点 `，` → 文本框里出现 `，` ✓；手机上实机宽度验过 |
| macOS | **只到 CI 编译** |
| HarmonyOS | **只到 CI 编译** |

最后两行是诚实的边界：它们能编译，但没有在真机上打字验证过。HarmonyOS 的符号页尤其 ——
功能列上那一页是照 Android 的样子写的，长按、页面宽度、点下去的反馈都只有真机知道。

## 六、下载

- Windows：`pingzhu-0.10.7-setup.exe` 或 `pingzhu-0.10.7-win-x64.zip`
- Android：`pingzhu-0.10.7-android.apk`（`versionCode` 9，可直接覆盖安装 0.10.6）
- Linux：`fcitx5-pingzhu_0.10.7_amd64.deb` 或 `fcitx5-pingzhu-0.10.7-1.x86_64.rpm`
- HarmonyOS：`pingzhu-0.10.7-harmonyos-project.zip`（在 DevEco 打开、签名、Run）
- 引擎：`pingzhu-engine-0.10.7.tgz`

macOS 这一版仍然**没有产物**：输入法要向系统登记，签章必须是 Apple 签发的 Developer ID，
而入会仍在等。

**Windows 升级**：这一版 TSF DLL 的档名**不变**（`pingzhu-tsf-0.10.6.dll`）——
`windows/` 自上一起零改动，而换档名是为了让新内容能覆盖被锁住的旧档案；内容没变就不必换。
