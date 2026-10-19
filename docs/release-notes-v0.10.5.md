# v0.10.5 — 选的字要能上屏，教过的字要记得住

## 一句话

两个修复，都是「功能在，但结果是空的」：Android 与 macOS 上选字之后**一个字也没送进应用**，
Linux 与 HarmonyOS 上使用者教过的字**重启就忘**。两个都没有报错，也没有任何画面提示。

## 一、选字之后什么都没上屏

`engine.select(n)` 选字并**在同一次调用里**提交，返回的就是选中的文字。而三个地方
又去调了一次 `commit()` —— 那一次拿到的已经是空字串：

```kotlin
if (engine.select(oneBased).isNotEmpty()) commit()   // ← commit() 里 engine.commit() 已空
```

于是选中的字没有被送进应用，组字却被 `reset()` 清掉了。用户按了候选，屏幕上什么都没有，
只能以为自己没点准。

| 平台 | 选字路径 | 修前 |
|---|---|---|
| Windows（可携版与文字服务） | 读 `select` 的返回值 | ✓ 一直是对的 |
| Linux | 读返回值 | ✓ |
| HarmonyOS | 读返回值 | ✓ |
| 网页试打版 | 读返回值 | ✓ |
| **Android**（触控选字、数字键选字） | 又调 `commit()` | ✗ **本版修复** |
| **macOS**（数字键选字） | 又调 `commit()` | ✗ **本版修复** |

## 二、教过的字重启就没了

引擎从使用者选的字里学习，那是这个输入法唯一的训练信号。Windows、macOS、Android 都在
启动时载入、学习后保存；**Linux 的 fcitx5 附加组件与 HarmonyOS 键盘一处都没有** ——
学到的词只活在内存里，重启即失。

本版让它们和另外三个外壳一样：

- **Linux**：`~/.local/share/fcitx5/pingzhu/userdict.tsv`（尊重 `$XDG_DATA_HOME`），
  建好引擎后载入，选字与送出之后写回；写不进去会记一条 `FCITX_WARN`，不再安静地丢掉
- **HarmonyOS**：`${filesDir}/userdict.tsv`（放在 model 目录外——那个目录每次启动都会被
  重写），启动时载入，选字与送出之后保存

## 验证

| 部分 | 怎么验的 |
|---|---|
| Android 选字（触控与数字键） | 模拟器上装 release APK 实测：选中的字进应用、候选列收起 |
| Linux 词典往返 | 新增 `tests/userdict.c`：教一次 → 存 → 建第二个引擎 → 载入 → 那个词还在 ✓ |
| Linux 引擎与路由 | `engine_smoke` ✓、共享向量 27 条 0 失败 ✓ |
| HarmonyOS 词典 | **只到 CI 编译验证** ✗（没有装置） |
| macOS 选字 | **只到 CI 编译验证** ✗（没有 Mac） |

## 给下一个版本留的基线

**文字服务的 DLL 档名本版不动**（仍是 `pingzhu-tsf-0.10.4.dll`）：档名的规则是
「`windows/` 自上一个 tag 起有改动才改」，而 `v0.10.4..v0.10.5` 之间 `windows/` 零改动 ——
这条规则第一次在发版里实际被用上，写起来只是 `git log <tag>..HEAD -- windows/` 一行。
