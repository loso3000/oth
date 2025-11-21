#
# Copyright (C) 2022-2025 sirpdboy herboy2008@gmail.com https://github.com/sirpdboy/luci-app-eqosplus
# This is free software, licensed under the GNU General Public License v2.
# See /LICENSE for more information.

include $(TOPDIR)/rules.mk

PKG_NAME:=eqosplus
PKG_VERSION:=2.0.1
PKG_RELEASE:=20251121

include $(INCLUDE_DIR)/package.mk

define Package/$(PKG_NAME)
	SECTION:=utils
	CATEGORY:=Utilities
	TITLE:=Routing Security eqosplus for OpenWrt
	DEPENDS:=+bash +ip-full +tc +kmod-sched-core +kmod-sched-connmark +kmod-ifb +nftables +kmod-sched-htb +kmod-sched-ingress +kmod-act-mirred +bc
endef

define Package/$(PKG_NAME)/description
	Routing Security eqosplus for OpenWrt  @sirpdboy  <herboy2008@gmail.com>
endef

define Package/$(PKG_NAME)/conffiles
/etc/config/eqosplus
endef

define Package/$(PKG_NAME)/install
	$(INSTALL_DIR) $(1)/etc/config
	$(CP) ./files/eqosplus.config $(1)/etc/config/eqosplus
	$(INSTALL_DIR) $(1)/etc/init.d
	$(INSTALL_BIN) $(CURDIR)/files/eqosplus.init $(1)/etc/init.d/eqosplus
	$(INSTALL_DIR) $(1)/usr/libexec
	$(INSTALL_BIN) $(CURDIR)/files/eqosplus-call.libexec $(1)/usr/libexec/eqosplus-call
	$(INSTALL_DIR) $(1)/usr/bin/eqosplus
	$(INSTALL_BIN) $(CURDIR)/files/eqosplus.bin $(1)/usr/bin/eqosplus
	$(INSTALL_DIR) $(1)/etc/hotplug.d/iface
	$(INSTALL_BIN) $(CURDIR)/files/10-eqosplus.iface $(1)/etc/hotplug.d/iface/10-eqosplus
	
endef

$(eval $(call BuildPackage,$(PKG_NAME)))
