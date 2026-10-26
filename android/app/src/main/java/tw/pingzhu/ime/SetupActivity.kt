package tw.pingzhu.ime

import android.app.Activity
import android.content.Intent
import android.graphics.Typeface
import android.os.Bundle
import android.provider.Settings
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.AdapterView
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.Spinner
import android.widget.TextView
import android.widget.Toast
import android.view.inputmethod.InputMethodManager

/**
 * The screen that gets the user from "installed" to "typing".
 *
 * Android will not let an input method enable itself, and the two switches that
 * matter — turn it on, select it — live three levels deep in Settings. An app
 * that does not offer a route to them leaves the user to find them, and the
 * usual result is an input method that never gets used.
 */
class SetupActivity : Activity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val column = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(24f), dp(32f), dp(24f), dp(32f))
        }
        column.addView(title(getString(R.string.app_name)))
        column.addView(body(getString(R.string.setup_intro)))

        // A field to try it in. Without one, "enable the input method" is an
        // instruction with nothing to try it on — the user has to leave the app,
        // find somewhere to type, and come back if it did not work.
        column.addView(title(getString(R.string.setup_try)))
        column.addView(
            EditText(this).apply {
                hint = getString(R.string.setup_try_hint)
                setSingleLine(false)
                minLines = 2
                setTextSize(18f)
                layoutParams = LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT,
                ).apply { topMargin = dp(6f) }
            },
        )

        column.addView(
            button(getString(R.string.setup_enable)) {
                startActivity(Intent(Settings.ACTION_INPUT_METHOD_SETTINGS))
            },
        )
        column.addView(
            button(getString(R.string.setup_select)) {
                val manager = getSystemService(INPUT_METHOD_SERVICE) as InputMethodManager
                manager.showInputMethodPicker()
            },
        )

        column.addView(title(getString(R.string.setup_how)))
        column.addView(body(getString(R.string.setup_how_body)))

        column.addView(title(getString(R.string.setup_script)))
        column.addView(body(getString(R.string.setup_script_body)))
        column.addView(
            button(scriptButtonLabel()) {
                val next = if (script() == "simplified") "traditional" else "simplified"
                prefs().edit().putString(PingZhuImeService.KEY_SCRIPT, next).apply()
                Toast.makeText(this, scriptButtonLabel(), Toast.LENGTH_SHORT).show()
                recreate()
            },
        )

        // The layout, beside the script: both are engine-wide choices a user may
        // want on a phone, and both need a restart to take effect.
        column.addView(title(getString(R.string.setup_layout)))
        column.addView(body(getString(R.string.setup_layout_body)))
        val layoutIds = arrayOf("standard", "eten", "hsu", "eten26", "ibm", "ginyieh", "mitac")
        val layoutLabels = arrayOf(
            R.string.layout_standard, R.string.layout_eten, R.string.layout_hsu,
            R.string.layout_eten26, R.string.layout_ibm, R.string.layout_ginyieh,
            R.string.layout_mitac,
        ).map { getString(it) }
        column.addView(
            Spinner(this).apply {
                adapter = ArrayAdapter(
                    this@SetupActivity,
                    android.R.layout.simple_spinner_item,
                    layoutLabels,
                ).apply { setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item) }
                val current = prefs().getString(PingZhuImeService.KEY_LAYOUT, "standard")
                setSelection(layoutIds.indexOf(current).coerceAtLeast(0))
                onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
                    override fun onItemSelected(
                        parent: AdapterView<*>?,
                        view: View?,
                        position: Int,
                        id: Long,
                    ) {
                        val chosen = layoutIds[position]
                        if (chosen == prefs().getString(PingZhuImeService.KEY_LAYOUT, "standard")) return
                        prefs().edit().putString(PingZhuImeService.KEY_LAYOUT, chosen).apply()
                        Toast.makeText(
                            this@SetupActivity,
                            getString(R.string.setup_layout_saved, layoutLabels[position]),
                            Toast.LENGTH_SHORT,
                        ).show()
                    }

                    override fun onNothingSelected(parent: AdapterView<*>?) = Unit
                }
            },
        )

        setContentView(ScrollView(this).apply { addView(column) })
    }

    private fun prefs() = getSharedPreferences("pingzhu", MODE_PRIVATE)

    private fun script() = prefs().getString(PingZhuImeService.KEY_SCRIPT, "traditional")

    private fun scriptButtonLabel(): String =
        if (script() == "simplified") getString(R.string.script_current_simplified)
        else getString(R.string.script_current_traditional)

    private fun dp(value: Float) = (value * resources.displayMetrics.density).toInt()

    private fun title(text: String) = TextView(this).apply {
        this.text = text
        textSize = 19f
        setTypeface(Typeface.DEFAULT_BOLD)
        setTextColor(0xFF1A1D22.toInt())
        setPadding(0, dp(20f), 0, dp(6f))
    }

    private fun body(text: String) = TextView(this).apply {
        this.text = text
        textSize = 14f
        setTextColor(0xFF4A5058.toInt())
        setLineSpacing(dp(4f).toFloat(), 1f)
    }

    private fun button(label: String, onClick: () -> Unit) = Button(this).apply {
        text = label
        gravity = Gravity.CENTER
        setOnClickListener { onClick() }
        layoutParams = LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT,
        ).apply { topMargin = dp(10f) }
    }
}
