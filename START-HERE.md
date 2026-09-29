# 接手这个项目 —— 从这里开始

> **给新会话的第一份文件。** 如果你是刚被叫来接手的 agent，读完这一页再动手。
>
> 项目：**跨平台注音（Bopomofo / Zhuyin）输入法**
> 位置：`/home/rchua/GO/pingzhu`
> 语言：**全程用中文回复。**

---

## 一、现在接着干什么

**★ 先读这份，它写清了当前进度与下一步：**

```
docs/HANDOFF-数字键.md
```

一句话：**数字键的语义**（注音键 ↔ 选字键）改到一半，
TypeScript 66/66 通过，**Rust 差异测试还没跑** —— 那正是被打断的那一步。

```bash
cd /home/rchua/GO/pingzhu
export PATH="$HOME/.cargo/bin:$PATH"

git diff                                     # 看当前改动（4 个文件未提交）
cd engine && node --test                     # 应 66/66
cd ../core-rs && cargo test --release        # ★ 差异测试，1529 例
```

---

## 二、已经有的东西 —— 别重做

### 2.1 四份深度调研（5,048 行，09-26 完成）

**★ 在 `research/`，不在 `docs/`。两份都读，别只读 docs。**

| 文件 | 行数 | 内容 |
|---|---|---|
| `research/01-iqt-natural-ime.md` | 642 | 竞品：台湾自然输入法（IQT）全解析 |
| `research/02-opensource-stack.md` | 483 | 可复用的开源元件 + 授权条款 |
| `research/03-platform-ime-frameworks.md` | 1417 | 四平台接入（Windows / macOS / Android / HarmonyOS NEXT） |
| `research/04-zhuyin-ime-internals.md` | **2506** | ★ 最强的一份：引擎内部、算法、UX |

**`04` 里有几件直接能用的东西：**

```
· 合法音节表 —— 从 506,778 个 token 实测出来的
    429 个无声调（清理后 408）· 1,413 个含声调
    ★ 与文献常引的 411 相差 3
· 大千式键位表 —— 三方交叉验证过（RIME xlit / libchewing / 维基）
· 两个可直接抄的公式
    词频   log10(2.7^(len-1) × occ / norm)      ← McBopomofo, MIT
    学习   +10/+5/+1，上限 9999999，排序 max(内建, user)  ← libchewing
· MIT 开放数据
    BPMFMappings.txt (145,603) · phrase.occ (161,806) · BPMFBase.txt (26,535)
· 教育部辞典 = CC BY-ND 3.0 TW，官方说明不限制格式转换与后续应用
```

### 2.2 设计文档（9 份，在 `docs/`）

```
01-competitive-analysis.md      02-architecture.md        03-platform-matrix.md
04-data-and-licensing.md        05-roadmap.md             06-engine-design.md
07-research-tooling.md          08-self-built-data.md     09-zhuyin-vs-pinyin.md
```

### 2.3 已验证的键位（用真引擎跑出来的，不是猜的）

```
gj        → 書
gjbj4     → 輸入
su3cl3    → 你好
ji394su3  → 我愛你
w96j0     → 台灣
```

大千式要点：`g = ㄕ`，`j = ㄨ`，所以 `gj = ㄕㄨ`。
**`sj` 打不出「书」** —— `s = ㄋ`，`sj = ㄋㄨ` → 奴/努/女。

---

## 三、项目结构

```
pingzhu/
  core-rs/      Rust 核心（引擎）
  engine/       TypeScript 规格（参照实现）
  docs/         设计文档 + 交接文档
  research/     ★ 四份深度调研（5,048 行）
  data/         数据
  android/      Android 前端
  harmonyos/    HarmonyOS 前端
  demo/  dist/
```

**★ `core-rs` 和 `engine` 之间有 1,529 例**差异测试**钉住行为一致。
只改一边它会红 —— 那是它的设计目的，不是故障。**

---

## 四、纪律（这个项目自己的，不是通用建议）

```
① 每条结论带来源 URL —— 没依据的不写，不填"大概"
② ★ 用真引擎验证，不凭记忆
   原会话的写法：「我用真引擎验证过 ✓（不是凭记忆 ✓）」
③ 差异测试红了先看是哪一边 —— 它钉的是"两边一致"，不是"某一边对"
④ 改断言之前先想清楚：是代码错了，还是断言记录了旧行为
```

---

## 五、为什么会有这份文件

原会话（`跨平台注音输入法Original`）跑到 **turn 221 之后被 DeepSeek API
以 `Content Exists Risk` 拒绝，此后每一轮都失败**，连两个字的消息也发不出去。
触发点没定位到，但历史里带着它。

**★ 所以把状态落成了文件。文件比会话活得久。**

四个 subagent 当时写的调研也是一样 —— 会话归档了，但
`research/` 里那 5,048 行还在。**这就是"先落盘，再深挖"的意思。**
