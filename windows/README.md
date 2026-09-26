# 平注 PingZhu — Windows 可攜版注音輸入法

**這是可以現在就用的版本。** 托盤常駐、全域鍵盤鉤子、候選視窗、字元注入。

```
C:\Users\<你>\pingzhu-build\
├── pingzhu-ime.exe           ← 執行這個
├── pingzhu_core.dll          ← Rust 引擎（解碼、詞庫、學習）
├── pingzhu-router-test.exe   ← 按鍵路由測試
├── pingzhu-engine-test.exe   ← 引擎整合測試
├── pingzhu-userdict.txt      ← 你的學習紀錄（首次離開時產生）
└── data\
    └── bopomofo-lm.tsv       ← 169,604 條語言模型
```

## 操作

| 按鍵 | 行為 |
|---|---|
| `Ctrl+Alt+Z` | 切換中文／英文（托盤左鍵也一樣） |
| 托盤右鍵 | 選單（切換、結束） |
| 注音鍵 | 打字（大千式：`su3cl3` = 你好） |
| `空白` | 開啟候選視窗；再按下一頁十個 |
| `↓` / `↑` | 開啟／關閉候選視窗 |
| `1`…`9`、`0` | **選字模式開啟後**選第 1…10 個 |
| `←` `→` | 移動候選游標 |
| `Backspace` | 退一格 |
| `Enter` | 送出 |
| `Esc` | 清空 |

**為什麼數字要先開候選視窗？** 因為大千式鍵盤上 `1234567890` **本身就是注音鍵**
（1ㄅ 2ㄉ 3ˇ 4ˋ 5ㄓ 6ˊ 7˙ 8ㄚ 9ㄞ 0ㄢ）。如果數字直接選字，`su3cl3` 就永遠打不出來。
真實輸入法（微軟新注音、自然輸入法）也是同樣的處理。

## 這是什麼、不是什麼

**是**：一個不需要安裝、不需要管理員權限、不需要 COM 註冊就能跑的輸入法。
多數應用程式可用（記事本、瀏覽器、Office、Electron 應用）。

**不是**：TSF 文字服務。所以它不會出現在語言列，也**無法對以管理員權限執行的視窗輸入**
（UIPI 限制，不是 bug），對讀取原始輸入的遊戲也無效。

TSF 版本是下一步：同一份引擎、同一個候選視窗，加上 COM 註冊。

## 從 WSL 重新建置

```bash
bash windows/build.sh                    # 建置到 /mnt/c/Users/$USER/pingzhu-build
bash windows/build.sh <staging> --run    # 順便跑路由測試
```

建置流程有兩個工具鏈，理由很具體：

| 部分 | 工具鏈 | 為什麼 |
|---|---|---|
| Rust 核心 | `x86_64-pc-windows-msvc`（從 WSL 驅動） | 與外殼同一個 CRT，且全在 WSL 內可腳本化 |
| C++ 外殼 | MSVC（`windows/build.bat`） | Windows 原生工具鏈，`msctf.h` 等都在 SDK 裡 |

從 WSL 讓 cargo 驅動 Windows 連結器需要兩個技巧（見 `~/.local/bin/msvc-link.sh`）：

1. **路徑翻譯**：rustc 產出 POSIX 路徑，`link.exe` 讀不懂，用 `wslpath` 轉。
2. **環境變數**：WSL 會改寫看起來像 Windows 路徑清單的環境變數，所以 `LIB`/`INCLUDE`
   傳不過去。解法是整個連結都在 Windows 側跑，由產生的 .bat 自己呼叫 `vcvars64.bat`。

外殼用 `LoadLibrary` 載入 DLL 而不是靜態連結，所以 DLL 不在或 ABI 版本不符時，
它會給你一句可讀的錯誤，而不是呼叫到錯誤的函式簽章。

## 測試

```bash
# Windows 原生，透過真實 DLL
pingzhu-router-test.exe      # 按鍵路由：數字何時組字、何時選字
pingzhu-engine-test.exe data # 引擎整合：你好／我愛你／萬丹／學習

# Linux 端（引擎本體）
cd ../engine && node --test "test/*.test.ts"    # 40 項
cd ../core-rs && cargo test                     # 16 單元 + 2 差異化
```

`pingzhu-engine-test.exe` 在開發過程中抓到一個真實缺陷：`engine_create` 原本不附帶
使用者詞庫，只有在詞庫檔**已存在**時才裝上——也就是說**全新安裝的使用者永遠學不了字**。
現在 `engine_create` 一律附上一個空的詞庫。

## 已知限制

1. 不是 TSF，不進語言列，管理員視窗無效。
2. 注入是 `SendInput` 的 Unicode 字元，少數應用（遊戲、部分終端機）可能收不到。
3. 沒有詞庫匯出匯入的介面（檔案就在旁邊，純文字，可以直接編輯）。
4. 倉頡／拼音等模式尚未接上（引擎目前只有注音）。
