#
# Copyright (C) 2019-2025 The Sirpdboy Team <herboy2008@gmail.com>    
#
# This is free software, licensed under the Apache License, Version 2.0 .
#
include $(TOPDIR)/rules.mk

LUCI_TITLE:=LuCI for OTA upgrade
LUCI_PKGARCH:=all

LUCI_DEPENDS:=+jq +curl +gdisk +parted +sgdisk
PKG_VERSION:=2.0.9
PKG_RELEASE:=20251228
PKG_MAINTAINER:=sirpdboy <herboy2008@gmail.com>

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
