# 发版检查单

**这份文件要在仓库里。** 发版流程原本只写在本机的 `docs/HANDOFF-*-发版.md` 里，而那个档
是 gitignore 的 —— 于是「什么时候该改 TSF DLL 的档名」这条规则在 v0.10.3 漏了一次：
档名不动本身是对的（`windows/` 从 v0.10.2 起零改动），但规则写在只有一个人会读到的地方，
下一个人就只能靠记忆。这份文件是那条规则的落脚处。

## 一、版本号出现在这些地方

| 文件 | 字段 |
|---|---|
| `README.md`、`README.zh-CN.md` | 下载连结、平台表里的版本 |
| `engine/package.json`、`engine/README.md` | `version`、tarball 连结 |
| `android/app/build.gradle.kts` | `versionName` 与 `versionCode` |
| `harmonyos/` 四处：`AppScope/app.json5`、`entry/oh-package.json5`、`keyboard/oh-package.json5`、`cpp/types/libpingzhu/oh-package.json5` | `versionName` / `version` |
| `windows/build.bat`、`windows/tsf/tests/test_com.cpp` | TSF DLL 档名 —— **见第二节** |
| `fcitx5-pingzhu.spec`、`debian/changelog` | `Version:` |
| `docs/release-notes-vX.Y.Z.md` | 新增一份 |

一次核完的办法是照上一版：

```bash
git show <上一个发版提交> --stat
```

## 二、TSF DLL 的档名：按需变更，不是每次发布都动

`pingzhu-tsf-<版本>.dll` 里的版本号不是为了好看：Windows 会锁住已载入的 DLL 整个行程的
生命周期，而输入法会被载入到记事本、Explorer、微信……升级时根本无法覆写那个档案
（会得到一句裸的 `Permission denied`）。**换一个新档名，等于换一个新档案。**

所以规则是：

> **只有 `windows/` 自上一個 tag 起有改动时，才改这个档名。**

因为 TSF DLL 会编译 `src/candidate_window.cpp`、`src/router.cpp`、`src/engine_api.cpp`
等 —— 那些一改，DLL 的内容就变了，旧档名就变成了「同一个名字、不同内容」，正是要避开的
那个情况。

怎么查：

```bash
git log --oneline <上一個 tag>..HEAD -- windows/
```

有输出就改，没有就不动（v0.8.0 与 v0.9.1 两个 tag 之间就一直是
`pingzhu-tsf-0.7.6.dll`）。**两处要一起改**，否则 COM 契约测试会找不到 DLL：

- `windows/build.bat` 的 `set TSFDLL=`
- `windows/tsf/tests/test_com.cpp` 里的默认档名

## 三、产物怎么建

| 产物 | 建法 |
|---|---|
| Windows zip ＋ `setup.exe` | `bash windows/package.sh <版本>` |
| Android APK | `bash android/build-rust.sh --release` 然后 `./gradlew assembleRelease` |
| HarmonyOS 专案 zip | **只能来自 CI**（`harmonyos.yml` 的 artifact）：本机没有 OHOS NDK，那条交叉编译跑不了 |
| 引擎 tarball | `cd engine && bash publish.sh` |
| Linux `.deb` / `.rpm` | 仓库根的 `debian/` 与 `fcitx5-pingzhu.spec` |

两件容易踩的：

- **Android 要 `assembleRelease`，不是 `assembleDebug`** —— 已发布 APK 的凭证是本专案
  自己的（`CN=PingZhu, OU=PingZhu, O=PingZhu, L=Shanghai, C=CN`），不是 Android debug key。
  它需要 `android/keystore.properties` 与 keystore，两者都**不在仓库里** ✗ —— 没有的人
  只能出 debug 版。
- **建 Linux 套件要用 rustup 那套 `rustc`** ✗：发行版 apt 装的常常是 1.75，而 `core-rs`
  要 ≥ 1.77；`dpkg-checkbuilddeps` 只看得到 apt 那套，于是会误判依赖不满足。先把
  `$HOME/.cargo/bin` 放到 `PATH` 前面。

## 四、发版前核对三条（都实际做过，写下来免得每次重想）

```bash
# 1) Linux 套件是不是装到 fcitx5 真的会找的地方
dpkg-deb -c fcitx5-pingzhu_<版本>_amd64.deb | grep -E "fcitx5/(libpingzhu.so|addon|inputmethod)|/usr/share/pingzhu"
rpm -qpl   fcitx5-pingzhu-<版本>-1.x86_64.rpm

# 2) Android 的凭证是专案自己的，不是 debug key
apksigner verify --print-certs pingzhu-<版本>-android.apk

# 3) Windows 套件里的 TSF 档名与第二节的判断一致
unzip -l pingzhu-<版本>-win-x64.zip | grep tsf
```

「装到程序不会找的地方」是这个专案反复出现的失败形状（`lib/fcitx5` vs
`${CMAKE_INSTALL_LIBDIR}/fcitx5`、`/usr/local` 不被扫描、HarmonyOS 的 extension 宣告错位置），
所以第一条不是形式。

## 五、不在这里做的事

**发布本身由使用者决定与执行**：建 tag、写 release notes、上传资产都是对外的动作 ✗。
这份文件只负责「怎么建、建完核对什么」。
