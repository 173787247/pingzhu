import java.util.Properties

// 平注 PingZhu — Android IME shell.
//
// The keyboard, the decoder and the language model are shared with the desktop
// shells through the Rust core; this module only knows how to be an Android
// input method.

plugins {
    id("com.android.application") version "8.5.2"
    id("org.jetbrains.kotlin.android") version "2.0.20"
}

/*
 * Release signing.
 *
 * Read from a gitignored properties file rather than written here: the keystore
 * and its password are the one thing in an Android project that must not be
 * committed, because anyone who has them can publish an update that every
 * installed device will accept.
 *
 * Without the file the build still works — it produces an unsigned release,
 * which is exactly what a CI machine that has no business signing anything
 * should produce.
 */
val keystoreProperties = Properties().apply {
    val file = rootProject.file("keystore.properties")
    if (file.exists()) file.inputStream().use { load(it) }
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
        versionCode = 4
        versionName = "0.10.2"

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

    signingConfigs {
        if (keystoreProperties.getProperty("storeFile") != null) {
            create("release") {
                storeFile = rootProject.file(keystoreProperties.getProperty("storeFile"))
                storePassword = keystoreProperties.getProperty("storePassword")
                keyAlias = keystoreProperties.getProperty("keyAlias")
                keyPassword = keystoreProperties.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            if (keystoreProperties.getProperty("storeFile") != null) {
                signingConfig = signingConfigs.getByName("release")
            }
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
