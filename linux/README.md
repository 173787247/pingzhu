# Linux 外壳（fcitx5）

平注的 Linux 输入法。

**解码不在这里** —— 每一个按键都送到共用的 Rust 核心（`core-rs/`），
通过 C ABI，和 Windows、Android、macOS、HarmonyOS 用的是同一份。

```
linux/fcitx5/
├── src/
│   ├── pingzhuengine.h        Engine（RAII 包装）+ 引擎类别
│   └── pingzhuengine.cpp      keyEvent / activate / reset / 候选面板
├── tests/
│   └── engine_smoke.c         对着已安装的资料目录跑 su3cl3 → 你好
├── CMakeLists.txt
├── pingzhu-addon.conf         addon 描述
└── pingzhu.conf               输入法条目
```

---

## 安装

三种方式，任选其一。

### 1. 发行版包（推荐，国产 Linux 直接可用）

仓库根目录带打包定义，构建出包后安装即可：

```bash
# Debian 系（统信 UOS / 麒麟 Kylin / deepin / Ubuntu）
sudo apt-get install -y debhelper cmake pkg-config libfcitx5core-dev fcitx5-modules-dev extra-cmake-modules gettext
dpkg-buildpackage -b -us -uc          # 在仓库根目录执行
sudo dpkg -i ../fcitx5-pingzhu_*.deb

# RPM 系（openEuler / 麒麟部分版本 / Fedora）
sudo dnf install -y rpm-build cmake gcc-c++ fcitx5-devel extra-cmake-modules gettext rust cargo
rpmbuild -bb fcitx5-pingzhu.spec      # 在仓库根目录执行
sudo rpm -ivh ~/rpmbuild/RPMS/*/fcitx5-pingzhu-*.rpm
```

两个包都安装同样的内容：`fcitx5` 附加组件（`libpingzhu.so`）、输入法定义
（`/usr/share/fcitx5/{addon,inputmethod}/pingzhu.conf`）与引擎数据（`/usr/share/pingzhu/*.tsv`）。

### 2. 从源码构建

```bash
# 先构建 Rust 核心（需要 rustc >= 1.77）
cargo build --release --manifest-path core-rs/Cargo.toml
# 再构建 fcitx5 附加组件
cmake -S linux/fcitx5 -B build -DCMAKE_BUILD_TYPE=Release -DCMAKE_INSTALL_PREFIX=/usr
cmake --build build
sudo cmake --install build
```

### 3. 验证安装

```bash
# 组件是否就位
ls /usr/lib/*/fcitx5/libpingzhu.so /usr/lib64/fcitx5/libpingzhu.so 2>/dev/null
# 依赖是否都能解析（应无 "not found"）
ldd /usr/lib/*/fcitx5/libpingzhu.so 2>/dev/null | grep -c 'not found'
```

然后在 fcitx5 的配置里添加「平注」输入法即可。

> 打包定义位于仓库根的 `debian/` 与 `fcitx5-pingzhu.spec`；两者都在 CI 之外的本地环境实测
> 构建出包（RPM 的 `BuildRequires` 依赖解析需在 openEuler 上跑一次 `dnf builddep`）。

## Linux 是五个平台里最好做的

**因为开发机和目标机是同一台** ✓：

| | 其他平台 | Linux |
|---|---|---|
| 编译错误 | 推上去，等 CI 4 分钟 | **1 秒** |
| 验证 | 下载产物、装机、打字 | **本机直接跑** |

**今天在 Linux 上总共花了约两分钟修完五轮编译器错误** ✓ ——
而鸿蒙那边每一轮要 4 分钟 ✓

---

## 建置

```bash
sudo apt-get install fcitx5 libfcitx5core-dev libfcitx5config-dev \
                     libfcitx5utils-dev fcitx5-modules-dev \
                     extra-cmake-modules cmake pkg-config

cargo build --release --manifest-path core-rs/Cargo.toml

cd linux/fcitx5 && mkdir -p build && cd build
cmake .. -DCMAKE_INSTALL_PREFIX=/usr -DCMAKE_BUILD_TYPE=Release
make
sudo make install
```

**`-DCMAKE_INSTALL_PREFIX=/usr` 不是可选的** ✓ ——见下面第一节 ✓

---

## 四个「东西在，但对方不看那里」

今天这个专案第七次遇到同一个形状 ✓ ——**而且四次都发生在把 Linux addon 装起来的过程中**：

| # | 装到哪里 | 程序去哪里找 | 症状 |
|---|---|---|---|
| 1 | `/usr/local/share/fcitx5/addon` | **只有** `/usr/share/fcitx5/addon` | 清单里没有它 |
| 2 | `/usr/lib/fcitx5/` | `/usr/lib/**x86_64-linux-gnu**/fcitx5/` | `Cannot find file` |
| 3 | `Library=pingzhu` | 要 `Library=libpingzhu` | **同上，一模一样** |
| 4 | `LANGUAGES CXX` | 测试是 `.c` | `Cannot determine link language` |

