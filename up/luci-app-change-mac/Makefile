# SPDX-License-Identifier: MIT
#

include $(TOPDIR)/rules.mk

LUCI_NAME:=luci-app-change-mac
PKG_VERSION:=0.0.1
#PKG_RELEASE:=2

LUCI_TITLE:=LuCI for MAC address randomizer
LUCI_DEPENDS:=+bash +getopt

LUCI_DESCRIPTION:=Assign a random MAC address to the designated interface on every time boot.

PKG_LICENSE:=MIT

define Package/$(LUCI_NAME)/conffiles
/etc/config/change-mac
endef

define Package/$(LUCI_NAME)/prerm
endef

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
