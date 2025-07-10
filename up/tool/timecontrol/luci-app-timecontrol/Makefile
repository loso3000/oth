#
# Copyright (C) 2006-2017 OpenWrt.org
# Copyright (C) 2022-2025 sirpdboy <herboy2008@gmail.com>
# This is free software, licensed under the GNU General Public License v2.
# See /LICENSE for more information.
#

include $(TOPDIR)/rules.mk

THEME_NAME:=timecontrol
PKG_NAME:=luci-app-$(THEME_NAME)

PKG_LICENSE:=Apache-2.0

LUCI_TITLE:=LuCI support for timecontrol
LUCI_DESCRIPTION:=LuCI support for timecontrol (Internet time control).
LUCI_DEPENDS:=+bc +bash +timecontrol
LUCI_PKGARCH:=all

PKG_VERSION:=3.0.1
PKG_RELEASE:=20250710
PKG_MAINTAINER:=sirpdboy <herboy2008@gmail.com>

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature

