# SPDX-License-Identifier: MIT
#
# Copyright (C) 2025 by sirpdboy <sirpdboy@qq.com>
include $(TOPDIR)/rules.mk

LUCI_NAME:=luci-app-change-mac
PKG_VERSION:=0.0.2
PKG_RELEASE:=20250806

LUCI_TITLE:=LuCI for MAC address randomizer
LUCI_DEPENDS:=

LUCI_DESCRIPTION:=Assign a random MAC address to the designated interface on every time boot.

PKG_MAINTAINER:=by sirpdboy <sirpdboy@qq.com>
PKG_LICENSE:=MIT

define Package/$(LUCI_NAME)/conffiles
/etc/config/change-mac
endef

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
