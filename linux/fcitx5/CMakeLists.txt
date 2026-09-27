# PingZhu for fcitx5.
#
# The engine is the shared Rust core in core-rs/, linked through the C ABI in
# core-rs/include/pingzhu.h. Nothing about decoding lives in this directory —
# it is the glue fcitx5 requires and nothing else.
cmake_minimum_required(VERSION 3.16)
project(pingzhu-fcitx5 VERSION 0.9.0 LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_AUTOMOC OFF)

# GNUInstallDirs is what puts the addon where fcitx5 actually looks.
#
# Installing to `lib/fcitx5` instead of `${CMAKE_INSTALL_LIBDIR}/fcitx5` put the
# file in /usr/lib/fcitx5 on a Debian system, where every existing addon lives in
# /usr/lib/x86_64-linux-gnu/fcitx5. fcitx5-diagnose found the addon's config and
# reported:
#
#   **Cannot find file `pingzhu` of addon `PingZhu`.**
#
# The file existed. It was in a directory the program does not search. That is
# the same failure as the HarmonyOS extension declared in the wrong place, and
# the same one as `/usr/local` never being scanned for addon configs.
include(GNUInstallDirs)

find_package(PkgConfig REQUIRED)
find_package(Fcitx5Core REQUIRED)
find_package(Fcitx5Utils REQUIRED)

# Where core-rs/ lives — found, not counted.
#
# Counting `../` by hand was off by one twice today, in CMake and in an ArkTS
# import, and both times the symptom was "file not found" rather than "wrong
# path". Walking up until the file appears cannot be off by one.
set(PINGZHU_REPO_ROOT "")
set(_probe ${CMAKE_CURRENT_SOURCE_DIR})
foreach(_step RANGE 1 8)
  get_filename_component(_probe ${_probe} DIRECTORY)
  if(EXISTS ${_probe}/core-rs/Cargo.toml)
    set(PINGZHU_REPO_ROOT ${_probe})
    break()
  endif()
endforeach()

if(PINGZHU_REPO_ROOT STREQUAL "")
  message(FATAL_ERROR "Could not find core-rs/Cargo.toml above ${CMAKE_CURRENT_SOURCE_DIR}")
endif()
message(STATUS "pingzhu repository root: ${PINGZHU_REPO_ROOT}")

# The static library, built by cargo. Found in either the plain release
# directory or a cross-compiled one; on Linux the host target is what we want.
set(PINGZHU_CORE_LIB "")
foreach(_candidate
    ${PINGZHU_REPO_ROOT}/core-rs/target/release/libpingzhu_core.a
    ${PINGZHU_REPO_ROOT}/core-rs/target/release/libpingzhu_core.so)
  if(EXISTS ${_candidate})
    set(PINGZHU_CORE_LIB ${_candidate})
    break()
  endif()
endforeach()

if(PINGZHU_CORE_LIB STREQUAL "")
  message(FATAL_ERROR
    "The Rust core is not built. Run:\n"
    "  cargo build --release --manifest-path core-rs/Cargo.toml\n"
    "Rather than link a stub, this stops.")
endif()
message(STATUS "pingzhu core: ${PINGZHU_CORE_LIB}")

# Where the addon looks for the language model at runtime.
set(PINGZHU_DATA_DIR_DEFAULT "${CMAKE_INSTALL_FULL_DATADIR}/pingzhu")

add_library(pingzhu MODULE src/pingzhuengine.cpp)
target_include_directories(pingzhu PRIVATE
  ${PINGZHU_REPO_ROOT}/core-rs/include
  ${CMAKE_CURRENT_SOURCE_DIR}/src)
target_compile_definitions(pingzhu PRIVATE
  PINGZHU_DATA_DIR_DEFAULT="${PINGZHU_DATA_DIR_DEFAULT}")
target_link_libraries(pingzhu PRIVATE Fcitx5::Core Fcitx5::Utils ${PINGZHU_CORE_LIB})

# fcitx5 finds addons by their .conf in the addon directory, and the library in
# the same place. Getting either wrong produces an addon that the configuration
# tool does not list, with no error — which is the same shape as the HarmonyOS
# extension that was declared in the wrong place.
install(TARGETS pingzhu LIBRARY DESTINATION ${CMAKE_INSTALL_LIBDIR}/fcitx5)
# The addon's name is its config file's name, and the InputMethodEntry has to
# agree with it.
#
# This file was pingzhu-addon.conf, so fcitx5 called the addon `pingzhu-addon`;
# the input method entry said its addon was `bopomofo`; and the input method
# config said `Addon=pingzhu`. Three names, none of them matching, and the only
# symptom was:
#
#   Group Item pingzhu in group Default is not valid. Removed.
#
# Which says the input method was removed and not why.
install(FILES pingzhu.conf DESTINATION ${CMAKE_INSTALL_DATADIR}/fcitx5/addon)
install(FILES pingzhu.conf DESTINATION ${CMAKE_INSTALL_DATADIR}/fcitx5/inputmethod)
enable_testing()
add_subdirectory(tests)

install(DIRECTORY ${PINGZHU_REPO_ROOT}/data/
        DESTINATION ${CMAKE_INSTALL_DATADIR}/pingzhu
        FILES_MATCHING PATTERN "*.tsv")
