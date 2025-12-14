
include $(TOPDIR)/rules.mk

LUCI_TITLE:=LuCI for OTA upgrade
LUCI_PKGARCH:=all

LUCI_DEPENDS:=+jq +curl +gdisk +parted +sgdisk
PKG_VERSION:=2.0.4
PKG_RELEASE:=20251215
PKG_MAINTAINER:=sirpdboy <herboy2008@gmail.com>

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
