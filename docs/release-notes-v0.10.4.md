# v0.10.4 — 每个外壳都修好一个「够不到」的功能

## 一句话

五个平台里有四个，各有一个功能**存在但到不了**：Android 的候选列从没显示过、
HarmonyOS 的 ⌫ 会把整个组字丢掉、Linux 翻不到第二页候选、Windows 的候选视窗
切掉了最下面一行。这一版把它们都修好，并给 `windows/` 与 `android/` 补上了 CI ——
在那之前，这两个外壳一次都没有在 CI 里建过。

## 四个「够不到」

### Android：候选列从来没有显示过，候选单也打不开

候选列（`CandidateBar`）建好了、点选回调也接了，但**全仓没有一处调用
`setCandidatesViewShown(true)`**，而 Android 的 candidates view 预设是隐藏的；就算叫了
也没用 —— 视窗被钉成整屏，框架那块容器拿不到位置（实测 `isShown=false`、
`vis=VISIBLE`、1080x551：量得好好的，就是不上屏）。

修法是让候选列成为**输入视图自己的一部分**（候选列在上、键盘在下、整体贴底），
不经过框架那块容器。同时 `hasCandidates` 原本算成 `windowOpen && …`，而路由开单的规则
正是 `!windowOpen && hasCandidates` —— 那一格永远走不到，空白每次都把句子送出。

底排另加了 **▼** 浏览键：手机键盘没有 ↓，所以翻页本来无处可去。

### HarmonyOS：⌫ 丢掉整个组字，又删掉编辑区一个字

一次按键做两件错事：`pingzhu.reset()`（丢掉整份组字）＋ `Session.deleteBackward()`
（删掉已经送进编辑器的一个字）。根因是 **napi 从来没导出 `backspace()`** ——
当初只能拿 `reset` 顶上。

### Linux：翻不到第二页，而且高亮是装饰性的

空白键先开单再看状态，于是「已经开着」和「刚开好」长得一模一样，第二次按只刷新、
既不送出也不翻页；`Engine::nextPage()` 没有任何呼叫点；↑↓ 移动的那个高亮
**没有任何键会采用** —— 把第三个候选照亮，按空白送出的还是第一个。

按键规则搬进了 `src/router.cpp`（不含任何 fcitx5 标头），从此和 Windows／macOS／Android
一起被 `tools/routing-vectors.tsv` 钉住。候选列每页也从 9 改成 10 —— 原本每页第十个
候选被挤到 fcitx5 自己开的第二页上，而选它的数字键（`0`）不在画面上。

### Windows：候选视窗矮一行

视窗画四行（组字、候选、→ 预览、页码），高度却只算到第三行 —— 多页时候选单最下面
那条状态列被切掉下半截。行距现在只有一份（`candidate_window.h` 的 `layout::`），
高度由「最后一行画在哪」推出来。

## 也给这个仓库自己补了两处

- **`windows/` 与 `android/` 的 CI**：四个旧 workflow 都按目录过滤，这两个外壳的改动
  因此不触发任何东西 —— 它们的 bug 只在开发者自己的机器上被发现。现在 Windows 会建
  外壳与文字服务并跑四组测试，Android 会交叉编译两个 ABI、跑 JVM 测试并产出 APK。
- **发版检查单进仓库**（`docs/RELEASING.md`）：流程原本只写在本机的交接档里，
  于是「TSF DLL 档名什么时候该改」这条规则漏过一次。

## 升级注意

- **Windows 的文字服务 DLL 换了档名**：`pingzhu-tsf-0.10.2.dll` → `pingzhu-tsf-0.10.4.dll`。
  这是故意的：Windows 会锁住已载入的 DLL，换名才升得动。安装包会自动登记新的那个。
- **Linux addon 的版本号**：`fcitx5-diagnose` 以前一直显示 `0.9.0` —— `linux/fcitx5/pingzhu.conf`
  的 `Version=` 从 0.9.0 起就没动过（改 `CMakeLists.txt` 的 `project(... VERSION)` 没有用，
  那是死值）。现在跟着发版号走。

## 验证

| 平台 | 怎么验的 |
|---|---|
| Windows | 候选视窗几何由 `pingzhu-candidate-test.exe` 真开窗、读回矩形核对；路由对共享向量 27 条 |
| Android | 模拟器实测：候选列显示 `1 你 2 妳 3 擬…`、空白开单、`2` 选字送出、▼ 翻页；JVM 18 项 |
| HarmonyOS | 引擎语义由 TS 参考实现生成的 225 条场景钉住；外壳只到**编译验证**（本机没有装置） |
| Linux | `ctest` 两项：引擎冒烟与路由对共享向量；编译零警告 |
| macOS | 未变；CI 仍在真的 macOS runner 上建置与安装验证 |

**没验的**：Android 的实机行为（只在模拟器上）、HarmonyOS 的真机按键行为 ——
这两项在各自的 README 里都写着。
