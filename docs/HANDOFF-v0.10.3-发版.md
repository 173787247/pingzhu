# 交接：v0.10.3 发版（2026-10-08）

> **这份文件只讲「发版」这一条线。** 项目现状看 [`START-HERE.md`](../START-HERE.md)；
> macOS 签章与资料层是另外两条线，不在这里。

## 一句话状态

**已发布（2026-10-08）**：<https://github.com/173787247/pingzhu/releases/tag/v0.10.3>
tag `v0.10.3`（annotated，`c1f0d48`）→ commit `ac7bb947375e`。发布主题是
**Linux 新增 `.deb` 与 `.rpm` 两种安装方式**。

七件资产（括号内为字节数）：

```
pingzhu-0.10.3-setup.exe              (1,802,240)
pingzhu-0.10.3-win-x64.zip            (2,033,431)
pingzhu-0.10.3-android.apk            (3,324,318)
pingzhu-0.10.3-harmonyos-project.zip (10,374,285)
pingzhu-engine-0.10.3.tgz             (1,745,246)
fcitx5-pingzhu_0.10.3_amd64.deb       (1,975,608)
fcitx5-pingzhu-0.10.3-1.x86_64.rpm    (2,455,275)
```

★ **HarmonyOS 那件与 v0.10.2 有一处结构差异**：本版直接来自 CI 产物（`ac7bb94` 那一轮，
run 37655859100），因此**不含 `data/vendor/`** —— 那是 gitignore 的第三方来源
（8.4 MB，只有 `data/build*.mjs` 会用到，HarmonyOS 建置不碰）；v0.10.2 那件是本机
组装的所以含。CI 产物另带一个建置时生成的 `harmonyos/keyboard/oh-package-lock.json5`。
两件的档案清单其余部分一致。

## 这一版是什么

`v0.10.2`（`89fe135`）之后有 4 个提交，**全部是 Linux 打包**：

```
a616c05  build(linux): 加 debian/ 与 fcitx5-pingzhu.spec（顺带把 MSRV 修成 1.77）
33081c7  merge: linux packaging
2ab02ac  fix(rpm): 让 spec 建得完，路径跟着 rpm 宏（_smp_mflags、_libdir、_datadir）
86508b5  docs(linux): 写清 addon 怎么装
```

## 版本号改了哪些档案

| 档案 | 改成什么 |
|---|---|
| `README.md` · `README.zh-CN.md` | 下载连结 `0.10.2`→`0.10.3`；**Linux 那一行从「不发布二进制」改成指向 `.deb`/`.rpm`** |
| `android/app/build.gradle.kts` | `versionCode 4→5`、`versionName 0.10.3` |
| `engine/package.json` · `engine/package-lock.json` | 版本（lock 从 `0.8.0` 一次对齐，两处） |
| `engine/README.md` | tarball 连结 `v0.8.0/pingzhu-engine-0.8.0.tgz`→`v0.10.3/…-0.10.3.tgz` |
| `harmonyos/` 四处 | `versionName` / `version` |
| `fcitx5-pingzhu.spec` | `Version: 0.10.3` |
| `debian/changelog` | 新增 0.10.3 段落 |
| `docs/release-notes-v0.10.3.md` | 新增（发布说明） |

### 两处**刻意不动**

1. **`windows/build.bat` 与 `windows/tsf/tests/test_com.cpp` 的 `pingzhu-tsf-0.10.2.dll`**
   —— 那个档名是**按需变更**（避开 Windows 的载入锁定），不是每次发布都动。
   依据：`git show b55342e` 的提交信息原话；且 `v0.8.0`/`v0.9.1` 两个 tag 里的
   `build.bat` 都还是 `pingzhu-tsf-0.7.6.dll`。本轮 `git log v0.10.2..HEAD -- windows/` 为空。
2. **macOS 那条连结**（`v0.9.0` 产物 / `v0.8.0` tag）—— 本版仍无 macOS 产物。

## 产物怎么建（★ 已逐条核实，不是推定）

