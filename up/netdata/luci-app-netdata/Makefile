# SPDX-License-Identifier: GPL-3.0
#
# Copyright (C) 2021-2025  sirpdboy  <herboy2008@gmail.com> https://github.com/sirpdboy/luci-app-netdata
#

include $(TOPDIR)/rules.mk

LUCI_TITLE:=LuCI app for netdata
LUCI_DEPENDS:=+@(netdata||netdata-ssl)
LUCI_PKGARCH:=all

PKG_NAME:=luci-app-netdata
PKG_VERSION:=2.0.1
PKG_RELEASE:=20251029
PKG_MAINTAINER:=sirpdboy <herboy2008@gmail.com>

PKG_LICENSE:=GPL-3.0


define Package/luci-app-netdata/prerm
#!/bin/sh
if [ -z "$${IPKG_INSTROOT}" ]; then
	/etc/init.d/netdata disable >/dev/null 2>&1
	/etc/init.d/netdata stop >/dev/null 2>&1
	
	uci -q batch <<-EOF >/dev/null 2>&1
		delete ucitrack.@netdata[-1]
		commit ucitrack
	EOF
fi
exit 0
endef

define Package/luci-app-netdata/postrm
#!/bin/sh
rm -rf /etc/netdata/
rm -rf /etc/config/netdata
exit 0
endef


include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
