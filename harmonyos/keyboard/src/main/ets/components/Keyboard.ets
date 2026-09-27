/**
 * 鍵盤面板。
 *
 * 大千式佈局由引擎提供（core-rs/src/keyboard.rs 的 key_rows()），
 * 不是在這裡手寫一份——同一個判斷寫兩份，就一定會有一份是錯的。
 * 這一版先用一組佔位鍵，等 NAPI 接上之後改成向引擎要。
 */
@Builder
export function KeyboardPanel() {
  Column() {
    Text('平注')
      .fontSize(16)
      .fontColor('#333333')
    Text('引擎尚未接上（NAPI 待做）')
      .fontSize(12)
      .fontColor('#999999')
      .margin({ top: 8 })
  }
  .width('100%')
  .height(220)
  .justifyContent(FlexAlign.Center)
  .backgroundColor('#F5F5F5')
}
