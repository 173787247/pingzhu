Name:           fcitx5-pingzhu
Version:        0.10.2
Release:        1%{?dist}
Summary:        PingZhu (平注) Bopomofo input method engine for fcitx5
License:        MIT and Apache-2.0
URL:            https://gitcode.com/grandocean/pingzhu
Source0:        %{name}-%{version}.tar.gz

BuildRequires:  cmake, gcc-c++, pkgconfig, fcitx5-devel, extra-cmake-modules, gettext
BuildRequires:  rust >= 1.77, cargo
Requires:       fcitx5

%description
PingZhu is an open-source cross-platform Bopomofo (Zhuyin) IME engine.
This package provides the fcitx5 addon, its input method definition and the
engine data for fcitx5-based distributions (openEuler, UOS, Kylin, deepin, ...).

%prep
%autosetup -n %{name}-%{version}

%build
cargo build --release --manifest-path core-rs/Cargo.toml
cmake -S linux/fcitx5 -B build-rpm -DCMAKE_BUILD_TYPE=Release -DCMAKE_INSTALL_PREFIX=%{_prefix}
cmake --build build-rpm -- -j%{?_smp_mflags}

%install
DESTDIR=%{buildroot} cmake --install build-rpm

%files
%{_libdir}/fcitx5/libpingzhu.so
%{_datadir}/fcitx5/addon/pingzhu.conf
%{_datadir}/fcitx5/inputmethod/pingzhu.conf
%{_datadir}/fcitx5/pingzhu
%doc NOTICE LICENSES/MIT.txt LICENSES/Apache-2.0.txt
