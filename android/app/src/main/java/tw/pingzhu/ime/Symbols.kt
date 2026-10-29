package tw.pingzhu.ime

/**
 * The punctuation page.
 *
 * The 大千式 board has no room for punctuation: every key is a reading, `,` is ㄝ,
 * and the function row was full. On a desktop that is fine — Shift+, goes straight
 * to the application, because a key the router does not recognise is passed
 * through. A phone has no Shift key, so before this page an Android user could not
 * type a comma at all without switching to the English board first.
 *
 * Full-width, because that is what a Chinese sentence uses. Grouped by how often
 * they are reached for, not by Unicode order.
 *
 * Some shells have a single `，` key instead (HarmonyOS does). A page is what a
 * phone board can afford: the whole keyboard area, no permanent space taken.
 */
object Symbols {
    val ROWS: List<List<String>> = listOf(
        listOf("，", "。", "、", "；", "：", "？", "！"),
        listOf("「", "」", "『", "』", "（", "）", "《", "》"),
        listOf("【", "】", "〈", "〉", "…", "—", "～", "·"),
        listOf("／", "＼", "＃", "＄", "％", "＆", "＊", "＋"),
        listOf("－", "＝", "＠", "＿", "｜", "＾"),
    )
}
