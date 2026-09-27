/**
 * 鍵盤面板。
 *
 * 大千式佈局由引擎提供（core-rs/src/keyboard.rs 的 key_rows()），
 * 不是在這裡手寫一份——**同一個判斷寫兩份，就一定會有一份是錯的。**
 *
 * 這一版先把它畫成佔位鍵，但**已經透過 NAPI 去問引擎的狀態**：
 * 面板上顯示的那句話不是寫死的，是引擎回答的。等核心接上之後，
 * 同一條路就會回傳真正的解碼結果。
 */
import pingzhu from 'libpingzhu.so';

@Builder
export function KeyboardPanel() {
  Column({ space: 8 }) {
    Text('平注')
      .fontSize(18)
      .fontWeight(FontWeight.Medium)
      .fontColor('#333333')

    if (pingzhu.engineLinked) {
      Text('引擎已連結')
        .fontSize(12)
        .fontColor('#4CAF50')
    } else {
      // 這一行是引擎回答的，不是寫死的。
      Text(`引擎尚未接上（${pingzhu.engineDescription}）`)
        .fontSize(12)
        .fontColor('#999999')
    }
  }
  .width('100%')
  .height(220)
  .justifyContent(FlexAlign.Center)
  .backgroundColor('#F5F5F5')
}
