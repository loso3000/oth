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
			network.getDevices(),
			uci.changes(),
			L.resolveDefault(uci.load('wireless'), null),
			uci.load('network'),
			uci.load('netwizard')
		]);
	},

	render: function(data) {
		var devices = data[0] || []; // 使用 network.getDevices() 获取的网卡列表
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

		// 保存原始的save方法
		var originalSave = m.save;
		var currentLanIP = lan_ip;
		
		// 获取新IP地址的函数
		function getNewLanIP() {
			// 尝试多种方式获取IP地址
			var selectors = [
				'input[name="widget.cbid.netwizard.default.lan_ipaddr"]',
				'input[name="cbid.netwizard.default.lan_ipaddr"]',
				'input[data-option="lan_ipaddr"]',
				'input[placeholder*="IP"]',
				'.cbi-input-text[type="text"]'
			];
			
			for (var i = 0; i < selectors.length; i++) {
				var inputs = document.querySelectorAll(selectors[i]);
				for (var j = 0; j < inputs.length; j++) {
					var input = inputs[j];
					if (input && input.value) {
						// 检查是否是IP地址格式
						var ipMatch = input.value.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
						if (ipMatch) {
							// 验证每个部分是否在0-255范围内
							var valid = true;
							for (var k = 1; k <= 4; k++) {
								var part = parseInt(ipMatch[k]);
								if (part < 0 || part > 255) {
									valid = false;
									break;
								}
							}
							if (valid) {
								return input.value;
							}
						}
					}
				}
			}
			
			return null;
		}

		function showRedirectMessage(newIP) {
			// 创建覆盖层
			var overlay = document.createElement('div');
			overlay.id = 'netwizard-redirect-overlay';
			overlay.style.cssText = `
				position: fixed;
				top: 0;
				left: 0;
				width: 100%;
				height: 100%;
				background: rgba(0, 0, 0, 0.85);
				z-index: 9999;
				display: flex;
				justify-content: center;
				align-items: center;
				font-family: Arial, sans-serif;
			`;
			
			// 创建消息框
			var messageBox = document.createElement('div');
			messageBox.style.cssText = `
				background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
				padding: 1rem;
				border-radius: 15px;
				text-align: center;
				max-width: 600px;
				box-shadow: 0 20px 40px rgba(0,0,0,0.3);
				color: white;
			`;
			
			// 创建图标
			var icon = document.createElement('div');
			icon.innerHTML = '✓';
			icon.style.cssText = `
				font-size: 60px;
				color: #4CAF50;
				background: white;
				width: 100px;
				height: 100px;
				border-radius: 50%;
				display: flex;
				align-items: center;
				justify-content: center;
				margin: 0 auto 20px;
				font-weight: bold;
				box-shadow: 0 10px 20px rgba(0,0,0,0.2);
			`;
			
			// 创建标题
			var title = document.createElement('h2');
			title.textContent = _('Configuration Applied Successfully!');
			title.style.cssText = `
				margin: 0 0 20px 0;
				color: white;
			`;
			
			// 创建消息内容
			var message = document.createElement('div');
			message.innerHTML = _('The network configuration has been saved and applied.<br><br>') +
							   '<div style="background: rgba(255,255,255,0.2); border-radius: 10px; ">' +
							   _('New LAN IP Address: ') + 
							   '<strong style="color: #FFD700; font-size: 22px;">' + newIP + '</strong></div><br>' +
							   _('The page will automatically redirect in ') + 
							   '<span id="netwizard-countdown" style="color: #FFD700; font-size: 28px; font-weight: bold;">10</span>' + 
							   _(' seconds...');
			message.style.cssText = `
				color: rgba(255,255,255,0.9);
				line-height: 1.8;
				margin: 20px 0;
				font-size: 16px;
			`;
			
			// 创建按钮容器
			var buttonContainer = document.createElement('div');
			buttonContainer.style.cssText = `
				display: flex;
				justify-content: center;
				gap: 15px;
				margin-top: 25px;
				flex-wrap: wrap;
			`;
			
			// 创建立即重定向按钮
			var redirectButton = document.createElement('button');
			redirectButton.textContent = _('Redirect Now');
			redirectButton.style.cssText = `
				background: #4CAF50;
				color: white;
				border: none;
				padding: 12px 30px;
				border-radius: 50px;
				font-size: 16px;
				font-weight: bold;
				cursor: pointer;
				transition: all 0.3s ease;
				box-shadow: 0 5px 15px rgba(76, 175, 80, 0.4);
			`;
			redirectButton.onmouseover = function() {
				this.style.transform = 'translateY(-2px)';
				this.style.boxShadow = '0 8px 20px rgba(76, 175, 80, 0.6)';
			};
			redirectButton.onmouseout = function() {
				this.style.transform = 'translateY(0)';
				this.style.boxShadow = '0 5px 15px rgba(76, 175, 80, 0.4)';
			};
			redirectButton.onclick = function() {
				redirectToNewIP(newIP);
			};
			
			// 创建取消按钮
			var cancelButton = document.createElement('button');
			cancelButton.textContent = _('Stay Here');
			cancelButton.style.cssText = `
				background: rgba(255,255,255,0.2);
				color: white;
				border: 2px solid white;
				padding: 12px 30px;
				border-radius: 50px;
				font-size: 16px;
				font-weight: bold;
				cursor: pointer;
				transition: all 0.3s ease;
			`;
			cancelButton.onmouseover = function() {
				this.style.background = 'rgba(255,255,255,0.3)';
				this.style.transform = 'translateY(-2px)';
			};
			cancelButton.onmouseout = function() {
				this.style.background = 'rgba(255,255,255,0.2)';
				this.style.transform = 'translateY(0)';
			};
			cancelButton.onclick = function() {
				hideRedirectMessage();
			};
			
			// 组装元素
			messageBox.appendChild(icon);
			messageBox.appendChild(title);
			messageBox.appendChild(message);
			buttonContainer.appendChild(redirectButton);
			buttonContainer.appendChild(cancelButton);
			messageBox.appendChild(buttonContainer);
			overlay.appendChild(messageBox);
			
			// 添加到页面
			document.body.appendChild(overlay);
			
			// 开始倒计时
			var countdown = 10;
			var countdownElement = document.getElementById('netwizard-countdown');
			
			var countdownInterval = setInterval(function() {
				countdown--;
				if (countdownElement) {
					countdownElement.textContent = countdown;
					
					// 最后3秒闪烁效果
					if (countdown <= 3) {
						countdownElement.style.color = (countdown % 2 === 0) ? '#FF6B6B' : '#FFD700';
					}
				}
				
				if (countdown <= 0) {
					clearInterval(countdownInterval);
					redirectToNewIP(newIP);
				}
			}, 1000);
			
			// 保存interval以便清理
			overlay._countdownInterval = countdownInterval;
		}
		
		// 隐藏重定向消息的函数
		function hideRedirectMessage() {
			var overlay = document.getElementById('netwizard-redirect-overlay');
			if (overlay) {
				// 清除倒计时
				if (overlay._countdownInterval) {
					clearInterval(overlay._countdownInterval);
				}
				document.body.removeChild(overlay);
			}
		}
		
		// 重定向到新IP的函数
		function redirectToNewIP(newIP) {
			// 隐藏消息框
			hideRedirectMessage();
			
			// 构建新URL
			var currentProtocol = window.location.protocol;
			var currentPort = window.location.port ? ':' + window.location.port : '';
			var newURL = currentProtocol + '//' + newIP + currentPort + '/';
			
			// 显示短暂的跳转提示
			var jumpMsg = document.createElement('div');
			jumpMsg.id = 'netwizard-jump-msg';
			jumpMsg.style.cssText = `
				position: fixed;
				top: 20px;
				right: 20px;
				background: #4CAF50;
				color: white;
				padding: 15px 25px;
				border-radius: 10px;
				z-index: 10000;
				font-weight: bold;
				box-shadow: 0 5px 15px rgba(0,0,0,0.3);
				animation: slideIn 0.5s ease;
			`;
			
			// 添加CSS动画
			var style = document.createElement('style');
			style.textContent = `
				@keyframes slideIn {
					from { transform: translateX(100%); opacity: 0; }
					to { transform: translateX(0); opacity: 1; }
				}
			`;
			document.head.appendChild(style);
			
			jumpMsg.textContent = _('Redirecting to ') + newIP + '...';
			document.body.appendChild(jumpMsg);
			
			// 1秒后重定向
			setTimeout(function() {
				try {
					window.location.href = newURL;
				} catch (e) {
					alert(_('Failed to redirect to ') + newIP + 
						  _('\nPlease manually access:\n') + newURL);
					
					// 移除跳转提示
					var jumpMsg = document.getElementById('netwizard-jump-msg');
					if (jumpMsg) {
						document.body.removeChild(jumpMsg);
					}
				}
			}, 1000);
		}

		function executeNetwizardScript(newIP) {
			return new Promise(function(resolve, reject) {
				var applyingMsg = document.createElement('div');
				applyingMsg.id = 'netwizard-applying-msg';
				applyingMsg.style.cssText = `
					position: fixed;
					top: 50%;
					left: 50%;
					transform: translate(-50%, -50%);
					background: rgba(0,0,0,0.9);
					color: white;
					padding: 20px 40px;
					border-radius: 10px;
					z-index: 9998;
					font-size: 16px;
				`;
				applyingMsg.textContent = _('Applying network configuration...');
				document.body.appendChild(applyingMsg);
				
				var callRPC = rpc.declare({
					object: 'file',
					method: 'exec',
					params: ['command', 'params', 'env'],
					expect: { '': {} }
				});
				
				setTimeout(function() {
					fs.stat('/etc/init.d/netwizard').then(function(stats) {
						return callRPC('/etc/init.d/netwizard', ['start'], {});
					}).then(function(response) {
						if (applyingMsg && applyingMsg.parentNode) {
							document.body.removeChild(applyingMsg);
						}
						showRedirectMessage(newIP);
						setTimeout(function() {
							redirectToNewIP(newIP);
						}, 10000);
						
						resolve(response);
					}).catch(function(err) {
						if (applyingMsg && applyingMsg.parentNode) {
							document.body.removeChild(applyingMsg);
						}

						showRedirectMessage(newIP);
						
						setTimeout(function() {
							redirectToNewIP(newIP);
						}, 10000);
						
						resolve({}); 
					});
				}, 1000); // 等待1秒确保配置已保存
			});
		}

		// 重写save方法
		m.save = function() {
			var newLanIP = getNewLanIP();
			var ipChanged = newLanIP && currentLanIP !== newLanIP;

			var savingMsg = document.createElement('div');
			savingMsg.id = 'netwizard-saving-msg';
			savingMsg.style.cssText = `
				position: fixed;
				top: 50%;
				left: 50%;
				transform: translate(-50%, -50%);
				background: rgba(0,0,0,0.9);
				color: white;
				padding: 20px 40px;
				border-radius: 10px;
				z-index: 9998;
				font-size: 16px;
			`;
			savingMsg.textContent = _('Saving configuration...');
			document.body.appendChild(savingMsg);
			
			// 调用原始的save方法
			return originalSave.call(m).then(function(result) {

				var msg = document.getElementById('netwizard-saving-msg');
				if (msg && msg.parentNode) {
					document.body.removeChild(msg);
				}
				if (!ipChanged || !newLanIP) {
					var successMsg = document.createElement('div');
					successMsg.id = 'netwizard-success-msg';
					successMsg.style.cssText = `
						position: fixed;
						top: 20px;
						right: 20px;
						background: #4CAF50;
						color: white;
						padding: 15px 25px;
						border-radius: 10px;
						z-index: 9999;
						font-weight: bold;
						animation: slideIn 0.5s ease;
					`;
					successMsg.textContent = _('Configuration saved successfully!');
					document.body.appendChild(successMsg);
					
					// 3秒后移除提示
					setTimeout(function() {
						var msg = document.getElementById('netwizard-success-msg');
						if (msg && msg.parentNode) {
							document.body.removeChild(msg);
						}
					}, 3000);
					
					return result;
				}
				

				return executeNetwizardScript(newLanIP).then(function() {
					return result;
				}).catch(function(err) {
					showRedirectMessage(newLanIP);
					setTimeout(function() {
						redirectToNewIP(newLanIP);
					}, 10000);
					
					return result;
				});
			}).catch(function(err) {
				var msg = document.getElementById('netwizard-saving-msg');
				if (msg && msg.parentNode) {
					document.body.removeChild(msg);
				}
				var errorMsg = document.createElement('div');
				errorMsg.id = 'netwizard-error-msg';
				errorMsg.style.cssText = `
					position: fixed;
					top: 20px;
					right: 20px;
					background: #f44336;
					color: white;
					padding: 15px 25px;
					border-radius: 10px;
					z-index: 9999;
					font-weight: bold;
					animation: slideIn 0.5s ease;
				`;
				errorMsg.textContent = _('Failed to save configuration');
				document.body.appendChild(errorMsg);
				
				// 5秒后移除错误提示
				setTimeout(function() {
					var msg = document.getElementById('netwizard-error-msg');
					if (msg && msg.parentNode) {
						document.body.removeChild(msg);
					}
				}, 5000);
				
				throw err;
			});
		};

		return m.render();
	}
});