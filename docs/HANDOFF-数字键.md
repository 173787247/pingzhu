# 交接：数字键语义（Rust 核心 ↔ TS 规格）

> **★ 已完成（2026-09-29，接手会话）。** 三节的命令跑完了，两侧全绿：
> **TS 66/66 · Rust 29/29**。两份 fixture 都重录过（本文件原以为只有断言要改，
> 实际漏了 `scenarios.tsv`）。五节那个待决问题已查清并结案，**六个实作不需要动**。
> 提交：`git log --oneline c54f3e4..HEAD` 看到的三个 —— 行为改动、本文件落盘、
> 以及本文件的更正。（原会话交接时 HEAD 是 `c54f3e4`。）
>
> 下面保留原会话的原始记录，以便回溯当时判断的依据；**已过时的地方逐处标注**。
>
> ---
>
> **为什么写这份**：原会话 `跨平台注音输入法Original`（session-651131d7）从 turn 222 起
> 被 DeepSeek API 以 `Content Exists Risk` 拒绝，**此后每一轮都失败**，连「在?」两个字也发不出去。
> 触发点没有定位到，但历史里带着它 —— 所以那个会话发不出任何消息。
>
> 这份文档把**它还差什么**写下来，新会话读它就能接着干。
>
> 交接时间：2026-09-29 14:3x · 来自 turn 221（最后一个成功的轮次）

---

## 一、目标

**让数字键在两种含义之间正确切换：**

```
没有候选窗   →  1–0 是注音键（ㄉ ㄧ ˇ … 在大千式键盘上）
有候选窗     →  1–0 是选字键
```

原会话最后定下的判据，**不是「音节是否合法」，而是「这个数字能不能加进当前音节」**：

```
把数字当作元件喂给 compose_syllable：

  ㄋㄨ  + 3（声调）  →  Some(ㄋㄨˇ)   →  注音键 ✓
  ㄕㄨ  + 2（声母）  →  None（两个声母）→  选字   ✓
  ∅    + 2（声母）  →  Some(ㄉ)      →  注音键 ✓

★ 三种情况互不冲突，而判据用的是引擎【已经有】的函数。
```

**为什么不能用更简单的「音节已完成」：** `su3cl3` 打「你好」时，
`s u` 之后 pending 为空、看起来"已完成"，按那个规则 `3` 会被当成选字键 —— **打不出「你好」。**

---

## 二、现在的状态

```
git        分支干净，HEAD = c54f3e4（macos 相关，与本任务无关）
未提交     4 个文件，+47 −6：
             core-rs/src/engine.rs            +23
             engine/src/engine.ts             +21
             engine/test/candidates.test.ts   ±1
             engine/test/engine.test.ts       +7 −2

TypeScript  ★ 66/66 通过（原会话最后确认的）
Rust 差异   ★ 未跑 —— 这正是被打断的那一步
```

**★ 差异测试有 1,529 例，钉住「Rust 核心」和「TypeScript 规格」行为一致。**
**只改一边它会红 —— 这是它的设计目的，不是故障。**

---

## 三、下一步（按顺序）

```bash
cd /home/rchua/GO/pingzhu
export PATH="$HOME/.cargo/bin:$PATH"

# ① 先看当前改了什么
git diff

# ② TypeScript 侧（应该还是 66/66）
cd engine && node --test 2>&1 | tail -14

# ③ ★ Rust 差异测试 —— 被打断的那一步
cd ../core-rs && cargo test --release 2>&1 | grep -E "test result|FAILED|panicked|assertion" | tail -8
```

**★ 实际红了 3 处，不是 2 处**（接手会话实测）：

```
tests/differential.rs:122
  su3c    expected: 'ㄋㄧˇ [c]'    actual: 'ㄋㄧˇ [ㄏ]'    ← 文档写了
  4       expected: '[4]'          actual: '[ˋ]'          ← 文档写了
  ne3cl3  expected: 'ㄋㄧˇ [cl3]'  actual: 'ㄋㄧˇ [ㄒㄌˇ]'  ← ★ 文档漏了
```

**★ 但只改断言不可能全绿 —— 漏了一整份 fixture。**

本文件说「两处待改的断言」，实际上 `core-rs/tests/` 下有**两份**录制的参考
资料，都记着旧行为：

| fixture | 受影响行数 | 重录命令 |
|---|---|---|
| `tests/fixture.tsv` | 3 | `node dump-fixture.mjs 1500` |
| `tests/scenarios.tsv` | 13 | `node dump-scenarios.mjs` |

（两份 harness 的表头都写了重录命令。**fixture 是 TypeScript 参考实作行为的
录像，不是手写断言** —— 改实作之后要重录，不是改数字。）

重录后逐字比对过：两份 diff **只出现在 `composing` 这一栏**，句子、分数、
usedFallback、pathWords、候选页、是否开窗、已送出内容全部逐字节不变。
这既证明改动只动显示，也证明产生器是确定性的。

---

## 四、两处断言的含义（原会话的判断）

