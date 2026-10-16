/**
 * 底排按鍵的意思。
 *
 * 這些判斷原本內聯在鍵盤的 onClick 裡 —— 規則沒有名字，也沒有東西能檢查它。
 * ⌫ 就是證據：它呼叫 `reset()`（把整個組字丢掉）**又**呼叫
 * `Session.deleteBackward()`（刪掉編輯區裡一個字）✗，按一次做錯兩件事 ✗。
 * 其他四個外殼是「組字中退一個讀音成分，其餘交給應用程式」
 * （`tools/routing-vectors.tsv`：`\b 1 0 0 → Backspace`）✓。
 *
 * 這支檔案刻意很小：它只把**出錯的那一條**命名下來。至於這個鍵盤要不要有完整的
 * 路由表（例如數字鍵該不該像其他外殼一樣選字），是設計問題，不是實作細節 ✗。
 */

/** ⌫ 該做什麼。 */
export enum BackspaceAction {
  /** 引擎手上有東西可以退：退一個注音成分。 */
  StepBackComponent,
  /** 沒有在組字：這個鍵屬於編輯區。 */
  DeleteInEditor,
}

export function routeBackspace(composing: boolean): BackspaceAction {
  return composing ? BackspaceAction.StepBackComponent : BackspaceAction.DeleteInEditor;
}
