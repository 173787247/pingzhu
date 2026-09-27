/**
 * 設定與啟用引導。
 *
 * HarmonyOS 跟 Android 一樣：輸入法裝好之後，使用者要自己到設定裡啟用。
 * 這一頁就是把那件事講清楚，而不是讓使用者裝完之後找不到。
 */
@Entry
@Component
struct Index {
  build() {
    Column({ space: 12 }) {
      Text('平注').fontSize(28).fontWeight(FontWeight.Bold)
      Text('注音輸入法').fontSize(14).fontColor('#666666')

      Divider().margin({ top: 16, bottom: 16 })

      Text('啟用方式').fontSize(18).fontWeight(FontWeight.Medium)
      Text('設定 → 系統與更新 → 輸入法 → 更多輸入法設定\n→ 選擇「平注」')
        .fontSize(14)
        .lineHeight(22)
        .textAlign(TextAlign.Center)
        .fontColor('#333333')

      Text('開發者可用 hdc 直接啟用：\nhdc shell ime -e tw.pingzhu.ime')
        .fontSize(12)
        .fontColor('#999999')
        .margin({ top: 12 })
    }
    .width('100%')
    .height('100%')
    .justifyContent(FlexAlign.Center)
    .padding(24)
  }
}