**第 3 个我绝对猜不到** ✓ ——是**跟 `/usr/share/fcitx5/addon/quickphrase.conf` 逐行比对**看出来的 ✓

**第 2 个的修法**：用 CMake 的 `GNUInstallDirs` ✓ ——它在 Debian 给
`lib/x86_64-linux-gnu` ✓、在 Fedora 给 `lib64` ✓ ——**不要自己写 `lib/`** ✓

---

## 名字要对三次

fcitx5 的 addon 有**三个名字**，而它们必须一致 ✓ ——**不一致的症状只有一句**：

```
Group Item pingzhu in group Default is not valid. Removed.
```

**它说输入法被移除了，不说为什么，也不说怎么修** ✗

| 名字 | 在哪里 | 我写错成 |
|---|---|---|
| addon 名 = **设定档名** | `share/fcitx5/addon/**.conf` | `pingzhu-addon.conf` ✗ → addon 叫 `pingzhu-addon` |
| `InputMethodEntry` 的 `addon` 栏位 | `listInputMethods()` | `"bopomofo"` ✗ |
| `inputmethod/*.conf` 的 `Addon=` | `share/fcitx5/inputmethod/` | `pingzhu` ✓ |

**三个名字，没有一个对得上** ✓ 改成全部 `pingzhu` ✓ 才通过 ✓

加一个相关的：`OnDemand=True` 会让 fcitx5 **在 addon 载入之前**检查 profile ✗ ——
于是它不认识 `pingzhu` ✓ 就把它从组里删掉 ✓。**改成 `False`** ✓

## 验证

```bash
cd build && ./tests/engine_smoke /usr/share/pingzhu
```

```
ok    engine created, ABI 1
ok    su3cl3: 你好
ok    ji394su3: 我愛你
ok    w96j0: 台灣
```

**同样三个词，和其他四个平台一致** ✓

`fcitx5-diagnose` 应该列出 `PingZhu 0.9.0` 且**没有** `Cannot find file` ✓

---

## 键盘行为

| 键 | 行为 |
|---|---|
| 注音键 | 组字，预编辑显示解码结果 |
| 数字 | 候选单开着 → 选字；否则 → 照打（1 是 ㄅ） |
| 空白 | 候选单开着 → 下一页；组字中 → 送出；否则 → 空白 |
| Enter | 送出 |
| ⌫ | 退回一个读音成分 |
| Esc | 放弃组字 |
| ↑↓ | 移动候选 |

**「数字只在候选单开着时选字」是 v0.6.0 那个回归的规则** ✓ ——
当时所有以 ㄅㄉㄓㄚㄞㄢ 开头的字都打不出来 ✓

---

## 在 WSL2 里能测到哪一步

**能测引擎，测不了打字。**

WSLg 提供了真的 X11 和 Wayland ✓ ——`DISPLAY=:0` ✓、`X0` socket ✓ ——
所以 addon 能在里面跑起来 ✓：

```
Loaded addon pingzhu
Found 1 input method(s) in addon pingzhu
DefaultIM=pingzhu（沒有 not valid）
PingZhu: engine ready, ABI 1, data /usr/share/pingzhu   ← Rust 核心讀到了 6.2MB 模型
```

**但「在 GUI 里真的打字」在 WSLg 底下测不了** ✗：

| 障碍 | 为什么 |
|---|---|
| **Wayland 被拒** | `zwp_input_method_v1: permission to bind input_method denied` ——WSLg 不允许输入法协定 |
| **xterm 的 XIM 连不上** | 系统只有 `C.utf8` 一个 locale，而 xterm 的 XIM 跟著 locale 走 |
| **GTK 视窗不映射** | mousepad 跑起来了，但它的视窗没出现在 WSLg 的合成器里 |

**所以 `fcitx5 --disable=wayland` 是必须的** ✓ ——X11 是通的 ✓

**要真的验证打字，需要一台有桌面环境的 Linux** ✓ ——
而 `tests/engine_smoke` 在那里会跑同样的三个词 ✓

## 还没有做的

| | |
|---|---|
| **在真的桌面环境里打字** | ❌ **WSLg 底下测不了**（见上一节）——引擎与 addon 载入已验证 |
| 图示 | ❌ `Icon=pingzhu` 指向一个还没做的图示 |
| 使用者词库的读写 | ❌ C ABI 有，addon 还没接 |
| 繁简切换的快速键 | ❌ |
| ibus 版本 | ❌ 只做了 fcitx5 |