| 产物 | 指令 | 核实到的凭据 |
|---|---|---|
| Windows zip + setup.exe | `bash windows/package.sh 0.10.3` | `build.bat` 自己 `cd /d "%~dp0"`，再调它写死路径的 `vcvars64.bat`（该档在本机存在）——所以在外层 `where cl` 找不到 `cl` 是正常的，不是缺工具链 |
| Android APK | `bash android/build-rust.sh --release` ＋ `~/Android/gradle/gradle-8.9/bin/gradle assembleRelease` | ★ **是 `assembleRelease`，不是 `assembleDebug`**：已发布 APK 的凭证是 `CN=PingZhu, OU=PingZhu, O=PingZhu, L=Shanghai, C=CN`（`apksigner verify --print-certs`），不是 Android debug key；`android/app/build/outputs/apk/release/app-release.apk` 与已发布产物的 sha256 一致 |
| HarmonyOS zip | **只能来自 CI**：`gh workflow run harmonyos.yml` → 下载 artifact（CI 给的是 `.tar.gz`）→ 解开来重新 `zip` | zip 里的 `core-rs/target/aarch64-unknown-linux-ohos/release/libpingzhu_core.a` 需要 OHOS NDK，本机没有；已发布 zip 的 91 个条目与 CI「Package the project」那一步造的树完全对应 |
| 引擎 tarball | `cd engine && bash publish.sh --dry-run` → `cp 173787247-pingzhu-engine-0.10.3.tgz ../dist/pingzhu-engine-0.10.3.tgz` | `dist/` 里 0.10.2 的 tgz 与 release 页上的 sha256 一致 |
| `.deb` | `dpkg-buildpackage -b -us -uc -d`（仓库根） | debhelper 13.14.1 与 Fcitx5Core 5.1.7 都在，产物落在上一层。**要 `-d`**：本机 `rustc` 来自 rustup（1.99，在 `~/.cargo/bin`），而 apt 的 `rustc` 是 1.75，`dpkg-checkbuilddeps` 只看得到后者，于是判定 `rustc (>= 1.77)` 不满足 |
| `.rpm` | `export PATH="$HOME/.cargo/bin:$PATH"` ＋ `git archive --prefix=fcitx5-pingzhu-0.10.3/ -o ~/rpmbuild/SOURCES/fcitx5-pingzhu-0.10.3.tar.gz HEAD` ＋ `rpmbuild -bb --nodeps fcitx5-pingzhu.spec` | spec 的 `Source0`/`%autosetup` 要求那份 tarball；Ubuntu 上 rpmbuild 认不得 apt 的套件名，所以 `--nodeps`。**PATH 那一句不能省**：干净 shell 里的 `cargo` 是 apt 的 1.75，rpmbuild 会用它，然后因为 crate 需要 1.77 而失败 |

`dist/pingzhu-<ver>-*` 的命名不是猜的：已反查 v0.10.2 的产物与 release 页上的资产 **sha256 一致**。

## 顺序（为什么是这个顺序）

```
git push origin main
  → gh 自动跑 HarmonyOS（这次改了 harmonyos/**，路径过滤器会命中）
  → 下载 artifact、组出 zip
  → bash tools/release.sh v0.10.3 "<标题>" docs/release-notes-v0.10.3.md dist/…
```

- `tools/release.sh` 里的 `gh release create` **不带 `--target`**，tag 会落在**远端默认分支的 HEAD** 上 → 必须**先 push**。
- HarmonyOS 的 zip 只能等 CI → release 排在 CI 之后。
- `release.sh` 会把说明档与标题**转成简体再上传**，并回头用 `tools/simplify-github.mjs --check` 验一遍线上内容。

## 还没验的（别当成已验）

- **RPM 的 `BuildRequires` 没在 openEuler 上解析过** —— 本机是 Ubuntu（rpm 4.18），
  用的是 `--nodeps`。要真的验，得在 openEuler 上跑一次 `dnf builddep fcitx5-pingzhu.spec`。
- **CI 不建这两种包** —— `.github/workflows/linux.yml` 只从原始码建 addon 并安装。
- **`release.sh` 的「URL LOST」是预期的**：`tools/check-links.mjs` 把「旧 URL 不见了」一律
  当损坏，而发版提交本来就要把下载连结改指新 tag。它只在「工作树 == HEAD」时才印 0。

## 顺带记下的两件事（不是本版范围）

1. **`linux/fcitx5/CMakeLists.txt` 的 `VERSION 0.9.0` 是个死值。**
   `PROJECT_VERSION` 全树没有第二处引用、没有 `configure_file`；实测把它改成 `0.10.3`
   后**两次 `cmake --install` 出来的树逐字节一致**（`diff -r` 空）。真正装进包里、
   被 `fcitx5-diagnose` 显示的是 `linux/fcitx5/pingzhu.conf` 的 `Version=0.9.0`
   —— 从一个静态档原样拷进去（`install(FILES …)`）。要改就改那个（连同
   `linux/README.md` 里对 diagnose 输出的那句），改 CMakeLists 不会有任何效果。
2. **仓库里没有 Android 的 CI。** `.github/workflows/` 只有 harmonyos / linux / macos / pages；
   `docs/release-notes-v0.10.2.md` 里「Android 的 workflow 只建 APK」与仓库现状不符。
   APK 一直是本机用 release keystore 签的。
