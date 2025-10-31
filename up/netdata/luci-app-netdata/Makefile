# SPDX-License-Identifier: GPL-3.0
#
# Copyright (C) 2021-2025  sirpdboy  <herboy2008@gmail.com> https://github.com/sirpdboy/luci-app-netdata
#
# This is free software, licensed under the Apache License, Version 2.0 .

include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-netdata
PKG_VERSION:=2.0.1
PKG_RELEASE:=20251029
PKG_MAINTAINER:=<https://github.com/sirpdboy/luci-app-netdata>
PKG_LICENSE:=GPL-3.0

LUCI_TITLE:=LuCI app for netdata
LUCI_PKGARCH:=all
LUCI_DEPENDS:=+netdata
LUCI_DESCRIPTION:=LuCI support for netdata

define Package/$(PKG_NAME)/preinst
#!/bin/sh
	uci -q batch <<-EOF >/dev/null 2>&1
		delete ucitrack.@netdata[-1]
		add ucitrack netdata
		set ucitrack.@netdata[-1].init=netdata
		commit ucitrack
EOF
rm -f /tmp/luci*
exit 0
endef

define Package/$(PKG_NAME)/prerm
#!/bin/sh
if [ -z "$${IPKG_INSTROOT}" ]; then
     /etc/init.d/netdata disable
     /etc/init.d/netdata stop
uci -q batch <<-EOF >/dev/null 2>&1
	delete ucitrack.@netdata[-1]
	commit ucitrack
EOF
fi
exit 0
endef

define Package/$(PKG_NAME)/postrm
#!/bin/sh
rm -rf /etc/netdata/
rm -rf /etc/config/netdata
exit 0
endef

define Package/$(PKG_NAME)/conffiles
/etc/config/netdata
/etc/netdata/
endef

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
