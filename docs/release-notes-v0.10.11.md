# v0.10.11 — 加一个布局，三个平台的选单都不会再漏

## 一句话

七种布局的名字原本在引擎里有一份，在三个外壳里又各抄一份。现在只有一份 —— 外壳问引擎。

## 一、为什么要动这个

这不是抽象洁癖。抄一份的后果是：**加一个布局，某个选单就静默少了它**；或者菜单列出一个
引擎不认的名字，点下去引擎回退到标准布局，使用者以为没反应。

这个仓库在 11-07 刚吃过同一种亏：快捷输入的短语表在五个前端能用，**唯独 Android 静默
失效** —— 因为它有自己的一份 Rust 入口，没跟着改。

## 二、改了什么

| 位置 | 改法 |
|---|---|
| 引擎 | `Layout::ALL` 是唯一写下这个集合的地方；`engine_layout_rows()` 用 `id:label` 每行一条把它交出去 |
| **Windows** | `isKnownLayout` 收下一份清单，不再自带白名单；`loadConfig` 也收清单 |
| **Android** | `nativeLayoutRows()` → `Engine.layoutRows()`，设置页的选单由它生成 |
| **HarmonyOS** | napi 加 `layoutRows`，长按选单由它生成 |

`R.string` 里的本地化标签保留（Android），引擎自己的繁體标签作为兜底 —— 有翻译就用翻译，
没有就用引擎的。

**一个顺带的好处**：`loadConfig` 不再自己去开 DLL，config 测试因此不必链接引擎，测试更干净。

## 三、Windows 升级要注意：TSF DLL 换档名了

这一版改了 `windows/src/` 与 `windows/tsf/` 里的源文件，**DLL 的字节变了**。按
`docs/RELEASING.md` 第二节的判据，档名从 `pingzhu-tsf-0.10.6.dll` 换成
**`pingzhu-tsf-0.10.11.dll`**。

换名是为了让新内容能覆写被锁住的旧档 —— Windows 会锁住已载入的 DLL 整个行程的生命周期。
**直接覆盖安装即可**，安装程式会带上新档名的那一份。

（上一版 v0.10.10 没有换名，因为它只改了两个 Markdown 档，DLL 一个字节没变。）

## 四、验证到哪

| 平台 | 验证 |
|---|---|
| Windows | 编译通过 + 全部测试通过（config / router / candidate-window / 27 条共享向量）|
| Android | `BUILD SUCCESSFUL`（Kotlin 与 Rust 都编过）|
| Rust 核心 | 32 项 + 各测试档（含布局清单与 `from_id` 一致那条）|
| HarmonyOS | CI 编译通过（本机没有 DevEco，**没有真机验证**）|
| macOS | CI 编译（这一版它的 runner 在 GitHub 侧被取消过两次，与代码无关）|

## 五、下载

- Windows：`pingzhu-0.10.11-setup.exe` 或 `pingzhu-0.10.11-win-x64.zip`
- Android：`pingzhu-0.10.11-android.apk`（`versionCode` 13）
- Linux：`fcitx5-pingzhu_0.10.11_amd64.deb` 或 `fcitx5-pingzhu-0.10.11-1.x86_64.rpm`
- HarmonyOS：`pingzhu-0.10.11-harmonyos-project.zip`
- 引擎：`pingzhu-engine-0.10.11.tgz`
