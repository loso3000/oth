#
# Copyright (C) 2006-2017 OpenWrt.org#
# Copyright (C) 2022-2025 sirpdboy herboy2008@gmail.com https://github.com/sirpdboy/luci-app-eqosplus
# This is free software, licensed under the GNU General Public License v2.
# See /LICENSE for more information.
#

include $(TOPDIR)/rules.mk

THEME_NAME:=eqosplus
PKG_NAME:=luci-app-$(THEME_NAME)
PKG_VERSION:=2.0.2
PKG_RELEASE:=20251123
PKG_MAINTAINER:=sirpdboy <herboy2008@gmail.com>
PKG_LICENSE:=Apache-2.0

LUCI_TITLE:=LuCI support for eqosplus.
LUCI_DEPENDS:=+eqosplus +luci-compat
LUCI_PKGARCH:=all

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature

