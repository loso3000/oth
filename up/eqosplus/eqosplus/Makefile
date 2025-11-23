#
# Copyright (C) 2022-2025 sirpdboy herboy2008@gmail.com https://github.com/sirpdboy/luci-app-eqosplus
# This is free software, licensed under the GNU General Public License v2.
# See /LICENSE for more information.

include $(TOPDIR)/rules.mk

PKG_NAME:=eqosplus
PKG_VERSION:=2.0.2
PKG_RELEASE:=20251123

PKG_MAINTAINER:=sirpdboy <herboy2008@gmail.com>
PKG_LICENSE:=Apache-2.0

include $(INCLUDE_DIR)/package.mk

define Package/eqosplus
  SECTION:=net
  CATEGORY:=Network
  TITLE:=EQoS Plus - Network Speed Limit
  DEPENDS:=+ip-full +tc +nftables +bc
  PKGARCH:=all
endef

define Package/eqosplus/description
  Users can limit the network speed for uploading/downloading through MAC, IP.
  The speed unit is MB/second.
endef

define Package/$(PKG_NAME)/conffiles
/etc/config/eqosplus
endef

define Package/eqosplus/install
	$(INSTALL_DIR) $(1)/usr/bin
	$(INSTALL_DIR) $(1)/etc/config
	$(INSTALL_DIR) $(1)/etc/init.d
	$(INSTALL_DIR) $(1)/usr/libexec
	$(INSTALL_DIR) $(1)/etc/hotplug.d/iface
	$(INSTALL_BIN) $(CURDIR)/files/eqosplusctl.bin $(1)/usr/bin/eqosplusctl
	$(INSTALL_BIN) $(CURDIR)/files/eqosplus.init $(1)/etc/init.d/eqosplus
	$(CP) ./files/eqosplus.config $(1)/etc/config/eqosplus
	$(INSTALL_BIN) $(CURDIR)/files/eqosplus-call.libexec $(1)/usr/libexec/eqosplus-call
	$(INSTALL_BIN) $(CURDIR)/files/10-eqosplus.iface $(1)/etc/hotplug.d/iface/10-eqosplus

endef

$(eval $(call BuildPackage,eqosplus))