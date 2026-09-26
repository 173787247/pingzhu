//! Micro-benchmark: how fast is a keystroke?
//!
//! Deliberately measures the same thing the TypeScript reference does — feed a
//! key, let the engine decode the whole buffer — so the two numbers are
//! comparable. Run with `cargo run --release --example bench`.

use std::path::PathBuf;
use std::time::Instant;

use pingzhu_core::{build_syllable_inventory, Dictionary, EngineOptions, InputEngine};

fn main() {
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("..");
    let lm = root.join("data/bopomofo-lm.tsv");

    let t0 = Instant::now();
    let dict = Dictionary::load(&lm).expect("language model");
    let inventory = build_syllable_inventory(&lm).expect("inventory");
    let load_ms = t0.elapsed().as_secs_f64() * 1000.0;

    println!("entries     {}", dict.size());
    println!("syllables   {}", inventory.len());
    println!("load        {load_ms:.0} ms");

    let cases = [
        "su3cl3",
        "ji394su3",
        "w96j0",
        "rupwu0",
        "g4",
        "au04",
        "5j4",
        "vm,6",
        "ej0",
        "su3cl3ji394su3w96j0",
    ];

    let mut engine = InputEngine::new(dict, inventory, EngineOptions::default());

    // warm up so the first-call cost does not land in the measurement
    for c in &cases {
        engine.reset();
        engine.press_str(c);
    }

    let iterations = 2000usize;
    let mut keys = 0usize;
    let t1 = Instant::now();
    for i in 0..iterations {
        engine.reset();
        let c = cases[i % cases.len()];
        engine.press_str(c);
        keys += c.chars().count();
    }
    let elapsed = t1.elapsed();

    let per_key_us = elapsed.as_secs_f64() * 1e6 / keys as f64;
    println!(
        "keystrokes  {keys}  in {:.0} ms",
        elapsed.as_secs_f64() * 1000.0
    );
    println!("per key     {per_key_us:.3} µs");
    println!("throughput  {:.0} keys/s", keys as f64 / elapsed.as_secs_f64());
}
