include $(TOPDIR)/rules.mk

PKG_NAME:=istoreos-files
PKG_VERSION:=1.0
PKG_RELEASE:=$(COMMITCOUNT)
PKG_FLAGS:=hold essential nonshared

PKG_LICENSE:=CC0-1.0
PKG_MAINTAINER:=jjm2473 <jjm2473@gmail.com>

include $(INCLUDE_DIR)/package.mk

define Package/$(PKG_NAME)
  SECTION:=base
  CATEGORY:=Base system
  TITLE:=iStoreOS files
  MAINTAINER:=jjm2473 <jjm2473@gmail.com>
  DEPENDS:= \
    +luci-app-partexp \
    +block-mount \
    +e2fsprogs \
    +USB_SUPPORT:kmod-usb-storage \
    +USB_SUPPORT:kmod-usb-storage-extras \
    +(!TARGET_ramips&&USB_SUPPORT):kmod-usb-storage-uas \
    +kmod-fs-ext4 \
    +kmod-fs-exfat \
    +kmod-fs-vfat \
    +ntfs3-mount +wsdd2 +ntfsprogs
  PKGARCH:=all
endef

define Package/$(PKG_NAME)/description
 The iStoreOS.
endef



define Build/Prepare
	mkdir -p $(PKG_BUILD_DIR)
endef

define Build/Compile/Default

endef
Build/Compile = $(Build/Compile/Default)

define Package/$(PKG_NAME)/install
	$(CP) ./files/* $(1)/
endef

define Package/$(PKG_NAME)/postinst
#!/bin/sh

HOST_SED="$(subst ${STAGING_DIR_HOST},$${STAGING_DIR_HOST},$(SED))"
HOST_LN="$(subst ${STAGING_DIR_HOST},$${STAGING_DIR_HOST},$(LN))"

[ -n "$${IPKG_INSTROOT}" ] && {
	$${HOST_SED} 's,^src/gz ezopwrt_,src/gz openwrt_,g' -e '/^src\/gz openwrt_\(core\|base\|kmods\|luci\|packages\|routing\|telephony\) /!d' "$${IPKG_INSTROOT}/etc/opkg/distfeeds.conf"

	$${HOST_SED} 's/"192.168.1.1"/"192.168.10.1"/' \
		"$${IPKG_INSTROOT}/bin/config_generate"
	$${HOST_SED} "s/'192\\.168\\.1\\.1'/'192.168.10.1'/; s/'immortalwrt\\.lan'/window.location.host/" "$${IPKG_INSTROOT}/www/luci-static/resources/view/system/flash.js"

}
true

endef


$(eval $(call BuildPackage,istoreos-files))
