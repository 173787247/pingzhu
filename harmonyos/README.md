# HarmonyOS 外壳

平注的 HarmonyOS 输入法。**解码不在这里**——按这个专案一贯的做法，
每一个按键都要送到共用的 Rust 核心，这样四个平台的选字结果一致。

> ⚠️ **这一版还没有接上引擎。** 键盘打得出来、选字是空的。
> 这句话写在这里而不是藏在最后。

## 结构

```
harmonyos/
├── AppScope/app.json5              bundleName: tw.pingzhu.ime
├── keyboard/                       ← 輸入法本體（feature 模組）
│   └── src/main/
│       ├── module.json5            IME 的宣告
│       └── ets/
│           ├── InputMethodExtensionAbility.ets
│           └── components/Keyboard.ets
├── entry/                          ← 設定 App（引導使用者啟用）
├── build-profile.json5             模組清單
├── hvigorfile.ts
├── oh-package.json5
└── hvigor/hvigor-config.json5
```

## 在 CI 上构建

**HarmonyOS 没有自己的 runner，SDK 也不是 `apt-get` 装得到的。**
让这件事可行的，是一个已经装好整套工具链的容器映像
（`ohpm`、`hvigorw`、ArkTS 编译器），跑在普通的 ubuntu runner 上。

```
ghcr.io/sanchuanhehe/harmony-next-pipeline-docker/harmonyos-ci-image:v5.0.4
```

### 两件必须讲清楚的事

**一、映像是第三方的。** 不是华为官方。用它意味着**别人的映像在我们的
CI 里执行这个 repo 的程式码**——所以钉在确切的版本而不是浮动标签，
而且这个建置只产出 HAP，不发布、不安装、不被任何人信任。
哪天有官方路径，这段注释应该跟着映像一起换掉。

**二、能编译不等于能跑。** HAP 编得过只证明 ArkTS 语法正确、
模组宣告了框架期待的东西。**它不证明键盘打得出字**——
那需要鸿蒙装置或模拟器，而这里两者都没有。

## 建置路上踩到的四个坑

每一个都是**安静或有误导性的失败** ✓：

| # | 问题 | 症状 |
|---|---|---|
| 1 | 容器里没有 `python3` | 检查脚本死在 `not found`，而它要检查的工具链就在 `/opt` |
| 2 | 容器里 `node` 也不在 PATH 上 | 同上。它在 `/opt/harmonyos-tools/command-line-tools/tool/node/bin/node` |
| 3 | 容器的 shell 是 **dash**，不是 bash | `${PIPESTATUS[0]}` → `Bad substitution`，**而且是在 hvigor 已经印出 BUILD SUCCESSFUL 之后** |
| 4 | `@ohos.inputMethod.*` 在 API 12 里不存在 | 网路上大部分范例——包括我参照的那个——还是旧写法 |

**第 4 个最有教育意义** ✓ ——HarmonyOS NEXT 改成了 **Kit 风格** ✓：

```typescript
import { InputMethodExtensionAbility } from '@kit.IMEKit';
import { Want } from '@kit.AbilityKit';
import { hilog } from '@kit.PerformanceAnalysisKit';
```

**而 `onCreate` 的签名也和 `UIAbility` 不一样** ✗：

```typescript
onCreate(want: Want): void                                    // IME ✓
onCreate(want: Want, launchParam: AbilityConstant.LaunchParam) // UIAbility ✗
```

照 UIAbility 的形状抄，编译器会说：

```
Type '(want: any, launchParam: any) => void'
is not assignable to type '(want: Want) => void'
```

**与其猜第二次**，CI 里有一步骤直接问 SDK：

```bash
find /opt -name '@kit.IMEKit.d.ts' | head -1 | xargs grep -E "^export"
# export { InputMethodExtensionAbility, InputMethodExtensionContext, ... }
```

## 还没有做的

| | |
|---|---|
| **Rust 核心接上（NAPI）** | ❌ 最大的缺口 |
| 键盘 UI（大千式布局） | ❌ 现在是占位 |
| 候选视窗 | ❌ |
| 在真机或模拟器上打字 | ❌ 需要鸿蒙装置 |
| 签章与上架（AGC） | ❌ 治理问题，不是 API 问题（见 [docs/03](../docs/03-platform-matrix.md)） |

## 启用的方式

HarmonyOS 跟 Android 一样，装好之后要使用者自己启用：

```
設定 → 系統與更新 → 輸入法 → 更多輸入法設定 → 選擇「平注」
```

开发者可以用 `hdc` 直接启用：

```bash
hdc shell ime -e tw.pingzhu.ime
```
