# A smoke test that uses the same C ABI and the same installed data directory the
# addon does. Run with:  ctest --test-dir build
add_executable(engine_smoke engine_smoke.c)
target_include_directories(engine_smoke PRIVATE ${PINGZHU_REPO_ROOT}/core-rs/include)
target_link_libraries(engine_smoke PRIVATE ${PINGZHU_CORE_LIB})

add_test(NAME engine_smoke
         COMMAND engine_smoke ${CMAKE_INSTALL_FULL_DATADIR}/pingzhu)

# The routing table, against the vectors the Windows, macOS and Android suites
# read. Deliberately not linked against fcitx5: routing is plain C++, so a rule
# change is caught by a compiler and a text file rather than by a desktop.
#
# The vectors live in the checkout, not next to the installed addon, so the path
# goes in as an argument — the same arrangement windows/build.sh uses.
add_executable(router_vectors router_vectors.cpp ../src/router.cpp)

add_test(NAME router_vectors
         COMMAND router_vectors ${PINGZHU_REPO_ROOT}/tools/routing-vectors.tsv)

# What the user teaches has to survive the process. This exercises the same
# teach → save → load round trip the addon now performs, so the behaviour has a
# test rather than a promise. The dictionary goes in the build directory: a test
# must not touch the real one under $XDG_DATA_HOME.
add_executable(userdict userdict.c)
target_include_directories(userdict PRIVATE ${PINGZHU_REPO_ROOT}/core-rs/include)
target_link_libraries(userdict PRIVATE ${PINGZHU_CORE_LIB})

add_test(NAME userdict
         COMMAND userdict ${CMAKE_INSTALL_FULL_DATADIR}/pingzhu
                          ${CMAKE_CURRENT_BINARY_DIR}/userdict-test.tsv)

# The output boundary: traditional in, either script out. Before this addon could
# switch, Linux users got traditional only, while every other shell could choose.
add_executable(script script.c)
target_include_directories(script PRIVATE ${PINGZHU_REPO_ROOT}/core-rs/include)
target_link_libraries(script PRIVATE ${PINGZHU_CORE_LIB})

add_test(NAME script COMMAND script ${CMAKE_INSTALL_FULL_DATADIR}/pingzhu)
