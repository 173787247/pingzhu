// 平注 PingZhu — Android IME shell.
//
// The keyboard, the decoder and the language model are shared with the desktop
// shells through the Rust core; this module only knows how to be an Android
// input method.

plugins {
    id("com.android.application") version "8.5.2"
    id("org.jetbrains.kotlin.android") version "2.0.20"
}

android {
    namespace = "tw.pingzhu.ime"
    compileSdk = 34

    defaultConfig {
        applicationId = "tw.pingzhu.ime"
        // Android 8.0. The engine is a native library with no platform
        // dependencies, so there is nothing to gain from a higher floor.
        minSdk = 26
        targetSdk = 34
        versionCode = 1
        versionName = "0.8.0"

        ndk {
            // 64-bit only. Every device that can run an input method today is
            // 64-bit, and each extra ABI is another library to build, sign and
            // get wrong.
            abiFilters += listOf("arm64-v8a", "x86_64")
        }
    }

    sourceSets {
        getByName("main") {
            // The language model is an asset, not a resource: it is read as a
            // file by the engine, and Android's resource system would rewrite it.
            assets.srcDirs("src/main/assets")
            jniLibs.srcDirs("src/main/jniLibs")
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            // Signed with the debug key so a release build can be produced
            // without a keystore. Replace before publishing anywhere.
            signingConfig = signingConfigs.getByName("debug")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}

/**
 * Copies the language model in from `data/`.
 *
 * Not committed under `android/`: the model is already in the repository once,
 * and a second 6.4 MB copy would be one more thing to keep in step — the kind
 * that stays stale until someone notices the two platforms disagree.
 */
val copyEngineData by tasks.registering(Copy::class) {
    from(rootProject.file("../data/bopomofo-lm.tsv"))
    from(rootProject.file("../data/ts-conversion.tsv"))
    into(layout.projectDirectory.dir("src/main/assets"))
}

tasks.named("preBuild") { dependsOn(copyEngineData) }

dependencies {
    testImplementation("junit:junit:4.13.2")
}
