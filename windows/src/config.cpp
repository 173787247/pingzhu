#include "config.h"

#include <windows.h>

#include <cstdio>
#include <cstring>
#include <vector>

#include "data_dir.h"

namespace pingzhu {
namespace {

const wchar_t *kFileName = L"pingzhu.ini";

std::string readFile(const std::wstring &path) {
    FILE *file = _wfopen(path.c_str(), L"rb");
    if (!file) return "";
    std::string out;
    char buffer[4096];
    size_t got;
    while ((got = fread(buffer, 1, sizeof(buffer), file)) > 0) {
        out.append(buffer, got);
    }
    fclose(file);
    return out;
}

std::string trim(const std::string &s) {
    size_t begin = s.find_first_not_of(" \t\r\n");
    if (begin == std::string::npos) return "";
    size_t end = s.find_last_not_of(" \t\r\n");
    return s.substr(begin, end - begin + 1);
}

const char *kDefaultFile =
    "# 平注 PingZhu 設定\r\n"
    "#\r\n"
    "# 這個檔案跟 pingzhu-tsf-*.dll / pingzhu-ime.exe 放在一起。\r\n"
    "# 改完存檔，下次切換輸入法（或重新執行）就會生效。\r\n"
    "\r\n"
    "# 輸出字形：traditional（繁體）或 simplified（簡體）\r\n"
    "# 輸入的注音與詞庫不受影響，只改變送出的字。\r\n"
    "output = traditional\r\n";

std::wstring configPath(const std::wstring &moduleDir) {
    return moduleDir + L"\\" + kFileName;
}

}  // namespace

std::string configValue(const std::string &text, const std::string &key) {
    size_t pos = 0;
    while (pos <= text.size()) {
        size_t end = text.find('\n', pos);
        if (end == std::string::npos) end = text.size();
        std::string line = trim(text.substr(pos, end - pos));
        pos = end + 1;
        if (line.empty() || line[0] == '#' || line[0] == ';') continue;
        size_t equals = line.find('=');
        if (equals == std::string::npos) continue;
        if (trim(line.substr(0, equals)) == key) return trim(line.substr(equals + 1));
    }
    return "";
}

Config loadConfig(const std::wstring &moduleDir) {
    Config config;
    config.path = configPath(moduleDir);
    const std::string text = readFile(config.path);
    if (text.empty()) return config;
    const std::string output = configValue(text, "output");
    /* Only accept the two known values. An unrecognised one leaves the default
     * in place rather than reaching the engine, which would reject it anyway and
     * leave the user with no idea why their edit did nothing. */
    if (output == "traditional" || output == "simplified") config.output = output;
    const std::string x = configValue(text, "status_x");
    const std::string y = configValue(text, "status_y");
    if (!x.empty() && !y.empty()) {
        try {
            config.statusX = std::stoi(x);
            config.statusY = std::stoi(y);
        } catch (...) {
            /* A hand-edited file with a typo must not stop the input method; the
             * button simply falls back to its default corner. */
        }
    }
    return config;
}

void writeDefaultConfigIfMissing(const std::wstring &moduleDir) {
    const std::wstring path = configPath(moduleDir);
    if (GetFileAttributesW(path.c_str()) != INVALID_FILE_ATTRIBUTES) return;
    FILE *file = _wfopen(path.c_str(), L"wb");
    if (!file) return;
    fwrite(kDefaultFile, 1, strlen(kDefaultFile), file);
    fclose(file);
}

bool saveOutputScript(const std::wstring &moduleDir, const std::string &script) {
    if (script != "traditional" && script != "simplified") return false;
    const std::wstring path = configPath(moduleDir);

    std::string text = readFile(path);
    std::string replacement = "output = " + script;
    std::string out;
    bool replaced = false;
    size_t pos = 0;
    while (pos <= text.size()) {
        size_t end = text.find('\n', pos);
        if (end == std::string::npos) end = text.size();
        std::string line = text.substr(pos, end - pos);
        std::string trimmed = trim(line);
        if (!replaced && !trimmed.empty() && trimmed[0] != '#' && trimmed[0] != ';') {
            size_t equals = trimmed.find('=');
            if (equals != std::string::npos && trim(trimmed.substr(0, equals)) == "output") {
                out += replacement + "\r\n";
                replaced = true;
                pos = end + 1;
                continue;
            }
        }
        if (end < text.size()) {
            out += line + "\r\n";
        } else if (!line.empty()) {
            out += line;
        }
        pos = end + 1;
    }
    if (!replaced) out += replacement + "\r\n";

    FILE *file = _wfopen(path.c_str(), L"wb");
    if (!file) return false;
    fwrite(out.data(), 1, out.size(), file);
    fclose(file);
    return true;
}

bool saveStatusPosition(const std::wstring &moduleDir, int x, int y) {
    const std::wstring path = configPath(moduleDir);
    std::string text = readFile(path);

    auto replaceKey = [](const std::string &input, const std::string &key,
                         const std::string &value) {
        std::string out;
        bool replaced = false;
        size_t pos = 0;
        while (pos <= input.size()) {
            size_t end = input.find('\n', pos);
            if (end == std::string::npos) end = input.size();
            const std::string line = input.substr(pos, end - pos);
            const std::string trimmed = trim(line);
            if (!replaced && !trimmed.empty() && trimmed[0] != '#' && trimmed[0] != ';') {
                const size_t equals = trimmed.find('=');
                if (equals != std::string::npos && trim(trimmed.substr(0, equals)) == key) {
                    out += key + " = " + value + "\r\n";
                    replaced = true;
                    pos = end + 1;
                    continue;
                }
            }
            if (end < input.size()) {
                out += line + "\r\n";
            } else if (!line.empty()) {
                out += line;
            }
            pos = end + 1;
        }
        if (!replaced) out += key + " = " + value + "\r\n";
        return out;
    };

    text = replaceKey(text, "status_x", std::to_string(x));
    text = replaceKey(text, "status_y", std::to_string(y));

    FILE *file = _wfopen(path.c_str(), L"wb");
    if (!file) return false;
    fwrite(text.data(), 1, text.size(), file);
    fclose(file);
    return true;
}

}  // namespace pingzhu
