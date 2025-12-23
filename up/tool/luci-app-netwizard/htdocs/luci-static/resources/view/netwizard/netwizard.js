'use strict';
'require view';
'require form';
'require network';
'require uci';
'require validation';
'require rpc';
'require fs';
'require dom';
'require poll';
'require tools.widgets as widgets';

return view.extend({

	load: function() {
		return Promise.all([
			fs.exec('/etc/init.d/netwizard', ['reconfig']),
			network.getDevices(),
			uci.changes(),
			L.resolveDefault(uci.load('wireless'), null),
			uci.load('network'),
			uci.load('netwizard')
		]);
	},

	render: function(data) {
		var devices = data[1] || []; // 使用 network.getDevices() 获取的网卡列表
		var has_wifi = false;
		var m, o, s;

		try {
			var wirelessSections = uci.sections('wireless', 'wifi-device');
			if (wirelessSections && wirelessSections.length > 0) {
				has_wifi = true;
			} else {
				var wifiIfaces = uci.sections('wireless', 'wifi-iface');
				if (wifiIfaces && wifiIfaces.length > 0) {
					has_wifi = true;
				}
			}
		} catch (e) {
			has_wifi = false;
		}

		var physicalIfaces = 0;
		var physicalInterfaces = [];
		
		for (var i = 0; i < devices.length; i++) {
			var iface = devices[i].getName();
			if (!iface.match(/_ifb$/) && !iface.match(/^ifb/) && 
				!iface.match(/^veth/) && !iface.match(/^tun/) &&
				!iface.match(/^tap/) && !iface.match(/^gre/) &&
				!iface.match(/^gretap/) && !iface.match(/^lo$/) &&
				!iface.match(/^br-/) &&
				(iface.match(/^(eth|en|usb)/) || iface.match(/^wlan|^wl/))) {
				
				physicalIfaces++;
				physicalInterfaces.push(iface);
			}
		}

		var lan_gateway = uci.get('netwizard', 'default', 'lan_gateway') ;
		var lan_ip = uci.get('netwizard', 'default', 'lan_ip') ;
		var lan_proto = uci.get('netwizard', 'default', 'lan_proto') ;
		var lan_dhcp_enabled = (uci.get('dhcp', 'lan', 'ignore') === '0') ? true : false;
		var wan_face = uci.get('netwizard', 'default', 'wan_interface') ;
		var wanproto = uci.get('netwizard', 'default', 'wan_proto');
		if (physicalIfaces <= 1) {
			wanproto = 'siderouter';
			uci.set('netwizard', 'default', 'wan_proto', 'siderouter');
			uci.save();
		}

		if (!lan_ip) {
			lan_ip = uci.get('network', 'lan', 'ipaddr');
		}
		if (!lan_gateway && lan_ip) {
			var parts = lan_ip.split('.');
			if (parts.length === 4) {
				lan_gateway = parts[0] + '.' + parts[1] + '.' + parts[2] + '.';
			}
		}
		
		if (!wan_face) {
			wan_face = uci.get('network', 'wan', 'device') || uci.get('network', 'wan', 'ifname') || '';
		}
		

		if (!wanproto) {
			wanproto = uci.get('network', 'wan', 'proto') || 'siderouter';
		}
		
		m = new form.Map('netwizard', [_('Quick Network Setup Wizard')],
			_('Quick network setup wizard. If you need more settings, please enter network - interface to set.'));
		s = m.section(form.NamedSection, 'default', 'netwizard');
		s.addremove = false;
		s.anonymous = true;

		s.tab('wansetup', _('Wan Settings'));
		if (has_wifi) {
			s.tab('wifisetup', _('Wireless Settings'), _('Set the router\'s wireless name and password. For more advanced settings, please go to the Network-Wireless page.'));
		}
		s.tab('othersetup', _('Other setting'));

		// WAN Setup Tab
		o = s.taboption('wansetup', form.ListValue, 'wan_proto', _('Network protocol mode selection'), 
			_('Four different ways to access the Internet, please choose according to your own situation.</br>'));
		o.default = wanproto;
		o.value('dhcp', _('DHCP client(Connect to the router)'));
		o.value('pppoe', _('PPPoE dialing(Main route dial-up)'));
		o.value('siderouter', _('SideRouter(Same network as the main router)'));
		o.value('static', _('Static address(Connect to the router)'));
		o.rmempty = false;
		

		// LAN Settings for SideRouter mode
		o = s.taboption('wansetup', form.ListValue, 'lan_proto', _('LAN IP address mode'), 
			_('Choose how to get IP address for LAN interface'));
		o.default = 'static';
		o.value('static', _('Static IP address(Specify non conflicting IP addresses)'));
		o.value('dhcp', _('DHCP client(Main router assigns IP)'));
		o.depends('wan_proto', 'siderouter');
		o.rmempty = false;

		o = s.taboption('wansetup', form.Value, 'lan_ipaddr', _('Lan IPv4 address'), 
			_('You must specify the IP address of this machine, which is the IP address of the web access route'));
		o.default = lan_ip;
		o.datatype = 'ip4addr';
		o.rmempty = false;
		o.depends('wan_proto', 'pppoe');
		o.depends('wan_proto', 'dhcp');
		o.depends('wan_proto', 'static');
		o.depends({'wan_proto': 'siderouter', 'lan_proto': 'static'});

		o = s.taboption('wansetup', form.Value, 'lan_netmask', _('Lan IPv4 netmask'));
		o.datatype = 'ip4addr';
		o.value('255.255.255.0');
		o.value('255.255.0.0');
		o.value('255.0.0.0');
		o.default = '255.255.255.0';
		o.depends({'wan_proto': 'siderouter', 'lan_proto': 'static'});
		o.depends('wan_proto', 'pppoe');
		o.depends('wan_proto', 'dhcp');
		o.depends('wan_proto', 'static');
		o.rmempty = false;

		o = s.taboption('wansetup', form.Value, 'lan_gateway', _('Lan IPv4 gateway'), 
			_('Please enter the main routing IP address. The bypass gateway is not the same as the login IP of this bypass WEB and is in the same network segment'));
		o.default = lan_gateway;
		o.depends({'wan_proto': 'siderouter', 'lan_proto': 'static'});
		o.datatype = 'ip4addr';
		o.rmempty = false;

		o = s.taboption('wansetup', form.DynamicList, 'lan_dns', _('Use custom Siderouter DNS'));
		o.value('223.5.5.5', _('Ali DNS:223.5.5.5'));
		o.value('180.76.76.76', _('Baidu dns:180.76.76.76'));
		o.value('114.114.114.114', _('114 DNS:114.114.114.114'));
		o.value('8.8.8.8', _('Google DNS:8.8.8.8'));
		o.value('1.1.1.1', _('Cloudflare DNS:1.1.1.1'));
		o.depends({'wan_proto': 'siderouter'});
		o.datatype = 'ip4addr';
		o.default = '223.5.5.5';
		o.rmempty = false;

		// WAN Interface for other modes
		o = s.taboption('wansetup', widgets.DeviceSelect, 'wan_interface', 
			_('Device'), 
			_('Allocate the physical interface of WAN port'));
		o.depends('wan_proto', 'pppoe');
		o.depends('wan_proto', 'dhcp');
		o.depends('wan_proto', 'static');
		o.default = wan_face;
		o.ucioption = 'wan_interface';
		o.nobridges = false;
		o.rmempty = false;
		o = s.taboption('wansetup', form.Value, 'wan_pppoe_user', _('PAP/CHAP username'));
		o.depends('wan_proto', 'pppoe');
		o.rmempty = false;

		o = s.taboption('wansetup', form.Value, 'wan_pppoe_pass', _('PAP/CHAP password'));
		o.depends('wan_proto', 'pppoe');
		o.password = true;
		o.rmempty = false;

		o = s.taboption('wansetup', form.Value, 'wan_ipaddr', _('Wan IPv4 address'));
		o.depends('wan_proto', 'static');
		o.datatype = 'ip4addr';
		o.rmempty = false;

		o = s.taboption('wansetup', form.Value, 'wan_netmask', _('Wan IPv4 netmask'));
		o.depends('wan_proto', 'static');
		o.datatype = 'ip4addr';
		o.value('255.255.255.0');
		o.value('255.255.0.0');
		o.value('255.0.0.0');
		o.default = '255.255.255.0';
		o.rmempty = false;

		o = s.taboption('wansetup', form.Value, 'wan_gateway', _('Wan IPv4 gateway'));
		o.depends('wan_proto', 'static');
		o.datatype = 'ip4addr';
		o.rmempty = false;

		o = s.taboption('wansetup', form.DynamicList, 'wan_dns', _('Use custom Wan DNS'));
		o.value('223.5.5.5', _('Ali DNS:223.5.5.5'));
		o.value('180.76.76.76', _('Baidu dns:180.76.76.76'));
		o.value('114.114.114.114', _('114 DNS:114.114.114.114'));
		o.value('8.8.8.8', _('Google DNS:8.8.8.8'));
		o.value('1.1.1.1', _('Cloudflare DNS:1.1.1.1'));
		o.default = '223.5.5.5';
		o.depends('wan_proto', 'static');
		o.depends('wan_proto', 'pppoe');
		o.datatype = 'ip4addr';
		o.rmempty = false;

		o = s.taboption('wansetup', form.Flag, 'ipv6', _('Enable IPv6'));
		o.default = '0';
		o.rmempty = false;

		o = s.taboption('wansetup', form.Flag, 'lan_dhcp', _('Disable DHCP Server'), 
			_('Selecting means that the DHCP server is not enabled. In a network, only one DHCP server is needed to allocate and manage client IPs. If it is a secondary route, it is recommended to turn off the primary routing DHCP server.'));
		o.default = '0';
		o.rmempty = false;

		o = s.taboption('wansetup', form.Flag, 'dnsset', _('Enable DNS notifications (ipv4/ipv6)'),
			_('Forcefully specify the DNS server for this router'));
		o.depends('lan_dhcp', '0');
		o.default = '0';
		o.rmempty = false;

		o = s.taboption('wansetup', form.ListValue, 'dns_tables', _('DNS'));
		o.value('1', _('Use local IP for DNS (default)'));
		o.value('223.5.5.5', _('Ali DNS:223.5.5.5'));
		o.value('180.76.76.76', _('Baidu dns:180.76.76.76'));
		o.value('114.114.114.114', _('114 DNS:114.114.114.114'));
		o.value('8.8.8.8', _('Google DNS:8.8.8.8'));
		o.value('1.1.1.1', _('Cloudflare DNS:1.1.1.1'));
		o.depends('dnsset', '1');
		o.rmempty = false;

		o = s.taboption('wansetup', form.Flag, 'forwarding', _('Forcefully forwarding'),
			_('Forcefully add LAN to WAN forwarding'));
		o.default = '1';
		o.depends('wan_proto', 'pppoe');
		o.depends('wan_proto', 'dhcp');
		o.depends('wan_proto', 'static');
		o.rmempty = false;

		o = s.taboption('wansetup', form.Flag, 'https', _('Redirect to HTTPS'),
			_('Enable automatic redirection of HTTP requests to HTTPS port.'));
		o.default = '0';
		o.rmempty = false;
		if (has_wifi) {
			var wifi_ssid = s.taboption('wifisetup', form.Value, 'wifi_ssid', _('<abbr title="Extended Service Set Identifier">ESSID</abbr>'));
			wifi_ssid.datatype = 'maxlength(32)';

			var wifi_key = s.taboption('wifisetup', form.Value, 'wifi_key', _('Key'));
			wifi_key.datatype = 'wpakey';
			wifi_key.password = true;

		}

		// Other Settings Tab
		o = s.taboption('othersetup', form.Flag, 'synflood', _('Enable SYN-flood defense'),
			_('Enable Firewall SYN-flood defense [Suggest opening]'));
		o.default = '1';
		o.rmempty = false;

		return m.render();
	}
});