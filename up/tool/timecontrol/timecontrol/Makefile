#
# Copyright (C) 2025 sirpdboy herboy2008@gmail.com https://github.com/sirpdboy/luci-app-timecontrol
# This is free software, licensed under the GNU General Public License v2.
# See /LICENSE for more information.

include $(TOPDIR)/rules.mk

PKG_NAME:=timecontrol
PKG_VERSION:=1
PKG_RELEASE:=4

include $(INCLUDE_DIR)/package.mk

define Package/$(PKG_NAME)
	SECTION:=utils
	CATEGORY:=Utilities
	TITLE:=LuCI support for timecontrol (Internet time control).
	DEPENDS:=+curl +bash
endef

define Package/$(PKG_NAME)/description
	LuCI support for timecontrol (Internet time control).  @sirpdboy  <herboy2008@gmail.com>
endef

define Build/Compile
endef

define Package/$(PKG_NAME)/conffiles
/etc/config/timecontrol
endef

define Package/$(PKG_NAME)/install
	$(INSTALL_DIR) $(1)/etc/config
	$(CP) ./files/timecontrol.config $(1)/etc/config/timecontrol
	$(INSTALL_DIR) $(1)/etc/init.d
	$(INSTALL_BIN) $(CURDIR)/files/timecontrol.init $(1)/etc/init.d/timecontrol
	$(INSTALL_DIR) $(1)/usr/bin
	$(INSTALL_BIN) $(CURDIR)/files/timecontrol.bin $(1)/usr/bin/timecontrol
	$(INSTALL_BIN) $(CURDIR)/files/timecontrolctrl.bin $(1)/usr/bin/timecontrolctrl
	$(INSTALL_DIR) $(1)/usr/libexec
	$(INSTALL_BIN) $(CURDIR)/files/timecontrol-call.libexec $(1)/usr/libexec/timecontrol-call
endef

$(eval $(call BuildPackage,$(PKG_NAME)))
