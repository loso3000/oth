# SPDX-License-Identifier: GPL-3.0
#
# Copyright (C) 2021-2025  sirpdboy  <herboy2008@gmail.com> https://github.com/sirpdboy/luci-app-netdata
#
# This is free software, licensed under the Apache License, Version 2.0 .

include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-netdata
PKG_VERSION:=2.0.1
PKG_RELEASE:=20251029

LUCI_TITLE:=LuCI app for netdata
LUCI_PKGARCH:=all
LUCI_DEPENDS:=+netdata
LUCI_DESCRIPTION:=LuCI support for netdata

define Package/$(PKG_NAME)/conffiles
/etc/config/netdata
/etc/netdata/
endef

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
