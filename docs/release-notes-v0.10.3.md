# v0.10.3 — Linux 有安装包了：deb 与 RPM

## 一句话

Linux 的 fcitx5 附加组件以前只能自己编译；现在仓库里就带着打包定义，
`dpkg-buildpackage` 与 `rpmbuild` 各产出一种包，可以直接装。

## 问题

引擎和五个外壳一直在，Linux 的 addon 也一直能构建 —— 但**没有任何打包定义**：

```
cmake -DCMAKE_INSTALL_PREFIX=/usr   → 装得到这台机器上   ✓
把 addon 交给别人的机器             → 没有东西可以给     ✗
```

UOS、Kylin、deepin、openEuler 的使用者拿到仓库也只能自己编译，而这条路在国产
发行版上并不总是通的：Rust 版本、fcitx5 开发包、cmake 宏，各家都不一样。

## 三种装法

| 方式 | 给谁用 | 怎么做 |
|---|---|---|
| **`.deb`** | 统信 UOS / 麒麟 Kylin / deepin / Ubuntu | `sudo dpkg -i fcitx5-pingzhu_0.10.3_amd64.deb` |
| **`.rpm`** | openEuler / 麒麟部分版本 / Fedora | `sudo rpm -ivh fcitx5-pingzhu-0.10.3-1.x86_64.rpm` |
| 从原始码 | 想自己控制前缀的人 | `cmake -S linux/fcitx5 -B build -DCMAKE_INSTALL_PREFIX=/usr`（原有方式，未变） |

## 加了什么

| 档案 | 指令 | 产出 |
|---|---|---|
| `debian/`（仓库根目录） | `dpkg-buildpackage -b -us -uc` | `fcitx5-pingzhu_0.10.3_amd64.deb` |
| `fcitx5-pingzhu.spec` | `rpmbuild -bb fcitx5-pingzhu.spec` | `fcitx5-pingzhu-0.10.3-1.x86_64.rpm` |

两种包装的是同一组东西：

```
/usr/lib/*/fcitx5/libpingzhu.so             RPM 侧是 /usr/lib64/fcitx5/
/usr/share/fcitx5/addon/pingzhu.conf        附加组件定义
/usr/share/fcitx5/inputmethod/pingzhu.conf  输入法定义
/usr/share/pingzhu/*.tsv                    引擎资料
```

## 打包时暴露出来的三件事

**① 宣告的 Rust 下限根本达不到。** `core-rs/Cargo.toml` 写着
`rust-version = "1.75"`，但 crate 里用了 C 字串字面值（`c"..."`），那需要 **1.77**。
用 1.75 构建会停在 `E0658` —— 也就是说宣告的下限是一个构建不起来的版本。
两个包的依赖栏位也跟着写成 1.77。

**② RPM 的并行参数展开成 `-j-j8`。** `%{_smp_mflags}` 自带 `-j`，再补一个就成了
`make -j-j8`，make 印出用法就退出。改用 `--parallel`。

**③ 安装路径原本让 CMake 自己挑。** 在 Debian 上它挑 `lib/x86_64-linux-gnu`，
而 RPM 的档案清单要的是 `%{_libdir}`（openEuler 上是 `/usr/lib64`）。现在两边都由
各自的宏决定：`-DCMAKE_INSTALL_LIBDIR=%{_libdir}` 与
`-DCMAKE_INSTALL_DATADIR=%{_datadir}`。档案清单原先还指着
`%{_datadir}/fcitx5/pingzhu`，而资料实际装在 `%{_datadir}/pingzhu`。

## 安装说明也补上了

`linux/README.md` 多了一节「安装」：两种包的命令、从原始码构建、以及装完怎么确认
东西真的在 fcitx5 会去找的位置（`libpingzhu.so` 在不在、`ldd` 有没有 `not found`）。

## 验证

```
.deb     实际构建出来，解开确认含 addon、输入法定义与引擎资料
.rpm     实际构建完成并确认内容：/usr/lib64/fcitx5/libpingzhu.so、两个 .conf、
         引擎资料与授权档案
TypeScript  68 项 · typecheck
Rust        29 项（26 单测 ＋ 差异 1529 例 ＋ 交互 207 例 ＋ 文件测试）
```

`engine_smoke` 那三个词，与其他四个平台一致（下面是它实际印出来的样子）：

```
ok    su3cl3: 你好
ok    ji394su3: 我愛你
ok    w96j0: 台灣
```

## 仍有的缺口

**RPM 的 `BuildRequires` 还没在 openEuler 上解析过一次。** 本机是 Ubuntu（rpm 4.18），
rpmbuild 不认 apt 的套件名，所以是 `--nodeps` 加现有的 cmake 宏建起来的。
规格档已经刻意写成直接调用 `cmake`（不依赖 Fedora 那套 cmake 宏），但
**在 openEuler 上跑一次 `dnf builddep fcitx5-pingzhu.spec` 才算真的验过**。

**CI 不建这两种包。** `.github/workflows/linux.yml` 仍然是从原始码构建并安装 addon；
两种包是本地实测出来的，不是每次推送都重新验一遍。

---

升级方式同前：Windows 用 `pingzhu-0.10.3-setup.exe`、Android 装
`pingzhu-0.10.3-android.apk`、HarmonyOS 用对应的 project zip、引擎用 `.tgz`；
**Linux 这次多了 `.deb` 与 `.rpm` 两种包**。
**macOS 仍无产物**（签章待办，见 v0.10.0 的说明）。
