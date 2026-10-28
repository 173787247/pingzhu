# v0.10.6 — 七种键盘布局，六个前端都接得上

## 一句话

引擎从两种键盘布局扩到**七种**（新增大千式以外的许氏、倚天 26 键、IBM、精业、神通），
并且**每一个前端都能选**：Windows 与 Linux 读设定档、macOS 用菜单、Android 用设置页、
HarmonyOS 长按「繁/简」、网页试打版用选单。

## 一、七种布局，表不是手抄的

路线图 M8 的第 4 项原本写着「许氏、倚天 26 键未支援，这两种排列需要**有状态**的编辑器」——
**这个判断是错的**。多成分键（许氏的 `l` 同时是 ㄌ/ㄥ/ㄦ）不需要状态机：分词搜索本来就会
把每个键展开成所有成分组合，再交给库存与语法检查。

表格来自参考实作（McBopomofo，MIT），用生成器读出来，而不是凭记忆敲：

```bash
node research/tools/import-mcbopomofo-layouts.mjs --ts     # 吐 TypeScript
node research/tools/import-mcbopomofo-layouts.mjs --rust   # 吐 Rust
```

手抄一张 25 键的布局只会在一个格子上错，而且不会出声。生成器的输出再由
`core-rs/tests/fixture-layouts.tsv`（7 布局 56 条）把 TS 与 Rust 逐句对照。

文书里原来举的例子也不成立：它说许氏把 ㄑ 实作为 `v`(ㄔ) + ㄧ/ㄩ 的自动转换 ——
其实 ㄑ 就在 `v` 上，`vuj` 直接得到 ㄑㄩˋ → 去。

## 二、每个前端怎么选

| 前端 | 怎么选 | 改了何时生效 |
|---|---|---|
| Windows（可携 + 文字服务） | `pingzhu.ini` 的 `layout = hsu` | 重新执行／切换输入法 |
| Linux（fcitx5） | `~/.local/share/fcitx5/pingzhu/layout`（一个名字） | 重新启动 fcitx5 |
| macOS | 输入法菜单的「鍵盤布局」子菜单，七项打勾 | 立刻（重建引擎） |
| Android | 设置页「鍵盤布局」下拉 | 重新启用输入法 |
| HarmonyOS | **长按**「繁/简」键 | 立刻（重建引擎） |
| 网页试打版 | 键盘上方的选单 | 立刻 |

布局在**建立引擎时定下**（解码器围绕它构建），所以没有「切换」这回事，只有「用哪个名字建」。
Windows 会校验名字：清单外的值被忽略并留在 standard，而不是传给引擎让它静默退回 ——
否则拼错一个字母的结果只是「布局没生效」，没有任何线索。

## 三、顺带修掉的：键面是「另一份」布局

Android 与 HarmonyOS 画键面的地方各自写死了布局（JNI 里 `Layout::Standard`、ArkTS 里
`keyboardRows('standard')`）。于是选了许氏之后，**引擎按许氏解码、画出来的还是大千** ——
每一个键显示的都不是它实际的意思。

这是同一个形状的错误第三次出现（第一次是网页试打版那张手写的标准表）。现在布局名从设定
一路传到画键面的地方，键面与解码器用同一份表。

## 四、其他

- **HarmonyOS 打不出任何拉丁字母** —— 网址、邮箱、密码在真机上无处可打。现在功能列上的
  「英／中」切到 QWERTY 键面，英文直接送进编辑器
- **HarmonyOS 组字时显示整句**，引擎没把握时变淡、倾斜（`bestSentence()` 从第一天就在
  napi 表里，而 ArkTS 里没有一行调用它）
- **Linux 的繁简热键** `Ctrl+Alt+S`，与 Windows 一致
- **网页试打版记得住教过的字**（存在这个浏览器里），并说出「这句是猜的」
- 两个 Android 诊断修复：一行一直印「0 keys」的报告（它读的字段在视窗建立前必为空），
  以及它数的到底是格子还是画出来的键

## 五、验证到哪

| 平台 | 验证 |
|---|---|
| Windows | 本地构建 + 四项测试（含新的 12 项配置检查） |
| Linux | 构建 + `engine_smoke`／`userdict`／`script` 三项 |
| Android | 模拟器实测：设置页选许氏 → 键面变成许氏 → 按 `nefhwf` 得到「你好」 |
| 网页试打版 | headless 浏览器实测：选单切到许氏 → `nefhwf` → 你好 |
| macOS | **只到 CI 编译** —— 本机没有 Mac，也没有 swiftc |
| HarmonyOS | **只到 CI 编译** —— 本机没有 SDK，也没有真机 |

最后两行是诚实的边界：它们能编译、类型正确，但**没有在真机上打字验证过**。

## 六、下载

- Windows：`pingzhu-0.10.6-setup.exe` 或 `pingzhu-0.10.6-win-x64.zip`
- Android：`pingzhu-0.10.6-android.apk`（`versionCode` 8，可直接覆盖安装 0.10.5）
- Linux：`fcitx5-pingzhu_0.10.6_amd64.deb` 或 `fcitx5-pingzhu-0.10.6-1.x86_64.rpm`
- HarmonyOS：`pingzhu-0.10.6-harmonyos-project.zip`（在 DevEco 打开、签名、Run）
- 引擎：`pingzhu-engine-0.10.6.tgz`

macOS 这一版仍然**没有产物**：输入法要向系统登记，签章必须是 Apple 签发的 Developer ID，
而入会仍在等。

**Windows 升级注意**：这一版 TSF DLL 换了新档名（`pingzhu-tsf-0.10.6.dll`）。Windows 会
锁住已载入的 DLL 整个行程生命周期，换档名等于换一个新档案 —— 这是升级能成功覆盖的原因。