```
'ㄋㄧˇ [ㄏ]'  ← 人看得懂：打了「你」，还在打 ㄏ
'ㄋㄧˇ [c]'  ← ★ 内部诊断符号泄漏到界面上，人看不懂

★ 所以 [c] → [ㄏ] 是把内部表示换成可读的注音
★ 而 [4] → [ˋ]  同理：数字键 4 在大千式上是 ˋ（四声）
```

**改动方向：界面上显示注音符号，不显示原始按键或内部标记。**

---

## 五、原会话留下的待决问题 —— ★ 已查清，结案：不要动那 6 个库

**原话（被截断）**：

> 「我把 ① 的机制搞清楚了 ——**但它值得单独一天做**
>
> `decode()` 用 `walk()` 枚举所有切法 ✓ ——`gj2` 里 `2` 之所以落进 pending ✗ 是因为 ㄕㄨㄉ 不合法 ✓
>
> 新规则就是「加进去之后 ✗ 消耗的键数有没有变多」✗ ——**可以精确实现 ✓**
>
> **但它要动 6 个代码库 ✗ ——而这条规则在 v0.6.0 已经弄…**」

### ★ 这条线索本身是错的

原会话建议「先把它读完（`git log --all --oneline | grep v0.6.0`）」—— **那条命令
返回空**：`v0.6.0` 是 tag，不在任何提交信息里。真相在**源码注释**里，
`linux/fcitx5/src/pingzhuengine.cpp`：

```
// …which is the rule every shell follows and the one that v0.6.0 got wrong:
// 倒 and every word beginning with ㄅㄉㄓㄚㄞㄢ stopped typing.
```

被截断的「在 v0.6.0 已经弄…」读起来像「v0.6.0 已经做好了」，**原意正好相反 ——
v0.6.0 把它做错了**。v0.6.0（`a2a2095`）是「簡體輸出」，与数字键无关；
数字键那个 bug 是 `4827465` 修的，同一提交把 TSF DLL 版本推到 0.6.1。

### 六个实作早就是一致的

```
core-rs/src/engine.rs              engine/src/engine.ts
windows/src/router.cpp             android/.../Router.kt
macos/Sources/Router.swift         linux/fcitx5/src/pingzhuengine.cpp
```

六边同一条规则：**候选窗开着时数字选字，否则是注音键。**
（HarmonyOS 走 C ABI，不自己实作。）

### 那条替代规则实测是 no-op，别做

「加进去之后消耗的键数有没有变多」与现行规则**不可能分歧**，原因是
`press()` 每收一个键就把 `candidatesOpen` 置回 `false`：

```ts
press(key) {
  if (!this.layout.keyToComponents.has(k)) return false;
  this.candidatesOpen = false;   // ← 打字永远关窗
  ...
}
```

只有**明确的 ↓／space** 才开窗。所以组字途中视窗恒为闭，两条规则给出相同答案。

用真引擎实测（不是推导）：

```
gj2      composing="ㄕㄨ [ㄉ]"   open=false  cands=10
su3c     composing="ㄋㄧˇ [ㄏ]"  open=false  cands=10
2l3      composing="ㄉㄠˇ"       open=false  cands=10
```

`cands=10` 是关键：**候选存在，但组字途中不可选**。把「消耗键数」那套机器
建到 6 个库里，使用者看不到任何差别。

---

## 六、验证过的键位（原会话用真引擎跑出来的，不是猜的）

```
gj          → 書
gjbj4       → 輸入
su3cl3      → 你好
ji394su3    → 我愛你
w96j0       → 台灣
```

**大千式要点：** `g = ㄕ`，`j = ㄨ`，所以 `gj = ㄕㄨ` → 書/輸/輸入。
**`sj` 打不出「书」** —— `s = ㄋ`，`sj = ㄋㄨ` → 奴/努/女。

---

## 七、这个会话为什么死的（给后来的人）

```
turn 221  21:34  成功
turn 222  21:39  ★ Content Exists Risk，跑到第 26 步才失败（前 25 步成功）
turn 223+        ★ 每次请求都带全部历史 → 每次都失败，连「在?」两个字也不行

排除掉的:
  ✗ 用户消息内容   —— 两个字的消息也失败
  ✗ dsh 重启       —— 失败在 21:39，重启在 23:36
  ✗ API 配额       —— 那会报 429，不是 INVALID_REQUEST
  ✗ 「畜牲」二字    —— 它从 turn 2 就在历史里，而 turn 2–221 全成功
  ✗ UI 显示的 subagent —— 4 个 subagent 在 turn 2 就全完成了
  ✗ Fork session   —— ★ 它复制【全部】历史（含失败轮），所以照样失败

★ 剩下: turn 222 的某个工具结果，或请求体积本身（732M tokens / 225 轮）
★ 而错误信息只说「内容有风险」，不说是哪一段 —— 系统给了一个无法定位的错误
```

**★ 教训：`Fork session` 的语义是「在最后一个**完成的** turn 分叉」——
而**以错误结束的轮次也是 completed**。所以对一个"从某轮起永久失败"的会话，
Fork 会把病灶一起复制过去。**
