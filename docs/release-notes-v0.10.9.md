# v0.10.9 — 快捷输入（自订短语）

## 一句话

打一次地址的注音，整条地址就出来了。短语表是纯文本，自己编，不参与学习。

## 一、短语就是「排在最前面的词」

路线图 M8 的最后一项。设计（`docs/10-shortcuts-design.md`）选了成本最低那条路：**短语不是
第二种东西，就是同一份词表里分数更高的一些词条**。

引擎本来就拒绝空词、按分数倒序排候选 —— 所以实作几乎全部落在「多读一份档」这件事上：

- `data/shortcuts.tsv`：`读音<TAB>词<TAB>分数`，格式与语言模型完全相同
- 分数用 **9**，语言模型的分数是 log10 机率（全是负数），所以短语永远排第一
- **没有新 ABI、没有新 UI**：外壳一个接口都不用改

## 二、用起来是什么样

`data/shortcuts.tsv` 出厂带三条示例：

```
ㄉㄧˋ-ㄓˇ	台北市忠孝東路四段 100 號 5 樓	9
ㄒㄧㄣˋ-ㄒㄧㄤ	service@example.com	9
ㄊㄨㄥˇ-ㄅㄧㄢ	12345678	9
```

打 `ㄉㄧˋ-ㄓˇ`（大千式按键是 `2u453`），候选列第一条就是整条地址，语言模型原来的
「地址」排在它后面：

| | |
|---|---|
| 没有短语表 | 地址 |
| 有短语表 | **台北市忠孝東路四段 100 號 5 樓** / 地址 / … |

换成你自己常用的，存盘、重新启动输入法即生效。**短语不参与学习**：选字不会改这份档，
这份档也不会被使用者词典覆盖 —— 与 RIME `custom_phrase` 的 `stabledb` 是同一个意思。

## 三、五个平台的打包都带上了

短语表在引擎里能用了，但装上去的人看不到这份档就白搭。三处**显式清单**各补一行：

- `windows/package.sh`
- `android/app/build.gradle.kts`
- `harmonyos/.../InputMethodExtensionAbility.ets` 的 `MODEL_FILES`

HarmonyOS 那边还修了一处：清单里的档在 rawfile 里缺席时 `getRawFileContentSync` 会抛错，
而注释写着它「可选」—— 现在读不到就跳过，与注释一致。

deb 与 rpm 不需要改：它们的 `CMakeLists.txt` 是整个 `data/` 目录装进去的。

## 四、TSF 档名的判据说准了

`docs/RELEASING.md` 第二节原来是「`windows/` 有改动就换 TSF 档名」。这一版改的恰恰是
`windows/package.sh` —— 它不参与编译 DLL，DLL 一个字节没变，按字面规则却要换名，
让使用者多下一次档案而没有新东西。

规则改成**「编译进 DLL 的源文件」（`windows/src`、`windows/tsf`）**，理由与判据现在一致。
本版 DLL 未变，档名维持 `pingzhu-tsf-0.10.6.dll`。

## 五、验证到哪

| 平台 | 验证 |
|---|---|
| TS 引擎 | 72 项测试全过（含 4 条短语测试）|
| Rust 核心 | 32 单元 + 6 个测试档全过（含 2 条短语测试、1,532 行差分、225 条场景）|
| 网页试打版 | 本地服务器 + headless 实测：`2u453` → 整条地址；线上那份 `shortcuts.tsv` 也已确认可下载 |
| 五个外壳 | CI 全绿；打包清单已带上短语表 |
| macOS / HarmonyOS 真机 | **仍未验证**（需要 Apple Developer ID 与真机）|

## 六、下载

- Windows：`pingzhu-0.10.9-setup.exe` 或 `pingzhu-0.10.9-win-x64.zip`
- Android：`pingzhu-0.10.9-android.apk`（`versionCode` 11）
- Linux：`fcitx5-pingzhu_0.10.9_amd64.deb` 或 `fcitx5-pingzhu-0.10.9-1.x86_64.rpm`
- HarmonyOS：`pingzhu-0.10.9-harmonyos-project.zip`
- 引擎：`pingzhu-engine-0.10.9.tgz`

macOS 仍然没有产物：入会仍在等 Apple Developer ID。

**Windows 升级**：TSF DLL 档名不变（`pingzhu-tsf-0.10.6.dll`），直接覆盖安装即可。
